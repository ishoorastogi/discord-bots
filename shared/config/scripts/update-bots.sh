
#!/usr/bin/env bash

set -euo pipefail

# Locate repository root
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# PM2 processes to update
BOTS=(
    "internship-bot"
    "brotherhood-bot"
)

cd "$REPO_DIR"

echo "========================================"
echo "Updating Discord Bots"
echo "Repository: $REPO_DIR"
echo "Started: $(date)"
echo "========================================"

# Verify branch
BRANCH="$(git branch --show-current)"

if [[ "$BRANCH" != "main" ]]; then
    echo "ERROR: Not on main branch. Aborting."
    exit 1
fi

# Avoid overwriting local changes
if [[ -n "$(git status --porcelain)" ]]; then
    echo "ERROR: Working tree has local changes. Aborting."
    exit 1
fi

# Fetch latest changes
echo "[GIT] Fetching updates..."
git fetch origin main

# Ensure fast-forward is possible
if ! git merge-base --is-ancestor HEAD origin/main; then
    echo "ERROR: Local branch cannot fast-forward to origin/main."
    exit 1
fi

# Pull updates
echo "[GIT] Pulling latest changes..."
git merge --ff-only origin/main

# Install dependencies
echo "[NPM] Installing dependencies..."
npm ci

# Verify all PM2 processes exist before restarting
for BOT in "${BOTS[@]}"; do
    if ! pm2 describe "$BOT" >/dev/null 2>&1; then
        echo "ERROR: PM2 process $BOT not found."
        exit 1
    fi
done

# Restart each bot
for BOT in "${BOTS[@]}"; do
    echo "[PM2] Restarting $BOT..."
    pm2 restart "$BOT"
done

# Save PM2 process list
echo "[PM2] Saving process list..."
pm2 save

echo "========================================"
echo "Update completed: $(date)"
echo "========================================"
