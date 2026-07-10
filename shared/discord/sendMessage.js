/**
 * Sends a text message to a Discord channel.
 *
 * @param {import("discord.js").Client} client - Discord.js client.
 * @param {string} channelId - Target channel ID.
 * @param {string} content - Message content to send.
 * @returns {Promise<import("discord.js").Message>} The sent message.
 * @throws {Error} If the client, channel ID, content, or channel is invalid.
 */
async function sendMessage(client, channelId, content) {
  if (!client || !client.channels || typeof client.channels.fetch !== "function") {
    throw new Error("A valid Discord client is required to send a message.");
  }

  if (typeof channelId !== "string" || !channelId.trim()) {
    throw new Error("A non-empty Discord channel ID is required.");
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Message content must be a non-empty string.");
  }

  const channel = await client.channels.fetch(channelId.trim());

  if (!channel) {
    throw new Error(`Discord channel not found: ${channelId}`);
  }

  if (typeof channel.isTextBased !== "function" || !channel.isTextBased()) {
    throw new Error(`Discord channel is not text-based: ${channelId}`);
  }

  if (typeof channel.send !== "function") {
    throw new Error(`Discord channel cannot send messages: ${channelId}`);
  }

  return channel.send(content);
}

module.exports = {
  sendMessage,
};
