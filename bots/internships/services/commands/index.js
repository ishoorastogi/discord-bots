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

// Discipline-specific commands
const csCommand = require("./csCommand");

const commands = [
    helpCommand,
    statusCommand,
    randomCommand,
    sendMeAllCommand,
    killCommand,
    clearCommand,
    muteCommand,
    unmuteCommand,
    csCommand,
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