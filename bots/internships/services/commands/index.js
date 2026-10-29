//Use commands
const helpCommand = require("./helpCommand");
const statusCommand = require("./statusCommand");

//Show available commands
const randomCommand = require("./randomCommand");
const latestCommand = require("./latestCommand");
const sendMeAllCommand = require("./sendMeAllCommand");
const sendmecsCommand = require("./sendmecsCommand");
const futureCommand = require("./futureCommand");

//System commands
const killCommand = require("./killCommand");
const restartCommand = require("./restartCommand");
const clearCommand = require("./clearCommand");
const muteCommand = require("./muteCommand");
const unmuteCommand = require("./unmuteCommand");
const backendCommand = require("./backendCommands");
const setBackendPortCommand = require("./setBackendPortCommand");

// Discipline-specific commands
const csCommand = require("./csCommand");
const meCommand = require("./meCommand");
const eeCommand = require("./eeCommand");
const bmCommand = require("./bmCommand");
const ceCommand = require("./ceCommand");

// Resume command
const resumeCommand = require("./resumeCommand");

/*
Need to add:
- ai
- data science
*/

const commands = [
    helpCommand,
    statusCommand,
    randomCommand,
    latestCommand,
    sendMeAllCommand,
    sendmecsCommand,
    killCommand,
    restartCommand,
    clearCommand,
    muteCommand,
    unmuteCommand,
    backendCommand,
    setBackendPortCommand,
    csCommand,
    meCommand,
    eeCommand,
    bmCommand,
    ceCommand,  
    futureCommand,
    resumeCommand,
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
