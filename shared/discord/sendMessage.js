/**
 * Sends a message to a Discord channel.
 *
 * @param {import("discord.js").Client} client - Discord.js client.
 * @param {string} channelId - Target channel ID.
 * @param {string|import("discord.js").MessageCreateOptions} payload - Message content or send payload.
 * @returns {Promise<import("discord.js").Message>} The sent message.
 * @throws {Error} If the client, channel ID, payload, or channel is invalid.
 */
async function sendMessage(client, channelId, payload) {
  if (!client || !client.channels || typeof client.channels.fetch !== "function") {
    throw new Error("A valid Discord client is required to send a message.");
  }

  if (typeof channelId !== "string" || !channelId.trim()) {
    throw new Error("A non-empty Discord channel ID is required.");
  }

  if (!isValidSendPayload(payload)) {
    throw new Error("Message payload must be non-empty text or a Discord send payload object.");
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

  return channel.send(payload);
}

/**
 * Checks whether a value is acceptable for Discord channel.send.
 *
 * @param {unknown} payload - Candidate Discord send payload.
 * @returns {boolean} True when the payload can be passed to channel.send.
 */
function isValidSendPayload(payload) {
  if (typeof payload === "string") {
    return payload.trim().length > 0;
  }

  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload)
  );
}

module.exports = {
  sendMessage,
};
