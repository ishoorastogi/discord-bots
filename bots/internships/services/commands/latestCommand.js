const {
    getCurrentInternships,
} = require("../getCurrentInternships");

const {
    sendInternshipNotification,
} = require("../../sendInternshipNotification");

async function execute(message, client, backend) {
    const internships = (
        await getCurrentInternships()
    ).slice(0, 5);

    if (internships.length === 0) {
        await message.reply(
            "No current internships were found."
        );
        return;
    }

    await sendInternshipNotification(
        client,
        message.channelId,
        internships,
        { title: "5 Latest Internships" },
        backend
    );
}

module.exports = {
    name: "/latest",
    execute,
};