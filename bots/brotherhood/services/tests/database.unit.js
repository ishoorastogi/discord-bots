const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const database = require("../../api/dbs-client");
const { routeResponse } = require("../router");
const stored = record => ({ big: "", littles: [], ...record });

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brotherhood-db-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "test-db.json");
    return { directory, file, client: database.createLocalDatabase(file) };
}

test("local database creates missing files and appends members while preserving existing data", async t => {
    const { file, client } = await fixture(t);
    assert.deepEqual(await client.addMembers([{ name: "Alice", "grad year": 2028 }]), { added: 1, total: 1 });
    await client.addMembers([{ name: "Bob", email: "bob@example.com" }]);
    assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), {
        members: [{ name: "Alice", "grad year": 2028 }, { name: "Bob", email: "bob@example.com" }].map(stored),
    });
});

test("local database accepts an empty file and retains unrelated database metadata", async t => {
    const { file, client } = await fixture(t);
    await fs.writeFile(file, "\n");
    await client.addMembers([{ name: "Alice" }]);
    await fs.writeFile(file, JSON.stringify({ version: 1, members: [{ name: "Alice" }] }));
    await client.addMembers([{ name: "Bob" }]);
    assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")), {
        version: 1, members: [{ name: "Alice" }, stored({ name: "Bob" })],
    });
});

test("simultaneous imports are serialized without losing records", async t => {
    const { file, client } = await fixture(t);
    const members = Array.from({ length: 20 }, (_, i) => ({ name: `Member ${i}` }));
    await Promise.all(members.map(member => client.addMembers([member])));
    assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")).members, members.map(stored));
});

test("invalid JSON or database structure is preserved and does not block later valid writes", async t => {
    const { file, client } = await fixture(t);
    for (const contents of ["{bad json", "null", "[]", '{"members":{}}']) {
        await fs.writeFile(file, contents);
        await assert.rejects(client.addMembers([{ name: "Alice" }]), /existing data was not changed/);
        assert.equal(await fs.readFile(file, "utf8"), contents);
    }
    await fs.writeFile(file, '{"members":[]}');
    assert.deepEqual(await client.addMembers([{ name: "Alice" }]), { added: 1, total: 1 });
});

test("failed replacement leaves the old database intact and cleans up the temporary file", async t => {
    const { directory, file, client } = await fixture(t);
    const original = '{"members":[{"name":"Existing"}]}';
    await fs.writeFile(file, original);
    t.mock.method(fs, "rename", async () => { throw new Error("Disk write failed"); });
    await assert.rejects(client.addMembers([{ name: "Alice" }]), /Disk write failed/);
    assert.equal(await fs.readFile(file, "utf8"), original);
    assert.deepEqual(await fs.readdir(directory), ["test-db.json"]);
});

test("router saves rows from every worksheet before reporting success", async t => {
    const { file, client } = await fixture(t);
    t.mock.method(database, "addMembers", client.addMembers);
    const members = [{ name: "Alice", major: "Math" }, { name: "Bob", major: "CS" }];
    const replies = [];
    await routeResponse({
        async reply(response) {
            assert.deepEqual(JSON.parse(await fs.readFile(file, "utf8")).members, members.map(stored));
            replies.push(response.content);
        },
    }, {
        type: "fileIntake",
        files: [{
            fileName: "members.xlsx", ok: true,
            sheets: members.map((member, i) => ({ name: `Sheet ${i}`, rows: [{ line: 2, data: member }] })),
        }],
    });
    assert.deepEqual(replies, ["Imported members.xlsx successfully (2 records saved)."]);
});

test("router never saves partial rows from a file with validation errors", async t => {
    const save = t.mock.method(database, "addMembers", async () => { throw new Error("Unexpected save"); });
    const replies = [];
    await routeResponse({ reply: async response => replies.push(response.content) }, {
        type: "fileIntake",
        files: [{
            fileName: "members.csv", ok: false,
            sheets: [{ rows: [{ line: 2, data: { name: "Alice" } }] }],
            errors: [{ line: 3, message: "Email must be a valid email address." }],
        }],
    });
    assert.equal(save.mock.callCount(), 0);
    assert.match(replies.join("\n"), /Line 3: Email must be a valid email address/);
});

test("router reports database failures without a success confirmation", async t => {
    t.mock.method(database, "addMembers", async () => { throw new Error("Disk is full"); });
    t.mock.method(console, "error", () => {});
    const replies = [];
    await routeResponse({ reply: async response => replies.push(response.content) }, {
        type: "fileIntake",
        files: [{ fileName: "members.csv", ok: true, sheets: [{ rows: [{ data: { name: "Alice" } }] }] }],
    });
    assert.match(replies.join("\n"), /Could not save members.csv to the local test database/);
    assert.doesNotMatch(replies.join("\n"), /successfully/);
});
