const { getEnv } = require("../../config/env");
const select = require("../crud/select");
const insert = require("../crud/insert");

async function incrementUserPhone(username, password, name = "test user") {
    const users = await select.selectUsersByName(name, username, password);
    if (users.length !== 1) {
        throw new Error(users.length ? `More than one user named "${name}" was found.` : `No user named "${name}" was found.`);
    }
    const user = users[0];
    if (typeof user.phone !== "string" || !/^\d+$/.test(user.phone)) {
        throw new Error("The selected user's phone must contain only digits to increment it.");
    }
    const phone = (BigInt(user.phone) + 1n).toString().padStart(user.phone.length, "0");
    return insert.upsertUser({ name: user.name, phone }, username, password);
}

async function main() {
    const user = await incrementUserPhone(getEnv("DB_USER"), getEnv("DB_PASSWORD"));
    console.log(`User ${user.user_id}: phone = ${user.phone}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error("User upsert test failed:", error.message);
        process.exitCode = 1;
    });
}

module.exports = { incrementUserPhone };
