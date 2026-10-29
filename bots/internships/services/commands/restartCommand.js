const path = require("node:path");
const { spawn } = require("node:child_process");
const { loadConfig } = require("../../config");
const { logInfo, logError } = require("../../../../shared/utils/logger");

async function execute(message) {
    const { botOwnerId } = loadConfig();

    if (!botOwnerId || message.author.id !== botOwnerId) {
        await message.reply("You do not have permission to use this command.");
        return;
    }

    if (!/^[0-9]+$/.test(process.env.pm_id || "")) {
        await message.reply("Restart requires this bot to be running under PM2.");
        return;
    }

    // Send confirmation before PM2 disconnects this bot from Discord.
    await message.reply("Restarting this bot.");
    logInfo(`Restart requested by ${message.author.tag}.`);

    const scriptPath = path.resolve(
        __dirname,
        "../../../../shared/config/scripts/restart-script.sh"
    );

    let failed = false;
    function reportFailure(error) {
        if (failed) {
            return;
        }
        failed = true;

        logError("Failed to restart bot", error);
        message.reply("Failed to restart this bot. Check the bot logs for details.")
            .catch((replyError) => logError("Failed to send restart error", replyError));
    }

    const child = spawn("bash", [scriptPath], {
        detached: true,
        stdio: ["ignore", "ignore", "inherit"],
        env: {
            ...process.env,
            BOT_OWNER_ID: botOwnerId,
            RESTART_REQUESTER_ID: message.author.id,
        },
    });
    child.once("error", reportFailure);
    child.once("exit", (code, signal) => {
        if (code !== 0) {
            reportFailure(new Error(`Restart script exited with code ${code}, signal ${signal}`));
        }
    });
    child.unref();
}

module.exports = {
    name: "/restart",
    execute,
};
