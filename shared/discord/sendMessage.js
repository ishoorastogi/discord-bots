async function sendMessage(client, channelId, message) {
    const channel = await client.channels.fetch(channelId);

    if (!channel) {
        throw new Error(`Discord channel not found: ${channelId}`);
    }

    if (!channel.isTextBased()) {
        throw new Error(`Discord channel is not text-based: ${channelId}`);
    }

    return channel.send(message);
}

module.exports = {
    sendMessage,
};