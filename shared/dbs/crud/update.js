const { withTransaction } = require("../query");
const { userFields, insertQuery, matchingUsersQuery, uniqueUser } = require("./userQueries");

// Exact full names take priority; otherwise a unique name prefix may identify a user.
async function updateUserByName(name, updates, username, password) {
    const matchQuery = matchingUsersQuery(name, "prefix");
    let fields = userFields(updates);
    const rename = fields.find(([column]) => column === "name");
    if (rename && (typeof rename[1] !== "string" || !rename[1].trim())) throw new Error("Name is required.");
    return withTransaction(async client => {
        await client.query("LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE");
        const existing = uniqueUser((await client.query(matchQuery.sql, matchQuery.values)).rows);
        const errors = [];
        if (rename) {
            const query = matchingUsersQuery(rename[1]);
            const conflicts = (await client.query(query.sql, query.values)).rows;
            if (conflicts.some(row => row.user_id !== existing?.user_id)) {
                errors.push({ category: "name", value: rename[1], code: "AMBIGUOUS_USER",
                    message: "Another member already has that name. The name was not changed." });
                fields = fields.filter(field => field !== rename);
            }
        }
        if (!fields.length) return { created: false, user: existing ?? { name }, updatedColumns: [], errors };
        let query;
        if (existing) {
            const values = fields.map(([, value]) => value);
            values.push(existing.user_id);
            query = {
                sql: `UPDATE public.users SET ${fields.map(([column], i) => `"${column}" = $${i + 1}`).join(", ")} WHERE user_id = $${values.length} RETURNING *`,
                values,
            };
        } else {
            query = insertQuery(userFields({ name: name.trim().replace(/\s+/g, " "), ...Object.fromEntries(fields) }));
        }
        const { rows } = await client.query(query.sql, query.values);
        return { created: !existing, user: rows[0], updatedColumns: fields.map(([column]) => column), errors };
    }, username, password);
}

module.exports = { updateUserByName };
