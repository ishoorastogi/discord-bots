const {
    getCurrentCEInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    formatInternshipDate,
} = require("../internshipDateFormatter");

async function execute(message) {
    const ceInternships =
        await getCurrentCEInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(ceInternships, 5);

    if (internshipsToSend.length === 0) {
        await message.reply(
            "No current Computer Engineering internships were found."
        );
        return;
    }

    const response = [
        "**Top 5 Computer Engineering Internships**",
        "",
        ...internshipsToSend.map(
            (internship, index) =>
                [
                    `**${index + 1}. ${internship.company}**`,
                    internship.role,
                    `📍 ${internship.location}`,
                    `📅 ${formatInternshipDate(internship)}`,
                    `[Apply Here](${internship.applicationUrl})`,
                ].join("\n")
        ),
    ].join("\n\n");

    await message.reply(response);

    await saveShownInternships({
        internshipsToSend,
        sentInternships,
        sentIds,
    });
}

module.exports = {
    name: "/ce",
    execute,
};
