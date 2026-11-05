const { isBotOwner } = require("../botOwner");

async function execute(message, client, args) {
    if (!isBotOwner(message.author?.id)) {
        return { type: "delete", ok: false, message: "Only the bot owner can request deletion." };
    }
    let name = args.join(" ").trim().replace(/\s+/g, " ");
    if (name.startsWith('"') || name.startsWith("'")) {
        const quote = name[0];
        if (name.length < 2 || !name.endsWith(quote)) {
            return { type: "delete", ok: false, message: 'Usage: `@Brotherhood Bot /delete Full Name`.' };
        }
        name = name.slice(1, -1).trim();
    }
    if (!name) {
        return { type: "delete", ok: false, message: 'Usage: `@Brotherhood Bot /delete Full Name`.' };
    }
    return { type: "delete", ok: true, name };
}

module.exports = { name: "/delete", execute };
