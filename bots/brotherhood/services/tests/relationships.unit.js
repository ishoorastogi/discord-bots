const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const ExcelJS = require("exceljs");
const database = require("../../api/dbs-client");
const { memberFileSchema, normalizeMemberRelationships } = require("../memberFileSchema");
const updateCommand = require("../commands/updateCommand");
const { routeResponse } = require("../router");
const { getUpdateHelp } = require("../updateHelp");
const { parseFile } = require("../../../../shared/utils/fileParser");

const headers = "name,email,phone number,class,major,grad year,positions held,family line,nicknames,brotherhood status,linkedin link";
const row = "Ishan Rastogi,ishan@example.com,3125551234,Alpha Class,Computer Science,2028,President,Oak,Ish,Active,https://linkedin.com/in/ishan";

beforeEach(t => {
    const previous = process.env.BOT_OWNER_ID;
    process.env.BOT_OWNER_ID = "owner";
    t.after(() => {
        if (previous === undefined) delete process.env.BOT_OWNER_ID;
        else process.env.BOT_OWNER_ID = previous;
    });
});

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brotherhood-relations-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "test-db.json");
    return { client: database.createLocalDatabase(file), read: async () => JSON.parse(await fs.readFile(file, "utf8")) };
}

function command(input) {
    return updateCommand.execute({ author: { id: "owner" } }, {}, input.split(/\s+/));
}

test("relationship defaults preserve existing information and normalize legacy aliases", () => {
    const original = { name: "Ishan Rastogi", email: "ishan@example.com", extra: { keep: true } };
    assert.deepEqual(normalizeMemberRelationships(original), { ...original, big: "", littles: [] });
    assert.deepEqual(original, { name: "Ishan Rastogi", email: "ishan@example.com", extra: { keep: true } });
    assert.deepEqual(normalizeMemberRelationships({ name: "Ishan", "big brother": "John Smith", litters: "Jane Doe; Alex Patel, jane doe" }), {
        name: "Ishan", big: "John Smith", littles: ["Jane Doe", "Alex Patel"],
    });
});

test("one big is enforced and multiple distinct littles are accepted", () => {
    assert.throws(() => normalizeMemberRelationships({ big: ["One Person", "Another Person"] }), /only one person's name/);
    assert.throws(() => normalizeMemberRelationships({ littles: ["Valid Name", 42] }), /names must be text/);
    assert.deepEqual(normalizeMemberRelationships({ big: ["One Person"], littles: ["Jane Doe", "jane doe", "Alex Patel"] }), {
        big: "One Person", littles: ["Jane Doe", "Alex Patel"],
    });
});

test("update accepts relationship categories and normalizes a littles list", async () => {
    const result = await command('"Ishan Rastogi" big John Smith; littles "Jane Doe, Alex Patel, jane doe"');
    assert.equal(result.ok, true);
    assert.deepEqual(result.updates, [
        { category: "big", value: "John Smith" },
        { category: "littles", value: ["Jane Doe", "Alex Patel"] },
    ]);
    for (const alias of ["little", "litters", "litter"]) {
        const response = await command(`"Ishan Rastogi" ${alias} "Jane Doe; Alex Patel"`);
        assert.equal(response.category, "littles");
        assert.deepEqual(response.value, ["Jane Doe", "Alex Patel"]);
    }
});

test("router saves one big and multiple littles, replaces lists, and clears both fields", async t => {
    const { client, read } = await fixture(t);
    t.mock.method(database, "updateMember", client.updateMember);
    t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const replies = [];
    const message = { author: { id: "owner" }, reply: async response => replies.push(response) };
    await routeResponse(message, await command('"Ishan Rastogi" big John Smith; littles "Jane Doe, Alex Patel"'));
    let member = (await read()).members[0];
    assert.equal(member.big, "John Smith");
    assert.deepEqual(member.littles, ["Jane Doe", "Alex Patel"]);
    await routeResponse(message, await command('"Ishan Rastogi" littles Sam Lee'));
    assert.deepEqual((await read()).members[0].littles, ["Sam Lee"]);
    await routeResponse(message, await command('"Ishan Rastogi" big ""; littles ""'));
    member = (await read()).members[0];
    assert.equal(member.big, "");
    assert.deepEqual(member.littles, []);
});

test("multiple bigs fail while other valid pairs still save", async t => {
    const { client, read } = await fixture(t);
    t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const result = await command('"Ishan Rastogi" big "John Smith, Another Person"; major Physics; littles "Jane Doe, Alex Patel"');
    assert.equal(result.ok, true);
    assert.match(result.errors[0].message, /only one person's name/);
    await routeResponse({ author: { id: "owner" }, reply: async () => {} }, result);
    const member = (await read()).members[0];
    assert.equal(member.big, "");
    assert.equal(member.major, "Physics");
    assert.deepEqual(member.littles, ["Jane Doe", "Alex Patel"]);
});

test("database imports initialize relationships and store litters under the canonical field", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "Ishan Rastogi" }, { name: "Another Person", big: "John Smith", litters: ["Jane Doe", "Alex Patel"] }]);
    assert.deepEqual((await read()).members, [
        { name: "Ishan Rastogi", big: "", littles: [] },
        { name: "Another Person", big: "John Smith", littles: ["Jane Doe", "Alex Patel"] },
    ]);
});

test("older CSV files remain valid and receive empty relationship defaults", async () => {
    const result = await parseFile(Buffer.from(headers + "\n" + row), "members.csv", { schema: memberFileSchema });
    assert.equal(result.ok, true);
    assert.equal(result.sheets[0].rows[0].data.big, "");
    assert.deepEqual(result.sheets[0].rows[0].data.littles, []);
});

test("CSV relationship headers accept aliases and normalize multiple littles", async () => {
    const result = await parseFile(Buffer.from(headers + ',big brother,litters\n' + row + ',John Smith,"Jane Doe, Alex Patel"'), "members.csv", { schema: memberFileSchema });
    assert.equal(result.ok, true);
    const member = result.sheets[0].rows[0].data;
    assert.equal(member.big, "John Smith");
    assert.deepEqual(member.littles, ["Jane Doe", "Alex Patel"]);
    assert.equal(member.litters, undefined);
});

test("XLSX imports preserve relationship values and report multiple bigs on their row", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Members");
    sheet.addRow([...headers.split(","), "big", "littles"]);
    sheet.addRow([...row.split(","), "John Smith", "Jane Doe; Alex Patel"]);
    sheet.getRow(7).values = [...row.split(","), "John Smith, Another Person", "Sam Lee"];
    const result = await parseFile(Buffer.from(await workbook.xlsx.writeBuffer()), "members.xlsx", { schema: memberFileSchema });
    assert.equal(result.ok, false);
    assert.deepEqual(result.sheets[0].rows[0].data.littles, ["Jane Doe", "Alex Patel"]);
    assert.ok(result.errors.some(error => error.sheet === "Members" && error.line === 7 && error.column === 12 && /only one/.test(error.message)));
});

test("brother output and category help include the new relationships", async t => {
    t.mock.method(database, "findBrother", async () => ({ name: "Ishan Rastogi", big: "John Smith", littles: ["Jane Doe", "Alex Patel"] }));
    const replies = [];
    await routeResponse({ reply: async response => replies.push(response) }, { type: "brother", ok: true, query: "Ishan" });
    const report = replies.map(reply => reply.content).join("\n");
    assert.match(report, /\*\*Big:\*\* John Smith/);
    assert.match(report, /\*\*Littles:\*\* Jane Doe, Alex Patel/);
    const help = getUpdateHelp();
    for (const category of ["big", "littles", "little", "litters"]) assert.ok(help.includes("`" + category + "`"));
});
