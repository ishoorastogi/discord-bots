const {
  Client,
  GatewayIntentBits,
} = require("discord.js");

/**
 * Creates a Discord client with the intents needed
 * for outbound messages and mention-based commands.
 *
 * @returns {Client}
 */
function createClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

module.exports = {
  createClient,
};