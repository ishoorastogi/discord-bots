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

Create the bot's environment and configuration files from the examples:

```sh
cp bots/internships/.env.example bots/internships/.env
cp bots/internships/example-config.json bots/internships/config.json
```

Skip either copy if you already have that file. Fill in credentials and private
IDs, including `INTERNSHIP_CHANNEL_ID`, and set `RUN_ON_STARTUP` in `bots/internships/.env`. Review the
repository, schedule, and backend settings in `bots/internships/config.json`. The local
configuration file is ignored by Git; `example-config.json` is the template.

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

Set `INTERNSHIP_CHANNEL_ID` in `.env` to the Discord text channel ID
where automatic digests should be posted.

## Environment Variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DISCORD_TOKEN` | Yes | None | Discord bot token. |
| `INTERNSHIP_CHANNEL_ID` | Yes | None | Channel ID for scheduled internship digests. |
| `RUN_ON_STARTUP` | No | `true` | Runs a digest immediately after the bot logs in. Set to `false` to disable. |
| `BOT_OWNER_ID` | Recommended | None | Discord user ID allowed to run owner-only commands. |
| `GITHUB_TOKEN` | No | None | Optional token for authenticated GitHub API requests. |
| `DISCORD_GUILD_ID` | No | None | Present in `bots/internships/.env.example`, but not used by the current entry point. |

## JSON Configuration

These settings are read from `bots/internships/config.json`. Old environment
variables for these settings no longer override the JSON file. Restart the bot
after changing either configuration file.

| Setting | Required | Default | Purpose |
| --- | --- | --- | --- |
| `discord.sendStartupTestMessage` | No | `false` | Loaded by config, but not used by the current entry point. |
| `github.repoOwner` | Yes | None | GitHub owner for the internship listings repo. |
| `github.repoName` | Yes | None | GitHub repo name for the internship listings repo. |
| `github.repoBranch` | Yes | None | Git branch or ref to read from. |
| `github.repoPath` | Yes | None | Path to the listings JSON file in the repo. |
| `internships.schedule` | No | `0 8 * * *` | Cron schedule for automatic digests. |
| `internships.timezone` | No | `America/Chicago` | Timezone used by the cron schedule. |
| `backend.host` | Yes | None | TCP backend hostname or IP address. |
| `backend.port` | Yes | None | TCP backend port, as a JSON integer from 1 to 65535. |

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
`internships.schedule` and `internships.timezone`. If `RUN_ON_STARTUP` in `.env` is `true` (the default),
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

Run the full offline unit suite from the workspace root:

```sh
npm run test
```

`npm test` and `npm run test:unit` are equivalent. Every suite runs even if another
fails, and the command returns a nonzero exit code if any suite fails.

The unit suites live in `services/tests/`. They exercise every application
function, including all 17 commands, configuration, parsing, ranking, history,
bot state, Greenhouse polling, Discord helpers, GitHub fetching, TCP connection
lifecycle, resume uploads, and entry-point event handlers. Dependencies are
stubbed at their boundaries; filesystem tests use memory or temporary directories.
The unit suite does not need credentials or network access and does not modify
the bot's saved data or connect to Discord/the backend.

To report application coverage and enforce 100% function coverage (verified with
Node.js 22.16.0):

```sh
npm run test:coverage
```

Live integration tests remain available separately. To run them, or run every
unit and integration suite together:

```sh
npm run test:integration
npm run test:all
```

`test:all` finishes with the total test count and passed/failed counts. If any
tests fail, it lists their names, file locations, and error details at the end.

Individual test scripts:

```sh
npm run test:internship-repo
npm run test:internship-content
npm run test:internship-parser
npm run test:internship-filter
npm run test:internship-config
```

The individual config tests run locally with isolated fixtures. The individual
repo, content, parser, and filter scripts include live GitHub smoke tests, so they
need network access and a configured `config.json`, and can benefit from
`GITHUB_TOKEN`.

`api/tests/resumeTestEvent.py` is a manual backend event sender, not an automated
assertion suite, and is not included in `npm test`.

## Troubleshooting

- `Missing required environment variable`: check that `bots/internships/.env`
  exists and includes all required values.
- Missing `config.json`: copy `example-config.json` to `config.json` and fill in
  your settings. Invalid JSON settings are reported with the affected key.
- Invalid Discord token: verify `DISCORD_TOKEN` is the bot token, not the client
  secret or application ID.
- Unknown Channel or Missing Access: verify `INTERNSHIP_CHANNEL_ID` in `.env`, confirm the
  bot is in the server, and grant channel access.
- Missing Permissions: grant View Channel, Send Messages, and Embed Links.
- Mention commands do not respond: enable Message Content Intent in the Discord
  Developer Portal.
- DM export commands fail: the requesting user must allow DMs from server
  members.
