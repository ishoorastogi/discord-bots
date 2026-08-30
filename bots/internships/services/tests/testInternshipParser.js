const assert = require("assert");

const {
    readInternshipRepo,
} = require("../../repos/readInternshipRepo");

const {
    parseInternships,
} = require("../internshipParser");

const {
    logInfo,
    logError,
} = require("../../../../shared/utils/logger");

function makeListing(overrides = {}) {
    return {
        id: "listing-1",
        company_name: "Acme",
        title: "Software Engineer Intern",
        locations: ["Austin, TX", "Remote"],
        date_posted: 1787356800,
        active: true,
        is_visible: true,
        url: "https://example.com/apply",
        ...overrides,
    };
}

function runParserAssertions() {
    const internships = parseInternships(
        JSON.stringify([
            makeListing(),
            makeListing({
                id: "inactive",
                active: false,
            }),
            makeListing({
                id: "hidden",
                is_visible: false,
            }),
        ])
    );

    assert.strictEqual(internships.length, 1);
    assert.deepStrictEqual(internships[0], {
        id: "listing-1",
        company: "Acme",
        role: "Software Engineer Intern",
        location: "Austin, TX, Remote",
        locations: ["Austin, TX", "Remote"],
        applicationUrl: "https://example.com/apply",
        datePosted: 1787356800,
    });
}

async function runLiveSmokeTest() {
    const file = await readInternshipRepo();
    const internships = parseInternships(file.content);

    assert.ok(
        internships.length > 0,
        "expected live source to contain internships"
    );

    logInfo(
        `Parsed ${internships.length} active, visible internships.`
    );

    for (const internship of internships.slice(0, 5)) {
        logInfo(
            `${internship.company} | ` +
            `${internship.role} | ` +
            `${internship.location} | ` +
            `${internship.datePosted} | ` +
            internship.applicationUrl
        );
    }
}

async function testInternshipParser() {
    try {
        runParserAssertions();
        await runLiveSmokeTest();
    } catch (error) {
        logError(
            "Failed to parse internship repository",
            error
        );

        process.exitCode = 1;
    }
}

testInternshipParser();
