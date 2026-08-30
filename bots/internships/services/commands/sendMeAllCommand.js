const {
    sendSavedInternships,
} = require("../sendSavedInternships");

async function execute(message) {
    await sendSavedInternships({
        message,
        fileName: "sentInternships.json",
        title: "Internship Bot History",
        emptyMessage:
            "No previously sent internships are available yet.",
    });
}

module.exports = {
    name: "/sendmeall",
    execute,
};