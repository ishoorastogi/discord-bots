const assert = require("node:assert/strict");
const { test } = require("node:test");
const pg = require("pg");
const config = require("../../../../shared/dbs/config");
const { handleMentionCommand } = require("../commands/handleMentionCommand");
const { routeResponse } = require("../router");

const row = {
    user_id: "9007199254740993", discord_id: null, name: "Ishan Rastogi", email: null,
    phone: null, class: "Alpha Class", major: "Math", grad_year: 2026, positions_held: null,
    family_line: null, nicknames: "Ish; IR", brotherhood_status: null, linkedin_link: null,
    big: null, littles: null, employer: null,
};
let channel = 0;

function fixture(t, steps) {
    const clients = [];
    const original = Object.fromEntries(["DB_USER", "DB_PASSWORD", "BOT_OWNER_ID"].map(key => [key, process.env[key]]));
    Object.assign(process.env, { DB_USER: "brotherhood-test", DB_PASSWORD: "fixture-password", BOT_OWNER_ID: "owner" });
    t.after(() => {
        for (const [key, value] of Object.entries(original)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        assert.equal(steps.length, 0, "All expected SQL ran");
        assert.ok(clients.every(client => client.closed), "Every connection closed");
    });
    t.mock.method(config, "getDatabaseConnectionConfig", () => ({ host: "fixture", port: 5432, database: "fixture" }));
    t.mock.method(pg, "Client", function (options) {
        assert.equal(options.user, "brotherhood-test");
        assert.equal(options.password, "fixture-password");
        const client = {
            closed: false,
            async connect() {},
            async query(sql, values) {
                const step = steps.shift();
                assert.ok(step, `Unexpected SQL: ${sql}`);
                assert.match(sql, step.sql);
                if (step.values) assert.deepEqual(values, step.values);
                step.check?.(sql, values);
                if (step.error) throw step.error;
                return { rows: step.rows || [] };
            },
            async end() { this.closed = true; },
        };
        clients.push(client);
        return client;
    });
    const replies = [];
    const message = {
        author: { id: "owner", bot: false }, guildId: "guild", channelId: `pg-${++channel}`,
        mentions: { users: new Map([["123", {}]]) }, content: "",
        async reply(response) {
            replies.push(typeof response === "string" ? response : response.content);
            return { id: "confirmation" };
        },
    };
    return {
        replies, message, clients,
        async send(content) {
            message.content = `<@123> ${content}`;
            await handleMentionCommand(message, { user: { id: "123" } });
        },
    };
}

const begin = () => [{ sql: /^BEGIN$/ }, { sql: /^LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE$/ }];

test("default router looks up PostgreSQL names and nicknames and maps all profile fields", async t => {
    const f = fixture(t, [{ sql: /^WITH candidates/, values: ["ish"], rows: [row], check(sql) {
        assert.match(sql, /regexp_split_to_table/);
        assert.match(sql, /OR NOT EXISTS/);
        assert.match(sql, /strpos\(/);
    } }]);
    f.message.author.id = "viewer";
    await f.send("/brother Ish");
    assert.match(f.replies[0], /Ishan Rastogi/);
    assert.match(f.replies[0], /\*\*Grad year:\*\* 2026/);
    assert.match(f.replies[0], /\*\*Phone number:\*\* Not provided/);
});

test("default router lists ambiguous PostgreSQL lookup candidates", async t => {
    const f = fixture(t, [{ sql: /^WITH candidates/, rows: [row, { ...row, user_id: "2", name: "Ishan Patel" }] }]);
    await f.send("/brother Ishan");
    assert.match(f.replies[0], /Which person did you mean/);
    assert.match(f.replies[0], /Ishan Rastogi/);
    assert.match(f.replies[0], /Ishan Patel/);
});

test("default router updates a unique PostgreSQL prefix with multiple fields and no Discord ID", async t => {
    const f = fixture(t, [
        ...begin(), { sql: /^WITH candidates/, values: ["ishan"], rows: [row], check: sql => assert.match(sql, /strpos\(.* = 1/) },
        { sql: /^UPDATE .* WHERE user_id = \$4 RETURNING \*$/, values: ["Alpha Class", "Computer Science", 2026, row.user_id], rows: [{ ...row, major: "Computer Science" }] },
        { sql: /^COMMIT$/ },
    ]);
    await f.send('/update Ishan class Alpha Class; major Computer Science; grad year 2026');
    assert.deepEqual(f.replies, ["Updated class, major, grad year for Ishan Rastogi."]);
    assert.equal(f.clients.length, 1);
});

for (const alias of ["employer", "works at", "company"]) {
    test(`default router saves ${alias} to the PostgreSQL employer column`, async t => {
        const f = fixture(t, [
            ...begin(), { sql: /^WITH candidates/, values: ["ishan rastogi"], rows: [row] },
            { sql: /^UPDATE public.users SET "employer" = \$1 WHERE user_id = \$2 RETURNING \*$/,
                values: ["Acme Corporation", row.user_id], rows: [{ ...row, employer: "Acme Corporation" }] },
            { sql: /^COMMIT$/ },
        ]);
        await f.send(`/update "Ishan Rastogi" ${alias} Acme Corporation`);
        assert.deepEqual(f.replies, ["Updated employer for Ishan Rastogi."]);
    });
}

test("default router clears employer through the company alias", async t => {
    const f = fixture(t, [
        ...begin(), { sql: /^WITH candidates/, rows: [{ ...row, employer: "Old Company" }] },
        { sql: /^UPDATE public.users SET "employer" = \$1 WHERE user_id = \$2 RETURNING \*$/,
            values: ["", row.user_id], rows: [{ ...row, employer: "" }] },
        { sql: /^COMMIT$/ },
    ]);
    await f.send('/update Ishan company ""');
    assert.deepEqual(f.replies, ["Updated employer for Ishan Rastogi."]);
});

test("default router creates a missing member through a single-field PostgreSQL update", async t => {
    const f = fixture(t, [
        ...begin(), { sql: /^WITH candidates/, values: ["new person"] },
        { sql: /^INSERT INTO public.users/, values: ["New Person", 2028], rows: [{ ...row, name: "New Person", grad_year: 2028 }] },
        { sql: /^COMMIT$/ },
    ]);
    await f.send('/update "New Person" grad year 2028');
    assert.deepEqual(f.replies, ["Added New Person and set grad year."]);
});

test("default router preserves valid pairs when a rename conflicts and another field fails validation", async t => {
    const f = fixture(t, [
        ...begin(), { sql: /^WITH candidates/, rows: [row] },
        { sql: /^WITH candidates/, values: ["taken name"], rows: [{ ...row, user_id: "2", name: "Taken Name" }] },
        { sql: /^UPDATE public.users SET "major" = \$1 WHERE user_id = \$2/, values: ["Physics", row.user_id], rows: [{ ...row, major: "Physics" }] },
        { sql: /^COMMIT$/ },
    ]);
    await f.send('/update Ishan major Physics; name "Taken Name"; email invalid');
    const report = f.replies.join("\n");
    assert.match(report, /Updated major for Ishan Rastogi/);
    assert.match(report, /Another member already has that name/);
    assert.match(report, /Email must be a valid email address/);
});

test("default router renames a PostgreSQL member while preserving their user ID", async t => {
    const f = fixture(t, [
        ...begin(), { sql: /^WITH candidates/, rows: [row] }, { sql: /^WITH candidates/, values: ["new name"] },
        { sql: /^UPDATE .*SET "name" = \$1 WHERE user_id = \$2/, values: ["New Name", row.user_id], rows: [{ ...row, name: "New Name" }] },
        { sql: /^COMMIT$/ },
    ]);
    await f.send('/update Ishan name "New Name"');
    assert.deepEqual(f.replies, ["Updated name for New Name."]);
});

test("default router rolls back ambiguous prefixes and asks for clarification", async t => {
    const f = fixture(t, [
        ...begin(), { sql: /^WITH candidates/, rows: [row, { ...row, user_id: "2", name: "Ishan Patel" }] },
        { sql: /^ROLLBACK$/ },
    ]);
    await f.send("/update Ishan major Physics");
    assert.match(f.replies[0], /Which member did you mean/);
    assert.match(f.replies[0], /Ishan Patel/);
});

test("default router enforces owner access before any PostgreSQL write", async t => {
    const f = fixture(t, []);
    f.message.author.id = "viewer";
    await f.send("/update Ishan major Physics");
    await f.send("/delete Ishan Rastogi");
    assert.ok(f.replies.every(reply => /Only the bot owner/.test(reply)));
    assert.equal(f.clients.length, 0);
});

test("default router converts imported fields and atomically inserts every worksheet", async t => {
    const f = fixture(t, [
        { sql: /^BEGIN$/ }, { sql: /^INSERT/, rows: [row], check(sql, values) {
            assert.match(sql, /"grad_year"/);
            assert.match(sql, /"phone"/);
            assert.ok(values.includes(2026));
            assert.ok(values.includes("Ish; IR"));
        } },
        { sql: /^INSERT/, rows: [{ ...row, user_id: "2", name: "Jane" }] }, { sql: /^COMMIT$/ },
    ]);
    await routeResponse(f.message, { type: "fileIntake", files: [{ ok: true, fileName: "members.xlsx", sheets: [
        { rows: [{ data: { name: "Ishan Rastogi", "phone number": "3125551234", "grad year": "2026", nicknames: ["Ish", "IR"] } }] },
        { rows: [{ data: { name: "Jane" } }] },
    ] }] });
    assert.deepEqual(f.replies, ["Imported members.xlsx successfully (2 records saved)."]);
    assert.equal(f.clients.length, 1);
});

test("default router reports an import failure after rolling back the whole file", async t => {
    const f = fixture(t, [
        { sql: /^BEGIN$/ }, { sql: /^INSERT/, rows: [row] },
        { sql: /^INSERT/, error: new Error("Database insert failed") }, { sql: /^ROLLBACK$/ },
    ]);
    t.mock.method(console, "error", () => {});
    await routeResponse(f.message, { type: "fileIntake", files: [{ ok: true, fileName: "members.csv",
        sheets: [{ rows: [{ data: { name: "Ishan Rastogi" } }, { data: { name: "Jane" } }] }],
    }] });
    assert.deepEqual(f.replies, ["Could not save members.csv to the database. No records from this file were added."]);
});

test("default router confirms a PostgreSQL snapshot and consumes duplicate confirmations once", async t => {
    const f = fixture(t, [
        { sql: /^WITH candidates/, rows: [row] }, ...begin(), { sql: /^WITH candidates/, rows: [row] },
        { sql: /^DELETE FROM public.users WHERE user_id = \$1$/, values: [row.user_id] }, { sql: /^COMMIT$/ },
    ]);
    await f.send("/delete Ishan Rastogi");
    assert.match(f.replies[0], /Delete Ishan Rastogi.*Confirm/);
    await Promise.all([f.send("yes"), f.send("yes")]);
    assert.ok(f.replies.includes("Deleted Ishan Rastogi from the database."));
});

test("default router refuses deletion if the PostgreSQL record changed after confirmation", async t => {
    const f = fixture(t, [
        { sql: /^WITH candidates/, rows: [row] }, ...begin(),
        { sql: /^WITH candidates/, rows: [{ ...row, major: "Changed" }] }, { sql: /^ROLLBACK$/ },
    ]);
    t.mock.method(console, "error", () => {});
    await f.send("/delete Ishan Rastogi");
    await f.send("yes");
    assert.match(f.replies[1], /record changed after confirmation/);
});
