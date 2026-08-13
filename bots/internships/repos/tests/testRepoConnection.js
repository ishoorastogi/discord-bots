const { createGitHubClient } = require("../../../../shared/github/githubClient");
const { loadRepositoryConfig } = require("../../config");
const { logInfo, logError } = require("../../../../shared/utils/logger");

async function testRepositoryConnection() {
    const github = createGitHubClient();
    const repository = loadRepositoryConfig();

    try {
        const response = await github.repos.get({
            owner: repository.owner,
            repo: repository.repo,
        });

        logInfo(`Connected to GitHub repository: ${response.data.full_name}`);
        logInfo(`Default branch: ${response.data.default_branch}`);
        logInfo(`Repository visibility: ${response.data.visibility}`);
    } catch (error) {
        logError("Failed to connect to internship repository", error);
        process.exitCode = 1;
    }
}

testRepositoryConnection();
