const {
    readSentInternships,
} = require("../runInternshipDigest");

const {
    isMuted,
} = require("../botState");

const {
    loadConfig,
} = require("../../config");

async function execute(message, client, backend) {
    const config = loadConfig();

    const sentInternships =
        await readSentInternships();

    const muted = await isMuted();

    // Get current backend connection state
    const backendStatus = backend.getStatus();

    let backendState;

    if (!backendStatus.enabled) {
        backendState = "Disabled";
    } else if (backendStatus.connected) {
        backendState = "Enabled";
    } else {
        backendState = "Attempting to reconnect";
    }

    await message.reply(
        [
            "**Internship Bot Status**",
            "",
            "Status: Online",
            `Schedule: ${config.cronSchedule}`,
            `Timezone: ${config.timezone}`,
            `Run on startup: ${config.runOnStartup ? "Yes" : "No"}`,
            `Previously sent internships: ${sentInternships.length}`,
            `Repository: ${config.repository.owner}/${config.repository.repo}`,
            `Branch: ${config.repository.branch}`,
            `Is Muted: ${muted ? "Yes" : "No"}`,
            `Backend: ${backendState}`,
            `Backend port: ${config.backend.port}`
        ].join("\n")
    );
}

module.exports = {
    name: "/status",
    execute,
};
