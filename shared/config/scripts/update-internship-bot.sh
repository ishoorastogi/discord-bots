#!/usr/bin/env bash

# This script is used to update the internship-bot application using pm2.

set -euo pipefail

#find the repo root
SCRIPT_DIR="$(cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" && pwd )"
REPO_DIR="$(cd -- "$SCRIPT_DIR"/.. && pwd )"

cd "$REPO_DIR"
echo "*** Updating internship-bot ***"
echo "Repo: $REPO_DIR"
echo "started at: $(date)"

# Only from the main branch
BRANCH="$(git branch --show-current)"

if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Not on main branch, aborting update"
  exit 1
fi

echo "fetching latest changes from origin"
git fetch origin

echo "pulling latest changes from origin/main"
git pull --ff-only origin main

echo "installing dependencies"
npm ci

echo "restarting internship-bot"
pm2 restart internship-bot

echo "saving pm2 process list"
pm2 save

echo "successfully updated internship-bot at: $(date)"