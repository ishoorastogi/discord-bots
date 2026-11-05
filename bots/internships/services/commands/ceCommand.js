const {
    getCurrentCEInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
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

    await sendInternshipNotification(
        client,
        message.channelId,
        internshipsToSend,
        { title: "Top 5 Computer Engineering Internships" },
        backend
    );

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
