/**
 * Converts known Discord errors into internship bot operator guidance.
 *
 * @param {Error & { code?: string|number }} error - Discord error.
 * @returns {string} Human-readable error explanation.
 */
function explainDiscordError(error) {
  if (!error) {
    return "Unknown Discord error.";
  }

  if (error.code === 50001) {
    return "Discord error 50001 Missing Access: the bot may not be in the server, may not have access to the configured channel, or may be missing View Channel / Send Messages permissions.";
  }

  if (error.code === 10003) {
    return "Discord error 10003 Unknown Channel: verify INTERNSHIP_CHANNEL_ID points to an existing channel the bot can access.";
  }

  if (error.code === 50013) {
    return "Discord error 50013 Missing Permissions: grant the bot View Channel, Send Messages, and Embed Links in the configured channel.";
  }

  if (error.code === "TokenInvalid" || error.message === "An invalid token was provided.") {
    return "Invalid Discord token: verify DISCORD_TOKEN is set to the bot token from the Discord Developer Portal.";
  }

  return `Discord error: ${error.message || "No error message provided."}`;
}

module.exports = {
  explainDiscordError,
};
