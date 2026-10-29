const path = require("node:path");
const { Events, GatewayIntentBits, IntentsBitField } = require("discord.js");
const { loadEnvFile, getEnv } = require("../../shared/config/env");
const { createClient } = require("../../shared/discord/createClient");
const { logInfo, logError } = require("../../shared/utils/logger");
const { handleMentionCommand } = require("./services/commands/handleMentionCommand");

async function start() {
  loadEnvFile(path.join(__dirname, ".env"));
  const token = getEnv("DISCORD_TOKEN");
  const client = createClient();
  // Mention commands do not require the privileged MessageContent intent.
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
    throw error;
  }
}

start().catch((error) => {
  logError("Failed to start the brotherhood bot.", error);
  process.exitCode = 1;
});
