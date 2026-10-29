const {
    loadConfig,
    setBackendPort,
} = require("../../config");

async function execute(message, client, backend, args = []) {
    const { botOwnerId } = loadConfig();

    if (!botOwnerId || message.author.id !== botOwnerId) {
        await message.reply(
            "You do not have permission to use this command."
        );
        return;
    }

    if (args.length !== 1 || !/^[1-9]\d{3}$/.test(args[0])) {
        await message.reply(
            "Usage: `@Internship Job Bot /port ####`. Enter a four-digit port (1000-9999)."
        );
        return;
    }

    const port = Number(args[0]);
    setBackendPort(port);

    await message.reply(
        `Backend port updated to ${port} in config.json. Restart the bot to connect using the new port.`
    );
}

module.exports = {
    name: "/port",
    execute,
};
