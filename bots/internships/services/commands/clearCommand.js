const {
    writeSentInternships,
} = require("../runInternshipDigest");

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

    await writeSentInternships([]);

    logInfo(
        `Internship history cleared by ${message.author.tag}.`
    );

    await message.reply(
        "Internship history has been cleared."
    );
}

module.exports = {
    name: "/clear",
    execute,
};