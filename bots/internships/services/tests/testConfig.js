const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const root = path.resolve(__dirname, "../../../..");
const example = require("../../example-config.json");

function runConfig(t, { settings = example, env = {}, channelId = "fixture-channel", runOnStartup = null, code } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "internship-config-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

    for (const file of [
        "bots/internships/config.js",
        "shared/config/env.js",
        "shared/utils/logger.js",
    ]) {
        const target = path.join(directory, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
    }

    fs.symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
    const botDirectory = path.join(directory, "bots/internships");
    if (settings !== null) {
        fs.writeFileSync(path.join(botDirectory, "config.json"), JSON.stringify(settings));
    }
    fs.writeFileSync(path.join(botDirectory, ".env"),
        "DISCORD_TOKEN=fixture-token\nBOT_OWNER_ID=fixture-owner\n" +
        (channelId === null ? "" : `INTERNSHIP_CHANNEL_ID=${channelId}\n`) +
        (runOnStartup === null ? "" : `RUN_ON_STARTUP=${runOnStartup}\n`));

    // Start outside the bot directory and exclude the real environment/credentials.
    return spawnSync(process.execPath, ["-e", code || `
        const config = require(${JSON.stringify(path.join(botDirectory, "config.js"))});
        console.log(JSON.stringify(config.loadConfig()));
    `], {
        cwd: directory,
        env: { ...env },
        encoding: "utf8",
        timeout: 10000,
    });
}

function readConfig(result) {
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout.trim().split("\n").at(-1));
}

test("JSON settings and .env credentials and channel load from any working directory", (t) => {
    const config = readConfig(runConfig(t, {
        env: {
            INTERNSHIP_REPO_OWNER: "stale-owner",
            INTERNSHIP_CRON_SCHEDULE: "invalid",
            INTERNSHIP_TIMEZONE: "invalid",
            BACKEND_HOST: "stale-host",
            BACKEND_PORT: "9999",
        },
    }));

    assert.equal(config.discordToken, "fixture-token");
    assert.equal(config.botOwnerId, "fixture-owner");
    assert.equal(config.internshipChannelId, "fixture-channel");
    assert.deepEqual(config.repository, {
        owner: example.github.repoOwner,
        repo: example.github.repoName,
        branch: example.github.repoBranch,
        path: example.github.repoPath,
    });
    assert.equal(config.cronSchedule, example.internships.schedule);
    assert.equal(config.timezone, example.internships.timezone);
    assert.equal(config.runOnStartup, true);
    assert.equal(config.sendStartupTestMessage, false);
    assert.deepEqual(config.backend, example.backend);
    assert.equal(config.discordGuildId, undefined);
    assert.equal(config.githubToken, undefined);
});

test("exported credentials and channel override .env and optional tokens remain supported", (t) => {
    const config = readConfig(runConfig(t, {
        env: {
            DISCORD_TOKEN: "exported-token", GITHUB_TOKEN: "github-fixture",
            INTERNSHIP_CHANNEL_ID: "exported-channel",
        },
    }));
    assert.equal(config.discordToken, "exported-token");
    assert.equal(config.githubToken, "github-fixture");
    assert.equal(config.internshipChannelId, "exported-channel");
});

for (const channelId of [null, ""]) {
    test(`rejects missing or empty INTERNSHIP_CHANNEL_ID: ${JSON.stringify(channelId)}`, (t) => {
        const settings = structuredClone(example);
        settings.discord.internshipChannelId = "legacy-channel";
        const result = runConfig(t, { settings, channelId });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /Missing required environment variable: INTERNSHIP_CHANNEL_ID/);
    });
}

test("optional scheduling values retain defaults", (t) => {
    const settings = structuredClone(example);
    delete settings.internships;
    delete settings.discord.sendStartupTestMessage;
    const config = readConfig(runConfig(t, { settings }));
    assert.equal(config.cronSchedule, "0 8 * * *");
    assert.equal(config.timezone, "America/Chicago");
    assert.equal(config.runOnStartup, true);
    assert.equal(config.sendStartupTestMessage, false);
});

test("RUN_ON_STARTUP in .env disables the startup digest", (t) => {
    const settings = structuredClone(example);
    settings.internships.runOnStartup = true;
    assert.equal(readConfig(runConfig(t, { settings, runOnStartup: "false" })).runOnStartup, false);
});

test("exported RUN_ON_STARTUP overrides .env", (t) => {
    assert.equal(readConfig(runConfig(t, {
        runOnStartup: "false", env: { RUN_ON_STARTUP: "true" },
    })).runOnStartup, true);
});

for (const [key, value] of [
    ["internships.schedule", "invalid"],
    ["internships.timezone", "invalid"],
    ["github.repoOwner", ""],
    ["github.repoName", null],
    ["github.repoBranch", ""],
    ["github.repoPath", ""],
    ["backend.host", ""],
    ["backend.port", "8000"],
    ["backend.port", 0],
    ["backend.port", 65536],
    ["backend.port", 1.5],
]) {
    test(`rejects invalid ${key}: ${JSON.stringify(value)}`, (t) => {
        const settings = structuredClone(example);
        const [section, name] = key.split(".");
        settings[section][name] = value;
        const result = runConfig(t, { settings });
        assert.notEqual(result.status, 0);
        assert.ok(result.stderr.includes(key), result.stderr);
    });
}

test("missing JSON provides setup instructions", (t) => {
    const result = runConfig(t, { settings: null });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Copy example-config.json to config.json/);
});

test("repository-only loading works without a Discord token", (t) => {
    const configPath = JSON.stringify(path.join(root, "bots/internships/config.js"));
    // Point the real repository consumer at the isolated config and a fake GitHub client.
    const result = runConfig(t, { code: `
        const assert = require("node:assert/strict");
        const path = require("node:path");
        const config = require("./bots/internships/config");
        delete process.env.DISCORD_TOKEN;
        const repository = config.loadRepositoryConfig();
        require.cache[${configPath}] = { exports: config };
        require.cache[${JSON.stringify(path.join(root, "shared/github/githubClient.js"))}] = {
            exports: { createGitHubClient: () => ({ repos: {
                getContent: async (request) => {
                    assert.deepEqual(request, {
                        owner: repository.owner, repo: repository.repo,
                        path: repository.path, ref: repository.branch,
                    });
                    return { data: { type: "file", content: "W10=", encoding: "base64" } };
                },
            } }) },
        };
        require(${JSON.stringify(path.join(root, "bots/internships/repos/readInternshipRepo.js"))})
            .readInternshipRepo().then(file => assert.equal(file.content, "[]"))
            .catch(error => { console.error(error); process.exitCode = 1; });
    ` });
    assert.equal(result.status, 0, result.stderr);
});

test("entry point uses JSON for backend and scheduling and .env for the digest channel", (t) => {
    const result = runConfig(t, { code: `
        const assert = require("node:assert/strict");
        const root = ${JSON.stringify(root)};
        const configModule = require("./bots/internships/config");
        const config = configModule.loadConfig();
        const stub = (file, exports) => {
            require.cache[require.resolve(root + "/" + file)] = { exports };
        };
        stub("bots/internships/config.js", configModule);
        let ready;
        let digestRan = false;
        let backendConnected = false;
        const client = {
            once: (event, callback) => { ready = callback; },
            on: () => {},
            login: token => assert.equal(token, "fixture-token"),
        };
        stub("shared/discord/createClient.js", { createClient: () => client });
        stub("bots/internships/api/backendClient.js", class {
            constructor(host, port) {
                assert.equal(host, config.backend.host);
                assert.equal(port, config.backend.port);
            }
            connect() { backendConnected = true; }
        });
        stub("bots/internships/services/botState.js", { isMuted: async () => false });
        stub("bots/internships/services/commands/handleMentionCommand.js", {
            handleMentionCommand: async () => {},
        });
        stub("bots/internships/services/runInternshipDigest.js", {
            runInternshipDigest: async (options) => {
                assert.equal(options.client, client);
                assert.equal(options.channelId, config.internshipChannelId);
                digestRan = true;
                return [];
            },
        });
        const cron = require("node-cron");
        cron.schedule = (schedule, callback, options) => {
            assert.equal(schedule, config.cronSchedule);
            assert.equal(options.timezone, config.timezone);
        };
        require(root + "/bots/internships/index.js");
        assert.equal(backendConnected, true);
        ready({ user: { tag: "fixture-bot" } }).then(() => {
            assert.equal(digestRan, true);
        }).catch(error => { console.error(error); process.exitCode = 1; });
    ` });
    assert.equal(result.status, 0, result.stderr);
});
