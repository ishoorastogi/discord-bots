async function execute(message) {
    await message.reply(
        [
            "**Internship Bot Commands**",
            "",
            "`@Internship Job Bot /cs` - Top 5 most recent CS internships",
            "`@Internship Job Bot /me` - Top 5 most recent Mechanical Engineering internships **Under construction**",
            "`@Internship Job Bot /ee` - Top 5 most recent Electrical Engineering internships",
            "`@Internship Job Bot /latest` - Top 5 most recent engineering internships",
            "`@Internship Job Bot /random` - 5 random previously sent internships",
            "`@Internship Job Bot /sendmeall` - DM the internship history JSON file",
            "`@Internship Job Bot /sendmecs` - DM the previously sent CS internships JSON file",
            "`@Internship Job Bot /status` - Show bot status",
            "`@Internship Job Bot /help` - Show this message",
            "The following commands are only available to the bot owner:",
            "`@Internship Job Bot /kill` - Shutdown the bot",
            "`@Internship Job Bot /clear` - Clear the internship history",
            "`@Internship Job Bot /mute` - Mute the bot (pause automatic internship messages)",
            "`@Internship Job Bot /unmute` - Unmute the bot (resume automatic internship messages)",
        ].join("\n")
    );
}

module.exports = {
    name: "/help",
    execute,
};