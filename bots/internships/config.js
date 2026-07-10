const path = require("path");
const dotenv = require("dotenv");

const { logInfo } = require("./logger");

dotenv.config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function loadConfig() {
  const config = {
    discordToken: getRequiredEnv("DISCORD_TOKEN"),
    internshipChannelId: getRequiredEnv("INTERNSHIP_CHANNEL_ID"),
  };

  logInfo("Environment configuration loaded.");

  return config;
}

module.exports = {
  loadConfig,
};
