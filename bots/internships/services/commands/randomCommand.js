const {
    readSentInternships,
} = require("../runInternshipDigest");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
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

    await sendInternshipNotification(
        client,
        message.channelId,
        randomInternships,
        {
            title: "Random Previously Posted Internships",
            description: "A random selection of previously posted internships.",
        },
        backend
    );
}

module.exports = {
    name: "/random",
    execute,
};
