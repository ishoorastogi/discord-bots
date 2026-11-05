const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createMentionHandler } = require("../commands/handleMentionCommand");
const { createRouter, hasDatabaseHandlers } = require("../router");
const disconnected = createRouter(null);
const handleMentionCommand = createMentionHandler(disconnected);

test("explicitly disconnected router reports unavailable commands before parsing or downloading", async () => {
    for (const command of ["/brother John", "/delete John", "/update John major Math", "/fileintake"]) {
        const replies = [];
        await handleMentionCommand({
            author: { id: "viewer", bot: false }, content: `<@123> ${command}`,
            mentions: { users: new Map([["123", {}]]) },
            get attachments() { throw new Error("Disconnected intake must not download files"); },
            async reply(response) { replies.push(response.content); },
        }, { user: { id: "123" } });
        assert.deepEqual(replies, ["Database commands are temporarily unavailable."]);
    }
});

test("explicitly disconnected router leaves the test command available", async () => {
    const replies = [];
    await handleMentionCommand({
        author: { id: "viewer", bot: false }, content: "<@123> /test",
        mentions: { users: new Map([["123", {}]]) },
        async reply(response) { replies.push(response); },
    }, { user: { id: "123" } });
    assert.deepEqual(replies, ["bot is online"]);
});

test("disconnected router never accepts deletion confirmations", async () => {
    assert.equal(await disconnected.handleDeleteConfirmation({ content: "yes" }, {}), false);
});

test("default router connects the PostgreSQL database handlers", () => {
    assert.equal(hasDatabaseHandlers, true);
});
