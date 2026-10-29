const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const database = require("../../api/dbs-client");
const brotherCommand = require("../commands/brotherCommand");
const { handleMentionCommand } = require("../commands/handleMentionCommand");
const { routeResponse } = require("../router");
const stored = record => ({ big: "", littles: [], ...record });

const member = {
    name: "Ishan Rastogi", email: "ishan@example.com", "phone number": "+1 (312) 555-1234",
    class: "Alpha Class", major: "Computer Science", "grad year": "2028",
    "positions held": "President", "family line": "Oak", nicknames: "Ish; IR, Rastogi\nIshan R",
    "brotherhood status": "Active", "linkedin link": "https://www.linkedin.com/in/ishan",
};

async function fixture(t, members = [member]) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brotherhood-lookup-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "test-db.json");
    const client = database.createLocalDatabase(file);
    await client.addMembers(members);
    return { file, client };
}

function message(content) {
    const replies = [];
    return {
        author: { id: "viewer", bot: false },
        content,
        mentions: { users: new Map([["123", {}]]) },
        replies,
        async reply(response) { replies.push(response); },
    };
}

test("brother command accepts full names or nicknames and returns a router lookup request", async () => {
    for (const [args, query] of [
        [["Ishan", "Rastogi"], "Ishan Rastogi"],
        [['"Ishan', 'Rastogi"'], "Ishan Rastogi"],
        [["Ish"], "Ish"], [["John", "O'Connor"], "John O'Connor"],
    ]) {
        assert.deepEqual(await brotherCommand.execute({}, {}, args), { type: "brother", ok: true, query });
    }
});

test("missing names or unclosed quotes return usage and an example", async () => {
    for (const args of [[], ['""'], ['"Ishan', "Rastogi"]]) {
        const response = await brotherCommand.execute({}, {}, args);
        assert.equal(response.ok, false);
        assert.match(response.message, /Usage:.*brother.*nickname/);
        assert.match(response.message, /Example:.*Ishan Rastogi/);
    }
});

test("database matches full names and delimited nicknames without case or whitespace sensitivity", async t => {
    const { client } = await fixture(t);
    for (const query of ["ISHAN RASTOGI", "  ishan   rastogi  ", "ish", "ir", "RASTOGI", "ishan r"]) {
        assert.deepEqual(await client.findBrother(query), stored(member));
    }
});

test("nickname arrays and aliases appearing more than once still identify one member", async t => {
    const record = { name: "Ishan Rastogi", nicknames: ["Ish", "IR", "Ish"] };
    const { client } = await fixture(t, [record]);
    assert.deepEqual(await client.findBrother("ISH"), stored(record));
    assert.deepEqual(await client.findBrother("ir"), stored(record));
});

test("lookup supports partial names and nicknames and returns null for unknown queries", async t => {
    const { client } = await fixture(t);
    assert.equal(await client.findBrother("Nobody Here"), null);
    for (const query of ["ishan", "Is", "rast", "han r"]) {
        assert.deepEqual(await client.findBrother(query), stored(member));
    }
    await assert.rejects(client.findBrother("   "), /Provide a name or nickname/);
});

test("multiple partial-name matches return name options without choosing a person", async t => {
    const { client } = await fixture(t, [
        member, { name: "Ishan Patel", nicknames: "IP" }, { name: "Unrelated Person" },
    ]);
    await assert.rejects(client.findBrother("ISHAN"), error => {
        assert.equal(error.code, "AMBIGUOUS_MEMBER");
        assert.deepEqual(error.options, ["Ishan Rastogi", "Ishan Patel"]);
        return true;
    });
});

test("router lists matching full names and asks for clarification, then accepts a full-name query", async t => {
    const { file, client } = await fixture(t, [member, { name: "Ishan Patel", email: "patel@example.com" }]);
    const original = await fs.readFile(file, "utf8");
    t.mock.method(database, "findBrother", client.findBrother);
    const msg = message("<@123> /brother ishan");
    await handleMentionCommand(msg, { user: { id: "123" } });
    const report = msg.replies.map(reply => reply.content).join("\n");
    assert.match(report, /Which person did you mean/);
    assert.match(report, /- Ishan Rastogi/);
    assert.match(report, /- Ishan Patel/);
    assert.match(report, /\/brother Full Name/);
    assert.doesNotMatch(report, /ishan@example.com|patel@example.com/);
    const clarified = message("<@123> /brother Ishan Rastogi");
    await handleMentionCommand(clarified, { user: { id: "123" } });
    assert.match(clarified.replies[0].content, /ishan@example.com/);
    assert.equal(await fs.readFile(file, "utf8"), original);
});

test("an exact full name can select a name that is also a prefix of another person's name", async t => {
    const { client } = await fixture(t, [member, { name: "Ishan Rastogi Jr." }]);
    await assert.rejects(client.findBrother("ishan"), { code: "AMBIGUOUS_MEMBER" });
    assert.deepEqual(await client.findBrother("ISHAN RASTOGI"), stored(member));
});

test("partial nickname matches include every matching person's full name", async t => {
    const { client } = await fixture(t, [
        { name: "John Smith", nicknames: ["Captain John"] },
        { name: "Jane Doe", nicknames: "Captain Jane; JD" },
    ]);
    await assert.rejects(client.findBrother("captain"), error => {
        assert.deepEqual(error.options, ["John Smith", "Jane Doe"]);
        return true;
    });
    assert.equal((await client.findBrother("captain jo")).name, "John Smith");
});

test("ambiguous names or nicknames never return an arbitrary person's information", async t => {
    const { client } = await fixture(t, [
        { name: "Ishan Rastogi", nicknames: "Ish" }, { name: "Another Person", nicknames: "ISH" },
    ]);
    await assert.rejects(client.findBrother("ish"), { code: "AMBIGUOUS_MEMBER" });
    assert.equal((await client.findBrother("Ishan Rastogi")).name, "Ishan Rastogi");
});

test("command, router, and database return every field to a nonowner without writing", async t => {
    const { file, client } = await fixture(t);
    const original = await fs.readFile(file, "utf8");
    const lookup = t.mock.method(database, "findBrother", client.findBrother);
    const msg = message("<@123> /brother ish");
    await handleMentionCommand(msg, { user: { id: "123" } });
    assert.deepEqual(lookup.mock.calls[0].arguments, ["ish"]);
    const report = msg.replies.map(reply => reply.content).join("\n");
    for (const text of ["Ishan Rastogi", "ishan@example.com", "Alpha Class", "Computer Science", "2028", "President", "Oak", "Active", "linkedin.com/in/ishan"]) {
        assert.ok(report.includes(text), `Missing information: ${text}`);
    }
    assert.match(report, /\*\*Phone number:\*\*/);
    assert.match(report, /\*\*Nicknames:\*\*/);
    assert.match(report, /\*\*LinkedIn link:\*\*/);
    assert.equal(await fs.readFile(file, "utf8"), original);
    assert.deepEqual(msg.replies[0].allowedMentions, { parse: [], repliedUser: false });
});

test("router shows missing fields and includes extra stored fields, zero and false values", async t => {
    t.mock.method(database, "findBrother", async () => ({
        name: "Ishan Rastogi", nicknames: [], company: "Example Inc", count: 0, active: false,
        notes: { award: "Scholarship" },
    }));
    const msg = message("<@123> /brother Ishan Rastogi");
    await routeResponse(msg, { type: "brother", ok: true, query: "Ishan Rastogi" });
    const report = msg.replies.map(reply => reply.content).join("\n");
    assert.match(report, /\*\*Email:\*\* Not provided/);
    assert.match(report, /\*\*Nicknames:\*\* Not provided/);
    assert.match(report, /\*\*Company:\*\* Example Inc/);
    assert.match(report, /\*\*Count:\*\* 0/);
    assert.match(report, /\*\*Active:\*\* false/);
    assert.match(report, /Scholarship/);
});

test("missing command arguments do not reach the database", async t => {
    const lookup = t.mock.method(database, "findBrother", async () => { throw new Error("Unexpected lookup"); });
    const msg = message("<@123> /brother");
    await handleMentionCommand(msg, { user: { id: "123" } });
    assert.equal(lookup.mock.callCount(), 0);
    assert.match(msg.replies[0].content, /Usage:/);
});

test("router explains unknown or ambiguous queries and handles database failures", async t => {
    const lookup = t.mock.method(database, "findBrother", async () => null);
    t.mock.method(console, "error", () => {});
    const response = { type: "brother", ok: true, query: "Ish" };
    let msg = message("");
    await routeResponse(msg, response);
    assert.match(msg.replies[0].content, /No brother was found.*Ish/);
    lookup.mock.mockImplementation(async () => {
        const error = new Error("More than one brother matches. Use a unique full name.");
        error.code = "AMBIGUOUS_MEMBER";
        throw error;
    });
    msg = message("");
    await routeResponse(msg, response);
    assert.match(msg.replies[0].content, /More than one brother matches/);
    lookup.mock.mockImplementation(async () => { throw new Error("Database read failed"); });
    msg = message("");
    await routeResponse(msg, response);
    assert.match(msg.replies[0].content, /Could not retrieve/);
});

test("large profiles include all stored information across replies within Discord limits", async t => {
    const description = "x".repeat(4500);
    t.mock.method(database, "findBrother", async () => ({ name: "Ishan Rastogi", description, last: "End of profile" }));
    const msg = message("");
    await routeResponse(msg, { type: "brother", ok: true, query: "Ishan Rastogi" });
    assert.ok(msg.replies.length > 1);
    assert.ok(msg.replies.every(reply => reply.content.length <= 2000));
    const joined = msg.replies.map(reply => reply.content).join("");
    assert.ok(joined.includes(description));
    assert.match(joined, /End of profile/);
});

test("lookup reads the latest queued import and nickname update", async t => {
    const { client } = await fixture(t, []);
    const [, , found] = await Promise.all([
        client.addMembers([{ name: "Ishan Rastogi" }]),
        client.updateMember("Ishan Rastogi", "nicknames", "IR"),
        client.findBrother("ir"),
    ]);
    assert.deepEqual(found, stored({ name: "Ishan Rastogi", nicknames: "IR" }));
});
