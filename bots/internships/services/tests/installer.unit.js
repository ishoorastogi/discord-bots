const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "../../../..");

function fixture(t, { lockfile = true } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "bot-installer-"));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const files = ["installer.sh", "package.json", "bots/internships/.env.example",
        "bots/internships/example-config.json", "bots/brotherhood/.env.example", "shared/dbs/.env.example"];
    if (lockfile) files.push("package-lock.json");
    for (const file of files) {
        const target = path.join(directory, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
    }
    fs.symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
    const bin = path.join(directory, "bin");
    fs.mkdirSync(bin);
    fs.symlinkSync(process.execPath, path.join(bin, "node"));
    // Never install packages, launch PM2, or contact the network in installer tests.
    fs.writeFileSync(path.join(bin, "npm"), '#!/bin/sh\n' + `
printf '%s\\n' "$*" >> "$INSTALLER_TEST_NPM_CALLS"
if [ "$1" = '--version' ]; then
  printf 'test-npm\\n'
else
  exit "$INSTALLER_TEST_NPM_FAIL"
fi
`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, "pm2"), "#!/bin/sh\nprintf 'test-pm2\\n'\n", { mode: 0o755 });
    const write = (file, value) => fs.writeFileSync(path.join(directory, file), value);
    const read = file => fs.readFileSync(path.join(directory, file), "utf8");
    const run = (extraEnv = {}) => spawnSync("/bin/bash", [path.join(directory, "installer.sh")], {
        // Run outside the repository to verify path resolution.
        cwd: os.tmpdir(), encoding: "utf8", timeout: 10000,
        env: {
            PATH: `${bin}:/usr/bin:/bin`,
            INSTALLER_TEST_NPM_CALLS: path.join(directory, "npm-calls"), INSTALLER_TEST_NPM_FAIL: "0", ...extraEnv,
        },
    });
    return { directory, write, read, run };
}

test("installer sets up both bots, verifies pg, and preserves files on a second run", (t) => {
    const f = fixture(t);
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /PostgreSQL Node client \(pg\) is ready/);
    assert.match(result.stdout, /npm run start:internships/);
    assert.match(result.stdout, /npm run start:brotherhood/);
    assert.match(f.read("npm-calls"), /--version\nci\nls --omit=dev --depth=0\n/);
    const files = ["bots/internships/.env", "bots/brotherhood/.env", "shared/dbs/.env", "bots/internships/config.json"];
    const before = files.map(file => f.read(file));
    for (const bot of ["internships", "brotherhood"]) {
        const envPath = `bots/${bot}/.env`;
        assert.deepEqual(dotenv.parse(f.read(envPath)), dotenv.parse(f.read(`bots/${bot}/.env.example`)));
        assert.equal(fs.statSync(path.join(f.directory, envPath)).mode & 0o777, 0o600);
    }
    assert.deepEqual(dotenv.parse(f.read("shared/dbs/.env")), dotenv.parse(f.read("shared/dbs/.env.example")));
    assert.equal(fs.statSync(path.join(f.directory, "shared/dbs/.env")).mode & 0o777, 0o600);
    assert.equal(fs.existsSync(path.join(f.directory, "bots/brotherhood/config.json")), false);
    const rerun = f.run();
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.deepEqual(files.map(file => f.read(file)), before);
});

test("installer preserves credentials and member data, adds missing keys, and migrates legacy settings", (t) => {
    const f = fixture(t);
    f.write("bots/internships/.env", "# keep this comment\nDISCORD_TOKEN=private-fixture-token\nRUN_ON_STARTUP=false\nCUSTOM_SETTING=keep\n");
    const brotherhoodEnv = "export DISCORD_TOKEN=brotherhood-fixture-token\nBOT_OWNER_ID=\nTEST_CHANNEL_ID=custom-channel\n";
    f.write("bots/brotherhood/.env", brotherhoodEnv);
    fs.mkdirSync(path.join(f.directory, "bots/brotherhood/test-db"));
    const members = '{"members":[{"name":"Keep Me"}]}\n';
    f.write("bots/brotherhood/test-db/test-db.json", members);
    const config = JSON.parse(f.read("bots/internships/example-config.json"));
    config.discord.internshipChannelId = "legacy-channel";
    config.internships.runOnStartup = true;
    config.backend.port = 9000;
    config.custom = { preserved: true };
    f.write("bots/internships/config.json", JSON.stringify(config));
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const env = dotenv.parse(f.read("bots/internships/.env"));
    assert.equal(env.DISCORD_TOKEN, "private-fixture-token");
    assert.equal(env.RUN_ON_STARTUP, "false");
    assert.equal(env.INTERNSHIP_CHANNEL_ID, "legacy-channel");
    assert.equal(env.CUSTOM_SETTING, "keep");
    assert.match(f.read("bots/internships/.env"), /^# keep this comment/);
    assert.ok(f.read("bots/brotherhood/.env").startsWith(brotherhoodEnv));
    const brotherhoodSettings = dotenv.parse(f.read("bots/brotherhood/.env"));
    assert.equal(brotherhoodSettings.DISCORD_TOKEN, "brotherhood-fixture-token");
    assert.equal(brotherhoodSettings.BOT_OWNER_ID, "");
    assert.equal(brotherhoodSettings.TEST_CHANNEL_ID, "custom-channel");
    for (const [name, value] of Object.entries(dotenv.parse(f.read("bots/brotherhood/.env.example")))) {
        if (!Object.hasOwn(dotenv.parse(brotherhoodEnv), name)) assert.equal(brotherhoodSettings[name], value);
    }
    assert.equal(f.read("bots/brotherhood/test-db/test-db.json"), members);
    delete config.discord.internshipChannelId;
    delete config.internships.runOnStartup;
    assert.deepEqual(JSON.parse(f.read("bots/internships/config.json")), config);
    assert.doesNotMatch(result.stdout, /private-fixture-token|brotherhood-fixture-token/);
});

test("installer migrates legacy values into a newly created environment", (t) => {
    const f = fixture(t);
    const config = JSON.parse(f.read("bots/internships/example-config.json"));
    config.discord.internshipChannelId = "legacy-channel";
    config.internships.runOnStartup = false;
    f.write("bots/internships/config.json", JSON.stringify(config));
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const env = dotenv.parse(f.read("bots/internships/.env"));
    assert.equal(env.INTERNSHIP_CHANNEL_ID, "legacy-channel");
    assert.equal(env.RUN_ON_STARTUP, "false");
});

test("installer uses npm install when no lockfile exists", (t) => {
    const f = fixture(t, { lockfile: false });
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.match(f.read("npm-calls"), /--version\ninstall\nls --omit=dev --depth=0\n/);
});

test("installer aborts without writing settings when configuration is malformed", (t) => {
    const f = fixture(t);
    f.write("bots/internships/config.json", "{invalid-json");
    const result = f.run();
    assert.notEqual(result.status, 0);
    assert.equal(f.read("bots/internships/config.json"), "{invalid-json");
    assert.equal(fs.existsSync(path.join(f.directory, "bots/internships/.env")), false);
    assert.equal(fs.existsSync(path.join(f.directory, "bots/brotherhood/.env")), false);
});

test("installer stops after a dependency installation failure", (t) => {
    const f = fixture(t);
    const result = f.run({ INSTALLER_TEST_NPM_FAIL: "7" });
    assert.equal(result.status, 7);
    assert.doesNotMatch(result.stdout, /Installation complete/);
    assert.equal(fs.existsSync(path.join(f.directory, "bots/internships/.env")), false);
});
