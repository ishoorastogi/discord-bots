const USAGE = 'Usage: `@Brotherhood Bot /brother Full Name` or `@Brotherhood Bot /brother nickname`. Example: `@Brotherhood Bot /brother Ishan Rastogi`.';

async function execute(message, client, args) {
    let query = args.join(" ").trim().replace(/\s+/g, " ");
    if (query.startsWith('"') || query.startsWith("'")) {
        const quote = query[0];
        if (query.length < 2 || !query.endsWith(quote)) {
            return { type: "brother", ok: false, message: USAGE };
        }
        query = query.slice(1, -1).trim();
    }
    if (!query) {
        return { type: "brother", ok: false, message: USAGE };
    }
    // The mention handler passes this lookup request to the router.
    return { type: "brother", ok: true, query };
}

module.exports = { name: "/brother", execute };
