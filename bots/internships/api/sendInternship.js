const crypto = require("node:crypto");

function requireText(value, fieldName) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`Invalid internship ${fieldName}`);
    }

    return value.trim();
}

function normalizeLocations(internship) {
    if (Array.isArray(internship.locations)) {
        const locations = internship.locations
            .map((location) => String(location || "").trim())
            .filter(Boolean);

        if (locations.length > 0) {
            return locations;
        }
    }

    const location = requireText(
        internship.location,
        "location"
    );

    return [location];
}

async function sendInternship(backend, internship) {
    if (!backend?.connected || !backend?.socket) {
        throw new Error("Backend is not connected");
    }

    if (!internship || typeof internship !== "object") {
        throw new Error("Invalid internship");
    }

    const hasDatePosted =
        internship.datePosted !== undefined &&
        internship.datePosted !== null &&
        internship.datePosted !== "";
    const datePosted = hasDatePosted
        ? Number(internship.datePosted)
        : null;

    if (hasDatePosted && !Number.isFinite(datePosted)) {
        throw new Error("Invalid internship date posted");
    }

    const requestId = crypto.randomUUID();
    const payload = {
        event: "INTERNSHIP_UPLOAD",
        request_id: requestId,
        data: {
            internship_id: requireText(
                internship.id,
                "ID"
            ),
            company: requireText(
                internship.company,
                "company"
            ),
            role: requireText(
                internship.role,
                "role"
            ),
            location: requireText(
                internship.location,
                "location"
            ),
            locations: normalizeLocations(internship),
            application_url: requireText(
                internship.applicationUrl,
                "application URL"
            ),
            date_posted: datePosted,
        },
    };

    await backend.sendWithConfirmation(payload);
    return requestId;
}

module.exports = sendInternship;
