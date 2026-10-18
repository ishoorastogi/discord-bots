#!/usr/bin/env bash

set -euo pipefail

MIN_NODE_MAJOR=20

log() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nERROR: %s\n' "$1" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
INTERNSHIP_ENV_DIR="$SCRIPT_DIR/bots/internships"
INTERNSHIP_ENV_FILE="$INTERNSHIP_ENV_DIR/.env"
INTERNSHIP_ENV_EXAMPLE="$INTERNSHIP_ENV_DIR/.env.example"
INTERNSHIP_CONFIG_FILE="$INTERNSHIP_ENV_DIR/config.json"
INTERNSHIP_CONFIG_EXAMPLE="$INTERNSHIP_ENV_DIR/example-config.json"

log "Checking required tools"

if ! command_exists node; then
  fail "Node.js is required. Install Node.js ${MIN_NODE_MAJOR}+ with nvm, Homebrew, or your system package manager, then rerun this script."
fi

if ! command_exists npm; then
  fail "npm is required. Install npm with Node.js ${MIN_NODE_MAJOR}+ and rerun this script."
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"

if (( NODE_MAJOR < MIN_NODE_MAJOR )); then
  fail "Node.js ${MIN_NODE_MAJOR}+ is required; found $(node --version)."
fi

printf 'Node: %s\n' "$(node --version)"
printf 'npm:  %s\n' "$(npm --version)"

log "Installing project dependencies"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Checking pm2"

if command_exists pm2; then
  printf 'pm2:  %s\n' "$(pm2 --version)"
else
  printf 'pm2 is not installed. Install it separately if you plan to use the pm2 start/update scripts.\n'
fi

log "Preparing environment file"

INTERNSHIP_ENV_CREATED=false
if [[ -f "$INTERNSHIP_ENV_FILE" ]]; then
  printf 'bots/internships/.env already exists; preserving existing values.\n'
elif [[ -f "$INTERNSHIP_ENV_EXAMPLE" ]]; then
  cp "$INTERNSHIP_ENV_EXAMPLE" "$INTERNSHIP_ENV_FILE"
  chmod 600 "$INTERNSHIP_ENV_FILE"
  INTERNSHIP_ENV_CREATED=true
  printf 'Created bots/internships/.env from bots/internships/.env.example. Fill in Discord and GitHub values and review RUN_ON_STARTUP before starting the bot.\n'
else
  fail "No bots/internships/.env or .env.example found."
fi

log "Preparing configuration file"

if [[ -f "$INTERNSHIP_CONFIG_FILE" ]]; then
  printf 'bots/internships/config.json already exists; checking for legacy settings.\n'
elif [[ -f "$INTERNSHIP_CONFIG_EXAMPLE" ]]; then
  cp "$INTERNSHIP_CONFIG_EXAMPLE" "$INTERNSHIP_CONFIG_FILE"
  printf 'Created bots/internships/config.json from example-config.json. Review repository, schedule, and backend settings before starting the bot.\n'
else
  fail "No bots/internships/config.json or example-config.json found."
fi

log "Checking environment settings"

node - "$INTERNSHIP_ENV_CREATED" <<'NODE'
const fs = require("node:fs");
const dotenv = require("dotenv");
const envPath = "bots/internships/.env";
const configPath = "bots/internships/config.json";
const envCreated = process.argv[2] === "true";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
let envText = fs.readFileSync(envPath, "utf8");
const env = dotenv.parse(envText);
let configChanged = false;

for (const [name, section, key, fallback] of [
  ["INTERNSHIP_CHANNEL_ID", "discord", "internshipChannelId", "YOUR_CHANNEL_ID"],
  ["RUN_ON_STARTUP", "internships", "runOnStartup", true],
]) {
  const hasLegacySetting = Object.hasOwn(config[section] || {}, key);
  if (!Object.hasOwn(env, name) || (envCreated && hasLegacySetting)) {
    const value = String(hasLegacySetting ? config[section][key] : fallback).trim();
    // Quote values so dotenv preserves them without interpreting comments or newlines.
    const line = `${name}=${JSON.stringify(value)}`;
    if (Object.hasOwn(env, name)) {
      envText = envText.replace(new RegExp(`^${name}=.*$`, "m"), () => line);
    } else {
      envText += (envText.endsWith("\n") ? "" : "\n") + line + "\n";
    }
    env[name] = value;
    console.log(`${hasLegacySetting ? "Migrated" : "Added"} ${name} in bots/internships/.env.`);
  }
  if (hasLegacySetting) {
    delete config[section][key];
    configChanged = true;
  }
}

// Save environment settings before removing the legacy JSON values.
fs.writeFileSync(envPath, envText);
if (configChanged) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
if (!env.INTERNSHIP_CHANNEL_ID || env.INTERNSHIP_CHANNEL_ID === "YOUR_CHANNEL_ID") {
  console.log("Set INTERNSHIP_CHANNEL_ID in bots/internships/.env before starting the bot.");
}
console.log("Review RUN_ON_STARTUP in bots/internships/.env (true runs a digest on startup; false disables it).");
NODE

log "Installation complete"
printf 'Start the internship bot with: npm run start:internships\n'
printf 'For local development, use:     npm run dev:internships\n'
