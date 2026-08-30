require("dotenv").config();

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
  getEnv,
  getOptionalEnv,
};