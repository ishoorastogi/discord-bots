async function execute(message) {
    await message.reply("bot is online");
}

module.exports = {
    name: "/test",
    execute,
};
