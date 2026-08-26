async function execute(message) {
    await message.reply(
        [
            "**Internship Bot Commands**",
            "",
            "To use the bot, simply type `@Internship Job Bot` followed by one of the following commands:",
            "`/xx` - Top 5 most recent internships in the specified field. Available fields: /cs, /me, /ee, /bm",
            "`/random` - 5 random previously sent internships",
            "`/sendmeall` - DM the internship history JSON file",
            "`/sendmecs` - DM the previously sent CS internships JSON file",
            "`/status` - Show bot status",
            "`/help` - Show this message",
            "`/future` - Show future planned commands",
            "The following commands are only available to the bot owner:",
            "`/kill` - Shutdown the bot",
            "`/clear` - Clear the internship history",
            "`/mute` - Mute the bot (pause automatic internship messages)",
            "`/unmute` - Unmute the bot (resume automatic internship messages)",
            "",
            "Example: `@Internship Job Bot /cs` will return the 5 most recent CS internships.",
        ].join("\n")
    );
}

module.exports = {
    name: "/help",
    execute,
};
