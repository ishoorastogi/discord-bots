const cron = require("node-cron");
const { Events } = require("discord.js");

const {
  isMuted,
} = require("./services/botState");

const {
  handleMentionCommand,
} = require("./services/commands/handleMentionCommand");

const {
  createClient,
} = require("../../shared/discord/createClient");

const {
  logInfo,
  logError,
} = require("../../shared/utils/logger");

const {
  loadConfig,
} = require("./config");

const {
  runInternshipDigest,
} = require("./services/runInternshipDigest");

const config = loadConfig();
const client = createClient();

async function runDigest() {
  try {
    if (await isMuted()) {
      logInfo(
        "Internship digest skipped because the bot is muted."
      );
      return;
    }

    const internships = await runInternshipDigest({
      client,
      channelId: config.internshipChannelId,
      limit: 5,
    });

    logInfo(
      `Sent ${internships.length} internships to Discord.`
    );
  } catch (error) {
    logError(
      "Failed to run internship digest",
      error
    );
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  logInfo(
    `Logged in as ${readyClient.user.tag}`
  );

  cron.schedule(
    config.cronSchedule,
    runDigest,
    {
      timezone: config.timezone,
    }
  );

  logInfo(
    `Internship digest scheduled: ${config.cronSchedule} (${config.timezone})`
  );

  if (config.runOnStartup) {
    logInfo("RUN_ON_STARTUP enabled. Running internship digest.");

    await runDigest();
  }
});

client.on("error", (error) => {
  logError("Discord client error", error);
});

client.on(Events.MessageCreate, async (message) => {
  await handleMentionCommand(
    message,
    client
  );
});

client.login(config.discordToken);