const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const updateCommand = require("../commands/updateCommand");
const { handleMentionCommand } = require("../commands/handleMentionCommand");
const { routeResponse } = require("../router");
const { memberFileSchema } = require("../memberFileSchema");
const database = require("../../api/dbs-client");
const stored = record => ({ big: "", littles: [], ...record });

beforeEach(t => {
    const previous = process.env.BOT_OWNER_ID;
    process.env.BOT_OWNER_ID = "owner";
    t.after(() => {
        if (previous === undefined) {
            delete process.env.BOT_OWNER_ID;
        } else {
            process.env.BOT_OWNER_ID = previous;
        }
    });
});

function command(input) {
    return updateCommand.execute({ author: { id: "owner" } }, {}, input.split(/\s+/));
}

async function fixture(t) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brotherhood-update-"));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, "test-db.json");
    return {
        file,
        client: database.createLocalDatabase(file),
        read: async () => JSON.parse(await fs.readFile(file, "utf8")),
    };
}

test("update accepts every supplied category, full names, and values containing spaces", async () => {
    const values = ["John Doe", "john@example.com", "+1 (312) 555-1234", "Alpha", "Computer Science", "2028",
        "President and Treasurer", "Oak", "Johnny", "Active", "https://www.linkedin.com/in/john", "Big Brother", "Little One, Little Two"];
    for (const [index, category] of memberFileSchema.entries()) {
        const result = await command(`"John Smith" ${category.name} ${values[index]}`);
        assert.deepEqual(result, {
            type: "update", ok: true, name: "John Smith", category: category.name,
            value: category.name === "littles" ? ["Little One", "Little Two"] : values[index],
        });
    }
});

test("update supports quoted categories, header aliases, and single-word names", async () => {
    assert.deepEqual(await command('"John Smith" "Phone Number" "+1 (312) 555-1234"'), {
        type: "update", ok: true, name: "John Smith", category: "phone number", value: "+1 (312) 555-1234",
    });
    const result = await command("John Graduation_Year 2029");
    assert.equal(result.ok, true);
    assert.equal(result.category, "grad year");
});

test("unknown categories are rejected even when values contain a valid category name", async () => {
    for (const input of ['"John Smith" salary major', '"John Smith" __proto__ value', '"John Smith" company Example']) {
        const result = await command(input);
        assert.equal(result.ok, false);
        assert.match(result.message, /Unknown category/);
    }
});

test("missing arguments and unclosed quotes return usage errors", async () => {
    for (const input of ["", "John", '"" major Math', '"John Smith" major', '"John Smith major Math', '"John"oops major Math']) {
        const result = await command(input);
        assert.equal(result.ok, false);
        assert.match(result.message, /Usage:/);
    }
});

test("update uses import validators and permits clearing optional fields only", async () => {
    for (const input of ['John email invalid', 'John "phone number" abc', 'John grad year next', 'John linkedin link https://example.com', 'John name ""']) {
        assert.equal((await command(input)).ok, false);
    }
    assert.deepEqual(await command('John nicknames ""'), {
        type: "update", ok: true, name: "John", category: "nicknames", value: "",
    });
});

test("existing members match normalized names and only the requested field changes", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "John Smith", email: "john@example.com", major: "Math" }, { name: "Jane", major: "Physics" }]);
    assert.deepEqual(await client.updateMember("  JOHN   SMITH  ", "major", "Computer Science"), {
        created: false, name: "John Smith", category: "major",
    });
    assert.deepEqual((await read()).members, [
        { name: "John Smith", email: "john@example.com", major: "Computer Science" },
        { name: "Jane", major: "Physics" },
    ].map(stored));
});

test("a missing person is created with the requested field and can be updated again", async t => {
    const { client, read } = await fixture(t);
    const created = await client.updateMember("John Smith", "major", "Math");
    assert.equal(created.created, true);
    await client.updateMember("john smith", "email", "john@example.com");
    const { members } = await read();
    assert.equal(members.length, 1);
    assert.equal(members[0].name, "John Smith");
    assert.equal(members[0].major, "Math");
    assert.equal(members[0].email, "john@example.com");
    assert.equal(members[0]["positions held"], "");
});

test("imports and updates share a queue and preserve each other's changes", async t => {
    const { client, read } = await fixture(t);
    await Promise.all([
        client.addMembers([{ name: "John" }]),
        client.updateMember("John", "major", "Math"),
        client.addMembers([{ name: "Jane" }]),
        client.updateMember("John", "email", "john@example.com"),
    ]);
    assert.deepEqual((await read()).members, [
        { name: "John", major: "Math", email: "john@example.com" }, { name: "Jane" },
    ].map(stored));
});

test("the name category renames a member without creating another record", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "John", major: "Math" }]);
    await client.updateMember("John", "name", "John Smith");
    assert.deepEqual((await read()).members, [stored({ name: "John Smith", major: "Math" })]);
});

test("duplicate matching names and conflicting renames are rejected without altering the database", async t => {
    const { file, client } = await fixture(t);
    for (const members of [[{ name: "John" }, { name: "JOHN" }], [{ name: "John" }, { name: "Jane" }]]) {
        const contents = JSON.stringify({ members });
        await fs.writeFile(file, contents);
        await assert.rejects(client.updateMember("John", "name", "Jane"), { code: "AMBIGUOUS_MEMBER" });
        assert.equal(await fs.readFile(file, "utf8"), contents);
    }
});

test("database rejects invalid fields and values even when called without the command", async t => {
    const { client } = await fixture(t);
    await assert.rejects(client.updateMember("John", "company", "Example"), /Unknown member category/);
    await assert.rejects(client.updateMember("John", "email", "invalid"), /valid email/);
    await assert.rejects(client.updateMember("", "major", "Math"), /Name is required/);
});

test("mention handler passes update requests through the router and saves before confirming", async t => {
    const { client, read } = await fixture(t);
    t.mock.method(database, "updateMember", client.updateMember);
    const replies = [];
    let expectedMajor = "Computer Science";
    const message = {
        author: { id: "owner", bot: false },
        content: '<@123> /update "John Smith" major Computer Science',
        mentions: { users: new Map([["123", {}]]) },
        async reply(response) {
            assert.equal((await read()).members[0].major, expectedMajor);
            replies.push(response);
        },
    };
    await handleMentionCommand(message, { user: { id: "123" } });
    assert.match(replies[0].content, /Added John Smith and set major/);
    expectedMajor = "Mathematics";
    message.content = '<@123> /update "John Smith" major Mathematics';
    await handleMentionCommand(message, { user: { id: "123" } });
    assert.equal((await read()).members[0].major, "Mathematics");
    assert.match(replies[1].content, /Updated major for John Smith/);
});

test("router does not call the database for rejected commands", async t => {
    const save = t.mock.method(database, "updateMember", async () => { throw new Error("Unexpected write"); });
    const replies = [];
    await routeResponse({ author: { id: "owner" }, reply: async response => replies.push(response) }, await command("John salary 100"));
    assert.equal(save.mock.callCount(), 0);
    assert.match(replies[0].content, /Unknown category/);
});

test("failed update writes leave existing records intact and do not confirm success", async t => {
    const { file, client } = await fixture(t);
    await client.addMembers([{ name: "John", major: "Math" }]);
    const original = await fs.readFile(file, "utf8");
    t.mock.method(fs, "rename", async () => { throw new Error("Disk is full"); });
    t.mock.method(database, "updateMember", client.updateMember);
    t.mock.method(console, "error", () => {});
    const replies = [];
    await routeResponse({ author: { id: "owner" }, reply: async response => replies.push(response) }, await command("John major Physics"));
    assert.equal(await fs.readFile(file, "utf8"), original);
    assert.match(replies[0].content, /No changes were saved/);
    assert.doesNotMatch(replies[0].content, /Updated|Added/);
});

test("nonowners cannot update or create a member through the mention handler", async t => {
    const save = t.mock.method(database, "updateMember", async () => { throw new Error("Unexpected write"); });
    const replies = [];
    await handleMentionCommand({
        author: { id: "not-owner", bot: false },
        content: '<@123> /update "John Smith" major Math',
        mentions: { users: new Map([["123", {}]]) },
        reply: async response => replies.push(response),
    }, { user: { id: "123" } });
    assert.equal(save.mock.callCount(), 0);
    assert.match(replies[0].content, /Only the bot owner can update members/);
});

test("router rechecks ownership before saving an accepted update request", async t => {
    const response = await command('"John Smith" major Math');
    const save = t.mock.method(database, "updateMember", async () => { throw new Error("Unexpected write"); });
    const replies = [];
    await routeResponse({ author: { id: "not-owner" }, reply: async result => replies.push(result) }, response);
    assert.equal(save.mock.callCount(), 0);
    assert.match(replies[0].content, /Only the bot owner/);
});

test("missing or blank owner configuration denies updates", async t => {
    const save = t.mock.method(database, "updateMember", async () => { throw new Error("Unexpected write"); });
    for (const ownerId of [undefined, "", "   "]) {
        if (ownerId === undefined) {
            delete process.env.BOT_OWNER_ID;
        } else {
            process.env.BOT_OWNER_ID = ownerId;
        }
        const response = await command('"John Smith" major Math');
        assert.equal(response.ok, false);
        assert.match(response.message, /Only the bot owner/);
        const replies = [];
        await routeResponse({ author: { id: "owner" }, reply: async result => replies.push(result) }, {
            type: "update", ok: true, name: "John Smith", category: "major", value: "Math",
        });
        assert.match(replies[0].content, /Only the bot owner/);
    }
    assert.equal(save.mock.callCount(), 0);
});

test("multiple pairs accept full names, multiword values, and aliases", async () => {
    assert.deepEqual(await command('"Ishan Rastogi" class Alpha Class; major Computer Science; grad year 2028'), {
        type: "update", ok: true, name: "Ishan Rastogi", updates: [
            { category: "class", value: "Alpha Class" },
            { category: "major", value: "Computer Science" },
            { category: "grad year", value: "2028" },
        ],
    });
    const aliases = await command('"Ishan Rastogi" number 3125551234;position President; STATUS Active');
    assert.equal(aliases.ok, true);
    assert.deepEqual(aliases.updates.map(update => update.category), ["phone number", "positions held", "brotherhood status"]);
});

test("quoted semicolons remain part of values and empty optional values are accepted", async () => {
    const result = await command('"Ishan Rastogi" positions "President; Treasurer"; nicknames ""; "family line" Oak');
    assert.equal(result.ok, true);
    assert.deepEqual(result.updates, [
        { category: "positions held", value: "President; Treasurer" },
        { category: "nicknames", value: "" },
        { category: "family line", value: "Oak" },
    ]);
});

test("bad later pairs are reported while valid pairs remain accepted", async () => {
    for (const input of [
        'John major Math; salary 100', 'John major Math; grad year',
        'John major Math;', 'John major Math;;class Alpha',
        'John major Math; email invalid', 'John positions President; position Treasurer',
    ]) {
        const result = await command(input);
        assert.equal(result.ok, true);
        assert.ok(result.updates.length >= 1);
        assert.equal(result.errors.length, 1);
        assert.equal(result.errors[0].pair, 2);
        assert.ok(result.errors[0].message);
    }
});

test("several fields update the existing person while preserving unrelated data", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "Ishan Rastogi", email: "ishan@example.com", major: "Math" }, { name: "Someone Else" }]);
    const saved = await client.updateMemberFields("ISHAN RASTOGI", [
        { category: "class", value: "Alpha Class" },
        { category: "major", value: "Computer Science" },
        { category: "grad year", value: "2028" },
    ]);
    assert.equal(saved.created, false);
    assert.deepEqual(saved.categories, ["class", "major", "grad year"]);
    assert.deepEqual((await read()).members, [
        { name: "Ishan Rastogi", email: "ishan@example.com", major: "Computer Science", class: "Alpha Class", "grad year": "2028" },
        { name: "Someone Else" },
    ].map(stored));
});

test("multiple fields create one missing member and support renaming in the same write", async t => {
    const { client, read } = await fixture(t);
    const saved = await client.updateMemberFields("Ishan", [
        { category: "name", value: "Ishan Rastogi" },
        { category: "class", value: "Alpha Class" },
        { category: "number", value: "3125551234" },
    ]);
    assert.equal(saved.created, true);
    const { members } = await read();
    assert.equal(members.length, 1);
    assert.equal(members[0].name, "Ishan Rastogi");
    assert.equal(members[0].class, "Alpha Class");
    assert.equal(members[0]["phone number"], "3125551234");
});

test("database saves valid fields and reports invalid later fields for existing and new members", async t => {
    const { file, client } = await fixture(t);
    await client.addMembers([{ name: "Ishan Rastogi", major: "Math" }]);
    for (const name of ["Ishan Rastogi", "New Person"]) {
        for (const badPair of [
            { category: "email", value: "invalid" },
            { category: "salary", value: "100" },
            { category: "major", value: "Physics" },
        ]) {
            await fs.writeFile(file, JSON.stringify({ members: [{ name: "Ishan Rastogi", major: "Math" }] }));
            const saved = await client.updateMemberFields(name, [
                { category: "major", value: "Computer Science" }, badPair,
            ]);
            assert.deepEqual(saved.categories, ["major"]);
            assert.equal(saved.errors.length, 1);
            const members = JSON.parse(await fs.readFile(file, "utf8")).members;
            const member = members.find(member => member.name === name);
            assert.equal(member.major, "Computer Science");
            assert.equal(member.salary, undefined);
            assert.notEqual(member.email, "invalid");
            assert.equal(members.length, name === "New Person" ? 2 : 1);
        }
    }
});

test("a conflicting rename is reported while other fields update", async t => {
    const { read, client } = await fixture(t);
    await client.addMembers([{ name: "John", major: "Math" }, { name: "Jane" }]);
    const saved = await client.updateMemberFields("John", [
        { category: "major", value: "Physics" }, { category: "name", value: "Jane" },
    ]);
    assert.deepEqual(saved.categories, ["major"]);
    assert.equal(saved.errors[0].category, "name");
    assert.equal(saved.errors[0].code, "AMBIGUOUS_MEMBER");
    assert.deepEqual((await read()).members, [{ name: "John", major: "Physics" }, { name: "Jane" }].map(stored));
});

test("router saves every pair before sending one confirmation", async t => {
    const { client, read } = await fixture(t);
    const save = t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const replies = [];
    await handleMentionCommand({
        author: { id: "owner", bot: false },
        content: '<@123> /update "Ishan Rastogi" class Alpha Class; major Computer Science; grad year 2028',
        mentions: { users: new Map([["123", {}]]) },
        async reply(response) {
            const member = (await read()).members[0];
            assert.equal(member.class, "Alpha Class");
            assert.equal(member.major, "Computer Science");
            assert.equal(member["grad year"], "2028");
            replies.push(response);
        },
    }, { user: { id: "123" } });
    assert.equal(save.mock.callCount(), 1);
    assert.equal(replies.length, 1);
    assert.match(replies[0].content, /Added Ishan Rastogi and set class, major, grad year/);
});

test("nonowners cannot invoke batch updates through the router or command", async t => {
    const save = t.mock.method(database, "updateMemberFields", async () => { throw new Error("Unexpected write"); });
    const response = await command('John class Alpha; major Math');
    const replies = [];
    await routeResponse({ author: { id: "not-owner" }, reply: async result => replies.push(result) }, response);
    assert.match(replies[0].content, /Only the bot owner/);
    const rejected = await updateCommand.execute({ author: { id: "not-owner" } }, {}, ['John', 'class', 'Alpha;', 'major', 'Math']);
    assert.equal(rejected.ok, false);
    assert.equal(save.mock.callCount(), 0);
});

test("a command with no valid pairs never reaches either database update method", async t => {
    const batch = t.mock.method(database, "updateMemberFields", async () => { throw new Error("Unexpected write"); });
    const single = t.mock.method(database, "updateMember", async () => { throw new Error("Unexpected write"); });
    const replies = [];
    await routeResponse({ author: { id: "owner" }, reply: async result => replies.push(result) },
        await command('John major; email invalid; salary 100'));
    assert.match(replies[0].content, /valid email/);
    assert.equal(batch.mock.callCount(), 0);
    assert.equal(single.mock.callCount(), 0);
});

test("router saves valid pairs, preserves rejected values, and lists each failure with help", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "Ishan Rastogi", email: "ishan@example.com", major: "Math" }]);
    const batch = t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const replies = [];
    await handleMentionCommand({
        author: { id: "owner", bot: false },
        content: '<@123> /update "ishan rastogi" class Alpha Class; email invalid; major Computer Science; salary 100',
        mentions: { users: new Map([["123", {}]]) },
        reply: async response => replies.push(response),
    }, { user: { id: "123" } });
    assert.equal(batch.mock.callCount(), 1);
    assert.deepEqual((await read()).members, [{
        name: "Ishan Rastogi", email: "ishan@example.com", major: "Computer Science", class: "Alpha Class",
    }].map(stored));
    const report = replies.map(reply => reply.content).join("\n");
    assert.match(report, /Updated class, major for Ishan Rastogi/);
    assert.match(report, /Pair 2 \(email invalid\): Email must be a valid email address/);
    assert.match(report, /Pair 4 \(salary 100\): Unknown category/);
    assert.match(report, /Available categories:/);
    assert.match(report, /Ishan Rastogi.*Alpha Class/);
    assert.ok(replies.every(reply => reply.content.length <= 2000));
});

test("an invalid first pair does not block later valid pairs or create duplicate people", async t => {
    const { client, read } = await fixture(t);
    t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const response = await command('"Ishan Rastogi" email invalid; class Alpha Class; email ishan@example.com');
    assert.equal(response.ok, true);
    assert.equal(response.errors[0].pair, 1);
    await routeResponse({ author: { id: "owner" }, reply: async () => {} }, response);
    const { members } = await read();
    assert.equal(members.length, 1);
    assert.equal(members[0].class, "Alpha Class");
    assert.equal(members[0].email, "ishan@example.com");
});

test("earlier valid pairs survive unclosed quotes in a later pair", async () => {
    const result = await command('"Ishan Rastogi" class Alpha Class; positions "President; Treasurer');
    assert.equal(result.ok, true);
    assert.deepEqual(result.updates, [{ category: "class", value: "Alpha Class" }]);
    assert.equal(result.errors[0].pair, 2);
    assert.match(result.errors[0].message, /Quotes must be closed/);
});

test("a fully invalid batch never creates a database file or member", async t => {
    const { file, client } = await fixture(t);
    const saved = await client.updateMemberFields("New Person", [
        { category: "email", value: "invalid" }, { category: "salary", value: "100" },
    ]);
    assert.deepEqual(saved.categories, []);
    assert.equal(saved.created, false);
    assert.equal(saved.errors.length, 2);
    await assert.rejects(fs.stat(file), { code: "ENOENT" });
});

test("router reports a conflicting rename and parser failures alongside successful updates", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "John", major: "Math" }, { name: "Jane" }]);
    t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const replies = [];
    await routeResponse({ author: { id: "owner" }, reply: async response => replies.push(response) },
        await command('John major Physics; name Jane; email invalid'));
    const report = replies.map(reply => reply.content).join("\n");
    assert.match(report, /Updated major for John/);
    assert.match(report, /name Jane: Another member already has that name/);
    assert.match(report, /Pair 3 \(email invalid\)/);
    assert.deepEqual((await read()).members, [{ name: "John", major: "Physics" }, { name: "Jane" }].map(stored));
});

test("a failed batch write leaves every original field intact", async t => {
    const { file, client } = await fixture(t);
    await client.addMembers([{ name: "Ishan Rastogi", major: "Math", class: "Original" }]);
    const original = await fs.readFile(file, "utf8");
    t.mock.method(fs, "rename", async () => { throw new Error("Disk is full"); });
    await assert.rejects(client.updateMemberFields("Ishan Rastogi", [
        { category: "class", value: "Alpha Class" }, { category: "major", value: "Physics" },
    ]), /Disk is full/);
    assert.equal(await fs.readFile(file, "utf8"), original);
});

test("unique first names and consecutive name prefixes update the existing full-name record", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "Sai Kottamasu", major: "Math" }, { name: "Someone Else", major: "Chemistry" }]);
    for (const query of ["Sai", "Sai K", "Sai Kotta", "  SAI   KOTTA  "]) {
        const saved = await client.updateMember(query, "major", "Physics");
        assert.equal(saved.created, false);
        assert.equal(saved.name, "Sai Kottamasu");
        assert.deepEqual((await read()).members, [
            { name: "Sai Kottamasu", major: "Physics" }, { name: "Someone Else", major: "Chemistry" },
        ].map(stored));
    }
});

test("ambiguous first names and prefixes list candidates and leave every field unchanged", async t => {
    const { file, client, read } = await fixture(t);
    await client.addMembers([{ name: "Sai Kottamasu", major: "Math" }, { name: "Sai Kumar", major: "Chemistry" }]);
    const original = await fs.readFile(file, "utf8");
    for (const query of ["Sai", "Sai K"]) {
        await assert.rejects(client.updateMemberFields(query, [
            { category: "major", value: "Physics" }, { category: "class", value: "Alpha Class" },
        ]), error => {
            assert.equal(error.code, "AMBIGUOUS_MEMBER");
            assert.deepEqual(error.options, ["Sai Kottamasu", "Sai Kumar"]);
            return true;
        });
        assert.equal(await fs.readFile(file, "utf8"), original);
    }
    await client.updateMember("Sai Kotta", "major", "Physics");
    assert.deepEqual((await read()).members.map(member => member.major), ["Physics", "Chemistry"]);
});

test("exact full names take priority over other longer matching names for updates", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "Sai Kottamasu" }, { name: "Sai Kottamasu Jr." }]);
    await client.updateMember("sai kottamasu", "major", "Math");
    const { members } = await read();
    assert.equal(members[0].major, "Math");
    assert.equal(members[1].major, undefined);
});

test("mention commands support first names and quoted prefixes with one or multiple pairs", async t => {
    const { client, read } = await fixture(t);
    await client.addMembers([{ name: "Sai Kottamasu" }]);
    t.mock.method(database, "updateMember", client.updateMember);
    t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const replies = [];
    for (const content of [
        '<@123> /update Sai major Physics; grad year 2029',
        '<@123> /update "Sai K" class Alpha Class',
        '<@123> /update "Sai Kotta" position President',
    ]) {
        await handleMentionCommand({
            author: { id: "owner", bot: false }, content,
            mentions: { users: new Map([["123", {}]]) },
            reply: async response => replies.push(response),
        }, { user: { id: "123" } });
    }
    const { members } = await read();
    assert.equal(members.length, 1);
    assert.equal(members[0].name, "Sai Kottamasu");
    assert.equal(members[0].major, "Physics");
    assert.equal(members[0]["grad year"], "2029");
    assert.equal(members[0].class, "Alpha Class");
    assert.equal(members[0]["positions held"], "President");
    assert.ok(replies.every(reply => reply.content.includes("Sai Kottamasu") && !reply.content.includes("Added")));
});

test("router asks for clarification on ambiguous update prefixes and shows full-name options", async t => {
    const { file, client } = await fixture(t);
    await client.addMembers([{ name: "Sai Kottamasu" }, { name: "Sai Kumar" }]);
    const original = await fs.readFile(file, "utf8");
    t.mock.method(database, "updateMemberFields", client.updateMemberFields);
    const replies = [];
    await routeResponse({ author: { id: "owner" }, reply: async response => replies.push(response) },
        await command('Sai major Physics; class Alpha Class'));
    const report = replies.map(reply => reply.content).join("\n");
    assert.match(report, /No changes were saved/);
    assert.match(report, /Which member did you mean/);
    assert.match(report, /- Sai Kottamasu/);
    assert.match(report, /- Sai Kumar/);
    assert.match(report, /Available categories:/);
    assert.ok(replies.every(reply => reply.content.length <= 2000));
    assert.equal(await fs.readFile(file, "utf8"), original);
});
