const { test } = require("node:test");
const { EventEmitter } = require("node:events");
const { assert, mock, load, bot, called } = require("./helpers/unit");

function setup(t) {
    for (const name of ["log", "error", "warn"]) t.mock.method(console, name, () => {});
    const timers = [];
    const cleared = [];
    t.mock.method(global, "setTimeout", (callback, delay) => {
        const timer = { callback, delay };
        timers.push(timer);
        return timer;
    });
    t.mock.method(global, "clearTimeout", timer => cleared.push(timer));
    const sockets = [];
    const net = { createConnection: mock.fn(() => {
        const socket = new EventEmitter();
        socket.setEncoding = mock.fn();
        socket.write = mock.fn();
        socket.destroy = mock.fn(() => socket.emit("close"));
        sockets.push(socket);
        return socket;
    }) };
    const BackendClient = load(bot + "api/backendClient.js", { net });
    const client = new BackendClient("localhost", 8000);
    return { client, net, sockets, timers, cleared };
}

test("TCP connects once, sends a framed PING, handles stream chunks, invalid JSON and errors", (t) => {
    const { client, net, sockets } = setup(t);
    assert.equal(client.send({ event: "PING" }), false);
    client.connect();
    client.connect();
    assert.equal(net.createConnection.mock.callCount(), 1);
    called(net.createConnection, { host: "localhost", port: 8000 });
    const socket = sockets[0];
    called(socket.setEncoding, "utf8");
    socket.emit("connect");
    assert.equal(client.connected, true);
    assert.equal(JSON.parse(socket.write.mock.calls[0].arguments[0]).event, "PING");
    assert.ok(socket.write.mock.calls[0].arguments[0].endsWith("\n"));
    const handle = t.mock.method(client, "handleMessage", () => {});
    socket.emit("data", '\n{bad}\n{"event":"PO');
    socket.emit("data", 'NG"}\n{"event":"OTHER"}\n');
    assert.equal(handle.mock.callCount(), 2);
    called(handle, { event: "OTHER" });
    assert.equal(client.buffer, "");
    socket.emit("error", new Error("network error"));
    socket.write.mock.mockImplementation(() => { throw new Error("write failed"); });
    assert.equal(client.send({ event: "PING" }), false);
    client.disconnect();
    assert.equal(client.connected, false);
    assert.equal(client.socket, null);
    client.connect();
    assert.equal(net.createConnection.mock.callCount(), 1, "stopped clients must not reconnect");
});

test("TCP reconnects after close, rejects pending requests and cancels reconnect on disconnect", async (t) => {
    const { client, sockets, timers, cleared } = setup(t);
    client.connect(); sockets[0].emit("connect");
    const pending = client.sendWithConfirmation({ request_id: "pending" });
    const rejection = assert.rejects(pending, /disconnected before confirmation/);
    sockets[0].emit("close");
    await rejection;
    assert.equal(client.pendingRequests.size, 0);
    const timer = timers.at(-1);
    assert.equal(timer.delay, 10000);
    client.scheduleReconnect();
    assert.equal(timers.at(-1), timer, "only one reconnect timer is scheduled");
    timer.callback();
    assert.equal(sockets.length, 2);
    assert.equal(client.reconnectTimer, null);
    sockets[1].emit("close");
    const reconnect = timers.at(-1);
    client.disconnect();
    assert.ok(cleared.includes(reconnect));
    assert.equal(client.reconnectTimer, null);
    const count = timers.length;
    client.scheduleReconnect();
    assert.equal(timers.length, count);
});

test("TCP request confirmations resolve acceptance, reject refusal and ignore unrelated responses", async (t) => {
    const { client, sockets, cleared } = setup(t);
    await assert.rejects(client.sendWithConfirmation({ request_id: "x" }), /disconnected/);
    client.connect(); sockets[0].emit("connect");
    await assert.rejects(client.sendWithConfirmation({}), /Missing request_id/);
    const pending = client.sendWithConfirmation({ request_id: "one" });
    await assert.rejects(client.sendWithConfirmation({ request_id: "one" }), /Duplicate/);
    const accepted = { event: "UPLOAD_ACCEPTED", request_id: "one" };
    client.handleMessage(accepted);
    assert.equal(await pending, accepted);
    assert.equal(client.pendingRequests.size, 0);
    assert.equal(cleared.length, 1);
    for (const message of ["custom refusal", undefined]) {
        const rejected = client.sendWithConfirmation({ request_id: "two" });
        const assertion = assert.rejects(rejected, message ? /custom refusal/ : /Upload rejected/);
        client.handleMessage({ event: "UPLOAD_REJECTED", request_id: "two", message });
        await assertion;
    }
    client.handleMessage({ event: "UPLOAD_ACCEPTED", request_id: "missing" });
    client.handleMessage({ event: "PONG" });
    client.handleMessage({ event: "UNKNOWN" });
    client.disconnect();
});

test("TCP confirmation timeouts and send failures clean up pending requests", async (t) => {
    const { client, sockets, timers } = setup(t);
    client.connect(); sockets[0].emit("connect");
    const pending = client.sendWithConfirmation({ request_id: "timeout" });
    const rejection = assert.rejects(pending, /timed out/);
    timers.at(-1).callback();
    await rejection;
    assert.equal(client.pendingRequests.size, 0);
    sockets[0].write.mock.mockImplementation(() => { throw new Error("broken socket"); });
    await assert.rejects(client.sendWithConfirmation({ request_id: "failed" }), /Failed to send/);
    assert.equal(client.pendingRequests.size, 0);
    client.disconnect();
});

function resumeSetup(t, chunks = [Buffer.from("%PDF-1.7\nfixture")]) {
    const backend = { connected: true, socket: {}, sendWithConfirmation: mock.fn(async () => ({})) };
    const attachment = { name: "resume.PDF", size: 20, url: "https://example.com/resume.pdf" };
    const fetch = t.mock.method(global, "fetch", async () => ({
        ok: true, body: (async function* () { for (const chunk of chunks) yield chunk; })(),
    }));
    const sendResume = load(bot + "api/sendResume.js", { "node:crypto": { randomUUID: () => "request-id" } });
    return { backend, attachment, fetch, sendResume };
}

test("resume upload validates PDF data, streams chunks and waits for backend confirmation", async (t) => {
    const { backend, attachment, fetch, sendResume } = resumeSetup(t, [Buffer.from("%PDF-"), Buffer.from("1.7\nfixture")]);
    assert.equal(await sendResume(backend, attachment, " John Smith ", "12345"), "request-id");
    assert.equal(fetch.mock.calls[0].arguments[0], attachment.url);
    assert.ok(fetch.mock.calls[0].arguments[1].signal instanceof AbortSignal);
    called(backend.sendWithConfirmation, {
        event: "RESUME_UPLOAD", request_id: "request-id", data: {
            discord_id: "12345", name: "John Smith", filename: "resume.PDF",
            pdf_base64: Buffer.from("%PDF-1.7\nfixture").toString("base64"),
        },
    });
    backend.sendWithConfirmation.mock.mockImplementation(async () => { throw new Error("rejected"); });
    await assert.rejects(sendResume(backend, attachment, "John", "12345"), /rejected/);
});

test("resume validation rejects disconnected backend, invalid names/IDs/files and oversized metadata before fetch", async (t) => {
    const { backend, attachment, fetch, sendResume } = resumeSetup(t);
    for (const [target, file, name, id, error] of [
        [null, attachment, "John", "1", /not connected/],
        [{ connected: true }, attachment, "John", "1", /not connected/],
        [backend, attachment, " ", "1", /Invalid name/],
        [backend, attachment, null, "1", /Invalid name/],
        [backend, attachment, "John", "abc", /Discord ID/],
        [backend, null, "John", "1", /PDF attachments/],
        [backend, { name: "resume.txt" }, "John", "1", /PDF attachments/],
        [backend, { ...attachment, size: 5 * 1024 * 1024 + 1 }, "John", "1", /exceeds/],
    ]) await assert.rejects(sendResume(target, file, name, id), error);
    assert.equal(fetch.mock.callCount(), 0);
});

test("resume download rejects HTTP errors and network errors", async (t) => {
    const { backend, attachment, fetch, sendResume } = resumeSetup(t);
    fetch.mock.mockImplementation(async () => ({ ok: false, status: 403 }));
    await assert.rejects(sendResume(backend, attachment, "John", "1"), /403/);
    fetch.mock.mockImplementation(async () => { throw new Error("timeout"); });
    await assert.rejects(sendResume(backend, attachment, "John", "1"), /timeout/);
    assert.equal(backend.sendWithConfirmation.mock.callCount(), 0);
});

for (const [title, chunks, error] of [
    ["invalid PDF signature", [Buffer.from("hello")], /Invalid PDF/],
    ["empty response", [], /Invalid PDF/],
    ["stream exceeding 5 MB", [Buffer.from("%PDF-"), Buffer.alloc(5 * 1024 * 1024)], /exceeds 5 MB/],
]) {
    test(`resume download rejects ${title}`, async (t) => {
        const { backend, attachment, sendResume } = resumeSetup(t, chunks);
        await assert.rejects(sendResume(backend, attachment, "John", "1"), error);
        assert.equal(backend.sendWithConfirmation.mock.callCount(), 0);
    });
}
