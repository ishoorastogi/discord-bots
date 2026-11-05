const path = require("node:path");
const { Events, GatewayIntentBits, IntentsBitField } = require("discord.js");

const { loadEnvFile, getEnv } = require("../../shared/config/env");
const { createClient } = require("../../shared/discord/createClient");
const { logInfo, logError } = require("../../shared/utils/logger");
const { handleMentionCommand } = require("./services/commands/handleMentionCommand");

async function start() {
  loadEnvFile(path.join(__dirname, ".env"));

  const { connectDatabase, disconnectDatabase } = require("./db");

  const token = getEnv("DISCORD_TOKEN");

  // Initialize database
  await connectDatabase();

  const client = createClient();

  client.options.intents = new IntentsBitField([
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]);

  client.once(Events.ClientReady, (readyClient) => {
    logInfo(`Brotherhood bot online as ${readyClient.user.tag}`);
  });

  client.on(Events.MessageCreate, (message) => {
    handleMentionCommand(message, client).catch((error) => {
      logError("Failed to handle a brotherhood bot command.", error);
    });
  });

  try {
    await client.login(token);
  } catch (error) {
    client.destroy();
    await disconnectDatabase();
    throw error;
  }

  // Graceful shutdown
  async function shutdown() {
    logInfo("Shutting down Brotherhood Bot...");

    client.destroy();

    await disconnectDatabase();

    process.exit(0);
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch((error) => {
  logError("Failed to start the brotherhood bot.", error);
  process.exitCode = 1;
});