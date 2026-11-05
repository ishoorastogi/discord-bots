function text(value) {
    return String(value ?? "").trim();
}

function relationshipNames(value) {
    const names = [];
    const seen = new Set();
    for (const entry of Array.isArray(value) ? value : [value]) {
        if (entry === null || entry === undefined) {
            continue;
        }
        if (typeof entry !== "string") {
            throw new Error("Relationship names must be text.");
        }
        for (const part of entry.split(/[,;\r\n]+/)) {
            const name = part.trim().replace(/\s+/g, " ");
            if (name && !seen.has(name.toLowerCase())) {
                names.push(name);
                seen.add(name.toLowerCase());
            }
        }
    }
    return names;
}

const memberFileSchema = [
    {
        name: "timestamp",
        aliases: ["submission timestamp", "submitted at"],
        required: false,
    },
    {
        name: "name",
        aliases: ["full name", "brother name"],
        validate: value =>
            text(value) ? null : "Name is required.",
    },
    {
        name: "email",
        aliases: ["email address", "e-mail"],
        validate: value =>
            !text(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value))
                ? null
                : "Email must be a valid email address.",
    },
    {
        name: "phone number",
        aliases: ["phone", "number", "telephone", "mobile"],
        validate(value) {
            const number = text(value).replace(
                /\s*(?:ext\.?|x|#)\s*\d+$/i,
                ""
            );

            const digits = number.replace(/\D/g, "");

            return !text(value) ||
                (/^\+?[\d\s().-]+$/.test(number) &&
                    digits.length >= 7 &&
                    digits.length <= 15)
                ? null
                : "Phone number must contain 7-15 digits.";
        },
        normalize: value => text(value),
    },
    {
        name: "class",
        aliases: ["pledge class"],
    },
    {
        name: "major",
    },
    {
        name: "grad year",
        aliases: [
            "graduation year",
            "graduating year",
            "graduation date",
            "expected graduation",
            "expected graduation date",
        ],
        validate(value) {
            if (!text(value)) {
                return null;
            }

            if (value instanceof Date) {
                return Number.isNaN(value.getTime())
                    ? "Invalid graduation date."
                    : null;
            }

            const input = text(value);

            if (/^\d{4}$/.test(input)) {
                return null;
            }

            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(input)) {
                const [month, day, year] = input.split("/").map(Number);
                const date = new Date(Date.UTC(year, month - 1, day));

                return date.getUTCFullYear() === year &&
                    date.getUTCMonth() === month - 1 &&
                    date.getUTCDate() === day
                    ? null
                    : "Invalid graduation date.";
            }

            return "Grad year must be YYYY or MM/DD/YYYY.";
        },
        normalize(value) {
            if (!text(value)) {
                return null;
            }

            if (value instanceof Date) {
                return value.getFullYear();
            }

            const input = text(value);

            return Number(input.includes("/")
                ? input.split("/")[2]
                : input);
        },
    },
    {
        name: "positions held",
        aliases: [
            "position",
            "positions",
            "positions they have held",
            "positions they have held, and which ones",
            "position history",
        ],
    },
    {
        name: "family line",
        aliases: ["family lineage"],
    },
    {
        name: "nicknames",
        aliases: ["nickname"],
    },
    {
        name: "brotherhood status",
        aliases: ["status"],
    },
    {
        name: "linkedin link",
        aliases: [
            "linkedin",
            "linkedin url",
            "linkedin profile",
        ],
        validate(value) {
            if (!text(value)) {
                return null;
            }

            try {
                const link = text(value);
                const url = new URL(
                    /^https?:\/\//i.test(link)
                        ? link
                        : `https://${link}`
                );

                if (
                    ["https:", "http:"].includes(url.protocol) &&
                    (
                        url.hostname === "linkedin.com" ||
                        url.hostname.endsWith(".linkedin.com")
                    ) &&
                    !url.username &&
                    !url.password
                ) {
                    return null;
                }
            } catch {
                // Invalid URL.
            }

            return "LinkedIn link must point to linkedin.com.";
        },
    },
    {
        name: "big",
        aliases: ["big brother"],
        required: false,
        defaultValue: () => "",
        validate(value) {
            try {
                return relationshipNames(value).length > 1
                    ? "Big must contain only one person's name."
                    : null;
            } catch (error) {
                return error.message;
            }
        },
        normalize: value => relationshipNames(value)[0] || "",
    },
    {
        name: "littles",
        aliases: [
            "little",
            "litters",
            "litter",
            "little brothers",
        ],
        required: false,
        defaultValue: () => [],
        validate(value) {
            try {
                relationshipNames(value);
                return null;
            } catch (error) {
                return error.message;
            }
        },
        normalize: relationshipNames,
    },
    {
        name: "employer",
        aliases: ["works at", "company"],
        required: false,
    },
];

function normalizeMemberRelationships(member) {
    const result = { ...member };
    for (const column of memberFileSchema.filter(column => column.name === "big" || column.name === "littles")) {
        const keys = [column.name, ...column.aliases].filter(key => Object.hasOwn(member, key));
        const value = keys.flatMap(key => Array.isArray(member[key]) ? member[key] : [member[key]]);
        const error = column.validate(value);
        if (error) {
            throw new Error(error);
        }
        result[column.name] = column.normalize(value);
        for (const alias of column.aliases) {
            delete result[alias];
        }
    }
    return result;
}

function getMemberCategory(label) {
    const normalize = value => String(value).trim().toLowerCase().replace(/[_\W]+/g, " ").trim();
    const normalized = normalize(label);
    return memberFileSchema.find(column =>
        [column.name, ...(column.aliases || [])].some(name => normalize(name) === normalized)
    );
}

module.exports = { memberFileSchema, getMemberCategory, normalizeMemberRelationships };
