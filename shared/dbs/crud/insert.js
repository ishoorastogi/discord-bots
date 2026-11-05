const { queryRows, withTransaction } = require("../query");
const { userFields, insertQuery, matchingUsersQuery, uniqueUser } = require("./userQueries");

async function insertUser(user, username, password) {
    const { sql, values } = insertQuery(userFields(user));
    const rows = await queryRows(sql, values, username, password);
    return rows[0];
}

async function upsertUser(user, username, password) {
    const fields = userFields(user);
    if (!Object.hasOwn(user, "name") || typeof user.name !== "string" || !user.name.trim()) {
        throw new Error("Upsert requires a name to identify an existing user.");
    }
    return withTransaction(async client => {
        // Names have no unique constraint. Serialize writes so concurrent calls
        // cannot both insert the same missing name or change a match mid-update.
        await client.query("LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE");
        const query = matchingUsersQuery(user.name);
        const { rows: matches } = await client.query(query.sql, query.values);
        uniqueUser(matches);
        if (!matches.length) {
            const { sql, values } = insertQuery(fields);
            return (await client.query(sql, values)).rows[0];
        }
        const updates = fields.filter(([column]) => column !== "name");
        if (!updates.length) return matches[0];
        const values = updates.map(([, value]) => value);
        values.push(matches[0].user_id);
        const assignments = updates.map(([column], i) => `"${column}" = $${i + 1}`);
        const { rows } = await client.query(
            `UPDATE public.users SET ${assignments.join(", ")} WHERE user_id = $${values.length} RETURNING *`, values,
        );
        return rows[0];
    }, username, password);
}

async function insertUsers(users, username, password) {
    if (!Array.isArray(users)) throw new TypeError("Provide an array of users.");
    const queries = users.map(user => insertQuery(userFields(user)));
    return withTransaction(async client => {
        const rows = [];
        for (const { sql, values } of queries) rows.push((await client.query(sql, values)).rows[0]);
        return rows;
    }, username, password);
}

module.exports = { insertUser, insertUsers, upsertUser };
