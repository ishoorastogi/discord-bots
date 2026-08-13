const path = require("path");

const {
    readSentInternships,
} = require("../runInternshipDigest");

const SENT_INTERNSHIPS_PATH = path.join(
    __dirname,
    "../../data/sentInternships.json"
);

async function execute(message) {
    const sentInternships =
        await readSentInternships();

    if (sentInternships.length === 0) {
        await message.reply(
            "No previously sent internships are available yet."
        );
        return;
    }

    try {
        await message.author.send({
            content: [
                "**Internship Bot History**",
                "",
                `Previously posted internships: ${sentInternships.length}`,
            ].join("\n"),
            files: [
                {
                    attachment: SENT_INTERNSHIPS_PATH,
                    name: "sentInternships.json",
                },
            ],
        });

        await message.reply(
            "I sent you the internship history in a DM."
        );
    } catch (error) {
        if (error.code === 50007) {
            await message.reply(
                "I couldn't DM you. Make sure you allow direct messages from members of this server."
            );
            return;
        }

        throw error;
    }
}

module.exports = {
    name: "/sendmeall",
    execute,
};