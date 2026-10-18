const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { assert, mock, load, bot, job, called } = require("./helpers/unit");

function memoryFile(initial) {
    let contents = initial;
    return {
        readFile: mock.fn(async () => {
            if (contents instanceof Error) throw contents;
            if (contents === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
            return contents;
        }),
        writeFile: mock.fn(async (file, text) => { contents = text; }),
        value: () => JSON.parse(contents),
    };
}

test("bot state defaults missing files, normalizes muted state and persists mute/unmute", async () => {
    const file = memoryFile();
    const state = load(bot + "services/botState.js", { "fs/promises": file });
    assert.deepEqual(await state.readBotState(), { muted: false });
    assert.equal(await state.isMuted(), false);
    assert.deepEqual(await state.setMuted(true), { muted: true });
    assert.equal(await state.isMuted(), true);
    assert.deepEqual(file.value(), { muted: true });
    await state.setMuted(false);
    assert.equal(await state.isMuted(), false);
    await state.writeBotState({ muted: "true" });
    assert.equal(await state.isMuted(), false);
});

test("bot state surfaces malformed JSON and I/O errors", async () => {
    for (const input of ["{", Object.assign(new Error("denied"), { code: "EACCES" })]) {
        const state = load(bot + "services/botState.js", { "fs/promises": memoryFile(input) });
        await assert.rejects(state.readBotState());
    }
});

test("digest history reads/writes missing, valid and non-array data and rejects corruption", async () => {
    for (const [input, expected] of [[undefined, []], ["{}", []], ["[]", []], [JSON.stringify([job()]), [job()]]]) {
        const file = memoryFile(input);
        const digest = load(bot + "services/runInternshipDigest.js", { "fs/promises": file });
        assert.deepEqual(await digest.readSentInternships(), expected);
        await digest.writeSentInternships([job()]);
        assert.deepEqual(file.value(), [job()]);
    }
    for (const input of ["{", Object.assign(new Error("denied"), { code: "EACCES" })]) {
        const digest = load(bot + "services/runInternshipDigest.js", { "fs/promises": memoryFile(input) });
        await assert.rejects(digest.readSentInternships());
    }
});

test("digest selection prioritizes new listings, matches legacy identities and fills from history", async () => {
    const seen = job({ id: "seen" });
    const fresh = job({ id: "fresh", company: "New Co" });
    const legacy = job({ id: undefined, company: "Legacy Co" });
    const file = memoryFile(JSON.stringify([seen, legacy, "old-string-id"]));
    const digest = load(bot + "services/runInternshipDigest.js", { "fs/promises": file });
    assert.equal(digest.getSavedInternshipId("string-id"), "string-id");
    assert.equal(digest.getSavedInternshipId(seen), "seen");
    assert.match(digest.getSavedInternshipId(legacy), /^legacy co\|/);
    assert.deepEqual(digest.createSavedInternship({ ...fresh, discarded: true }), fresh);
    const selected = await digest.getInternshipsToSend([seen, legacy, fresh]);
    assert.deepEqual(selected.internshipsToSend, [fresh, seen, legacy]);
    assert.equal(selected.sentIds.has("seen"), true);
    await digest.saveShownInternships(selected);
    assert.deepEqual(file.value(), JSON.parse(JSON.stringify([seen, legacy, fresh])));
    assert.deepEqual((await digest.getInternshipsToSend([seen, fresh], 1)).internshipsToSend, [seen]);
});

test("digest sends selected jobs before saving and propagates delivery failures", async () => {
    for (const fails of [false, true]) {
        const file = memoryFile("[]");
        const send = mock.fn(async () => {
            assert.equal(file.writeFile.mock.callCount(), 0);
            if (fails) throw new Error("send failed");
        });
        const digest = load(bot + "services/runInternshipDigest.js", {
            "fs/promises": file,
            [bot + "services/getCurrentInternships.js"]: { getCurrentInternships: async () => [job()] },
            [bot + "sendInternshipNotification.js"]: { sendInternshipNotification: send },
        });
        if (fails) {
            await assert.rejects(digest.runInternshipDigest({ client: {}, channelId: "channel" }), /send failed/);
            assert.equal(file.writeFile.mock.callCount(), 0);
        } else {
            const client = {};
            assert.deepEqual(await digest.runInternshipDigest({ client, channelId: "channel" }), [job()]);
            called(send, client, "channel", [job()]);
            assert.deepEqual(file.value(), [job()]);
        }
    }
});

test("saved history export handles filtering, empty results, JSON attachments and DM failures", async () => {
    const { message } = require("./helpers/unit");
    const { sendSavedInternships } = load(bot + "services/sendSavedInternships.js", {
        [bot + "services/runInternshipDigest.js"]: { readSentInternships: async () => [job(), job({ id: "other" })] },
    });
    const msg = message();
    const options = { message: msg, fileName: "history.json", title: "History", emptyMessage: "Nothing saved" };
    assert.equal((await sendSavedInternships(options)).length, 2);
    let attachment = msg.author.send.mock.calls.at(-1).arguments[0].files[0];
    assert.equal(attachment.name, "history.json");
    assert.equal(JSON.parse(attachment.attachment.toString()).length, 2);
    assert.equal((await sendSavedInternships({ ...options, filter: item => item.id === "other" })).length, 1);
    assert.deepEqual(await sendSavedInternships({ ...options, filter: () => false }), []);
    called(msg.reply, "Nothing saved");
    msg.author.send.mock.mockImplementation(async () => { throw Object.assign(new Error("DMs disabled"), { code: 50007 }); });
    assert.deepEqual(await sendSavedInternships(options), []);
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /couldn't DM/);
    msg.author.send.mock.mockImplementation(async () => { throw new Error("unexpected"); });
    await assert.rejects(sendSavedInternships(options), /unexpected/);
});

test("seen-job store creates missing files, keeps first-seen timestamps, prunes and saves atomically", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "seen-jobs-unit-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const { SeenJobsStore } = load(bot + "services/seenJobsStore.js");
    const defaults = new SeenJobsStore();
    assert.equal(defaults.retentionDays, 90);
    assert.match(defaults.filePath, /seen-jobs.json$/);
    const filePath = path.join(directory, "nested/jobs.json");
    const store = new SeenJobsStore({ filePath, retentionDays: 10 });
    await store.load();
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, "utf8")), {});
    await assert.rejects(store.markSeen(""), /job ID/);
    await Promise.all([store.markSeen("a"), store.markSeen("b")]);
    const first = store.entries.get("a");
    await store.markSeen("a");
    assert.equal(store.has("a"), true);
    assert.equal(store.has("missing"), false);
    assert.equal(store.entries.get("a"), first);
    store.entries.set("expired", new Date(Date.now() - 11 * 86400000).toISOString());
    store.entries.set("invalid", "not-a-date");
    assert.equal(store.prune(), 2);
    await store.save();
    const reloaded = new SeenJobsStore({ filePath });
    await reloaded.load();
    assert.deepEqual([...reloaded.entries], [...store.entries]);
    await assert.rejects(fs.stat(filePath + ".tmp"), { code: "ENOENT" });
});

test("seen-job load recovers corrupt/invalid files and discards invalid entries", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "seen-jobs-invalid-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const { SeenJobsStore } = load(bot + "services/seenJobsStore.js");
    const filePath = path.join(directory, "jobs.json");
    for (const contents of [" ", "{", "[]", "null", JSON.stringify({ good: "2026-01-01", bad: 123, "": "invalid" })]) {
        await fs.writeFile(filePath, contents);
        const store = new SeenJobsStore({ filePath });
        store.entries.set("stale", "invalid");
        await store.load();
        assert.equal(store.has("stale"), false);
        assert.equal(store.has("bad"), false);
        assert.equal(store.entries.size, contents.includes("good") ? 1 : 0);
    }
});
