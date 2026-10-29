#!/usr/bin/env bash

set -euo pipefail

# The bot must supply the authenticated Discord author's ID for this request.
# Reject missing owner configuration and requests from any other Discord user.
if [[ -z "${BOT_OWNER_ID:-}" || -z "${RESTART_REQUESTER_ID:-}" || "${RESTART_REQUESTER_ID:-}" != "$BOT_OWNER_ID" ]]; then
  printf '%s\n' 'Only the configured bot owner may request a restart.' >&2
  exit 1
fi

# PM2 exports pm_id to each managed application and its children. Inherit it
# from the calling bot; accepting a name or ID argument could target another bot.
if [[ "$#" -ne 0 || ! "${pm_id:-}" =~ ^[0-9]+$ ]]; then
  printf '%s\n' 'Restart requires a calling bot managed by PM2 (numeric pm_id).' >&2
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  printf '%s\n' 'Cannot restart: pm2 is not available on PATH.' >&2
  exit 1
fi

# Preserve PM2_HOME and the caller's environment to contact the same PM2 daemon.
# Restart this exact process ID, including ID 0, without affecting other bots.
exec pm2 restart "$pm_id"
