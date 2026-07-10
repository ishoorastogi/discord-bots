function logInfo(message) {
  console.log(`[INFO] ${message}`);
}

function logWarn(message) {
  console.warn(`[WARN] ${message}`);
}

function logError(message, error) {
  console.error(`[ERROR] ${message}`);

  if (error) {
    const details = formatError(error);

    if (details) {
      console.error(`[ERROR] ${details}`);
    }
  }
}

function formatError(error) {
  if (!error) {
    return "";
  }

  const parts = [];

  if (error.name) {
    parts.push(`name=${error.name}`);
  }

  if (error.code) {
    parts.push(`code=${error.code}`);
  }

  if (error.status) {
    parts.push(`status=${error.status}`);
  }

  if (error.message) {
    parts.push(`message=${error.message}`);
  }

  return parts.join(" ");
}

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
  logError,
  logInfo,
  logWarn,
};
