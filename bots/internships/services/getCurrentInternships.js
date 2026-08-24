const {
    readInternshipRepo,
} = require("../repos/readInternshipRepo");

const {
    parseInternships,
} = require("./internshipParser");

const {
    getTopInternships,
    getTopCSInternships,
    getTopMEInternships,
    getTopEEInternships,
} = require("./internshipFilter");

async function getRankedInternships(rankInternships) {
    const repositoryFile = await readInternshipRepo();

    const internships = parseInternships(
        repositoryFile.content
    );

    return rankInternships(
        internships,
        internships.length
    );
}

/**
 * Fetches the internship repository and returns all
 * currently valid internships ranked newest-first.
 *
 * This function does not send Discord messages and
 * does not modify sent internship history.
 *
 * @returns {Promise<Array<object>>}
 */
async function getCurrentInternships() {
    return getRankedInternships(getTopInternships);
}

/**
 * Fetches the internship repository and returns all
 * currently valid Computer Science internships ranked
 * newest-first.
 *
 * This function does not send Discord messages and
 * does not modify sent internship history.
 *
 * @returns {Promise<Array<object>>}
 */
async function getCurrentCSInternships() {
    return getRankedInternships(getTopCSInternships);
}

async function getCurrentMEInternships() {
    return getRankedInternships(getTopMEInternships);
}

async function getCurrentEEInternships() {
    const internships =
        await getCurrentInternships();

    return getTopEEInternships(
        internships,
        internships.length
    );
}

module.exports = {
    getCurrentCSInternships,
    getCurrentInternships,
    getCurrentMEInternships,
    getCurrentEEInternships,
};
