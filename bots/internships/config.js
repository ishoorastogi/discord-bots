const cron = require("node-cron");

const { getEnv, getOptionalEnv } = require("../../shared/config/env");
const { logInfo, logWarn } = require("../../shared/utils/logger");

function getOptionalEnvWithDefault(name, defaultValue = "") {
  const value = getOptionalEnv(name);

  if (typeof value === "undefined") {
    return defaultValue;
  }

  return value;
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

function parsePositiveInteger(value, defaultValue) {
  if (typeof value !== "string" || !value.trim()) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
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

function loadRepositoryConfig() {
  return {
    owner: getEnv("INTERNSHIP_REPO_OWNER"),
    repo: getEnv("INTERNSHIP_REPO_NAME"),
    branch: getEnv("INTERNSHIP_REPO_BRANCH"),
    path: getEnv("INTERNSHIP_REPO_PATH"),
  };
}

function loadOptionalRepositoryConfig() {
  return {
    owner: getOptionalEnv("INTERNSHIP_REPO_OWNER"),
    repo: getOptionalEnv("INTERNSHIP_REPO_NAME"),
    branch: getOptionalEnv("INTERNSHIP_REPO_BRANCH"),
    path: getOptionalEnv("INTERNSHIP_REPO_PATH"),
  };
}

function loadConfig() {
  const greenhouseBoards = parseGreenhouseBoards(
    getOptionalEnv("GREENHOUSE_BOARDS")
  );

  if (greenhouseBoards.length === 0) {
    logWarn("No Greenhouse boards configured.");
  }

  const cronSchedule = getOptionalEnvWithDefault(
    "INTERNSHIP_CRON_SCHEDULE",
    "0 8 * * *"
  );

  if (!cron.validate(cronSchedule)) {
    throw new Error(
      `Invalid INTERNSHIP_CRON_SCHEDULE: "${cronSchedule}"`
    );
  }

  const config = {
    discordToken: getEnv("DISCORD_TOKEN"),
    internshipChannelId: getEnv(
      "INTERNSHIP_CHANNEL_ID"
    ),

    repository: loadOptionalRepositoryConfig(),
    greenhouseBoards,
    cronSchedule,
    pollIntervalMinutes: parsePositiveInteger(
      getOptionalEnv("INTERNSHIP_POLL_INTERVAL_MINUTES"),
      30
    ),

    timezone: getOptionalEnvWithDefault(
      "INTERNSHIP_TIMEZONE",
      "America/Chicago"
    ),

    runOnStartup: parseBoolean(
      getOptionalEnvWithDefault("RUN_ON_STARTUP", "true"),
      true
    ),

    sendStartupTestMessage: parseBoolean(
      getOptionalEnvWithDefault(
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
  loadRepositoryConfig,
  parseBoolean,
  parseGreenhouseBoards,
  parsePositiveInteger,
};
