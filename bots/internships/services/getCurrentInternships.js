const {
    readInternshipRepo,
} = require("../repos/readInternshipRepo");

const {
    parseInternships,
} = require("./internshipParser");

const {
    getTopInternships,
} = require("./internshipFilter");

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
    const repositoryFile = await readInternshipRepo();

    const internships = parseInternships(
        repositoryFile.content
    );

    return getTopInternships(
        internships,
        internships.length
    );
}

module.exports = {
    getCurrentInternships,
};