//Use commands
const helpCommand = require("./helpCommand");
const statusCommand = require("./statusCommand");

//Show available commands
const randomCommand = require("./randomCommand");
const sendMeAllCommand = require("./sendMeAllCommand");
const sendmecsCommand = require("./sendmecsCommand");

//System commands
const killCommand = require("./killCommand");
const clearCommand = require("./clearCommand");
const muteCommand = require("./muteCommand");
const unmuteCommand = require("./unmuteCommand");

// Discipline-specific commands
const csCommand = require("./csCommand");
const meCommand = require("./meCommand");
const eeCommand = require("./eeCommand");

/*
Need to add:
- bme
- ai
- data science
*/

const commands = [
    helpCommand,
    statusCommand,
    randomCommand,
    sendMeAllCommand,
    sendmecsCommand,
    killCommand,
    clearCommand,
    muteCommand,
    unmuteCommand,
    csCommand,
    meCommand,
    eeCommand,
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