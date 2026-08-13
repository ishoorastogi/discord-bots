const {
    logInfo,
} = require("../../../../shared/utils/logger");

async function execute(message, client) {
    const ownerId = process.env.BOT_OWNER_ID;

    if (!ownerId || message.author.id !== ownerId) {
        await message.reply(
            "You do not have permission to use this command."
        );
        return;
    }

    await message.reply(
        "Shutting down Internship Job Bot."
    );

    logInfo(
        `Shutdown requested by ${message.author.tag}.`
    );

    client.destroy();

    process.exit(0);
}

module.exports = {
    name: "/kill",
    execute,
};