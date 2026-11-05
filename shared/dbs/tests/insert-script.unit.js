const assert = require("node:assert/strict");
const { test } = require("node:test");
const select = require("../crud/select");
const insert = require("../crud/insert");
const { incrementUserPhone } = require("../test-scripts/test-user-insert");

test("insert script selects test user and upserts only the incremented phone with caller credentials", async t => {
    const lookup = t.mock.method(select, "selectUsersByName", async () => [{ user_id: "1", name: "test user", discord_id: null, phone: "9007199254740993" }]);
    const upsert = t.mock.method(insert, "upsertUser", async data => ({ user_id: "1", ...data }));
    const saved = await incrementUserPhone("bot", "password");
    assert.deepEqual(lookup.mock.calls[0].arguments, ["test user", "bot", "password"]);
    assert.deepEqual(upsert.mock.calls[0].arguments, [{ name: "test user", phone: "9007199254740994" }, "bot", "password"]);
    assert.equal(saved.phone, "9007199254740994");
});

test("insert script preserves leading zeroes when incrementing numeric text", async t => {
    t.mock.method(select, "selectUsersByName", async () => [{ name: "test user", phone: "0009" }]);
    t.mock.method(insert, "upsertUser", async data => data);
    assert.equal((await incrementUserPhone("bot", "password")).phone, "0010");
});

test("insert script rejects missing and ambiguous users without writing", async t => {
    const lookup = t.mock.method(select, "selectUsersByName", async () => []);
    const upsert = t.mock.method(insert, "upsertUser", async () => { throw new Error("Unexpected write"); });
    await assert.rejects(incrementUserPhone("bot", "password"), /No user named/);
    lookup.mock.mockImplementation(async () => [{ user_id: "1" }, { user_id: "2" }]);
    await assert.rejects(incrementUserPhone("bot", "password"), /More than one/);
    assert.equal(upsert.mock.callCount(), 0);
});

test("insert script rejects nonnumeric phones without writing", async t => {
    const lookup = t.mock.method(select, "selectUsersByName", async () => []);
    const upsert = t.mock.method(insert, "upsertUser", async () => { throw new Error("Unexpected write"); });
    for (const phone of [null, "", "+1 (312) 555-1234", "12.5"]) {
        lookup.mock.mockImplementation(async () => [{ name: "test user", phone }]);
        await assert.rejects(incrementUserPhone("bot", "password"), /only digits/);
    }
    assert.equal(upsert.mock.callCount(), 0);
});

test("insert script propagates an upsert failure", async t => {
    t.mock.method(select, "selectUsersByName", async () => [{ name: "test user", phone: "123" }]);
    const error = new Error("Write failed");
    t.mock.method(insert, "upsertUser", async () => { throw error; });
    await assert.rejects(incrementUserPhone("bot", "password"), result => result === error);
});
