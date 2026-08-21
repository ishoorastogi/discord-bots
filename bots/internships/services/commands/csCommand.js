const {
    getCurrentInternships,
} = require("../getCurrentInternships");

const {
    getTopCSInternships,
} = require("../internshipFilter");

async function execute(message) {
    const internships = await getCurrentInternships();

    const csInternships = getTopCSInternships(internships, 5);

    if (csInternships.length === 0) {
        await message.reply(
            "No current Computer Science internships were found."
        );
        return;
    }

    const topInternships = csInternships.slice(0, 5);

    const response = [
        "**Top 5 Computer Science Internships**",
        "",
        ...topInternships.map(
            (internship, index) =>
                [
                    `**${index + 1}. ${internship.company}**`,
                    internship.role,
                    `📍 ${internship.location}`,
                    `📅 ${internship.datePosted}`,
                    `[Apply Here](${internship.applicationUrl})`,
                ].join("\n")
        ),
    ].join("\n\n");

    await message.reply(response);
}

module.exports = {
    name: "/cs",
    execute,
};