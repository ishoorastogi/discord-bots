const {
    getCurrentMEInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
    const meInternships =
        await getCurrentMEInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(meInternships, 5);

    if (internshipsToSend.length === 0) {
        await message.reply(
            "No current Mechanical Engineering internships were found."
        );
        return;
    }

    await sendInternshipNotification(
        client,
        message.channelId,
        internshipsToSend,
        { title: "Top 5 Mechanical Engineering Internships" },
        backend
    );

    await saveShownInternships({
        internshipsToSend,
        sentInternships,
        sentIds,
    });
}

module.exports = {
    name: "/me",
    execute,
};
