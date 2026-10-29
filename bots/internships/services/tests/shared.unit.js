const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { assert, mock, load, bot, job, called, root } = require("./helpers/unit");

test("restart script targets only the caller's PM2 ID and rejects invalid or missing targets", async (t) => {
    const { spawnSync } = require("node:child_process");
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bot-restart-unit-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const capture = path.join(directory, "pm2-call.json");
    const fakePm2 = path.join(directory, "pm2");
    // An isolated PM2 executable records calls; no real processes are restarted.
    await fs.writeFile(fakePm2, `#!${process.execPath}\n` +
        'require("node:fs").writeFileSync(process.env.RESTART_TEST_CAPTURE, JSON.stringify({ args: process.argv.slice(2), home: process.env.PM2_HOME }));\n' +
        'process.exit(Number(process.env.RESTART_TEST_EXIT || 0));\n', { mode: 0o755 });
    const script = path.join(root, "shared/config/scripts/restart-script.sh");
    const env = {
        ...process.env, PATH: directory, RESTART_TEST_CAPTURE: capture,
        PM2_HOME: path.join(directory, "isolated-pm2"), RESTART_TEST_EXIT: "0",
        BOT_OWNER_ID: "123456789", RESTART_REQUESTER_ID: "123456789",
    };
    delete env.pm_id;
    for (const id of ["0", "17"]) {
        const result = spawnSync("/bin/bash", [script], { env: { ...env, pm_id: id }, cwd: directory, encoding: "utf8" });
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(JSON.parse(await fs.readFile(capture, "utf8")), {
            args: ["restart", id], home: env.PM2_HOME,
        });
    }
    await fs.unlink(capture);
    for (const [ownerId, requesterId] of [
        ["123456789", "987654321"], ["123456789", undefined],
        ["123456789", ""], [undefined, "123456789"], ["", "123456789"], ["", ""],
    ]) {
        const restartEnv = { ...env, pm_id: "0" };
        if (ownerId === undefined) delete restartEnv.BOT_OWNER_ID;
        else restartEnv.BOT_OWNER_ID = ownerId;
        if (requesterId === undefined) delete restartEnv.RESTART_REQUESTER_ID;
        else restartEnv.RESTART_REQUESTER_ID = requesterId;
        const result = spawnSync("/bin/bash", [script], { env: restartEnv, encoding: "utf8" });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /Only the configured bot owner/);
        await assert.rejects(fs.access(capture), { code: "ENOENT" });
    }
    for (const id of [undefined, "", "all", "-1", "1; echo bad"]) {
        const restartEnv = { ...env };
        if (id !== undefined) restartEnv.pm_id = id;
        const result = spawnSync("/bin/bash", [script], { env: restartEnv, encoding: "utf8" });
        assert.equal(result.status, 1);
        assert.match(result.stderr, /numeric pm_id/);
    }
    const extraArgs = spawnSync("/bin/bash", [script, "all"], { env: { ...env, pm_id: "0" }, encoding: "utf8" });
    assert.equal(extraArgs.status, 1);
    await assert.rejects(fs.access(capture), { code: "ENOENT" });

    const missingPm2 = spawnSync("/bin/bash", [script], {
        env: { ...env, pm_id: "0", PATH: path.join(directory, "missing") }, encoding: "utf8",
    });
    assert.equal(missingPm2.status, 1);
    assert.match(missingPm2.stderr, /pm2 is not available/);
    const failedRestart = spawnSync("/bin/bash", [script], {
        env: { ...env, pm_id: "17", RESTART_TEST_EXIT: "7" }, encoding: "utf8",
    });
    assert.equal(failedRestart.status, 7);
});

test("environment helpers load a file, preserve exports, and distinguish missing/empty/optional values", async (t) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bot-env-unit-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, ".env");
    await fs.writeFile(file, "UNIT_BOT_FILE=from-file\nUNIT_BOT_EXPORT=from-file\n");
    const names = ["UNIT_BOT_FILE", "UNIT_BOT_EXPORT", "UNIT_BOT_EMPTY", "UNIT_BOT_MISSING"];
    const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
    t.after(() => names.forEach(name => {
        if (previous[name] === undefined) delete process.env[name];
        else process.env[name] = previous[name];
    }));
    names.forEach(name => delete process.env[name]);
    process.env.UNIT_BOT_EXPORT = "exported";
    process.env.UNIT_BOT_EMPTY = "";
    const env = load("shared/config/env.js");
    env.loadEnvFile(file);
    assert.equal(env.getEnv("UNIT_BOT_FILE"), "from-file");
    assert.equal(env.getEnv("UNIT_BOT_EXPORT"), "exported");
    assert.equal(env.getOptionalEnv("UNIT_BOT_FILE"), "from-file");
    for (const name of ["UNIT_BOT_EMPTY", "UNIT_BOT_MISSING"]) {
        assert.equal(env.getOptionalEnv(name), undefined);
        assert.throws(() => env.getEnv(name), /Missing required environment variable/);
    }
});

test("logger emits info, warnings, error stacks and arbitrary diagnostics", (t) => {
    const info = t.mock.method(console, "info", () => {});
    const warn = t.mock.method(console, "warn", () => {});
    const error = t.mock.method(console, "error", () => {});
    const logger = load("shared/utils/logger.js");
    // Load the logger directly without the default dependency replacement.
    logger.logInfo("ready"); called(info, "[INFO] ready");
    logger.logWarn("warning"); called(warn, "[WARN] warning");
    logger.logError("failed"); called(error, "[ERROR] failed");
    const failure = new Error("boom");
    logger.logError("failed", failure); called(error, failure.stack);
    failure.stack = "";
    logger.logError("failed", failure); called(error, "boom");
    logger.logError("failed", { code: 1 }); called(error, { code: 1 });
});

test("Discord client requests the intents required by mentions", () => {
    const { createClient } = load("shared/discord/createClient.js");
    const { GatewayIntentBits } = require("discord.js");
    const client = createClient();
    for (const intent of [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]) {
        assert.equal(client.options.intents.has(intent), true);
    }
    client.destroy();
});

test("GitHub client supports public and authenticated requests without making a request", () => {
    const Octokit = mock.fn(function(options) { this.options = options; });
    for (const token of [undefined, "test-github-token"]) {
        const { createGitHubClient } = load("shared/github/githubClient.js", {
            "@octokit/rest": { Octokit }, "shared/config/env.js": { getOptionalEnv: () => token },
        });
        assert.deepEqual(createGitHubClient().options, token ? { auth: token } : undefined);
    }
});

test("scheduler validates each parameter and passes the callback and timezone to cron", () => {
    const task = { stop() {} };
    const cron = { validate: mock.fn(() => true), schedule: mock.fn(() => task) };
    const { scheduleDailyJob } = load("shared/scheduler/cronScheduler.js", { "node-cron": cron });
    const job = () => {};
    const options = { hour: 8, minute: 5, timezone: " America/Chicago ", job };
    assert.equal(scheduleDailyJob(options), task);
    called(cron.schedule, "5 8 * * *", job, { timezone: "America/Chicago" });
    for (const [key, values] of [["hour", [-1, 24, 0.5]], ["minute", [-1, 60, 0.5]], ["timezone", [null, "", "Invalid/Zone"]], ["job", [null]]]) {
        for (const value of values) assert.throws(() => scheduleDailyJob({ ...options, [key]: value }));
    }
    cron.validate.mock.mockImplementation(() => false);
    assert.throws(() => scheduleDailyJob(options), /Invalid cron expression/);
});

test("sendMessage validates the client, channel, payload and channel capabilities", async () => {
    const { sendMessage } = load("shared/discord/sendMessage.js");
    const send = mock.fn(async payload => ({ payload }));
    const fetch = mock.fn(async () => ({ isTextBased: () => true, send }));
    const client = { channels: { fetch } };
    for (const payload of ["hello", { content: "hello" }]) {
        assert.deepEqual(await sendMessage(client, " channel ", payload), { payload });
        called(fetch, "channel"); called(send, payload);
    }
    for (const value of [null, {}, { channels: {} }]) await assert.rejects(sendMessage(value, "channel", "hi"), /valid Discord client/);
    for (const value of [null, " "]) await assert.rejects(sendMessage(client, value, "hi"), /channel ID/);
    for (const value of [null, " ", [], 5]) await assert.rejects(sendMessage(client, "channel", value), /payload/);
    for (const [channel, error] of [[null, /not found/], [{}, /not text-based/], [{ isTextBased: () => false }, /not text-based/], [{ isTextBased: () => true }, /cannot send/]]) {
        fetch.mock.mockImplementation(async () => channel);
        await assert.rejects(sendMessage(client, "channel", "hello"), error);
    }
    fetch.mock.mockImplementation(async () => { throw new Error("Discord offline"); });
    await assert.rejects(sendMessage(client, "channel", "hello"), /Discord offline/);
});

test("notification embeds include all listings, dates, locations and application links", async () => {
    const sendMessage = mock.fn(async () => "sent");
    const notification = load(bot + "sendInternshipNotification.js", { "shared/discord/sendMessage.js": { sendMessage } });
    const internships = [job(), job({ id: "other", location: "", datePosted: undefined })];
    const embed = notification.buildInternshipEmbed(internships).toJSON();
    assert.equal(embed.title, "Top Internship Openings");
    assert.equal(embed.fields.length, 2);
    assert.match(embed.fields[0].name, /1\. Acme/);
    assert.match(embed.fields[0].value, /Austin, TX/);
    assert.match(embed.fields[0].value, /https:\/\/example.com\/apply/);
    assert.match(embed.fields[1].value, /Location not provided/);
    assert.match(embed.fields[1].value, /Date not provided/);
    assert.throws(() => notification.buildInternshipEmbed(null), TypeError);
    assert.throws(() => notification.buildInternshipEmbed([]), /no internships/);
    await assert.rejects(notification.sendInternshipNotification(null, "channel", internships), /client/);
    await assert.rejects(notification.sendInternshipNotification({}, " ", internships), /channel ID/);
    assert.equal(await notification.sendInternshipNotification({}, "channel", internships), "sent");
    assert.equal(sendMessage.mock.calls[0].arguments[2].embeds.length, 1);
});

test("Discord error explanations cover known codes and unknown failures", () => {
    const { explainDiscordError } = load(bot + "discordErrors.js");
    for (const [error, pattern] of [
        [null, /Unknown/], [{ code: 50001 }, /Missing Access/], [{ code: 10003 }, /INTERNSHIP_CHANNEL_ID/],
        [{ code: 50013 }, /Missing Permissions/], [{ code: "TokenInvalid" }, /Invalid Discord token/],
        [{ message: "An invalid token was provided." }, /Invalid Discord token/],
        [new Error("other"), /other/], [{}, /No error message/],
    ]) assert.match(explainDiscordError(error), pattern);
});
