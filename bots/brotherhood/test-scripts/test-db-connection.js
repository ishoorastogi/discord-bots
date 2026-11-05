const path = require("node:path");

const { loadEnvFile } = require("../../../shared/config/env");

// Load Brotherhood Bot environment variables
loadEnvFile(path.join(__dirname, "../.env"));

const { pool } = require("../db/pool");

async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW() AS current_time");

    console.log("[DATABASE] Connection successful!");
    console.log("[DATABASE] Server time:", result.rows[0].current_time);

  } catch (error) {
    console.error("[DATABASE] Connection failed:", error.message);
    process.exitCode = 1;

  } finally {
    await pool.end();
  }
}

testConnection();