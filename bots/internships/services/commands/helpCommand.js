async function execute(message) {
    await message.reply(
        [
            "**Internship Bot Commands**",
            "",
            "`@Internship Job Bot /xx` - Top 5 most recent internships in the specified field. Available fields: cs, me, ee, bm",
            "`@Internship Job Bot /me` - Top 5 most recent Mechanical Engineering internships",
            "`@Internship Job Bot /ee` - Top 5 most recent Electrical Engineering internships",
            "`@Internship Job Bot /bm` - Top 5 most recent Biomedical Engineering internships",
            "`@Internship Job Bot /ai` - Top 5 most recent Artificial Intelligence internships //future",
            "`@Internship Job Bot /ds` - Top 5 most recent Data Science internships //future",
            "`@Internship Job Bot /latest` - Top 5 most recent engineering internships //future",
            "`@Internship Job Bot /random` - 5 random previously sent internships",
            "`@Internship Job Bot /sendmeall` - DM the internship history JSON file",
            "`@Internship Job Bot /sendmecs` - DM the previously sent CS internships JSON file",
            "`@Internship Job Bot /sendmeme` - DM the previously sent Mechanical Engineering internships JSON file //future",
            "`@Internship Job Bot /sendmeee` - DM the previously sent Electrical Engineering internships JSON file //future",
            "`@Internship Job Bot /sendmebme` - DM the previously sent Biomedical Engineering internships JSON file //future",
            "`@Internship Job Bot /sendmeai` - DM the previously sent Artificial Intelligence internships JSON file //future",
            "`@Internship Job Bot /sendmeds` - DM the previously sent Data Science internships JSON file //future",
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
