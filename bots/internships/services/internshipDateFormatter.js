const dateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
});

function getPostedTimestamp(internship) {
    const value =
        internship?.datePostedRaw ??
        internship?.datePosted;

    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const numericValue = Number(value);

        if (Number.isFinite(numericValue)) {
            return numericValue;
        }
    }

    return undefined;
}

function formatInternshipDate(internship) {
    const timestamp = getPostedTimestamp(internship);

    if (typeof timestamp === "number") {
        const milliseconds =
            timestamp > 100000000000
                ? timestamp
                : timestamp * 1000;

        return dateFormatter.format(new Date(milliseconds));
    }

    if (
        typeof internship?.datePosted === "string" &&
        internship.datePosted.trim() !== ""
    ) {
        return internship.datePosted.trim();
    }

    return "Date not provided";
}

module.exports = {
    formatInternshipDate,
    getPostedTimestamp,
};
