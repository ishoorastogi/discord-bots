const pg = require("pg");
const config = require("./config");

async function withClient(operation, username, password) {
    if (typeof username !== "string" || !username.trim() || typeof password !== "string" || !password.length) {
        throw new TypeError("Pass a database username and password as arguments.");
    }
    const client = new pg.Client({
        ...config.getDatabaseConnectionConfig(),
        user: username,
        password,
        connectionTimeoutMillis: 5000,
        query_timeout: 5000,
    });
    try {
        await client.connect();
        return await operation(client);
    } finally {
        await client.end();
    }
}

async function queryRows(sql, values, username, password) {
    return withClient(async client => (await client.query(sql, values)).rows, username, password);
}

async function withTransaction(operation, username, password) {
    return withClient(async client => {
        await client.query("BEGIN");
        try {
            const result = await operation(client);
            await client.query("COMMIT");
            return result;
        } catch (error) {
            await client.query("ROLLBACK").catch(() => {});
            throw error;
        }
    }, username, password);
}

module.exports = { queryRows, withTransaction };
