const userColumns = new Set([
    "discord_id", "name", "email", "phone", "class", "major", "grad_year",
    "positions_held", "family_line", "nicknames", "brotherhood_status",
    "linkedin_link", "big", "littles", "employer",
]);

function userFields(user) {
    if (!user || typeof user !== "object" || Array.isArray(user)) {
        throw new TypeError("Provide a user record using database column names.");
    }
    const fields = Object.entries(user);
    for (const [column] of fields) {
        if (!userColumns.has(column)) throw new Error(`Unsupported user column: ${column}`);
    }
    const provided = fields.filter(([, value]) => value !== undefined);
    if (!provided.length) throw new Error("Provide at least one user field.");
    if (user.discord_id != null && typeof user.discord_id !== "string") {
        throw new TypeError("Discord IDs must be strings to preserve their digits.");
    }
    return provided;
}

function insertQuery(fields) {
    const columns = fields.map(([column]) => `"${column}"`);
    const values = fields.map(([, value]) => value);
    const sql = `INSERT INTO public.users (${columns.join(", ")}) VALUES (${values.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`;
    return { sql, values };
}

function normalizedSql(expression) {
    return `LOWER(BTRIM(regexp_replace(COALESCE(${expression}, ''), '\\s+', ' ', 'g')))`;
}

function matchingUsersQuery(name, mode = "exact") {
    if (typeof name !== "string" || !name.trim()) throw new Error("Provide a name or nickname.");
    const value = name.trim().replace(/\s+/g, " ").toLowerCase();
    const normalizedName = normalizedSql("name");
    let predicate = `${normalizedName} = $1`;
    if (mode === "prefix") predicate = `strpos(${normalizedName}, $1) = 1`;
    if (mode === "lookup") {
        predicate = `strpos(${normalizedName}, $1) > 0 OR ${normalizedSql("nicknames")} = $1 OR EXISTS (
            SELECT 1 FROM regexp_split_to_table(COALESCE(nicknames, ''), '[,;\\r\\n]+') AS nickname(value)
            WHERE strpos(${normalizedSql("nickname.value")}, $1) > 0
        )`;
    }
    const sql = `WITH candidates AS (SELECT * FROM public.users WHERE ${predicate})
        SELECT * FROM candidates WHERE ${normalizedName} = $1
            OR NOT EXISTS (SELECT 1 FROM candidates WHERE ${normalizedName} = $1)
        ORDER BY user_id`;
    return { sql, values: [value] };
}

function uniqueUser(rows) {
    if (rows.length > 1) {
        const error = new Error("More than one member matches that name. Use a unique full name or nickname.");
        error.code = "AMBIGUOUS_USER";
        error.options = [...new Set(rows.map(row => row.name))];
        throw error;
    }
    return rows[0] ?? null;
}

module.exports = { userFields, insertQuery, matchingUsersQuery, uniqueUser };
