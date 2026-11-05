Run `npm run start:brotherhood` from the repository root.
Configure shared `DB_HOST`, `DB_PORT`, and `DB_NAME` in `shared/dbs/.env`.
Keep Brotherhood's `DB_USER` and `DB_PASSWORD` in `bots/brotherhood/.env`.
`shared/dbs/config.js` loads the shared connection settings so other applications
can reuse them with their own credentials. Process environment variables take
precedence over values in `.env` files. The bot's database
role needs the table and identity-sequence permissions from the provided schema.

Mention the bot with `/test` to receive `bot is online`.
Use `@Brotherhood Bot /status` to see the bot's Discord readiness, cache status
(`Not implemented`), and PostgreSQL connection state (`Connected`, `Reconnecting`,
`Disconnected`, or `Stopped`). Database status reflects the existing background
health checks.
Use `@Brotherhood Bot /help` to see available commands. Unknown commands point to
this help message.

Member lookup, imports, updates, and confirmed deletions use the shared PostgreSQL
scripts in `shared/dbs/crud`. Discord IDs are optional for these commands.

Anyone can look up a member with `@Brotherhood Bot /brother Full Name` or
`@Brotherhood Bot /brother nickname`. Names with spaces may be quoted or left
unquoted. Matching ignores case and extra spaces. Partial names and nicknames
work; for example, `/brother ishan` can find Ishan Rastogi. Exact full names take
priority. If several people match, the bot lists their full names and asks you to
clarify with a more specific `/brother` command. Nicknames can be stored as a
list or separated by commas, semicolons, or newlines. The response shows every
stored field and marks missing information as `Not provided`. Unknown names and
ambiguous matches receive an explanation. Lookup does not change the database.
For example: `@Brotherhood Bot /brother Ishan Rastogi`.

Only the bot owner configured by `BOT_OWNER_ID` in `.env` can request deletion.
To delete a member, send `@Brotherhood Bot /delete Full Name`. Quoting the name
is optional. The bot looks up that person and asks for confirmation. The owner
must confirm in the same channel within 60 seconds using `@Brotherhood Bot yes`,
or by replying directly to the prompt with `yes` and mentioning the bot. Use
`@Brotherhood Bot no` to cancel. Other users cannot confirm the request. Starting
another deletion in that channel replaces your previous request. Names match
without regard to case or extra spaces; duplicate names are rejected. The member
is removed only after confirmation, and a record that changes before confirmation
requires a new request.

Only the bot owner configured by `BOT_OWNER_ID` can use `/update`.
To update one field, send `@Brotherhood Bot /update "Full Name" category new value`.
To update several fields, separate the category/value pairs with semicolons.
Quote names containing spaces. Categories with spaces can be quoted or left
unquoted, and values can contain spaces. Quote values containing semicolons.
Examples:

```text
@Brotherhood Bot /update "John Smith" major Computer Science
@Brotherhood Bot /update "John Smith" grad year 2028
@Brotherhood Bot /update "John Smith" "phone number" "+1 (312) 555-1234"
@Brotherhood Bot /update "Ishan Rastogi" class Alpha Class; major Computer Science; grad year 2028
@Brotherhood Bot /update "Ishan Rastogi" big John Smith; littles "Jane Doe, Alex Patel"
@Brotherhood Bot /update "Ishan Rastogi" employer Acme Corporation
@Brotherhood Bot /update "Ishan Rastogi" works at Acme Corporation
@Brotherhood Bot /update "Ishan Rastogi" company Acme Corporation
```

`employer`, `works at`, and `company` all update the same employer field. Company
names can contain spaces. Use `employer ""` (or either alias) to clear the field.

Categories and field validation use the same rules as file imports below.
Unknown categories are rejected. Use `""` as the value to clear an optional field.
Use each category once per command. Valid pairs are saved even when other pairs
fail. The reply lists the saved categories and each failed pair with its reason,
followed by category help and an example. A conflicting name change is skipped
while other valid fields are updated. If all pairs fail, no member is created or
changed. Ambiguous matching names and database write failures prevent all changes.
The router updates the matching member in PostgreSQL or creates a
member and sets that field when the name is new. Names match without regard to
case or extra spaces. Duplicate matching names are rejected rather than choosing
a record. A unique first name or name prefix also works: `Sai`, `"Sai K"`, and
`"Sai Kotta"` can identify Sai Kottamasu. Matching compares consecutive letters
from the start of the stored name, and exact full names take priority. When more
than one person matches, no update is made; the bot lists the full names and asks
you to clarify with a longer name. If there is no match, a new member is created
as before. To rename a member, use the `name` category.

Each member has one `big` name (or `""`) and a `littles` array (or `[]`). The
`littles` category also accepts `little`, `litters`, and `litter`. Supply multiple
littles separated by commas, or by semicolons inside a quoted value. Repeated
names are deduplicated without regard to case. Updating either relationship field
replaces its value; use `""` to clear it. Relationship names are stored as provided.

To import a member file, send `@Brotherhood Bot /fileintake` with a CSV or XLSX
attachment. The bot confirms a successful import or reports each error's CSV line
range or worksheet name, row, and column. Each valid file is inserted into
`public.users` in a single transaction. A file with parsing or validation errors,
or a failed database insert, adds no records. PostgreSQL generates each member's
`user_id`; Discord IDs are optional. Re-uploading a valid file without Discord
IDs adds its records again. The upload limit is 10 MB per file.

The first nonempty row must contain these headers, in any order:

```csv
name,email,phone number,class,major,grad year,positions held,family line,nicknames,brotherhood status,linkedin link
```

Capitalization, spaces, underscores, and common alternatives such as `full name`,
`graduation year`, and `LinkedIn URL` are accepted. All original columns must be present;
only the name value is required on every data row. When provided, email and phone
numbers must have a valid format, graduation years must have four digits, and
LinkedIn URLs must point to linkedin.com. Positions, nicknames, class, major,
family line, and status are text fields. Quote CSV fields containing commas.
The optional `big` and `littles` columns use the same relationship rules as
`/update`; the `litters` header is also accepted. Older files without these columns
get an empty big and littles list.
The optional `employer` header also accepts `works at` and `company`.

`fileIntakeCommand.js` downloads attachments and calls the shared `fileParser.js`.
It returns parsed records and errors to `router.js`. `services/databaseHandlers.js`
maps command fields to database column names, validates updates, and passes
Brotherhood's credentials to the shared scripts. The shared scripts perform all
SQL queries and transactions. Brotherhood's column rules live in `services/memberFileSchema.js`.

`shared/dbs/crud/select.js` contains parameterized
SELECT helpers against `public.users`:

- `selectUsersByName(name, username, password)` returns all exact name matches, ignoring case and surrounding spaces.
- `selectUsersByNameOrNickname(query, username, password)` returns partial name/nickname matches, preferring exact full names.
- `selectUserById(userId, username, password)` returns one user or `null`.
- `selectUserByDiscordId(discordId, username, password)` returns one linked user or `null`.

These helpers return raw database rows. They are independent of Brotherhood and
use the supplied credentials with the shared database location. Each operation
closes its own connection. `shared/dbs/crud/insert.js` also provides `insertUser`
and `upsertUser`; see `shared/dbs/README.md` for their arguments and behavior.
To look up `test user` and print their `user_id`, run this from the repository root:

```sh
node bots/brotherhood/test-scripts/test-user-selection.js
```

The script loads Brotherhood's credentials, passes them to the SELECT helper,
and reports a missing or ambiguous name. The helper loads the shared database settings.

Run the Brotherhood and shared database tests from the repository root. Routing
contract tests use test doubles; PostgreSQL routing tests exercise the real shared
CRUD scripts with mocked clients:

```sh
node --test bots/brotherhood/services/tests/*.unit.js shared/dbs/tests/*.unit.js
```
