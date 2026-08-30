const {
    readInternshipRepo,
} = require("../readInternshipRepo");

const {
    logInfo,
    logError,
} = require("../../../../shared/utils/logger");

async function testRepositoryContent() {
    try {
        const file = await readInternshipRepo();

        logInfo(`Read repository file: ${file.path}`);
        logInfo(`GitHub-reported size: ${file.size} bytes`);
        logInfo(`Decoded content length: ${file.content.length} characters`);
        logInfo(`File SHA: ${file.sha}`);

        const preview = file.content.slice(0, 300).replace(/\n/g, "\\n");
        logInfo(`Content preview: ${preview}`);

        JSON.parse(file.content);
        logInfo("Repository content is valid JSON.");
    } catch (error) {
        logError("Failed to read internship repository content", error);
        process.exitCode = 1;
    }
}

testRepositoryContent();
