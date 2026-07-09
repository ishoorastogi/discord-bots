const { Client, GatewayIntentBits } = require("discord.js");

function createClient() {
    return new Client({
        intents: [
            GatewayIntentBits.Guilds
        ]
    });
}

module.exports = {
    createClient
};