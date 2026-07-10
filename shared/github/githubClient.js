const { Octokit } = require("@octokit/rest");

const { getOptionalEnv } = require("../config/env");

/**
 * Creates an Octokit GitHub client.
 *
 * If GITHUB_TOKEN is present, the client is authenticated. Otherwise, the
 * unauthenticated client can still access public GitHub resources.
 *
 * @returns {Octokit} An Octokit client instance.
 */
function createGitHubClient() {
  const token = getOptionalEnv("GITHUB_TOKEN");

  if (!token) {
    return new Octokit();
  }

  return new Octokit({
    auth: token,
  });
}

module.exports = {
  createGitHubClient,
};
