function normalizeLocations(locations) {
    if (Array.isArray(locations)) {
        return locations
            .map((location) => String(location || "").trim())
            .filter(Boolean);
    }

    if (typeof locations === "string") {
        return locations
            .split(/\n|;/)
            .map((location) => location.trim())
            .filter(Boolean);
    }

    return [];
}

function normalizeListing(listing) {
    const company = String(
        listing.company_name || ""
    ).trim();
    const role = String(listing.title || "").trim();
    const applicationUrl = String(
        listing.url || ""
    ).trim();
    const locations = normalizeLocations(
        listing.locations
    );
    const datePosted =
        Number.isFinite(listing.date_posted)
            ? listing.date_posted
            : Number(listing.date_posted);

    if (
        listing.active !== true ||
        listing.is_visible !== true ||
        !company ||
        !role ||
        !applicationUrl
    ) {
        return undefined;
    }

    return {
        id:
            typeof listing.id === "string" &&
            listing.id.trim() !== ""
                ? listing.id.trim()
                : undefined,
        company,
        role,
        location: locations.join(", "),
        locations,
        applicationUrl,
        datePosted: Number.isFinite(datePosted)
            ? datePosted
            : undefined,
    };
}

/**
 * Parses available internships from SimplifyJobs listings.json.
 *
 * @param {string} json
 * @returns {Array<{
 *   id?: string,
 *   company: string,
 *   role: string,
 *   location: string,
 *   locations?: string[],
 *   applicationUrl: string,
 *   datePosted?: number
 * }>}
 */
function parseInternships(json) {
    if (typeof json !== "string" || json.trim() === "") {
        throw new Error(
            "Internship parser requires non-empty JSON content."
        );
    }

    let listings;

    try {
        listings = JSON.parse(json);
    } catch (error) {
        throw new Error(
            `Failed to parse internship listings JSON: ${error.message}`
        );
    }

    if (!Array.isArray(listings)) {
        throw new Error(
            "Internship listings JSON must contain an array."
        );
    }

    const internships = listings
        .map(normalizeListing)
        .filter(Boolean);

    if (internships.length === 0) {
        throw new Error(
            "No active, visible internships were found in listings JSON."
        );
    }

    return internships;
}

module.exports = {
    normalizeLocations,
    parseInternships,
};
