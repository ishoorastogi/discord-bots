const { EmbedBuilder } = require("discord.js");

const { loadConfig } = require("./config");
const { explainDiscordError } = require("./logger");

const REQUIRED_FIELDS = ["company", "role"];

function validateInternship(internship) {
  if (!internship || typeof internship !== "object") {
    throw new Error("Internship notification requires an internship object.");
  }

  for (const field of REQUIRED_FIELDS) {
    if (!hasText(internship[field])) {
      throw new Error(`Internship notification missing required field: ${field}`);
    }
  }

  if (internship.url && !isValidUrl(internship.url)) {
    throw new Error("Internship notification has an invalid application URL.");
  }
}

async function sendInternshipNotification(client, internship) {
  validateInternship(internship);

  if (!client || !client.channels || typeof client.channels.fetch !== "function") {
    throw new Error("Internship notification requires a logged-in Discord client.");
  }

  const { internshipChannelId } = loadConfig();
  const channel = await fetchConfiguredChannel(client, internshipChannelId);
  assertSendableChannel(channel);

  const embed = buildInternshipEmbed(internship);

  try {
    return await channel.send({ embeds: [embed] });
  } catch (error) {
    const wrappedError = new Error(`Failed to send internship notification. ${explainDiscordError(error)}`);
    wrappedError.code = error.code;
    wrappedError.status = error.status;
    wrappedError.cause = error;
    throw wrappedError;
  }
}

async function fetchConfiguredChannel(client, channelId) {
  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
      const error = new Error("Discord returned no channel for the configured internship channel ID.");
      error.code = 10003;
      throw error;
    }

    return channel;
  } catch (error) {
    const wrappedError = new Error(`Failed to fetch internship notification channel. ${explainDiscordError(error)}`);
    wrappedError.code = error.code;
    wrappedError.status = error.status;
    wrappedError.cause = error;
    throw wrappedError;
  }
}

function buildInternshipEmbed(internship) {
  const postedAt = internship.postedAt ? new Date(internship.postedAt) : undefined;
  const embed = new EmbedBuilder()
    .setColor(0x2f855a)
    .setTitle(`${internship.company} - ${internship.role}`)
    .setTimestamp(new Date());

  if (hasText(internship.url)) {
    embed.setURL(internship.url.trim());
  }

  addField(embed, "Company", internship.company);
  addField(embed, "Role", internship.role);
  addField(embed, "Location", internship.location);
  addField(embed, "Source", internship.source);

  if (postedAt && !Number.isNaN(postedAt.getTime())) {
    addField(embed, "Posted", postedAt.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }));
  }

  addField(embed, "Apply", internship.url);

  return embed;
}

function addField(embed, name, value) {
  if (!hasText(value)) {
    return;
  }

  embed.addFields({
    name,
    value: String(value).trim(),
    inline: name !== "Apply",
  });
}

function assertSendableChannel(channel) {
  if (!channel) {
    throw new Error("Cannot send internship notification because the Discord channel was not found.");
  }

  if (typeof channel.isTextBased !== "function" || !channel.isTextBased()) {
    throw new Error("Cannot send internship notification because the configured channel is not text-based.");
  }

  if (!isSendable(channel)) {
    throw new Error("Cannot send internship notification because the configured channel is not sendable.");
  }
}

function isSendable(channel) {
  if (typeof channel.isSendable === "function") {
    return channel.isSendable();
  }

  return typeof channel.send === "function";
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

module.exports = sendInternshipNotification;
module.exports.buildInternshipEmbed = buildInternshipEmbed;
module.exports.fetchConfiguredChannel = fetchConfiguredChannel;
module.exports.validateInternship = validateInternship;
