const {
    loadConfig,
} = require("../../config");

const config = loadConfig();

module.exports = {
    name: "/backend",

    async execute(
        message,
        client,
        backend,
        args,
        backendControls
    ) {
        // Restrict backend management to the bot owner.
        if (message.author.id !== config.botOwnerId) {
            await message.reply(
                "You are not authorized to manage the backend connection."
            );
            return;
        }

        if (!backendControls) {
            throw new Error("Backend controls are unavailable");
        }

        const {
            enableBackend,
            disableBackend,
            getBackendStatus,
        } = backendControls;

        const action = args[0]?.toLowerCase();

        switch (action) {
            case "enable": {
                const status = enableBackend();

                await message.reply(
                    status.connected
                        ? "Backend connection enabled and connected."
                        : "Backend connection enabled. Attempting to connect..."
                );
                break;
            }

            case "disable": {
                disableBackend();

                await message.reply(
                    "Backend connection disabled. Automatic reconnection stopped."
                );
                break;
            }

            case "status": {
                const status = getBackendStatus();

                await message.reply(
                    "**Backend Connection Status**\n" +
                    `Enabled: ${status.enabled ? "Yes" : "No"}\n` +
                    `Connected: ${status.connected ? "Yes" : "No"}\n` +
                    `Reconnecting: ${status.reconnecting ? "Yes" : "No"}`
                );
                break;
            }

            default:
                await message.reply(
                    "Usage:\n" +
                    "`@Internship Job Bot /backend enable`\n" +
                    "`@Internship Job Bot /backend disable`\n" +
                    "`@Internship Job Bot /backend status`"
                );
        }
    },
};