const path = require("path");
const fs = require("node:fs");
const cron = require("node-cron");

const {
  loadEnvFile,
  getEnv,
  getOptionalEnv,
} = require("../../shared/config/env");

const {
  logInfo,
} = require("../../shared/utils/logger");

let settings;

try {
  settings = require("./config.json");
} catch (error) {
  if (error.code === "MODULE_NOT_FOUND") {
    throw new Error(
      "Missing bots/internships/config.json. Copy example-config.json to config.json and fill in your settings."
    );
  }

  throw new Error("Unable to load bots/internships/config.json: " + error.message);
}

// Load private environment variables
loadEnvFile(path.join(__dirname, ".env"));

function getSetting(name, defaultValue) {
  const value = name.split(".").reduce(
    (section, key) => section?.[key],
    settings
  );

  if (typeof value === "undefined" && typeof defaultValue !== "undefined") {
    return defaultValue;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid or missing config.json setting: ${name} (expected a non-empty string)`);
  }

  return value.trim();
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }

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
    owner: getSetting("github.repoOwner"),
    repo: getSetting("github.repoName"),
    branch: getSetting("github.repoBranch"),
    path: getSetting("github.repoPath"),
  };
}

function setBackendPort(port) {
  if (!Number.isInteger(port) || port < 1000 || port > 9999) {
    throw new Error("Backend port must be a four-digit number (1000-9999)");
  }

  const configPath = path.join(__dirname, "config.json");
  const updatedSettings = JSON.parse(fs.readFileSync(configPath, "utf8"));
  updatedSettings.backend.port = port;
  fs.writeFileSync(configPath, JSON.stringify(updatedSettings, null, 2) + "\n", "utf8");
  settings = updatedSettings;
}

function loadConfig() {
  const cronSchedule = getSetting("internships.schedule", "0 8 * * *");

  if (!cron.validate(cronSchedule)) {
    throw new Error(
      `Invalid config.json internships.schedule: "${cronSchedule}"`
    );
  }

  const timezone = getSetting("internships.timezone", "America/Chicago");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error(`Invalid config.json internships.timezone: "${timezone}"`);
  }

  const backendHost = getSetting("backend.host");
  const backendPort = settings.backend?.port;

  if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
    throw new Error("Invalid config.json backend.port: expected an integer from 1 to 65535");
  }

  const config = {
    // Private configuration
    discordToken: getEnv("DISCORD_TOKEN"),
    discordGuildId: getOptionalEnv("DISCORD_GUILD_ID"),
    botOwnerId: getOptionalEnv("BOT_OWNER_ID"),
    githubToken: getOptionalEnv("GITHUB_TOKEN"),

    // Discord configuration
    internshipChannelId: getEnv("INTERNSHIP_CHANNEL_ID"),

    sendStartupTestMessage: parseBoolean(
      settings.discord?.sendStartupTestMessage,
      false
    ),

    // Repository configuration
    repository: loadRepositoryConfig(),

    // Internship scheduling
    cronSchedule,

    timezone,

    runOnStartup: parseBoolean(
      getOptionalEnv("RUN_ON_STARTUP"),
      true
    ),

    // Backend configuration
    backend: {
      host: backendHost,
      port: backendPort,
    },
  };

  logInfo("Configuration loaded successfully.");

  return config;
}

module.exports = {
  loadConfig,
  loadRepositoryConfig,
  parseBoolean,
  setBackendPort,
};
