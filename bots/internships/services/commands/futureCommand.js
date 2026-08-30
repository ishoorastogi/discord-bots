async function execute(message) {
    await message.reply(
        [
            "**Future Plans!**",
            "",
            "The following commands are planned for the future (likely in the order they will be implemented):",
            "`/latest` - Top 5 most recent engineering internships, irrespective of field",
            "`/ai` - Top 5 most recent Artificial Intelligence internships",
            "`/ds` - Top 5 most recent Data Science internships",
            "`/sendmeme` - DM the previously sent Mechanical Engineering internships JSON file",
            "`/sendmeee` - DM the previously sent Electrical Engineering internships JSON file",
            "`/sendmebm` - DM the previously sent Biomedical Engineering internships JSON file",
            "`/sendmeai` - DM the previously sent Artificial Intelligence internships JSON file",
            "`/sendmeds` - DM the previously sent Data Science internships JSON file",
            "DM the bot owner if you have any suggestions for future commands!",
        ].join("\n")
    );
}

module.exports = {
    name: "/future",
    execute,
};