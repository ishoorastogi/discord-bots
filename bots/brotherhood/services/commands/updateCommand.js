const { getMemberCategory } = require("../memberFileSchema");
const { isBotOwner } = require("../botOwner");
const { getUpdateHelp, formatUpdateErrors } = require("../updateHelp");

function tokenize(input) {
    const groups = [{ tokens: [] }];
    let remaining = input.trim();
    while (remaining) {
        const quote = remaining[0];
        if (quote === ";") {
            groups.push({ tokens: [] });
            remaining = remaining.slice(1).trimStart();
        } else if (quote === '"' || quote === "'") {
            const end = remaining.indexOf(quote, 1);
            if (end === -1 || (remaining[end + 1] && !/[\s;]/.test(remaining[end + 1]))) {
                groups.at(-1).error = "Quotes must be closed and followed by a space or semicolon. Remaining text could not be parsed.";
                groups.at(-1).input = [...groups.at(-1).tokens, remaining].join(" ");
                break;
            }
            groups.at(-1).tokens.push(remaining.slice(1, end));
            remaining = remaining.slice(end + 1).trimStart();
        } else {
            const token = remaining.match(/^[^\s;]+/)[0];
            groups.at(-1).tokens.push(token);
            remaining = remaining.slice(token.length).trimStart();
        }
    }
    return groups;
}

function reject(message, includeHelp = true) {
    return {
        type: "update",
        ok: false,
        message: includeHelp ? [message, getUpdateHelp()].join("\n") : message,
    };
}

async function execute(message, client, args) {
    if (!isBotOwner(message.author?.id)) {
        return reject("Only the bot owner can update members.", false);
    }
    let groups;
    try {
        groups = tokenize(args.join(" "));
    } catch (error) {
        return reject(error.message);
    }
    const [rawName, ...rest] = groups[0].tokens;
    const name = rawName?.trim().replace(/\s+/g, " ");
    if (!name) {
        return reject("Provide a name, category, and new value.");
    }

    const updates = [];
    const errors = [];
    const seen = new Set();
    for (const [index, group] of groups.entries()) {
        const pair = index === 0 ? rest : group.tokens;
        const fail = message => errors.push({ pair: index + 1, input: group.input ?? pair.join(" "), message });
        if (group.error) {
            fail(group.error);
            continue;
        }
        if (!pair.length) {
            fail("Each category/value pair must include a category and new value.");
            continue;
        }
        // Longest matching label supports categories such as "phone number" and "grad year".
        let category;
        let categoryLength;
        const maximumLength = pair.at(-1) === "" ? pair.length - 1 : pair.length;
        for (let length = maximumLength; length > 0; length--) {
            category = getMemberCategory(pair.slice(0, length).join(" "));
            if (category) {
                categoryLength = length;
                break;
            }
        }
        if (!category) {
            fail("Unknown category.");
            continue;
        }
        if (categoryLength === pair.length) {
            fail(`Provide a new value for ${category.name}.`);
            continue;
        }
        if (seen.has(category.name)) {
            fail(`Category ${category.name} was provided more than once. Use each category once.`);
            continue;
        }
        const value = pair.slice(categoryLength).join(" ").trim();
        const validationError = category.validate?.(value);
        if (validationError) {
            fail(validationError);
            continue;
        }
        seen.add(category.name);
        updates.push({ category: category.name, value: category.normalize ? category.normalize(value) : value });
    }
    if (!updates.length) {
        return reject(["No fields were updated.", ...formatUpdateErrors(errors)].join("\n"));
    }
    if (groups.length === 1 && !errors.length) {
        return { type: "update", ok: true, name, ...updates[0] };
    }
    return { type: "update", ok: true, name, updates, ...(errors.length ? { errors } : {}) };
}

module.exports = { name: "/update", execute };
