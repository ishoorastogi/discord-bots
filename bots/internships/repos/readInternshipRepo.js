const { createGitHubClient } = require("../../../shared/github/githubClient");
const { loadRepositoryConfig } = require("../config");

async function readInternshipRepo() {
    const github = createGitHubClient();
    const repository = loadRepositoryConfig();

    const response = await github.repos.getContent({
        owner: repository.owner,
        repo: repository.repo,
        path: repository.path,
        ref: repository.branch,
    });

    if (Array.isArray(response.data)) {
        throw new Error(
            `Expected ${repository.path} to be a file, but GitHub returned a directory.`
        );
    }

    if (response.data.type !== "file") {
        throw new Error(
            `Expected ${repository.path} to be a file, but received type: ${response.data.type}`
        );
    }

    if (!response.data.content) {
        throw new Error(`GitHub returned no content for ${repository.path}.`);
    }

    const content = Buffer.from(
        response.data.content,
        response.data.encoding || "base64"
    ).toString("utf8");

    return {
        content,
        sha: response.data.sha,
        path: response.data.path,
        size: response.data.size,
        htmlUrl: response.data.html_url,
    };
}

module.exports = {
    readInternshipRepo,
};
