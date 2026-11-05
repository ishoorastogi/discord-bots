const { getEnv } = require("../../../shared/config/env");
const select = require("../../../shared/dbs/crud/select");
const insert = require("../../../shared/dbs/crud/insert");
const update = require("../../../shared/dbs/crud/update");
const remove = require("../../../shared/dbs/crud/delete");
const { memberFileSchema, getMemberCategory, normalizeMemberRelationships } = require("./memberFileSchema");

const columns = {
    "phone number": "phone", "grad year": "grad_year", "positions held": "positions_held",
    "family line": "family_line", "brotherhood status": "brotherhood_status", "linkedin link": "linkedin_link",
};
const labels = Object.fromEntries(Object.entries(columns).map(([label, column]) => [column, label]));
const credentials = () => [getEnv("DB_USER"), getEnv("DB_PASSWORD")];

function fromRow(row) {
    return row ? Object.fromEntries(Object.entries(row).map(([column, value]) => [labels[column] || column, value])) : null;
}

function toRow(member) {
    return Object.fromEntries(
        Object.entries(member)
            .filter(([label]) => label !== "timestamp")
            .map(([label, value]) => {
                const column = columns[label] || label;

                if (column === "grad_year" && typeof value === "string") {
                    value = value.trim() ? Number(value) : null;
                }

                if (column === "nicknames" && Array.isArray(value)) {
                    value = value.join("; ");
                }

                return [column, value];
            })
    );
}

function uniqueMember(rows) {
    if (rows.length > 1) {
        const error = new Error("More than one member matches. Use a unique full name or nickname.");
        error.code = "AMBIGUOUS_MEMBER";
        error.options = [...new Set(rows.map(row => row.name))];
        throw error;
    }
    return fromRow(rows[0]);
}

async function translateErrors(operation) {
    try {
        return await operation();
    } catch (error) {
        if (error.code === "AMBIGUOUS_USER") error.code = "AMBIGUOUS_MEMBER";
        throw error;
    }
}

// Bot-specific field validation and presentation; SQL lives in shared/dbs/crud.
function createDatabaseHandlers() {
    async function findMember(name) {
        return uniqueMember(await select.selectUsersByName(name, ...credentials()));
    }

    async function findBrother(query) {
        return uniqueMember(await select.selectUsersByNameOrNickname(query, ...credentials()));
    }

    async function addMembers(members) {
        if (!Array.isArray(members)) throw new TypeError("Members must be an array of record objects.");
        const rows = members.map(member => {
            if (!member || typeof member !== "object" || Array.isArray(member)) throw new TypeError("Members must be record objects.");
            const normalized = normalizeMemberRelationships(member);
            for (const column of memberFileSchema) {
                if (column.name !== "name" && !Object.hasOwn(normalized, column.name)) continue;
                const error = column.validate?.(normalized[column.name]);
                if (error) throw new Error(error);
            }
            normalized.name = String(normalized.name).trim().replace(/\s+/g, " ");
            return toRow(normalized);
        });
        const results = await insert.upsertUsers(rows, ...credentials());

        return {
            added: results.filter(result => result.action === "inserted").length,
            updated: results.filter(result => result.action === "updated").length,
            unchanged: results.filter(result => result.action === "unchanged").length,
        };
    }

    async function updateMemberFields(name, pairs) {
        if (typeof name !== "string" || !name.trim()) throw new Error("Name is required.");
        if (!Array.isArray(pairs) || !pairs.length) throw new Error("Provide at least one category/value pair.");
        const fields = {};
        const errors = [];
        for (const pair of pairs) {
            const category = getMemberCategory(pair?.category);
            let message;
            if (!category) message = "Unknown member category.";
            else if (Object.hasOwn(fields, category.name)) message = `Category ${category.name} was provided more than once.`;
            else message = category.validate?.(pair.value);
            if (message) {
                errors.push({ category: category?.name ?? pair?.category ?? "Unknown category", value: pair?.value, message });
            } else {
                fields[category.name] = category.normalize ? category.normalize(pair.value) : pair.value;
                if (category.name === "name") fields.name = String(fields.name).trim().replace(/\s+/g, " ");
            }
        }
        if (!Object.keys(fields).length) return { created: false, name, categories: [], errors };
        return translateErrors(async () => {
            const result = await update.updateUserByName(name, toRow(fields), ...credentials());
            return {
                created: result.created, name: result.user.name,
                categories: result.updatedColumns.map(column => labels[column] || column),
                errors: [...errors, ...result.errors.map(error => ({ ...error,
                    category: labels[error.category] || error.category,
                    ...(error.code === "AMBIGUOUS_USER" ? { code: "AMBIGUOUS_MEMBER" } : {}),
                }))],
            };
        });
    }

    async function updateMember(name, category, value) {
        const result = await updateMemberFields(name, [{ category, value }]);
        if (!result.categories.length) {
            const error = new Error(result.errors[0].message);
            error.code = result.errors[0].code;
            throw error;
        }
        return { created: result.created, name: result.name, category: result.categories[0] };
    }

    async function deleteMember(name, expectedMember) {
        return translateErrors(async () => {
            const deleted = await remove.deleteUserByName(name, expectedMember ? toRow(expectedMember) : undefined, ...credentials());
            return deleted ? { deleted: true, name: deleted.name } : { deleted: false };
        });
    }

    return { findMember, findBrother, addMembers, updateMember, updateMemberFields, deleteMember };
}

module.exports = { createDatabaseHandlers };
