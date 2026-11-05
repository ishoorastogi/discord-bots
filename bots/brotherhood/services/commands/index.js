const testCommand = require("./testCommand");
const statusCommand = require("./statusCommand");
const fileIntakeCommand = require("./fileIntakeCommand");
const updateCommand = require("./updateCommand");
const deleteCommand = require("./deleteCommand");
const brotherCommand = require("./brotherCommand");
const helpCommand = require("./helpCommand");

const commands = [
    testCommand,
    statusCommand,
    fileIntakeCommand,
    updateCommand,
    deleteCommand,
    brotherCommand,
    helpCommand,
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
