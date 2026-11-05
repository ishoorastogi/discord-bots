const { createRouter } = require("../../router");
const { createMentionHandler } = require("../../commands/handleMentionCommand");

// Explicit test doubles for routing contracts; production uses the shared PostgreSQL scripts.
const database = Object.fromEntries([
    "findMember", "findBrother", "deleteMember", "updateMember", "updateMemberFields", "addMembers",
].map(name => [name, async () => { throw new Error(`Unexpected database call: ${name}`); }]));

const router = createRouter(database);
module.exports = { database, ...router, handleMentionCommand: createMentionHandler(router) };
