const {
    sendSavedInternships,
} = require("../sendSavedInternships");

const {
    isCSInternship,
} = require("../internshipFilter");

async function execute(message) {
    await sendSavedInternships({
        message,
        filter: isCSInternship,
        fileName: "sentCSInternships.json",
        title: "Previously Sent CS Internships",
        emptyMessage:
            "No previously sent Computer Science internships are available yet.",
    });
}

module.exports = {
    name: "/sendmecs",
    execute,
};