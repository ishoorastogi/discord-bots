const { pool, databaseEvents } = require("./pool");

const RETRY_DELAY = 10000;
const HEALTH_CHECK_INTERVAL = 15000;

let connected = false;
let retryTimer = null;
let healthCheckTimer = null;
let connectionAttempt = null;
let stopped = false;

databaseEvents.on("connectionError", () => {
  if (stopped) return;

  console.log(
    "[DATABASE] Pool connection error detected. Checking database availability..."
  );

  void connectDatabase();
});

async function connectDatabase() {
  if (stopped) return;

  // Prevent overlapping connection attempts
  if (connectionAttempt) {
    return connectionAttempt;
  }

  connectionAttempt = (async () => {
    try {
      await pool.query("SELECT 1");

      if (stopped) return;

      if (!connected) {
        console.log("[DATABASE] PostgreSQL connected successfully.");
      }

      connected = true;

      clearRetryTimer();
      startHealthChecks();

    } catch (error) {
      if (stopped) return;

      if (connected) {
        console.error("[DATABASE] PostgreSQL connection lost.");
      }

      connected = false;

      console.error(`[DATABASE] ${error.message}`);

      stopHealthChecks();
      scheduleRetry();

    }
  })();

  try {
    await connectionAttempt;
  } finally {
    connectionAttempt = null;
  }
}

function scheduleRetry() {
  if (stopped || retryTimer) return;

  console.log(
    `[DATABASE] Retrying in ${RETRY_DELAY / 1000} seconds...`
  );

  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connectDatabase();
  }, RETRY_DELAY);
}

function clearRetryTimer() {
  if (!retryTimer) return;

  clearTimeout(retryTimer);
  retryTimer = null;
}

function startHealthChecks() {
  if (stopped || healthCheckTimer) return;

  healthCheckTimer = setInterval(() => {
    void connectDatabase();
  }, HEALTH_CHECK_INTERVAL);
}

function stopHealthChecks() {
  if (!healthCheckTimer) return;

  clearInterval(healthCheckTimer);
  healthCheckTimer = null;
}

function isDatabaseConnected() {
  return connected;
}

function getDatabaseStatus() {
  return {
    connected,
    state: stopped
      ? "stopped"
      : connected
        ? "connected"
        : retryTimer
          ? "reconnecting"
          : "disconnected",
    retryInterval: RETRY_DELAY,
    healthCheckInterval: HEALTH_CHECK_INTERVAL,
  };
}

async function disconnectDatabase() {
  if (stopped) return;

  stopped = true;
  connected = false;

  clearRetryTimer();
  stopHealthChecks();

  // Wait for any active connection attempt
  if (connectionAttempt) {
    await connectionAttempt;
  }

  await pool.end();

  console.log("[DATABASE] Connection pool closed.");
}

module.exports = {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
};