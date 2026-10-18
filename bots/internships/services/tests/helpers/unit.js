const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const { mock } = require("node:test");

const root = path.resolve(__dirname, "../../../../..");
const bot = "bots/internships/";
const fixtureConfig = {
    discordToken: "test-token", internshipChannelId: "channel", botOwnerId: "owner",
    cronSchedule: "0 8 * * *", timezone: "America/Chicago", runOnStartup: true,
    repository: { owner: "owner", repo: "repo", branch: "main", path: "listings.json" },
    backend: { host: "localhost", port: 8000 },
};
const logger = { logInfo: mock.fn(), logWarn: mock.fn(), logError: mock.fn() };

// Reload application modules per test. Substitute only at the dependency boundary,
// then restore Node's loader before running any application functions.
function load(file, replacements = {}) {
    for (const key of Object.keys(require.cache)) {
        if (key.startsWith(root + path.sep) && !key.includes("node_modules") && !key.includes("/tests/")) {
            delete require.cache[key];
        }
    }
    const defaults = {
        "shared/utils/logger.js": logger,
        [bot + "config.js"]: {
            loadConfig: () => structuredClone(fixtureConfig),
            loadRepositoryConfig: () => structuredClone(fixtureConfig.repository),
        },
    };
    delete defaults[file];
    const mocks = new Map(Object.entries({ ...defaults, ...replacements }).map(([key, value]) => [
        key.startsWith("bots/") || key.startsWith("shared/")
            ? path.join(root, key) : key.replace(/^node:/, ""), value,
    ]));
    const original = Module._load;
    Module._load = function(request, parent, isMain) {
        const builtin = request.replace(/^node:/, "");
        if (mocks.has(builtin)) return mocks.get(builtin);
        let resolved;
        try { resolved = Module._resolveFilename(request, parent); }
        catch (error) {
            resolved = path.resolve(path.dirname(parent.filename), request);
            if (!mocks.has(resolved)) throw error;
        }
        if (mocks.has(resolved)) {
            const replacement = mocks.get(resolved);
            if (replacement instanceof Error) throw replacement;
            return replacement;
        }
        return original.call(this, request, parent, isMain);
    };
    try { return require(path.join(root, file)); }
    finally { Module._load = original; }
}

function job(overrides = {}) {
    return {
        id: "job-1", company: "Acme", role: "Software Engineering Intern",
        location: "Austin, TX", locations: ["Austin, TX"],
        applicationUrl: "https://example.com/apply", datePosted: 1787356800,
        ...overrides,
    };
}

function listing(overrides = {}) {
    return {
        id: "job-1", company_name: "Acme", title: "Software Engineering Intern",
        locations: ["Austin, TX"], url: "https://example.com/apply",
        date_posted: 1787356800, active: true, is_visible: true, ...overrides,
    };
}

function message(overrides = {}) {
    return {
        author: { id: "owner", tag: "tester", bot: false, send: mock.fn(async () => {}) },
        reply: mock.fn(async () => {}), mentions: { has: () => true },
        content: "<@123> /help", attachments: { first: () => undefined }, ...overrides,
    };
}

function called(fn, ...args) {
    assert.deepEqual(fn.mock.calls.at(-1)?.arguments, args);
}

module.exports = { assert, mock, root, bot, fixtureConfig, logger, load, job, listing, message, called };
