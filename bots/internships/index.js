const { Client, Events, GatewayIntentBits } = require("discord.js");

const { loadConfig } = require("./config");
const {
  explainDiscordError,
  logError,
  logInfo,
  logWarn,
} = require("./logger");

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

  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    logInfo(`Logged in as ${readyClient.user.tag}.`);

    try {
      const channel = await fetchInternshipChannel(readyClient, config.internshipChannelId);
      await sendStartupMessage(channel);
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

async function fetchInternshipChannel(readyClient, channelId) {
  let channel;

  try {
    channel = await readyClient.channels.fetch(channelId);
  } catch (error) {
    throw error;
  }

  if (!channel) {
    const error = new Error("Discord returned no channel for the configured internship channel ID.");
    error.code = 10003;
    throw error;
  }

  if (typeof channel.isTextBased !== "function" || !channel.isTextBased()) {
    throw new Error("Configured internship channel is not text-based.");
  }

  if (!isSendable(channel)) {
    throw new Error("Configured internship channel is not sendable by this client.");
  }

  logInfo("Internship channel fetched and validated.");

  return channel;
}

async function sendStartupMessage(channel) {
  try {
    return await channel.send("Internship job bot is online. Internship notifications will be posted in this channel.");
  } catch (error) {
    throw error;
  }
}

function isSendable(channel) {
  if (typeof channel.isSendable === "function") {
    return channel.isSendable();
  }

  return typeof channel.send === "function";
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
