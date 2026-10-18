const { test } = require("node:test");
const { assert, load, bot, job, listing } = require("./helpers/unit");
const filter = load(bot + "services/internshipFilter.js");
const parser = load(bot + "services/internshipParser.js");
const dates = load(bot + "services/internshipDateFormatter.js");

test("parser normalizes array/string locations, IDs, dates and required fields", () => {
    assert.deepEqual(parser.normalizeLocations([" Austin, TX ", null, "", "Remote"]), ["Austin, TX", "Remote"]);
    assert.deepEqual(parser.normalizeLocations(" Austin, TX; Remote\nNYC "), ["Austin, TX", "Remote", "NYC"]);
    assert.deepEqual(parser.normalizeLocations(null), []);
    const results = parser.parseInternships(JSON.stringify([
        listing({ id: " spaced ", date_posted: "1787356800" }),
        listing({ id: "", locations: "NYC; Remote", date_posted: "unknown" }),
        ...["active", "is_visible"].map(key => listing({ [key]: false })),
        ...["company_name", "title", "url"].map(key => listing({ [key]: "" })),
    ]));
    assert.equal(results.length, 2);
    assert.equal(results[0].id, "spaced");
    assert.equal(results[0].datePosted, 1787356800);
    assert.equal(results[1].id, undefined);
    assert.equal(results[1].datePosted, undefined);
    assert.equal(results[1].location, "NYC, Remote");
});

for (const [input, error] of [[null, /non-empty/], [" ", /non-empty/], ["{", /Failed to parse/], ["{}", /array/], ["[]", /No active/]]) {
    test(`parser rejects unusable input ${JSON.stringify(input)}`, () => assert.throws(() => parser.parseInternships(input), error));
}

test("date helpers support seconds, milliseconds, numeric strings, legacy labels and missing dates", () => {
    const seconds = Date.UTC(2026, 0, 2) / 1000;
    for (const value of [seconds, seconds * 1000, String(seconds)]) {
        assert.equal(dates.formatInternshipDate({ datePosted: value }), "Jan 2");
        assert.equal(dates.getPostedTimestamp({ datePosted: value }), Number(value));
    }
    assert.equal(dates.getPostedTimestamp({ datePostedRaw: seconds, datePosted: "legacy" }), seconds);
    assert.equal(dates.formatInternshipDate({ datePosted: " Jan 3 " }), "Jan 3");
    for (const value of [undefined, {}, { datePosted: "" }, { datePosted: Infinity }]) {
        assert.equal(dates.getPostedTimestamp(value), undefined);
        assert.equal(dates.formatInternshipDate(value), "Date not provided");
    }
    assert.equal(filter.parsePostedDate("Jan 2", 2026).getFullYear(), 2026);
    assert.ok(filter.parsePostedDate("Jan 2") instanceof Date);
    for (const value of [null, "", "2026-99-99"]) assert.equal(filter.parsePostedDate(value), undefined);
});

test("identity helpers preserve source IDs, match legacy history and deduplicate stably", () => {
    const a = job({ id: " source ", company: " ACME " });
    assert.equal(filter.createInternshipId(a), "source");
    assert.equal(filter.createLegacyInternshipId(a), "acme|software engineering intern|austin, tx|https://example.com/apply");
    const legacy = job({ id: undefined });
    assert.equal(filter.createInternshipId(legacy), filter.createLegacyInternshipId(legacy));
    assert.equal(filter.createLegacyInternshipId({}), "|||");
    assert.deepEqual([...filter.getInternshipIdentityKeys(a)], ["source", filter.createLegacyInternshipId(a)]);
    assert.deepEqual([...filter.getInternshipIdentityKeys("saved-id")], ["saved-id"]);
    assert.equal(filter.getInternshipIdentityKeys(null).size, 0);
    assert.deepEqual(filter.removeDuplicateInternships([a, a, job({ id: "other" })]), [a, job({ id: "other" })]);
});

const fields = [
    ["", "Software Engineering Intern"], ["CS", "Backend Developer Intern"],
    ["ME", "Mechanical Engineering Intern"], ["EE", "Electrical Engineering Intern"],
    ["BM", "Biomedical Engineering Intern"], ["CE", "Computer Engineering Intern"],
];
for (const [field, role] of fields) {
    const predicate = field ? `is${field}Internship` : "isEngineeringInternship";
    const rank = `getTop${field}Internships`;
    test(`${predicate} classifies roles and ${rank} ranks, deduplicates and limits results`, () => {
        assert.equal(filter[predicate](job({ role })), true);
        assert.equal(filter[predicate](job({ role: "Accounting Intern" })), false);
        assert.equal(filter[predicate]({}), false);
        const old = job({ id: "old", role, datePosted: 1 });
        const fresh = job({ id: "fresh", role, datePosted: 2 });
        const tie = job({ id: "tie", role, datePosted: 2 });
        const unknownDate = job({ id: "unknown", role, datePosted: undefined });
        const foreign = job({ id: "foreign", role, locations: ["Toronto, Canada"] });
        assert.deepEqual(filter[rank]([old, fresh, fresh, tie, foreign, unknownDate]), [fresh, tie, old, unknownDate]);
        assert.deepEqual(filter[rank]([old, fresh], 1), [fresh]);
        assert.deepEqual(filter[rank]([]), []);
        assert.throws(() => filter[rank](null), TypeError);
        for (const limit of [0, -1, 1.5, "5"]) assert.throws(() => filter[rank]([old], limit), RangeError);
    });
}

for (const [location, expected] of [
    ["Austin, TX", true], ["NYC", true], ["Remote", true], ["Remote - US", true],
    ["United States", true], ["USA", true], ["U.S.", true], ["SF", true],
    ["Toronto, Canada", false], ["UK", false], ["London", false], ["Atlantis", false], ["", false],
]) {
    test(`location filter: ${JSON.stringify(location)}`, () => {
        assert.equal(filter.isUSInternship({ location }), expected);
        assert.equal(filter.isUSInternship({ locations: [null, " ", location] }), expected);
    });
}
test("location filter accepts any US location and handles absent locations", () => {
    assert.equal(filter.isUSInternship({ location: "London;NYC\nToronto" }), true);
    assert.equal(filter.isUSInternship({}), false);
    assert.equal(filter.isUSInternship(null), false);
});
