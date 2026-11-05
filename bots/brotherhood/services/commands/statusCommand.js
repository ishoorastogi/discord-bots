async function execute(message, client) {
    // Startup loads the database after the bot's environment variables are available.
    const { getDatabaseStatus } = require("../../db");
    const { state } = getDatabaseStatus();
    const databaseStatus = state[0].toUpperCase() + state.slice(1);

    await message.reply(
        [
            "**Brotherhood Bot Status**",
            "",
            `Bot: ${client.isReady() ? "Online" : "Offline"}`,
            "Cache: Not implemented",
            `Database: ${databaseStatus}`,
        ].join("\n")
    );
}

module.exports = { name: "/status", execute };
