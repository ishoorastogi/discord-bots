const { test } = require("node:test");
const { assert, mock, load, bot } = require("./helpers/unit");
const example = require("../../example-config.json");

function configuration(settings = example) {
    return load(bot + "config.js", {
        [bot + "config.json"]: settings,
        "shared/config/env.js": {
            loadEnvFile: mock.fn(), getEnv: () => "fixture-token", getOptionalEnv: () => undefined,
        },
    });
}

test("configuration maps the JSON schema to the public API and applies optional defaults", () => {
    const configModule = configuration();
    const config = configModule.loadConfig();
    assert.equal(config.cronSchedule, example.internships.schedule);
    assert.deepEqual(config.repository, {
        owner: example.github.repoOwner, repo: example.github.repoName,
        branch: example.github.repoBranch, path: example.github.repoPath,
    });
    assert.deepEqual(configModule.loadRepositoryConfig(), config.repository);
    assert.deepEqual(config.backend, example.backend);
    const minimal = structuredClone(example);
    delete minimal.internships;
    delete minimal.discord.sendStartupTestMessage;
    const defaults = configuration(minimal).loadConfig();
    assert.equal(defaults.cronSchedule, "0 8 * * *");
    assert.equal(defaults.timezone, "America/Chicago");
    assert.equal(defaults.runOnStartup, true);
    assert.equal(defaults.sendStartupTestMessage, false);
});

test("parseBoolean supports JSON booleans, case-insensitive strings and caller defaults", () => {
    const { parseBoolean } = configuration();
    for (const value of [true, "true", " TRUE "]) assert.equal(parseBoolean(value), true);
    for (const value of [false, "false", " FALSE "]) assert.equal(parseBoolean(value, true), false);
    for (const value of [undefined, null, 1, "invalid"]) {
        assert.equal(parseBoolean(value), false);
        assert.equal(parseBoolean(value, true), true);
    }
});

test("configuration reports missing files and malformed JSON with actionable context", () => {
    for (const [error, pattern] of [
        [Object.assign(new Error("not found"), { code: "MODULE_NOT_FOUND" }), /Copy example-config.json/],
        [new SyntaxError("Unexpected token in JSON"), /Unable to load bots\/internships\/config.json: Unexpected token/],
    ]) {
        assert.throws(() => load(bot + "config.js", { [bot + "config.json"]: error }), pattern);
    }
});

for (const [key, value] of [
    ["internships.schedule", "invalid"], ["internships.timezone", "Invalid/Zone"],
    ["github.repoOwner", ""], ["github.repoPath", null],
    ["backend.host", ""],
    ["backend.port", 0], ["backend.port", 65536], ["backend.port", "8000"],
]) {
    test(`configuration rejects invalid ${key}`, () => {
        const settings = structuredClone(example);
        const [section, name] = key.split(".");
        settings[section][name] = value;
        assert.throws(() => configuration(settings).loadConfig(), error => error.message.includes(key));
    });
}
