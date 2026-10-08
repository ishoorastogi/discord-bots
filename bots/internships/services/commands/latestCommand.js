const {
    getCurrentInternships,
} = require("../getCurrentInternships");

const {
    formatInternshipDate,
} = require("../internshipDateFormatter");

async function execute(message) {
    const internships = (
        await getCurrentInternships()
    ).slice(0, 5);

    if (internships.length === 0) {
        await message.reply(
            "No current internships were found."
        );
        return;
    }

    const response = [
        "5 Latest Internships",
        ...internships.map
        (
            (internship, index) =>
                [
                    `${index + 1}. ${internship.company}`,
                    internship.role,
                    `${internship.location || "Location not provided"}`,
                    `${formatInternshipDate(internship)}`,
                    `[Apply Here](${internship.applicationUrl})`,
                ].join("\n")
        ),
    ].join("\n");

    await message.reply(response);
}

module.exports = {
    name: "/latest",
    execute,
};