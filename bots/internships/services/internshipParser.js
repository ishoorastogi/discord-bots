/**
 * Cleans basic Markdown and HTML formatting from a table cell.
 *
 * @param {string} value
 * @returns {string}
 */
function cleanCell(value) {
    return value
        .replace(/<br\s*\/?>/gi, ", ")
        .replace(/<[^>]+>/g, "")
        .replace(/\*\*/g, "")
        .replace(/&nbsp;/gi, " ")
        .trim();
}

/**
 * Extracts the first HTTP(S) URL from a Markdown or HTML link.
 *
 * @param {string} value
 * @returns {string | undefined}
 */
function extractApplicationUrl(value) {
    const markdownLink = value.match(
        /\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i
    );

    if (markdownLink) {
        return markdownLink[1];
    }

    const htmlLink = value.match(
        /href=["'](https?:\/\/[^"']+)["']/i
    );

    if (htmlLink) {
        return htmlLink[1];
    }

    const rawUrl = value.match(/https?:\/\/[^\s|)]+/i);

    return rawUrl?.[0];
}

/**
 * Checks whether a parsed Markdown row is a separator row.
 *
 * @param {string[]} cells
 * @returns {boolean}
 */
function isSeparatorRow(cells) {
    return cells.every((cell) =>
        /^:?-{3,}:?$/.test(cell.trim())
    );
}

/**
 * Splits a Markdown table row into cells.
 *
 * @param {string} line
 * @returns {string[]}
 */
function splitTableRow(line) {
    const trimmed = line.trim();
    const withoutLeadingPipe = trimmed.startsWith("|")
        ? trimmed.slice(1)
        : trimmed;

    const withoutTrailingPipe = withoutLeadingPipe.endsWith("|")
        ? withoutLeadingPipe.slice(0, -1)
        : withoutLeadingPipe;

    return withoutTrailingPipe
        .split("|")
        .map((cell) => cell.trim());
}

/**
 * Parses available internships from the repository README.
 *
 * @param {string} markdown
 * @returns {Array<{
 *   company: string,
 *   role: string,
 *   location: string,
 *   applicationUrl: string,
 *   datePosted: string
 * }>}
 */
function parseInternships(markdown) {
    if (typeof markdown !== "string" || markdown.trim() === "") {
        throw new Error(
            "Internship parser requires non-empty Markdown content."
        );
    }

    const internships = [];
    const lines = markdown.split(/\r?\n/);

    let insideInternshipTable = false;
    let previousCompany;

    for (const line of lines) {
        const trimmed = line.trim();

        if (!insideInternshipTable) {
            const normalized = trimmed.toLowerCase();

            if (
                trimmed.startsWith("|") &&
                normalized.includes("company") &&
                normalized.includes("role") &&
                normalized.includes("application")
            ) {
                insideInternshipTable = true;
            }

            continue;
        }

        if (!trimmed.startsWith("|")) {
            if (internships.length > 0) {
                break;
            }

            continue;
        }

        const cells = splitTableRow(trimmed);

        if (cells.length < 5 || isSeparatorRow(cells)) {
            continue;
        }

        const [
            companyCell,
            roleCell,
            locationCell,
            applicationCell,
            dateCell,
        ] = cells;

        let company = cleanCell(companyCell);

        if (company === "↳" || company === "") {
            company = previousCompany;
        } else {
            previousCompany = company;
        }

        const role = cleanCell(roleCell);
        const location = cleanCell(locationCell);
        const applicationUrl =
            extractApplicationUrl(applicationCell);
        const datePosted = cleanCell(dateCell);

        if (!company || !role || !applicationUrl) {
            continue;
        }

        internships.push({
            company,
            role,
            location,
            applicationUrl,
            datePosted,
        });
    }

    if (internships.length === 0) {
        throw new Error(
            "No available internships were found in the repository Markdown."
        );
    }

    return internships;
}

module.exports = {
    parseInternships,
};