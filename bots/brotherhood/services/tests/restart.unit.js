const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const childProcess = require("node:child_process");
const path = require("node:path");
const { setImmediate } = require("node:timers/promises");
const { test } = require("node:test");
const restartCommand = require("../commands/restartCommand");
const { createMentionHandler } = require("../commands/handleMentionCommand");
const { createRouter } = require("../router");

function fixture(t) {
    const keys = ["BOT_OWNER_ID", "pm_id", "PM2_HOME", "RESTART_REQUESTER_ID"];
    const previous = keys.map(key => process.env[key]);
    t.after(() => keys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key];
        else process.env[key] = previous[index];
    }));
    Object.assign(process.env, {
        BOT_OWNER_ID: " owner ", pm_id: "0", PM2_HOME: "/tmp/test-pm2", RESTART_REQUESTER_ID: "untrusted",
    });
    const replies = [];
    const message = {
        author: { id: "owner", bot: false },
        content: "<@123> /restart",
        mentions: { users: new Map([["123", {}]]) },
        async reply(response) { replies.push(response); },
    };
    const child = new EventEmitter();
    child.unref = t.mock.fn();
    const spawn = t.mock.method(childProcess, "spawn", () => {
        assert.deepEqual(replies, ["Restarting the bot..."]);
        return child;
    });
    t.mock.method(console, "error", () => {});
    return { message, replies, child, spawn };
}

test("restart rejects nonowners and missing owner configuration before spawning", async t => {
    const f = fixture(t);
    f.message.author.id = "viewer";
    await restartCommand.execute(f.message);
    f.message.author.id = "owner";
    for (const ownerId of [undefined, "", "   "]) {
        if (ownerId === undefined) delete process.env.BOT_OWNER_ID;
        else process.env.BOT_OWNER_ID = ownerId;
        await restartCommand.execute(f.message);
    }
    assert.equal(f.spawn.mock.callCount(), 0);
    assert.equal(f.replies.length, 4);
    assert.ok(f.replies.every(reply => /Only the bot owner/.test(reply)));
});

test("restart rejects missing or invalid PM2 process IDs", async t => {
    const f = fixture(t);
    for (const id of [undefined, "", "-1", "brotherhood", "0; pm2 restart all"]) {
        if (id === undefined) delete process.env.pm_id;
        else process.env.pm_id = id;
        await restartCommand.execute(f.message);
    }
    assert.equal(f.spawn.mock.callCount(), 0);
    assert.ok(f.replies.every(reply => /managed by PM2/.test(reply)));
});

test("registered restart works without a database and invokes the existing script for this bot", async t => {
    const f = fixture(t);
    const handleMentionCommand = createMentionHandler(createRouter(null));
    await handleMentionCommand(f.message, { user: { id: "123" } });
    assert.equal(f.spawn.mock.callCount(), 1);
    const [executable, args, options] = f.spawn.mock.calls[0].arguments;
    assert.equal(executable, "bash");
    assert.deepEqual(args, [path.resolve(__dirname, "../../../../shared/config/scripts/restart-script.sh")]);
    assert.equal(options.env.BOT_OWNER_ID, "owner");
    assert.equal(options.env.RESTART_REQUESTER_ID, "owner");
    assert.equal(options.env.pm_id, "0");
    assert.equal(options.env.PM2_HOME, "/tmp/test-pm2");
    assert.equal(options.detached, true);
    assert.equal(options.stdio, "ignore");
    assert.equal(f.child.unref.mock.callCount(), 1);
});

test("restart does not run if the acknowledgement fails", async t => {
    const f = fixture(t);
    f.message.reply = async () => { throw new Error("Discord unavailable"); };
    await assert.rejects(restartCommand.execute(f.message), /Discord unavailable/);
    assert.equal(f.spawn.mock.callCount(), 0);
});

test("restart reports process launch and script failures", async t => {
    const f = fixture(t);
    await restartCommand.execute(f.message);
    f.child.emit("error", new Error("spawn bash ENOENT"));
    await setImmediate();
    assert.match(f.replies.at(-1), /Could not restart/);

    f.replies.length = 0;
    await restartCommand.execute(f.message);
    f.child.emit("exit", 1, null);
    await setImmediate();
    assert.match(f.replies.at(-1), /Could not restart/);
});
