const dotenv = require("dotenv");

function loadEnvFile(envPath) {
  dotenv.config({
    path: envPath,
    quiet: true,
  });
}

function getEnv(name) {
  const value = process.env[name];

  if (typeof value === "undefined" || value === "") {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

function getOptionalEnv(name) {
  const value = process.env[name];

  if (typeof value === "undefined" || value === "") {
    return undefined;
  }

  return value;
}

module.exports = {
  loadEnvFile,
  getEnv,
  getOptionalEnv,
};
