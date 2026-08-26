# Internship Job Bot

A Discord bot that posts engineering internship openings and responds to
mention-based commands. The current bot reads internship data from the
SimplifyJobs internship repository, filters active U.S. listings, ranks them by
posting date, and sends the top results to a configured Discord channel.

## What It Does

- Posts a scheduled digest of the top 5 current engineering internships.
- Avoids repeating newly posted jobs by saving sent listings in local history.
- Falls back to previously sent listings if there are fewer than 5 new results.
- Supports on-demand field-specific internship lookups through Discord mentions.
- Lets the bot owner mute, unmute, clear history, or shut down the bot.
- Can DM users the saved internship history as JSON.

## Data Source

By default, the bot reads:

- Repository: `SimplifyJobs/Summer2027-Internships`
- Branch: `dev`
- File: `.github/scripts/listings.json`

The file is fetched through the GitHub API. `GITHUB_TOKEN` is optional for public
repos, but adding one is recommended for better API rate limits.

Only listings that are active, visible, have a company, role, application URL,
and a U.S. location are considered. The role title is keyword-filtered for
engineering-related internships.

## Setup

Install dependencies from the workspace root:

```sh
npm install
```

Create a `.env` file from the example:

```sh
cp .env.example .env
```

Fill in the Discord and GitHub values in `.env`.

## Required Discord Setup

In the Discord Developer Portal:

1. Create or select the bot application.
2. Copy the bot token into `DISCORD_TOKEN`.
3. Enable the Message Content Intent so mention commands can be read.
4. Invite the bot to the target server.
5. Give the bot these permissions in the target channel:
   - View Channel
   - Send Messages
   - Embed Links

Set `INTERNSHIP_CHANNEL_ID` to the Discord text channel where automatic digests
should be posted.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | None | Discord bot token. |
| `INTERNSHIP_CHANNEL_ID` | Yes | None | Channel ID for scheduled internship digests. |
| `BOT_OWNER_ID` | Recommended | None | Discord user ID allowed to run owner-only commands. |
| `INTERNSHIP_REPO_OWNER` | Yes | None | GitHub owner for the internship listings repo. |
| `INTERNSHIP_REPO_NAME` | Yes | None | GitHub repo name for the internship listings repo. |
| `INTERNSHIP_REPO_BRANCH` | Yes | None | Git branch or ref to read from. |
| `INTERNSHIP_REPO_PATH` | Yes | None | Path to the listings JSON file in the repo. |
| `GITHUB_TOKEN` | No | None | Optional token for authenticated GitHub API requests. |
| `INTERNSHIP_CRON_SCHEDULE` | No | `0 8 * * *` | Cron schedule for automatic digests. |
| `INTERNSHIP_TIMEZONE` | No | `America/Chicago` | Timezone used by the cron schedule. |
| `RUN_ON_STARTUP` | No | `true` | Runs a digest immediately after the bot logs in. |
| `SEND_STARTUP_TEST_MESSAGE` | No | `false` | Loaded by config, but not used by the current entry point. |
| `DISCORD_GUILD_ID` | No | None | Present in `.env.example`, but not used by the current entry point. |

## Running The Bot

From the workspace root:

```sh
npm run start:internships
```

For local development with Node watch mode:

```sh
npm run dev:internships
```

When the bot logs in, it schedules the digest using
`INTERNSHIP_CRON_SCHEDULE` and `INTERNSHIP_TIMEZONE`. If `RUN_ON_STARTUP=true`,
it immediately runs one digest after connecting.

## Discord Commands

Commands are triggered by mentioning the bot followed by the command, for
example:

```text
@Internship Job Bot /cs
```

| Command | Who can use it | Description |
| --- | --- | --- |
| `/help` | Anyone | Shows available commands. |
| `/status` | Anyone | Shows bot status, schedule, repo, muted state, and sent history count. |
| `/cs` | Anyone | Replies with the top 5 Computer Science internships. |
| `/me` | Anyone | Replies with the top 5 Mechanical Engineering internships. |
| `/ee` | Anyone | Replies with the top 5 Electrical Engineering internships. |
| `/bm` | Anyone | Replies with the top 5 Biomedical Engineering internships. |
| `/random` | Anyone | Replies with 5 random previously sent internships. |
| `/sendmeall` | Anyone | DMs the full saved internship history as JSON. |
| `/sendmecs` | Anyone | DMs saved CS internship history as JSON. |
| `/future` | Anyone | Lists planned future commands. |
| `/mute` | Bot owner | Pauses automatic scheduled internship messages. |
| `/unmute` | Bot owner | Resumes automatic scheduled internship messages. |
| `/clear` | Bot owner | Clears saved internship history. |
| `/kill` | Bot owner | Shuts down the bot process. |

Owner-only commands require `BOT_OWNER_ID` to match the Discord user ID of the
message author.

## Saved State

The bot writes local JSON state under `bots/internships/data/`.

- `botState.json` stores whether scheduled digests are muted.
- `sentInternships.json` is created at runtime and stores internships already
  shown by scheduled digests or field-specific commands.

Clearing history with `/clear` empties `sentInternships.json`, which allows the
bot to treat all current listings as unseen again.

## Tests

Available test scripts:

```sh
npm run test:internship-repo
npm run test:internship-content
npm run test:internship-parser
npm run test:internship-filter
```

The repo and content tests call GitHub, so they may need network access and can
benefit from `GITHUB_TOKEN`.

## Troubleshooting

- `Missing required environment variable`: check that `.env` exists at the
  workspace root and includes all required values.
- Invalid Discord token: verify `DISCORD_TOKEN` is the bot token, not the client
  secret or application ID.
- Unknown Channel or Missing Access: verify `INTERNSHIP_CHANNEL_ID`, confirm the
  bot is in the server, and grant channel access.
- Missing Permissions: grant View Channel, Send Messages, and Embed Links.
- Mention commands do not respond: enable Message Content Intent in the Discord
  Developer Portal.
- DM export commands fail: the requesting user must allow DMs from server
  members.
