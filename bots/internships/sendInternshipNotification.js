const { EmbedBuilder } = require("discord.js");

const {
    sendMessage,
} = require("../../shared/discord/sendMessage");

const {
    formatInternshipDate,
} = require("./services/internshipDateFormatter");

const {
    createInternshipId,
} = require("./services/internshipFilter");

const sendInternship = require("./api/sendInternship");

const {
    logError,
} = require("../../shared/utils/logger");

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
 * @param {{title?: string, description?: string}} [options]
 * @returns {EmbedBuilder}
 */
function buildInternshipEmbed(
    internships,
    {
        title = "Top Internship Openings",
        description = "Here are the newest available internship listings.",
    } = {}
) {
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
        .setTitle(title)
        .setDescription(description)
        .setTimestamp()
        .setFooter({
            text: "Summer 2027 Internship Bot",
        });

    internships.forEach((internship, index) => {
        const location =
            internship.location || "Location not provided";

        const datePosted =
            formatInternshipDate(internship);

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
 * @param {{title?: string, description?: string}} [options]
 * @param {object} backend
 * @returns {Promise<import("discord.js").Message>}
 */
async function sendInternshipNotification(
    client,
    channelId,
    internships,
    options = {},
    backend
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

    const embed = buildInternshipEmbed(internships, options);

    if (options.title !== "Random Previously Posted Internships") {
        const uploadResults = await Promise.allSettled(
            internships.map((internship) =>
                sendInternship(backend, {
                    ...internship,
                    id: createInternshipId(internship),
                })
            )
        );

        uploadResults.forEach((result, index) => {
            if (result.status === "rejected") {
                logError(
                    `Failed to upload internship ${createInternshipId(internships[index])}; continuing Discord notification.`,
                    result.reason
                );
            }
        });
    }

    return sendMessage(client, channelId, {
        embeds: [embed],
    });
}

module.exports = {
    buildInternshipEmbed,
    sendInternshipNotification,
};
