const {
    logError,
} = require("../../../../shared/utils/logger");

const {
    commandMap,
} = require("./index");

function createMentionHandler({
    routeResponse,
    handleDeleteConfirmation,
    hasDatabaseHandlers,
} = require("../router")) {

    async function handleMentionCommand(message, client) {
        if (message.author.bot) {
            return;
        }

        try {
            if (await handleDeleteConfirmation(message, client)) {
                return;
            }
        } catch (error) {
            logError("Failed to handle a deletion confirmation.", error);
            return;
        }

        if (!message.mentions.users.has(client.user.id)) {
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
                "Unknown command. Use `@Brotherhood Bot /help` to see available commands."
            );
            return;
        }

        if (!hasDatabaseHandlers && ["/brother", "/delete", "/update", "/fileintake"].includes(commandName)) {
            await routeResponse(message, { type: commandName.slice(1) === "fileintake" ? "fileIntake" : commandName.slice(1) });
            return;
        }

        try {
            const response = await command.execute(message, client, args);
            await routeResponse(message, response);
        } catch (error) {
            logError(`Failed to execute ${commandName}`, error);
            await message.reply("Something went wrong while running that command.");
        }
    }

    return handleMentionCommand;
}

module.exports = { handleMentionCommand: createMentionHandler(), createMentionHandler };
