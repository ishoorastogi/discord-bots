const {
    readInternshipRepo,
} = require("../../repos/readInternshipRepo");

const {
    parseInternships,
} = require("../internshipParser");

const {
    logInfo,
    logError,
} = require("../../../../shared/utils/logger");

async function testInternshipParser() {
    try {
        const file = await readInternshipRepo();
        const internships = parseInternships(file.content);

        logInfo(
            `Parsed ${internships.length} available internships.`
        );

        for (const internship of internships.slice(0, 5)) {
            logInfo(
                `${internship.company} | ` +
                `${internship.role} | ` +
                `${internship.location} | ` +
                `${internship.datePosted} | ` +
                internship.applicationUrl
            );
        }
    } catch (error) {
        logError(
            "Failed to parse internship repository",
            error
        );

        process.exitCode = 1;
    }
}

testInternshipParser();