/**
 * Converts a repository date such as "Jul 10" into a Date.
 *
 * The repository may omit the year, so the supplied year is used.
 *
 * @param {string} value
 * @param {number} year
 * @returns {Date | undefined}
 */
function parsePostedDate(value, year = new Date().getFullYear()) {
    if (typeof value !== "string" || value.trim() === "") {
        return undefined;
    }

    const parsed = new Date(`${value.trim()} ${year}`);

    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed;
}

/**
 * Creates a stable identifier for an internship.
 *
 * @param {{
 *   company: string,
 *   role: string,
 *   location: string,
 *   applicationUrl: string
 * }} internship
 * @returns {string}
 */
function createInternshipId(internship) {
    return [
        internship.company,
        internship.role,
        internship.location,
        internship.applicationUrl,
    ]
        .map((value) => String(value || "").trim().toLowerCase())
        .join("|");
}

/**
 * Removes duplicate internship listings.
 *
 * @param {Array<object>} internships
 * @returns {Array<object>}
 */
function removeDuplicateInternships(internships) {
    const seenIds = new Set();

    return internships.filter((internship) => {
        const id = createInternshipId(internship);

        if (seenIds.has(id)) {
            return false;
        }

        seenIds.add(id);
        return true;
    });
}

/**
 * Returns the newest internship listings.
 *
 * @param {Array<object>} internships
 * @param {number} limit
 * @returns {Array<object>}
 */
function getTopInternships(internships, limit = 5) {
    if (!Array.isArray(internships)) {
        throw new TypeError(
            "getTopInternships requires an array of internships."
        );
    }

    if (!Number.isInteger(limit) || limit <= 0) {
        throw new RangeError(
            "getTopInternships requires a positive integer limit."
        );
    }

    const currentYear = new Date().getFullYear();
    const uniqueInternships = removeDuplicateInternships(internships);

    return uniqueInternships
        .map((internship, originalIndex) => ({
            internship,
            originalIndex,
            parsedDate: parsePostedDate(
                internship.datePosted,
                currentYear
            ),
        }))
        .sort((a, b) => {
            const aTime = a.parsedDate?.getTime() ?? 0;
            const bTime = b.parsedDate?.getTime() ?? 0;

            if (aTime !== bTime) {
                return bTime - aTime;
            }

            return a.originalIndex - b.originalIndex;
        })
        .slice(0, limit)
        .map(({ internship }) => internship);
}

module.exports = {
    createInternshipId,
    getTopInternships,
    parsePostedDate,
    removeDuplicateInternships,
};