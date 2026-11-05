const assert = require("node:assert/strict");
const { test } = require("node:test");
const pg = require("pg");
const config = require("../config");
const { selectUsersByName, selectUserById, selectUserByDiscordId } = require("../crud/select");
const { insertUser, upsertUser } = require("../crud/insert");

function fixture(t, { rows = [], connectError, queryError, steps } = {}) {
    const clients = [];
    t.mock.method(config, "getDatabaseConnectionConfig", () => ({ host: "database", port: 5432, database: "test" }));
    t.mock.method(pg, "Client", function (options) {
        const client = {
            options, queries: [], closed: false,
            async connect() { if (connectError) throw connectError; },
            async query(sql, values) {
                this.queries.push({ sql, values });
                if (queryError) throw queryError;
                if (steps) {
                    const step = steps.shift();
                    assert.ok(step, `Unexpected SQL: ${sql}`);
                    assert.match(sql, step.sql);
                    if (step.values) assert.deepEqual(values, step.values);
                    if (step.error) throw step.error;
                    return { rows: step.rows || [] };
                }
                return { rows };
            },
            async end() { this.closed = true; },
        };
        clients.push(client);
        return client;
    });
    t.after(() => assert.ok(clients.every(client => client.closed), "Connections must close on success and failure"));
    if (steps) t.after(() => assert.equal(steps.length, 0, "All expected queries ran"));
    return clients;
}

test("selectors use each caller's credentials and keep values separate from SQL", async t => {
    const row = { user_id: "9007199254740993", name: "Test User" };
    const clients = fixture(t, { rows: [row] });
    const name = "Test User'; DELETE FROM users; --";
    assert.deepEqual(await selectUsersByName(name, "bot_one", "password-one"), [row]);
    assert.deepEqual(await selectUserById(row.user_id, "bot_two", "password-two"), row);
    assert.equal(clients[0].options.user, "bot_one");
    assert.equal(clients[0].options.password, "password-one");
    assert.equal(clients[1].options.user, "bot_two");
    assert.equal(clients[1].options.password, "password-two");
    assert.deepEqual(clients[0].queries[0].values, [name.toLowerCase()]);
    assert.ok(!clients[0].queries[0].sql.includes(name));
    assert.deepEqual(clients[1].queries[0].values, [row.user_id]);
});

test("selectors handle missing users with their documented return values", async t => {
    fixture(t);
    assert.deepEqual(await selectUsersByName("missing", "bot", "password"), []);
    assert.equal(await selectUserById("42", "bot", "password"), null);
    assert.equal(await selectUserByDiscordId("123", "bot", "password"), null);
});

test("operations reject missing credentials before creating a connection", async t => {
    const clients = fixture(t);
    await assert.rejects(selectUserById("42"), /username and password/);
    await assert.rejects(selectUsersByName("test user", "bot", ""), /username and password/);
    assert.equal(clients.length, 0);
});

test("insert returns the generated user ID without needing a Discord ID", async t => {
    const row = { user_id: "42", name: "Test User", littles: ["Jane"] };
    const clients = fixture(t, { rows: [row] });
    assert.deepEqual(await insertUser({ name: "Test User", littles: ["Jane"] }, "bot", "password"), row);
    assert.deepEqual(clients[0].queries[0].values, ["Test User", ["Jane"]]);
    assert.match(clients[0].queries[0].sql, /^INSERT INTO public.users \("name", "littles"\) VALUES \(\$1, \$2\) RETURNING \*$/);
});

test("upsert matches a name without Discord ID and updates only supplied fields", async t => {
    const row = { user_id: "42", name: "Test User", discord_id: null, major: "Physics", email: "kept@example.com" };
    const clients = fixture(t, { steps: [
        { sql: /^BEGIN$/ }, { sql: /^LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE$/ },
        { sql: /^WITH candidates/, values: ["test user"], rows: [row] },
        { sql: /^UPDATE public.users SET "major" = \$1 WHERE user_id = \$2 RETURNING \*$/, values: ["Physics", "42"], rows: [row] },
        { sql: /^COMMIT$/ },
    ] });
    assert.deepEqual(await upsertUser({ name: " test user ", major: "Physics", email: undefined }, "bot", "password"), row);
    assert.equal(clients.length, 1, "The entire upsert uses one connection");
});

test("name-only upsert returns an existing user without changing other fields", async t => {
    const row = { user_id: "42", name: "Test User", phone: "123", discord_id: null };
    fixture(t, { steps: [
        { sql: /^BEGIN$/ }, { sql: /^LOCK TABLE/ },
        { sql: /^WITH candidates/, values: ["test user"], rows: [row] }, { sql: /^COMMIT$/ },
    ] });
    assert.deepEqual(await upsertUser({ name: "Test User" }, "bot", "password"), row);
});

test("upsert inserts a missing name without requiring Discord ID", async t => {
    const row = { user_id: "43", name: "New User", discord_id: null, phone: "123" };
    fixture(t, { steps: [
        { sql: /^BEGIN$/ }, { sql: /^LOCK TABLE/ }, { sql: /^WITH candidates/, rows: [] },
        { sql: /^INSERT INTO public.users \("name", "phone"\) VALUES \(\$1, \$2\) RETURNING \*$/, values: ["New User", "123"], rows: [row] },
        { sql: /^COMMIT$/ },
    ] });
    assert.deepEqual(await upsertUser({ name: "New User", phone: "123" }, "bot", "password"), row);
});

test("upsert rolls back ambiguous names without inserting or updating", async t => {
    fixture(t, { steps: [
        { sql: /^BEGIN$/ }, { sql: /^LOCK TABLE/ },
        { sql: /^WITH candidates/, rows: [{ user_id: "1", name: "Test User" }, { user_id: "2", name: "test user" }] },
        { sql: /^ROLLBACK$/ },
    ] });
    await assert.rejects(upsertUser({ name: "Test User", phone: "123" }, "bot", "password"), { code: "AMBIGUOUS_USER" });
});

test("upsert rolls back failed writes and propagates the database error", async t => {
    const error = new Error("Write failed");
    fixture(t, { steps: [
        { sql: /^BEGIN$/ }, { sql: /^LOCK TABLE/ }, { sql: /^WITH candidates/, rows: [{ user_id: "42", name: "Test User" }] },
        { sql: /^UPDATE/, error }, { sql: /^ROLLBACK$/ },
    ] });
    await assert.rejects(upsertUser({ name: "Test User", phone: "123" }, "bot", "password"), result => result === error);
});

test("writes reject unsupported columns and upserts without a nonempty name", async t => {
    const clients = fixture(t);
    await assert.rejects(insertUser({ 'name) VALUES (NULL); --': "value" }, "bot", "password"), /Unsupported user column/);
    await assert.rejects(insertUser({ user_id: "42", name: "Test" }, "bot", "password"), /Unsupported user column/);
    await assert.rejects(upsertUser({ phone: "123" }, "bot", "password"), /requires a name/);
    await assert.rejects(upsertUser({ name: " " }, "bot", "password"), /requires a name/);
    await assert.rejects(upsertUser(Object.assign(Object.create({ name: "Test" }), { phone: "123" }), "bot", "password"), /requires a name/);
    assert.equal(clients.length, 0);
});

test("query failures close connections and propagate the original database error", async t => {
    const error = new Error("Database write failed");
    fixture(t, { queryError: error });
    await assert.rejects(insertUser({ name: "Test" }, "bot", "password"), result => result === error);
});

test("connection failures also close the client", async t => {
    const error = new Error("Connection refused");
    fixture(t, { connectError: error });
    await assert.rejects(selectUserById("42", "bot", "password"), result => result === error);
});
