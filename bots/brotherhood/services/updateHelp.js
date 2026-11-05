const { escapeMarkdown } = require("discord.js");
const { memberFileSchema } = require("./memberFileSchema");

function getUpdateHelp() {
    const categories = memberFileSchema.map(column => {
        const aliases = column.aliases?.length ?
            ` (also: ${column.aliases.map(alias => `\`${alias}\``).join(", ")})` : "";
        return `- \`${column.name}\`${aliases}`;
    });
    return [
        'Usage: `@Brotherhood Bot /update "Full Name" category value; category value`. Separate pairs with semicolons. Quote names with spaces and values containing semicolons; use `""` to clear an optional value.',
        'A unique first name or name prefix also works. Quote prefixes containing spaces, such as `"Sai K"`.',
        'Example: `@Brotherhood Bot /update "Ishan Rastogi" class Alpha Class; major Computer Science; grad year 2028`',
        "Available categories:",
        ...categories,
    ].join("\n");
}

function formatUpdateErrors(errors) {
    return errors.map(error => {
        const input = error.input ?? `${error.category} ${error.value ?? ""}`.trim();
        const label = error.pair ? `Pair ${error.pair} (${input || "empty pair"})` : input;
        return `${escapeMarkdown(label)}: ${escapeMarkdown(error.message)}`;
    });
}

module.exports = { getUpdateHelp, formatUpdateErrors };
