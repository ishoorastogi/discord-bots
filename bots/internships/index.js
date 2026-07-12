const { Events } = require("discord.js");

const { loadConfig } = require("./config");
const { createClient } = require("../../shared/discord/createClient");
const { sendMessage } = require("../../shared/discord/sendMessage");
const {
  logError,
  logInfo,
  logWarn,
} = require("../../shared/utils/logger");
const { explainDiscordError } = require("./discordErrors");

let client;
let isShuttingDown = false;

process.on("unhandledRejection", (error) => {
  logError("Unhandled promise rejection.", error);
});

process.on("uncaughtException", (error) => {
  logError("Uncaught exception.", error);
  void shutdown(1);
});

process.on("SIGINT", () => {
  void shutdown(0, "SIGINT received.");
});

process.on("SIGTERM", () => {
  void shutdown(0, "SIGTERM received.");
});

async function main() {
  const config = loadConfig();

  client = createClient();

  client.once(Events.ClientReady, async (readyClient) => {
    logInfo(`Logged in as ${readyClient.user.tag}.`);

    try {
      await sendMessage(
        readyClient,
        config.internshipChannelId,
        "Internship job bot is online. Internship notifications will be posted in this channel."
      );
      logInfo("Startup test message sent successfully.");
    } catch (error) {
      logError(explainDiscordError(error), error);
    }
  });

  client.on("error", (error) => {
    logError("Discord client error.", error);
  });

  logInfo("Logging in to Discord.");

  try {
    await client.login(config.discordToken);
  } catch (error) {
    logError(explainDiscordError(error), error);
    await shutdown(1);
  }
}

async function shutdown(exitCode = 0, reason) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (reason) {
    logWarn(reason);
  }

  if (client) {
    logInfo("Destroying Discord client.");
    client.destroy();
  }

  process.exitCode = exitCode;
}

void main().catch(async (error) => {
  logError("Internship bot failed to start.", error);
  await shutdown(1);
});
