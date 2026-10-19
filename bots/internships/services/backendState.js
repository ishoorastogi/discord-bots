const fs = require("node:fs");
const path = require("node:path");

const STATE_PATH = path.join(
    __dirname,
    "../data/backendState.json"
);

function getBackendEnabled() {
    try {
        if (!fs.existsSync(STATE_PATH)) {
            return true;
        }

        const data = JSON.parse(
            fs.readFileSync(STATE_PATH, "utf8")
        );

        if (typeof data.enabled !== "boolean") {
            throw new Error("Invalid backend enabled state");
        }

        return data.enabled;

    } catch (error) {
        console.error(
            "[BACKEND STATE] Failed to load state:",
            error.message
        );

        // Fail closed rather than unexpectedly reconnecting.
        return false;
    }
}

function setBackendEnabled(enabled) {
    if (typeof enabled !== "boolean") {
        throw new TypeError(
            "Backend enabled state must be a boolean"
        );
    }

    fs.mkdirSync(path.dirname(STATE_PATH), {
        recursive: true
    });

    const temporaryPath = `${STATE_PATH}.tmp`;

    fs.writeFileSync(
        temporaryPath,
        JSON.stringify({ enabled }, null, 4),
        "utf8"
    );

    fs.renameSync(temporaryPath, STATE_PATH);

    console.log(
        `[BACKEND STATE] Backend ${enabled ? "enabled" : "disabled"}`
    );
}

module.exports = {
    getBackendEnabled,
    setBackendEnabled
};