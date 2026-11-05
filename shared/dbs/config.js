const path = require("node:path");
const { loadEnvFile, getEnv } = require("../config/env");

// Applications share the database location and supply their own credentials.
function getDatabaseConnectionConfig() {
    loadEnvFile(path.join(__dirname, ".env"));
    return {
        host: getEnv("DB_HOST"),
        port: Number(getEnv("DB_PORT")),
        database: getEnv("DB_NAME"),
    };
}

module.exports = { getDatabaseConnectionConfig };
