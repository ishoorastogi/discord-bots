const { Pool } = require("pg");
const { EventEmitter } = require("node:events");

const { getEnv } = require("../../../shared/config/env");
const { getDatabaseConnectionConfig } = require("../../../shared/dbs/config");

const databaseEvents = new EventEmitter();

const pool = new Pool({
  ...getDatabaseConnectionConfig(),
  user: getEnv("DB_USER"),
  password: getEnv("DB_PASSWORD"),

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
});

pool.on("error", (error) => {
  console.error(
    `[DATABASE] Pool connection error: ${error.message}`
  );

  databaseEvents.emit("connectionError", error);
});

module.exports = {
  pool,
  databaseEvents,
};
