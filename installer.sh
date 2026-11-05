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

log "Installing project dependencies (including pg, csv-parse, and exceljs)"

if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

log "Verifying installed dependencies"
npm ls --omit=dev --depth=0
node -e 'const pg = require("pg"); if (typeof pg.Pool !== "function" || typeof pg.Client !== "function") throw new Error("pg installation is incomplete"); console.log("PostgreSQL Node client (pg) is ready.");'

log "Checking pm2"

if command_exists pm2; then
  printf 'pm2:  %s\n' "$(pm2 --version)"
else
  printf 'pm2 is not installed. Install it separately if you plan to use the pm2 start/update scripts.\n'
fi

log "Preparing bot configuration and environment files"

node <<'NODE'
const fs = require("node:fs");
const dotenv = require("dotenv");
const configPath = "bots/internships/config.json";
const configExists = fs.existsSync(configPath);
const configSource = configExists ? configPath : "bots/internships/example-config.json";
const config = JSON.parse(fs.readFileSync(configSource, "utf8"));
if (!config || typeof config !== "object" || Array.isArray(config)) {
  throw new Error(`${configSource} must contain a configuration object.`);
}

// Prepare all changes before writing files, so malformed inputs fail early.
const plans = [];
let configChanged = !configExists;
for (const [bot, directory] of [
  ["internships", "bots/internships"],
  ["brotherhood", "bots/brotherhood"],
  ["database", "shared/dbs"],
]) {
  const envPath = `${directory}/.env`;
  const examplePath = `${directory}/.env.example`;
  const exampleText = fs.readFileSync(examplePath, "utf8");
  const defaults = dotenv.parse(exampleText);
  const exists = fs.existsSync(envPath);
  let text = exists ? fs.readFileSync(envPath, "utf8") : exampleText;
  const env = exists ? dotenv.parse(text) : {};

  if (bot === "internships") {
    for (const [name, section, key] of [
      ["INTERNSHIP_CHANNEL_ID", "discord", "internshipChannelId"],
      ["RUN_ON_STARTUP", "internships", "runOnStartup"],
    ]) {
      if (Object.hasOwn(config[section] || {}, key)) {
        // Existing .env values take precedence over legacy JSON settings.
        defaults[name] = String(config[section][key]).trim();
        delete config[section][key];
        configChanged = true;
      }
    }
  }

  for (const [name, value] of Object.entries(defaults)) {
    if (Object.hasOwn(env, name)) continue;
    // Replace defaults in a new template, append only missing keys to existing files.
    const line = `${name}=${JSON.stringify(value)}`;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    if (!exists && pattern.test(text)) {
      text = text.replace(pattern, () => line);
    } else {
      text += (text.endsWith("\n") ? "" : "\n") + line + "\n";
    }
    env[name] = value;
  }
  plans.push({ bot, envPath, exists, text, env });
}

for (const { bot, envPath, exists, text, env } of plans) {
  if (!exists || fs.readFileSync(envPath, "utf8") !== text) {
    fs.writeFileSync(envPath, text, { mode: 0o600 });
    console.log(`${exists ? "Added missing settings to" : "Created"} ${envPath}.`);
  } else {
    console.log(`Preserved ${envPath}.`);
  }
  fs.chmodSync(envPath, 0o600);
  for (const [name, value] of Object.entries(env)) {
    if (!value.trim() || value.startsWith("YOUR_")) {
      console.log(`Review ${name} in ${envPath} (empty or placeholder value).`);
    }
  }
}

// Save environment settings before removing the legacy JSON values.
if (configChanged) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`${configExists ? "Migrated legacy settings in" : "Created"} ${configPath}.`);
} else {
  console.log(`Preserved ${configPath}.`);
}
console.log("Review the internship repository, schedule, and backend settings in " + configPath + ".");
console.log("Review RUN_ON_STARTUP in bots/internships/.env (true runs a digest on startup).");
console.log("Existing member data is preserved. pg installs the Node client; configure your PostgreSQL server separately.");
NODE

log "Installation complete"
printf 'Start the internship bot: npm run start:internships\n'
printf 'Start the brotherhood bot: npm run start:brotherhood\n'
printf 'Development: npm run dev:internships or npm run dev:brotherhood\n'
printf 'Offline tests: npm test\n'
printf 'Brotherhood tests: node --test bots/brotherhood/services/tests/*.unit.js\n'
printf 'With pm2 installed, start each bot separately:\n'
printf '  pm2 start bots/internships/index.js --name internship-bot\n'
printf '  pm2 start bots/brotherhood/index.js --name brotherhood-bot\n'
