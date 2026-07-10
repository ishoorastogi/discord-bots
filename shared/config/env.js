require("dotenv").config();

function getEnv(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value;
}

function getOptionalEnv(name) {
    return process.env[name] || undefined;
}

module.exports = {
    getEnv,
    getOptionalEnv,
};