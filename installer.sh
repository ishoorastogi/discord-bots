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

if [[ -f .env ]]; then
  printf '.env already exists; leaving it unchanged.\n'
elif [[ -f .env.example ]]; then
  cp .env.example .env
  chmod 600 .env
  printf 'Created .env from .env.example. Fill in Discord and GitHub values before starting the bot.\n'
else
  printf 'No .env.example found; skipping .env creation.\n'
fi

log "Installation complete"
printf 'Start the internship bot with: npm run start:internships\n'
printf 'For local development, use:     npm run dev:internships\n'
