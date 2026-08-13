//Use commands
const helpCommand = require("./helpCommand");
const statusCommand = require("./statusCommand");

//Show available commands
const randomCommand = require("./randomCommand");
const sendMeAllCommand = require("./sendMeAllCommand");

//System commands
const killCommand = require("./killCommand");
const clearCommand = require("./clearCommand");
const muteCommand = require("./muteCommand");
const unmuteCommand = require("./unmuteCommand");

const commands = [
    helpCommand,
    statusCommand,
    randomCommand,
    sendMeAllCommand,
    killCommand,
    clearCommand,
    muteCommand,
    unmuteCommand,
];

const commandMap = new Map(
    commands.map((command) => [
        command.name,
        command,
    ])
);

module.exports = {
    commands,
    commandMap,
};