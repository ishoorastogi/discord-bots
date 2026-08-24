# Discord Bots

Reusable Discord bot workspace.

Currently contains the **Internship Job Bot**, which automatically finds and posts recent engineering internships from a GitHub repository.

---

## Internship Job Bot

The Internship Job Bot reads the `README.md` from:

`vanshb03/Summer2027-Internships`

It parses the available internships, filters and ranks them, and posts a daily digest to Discord.

### Current Flow

```text
GitHub Repository
       ↓
README.md
       ↓
Internship Parser
       ↓
Engineering + US Filter
       ↓
Remove Duplicates
       ↓
Rank by Date
       ↓
Exclude Previously Sent
       ↓
Top 5
       ↓
Discord
```

The bot maintains a local history of previously posted internships in:

```text
bots/internships/data/sentInternships.json
```

---

## Features

### Automatic Digest

The bot runs automatically according to:

```env
INTERNSHIP_CRON_SCHEDULE=0 8 * * *
INTERNSHIP_TIMEZONE=America/Chicago
```

By default, this sends the internship digest every day at **8:00 AM Central Time**.

The bot can also run the digest immediately when it starts:

```env
RUN_ON_STARTUP=true
```

Set this to `false` to prevent a digest from being sent every time the bot starts.

### Duplicate Prevention

Previously sent internships are stored in:

```text
bots/internships/data/sentInternships.json
```

The bot uses a stable internship ID based on:

- Company
- Role
- Location
- Application URL

An internship will not be selected as a new internship if it has already been posted.

If fewer than 5 new internships are available, the bot fills the remaining slots with the current top internships.

### Engineering + US Filtering

The automatic digest currently selects internships that:

- Appear to be engineering-related
- Are US-based
- Are not duplicates
- Have the newest posting dates

---

# Commands

Commands are used by mentioning the bot followed by the command.

Example:

```text
@Internship Job Bot /help
```

## `/help`

Displays the available commands.

```text
@Internship Job Bot /help
```

## `/status`

Displays the current bot status, schedule, repository information, and number of previously sent internships.

```text
@Internship Job Bot /status
```

## `/random`

Sends 5 randomly selected internships from the previously posted internship history.

```text
@Internship Job Bot /random
```

This does not modify the internship history.

## `/sendmeall`

Direct messages the requesting user the complete `sentInternships.json` file.

```text
@Internship Job Bot /sendmeall
```

## `/cs`

Fetches the current GitHub internship data and sends the 5 newest Computer Science-related internships.

This command does **not** depend on `sentInternships.json`.

```text
@Internship Job Bot /cs
```

## `/clear`

Clears the previously posted internship history.

**Owner only.**

```text
@Internship Job Bot /clear
```

This resets:

```text
bots/internships/data/sentInternships.json
```

to an empty list.

## `/kill`

Shuts down the bot.

**Owner only.**

```text
@Internship Job Bot /kill
```

## `/mute`

Temporarily disables automatic internship digests.

**Owner only.**

```text
@Internship Job Bot /mute
```

The bot continues responding to commands while muted.

## `/unmute`

Re-enables automatic internship digests.

**Owner only.**

```text
@Internship Job Bot /unmute
```

Mute state is stored in:

```text
bots/internships/data/botState.json
```

and persists across restarts.

---

# Setup

## Requirements

- Node.js
- npm
- A Discord bot application
- A Discord server
- Access to the internship GitHub repository

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
DISCORD_GUILD_ID=YOUR_DISCORD_GUILD_ID

INTERNSHIP_CHANNEL_ID=YOUR_CHANNEL_ID

BOT_OWNER_ID=YOUR_DISCORD_USER_ID

SEND_STARTUP_TEST_MESSAGE=false

INTERNSHIP_CRON_SCHEDULE=0 8 * * *
INTERNSHIP_TIMEZONE=America/Chicago
RUN_ON_STARTUP=true

INTERNSHIP_REPO_OWNER=vanshb03
INTERNSHIP_REPO_NAME=Summer2027-Internships
INTERNSHIP_REPO_BRANCH=dev
INTERNSHIP_REPO_PATH=README.md

GITHUB_TOKEN=
```

### Discord Variables

`DISCORD_TOKEN`

Your Discord bot token.

`DISCORD_GUILD_ID`

The ID of the Discord server.

`INTERNSHIP_CHANNEL_ID`

The channel where automatic internship digests are posted.

`BOT_OWNER_ID`

Your personal Discord user ID.

This is used to restrict administrative commands:

- `/kill`
- `/clear`
- `/mute`
- `/unmute`

### GitHub Variables

The bot currently reads:

```text
vanshb03/Summer2027-Internships
```

from:

```text
branch: dev
path: README.md
```

`GITHUB_TOKEN` is optional because the repository is public.

If provided, the bot uses the token for authenticated GitHub API requests.

---

# Discord Bot Configuration

The bot requires the following Gateway Intent:

```text
Message Content Intent
```

This is required because commands are triggered through messages such as:

```text
@Internship Job Bot /help
```

The bot currently uses the Discord `Guilds`, `GuildMessages`, and `MessageContent` intents.

---

# Running the Bot

## Start

```bash
npm run start:internships
```

## Development

```bash
npm run dev:internships
```

The development command uses Node's watch mode and automatically restarts the bot when source files change.

---

# Testing

## Test GitHub Repository Connection

```bash
npm run test:internship-repo
```

## Test Repository Content

```bash
npm run test:internship-content
```

## Test Internship Parser

```bash
npm run test:internship-parser
```

## Test Internship Filter

```bash
npm run test:internship-filter
```

---

# Project Structure

```text
bots/
└── internships/
    ├── config.js
    ├── index.js
    ├── discordErrors.js
    ├── sendInternshipNotification.js
    │
    ├── data/
    │   ├── botState.json
    │   ├── sentInternships.json
    │   └── sendInternshipTemplate.json
    │
    ├── repos/
    │   ├── readInternshipRepo.js
    │   └── tests/
    │       ├── testRepoConnection.js
    │       └── testRepoContent.js
    │
    ├── services/
    │   ├── botState.js
    │   ├── getCurrentInternships.js
    │   ├── internshipFilter.js
    │   ├── internshipParser.js
    │   ├── internshipPoller.js
    │   ├── runInternshipDigest.js
    │   ├── seenJobsStore.js
    │   │
    │   ├── commands/
    │   │   ├── clearCommand.js
    │   │   ├── csCommand.js
    │   │   ├── handleMentionCommand.js
    │   │   ├── helpCommand.js
    │   │   ├── index.js
    │   │   ├── killCommand.js
    │   │   ├── muteCommand.js
    │   │   ├── randomCommand.js
    │   │   ├── sendMeAllCommand.js
    │   │   ├── statusCommand.js
    │   │   └── unmuteCommand.js
    │   │
    │   └── tests/
    │       ├── testInternshipFilter.js
    │       └── testInternshipParser.js
    │
    └── sources/
        └── greenhouse.js
```

---

# Internship History

The bot stores previously posted internships locally:

```text
bots/internships/data/sentInternships.json
```

Example entry:

```json
{
  "id": "roblox|software engineer intern 🇺🇸|san mateo, ca|https://careers.roblox.com/jobs/8072713",
  "company": "Roblox",
  "role": "Software Engineer Intern 🇺🇸",
  "location": "San Mateo, CA",
  "applicationUrl": "https://careers.roblox.com/jobs/8072713",
  "datePosted": "Aug 05"
}
```

This file is used to prevent the automatic digest from repeatedly posting the same internships.

---

# Administrative State

Automatic digest mute state is stored in:

```text
bots/internships/data/botState.json
```

Example:

```json
{
  "muted": false
}
```

---

# Notes

- The internship repository is public, so `GITHUB_TOKEN` is optional.
- The bot currently runs on macOS.
- Automatic digests use Central Time.
- Commands continue to work while the automatic digest is muted.
- `/cs` searches the current repository data and does not depend on previously posted internships.
- Owner-only commands are controlled using `BOT_OWNER_ID`.

---

# Future Improvements

Potential future improvements include:

- `/me` for Mechanical Engineering internships
- `/ee` for Electrical Engineering internships
- Better discipline classification
- More robust closed/inactive internship detection
- Improved duplicate detection
- Automated tests for commands
- Better Discord embeds
- Deployment to a server so the bot does not depend on a local Mac
- More sophisticated internship ranking
