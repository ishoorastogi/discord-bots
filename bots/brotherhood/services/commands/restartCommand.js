const childProcess = require("node:child_process");
const path = require("node:path");
const { isBotOwner } = require("../botOwner");
const { logError } = require("../../../../shared/utils/logger");

const restartScript = path.resolve(__dirname, "../../../../shared/config/scripts/restart-script.sh");

async function execute(message) {
    if (!isBotOwner(message.author?.id)) {
        await message.reply("Only the bot owner can restart the bot.");
        return;
    }
    if (!/^[0-9]+$/.test(process.env.pm_id ?? "")) {
        await message.reply("Restart requires the bot to be managed by PM2.");
        return;
    }

    // Deliver the acknowledgement before the restart disconnects the bot.
    await message.reply("Restarting the bot...");

    async function reportFailure(error) {
        logError("Failed to restart the brotherhood bot.", error);
        try {
            await message.reply("Could not restart the bot. Check the bot logs.");
        } catch (replyError) {
            logError("Failed to send the restart failure message.", replyError);
        }
    }

    try {
        const child = childProcess.spawn("bash", [restartScript], {
            // Let the script finish after PM2 stops this bot process.
            detached: true,
            stdio: "ignore",
            env: {
                ...process.env,
                BOT_OWNER_ID: process.env.BOT_OWNER_ID.trim(),
                RESTART_REQUESTER_ID: message.author.id,
            },
        });
        child.once("error", reportFailure);
        child.once("exit", (code, signal) => {
            if (code !== 0) {
                reportFailure(new Error(`Restart script exited with ${signal ? `signal ${signal}` : `code ${code}`}.`));
            }
        });
        child.unref();
    } catch (error) {
        await reportFailure(error);
    }
}

module.exports = { name: "/restart", execute };
