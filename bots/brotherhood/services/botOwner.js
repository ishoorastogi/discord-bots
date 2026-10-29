function isBotOwner(userId) {
    const ownerId = process.env.BOT_OWNER_ID?.trim();
    return Boolean(ownerId && userId && userId === ownerId);
}

module.exports = { isBotOwner };
