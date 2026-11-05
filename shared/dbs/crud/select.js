const { queryRows } = require("../query");
const { matchingUsersQuery } = require("./userQueries");

async function selectUsersByName(name, username, password) {
    const { sql, values } = matchingUsersQuery(name);
    return queryRows(sql, values, username, password);
}

async function selectUsersByNameOrNickname(query, username, password) {
    const { sql, values } = matchingUsersQuery(query, "lookup");
    return queryRows(sql, values, username, password);
}

async function selectUserById(userId, username, password) {
    const rows = await queryRows("SELECT * FROM public.users WHERE user_id = $1", [userId], username, password);
    return rows[0] ?? null;
}

async function selectUserByDiscordId(discordId, username, password) {
    const rows = await queryRows("SELECT * FROM public.users WHERE discord_id = $1", [discordId], username, password);
    return rows[0] ?? null;
}

module.exports = { selectUsersByName, selectUsersByNameOrNickname, selectUserById, selectUserByDiscordId };
