async function execute(message) {
    await message.reply(
        [
            "**Brotherhood Bot Commands**",
            "",
            "Mention `@Brotherhood Bot` followed by one of these commands:",
            "`/brother Full Name` - Show all information about a person. Names, nicknames, and partial names work.",
            "`/fileintake` - Import an attached CSV or XLSX member file.",
            "`/test` - Check whether the bot is online.",
            "`/help` - Show this message.",
            "",
            "The following commands are only available to the bot owner:",
            '`/update "Full Name" category value; category value` - Update one or more fields. Valid pairs save even if others fail.',
            "`/delete Full Name` - Request deletion, then confirm with `@Brotherhood Bot yes` within 60 seconds. Use `@Brotherhood Bot no` to cancel.",
            "",
            "Names are case-insensitive. Unique name prefixes work for lookups and updates; ambiguous matches list the full-name options.",
            "",
            "Example: `@Brotherhood Bot /brother Ishan Rastogi`",
            'Update example: `@Brotherhood Bot /update "Ishan Rastogi" class Alpha Class; major Computer Science`',
        ].join("\n")
    );
}

module.exports = { name: "/help", execute };
