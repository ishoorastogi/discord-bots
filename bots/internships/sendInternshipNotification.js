const { EmbedBuilder } = require("discord.js");

const {
    sendMessage,
} = require("../../shared/discord/sendMessage");

/**
 * Builds a Discord embed containing the selected internships.
 *
 * @param {Array<{
 *   company: string,
 *   role: string,
 *   location: string,
 *   applicationUrl: string,
 *   datePosted: string
 * }>} internships
 * @returns {EmbedBuilder}
 */
function buildInternshipEmbed(internships) {
    if (!Array.isArray(internships)) {
        throw new TypeError(
            "buildInternshipEmbed requires an array of internships."
        );
    }

    if (internships.length === 0) {
        throw new Error(
            "Cannot build an internship notification with no internships."
        );
    }

    const embed = new EmbedBuilder()
        .setTitle("Top Internship Openings")
        .setDescription(
            "Here are the newest available internship listings."
        )
        .setTimestamp()
        .setFooter({
            text: "Summer 2027 Internship Bot",
        });

    internships.forEach((internship, index) => {
        const location =
            internship.location || "Location not provided";

        const datePosted =
            internship.datePosted || "Date not provided";

        embed.addFields({
            name:
                `${index + 1}. ${internship.company} — ` +
                internship.role,
            value:
                `**Location:** ${location}\n` +
                `**Posted:** ${datePosted}\n` +
                `[Apply here](${internship.applicationUrl})`,
        });
    });

    return embed;
}

/**
 * Sends the internship digest to Discord.
 *
 * @param {import("discord.js").Client} client
 * @param {string} channelId
 * @param {Array<object>} internships
 * @returns {Promise<import("discord.js").Message>}
 */
async function sendInternshipNotification(
    client,
    channelId,
    internships
) {
    if (!client) {
        throw new Error(
            "sendInternshipNotification requires a Discord client."
        );
    }

    if (typeof channelId !== "string" || channelId.trim() === "") {
        throw new Error(
            "sendInternshipNotification requires a channel ID."
        );
    }

    const embed = buildInternshipEmbed(internships);

    return sendMessage(client, channelId, {
        embeds: [embed],
    });
}

module.exports = {
    buildInternshipEmbed,
    sendInternshipNotification,
};