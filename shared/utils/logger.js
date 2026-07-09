function logInfo(message) {
    console.log(`[INFO] ${message}`);
}

function logError(message, error) {
    console.error(`[ERROR] ${message}`);

    if (error) {
        console.error(error);
    }
}

module.exports = {
    logInfo,
    logError,
};