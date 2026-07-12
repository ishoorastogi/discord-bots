const {
    readInternshipRepo,
} = require("../../repos/readInternshipRepo");

const {
    parseInternships,
} = require("../internshipParser");

const {
    getTopInternships,
} = require("../internshipFilter");

const {
    logInfo,
    logError,
} = require("../../../../shared/utils/logger");

async function testInternshipFilter() {
    try {
        const file = await readInternshipRepo();
        const internships = parseInternships(file.content);
        const topInternships = getTopInternships(internships, 5);

        logInfo(
            `Selected ${topInternships.length} of ` +
            `${internships.length} available internships.`
        );

        topInternships.forEach((internship, index) => {
            logInfo(
                `${index + 1}. ${internship.company} | ` +
                `${internship.role} | ` +
                `${internship.location} | ` +
                `${internship.datePosted}`
            );
        });
    } catch (error) {
        logError("Failed to filter internships", error);
        process.exitCode = 1;
    }
}

testInternshipFilter();