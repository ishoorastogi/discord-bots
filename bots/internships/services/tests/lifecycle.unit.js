const { test } = require("node:test");
const {
    assert,
    mock,
    load,
    bot,
    job,
    fixtureConfig,
    logger,
    called
} = require("./helpers/unit");

test("entry point wires login, backend connection, ready/scheduled digests, mentions and error handlers", async () => {
    const listeners = new Map();
    const readyListeners = new Map();

    const client = {
        once: (event, callback) => readyListeners.set(event, callback),
        on: (event, callback) => listeners.set(event, callback),
        login: mock.fn(),
    };

    const schedule = mock.fn();
    const mentions = mock.fn(async () => {});
    const digest = mock.fn(async () => [job()]);

    let muted = false;
    let backend;

    // Backend connection mocks
    const connect = mock.fn();
    const enable = mock.fn();
    const disconnect = mock.fn();

    const getStatus = mock.fn(() => ({
        enabled: true,
        connected: true,
        reconnecting: false
    }));

    // Persistent backend state mocks
    const getBackendEnabled = mock.fn(() => true);
    const setBackendEnabled = mock.fn();

    class Backend {
        constructor(host, port, enabled) {
            assert.equal(host, fixtureConfig.backend.host);
            assert.equal(port, fixtureConfig.backend.port);
            assert.equal(enabled, true);

            backend = this;
        }

        connect() {
            connect();
        }

        enable() {
            enable();
        }

        disconnect() {
            disconnect();
        }

        getStatus() {
            return getStatus();
        }
    }

    load(bot + "index.js", {
        "node-cron": { schedule },

        [bot + "api/backendClient.js"]: Backend,

        [bot + "services/backendState.js"]: {
            getBackendEnabled,
            setBackendEnabled
        },

        "shared/discord/createClient.js": {
            createClient: () => client
        },

        [bot + "services/botState.js"]: {
            isMuted: async () => muted
        },

        [bot + "services/commands/handleMentionCommand.js"]: {
            handleMentionCommand: mentions
        },

        [bot + "services/runInternshipDigest.js"]: {
            runInternshipDigest: digest
        },
    });

    // Verify backend startup
    assert.equal(getBackendEnabled.mock.callCount(), 1);
    assert.equal(connect.mock.callCount(), 1);

    // Verify Discord login
    called(client.login, fixtureConfig.discordToken);

    const { Events } = require("discord.js");

    // Simulate Discord ready event
    await readyListeners.get(Events.ClientReady)({
        user: { tag: "test-bot" }
    });

    // Verify startup digest
    assert.equal(digest.mock.callCount(), 1);

    called(digest, {
        client,
        channelId: fixtureConfig.internshipChannelId,
        limit: 5
    });

    // Verify cron scheduling
    const [expression, callback, options] =
        schedule.mock.calls[0].arguments;

    assert.equal(expression, fixtureConfig.cronSchedule);

    assert.deepEqual(options, {
        timezone: fixtureConfig.timezone
    });

    // Verify muted digest is skipped
    muted = true;

    await callback();

    assert.equal(digest.mock.callCount(), 1);

    // Verify digest errors are handled
    muted = false;

    digest.mock.mockImplementation(async () => {
        throw new Error("digest failed");
    });

    await callback();

    assert.equal(
        logger.logError.mock.calls.at(-1).arguments[0],
        "Failed to run internship digest"
    );

    // Verify Discord client errors are handled
    const failure = new Error("Discord error");

    listeners.get("error")(failure);

    called(
        logger.logError,
        "Discord client error",
        failure
    );

    // Verify mention routing
    const message = {
        channelId: fixtureConfig.internshipChannelId
    };

    await listeners.get(Events.MessageCreate)(message);

    assert.equal(mentions.mock.callCount(), 1);

    const [
        receivedMessage,
        receivedClient,
        receivedBackend,
        backendControls
    ] = mentions.mock.calls[0].arguments;

    assert.equal(receivedMessage, message);
    assert.equal(receivedClient, client);
    assert.equal(receivedBackend, backend);

    // Verify backend controls are passed to the command handler
    assert.equal(
        typeof backendControls.enableBackend,
        "function"
    );

    assert.equal(
        typeof backendControls.disableBackend,
        "function"
    );

    assert.equal(
        typeof backendControls.getBackendStatus,
        "function"
    );

    // Verify disabling the backend
    const disabledStatus = backendControls.disableBackend();

    called(setBackendEnabled, false);

    assert.equal(disconnect.mock.callCount(), 1);

    assert.deepEqual(
        disabledStatus,
        getStatus()
    );

    // Verify enabling the backend
    const enabledStatus = backendControls.enableBackend();

    called(setBackendEnabled, true);

    assert.equal(enable.mock.callCount(), 1);

    assert.deepEqual(
        enabledStatus,
        getStatus()
    );

    // Verify backend status retrieval
    const status = backendControls.getBackendStatus();

    assert.deepEqual(
        status,
        getStatus()
    );

    // Verify persistent state was updated twice
    assert.equal(setBackendEnabled.mock.callCount(), 2);
});

test("startup digest can be disabled while the schedule is still registered", async () => {
    let ready;

    const digest = mock.fn(async () => []);
    const schedule = mock.fn();

    load(bot + "index.js", {
        "node-cron": { schedule },

        [bot + "config.js"]: {
            loadConfig: () => ({
                ...fixtureConfig,
                runOnStartup: false
            })
        },

        [bot + "api/backendClient.js"]: class {
            connect() {}
        },

        [bot + "services/backendState.js"]: {
            getBackendEnabled: () => true,
            setBackendEnabled: () => {}
        },

        "shared/discord/createClient.js": {
            createClient: () => ({
                once: (event, callback) => {
                    ready = callback;
                },
                on() {},
                login() {}
            })
        },

        [bot + "services/runInternshipDigest.js"]: {
            runInternshipDigest: digest
        },

        [bot + "services/commands/handleMentionCommand.js"]: {
            handleMentionCommand() {}
        },
    });

    await ready({
        user: { tag: "test-bot" }
    });

    assert.equal(schedule.mock.callCount(), 1);
    assert.equal(digest.mock.callCount(), 0);
});

test("backend starts with the saved disabled state", () => {
    const client = {
        once() {},
        on() {},
        login: mock.fn()
    };

    const connect = mock.fn();
    const getBackendEnabled = mock.fn(() => false);

    let receivedEnabled;

    class Backend {
        constructor(host, port, enabled) {
            assert.equal(host, fixtureConfig.backend.host);
            assert.equal(port, fixtureConfig.backend.port);

            receivedEnabled = enabled;
        }

        connect() {
            // Simulate the BackendClient guard:
            // connect() does nothing when disabled.
            if (receivedEnabled) {
                connect();
            }
        }
    }

    load(bot + "index.js", {
        "node-cron": {
            schedule: mock.fn()
        },

        [bot + "api/backendClient.js"]: Backend,

        [bot + "services/backendState.js"]: {
            getBackendEnabled,
            setBackendEnabled: mock.fn()
        },

        "shared/discord/createClient.js": {
            createClient: () => client
        },

        [bot + "services/commands/handleMentionCommand.js"]: {
            handleMentionCommand: mock.fn()
        }
    });

    assert.equal(getBackendEnabled.mock.callCount(), 1);
    assert.equal(receivedEnabled, false);
    assert.equal(connect.mock.callCount(), 0);

    called(client.login, fixtureConfig.discordToken);
});

function pollerSetup(
    t,
    boards = [
        {
            boardToken: "acme",
            companyName: "Acme"
        }
    ]
) {
    const send = mock.fn(async () => {});

    const fetch = mock.fn(async () => [
        {
            id: "new",
            company: "Acme",
            role: "Software Engineering Intern",
            location: "Austin, TX",
            url: "https://example.com/apply",
            postedAt: new Date("2026-01-02")
        },
        {
            id: "seen",
            company: "Acme",
            role: "Software Engineering Intern",
            location: "NYC",
            url: "https://example.com/seen"
        },
        {
            id: "foreign",
            role: "Software Engineering Intern",
            location: "Toronto, Canada"
        },
        {
            id: "accounting",
            role: "Accounting Intern",
            location: "NYC"
        }
    ]);

    const store = {
        has: mock.fn(id => id === "seen"),
        markSeen: mock.fn(async () => {})
    };

    const timeouts = t.mock.method(
        global,
        "setTimeout",
        callback => {
            queueMicrotask(callback);
            return 1;
        }
    );

    const InternshipPoller = load(
        bot + "services/internshipPoller.js",
        {
            [bot + "sources/greenhouse.js"]: {
                fetchGreenhouseJobs: fetch
            },

            [bot + "sendInternshipNotification.js"]: {
                sendInternshipNotification: send
            }
        }
    );

    const poller = new InternshipPoller(
        {},
        {
            greenhouseBoards: boards,
            internshipChannelId: "channel",
            pollIntervalMinutes: 5
        },
        store
    );

    return {
        poller,
        send,
        fetch,
        store,
        timeouts
    };
}

test("poller normalizes Greenhouse jobs, skips seen/ineligible jobs, sends and records new jobs", async (t) => {
    const {
        poller,
        send,
        store,
        timeouts
    } = pollerSetup(t);

    await poller.runOnce();

    assert.equal(send.mock.callCount(), 1);

    const [
        client,
        channelId,
        internships
    ] = send.mock.calls[0].arguments;

    assert.equal(client, poller.client);
    assert.equal(channelId, "channel");
    assert.equal(internships[0].id, "new");

    assert.equal(
        internships[0].applicationUrl,
        "https://example.com/apply"
    );

    assert.equal(
        internships[0].datePosted,
        Date.parse("2026-01-02") / 1000
    );

    called(store.markSeen, "new");

    assert.equal(timeouts.mock.callCount(), 1);
    assert.equal(poller.running, false);

    poller.running = true;

    await poller.runOnce();

    assert.equal(send.mock.callCount(), 1);
});

test("poller continues after a board fails and never marks failed deliveries as seen", async (t) => {
    const {
        poller,
        fetch,
        store,
        send
    } = pollerSetup(t, [
        {
            boardToken: "bad",
            companyName: "Bad"
        },
        {
            boardToken: "good",
            companyName: "Good"
        }
    ]);

    fetch.mock.mockImplementation(async token => {
        if (token === "bad") {
            throw new Error("source offline");
        }

        return [
            {
                id: "new",
                role: "Software Intern",
                location: "NYC"
            }
        ];
    });

    send.mock.mockImplementation(async () => {
        throw new Error("send failed");
    });

    await poller.runOnce();

    assert.equal(fetch.mock.callCount(), 2);
    assert.equal(send.mock.callCount(), 1);
    assert.equal(store.markSeen.mock.callCount(), 0);
    assert.equal(poller.running, false);
});

test("poller handles empty boards and start/stop are idempotent with the configured interval", async (t) => {
    const {
        poller,
        fetch
    } = pollerSetup(t);

    fetch.mock.mockImplementation(async () => []);

    let callback;

    const set = t.mock.method(
        global,
        "setInterval",
        (fn, milliseconds) => {
            callback = fn;

            assert.equal(milliseconds, 300000);

            return 123;
        }
    );

    const clear = t.mock.method(
        global,
        "clearInterval",
        () => {}
    );

    poller.start();
    poller.start();

    assert.equal(set.mock.callCount(), 1);

    await callback();

    poller.stop();
    poller.stop();

    called(clear, 123);

    assert.equal(clear.mock.callCount(), 1);
    assert.equal(poller.timer, null);
});