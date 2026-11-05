Shared database operations use `DB_HOST`, `DB_PORT`, and `DB_NAME` from this
directory's `.env`. Copy `.env.example` when setting up a new checkout. Process
environment variables take precedence over that file.

Each operation takes its database username and password as its final two arguments.
Applications load their own credentials and pass them in; these modules do not
load application env files or import files from any bot. Each call opens and closes
its own PostgreSQL connection, including on failure.

`crud/select.js` exports:

- `selectUsersByName(name, username, password)`: all exact name matches, ignoring case and extra whitespace.
- `selectUsersByNameOrNickname(query, username, password)`: partial names and nicknames, with exact full-name priority. Returns all matching users so callers can handle ambiguity.
- `selectUserById(userId, username, password)`: one user or `null`.
- `selectUserByDiscordId(discordId, username, password)`: one user or `null`.

`crud/insert.js` exports:

- `insertUser(user, username, password)`: insert a user and return the saved row.
- `insertUsers(users, username, password)`: insert a complete batch in one transaction and return the saved rows. Any failed insert rolls back the batch.
- `upsertUser(user, username, password)`: insert or update a user by name, returning the saved row.

Pass user records using the `public.users` column names, such as `name`, `phone`,
`grad_year`, and `littles`. PostgreSQL generates `user_id`; callers cannot supply it.
Both methods accept users without Discord IDs. `upsertUser` requires a nonempty
name and matches it case-insensitively, ignoring extra whitespace. It inserts
when there is no match and updates only the supplied fields when exactly one
user matches. Existing name spelling is preserved. Duplicate matching names fail
with `AMBIGUOUS_USER`; no records are changed. The lookup and write share one
transaction with a table lock to prevent concurrent inserts for the same name.
Undefined fields are omitted; explicit `null` clears a field.
Both methods use parameterized values and an allowlist of column names.

`crud/update.js` exports `updateUserByName(name, updates, username, password)`.
It prefers an exact full name, then allows a unique name prefix. No match creates
a user with that name and the supplied fields. It returns
`{ created, user, updatedColumns, errors }`. An ambiguous name throws
`AMBIGUOUS_USER` with full-name `options` and changes no records. A conflicting
rename is skipped and reported in `errors` while other supplied fields save.

`crud/delete.js` exports `deleteUserByName(name, expectedUser, username, password)`.
It matches exact names with the same case/whitespace rules, rejects duplicates,
and returns the deleted row or `null` when absent. If `expectedUser` is supplied,
the current row must match that snapshot, including `user_id`; a changed record
throws `MEMBER_CHANGED` and is not deleted. PostgreSQL applies the schema's
foreign-key actions to related records.

Updates, upserts, and deletes hold a table lock during name resolution and writes.
These helpers have no dependency on bot files. Callers own authorization and
confirmation; Brotherhood's router enforces those before calling them.

Example from the repository root, after loading the calling application's credentials:

```js
const { selectUsersByName } = require("./shared/dbs/crud/select");
const { insertUser, upsertUser } = require("./shared/dbs/crud/insert");
const username = process.env.DB_USER;
const password = process.env.DB_PASSWORD;

const users = await selectUsersByName("test user", username, password);
const created = await insertUser({ name: "New User", major: "Math" }, username, password);
const updated = await upsertUser({ name: "New User", major: "Physics" }, username, password);
```

Rows retain the database's column names. PostgreSQL `BIGINT` user IDs are returned
as strings by `pg` to preserve precision. Database errors propagate to the caller.

To exercise upsert, run the insert test with the calling application's credentials:

```sh
node --env-file=bots/brotherhood/.env shared/dbs/test-scripts/test-user-insert.js
```

It finds exactly one `test user`, numerically increments their phone by one, and
calls `upsertUser` with the user's name and new phone. It prints the user
ID and saved phone. The phone must contain only digits; leading zeroes are preserved.
Each run writes the incremented value to the configured database. Other applications can
supply their own env file or provide `DB_USER` and `DB_PASSWORD` in the environment.

Run the offline CRUD tests:

```sh
node --test shared/dbs/tests/*.unit.js
```
