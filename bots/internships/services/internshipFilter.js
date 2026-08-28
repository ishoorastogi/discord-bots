const {
    getPostedTimestamp,
} = require("./internshipDateFormatter");

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

function createLegacyInternshipId(internship) {
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
 * Creates a stable identifier for an internship.
 *
 * Simplify listings include a stable source id. Older saved history may only
 * have the derived id, so callers that compare history should also consider
 * createLegacyInternshipId.
 *
 * @param {object} internship
 * @returns {string}
 */
function createInternshipId(internship) {
    if (
        typeof internship?.id === "string" &&
        internship.id.trim() !== ""
    ) {
        return internship.id.trim();
    }

    return createLegacyInternshipId(internship);
}

function getInternshipIdentityKeys(internship) {
    const keys = new Set();

    if (typeof internship === "string") {
        keys.add(internship);
        return keys;
    }

    if (!internship || typeof internship !== "object") {
        return keys;
    }

    const primaryId = createInternshipId(internship);

    if (primaryId) {
        keys.add(primaryId);
    }

    const legacyId = createLegacyInternshipId(internship);

    if (legacyId) {
        keys.add(legacyId);
    }

    return keys;
}

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

function hasKeyword(value, keywords) {
    const normalized = ` ${String(value || "").toLowerCase()} `;

    return keywords.some((keyword) =>
        normalized.includes(keyword)
    );
}

function isEngineeringInternship(internship) {
    const role = internship?.role;

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
        "electrical",
        "firmware",
        "embedded",
        "mechanical",
        "manufacturing",
        "robotics",
        "robot",
        "aerospace",
        "controls",
        "mechatronics",
        "thermal",
        "automotive",
        "semiconductor",
        "product design",
        "structures",
        "structural",
        "cad",
        "computer science",
        "technology",
    ];

    return hasKeyword(role, engineeringKeywords);
}

function isCSInternship(internship) {
    const role = internship?.role;

    const csKeywords = [
        "software",
        "developer",
        "development",
        "computer science",
        "machine learning",
        "artificial intelligence",
        " ai ",
        "data science",
        "data scientist",
        "cyber",
        "security",
        "cloud",
        "devops",
        "backend",
        "back-end",
        "frontend",
        "front-end",
        "full stack",
        "full-stack",
        "web",
        "platform",
        "systems",
        "infrastructure",
        "network",
        "database",
    ];

    return hasKeyword(role, csKeywords);
}

function isMEInternship(internship) {
    const role = internship?.role;

    const meKeywords = [
        "mechanical",
        "manufacturing",
        "mechatronics",
        "thermal",
        "aerospace",
        "automotive",
        "product design",
        "design engineer",
        "test engineer",
        "hvac",
        "fluids",
        "optical", 
        "robotic",
        "structures",
        "structural",
        "cad",
        "solidworks",
    ];

    return hasKeyword(role, meKeywords);
}

function isEEInternship(internship) {
    const role = String(
        internship.role || ""
    ).toLowerCase();

    const eeKeywords = [
        "electrical",
        "electronics",
        "electronic",
        "hardware",
        "firmware",
        "embedded",
        "failure",
        "fpga",
        "asic",
        "mems",
        "validation",
        "test",
        "process",
        "semiconductor",
        "circuit",
        "circuits",
        "pcb",
        "power systems",
        "power electronics",
        "signal processing",
        "digital design",
        "analog",
        "rf engineer",
        "radio frequency",
        "controls engineer",
        "control systems",
        "silicon",
        "photonic", 
        "chip design",
        "verification engineer",
    ];

    return eeKeywords.some((keyword) =>
        role.includes(keyword)
    );
}

function isBMInternship(internship) {
    const role = String(
        internship.role || ""
    ).toLowerCase();

    const bmeKeywords = [
        "biomedical",
        "bioengineering",
        "biomechanical",
        "medical device",
        "medical devices",
        "biomaterials",
        "biomechanics",
        "clinical engineering",
        "rehabilitation engineering",
        "prosthetics",
        "prosthetic",
        "orthotics",
        "bioinstrumentation",
        "biosensors",
        "biotechnology",
        "biotech",
        "medical imaging",
        "neural engineering",
        "tissue engineering",
    ];

    return bmeKeywords.some((keyword) =>
        role.includes(keyword)
    );
}

function getLocationValues(internship) {
    if (Array.isArray(internship?.locations)) {
        return internship.locations
            .map((location) => String(location || "").trim())
            .filter(Boolean);
    }

    if (typeof internship?.location === "string") {
        return internship.location
            .split(/\n|;/)
            .map((location) => location.trim())
            .filter(Boolean);
    }

    return [];
}

function isInternationalLocation(location) {
    const normalized = location.toLowerCase();

    const internationalKeywords = [
        "canada",
        "remote in canada",
        "toronto",
        "vancouver",
        "montreal",
        "london",
        "united kingdom",
        " uk",
        "europe",
        "germany",
        "france",
        "ireland",
        "india",
        "singapore",
        "japan",
        "china",
        "hong kong",
        "australia",
        "mexico",
    ];

    return (
        normalized === "uk" ||
        internationalKeywords.some((keyword) =>
            normalized.includes(keyword)
        )
    );
}

function isUSLocation(location) {
    const normalized = location.toLowerCase();

    if (!normalized) {
        return false;
    }

    if (isInternationalLocation(location)) {
        return false;
    }

    const statePattern =
        /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i;

    if (statePattern.test(location)) {
        return true;
    }

    if (
        normalized === "remote" ||
        normalized.includes("remote, us") ||
        normalized.includes("remote - us") ||
        normalized.includes("remote (us") ||
        normalized.includes("remote in us") ||
        normalized.includes("remote in the us") ||
        normalized.includes("remote in united states") ||
        normalized.includes("remote within united states")
    ) {
        return true;
    }

    const cityAliases = [
        "nyc",
        "new york city",
        "sf",
        "san francisco",
        "bay area",
        "silicon valley",
        "seattle",
        "boston",
        "chicago",
        "houston",
        "austin",
        "atlanta",
        "los angeles",
    ];

    return (
        normalized.includes("united states") ||
        normalized.includes("usa") ||
        normalized.includes("u.s.") ||
        normalized.includes(" us ") ||
        cityAliases.some((city) =>
            normalized.includes(city)
        )
    );
}

function isUSInternship(internship) {
    const locations = getLocationValues(internship);

    if (locations.length === 0) {
        return false;
    }

    return locations.some(isUSLocation);
}

function getTopMatchingInternships({
    internships,
    limit,
    predicate,
    name,
}) {
    if (!Array.isArray(internships)) {
        throw new TypeError(
            `${name} requires an array of internships.`
        );
    }

    if (!Number.isInteger(limit) || limit <= 0) {
        throw new RangeError(
            `${name} requires a positive integer limit.`
        );
    }

    const eligibleInternships = internships.filter(
        (internship) =>
            predicate(internship) &&
            isUSInternship(internship)
    );

    const uniqueInternships =
        removeDuplicateInternships(eligibleInternships);

    return uniqueInternships
        .map((internship, originalIndex) => ({
            internship,
            originalIndex,
            postedTimestamp:
                getPostedTimestamp(internship) ?? 0,
        }))
        .sort((a, b) => {
            if (a.postedTimestamp !== b.postedTimestamp) {
                return (
                    b.postedTimestamp -
                    a.postedTimestamp
                );
            }

            return a.originalIndex - b.originalIndex;
        })
        .slice(0, limit)
        .map(({ internship }) => internship);
}

function getTopInternships(internships, limit = 5) {
    return getTopMatchingInternships({
        internships,
        limit,
        predicate: isEngineeringInternship,
        name: "getTopInternships",
    });
}

function getTopCSInternships(internships, limit = 5) {
    return getTopMatchingInternships({
        internships,
        limit,
        predicate: isCSInternship,
        name: "getTopCSInternships",
    });
}

function getTopMEInternships(internships, limit = 5) {
    return getTopMatchingInternships({
        internships,
        limit,
        predicate: isMEInternship,
        name: "getTopMEInternships",
    });
}

function getTopEEInternships(internships, limit = 5) {
    return getTopMatchingInternships({
        internships,
        limit,
        predicate: isEEInternship,
        name: "getTopEEInternships",
    });
}

function getTopBMInternships(internships, limit = 5) {
    return getTopMatchingInternships({
        internships,
        limit,
        predicate: isBMInternship,
        name: "getTopBMInternships",
    });
}

module.exports = {
    createInternshipId,
    createLegacyInternshipId,
    getInternshipIdentityKeys,
    getTopInternships,
    getTopCSInternships,
    getTopMEInternships,
    getTopEEInternships,
    getTopBMInternships,
    isEngineeringInternship,
    isUSInternship,
    isCSInternship,
    isMEInternship,
    isEEInternship,
    isBMInternship,
    parsePostedDate,
    removeDuplicateInternships,
};
