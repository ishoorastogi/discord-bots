# discord-bots

Reusable Node.js Discord bot workspace. The first bot posts internship job notifications to a configured Discord channel.

## Folder structure

```text
discord-bots/
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── node_modules/
├── bots/
│   └── internships/
│       ├── index.js
│       ├── config.js
│       ├── logger.js
│       └── sendInternshipNotification.js
└── README.md
```

## Environment variables

Create `.env` from `.env.example` and provide real values:

```text
DISCORD_TOKEN=your_discord_bot_token_here
INTERNSHIP_CHANNEL_ID=your_internship_channel_id_here
```

Never commit `.env` or paste token values into logs, source files, or issues.

## Bot invitation requirements

Invite the bot to the server with the `bot` scope. The bot does not need privileged gateway intents for the current internship notification flow.

The configured internship channel must allow the bot:

- View Channel
- Send Messages
- Embed Links

## Install

```sh
npm install
```

Dependencies are already represented by `package.json` and `package-lock.json`.

## Development

```sh
npm run dev:internships
```

## Production

```sh
npm run start:internships
```

## Troubleshooting

Discord error `50001 Missing Access` means the code reached Discord, but Discord refused access to the configured channel. The bot may not be in the server, may not have access to `INTERNSHIP_CHANNEL_ID`, or may be missing View Channel / Send Messages permissions. The code cannot grant those permissions; update the server or channel permissions in Discord, then restart the bot.
