const { escapeMarkdown } = require("discord.js");
const database = require("../api/dbs-client");
const { logError } = require("../../../shared/utils/logger");
const { isBotOwner } = require("./botOwner");
const { getUpdateHelp, formatUpdateErrors } = require("./updateHelp");
const { memberFileSchema } = require("./memberFileSchema");

const CONFIRMATION_TIMEOUT_MS = 60_000;
const pendingDeletions = new Map();

function confirmationKey(message) {
    return JSON.stringify([message.guildId ?? null, message.channelId, message.author.id]);
}

function clearDeletion(key) {
    const pending = pendingDeletions.get(key);
    if (pending) {
        clearTimeout(pending.timer);
        pendingDeletions.delete(key);
    }
}

async function requestDeletion(message, response) {
    if (!response.ok) {
        await replyLines(message, [response.message]);
        return;
    }
    const key = confirmationKey(message);
    if (!isBotOwner(message.author.id)) {
        clearDeletion(key);
        await replyLines(message, ["Only the bot owner can request deletion."]);
        return;
    }
    // A new delete request replaces this requester's previous one in this channel.
    clearDeletion(key);
    try {
        const member = await database.findMember(response.name);
        if (!member) {
            await replyLines(message, [`No member named ${escapeMarkdown(response.name)} was found.`]);
            return;
        }
        const prompt = await message.reply({
            content: `Delete ${escapeMarkdown(member.name)} from the database? Confirm with \`@Brotherhood Bot yes\` in this channel, or reply directly to this prompt with \`yes\` while mentioning the bot. Use \`@Brotherhood Bot no\` to cancel. This expires in 60 seconds.`,
            allowedMentions: { parse: [], repliedUser: false },
        });
        const pending = {
            member, promptId: prompt.id, expiresAt: Date.now() + CONFIRMATION_TIMEOUT_MS,
        };
        pending.timer = setTimeout(() => {
            if (pendingDeletions.get(key) === pending) {
                pendingDeletions.delete(key);
            }
        }, CONFIRMATION_TIMEOUT_MS);
        pending.timer.unref();
        pendingDeletions.set(key, pending);
    } catch (error) {
        logError("Failed to prepare a member deletion.", error);
        await replyLines(message, [error.code === "AMBIGUOUS_MEMBER" ? error.message :
            "Could not prepare the deletion. No records were deleted."]);
    }
}

async function handleDeleteConfirmation(message, client) {
    if (message.author.bot) {
        return false;
    }
    const key = confirmationKey(message);
    const pending = pendingDeletions.get(key);
    if (!pending) {
        return false;
    }
    if (!isBotOwner(message.author.id)) {
        clearDeletion(key);
        return false;
    }
    if (pending.expiresAt <= Date.now()) {
        clearDeletion(key);
        return false;
    }
    if (message.reference?.messageId && message.reference.messageId !== pending.promptId) {
        return false;
    }
    const answer = message.content
        .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
        .trim().toLowerCase();
    if (answer !== "yes" && answer !== "no") {
        return false;
    }

    // Consume before awaiting I/O so repeated confirmations cannot delete twice.
    clearDeletion(key);
    if (answer === "no") {
        await replyLines(message, ["Deletion cancelled. No records were deleted."]);
        return true;
    }
    let content;
    try {
        const deleted = await database.deleteMember(pending.member.name, pending.member);
        content = deleted.deleted ? `Deleted ${escapeMarkdown(deleted.name)} from the database.` :
            "That member is no longer in the database. No records were deleted.";
    } catch (error) {
        logError("Failed to delete a member from the local test database.", error);
        content = ["AMBIGUOUS_MEMBER", "MEMBER_CHANGED"].includes(error.code) ? error.message :
            "Could not delete the member from the local test database. No records were deleted.";
    }
    await replyLines(message, [content]);
    return true;
}

function errorLocation(error) {
    const parts = [];
    if (error.sheet) {
        parts.push(`Sheet ${error.sheet}`);
    }
    if (error.line) {
        const label = error.sheet ? "Row" : "Line";
        parts.push(error.endLine && error.endLine !== error.line ?
            `${label}s ${error.line}-${error.endLine}` : `${label} ${error.line}`);
    }
    if (error.column) {
        parts.push(`column ${error.column}`);
    }
    return parts.length ? `${parts.join(", ")}: ` : "File: ";
}

async function routeResponse(message, response) {
    if (!response) {
        return;
    }

    if (response.type === "brother") {
        let lines;
        if (!response.ok) {
            lines = [response.message];
        } else {
            try {
                const member = await database.findBrother(response.query);
                if (!member) {
                    lines = [`No brother was found with the name or nickname ${escapeMarkdown(response.query)}.`];
                } else {
                    const fields = new Map(memberFileSchema.map(column => [column.name, member[column.name]]));
                    for (const [key, value] of Object.entries(member)) {
                        fields.set(key, value);
                    }
                    lines = ["**Brother information**", ...[...fields].map(([key, value]) => {
                        const label = key === "linkedin link" ? "LinkedIn link" : key[0].toUpperCase() + key.slice(1);
                        const missing = value === null || value === undefined ||
                            (typeof value === "string" && !value.trim()) ||
                            (Array.isArray(value) && !value.length);
                        const text = missing ? "Not provided" : Array.isArray(value) ?
                            value.map(value => typeof value === "object" ? JSON.stringify(value) : String(value)).join(", ") :
                            typeof value === "object" ? JSON.stringify(value) : String(value);
                        return `**${escapeMarkdown(label)}:** ${escapeMarkdown(text)}`;
                    })];
                }
            } catch (error) {
                if (error.code === "AMBIGUOUS_MEMBER") {
                    lines = error.options?.length ? [
                        "More than one brother matches. Which person did you mean?",
                        ...error.options.map(name => `- ${escapeMarkdown(String(name))}`),
                        "Please use `@Brotherhood Bot /brother Full Name` with one of these names, or provide a more specific name or nickname.",
                    ] : [error.message];
                } else {
                    logError("Failed to look up a brother in the local test database.", error);
                    lines = ["Could not retrieve that brother's information from the local test database."];
                }
            }
        }
        await replyLines(message, lines);
        return;
    }

    if (response.type === "delete") {
        await requestDeletion(message, response);
        return;
    }

    if (response.type === "update") {
        let content;
        const clarification = [];
        const errors = [...(response.errors || [])];
        if (!isBotOwner(message.author?.id)) {
            content = "Only the bot owner can update members.";
        } else if (!response.ok) {
            content = response.message;
        } else {
            try {
                const saved = response.updates ?
                    await database.updateMemberFields(response.name, response.updates) :
                    await database.updateMember(response.name, response.category, response.value);
                const name = escapeMarkdown(saved.name);
                const categories = saved.categories || [saved.category];
                const category = categories.map(category => escapeMarkdown(category)).join(", ");
                errors.push(...(saved.errors || []));
                content = !categories.length ? `No fields were updated for ${name}.` :
                    saved.created ? `Added ${name} and set ${category}.` : `Updated ${category} for ${name}.`;
            } catch (error) {
                if (error.code !== "AMBIGUOUS_MEMBER") {
                    logError("Failed to update a member in the local test database.", error);
                }
                content = error.code === "AMBIGUOUS_MEMBER" ? error.message :
                    "Could not update the local test database. No changes were saved.";
                if (error.code === "AMBIGUOUS_MEMBER" && error.options?.length) {
                    clarification.push(
                        "Which member did you mean? Use a longer name or one of these full names:",
                        ...error.options.map(name => `- ${escapeMarkdown(String(name))}`),
                        getUpdateHelp(),
                    );
                }
            }
        }
        const lines = [content, ...clarification];
        if (isBotOwner(message.author?.id) && errors.length) {
            lines.push("Failed pairs:", ...formatUpdateErrors(errors), getUpdateHelp());
        }
        await replyLines(message, lines);
        return;
    }

    if (response.type !== "fileIntake") {
        return;
    }

    const lines = response.message ? [response.message] : [];
    for (const file of response.files) {
        const name = escapeMarkdown(file.fileName || "attachment");
        if (file.ok) {
            try {
                const members = file.sheets.flatMap(sheet => sheet.rows.map(row => row.data));
                const saved = await database.addMembers(members);
                lines.push(`Imported ${name} successfully (${saved.added} ${saved.added === 1 ? "record" : "records"} saved).`);
            } catch (error) {
                logError("Failed to save uploaded members to the local test database.", error);
                lines.push(`Could not save ${name} to the local test database. No records from this file were added.`);
            }
        } else {
            lines.push(`Could not parse ${name}:`);
            for (const error of file.errors) {
                lines.push(escapeMarkdown(errorLocation(error) + error.message));
            }
        }
    }

    await replyLines(message, lines);
}

async function replyLines(message, lines) {
    // Keep every response while respecting Discord's 2,000-character message limit.
    let content = "";
    async function send() {
        if (content) {
            await message.reply({ content, allowedMentions: { parse: [], repliedUser: false } });
            content = "";
        }
    }
    for (const line of lines) {
        let remaining = line;
        if (content && content.length + 1 + remaining.length > 2000) {
            await send();
        }
        while (remaining.length > 2000) {
            content = remaining.slice(0, 2000);
            await send();
            remaining = remaining.slice(2000);
        }
        content += (content ? "\n" : "") + remaining;
    }
    await send();
}

module.exports = { routeResponse, handleDeleteConfirmation };
