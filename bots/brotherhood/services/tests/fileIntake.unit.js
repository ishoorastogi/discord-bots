const assert = require("node:assert/strict");
const { test } = require("node:test");
const ExcelJS = require("exceljs");
const { parseFile } = require("../../../../shared/utils/fileParser");
const fileIntakeCommand = require("../commands/fileIntakeCommand");
const { handleMentionCommand } = require("../commands/handleMentionCommand");
const { routeResponse } = require("../router");
const { memberFileSchema } = require("../memberFileSchema");
const database = require("../../api/dbs-client");

const memberHeaders = "name,email,phone number,class,major,grad year,positions held,family line,nicknames,brotherhood status,linkedin link";
const validMember = "Alice,alice@example.com,+1 (312) 555-1234,Alpha,Math,2028,President,Oak,Al,Active,https://www.linkedin.com/in/alice";

function csv(text, name = "members.csv") {
    return parseFile(Buffer.from(text), name);
}

async function xlsx(build, name = "members.xlsx") {
    const workbook = new ExcelJS.Workbook();
    build(workbook);
    return parseFile(Buffer.from(await workbook.xlsx.writeBuffer()), name);
}

function message(attachments = [], content = "<@123> /fileintake") {
    const replies = [];
    return {
        author: { bot: false },
        content,
        attachments: new Map(attachments.map((attachment, i) => [String(i), attachment])),
        mentions: { users: new Map([["123", { id: "123" }]]) },
        replies,
        async reply(response) { replies.push(response); },
    };
}

function attachment(name = "members.csv") {
    return { name, size: 20, url: "https://cdn.discordapp.com/attachments/example" };
}

test("CSV handles BOM, quotes, embedded commas/newlines and preserves source lines", async () => {
    const result = await csv('\uFEFFname,major\r\n"Alice, \"\"Al\"\"\r\nSmith",Math\r\nBob,CS\r\n');
    assert.equal(result.ok, true);
    assert.equal(result.rowCount, 2);
    assert.deepEqual(result.sheets[0].rows, [
        { line: 2, endLine: 3, data: { name: 'Alice, "Al"\r\nSmith', major: "Math" } },
        { line: 4, endLine: 4, data: { name: "Bob", major: "CS" } },
    ]);
});

test("CSV reports every column mismatch using physical lines after multiline records", async () => {
    const result = await csv('name,major\n"Alice\nSmith",Math\nBob\nCharlie,CS,extra\n');
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(error => [error.line, error.endLine]), [[4, 4], [5, 5]]);
    assert.match(result.errors[0].message, /Expected 2 columns, found 1/);
    assert.match(result.errors[1].message, /Expected 2 columns, found 3/);
});

test("CSV ignores blank rows without losing original row positions", async () => {
    const result = await csv('\n\nname,major\n\nAlice,Math\n\nBob\n');
    assert.equal(result.ok, false);
    assert.equal(result.sheets[0].rows[0].line, 5);
    assert.equal(result.errors[0].line, 7);
});

test("CSV reports empty and duplicate headers at their actual columns", async () => {
    const result = await csv('name,,name\nAlice,Math,Smith');
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(error => [error.line, error.column]), [[1, 2], [1, 3]]);
});

test("CSV preserves earlier errors and reports the range of an unclosed quoted record", async () => {
    const result = await csv('name,major\nBob\n"Alice\nSmith,CS');
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.line === 2 && /Expected 2/.test(error.message)));
    assert.ok(result.errors.some(error => error.line === 3 && error.endLine === 4 && /not closed/.test(error.message)));
});

test("CRLF quote errors retain exact physical line ranges after multiline records", async () => {
    const unclosed = await csv('name,major\r\n"Alice\r\nSmith",Math\r\n"Bob\r\nJones,CS');
    assert.ok(unclosed.errors.some(error => error.line === 4 && error.endLine === 5 && /not closed/.test(error.message)));
    const invalidQuote = await csv('name,major\r\n"Alice\r\nSmith",Math\r\n"Bob"oops,CS\r\nCharlie,Math');
    assert.ok(invalidQuote.errors.some(error => error.line === 4 && error.endLine === 4 && /Invalid closing quote/.test(error.message)));
});

test("empty, header-only, unsupported and non-UTF-8 CSV inputs never succeed", async () => {
    for (const text of ["", "\n\n", "name,major\n"]) {
        assert.equal((await csv(text)).ok, false);
    }
    assert.equal((await csv("name\nAlice", "members.txt")).ok, false);
    assert.equal((await parseFile(Buffer.from([0xff, 0xfe, 0xfd]), "members.csv")).ok, false);
});

test("XLSX keeps worksheet row numbers, zero/false values and empty trailing cells", async () => {
    const result = await xlsx(workbook => {
        const sheet = workbook.addWorksheet("Members");
        sheet.getRow(2).values = ["name", "count", "active", "major"];
        sheet.getRow(5).values = ["Alice", 0, false];
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.sheets[0].rows, [{
        line: 5, endLine: 5,
        data: { name: "Alice", count: 0, active: false, major: null },
    }]);
});

test("XLSX validates every worksheet and reports error cells and extra columns", async () => {
    const result = await xlsx(workbook => {
        const first = workbook.addWorksheet("Members");
        first.addRow(["name", "major"]);
        first.getRow(6).values = ["Alice", { error: "#VALUE!" }];
        const second = workbook.addWorksheet("Alumni");
        second.addRow(["name", "major"]);
        second.getRow(9).values = ["Bob", "CS", "extra"];
        workbook.addWorksheet("Unused");
    });
    assert.equal(result.ok, false);
    assert.equal(result.sheets.length, 2);
    assert.ok(result.errors.some(error => error.sheet === "Members" && error.line === 6 && error.column === 2));
    assert.ok(result.errors.some(error => error.sheet === "Alumni" && error.line === 9));
});

test("XLSX reports formulas without saved results and handles rich text and cached results", async () => {
    const result = await xlsx(workbook => {
        const sheet = workbook.addWorksheet("Members");
        sheet.addRow(["name", "count"]);
        sheet.addRow([{ richText: [{ text: "Alice" }] }, { formula: "1+1", result: 2 }]);
        sheet.getRow(7).values = ["Bob", { formula: "1+2" }];
    });
    assert.equal(result.ok, false);
    assert.equal(result.sheets[0].rows[0].data.name, "Alice");
    assert.equal(result.sheets[0].rows[0].data.count, 2);
    assert.ok(result.errors.some(error => error.line === 7 && /without a saved result/.test(error.message)));
});

test("XLSX reports corrupt files without inventing row numbers and accepts .xslx spelling", async () => {
    const corrupt = await parseFile(Buffer.from("not a workbook"), "members.xlsx");
    assert.equal(corrupt.ok, false);
    assert.equal(corrupt.errors[0].line, undefined);
    const valid = await xlsx(workbook => {
        const sheet = workbook.addWorksheet("Members");
        sheet.addRow(["name"]);
        sheet.addRow(["Alice"]);
    }, "MEMBERS.XSLX");
    assert.equal(valid.ok, true);
});

test("member schema requires the supplied columns and accepts common header spellings", async () => {
    const headers = 'Full_Name,Email Address,Phone,Pledge Class,Major,Graduation Year,"positions they have held, and which ones",Family_Line,Nickname,Status,LinkedIn URL';
    const result = await parseFile(Buffer.from(headers + "\n" + validMember), "members.csv", { schema: memberFileSchema });
    assert.equal(result.ok, true);
    assert.equal(result.sheets[0].rows[0].data["positions held"], "President");
    const missing = await parseFile(Buffer.from("name\nAlice"), "members.csv", { schema: memberFileSchema });
    assert.equal(missing.ok, false);
    assert.equal(missing.errors.length, 10);
    assert.ok(missing.errors.every(error => error.line === 1 && /Missing required column/.test(error.message)));
});

test("member validation reports each invalid field on its original line and column", async () => {
    const row = ",bad-email,not-a-phone,Alpha,Math,20xx,,,Active,Active,https://linkedin.com.evil.example/in/alice";
    const result = await parseFile(Buffer.from(memberHeaders + "\n" + row), "members.csv", { schema: memberFileSchema });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(error => [error.line, error.column]), [[2, 1], [2, 2], [2, 3], [2, 6], [2, 11]]);
});

test("member schema permits blank optional values and unlisted class or status labels", async () => {
    const result = await parseFile(Buffer.from(memberHeaders + "\nAlice,,,New Class,,,,,,Custom Status,"), "members.csv", { schema: memberFileSchema });
    assert.equal(result.ok, true);
});

test("member XLSX validation returns original sheet/row/column coordinates", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Brothers");
    sheet.addRow(memberHeaders.split(","));
    sheet.getRow(8).values = ["Alice", "invalid", 3125551234, "Alpha", "Math", 2028];
    const result = await parseFile(Buffer.from(await workbook.xlsx.writeBuffer()), "members.xlsx", { schema: memberFileSchema });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors.map(error => [error.sheet, error.line, error.column]), [["Brothers", 8, 2]]);
});

test("intake returns parsed data to the router without sending a reply", async t => {
    t.mock.method(globalThis, "fetch", async () => new Response(memberHeaders + "\n" + validMember));
    const save = t.mock.method(database, "addMembers", async members => ({ added: members.length }));
    const msg = message([attachment()]);
    const response = await fileIntakeCommand.execute(msg);
    assert.equal(response.type, "fileIntake");
    assert.equal(response.files[0].ok, true);
    assert.equal(response.files[0].sheets[0].rows[0].data.name, "Alice");
    assert.deepEqual(msg.replies, []);
    await routeResponse(msg, response);
    assert.deepEqual(save.mock.calls[0].arguments[0], response.files[0].sheets[0].rows.map(row => row.data));
    assert.match(msg.replies[0].content, /Imported members\.csv successfully \(1 record saved\)/);
});

test("missing, unsupported and oversized attachments return errors without downloading", async t => {
    const download = t.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected download"); });
    const noFile = await fileIntakeCommand.execute(message());
    assert.match(noFile.message, /Attach a \.csv or \.xlsx/);
    for (const file of [attachment("members.pdf"), { ...attachment(), size: 10 * 1024 * 1024 + 1 }]) {
        const response = await fileIntakeCommand.execute(message([file]));
        assert.equal(response.files[0].ok, false);
    }
    assert.equal(download.mock.callCount(), 0);
});

test("HTTP errors and timeouts return file failures rather than confirmations", async t => {
    const download = t.mock.method(globalThis, "fetch", async () => new Response("gone", { status: 404 }));
    let response = await fileIntakeCommand.execute(message([attachment()]));
    assert.match(response.files[0].errors[0].message, /HTTP 404/);
    download.mock.mockImplementation(async () => { throw new DOMException("Timed out", "TimeoutError"); });
    response = await fileIntakeCommand.execute(message([attachment()]));
    assert.match(response.files[0].errors[0].message, /timed out/);
});

test("download byte limit is enforced even when attachment metadata understates its size", async t => {
    t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(new Uint8Array(10 * 1024 * 1024));
            controller.enqueue(new Uint8Array(1));
            controller.close();
        },
    })));
    const result = await fileIntakeCommand.execute(message([attachment()]));
    assert.equal(result.files[0].ok, false);
    assert.match(result.files[0].errors[0].message, /10 MB/);
});

test("multiple attachments are processed independently without hiding another file's errors", async t => {
    t.mock.method(globalThis, "fetch", async () => new Response(memberHeaders + "\n" + validMember));
    const result = await fileIntakeCommand.execute(message([attachment(), attachment("notes.pdf")]));
    assert.equal(result.files.length, 2);
    assert.equal(result.files[0].ok, true);
    assert.equal(result.files[1].ok, false);
});

test("mention command downloads and reports parser errors through the router", async t => {
    t.mock.method(globalThis, "fetch", async () => new Response("name,major\nAlice\nBob,CS,extra"));
    const msg = message([attachment()]);
    await handleMentionCommand(msg, { user: { id: "123" } });
    const content = msg.replies.map(reply => reply.content).join("\n");
    assert.match(content, /Line 2: Expected 2 columns, found 1/);
    assert.match(content, /Line 3: Expected 2 columns, found 3/);
    assert.doesNotMatch(content, /successfully/);
});

test("router includes every error across replies within Discord limits and disables mentions", async () => {
    const msg = message();
    const errors = Array.from({ length: 120 }, (_, i) => ({
        sheet: "Members", line: i + 2, message: "Unexpected data " + "x".repeat(50),
    }));
    await routeResponse(msg, {
        type: "fileIntake",
        files: [{ fileName: "members.xlsx", ok: false, errors }],
    });
    assert.ok(msg.replies.length > 1);
    for (const reply of msg.replies) {
        assert.ok(reply.content.length <= 2000);
        assert.deepEqual(reply.allowedMentions, { parse: [], repliedUser: false });
    }
    const report = msg.replies.map(reply => reply.content).join("\n");
    for (const error of errors) {
        assert.ok(report.includes(`Row ${error.line}:`));
    }
});

test("existing /test command still replies exactly once", async () => {
    const msg = message([], "<@123> /test");
    await handleMentionCommand(msg, { user: { id: "123" } });
    assert.deepEqual(msg.replies, ["bot is online"]);
});
