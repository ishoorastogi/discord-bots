const {
    readSentInternships,
} = require("../runInternshipDigest");

const {
    formatInternshipDate,
} = require("../internshipDateFormatter");

async function execute(message) {
    const sentInternships =
        await readSentInternships();

    if (sentInternships.length === 0) {
        await message.reply(
            "No previously sent internships are available yet."
        );
        return;
    }

    const shuffled = [...sentInternships];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const randomIndex = Math.floor(
            Math.random() * (i + 1)
        );

        [
            shuffled[i],
            shuffled[randomIndex],
        ] = [
            shuffled[randomIndex],
            shuffled[i],
        ];
    }

    const randomInternships = shuffled.slice(0, 5);

    const response = [
        "**Random Previously Posted Internships**",
        "",
        ...randomInternships.map(
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
}

module.exports = {
    name: "/random",
    execute,
};
