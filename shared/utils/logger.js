/**
 * Writes an informational log message.
 *
 * @param {string} message - Message to write.
 */
function logInfo(message) {
  console.info(`[INFO] ${message}`);
}

/**
 * Writes a warning log message.
 *
 * @param {string} message - Message to write.
 */
function logWarn(message) {
  console.warn(`[WARN] ${message}`);
}

/**
 * Writes an error log message and optional error details.
 *
 * @param {string} message - Message to write.
 * @param {Error|unknown} [error] - Optional error or diagnostic value.
 */
function logError(message, error) {
  console.error(`[ERROR] ${message}`);

  if (error instanceof Error) {
    console.error(error.stack || error.message);
    return;
  }

  if (typeof error !== "undefined") {
    console.error(error);
  }
}

module.exports = {
  logInfo,
  logWarn,
  logError,
};
