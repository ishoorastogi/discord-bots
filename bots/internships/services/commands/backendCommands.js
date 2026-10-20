const {
    loadConfig,
} = require("../../config");

const config = loadConfig();

// Tracks a pending confirmation from a manual /backend enable command.
let pendingConfirmation = null;

function clearPendingConfirmation() {
    if (!pendingConfirmation) {
        return;
    }

    const {
        backend,
        listener,
        timeout
    } = pendingConfirmation;

    clearTimeout(timeout);
    backend.off("connected", listener);

    pendingConfirmation = null;
}

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
                const currentStatus = getBackendStatus();

                // Avoid registering duplicate listeners.
                if (currentStatus.enabled) {
                    await message.reply(
                        currentStatus.connected
                            ? "Backend is already enabled and connected."
                            : "Backend is already enabled and attempting to connect."
                    );
                    break;
                }

                // Clear any confirmation from an earlier command.
                clearPendingConfirmation();

                const listener = async () => {
                    clearPendingConfirmation();

                    try {
                        await message.reply(
                            "✅ Backend connected successfully."
                        );
                    } catch (error) {
                        console.error(
                            "[Backend Command] Failed to send connection confirmation:",
                            error
                        );
                    }
                };

                // Register before enabling so we don't miss the event.
                backend.once("connected", listener);

                const timeout = setTimeout(() => {
                    clearPendingConfirmation();
                }, 60000);

                pendingConfirmation = {
                    backend,
                    listener,
                    timeout
                };

                try {
                    const status = enableBackend();

                    if (status.connected) {
                        clearPendingConfirmation();

                        await message.reply(
                            "Backend connection enabled and connected."
                        );
                    } else {
                        await message.reply(
                            "Backend connection enabled. Attempting to connect..."
                        );
                    }
                } catch (error) {
                    clearPendingConfirmation();
                    throw error;
                }

                break;
            }

            case "disable": {
                // Cancel any outstanding manual connection confirmation.
                clearPendingConfirmation();

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