const cron = require("node-cron");

const {
  getEnv,
  getOptionalEnv,
} = require("../../shared/config/env");

const {
  logInfo,
} = require("../../shared/utils/logger");

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

function loadRepositoryConfig() {
  return {
    owner: getEnv("INTERNSHIP_REPO_OWNER"),
    repo: getEnv("INTERNSHIP_REPO_NAME"),
    branch: getEnv("INTERNSHIP_REPO_BRANCH"),
    path: getEnv("INTERNSHIP_REPO_PATH"),
  };
}

function loadConfig() {
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
    
    repository: loadRepositoryConfig(),

    githubToken: getOptionalEnv("GITHUB_TOKEN"),

    cronSchedule,

    timezone: getOptionalEnvWithDefault(
      "INTERNSHIP_TIMEZONE",
      "America/Chicago"
    ),

    runOnStartup: parseBoolean(
      getOptionalEnvWithDefault(
        "RUN_ON_STARTUP",
        "true"
      ),
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
};