const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { memberFileSchema, getMemberCategory, normalizeMemberRelationships } = require("../services/memberFileSchema");

const DATABASE_PATH = path.join(__dirname, "../test-db/test-db.json");

function normalizeName(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function createLocalDatabase(databasePath = DATABASE_PATH) {
    let pending = Promise.resolve();

    async function readDatabase() {
        let contents;
        try {
            contents = await fs.readFile(databasePath, "utf8");
        } catch (error) {
            if (error.code !== "ENOENT") {
                throw error;
            }
        }

        let database = { members: [] };
        if (contents?.trim()) {
            try {
                database = JSON.parse(contents);
            } catch (error) {
                throw new Error("Local test database contains invalid JSON; existing data was not changed.", { cause: error });
            }
            if (!database || Array.isArray(database) || !Array.isArray(database.members)) {
                throw new Error("Local test database must contain a members array; existing data was not changed.");
            }
        }

        return database;
    }

    async function writeDatabase(updated) {
        const temporaryPath = path.join(path.dirname(databasePath), `.${path.basename(databasePath)}.${randomUUID()}.tmp`);
        await fs.mkdir(path.dirname(databasePath), { recursive: true });
        try {
            await fs.writeFile(temporaryPath, JSON.stringify(updated, null, 2) + "\n", {
                encoding: "utf8", flag: "wx", mode: 0o600,
            });
            await fs.rename(temporaryPath, databasePath);
        } catch (error) {
            await fs.unlink(temporaryPath).catch(() => {});
            throw error;
        }
    }

    function enqueue(task) {
        const operation = pending.then(task);
        // One failed write must not prevent future uploads from being saved.
        pending = operation.catch(() => {});
        return operation;
    }

    function addMembers(members) {
        return enqueue(async () => {
            if (!Array.isArray(members) || members.some(member =>
                !member || typeof member !== "object" || Array.isArray(member))) {
                throw new TypeError("Members must be an array of record objects.");
            }
            const database = await readDatabase();
            const updated = { ...database, members: [...database.members, ...members.map(normalizeMemberRelationships)] };
            await writeDatabase(updated);
            return { added: members.length, total: updated.members.length };
        });
    }

    function updateMember(name, label, value) {
        return updateMemberFields(name, [{ category: label, value }]).then(saved => {
            if (!saved.categories.length) {
                const failure = saved.errors[0];
                const error = new Error(failure.message);
                error.code = failure.code;
                throw error;
            }
            return { created: saved.created, name: saved.name, category: saved.categories[0] };
        });
    }

    function updateMemberFields(name, updates) {
        return enqueue(async () => {
            if (!normalizeName(name)) {
                throw new Error("Name is required.");
            }
            if (!Array.isArray(updates) || !updates.length) {
                throw new Error("Provide at least one category/value pair.");
            }
            const seen = new Set();
            const errors = [];
            let validated = [];
            for (const update of updates) {
                const category = getMemberCategory(update?.category);
                const fail = message => errors.push({ category: category?.name ?? update?.category ?? "Unknown category", value: update?.value, message });
                if (!category) {
                    fail("Unknown member category.");
                    continue;
                }
                if (seen.has(category.name)) {
                    fail(`Category ${category.name} was provided more than once.`);
                    continue;
                }
                const validationError = category.validate?.(update.value);
                if (validationError) {
                    fail(validationError);
                    continue;
                }
                seen.add(category.name);
                validated.push({ category: category.name, value: category.normalize ? category.normalize(update.value) : update.value });
            }
            if (!validated.length) {
                return { created: false, name, categories: [], errors };
            }

            const database = await readDatabase();
            const normalizedName = normalizeName(name);
            const exactMatches = database.members.filter(member => normalizeName(member.name) === normalizedName);
            const matches = exactMatches.length ? exactMatches :
                database.members.filter(member => normalizeName(member.name).startsWith(normalizedName));
            const rename = validated.find(update => update.category === "name");
            if (matches.length > 1) {
                const error = new Error("More than one member matches that name. No changes were saved.");
                error.code = "AMBIGUOUS_MEMBER";
                error.options = [...new Set(matches.map(member => member.name))];
                throw error;
            }
            if (rename && database.members.some(member =>
                member !== matches[0] && normalizeName(member.name) === normalizeName(rename.value))) {
                errors.push({ ...rename, code: "AMBIGUOUS_MEMBER", message: "Another member already has that name. The name was not changed." });
                validated = validated.filter(update => update !== rename);
            }
            if (!validated.length) {
                return { created: false, name, categories: [], errors };
            }
            const created = matches.length === 0;
            const member = matches[0] || {
                ...Object.fromEntries(memberFileSchema.map(column => [column.name, column.defaultValue ? column.defaultValue() : ""])),
                name: String(name).trim().replace(/\s+/g, " "),
            };
            for (const update of validated) {
                member[update.category] = update.value;
            }
            const normalizedMember = normalizeMemberRelationships(member);
            if (created) {
                database.members.push(normalizedMember);
            } else {
                database.members[database.members.indexOf(member)] = normalizedMember;
            }
            await writeDatabase(database);
            return { created, name: normalizedMember.name, categories: validated.map(update => update.category), errors };
        });
    }

    function matchingMember(database, name) {
        if (!normalizeName(name)) {
            throw new Error("Name is required.");
        }
        const matches = database.members.filter(member => normalizeName(member.name) === normalizeName(name));
        if (matches.length > 1) {
            const error = new Error("More than one member matches that name. No records were deleted.");
            error.code = "AMBIGUOUS_MEMBER";
            throw error;
        }
        return matches[0] || null;
    }

    function findMember(name) {
        return enqueue(async () => matchingMember(await readDatabase(), name));
    }

    function findBrother(query) {
        return enqueue(async () => {
            const normalized = normalizeName(query);
            if (!normalized) {
                throw new Error("Provide a name or nickname.");
            }
            const database = await readDatabase();
            const exactNames = database.members.filter(member => normalizeName(member.name) === normalized);
            // Exact full names let users select an option even when another name contains it.
            const matches = exactNames.length ? exactNames : database.members.filter(member => {
                if (normalizeName(member.name).includes(normalized)) {
                    return true;
                }
                const nicknames = Array.isArray(member.nicknames) ? member.nicknames : [member.nicknames];
                return nicknames.some(value => {
                    const nickname = String(value ?? "");
                    return normalizeName(nickname) === normalized || nickname.split(/[,;\r\n]+/)
                        .some(value => normalizeName(value).includes(normalized));
                });
            });
            if (matches.length > 1) {
                const error = new Error("More than one brother matches that name or nickname. Use a unique full name or nickname.");
                error.code = "AMBIGUOUS_MEMBER";
                error.options = [...new Set(matches.map(member => member.name))];
                throw error;
            }
            return matches[0] || null;
        });
    }

    function deleteMember(name, expectedMember) {
        return enqueue(async () => {
            const database = await readDatabase();
            const member = matchingMember(database, name);
            if (!member) {
                return { deleted: false };
            }
            if (expectedMember && JSON.stringify(member) !== JSON.stringify(expectedMember)) {
                const error = new Error("That member's record changed after the confirmation prompt. Use /delete again. No records were deleted.");
                error.code = "MEMBER_CHANGED";
                throw error;
            }
            database.members = database.members.filter(candidate => candidate !== member);
            await writeDatabase(database);
            return { deleted: true, name: member.name };
        });
    }

    return { addMembers, updateMember, updateMemberFields, findMember, findBrother, deleteMember };
}

module.exports = { ...createLocalDatabase(), createLocalDatabase };
