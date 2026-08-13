const {
    readSentInternships,
} = require("../runInternshipDigest");

const {
    isMuted,
} = require("../botState");

const {
    loadConfig,
} = require("../../config");

async function execute(message) {
    const config = loadConfig();

    const sentInternships =
        await readSentInternships();

    const muted = await isMuted();

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
            'Is Muted: ' + (muted ? 'Yes' : 'No')
        ].join("\n")
    );
}

module.exports = {
    name: "/status",
    execute,
};