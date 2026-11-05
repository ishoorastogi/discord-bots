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

async function upsertUsers(users, username, password) {
    if (!Array.isArray(users)) {
        throw new TypeError("Provide an array of users.");
    }

    const seen = new Set();

    const records = users.map(user => {
        if (
            !user ||
            typeof user.name !== "string" ||
            !user.name.trim()
        ) {
            throw new Error("Every user must have a name.");
        }

        const name = user.name.trim().replace(/\s+/g, " ");
        const key = name.toLowerCase();

        if (seen.has(key)) {
            throw new Error(`Duplicate member in uploaded file: ${name}`);
        }

        seen.add(key);

        return {
            name,
            fields: userFields({ ...user, name }),
        };
    });

    return withTransaction(async client => {
        await client.query(
            "LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE"
        );

        const results = [];

        for (const { name, fields } of records) {
            const query = matchingUsersQuery(name);
            const { rows: matches } = await client.query(
                query.sql,
                query.values
            );

            uniqueUser(matches);

            if (!matches.length) {
                const { sql, values } = insertQuery(fields);
                const { rows } = await client.query(sql, values);

                results.push({
                    action: "inserted",
                    user: rows[0],
                });

                continue;
            }

            const updates = fields.filter(
                ([column]) => column !== "name"
            );

            if (!updates.length) {
                results.push({
                    action: "unchanged",
                    user: matches[0],
                });
                continue;
            }

            const values = updates.map(([, value]) => value);
            values.push(matches[0].user_id);

            const assignments = updates.map(
                ([column], index) => `"${column}" = $${index + 1}`
            );

            const { rows } = await client.query(
                `UPDATE public.users
                 SET ${assignments.join(", ")}
                 WHERE user_id = $${values.length}
                 RETURNING *`,
                values
            );

            results.push({
                action: "updated",
                user: rows[0],
            });
        }

        return results;
    }, username, password);
}

module.exports = { insertUser, insertUsers, upsertUser, upsertUsers };
