const path = require("path");
const dotenv = require("dotenv");
const cron = require("node-cron");

const { logInfo, logWarn } = require("./logger");

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
  quiet: true,
});

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function getOptionalEnv(name, defaultValue = "") {
  const value = process.env[name];

  if (!value || !value.trim()) {
    return defaultValue;
  }

  return value.trim();
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return defaultValue;
}

function parseGreenhouseBoards(value) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      const separatorIndex = entry.indexOf(":");

      if (separatorIndex === -1) {
        logWarn(
          `Ignoring malformed GREENHOUSE_BOARDS entry: "${entry}"`
        );
        return [];
      }

      const boardToken = entry.slice(0, separatorIndex).trim();
      const companyName = entry.slice(separatorIndex + 1).trim();

      if (!boardToken || !companyName) {
        logWarn(
          `Ignoring malformed GREENHOUSE_BOARDS entry: "${entry}"`
        );
        return [];
      }

      return [
        {
          boardToken,
          companyName,
        },
      ];
    });
}

function loadConfig() {
  const greenhouseBoards = parseGreenhouseBoards(
    getOptionalEnv("GREENHOUSE_BOARDS")
  );

  if (greenhouseBoards.length === 0) {
    logWarn("No Greenhouse boards configured.");
  }

  const cronSchedule = getOptionalEnv(
    "INTERNSHIP_CRON_SCHEDULE",
    "0 8 * * *"
  );

  if (!cron.validate(cronSchedule)) {
    throw new Error(
      `Invalid INTERNSHIP_CRON_SCHEDULE: "${cronSchedule}"`
    );
  }

  const config = {
    discordToken: getRequiredEnv("DISCORD_TOKEN"),
    internshipChannelId: getRequiredEnv(
      "INTERNSHIP_CHANNEL_ID"
    ),

    greenhouseBoards,
    cronSchedule,

    timezone: getOptionalEnv(
      "INTERNSHIP_TIMEZONE",
      "America/Chicago"
    ),

    runOnStartup: parseBoolean(
      getOptionalEnv("RUN_ON_STARTUP", "true"),
      true
    ),

    sendStartupTestMessage: parseBoolean(
      getOptionalEnv(
        "SEND_STARTUP_TEST_MESSAGE",
        "false"
      ),
      false
    ),
  };

  logInfo("Environment configuration loaded.");

  return config;
}

module.exports = {
  loadConfig,
  parseBoolean,
  parseGreenhouseBoards,
};