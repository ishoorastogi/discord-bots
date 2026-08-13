const {
    setMuted,
} = require("../botState");

const {
    logInfo,
} = require("../../../../shared/utils/logger");

async function execute(message) {
    const ownerId = process.env.BOT_OWNER_ID;

    if (!ownerId || message.author.id !== ownerId) {
        await message.reply(
            "You do not have permission to use this command."
        );
        return;
    }

    await setMuted(false);

    logInfo(
        `Internship digest unmuted by ${message.author.tag}.`
    );

    await message.reply(
        "Internship digest unmuted. Automatic internship messages are enabled."
    );
}

module.exports = {
    name: "/unmute",
    execute,
};