const { Client, GatewayIntentBits } = require("discord.js");

/**
 * Creates a Discord client with only the intent needed for outbound messaging.
 *
 * @returns {Client} A Discord.js client instance.
 */
function createClient() {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
  });
}

module.exports = {
  createClient,
};
