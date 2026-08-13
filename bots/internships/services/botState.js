const fs = require("fs/promises");
const path = require("path");

const BOT_STATE_PATH = path.join(
    __dirname,
    "../data/botState.json"
);

async function readBotState() {
    try {
        const contents = await fs.readFile(
            BOT_STATE_PATH,
            "utf8"
        );

        const state = JSON.parse(contents);

        return {
            muted: state.muted === true,
        };
    } catch (error) {
        if (error.code === "ENOENT") {
            return {
                muted: false,
            };
        }

        throw error;
    }
}

async function writeBotState(state) {
    await fs.writeFile(
        BOT_STATE_PATH,
        JSON.stringify(state, null, 2),
        "utf8"
    );
}

async function setMuted(muted) {
    const state = await readBotState();

    state.muted = muted;

    await writeBotState(state);

    return state;
}

async function isMuted() {
    const state = await readBotState();

    return state.muted;
}

module.exports = {
    isMuted,
    readBotState,
    setMuted,
    writeBotState,
};