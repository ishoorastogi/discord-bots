const {
    logError,
} = require("../../../../shared/utils/logger");

const {
    commandMap,
} = require("./index");

async function handleMentionCommand(message, client, backend) {
    if (message.author.bot) {
        return;
    }

    if (!message.mentions.has(client.user)) {
        return;
    }

    const content = message.content
        .replace(/<@!?\d+>/g, "")
        .trim();

    const [rawCommandName, ...args] = content.split(/\s+/);
    const commandName = rawCommandName?.toLowerCase();

    const command = commandMap.get(commandName);

    if (!command) {
        await message.reply(
            "Unknown command. Use `@Internship Job Bot /help` to see available commands."
        );
        return;
    }

    try {
        await command.execute(message, client, backend, args);
    } catch (error) {
        logError(
            `Failed to execute ${commandName}`,
            error
        );

        await message.reply(
            "Something went wrong while running that command."
        );
    }
}

module.exports = {
    handleMentionCommand,
};