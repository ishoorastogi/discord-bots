const { EmbedBuilder } = require("discord.js");

const { loadConfig } = require("./config");
const { sendMessage } = require("../../shared/discord/sendMessage");
const { explainDiscordError } = require("./discordErrors");

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

  const { internshipChannelId } = loadConfig();
  const embed = buildInternshipEmbed(internship);

  try {
    return await sendMessage(client, internshipChannelId, { embeds: [embed] });
  } catch (error) {
    const wrappedError = new Error(`Failed to send internship notification. ${explainDiscordError(error)}`);
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
module.exports.validateInternship = validateInternship;
