const {
    getCurrentEEInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
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

    await sendInternshipNotification(
        client,
        message.channelId,
        internshipsToSend,
        { title: "Top 5 Electrical Engineering Internships" },
        backend
    );

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