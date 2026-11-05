const {
    getCurrentBMInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
    const bmInternships =
        await getCurrentBMInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(
        bmInternships,
        5
    );

    if (internshipsToSend.length === 0) {
        await message.reply(
            "No current Biomedical Engineering internships were found."
        );
        return;
    }

    await sendInternshipNotification(
        client,
        message.channelId,
        internshipsToSend,
        { title: "Top 5 Biomedical Engineering Internships" },
        backend
    );

    await saveShownInternships({
        internshipsToSend,
        sentInternships,
        sentIds,
    });
}

module.exports = {
    name: "/bm",
    execute,
};