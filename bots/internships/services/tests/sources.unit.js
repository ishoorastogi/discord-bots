const { test } = require("node:test");
const { assert, mock, load, bot, listing, called } = require("./helpers/unit");

function repository(data) {
    const getContent = mock.fn(async () => ({ data }));
    const config = { owner: "owner", repo: "repo", path: "listings.json", branch: "main" };
    const reader = load(bot + "repos/readInternshipRepo.js", {
        "shared/github/githubClient.js": { createGitHubClient: () => ({ repos: { getContent } }) },
        [bot + "config.js"]: { loadRepositoryConfig: () => config },
    });
    return { ...reader, getContent };
}

test("repository reader decodes base64, forwards the configured ref and returns file metadata", async () => {
    const data = { type: "file", content: Buffer.from("[]").toString("base64"), sha: "sha", path: "listings.json", size: 2, html_url: "https://example.com/file" };
    const reader = repository(data);
    assert.deepEqual(await reader.readInternshipRepo(), { content: "[]", sha: "sha", path: "listings.json", size: 2, htmlUrl: data.html_url });
    called(reader.getContent, { owner: "owner", repo: "repo", path: "listings.json", ref: "main" });
    assert.equal((await repository({ ...data, content: "[]", encoding: "utf8" }).readInternshipRepo()).content, "[]");
});

test("repository reader downloads large files and surfaces directory/type/content/HTTP failures", async (t) => {
    const fetch = t.mock.method(global, "fetch", async () => ({ ok: true, text: async () => "[]" }));
    const data = { type: "file", download_url: "https://example.com/raw" };
    assert.equal((await repository(data).readInternshipRepo()).content, "[]");
    called(fetch, data.download_url);
    for (const [value, error] of [[[], /directory/], [{ type: "symlink" }, /symlink/], [{ type: "file" }, /no content/]]) {
        await assert.rejects(repository(value).readInternshipRepo(), error);
    }
    fetch.mock.mockImplementation(async () => ({ ok: false, status: 503, statusText: "Unavailable" }));
    await assert.rejects(repository(data).readInternshipRepo(), /503 Unavailable/);
    fetch.mock.mockImplementation(async () => { throw new Error("offline"); });
    await assert.rejects(repository(data).readInternshipRepo(), /offline/);
});

test("Greenhouse HTML and job normalization decode entities, supply defaults and preserve dates", () => {
    const source = load(bot + "sources/greenhouse.js");
    assert.equal(source.stripHtml(), "");
    assert.equal(source.stripHtml("<p>Hello&nbsp; &amp; &quot;world&quot; &#39;yes&#39;</p>"), 'Hello & "world" \'yes\'');
    assert.deepEqual(source.normalizeGreenhouseJob({ id: 1 }, "board", "Acme"), {
        id: "greenhouse:board:1", source: "Greenhouse", sourceCompanyToken: "board",
        company: "Acme", role: "Untitled role", location: "Location not listed",
        url: "", description: "", postedAt: null,
    });
    const job = source.normalizeGreenhouseJob({ id: 2, title: " Intern ", location: { name: " NYC " }, content: "<b>Work</b>", absolute_url: "https://example.com", updated_at: "2026-01-02" }, "board", "Acme");
    assert.equal(job.role, "Intern");
    assert.equal(job.location, "NYC");
    assert.equal(job.postedAt.toISOString(), "2026-01-02T00:00:00.000Z");
});

test("Greenhouse fetch encodes board names, normalizes jobs and rejects invalid responses", async (t) => {
    const fetch = t.mock.method(global, "fetch", async () => ({ ok: true, json: async () => ({ jobs: [{ id: 1, title: "Intern" }] }) }));
    const { fetchGreenhouseJobs } = load(bot + "sources/greenhouse.js");
    const jobs = await fetchGreenhouseJobs("board/name", "Acme");
    assert.equal(jobs[0].id, "greenhouse:board/name:1");
    assert.match(fetch.mock.calls[0].arguments[0], /board%2Fname\/jobs\?content=true/);
    assert.equal(fetch.mock.calls[0].arguments[1].headers.Accept, "application/json");
    await assert.rejects(fetchGreenhouseJobs("", "Acme"), /requires both/);
    await assert.rejects(fetchGreenhouseJobs("board", ""), /requires both/);
    fetch.mock.mockImplementation(async () => ({ ok: false, status: 404, statusText: "Not Found" }));
    await assert.rejects(fetchGreenhouseJobs("board", "Acme"), /404 Not Found/);
    fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } }));
    await assert.rejects(fetchGreenhouseJobs("board", "Acme"), /invalid JSON/);
    fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
    await assert.rejects(fetchGreenhouseJobs("board", "Acme"), /jobs array/);
});

for (const [name, title] of [
    ["", "Software Engineering Intern"], ["CS", "Software Engineering Intern"],
    ["ME", "Mechanical Engineering Intern"], ["EE", "Electrical Engineering Intern"],
    ["BM", "Biomedical Engineering Intern"], ["CE", "Computer Engineering Intern"],
]) {
    test(`getCurrent${name}Internships parses, filters and returns newest-first without sending`, async () => {
        const content = JSON.stringify([
            listing({ id: "old", title, date_posted: 1 }),
            listing({ id: "fresh", title, date_posted: 2 }),
            listing({ id: "foreign", title, locations: ["Toronto, Canada"] }),
            listing({ id: "accounting", title: "Accounting Intern" }),
        ]);
        const current = load(bot + "services/getCurrentInternships.js", {
            [bot + "repos/readInternshipRepo.js"]: { readInternshipRepo: async () => ({ content }) },
        });
        const results = await current[`getCurrent${name}Internships`]();
        assert.deepEqual(results.map(item => item.id), ["fresh", "old"]);
    });
}

test("current internships propagates source and parser failures", async () => {
    for (const readInternshipRepo of [async () => { throw new Error("offline"); }, async () => ({ content: "{" })]) {
        const current = load(bot + "services/getCurrentInternships.js", {
            [bot + "repos/readInternshipRepo.js"]: { readInternshipRepo },
        });
        await assert.rejects(current.getCurrentInternships());
    }
});
