const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const database = require("../../api/dbs-client");
const deleteCommand = require("../commands/deleteCommand");
const { handleMentionCommand } = require("../commands/handleMentionCommand");
const { handleDeleteConfirmation, routeResponse } = require("../router");

const bot = { user: { id: "999" } };
const stored = record => ({ big: "", littles: [], ...record });
let sequence = 0;

function configureOwner(t) {
    const previous = process.env.BOT_OWNER_ID;
    process.env.BOT_OWNER_ID = "requester";
    t.after(() => {
        if (previous === undefined) {
            delete process.env.BOT_OWNER_ID;
        } else {
            process.env.BOT_OWNER_ID = previous;
        }
    });
}

async function fixture(t, members = [{ name: "John Smith", major: "Math" }, { name: "Jane Doe" }]) {
    configureOwner(t);
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brotherhood-delete-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "test-db.json");
    const client = database.createLocalDatabase(file);
    await client.addMembers(members);
    const find = t.mock.method(database, "findMember", client.findMember);
    const remove = t.mock.method(database, "deleteMember", client.deleteMember);
    const channelId = `channel-${++sequence}`;
    const replies = [];
    function message(content, overrides = {}) {
        return {
            author: { id: "requester", bot: false }, guildId: "guild", channelId,
            content, mentions: { users: new Map(content.includes("<@999>") ? [["999", bot.user]] : []) },
            async reply(response) {
                const id = `prompt-${++sequence}`;
                replies.push({ id, ...response });
                return { id };
            },
            ...overrides,
        };
    }
    return {
        file, client, replies, message, find, remove,
        read: async () => JSON.parse(await fs.readFile(file, "utf8")),
        request: (name = "John Smith") => handleMentionCommand(message(`<@999> /delete ${name}`), bot),
        answer: (content = "<@999> yes", overrides) => handleMentionCommand(message(content, overrides), bot),
    };
}

test("delete accepts full names with or without quotes and rejects missing names", async t => {
    configureOwner(t);
    for (const args of [["John", "Smith"], ['"John', 'Smith"'], ["John", "O'Connor"]]) {
        const response = await deleteCommand.execute({ author: { id: "requester" } }, bot, args);
        assert.equal(response.ok, true);
        assert.equal(response.type, "delete");
        assert.ok(response.name.startsWith("John"));
    }
    for (const args of [[], ['""'], ['"John', "Smith"]]) {
        const response = await deleteCommand.execute({ author: { id: "requester" } }, bot, args);
        assert.equal(response.ok, false);
        assert.match(response.message, /Usage:/);
    }
});

test("nonowners are rejected before a database lookup or confirmation prompt", async t => {
    const f = await fixture(t);
    await handleMentionCommand(f.message("<@999> /delete John Smith", {
        author: { id: "not-the-owner", bot: false },
    }), bot);
    assert.equal(f.find.mock.callCount(), 0);
    assert.equal(f.remove.mock.callCount(), 0);
    assert.match(f.replies[0].content, /Only the bot owner can request deletion/);
    assert.equal((await f.read()).members.length, 2);
});

test("router independently rejects an accepted deletion payload from a nonowner", async t => {
    const f = await fixture(t);
    await routeResponse(f.message("<@999> /delete John Smith", {
        author: { id: "not-the-owner", bot: false },
    }), { type: "delete", ok: true, name: "John Smith" });
    assert.equal(f.find.mock.callCount(), 0);
    assert.equal(f.remove.mock.callCount(), 0);
    assert.match(f.replies[0].content, /Only the bot owner/);
});

test("missing or blank owner configuration never authorizes deletion", async t => {
    const f = await fixture(t);
    for (const ownerId of [undefined, "", "   "]) {
        if (ownerId === undefined) {
            delete process.env.BOT_OWNER_ID;
        } else {
            process.env.BOT_OWNER_ID = ownerId;
        }
        await f.request();
        assert.match(f.replies.at(-1).content, /Only the bot owner/);
    }
    assert.equal(f.find.mock.callCount(), 0);
    assert.equal(f.remove.mock.callCount(), 0);
});

test("ownership is rechecked at confirmation and stale requests are cancelled", async t => {
    const f = await fixture(t);
    await f.request();
    process.env.BOT_OWNER_ID = "new-owner";
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 0);
    process.env.BOT_OWNER_ID = "requester";
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 0);
    assert.equal((await f.read()).members.length, 2);
});

test("request prompts first and deletes only after the requester confirms", async t => {
    const f = await fixture(t);
    await f.request();
    assert.equal((await f.read()).members.length, 2);
    assert.equal(f.remove.mock.callCount(), 0);
    assert.match(f.replies[0].content, /Delete John Smith.*Confirm/);
    await f.answer();
    assert.deepEqual((await f.read()).members, [stored({ name: "Jane Doe" })]);
    assert.equal(f.remove.mock.callCount(), 1);
    assert.match(f.replies[1].content, /Deleted John Smith/);
});

test("a direct yes reply is handled before the mention-command requirement", async t => {
    const f = await fixture(t);
    await f.request();
    await f.answer("  YeS  ", { reference: { messageId: f.replies[0].id } });
    assert.equal((await f.read()).members.length, 1);
    assert.match(f.replies[1].content, /Deleted John Smith/);
});

test("other users, bots, channels, and guilds cannot confirm someone else's request", async t => {
    const f = await fixture(t);
    await f.request();
    for (const overrides of [
        { author: { id: "someone-else", bot: false } },
        { author: { id: "requester", bot: true } },
        { channelId: "another-channel" }, { guildId: "another-guild" },
    ]) {
        await f.answer("<@999> yes", overrides);
    }
    assert.equal(f.remove.mock.callCount(), 0);
    assert.equal((await f.read()).members.length, 2);
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 1);
});

test("replying yes to an unrelated message does not confirm a deletion", async t => {
    const f = await fixture(t);
    await f.request();
    await f.answer("yes", { reference: { messageId: "unrelated-prompt" } });
    assert.equal(f.remove.mock.callCount(), 0);
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 1);
});

test("no cancels a request and subsequent yes does nothing", async t => {
    const f = await fixture(t);
    await f.request();
    await f.answer("<@999> no");
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 0);
    assert.equal((await f.read()).members.length, 2);
    assert.match(f.replies[1].content, /cancelled/);
});

test("confirmation expires after 60 seconds", async t => {
    const f = await fixture(t);
    const now = Date.now();
    t.mock.method(Date, "now", () => now);
    await f.request();
    Date.now.mock.mockImplementation(() => now + 60_001);
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 0);
    assert.equal((await f.read()).members.length, 2);
});

test("only exact yes or no is treated as a confirmation answer", async t => {
    const f = await fixture(t);
    await f.request();
    for (const answer of ["<@999> yes please", "<@999> y", "<@999> maybe", ""]) {
        await f.answer(answer);
    }
    assert.equal(f.remove.mock.callCount(), 0);
    await f.answer();
    assert.equal(f.remove.mock.callCount(), 1);
});

test("concurrent repeated yes messages consume the request once", async t => {
    const f = await fixture(t);
    await f.request();
    await Promise.all([f.answer(), f.answer()]);
    assert.equal(f.remove.mock.callCount(), 1);
    assert.equal((await f.read()).members.length, 1);
});

test("a new request replaces the old request and ignores replies to the old prompt", async t => {
    const f = await fixture(t);
    await f.request();
    const oldPrompt = f.replies[0].id;
    await f.request("Jane Doe");
    await f.answer("yes", { reference: { messageId: oldPrompt } });
    assert.equal(f.remove.mock.callCount(), 0);
    await f.answer();
    assert.deepEqual((await f.read()).members, [stored({ name: "John Smith", major: "Math" })]);
});

test("unknown members are reported without opening a confirmation", async t => {
    const f = await fixture(t);
    await f.request("Nobody Here");
    await f.answer();
    assert.match(f.replies[0].content, /No member named Nobody Here was found/);
    assert.equal(f.remove.mock.callCount(), 0);
});

test("ambiguous names are rejected without deleting any matching record", async t => {
    const f = await fixture(t, [{ name: "John Smith" }, { name: "JOHN SMITH" }]);
    t.mock.method(console, "error", () => {});
    await f.request();
    await f.answer();
    assert.match(f.replies[0].content, /More than one member/);
    assert.equal(f.remove.mock.callCount(), 0);
    assert.equal((await f.read()).members.length, 2);
});

test("a record changed after the prompt is not deleted", async t => {
    const f = await fixture(t);
    t.mock.method(console, "error", () => {});
    await f.request();
    await f.client.updateMember("John Smith", "major", "Physics");
    await f.answer();
    assert.equal((await f.read()).members.length, 2);
    assert.match(f.replies[1].content, /record changed/);
});

test("a member removed before confirmation is reported as already absent", async t => {
    const f = await fixture(t);
    await f.request();
    await f.client.deleteMember("John Smith");
    await f.answer();
    assert.match(f.replies[1].content, /no longer in the database/);
    assert.deepEqual((await f.read()).members, [stored({ name: "Jane Doe" })]);
});

test("failed deletion writes preserve the database and report failure", async t => {
    const f = await fixture(t);
    await f.request();
    const contents = await fs.readFile(f.file, "utf8");
    t.mock.method(fs, "rename", async () => { throw new Error("Disk is full"); });
    t.mock.method(console, "error", () => {});
    await f.answer();
    assert.equal(await fs.readFile(f.file, "utf8"), contents);
    assert.match(f.replies[1].content, /Could not delete.*No records were deleted/);
});

test("deletion shares the write queue with imports and updates", async t => {
    const f = await fixture(t);
    await Promise.all([
        f.client.updateMember("John Smith", "major", "Physics"),
        f.client.deleteMember("  JOHN   SMITH  "),
        f.client.addMembers([{ name: "New Member" }]),
    ]);
    assert.deepEqual((await f.read()).members, [{ name: "Jane Doe" }, { name: "New Member" }].map(stored));
});

test("confirmation without a pending request does not call the database", async t => {
    const f = await fixture(t);
    assert.equal(await handleDeleteConfirmation(f.message("yes"), bot), false);
    assert.equal(f.remove.mock.callCount(), 0);
});
