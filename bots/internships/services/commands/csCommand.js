const {
    getCurrentCSInternships,
} = require("../getCurrentInternships");

const {
    getInternshipsToSend,
    saveShownInternships,
} = require("../runInternshipDigest");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
    const csInternships =
        await getCurrentCSInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(csInternships, 5);

    if (internshipsToSend.length === 0) {
        await message.reply(
            "No current Computer Science internships were found."
        );
        return;
    }

    await sendInternshipNotification(
        client,
        message.channelId,
        internshipsToSend,
        { title: "Top 5 Computer Science Internships" },
        backend
    );

    await saveShownInternships({
        internshipsToSend,
        sentInternships,
        sentIds,
    });
}

module.exports = {
    name: "/cs",
    execute,
};
