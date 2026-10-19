const { test } = require("node:test");
const { assert, mock, load, bot, job, message, called, fixtureConfig } = require("./helpers/unit");
const commandsDirectory = bot + "services/commands/";

for (const [name, field, title] of [
    ["cs", "CS", "Computer Science"], ["me", "ME", "Mechanical Engineering"],
    ["ee", "EE", "Electrical Engineering"], ["bm", "BM", "Biomedical Engineering"],
    ["ce", "CE", "Computer Engineering"],
]) {
    test(`/${name} replies with ranked listings, records successful sends and handles no results`, async () => {
        for (const empty of [false, true]) {
            const internships = empty ? [] : [job()];
            const result = { internshipsToSend: internships, sentInternships: [], sentIds: new Set() };
            const current = mock.fn(async () => internships);
            const select = mock.fn(async () => result);
            const save = mock.fn(async () => {});
            const command = load(commandsDirectory + name + "Command.js", {
                [bot + "services/getCurrentInternships.js"]: { [`getCurrent${field}Internships`]: current },
                [bot + "services/runInternshipDigest.js"]: { getInternshipsToSend: select, saveShownInternships: save },
            });
            const msg = message();
            await command.execute(msg);
            assert.equal(command.name, "/" + name);
            assert.equal(current.mock.callCount(), 1);
            called(select, internships, 5);
            const response = msg.reply.mock.calls[0].arguments[0];
            assert.ok(response.includes(title));
            if (empty) {
                assert.match(response, /No current/);
                assert.equal(save.mock.callCount(), 0);
            } else {
                assert.match(response, /Acme/);
                assert.match(response, /Apply Here/);
                assert.match(response, /Aug 22/);
                called(save, result);
                msg.reply.mock.mockImplementation(async () => { throw new Error("reply failed"); });
                await assert.rejects(command.execute(msg), /reply failed/);
                assert.equal(save.mock.callCount(), 1, "failed sends must not update history");
            }
        }
    });
}

for (const name of ["help", "future"]) {
    test(`/${name} returns its help text`, async () => {
        const command = load(commandsDirectory + name + "Command.js");
        const msg = message();
        await command.execute(msg);
        assert.equal(command.name, "/" + name);
        assert.match(msg.reply.mock.calls[0].arguments[0], /\/cs|\/latest/);
    });
}

test("/latest limits results to five and reports empty results", async () => {
    let internships = Array.from({ length: 6 }, (_, index) => job({ id: String(index), company: `Company ${index}`, location: "" }));
    const command = load(commandsDirectory + "latestCommand.js", {
        [bot + "services/getCurrentInternships.js"]: { getCurrentInternships: async () => internships },
    });
    const msg = message();
    await command.execute(msg);
    let response = msg.reply.mock.calls.at(-1).arguments[0];
    assert.match(response, /5 Latest/);
    assert.match(response, /Company 4/);
    assert.doesNotMatch(response, /Company 5/);
    assert.match(response, /Location not provided/);
    internships = [];
    await command.execute(msg);
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /No current/);
});

test("/random shuffles a copy, limits to five, and handles empty history", async (t) => {
    t.mock.method(Math, "random", () => 0);
    let internships = Array.from({ length: 6 }, (_, index) => job({ id: String(index), company: `Company ${index}` }));
    const original = structuredClone(internships);
    const command = load(commandsDirectory + "randomCommand.js", {
        [bot + "services/runInternshipDigest.js"]: { readSentInternships: async () => internships },
    });
    const msg = message();
    await command.execute(msg);
    const response = msg.reply.mock.calls.at(-1).arguments[0];
    assert.match(response, /Random Previously/);
    assert.equal((response.match(/Apply Here/g) || []).length, 5);
    assert.deepEqual(internships, original);
    internships = [];
    await command.execute(msg);
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /No previously sent/);
});

test("/status reports configuration, sent count, startup flag and muted state", async () => {
    let enabled = true;
    const backend = {
        getStatus: mock.fn(() => ({
            enabled: true,
            connected: true,
            reconnecting: false
        }))
    };
    const command = load(commandsDirectory + "statusCommand.js", {
        [bot + "config.js"]: { loadConfig: () => ({ ...fixtureConfig, runOnStartup: enabled }) },
        [bot + "services/botState.js"]: { isMuted: async () => enabled },
        [bot + "services/runInternshipDigest.js"]: { readSentInternships: async () => [job()] },
    });
    const msg = message();
    for (const value of [true, false]) {
        enabled = value;
        await command.execute(msg, {}, backend);
        const response = msg.reply.mock.calls.at(-1).arguments[0];
        assert.match(response, /Schedule: 0 8 \* \* \*/);
        assert.match(response, /Timezone: America\/Chicago/);
        assert.match(response, /Previously sent internships: 1/);
        assert.ok(response.includes(`Run on startup: ${value ? "Yes" : "No"}`));
        assert.ok(response.includes(`Is Muted: ${value ? "Yes" : "No"}`));
        assert.match(response, /owner\/repo/);
        assert.match(response, /Backend: Enabled/);
    }
});

for (const name of ["clear", "mute", "unmute", "kill"]) {
    test(`/${name} requires the owner and performs its authorized action`, async (t) => {
        const original = process.env.BOT_OWNER_ID;
        t.after(() => {
            if (original === undefined) delete process.env.BOT_OWNER_ID;
            else process.env.BOT_OWNER_ID = original;
        });
        const write = mock.fn(async () => {});
        const setMuted = mock.fn(async () => {});
        const exit = t.mock.method(process, "exit", () => {});
        const destroy = mock.fn();
        const command = load(commandsDirectory + name + "Command.js", {
            [bot + "services/runInternshipDigest.js"]: { writeSentInternships: write },
            [bot + "services/botState.js"]: { setMuted },
        });
        const msg = message();
        for (const owner of [undefined, "somebody-else"]) {
            if (owner === undefined) delete process.env.BOT_OWNER_ID;
            else process.env.BOT_OWNER_ID = owner;
            await command.execute(msg, { destroy });
            assert.match(msg.reply.mock.calls.at(-1).arguments[0], /permission/);
            assert.equal(write.mock.callCount() + setMuted.mock.callCount() + destroy.mock.callCount() + exit.mock.callCount(), 0);
        }
        process.env.BOT_OWNER_ID = "owner";
        await command.execute(msg, { destroy });
        if (name === "clear") called(write, []);
        if (name === "mute" || name === "unmute") called(setMuted, name === "mute");
        if (name === "kill") {
            assert.equal(destroy.mock.callCount(), 1);
            called(exit, 0);
        }
    });
}

for (const [file, fileName] of [["sendMeAll", "sentInternships.json"], ["sendmecs", "sentCSInternships.json"]]) {
    test(`/${file.toLowerCase()} delegates the correct history export and filter`, async () => {
        const send = mock.fn(async () => {});
        const command = load(commandsDirectory + file + "Command.js", {
            [bot + "services/sendSavedInternships.js"]: { sendSavedInternships: send },
        });
        const msg = message();
        await command.execute(msg);
        const options = send.mock.calls[0].arguments[0];
        assert.equal(options.message, msg);
        assert.equal(options.fileName, fileName);
        assert.ok(options.title && options.emptyMessage);
        if (file === "sendmecs") {
            assert.equal(options.filter(job()), true);
            assert.equal(options.filter(job({ role: "Accounting Intern" })), false);
        }
    });
}

test("/resume validates name/attachment and reports backend confirmations and failures", async (t) => {
    t.mock.method(console, "error", () => {});
    const upload = mock.fn(async () => "request-id");
    const command = load(commandsDirectory + "resumeCommand.js", { [bot + "api/sendResume.js"]: upload });
    const msg = message();
    const backend = {};
    await command.execute(msg, {}, backend, []);
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /Usage/);
    await command.execute(msg, {}, backend, ["John"]);
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /attach/);
    assert.equal(upload.mock.callCount(), 0);
    const attachment = { name: "resume.pdf" };
    msg.attachments.first = () => attachment;
    await command.execute(msg, {}, backend, ["John", "Smith"]);
    called(upload, backend, attachment, "John Smith", "owner");
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /request-id/);
    upload.mock.mockImplementation(async () => { throw new Error("backend offline"); });
    await command.execute(msg, {}, backend, ["John"]);
    assert.match(msg.reply.mock.calls.at(-1).arguments[0], /backend offline/);
});

test("command registry contains every command with unique names and callable handlers", () => {
    const { commands, commandMap } = load(commandsDirectory + "index.js");
    assert.equal(commands.length, 18);
    assert.equal(commandMap.size, commands.length);
    for (const command of commands) {
        assert.equal(typeof command.execute, "function");
        assert.equal(commandMap.get(command.name), command);
    }
});

test("mention routing ignores bots/nonmentions, normalizes commands, forwards arguments and handles errors", async () => {
    const execute = mock.fn(async () => {});

    const { handleMentionCommand } = load(
        commandsDirectory + "handleMentionCommand.js",
        {
            [commandsDirectory + "index.js"]: {
                commandMap: new Map([
                    ["/resume", { execute }]
                ])
            },
        }
    );

    const client = {
        user: { id: "123" }
    };

    const backend = {};

    const backendControls = {
        enableBackend: mock.fn(),
        disableBackend: mock.fn(),
        getBackendStatus: mock.fn(() => ({
            enabled: true,
            connected: true,
            reconnecting: false
        }))
    };

    const msg = message({
        content: "<@!123> /RESUME John Smith"
    });

    // Test 1: Ignore bot messages
    msg.author.bot = true;

    await handleMentionCommand(
        msg,
        client,
        backend,
        backendControls
    );

    // Test 2: Ignore messages without mentions
    msg.author.bot = false;
    msg.mentions.has = () => false;

    await handleMentionCommand(
        msg,
        client,
        backend,
        backendControls
    );

    assert.equal(
        execute.mock.callCount() + msg.reply.mock.callCount(),
        0
    );

    // Test 3: Route valid commands
    msg.mentions.has = user => user === client.user;

    await handleMentionCommand(
        msg,
        client,
        backend,
        backendControls
    );

    called(
        execute,
        msg,
        client,
        backend,
        ["John", "Smith"],
        backendControls
    );

    // Test 4: Handle unknown commands
    msg.content = "<@123> /unknown";

    await handleMentionCommand(
        msg,
        client,
        backend,
        backendControls
    );

    assert.match(
        msg.reply.mock.calls.at(-1).arguments[0],
        /Unknown command/
    );

    // Test 5: Handle command execution errors
    msg.content = "<@123> /resume";

    execute.mock.mockImplementation(async () => {
        throw new Error("failure");
    });

    await handleMentionCommand(
        msg,
        client,
        backend,
        backendControls
    );

    assert.match(
        msg.reply.mock.calls.at(-1).arguments[0],
        /Something went wrong/
    );
});
