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
 * Determines whether a role is engineering-related.
 *
 * @param {object} internship
 * @returns {boolean}
 */
function isEngineeringInternship(internship) {
    const role = String(internship.role || "").toLowerCase();

    const engineeringKeywords = [
        "engineer",
        "engineering",
        "software",
        "developer",
        "development",
        "machine learning",
        "artificial intelligence",
        " ai ",
        "data science",
        "data scientist",
        "cyber",
        "security",
        "cloud",
        "devops",
        "systems",
        "infrastructure",
        "hardware",
        "firmware",
        "embedded",
        "robotics",
        "computer science",
        "technology",
    ];

    return engineeringKeywords.some((keyword) =>
        role.includes(keyword)
    );
}

/**
 * Determines whether the internship appears to be US-based.
 *
 * Remote roles are allowed unless they explicitly indicate
 * a non-US location.
 *
 * @param {object} internship
 * @returns {boolean}
 */
function isUSInternship(internship) {
    const location = String(
        internship.location || ""
    ).toLowerCase();

    if (!location) {
        return false;
    }

    if (location.includes("remote")) {
        return true;
    }

    const statePattern =
        /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;

    return (
        statePattern.test(location) ||
        location.includes("united states") ||
        location.includes("usa") ||
        location.includes("u.s.")
    );
}

/**
 * Returns the newest valid internship listings.
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

    const eligibleInternships = internships.filter(
        (internship) =>
            isEngineeringInternship(internship) &&
            isUSInternship(internship)
    );

    const uniqueInternships =
        removeDuplicateInternships(eligibleInternships);

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
            const aTime =
                a.parsedDate?.getTime() ?? 0;
            const bTime =
                b.parsedDate?.getTime() ?? 0;

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
    isEngineeringInternship,
    isUSInternship,
    parsePostedDate,
    removeDuplicateInternships,
};