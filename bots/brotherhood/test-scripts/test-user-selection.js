const path = require("node:path");
const { loadEnvFile, getEnv } = require("../../../shared/config/env");

loadEnvFile(path.join(__dirname, "../.env"));

const { selectUsersByName } = require("../../../shared/dbs/crud/select");

async function main() {
    const users = await selectUsersByName("test user", getEnv("DB_USER"), getEnv("DB_PASSWORD"));
    if (users.length === 0) {
        throw new Error('No user named "test user" was found.');
    }
    if (users.length > 1) {
        throw new Error('More than one user named "test user" was found.');
    }
    console.log(users[0].user_id);
}

main().catch(error => {
    console.error("User selection test failed:", error.message);
    process.exitCode = 1;
});
