const {
    AttachmentBuilder,
} = require("discord.js");

const {
    readSentInternships,
} = require("./runInternshipDigest");

/**
 * Sends saved internship history to the requesting
 * Discord user as a JSON file.
 *
 * @param {object} options
 * @param {import("discord.js").Message} options.message
 * @param {(internship: object) => boolean} [options.filter]
 * @param {string} options.fileName
 * @param {string} options.title
 * @param {string} options.emptyMessage
 * @returns {Promise<Array<object>>}
 */
async function sendSavedInternships({
    message,
    filter,
    fileName,
    title,
    emptyMessage,
}) {
    const sentInternships =
        await readSentInternships();

    const selectedInternships =
        typeof filter === "function"
            ? sentInternships.filter(filter)
            : sentInternships;

    if (selectedInternships.length === 0) {
        await message.reply(emptyMessage);
        return [];
    }

    const json = JSON.stringify(
        selectedInternships,
        null,
        2
    );

    const attachment = new AttachmentBuilder(
        Buffer.from(json, "utf8"),
        {
            name: fileName,
        }
    );

    try {
        await message.author.send({
            content: [
                `**${title}**`,
                "",
                `Internships: ${selectedInternships.length}`,
            ].join("\n"),
            files: [attachment],
        });

        await message.reply(
            "I sent the internship file to you in a DM."
        );
    } catch (error) {
        if (error.code === 50007) {
            await message.reply(
                "I couldn't DM you. Make sure you allow direct messages from members of this server."
            );

            return [];
        }

        throw error;
    }

    return selectedInternships;
}

module.exports = {
    sendSavedInternships,
};