const { isDeepStrictEqual } = require("node:util");
const { withTransaction } = require("../query");
const { matchingUsersQuery, uniqueUser } = require("./userQueries");

async function deleteUserByName(name, expectedUser, username, password) {
    const query = matchingUsersQuery(name);
    return withTransaction(async client => {
        await client.query("LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE");
        const existing = uniqueUser((await client.query(query.sql, query.values)).rows);
        if (!existing) return null;
        if (expectedUser && !isDeepStrictEqual(existing, expectedUser)) {
            const error = new Error("That member's record changed after confirmation. Request deletion again. No records were deleted.");
            error.code = "MEMBER_CHANGED";
            throw error;
        }
        await client.query("DELETE FROM public.users WHERE user_id = $1", [existing.user_id]);
        return existing;
    }, username, password);
}

module.exports = { deleteUserByName };
