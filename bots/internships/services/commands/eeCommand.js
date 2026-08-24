const {
    getCurrentEEInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    formatInternshipDate,
} = require("../internshipDateFormatter");

async function execute(message) {
    const eeInternships =
        await getCurrentEEInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(eeInternships, 5);

    if (internshipsToSend.length === 0) {
        await message.reply(
            "No current Electrical Engineering internships were found."
        );
        return;
    }

    const response = [
        "**Top 5 Electrical Engineering Internships**",
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
    name: "/ee",
    execute,
};