const {
    getCurrentCSInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    formatInternshipDate,
} = require("../internshipDateFormatter");

async function execute(message) {
    const csInternships =
        await getCurrentCSInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(csInternships, 5);

    if (internshipsToSend.length === 0) {
        await message.reply(
            "No current Computer Science internships were found."
        );
        return;
    }

    const response = [
        "**Top 5 Computer Science Internships**",
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
    name: "/cs",
    execute,
};
