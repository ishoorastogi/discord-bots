const assert = require("assert");

const {
    readInternshipRepo,
} = require("../../repos/readInternshipRepo");

const {
    parseInternships,
} = require("../internshipParser");

const {
    getTopInternships,
    getTopCSInternships,
    getTopMEInternships,
    isUSInternship,
} = require("../internshipFilter");

const {
    logInfo,
    logError,
} = require("../../../../shared/utils/logger");

function internship(overrides = {}) {
    return {
        id: "base-id",
        company: "Acme",
        role: "Software Engineer Intern",
        location: "Austin, TX",
        locations: ["Austin, TX"],
        applicationUrl: "https://example.com/apply",
        datePosted: 1787356800,
        ...overrides,
    };
}

function runFilterAssertions() {
    const olderSoftware = internship({
        id: "older-software",
        company: "Software Co",
        role: "Software Engineer Intern",
        datePosted: 1787356800,
    });

    const newerHardware = internship({
        id: "newer-hardware",
        company: "Hardware Co",
        role: "Hardware Engineering Intern",
        datePosted: 1787443200,
    });

    const ranked = getTopInternships(
        [olderSoftware, newerHardware],
        2
    );

    assert.strictEqual(
        ranked[0].id,
        "newer-hardware",
        "newer hardware must outrank older software even when later in source order"
    );

    assert.strictEqual(
        getTopCSInternships(
            [
                olderSoftware,
                internship({
                    id: "newer-cs",
                    role: "Backend Developer Intern",
                    datePosted: 1787529600,
                }),
            ],
            2
        )[0].id,
        "newer-cs"
    );

    assert.strictEqual(
        getTopMEInternships(
            [
                internship({
                    id: "older-me",
                    role: "Mechanical Engineering Intern",
                    datePosted: 1787356800,
                }),
                internship({
                    id: "newer-me",
                    role: "Manufacturing Engineering Intern",
                    datePosted: 1787529600,
                }),
            ],
            2
        )[0].id,
        "newer-me"
    );

    assert.strictEqual(
        isUSInternship(
            internship({
                locations: ["Remote in Canada"],
                location: "Remote in Canada",
            })
        ),
        false
    );

    assert.strictEqual(
        isUSInternship(
            internship({
                locations: ["Remote"],
                location: "Remote",
            })
        ),
        true
    );

    assert.strictEqual(
        isUSInternship(
            internship({
                locations: ["London, UK"],
                location: "London, UK",
            })
        ),
        false
    );

    assert.strictEqual(
        isUSInternship(
            internship({
                locations: ["NYC", "London, UK"],
                location: "NYC, London, UK",
            })
        ),
        true
    );
}

async function runLiveSmokeTest() {
    const file = await readInternshipRepo();
    const internships = parseInternships(file.content);
    const topInternships = getTopInternships(internships, 5);

    assert.ok(
        topInternships.length > 0,
        "expected live source to contain eligible internships"
    );

    logInfo(
        `Selected ${topInternships.length} of ` +
        `${internships.length} active, visible internships.`
    );

    topInternships.forEach((internship, index) => {
        logInfo(
            `${index + 1}. ${internship.company} | ` +
            `${internship.role} | ` +
            `${internship.location} | ` +
            `${internship.datePosted}`
        );
    });
}

async function testInternshipFilter() {
    try {
        runFilterAssertions();
        await runLiveSmokeTest();
    } catch (error) {
        logError("Failed to filter internships", error);
        process.exitCode = 1;
    }
}

testInternshipFilter();
