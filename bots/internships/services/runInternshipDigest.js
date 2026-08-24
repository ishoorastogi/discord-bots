const fs = require("fs/promises");
const path = require("path");

const {
    createInternshipId,
} = require("./internshipFilter");

const {
    getCurrentInternships,
} = require("./getCurrentInternships");

const {
    sendInternshipNotification,
} = require("../sendInternshipNotification");

const SENT_INTERNSHIPS_PATH = path.join(
    __dirname,
    "../data/sentInternships.json"
);

async function readSentInternships() {
    try {
        const contents = await fs.readFile(
            SENT_INTERNSHIPS_PATH,
            "utf8"
        );

        const sentInternships = JSON.parse(contents);

        if (!Array.isArray(sentInternships)) {
            return [];
        }

        return sentInternships;
    } catch (error) {
        if (error.code === "ENOENT") {
            return [];
        }

        throw error;
    }
}

function getSavedInternshipId(internship) {
    if (typeof internship === "string") {
        return internship;
    }

    if (internship?.id) {
        return internship.id;
    }

    return createInternshipId(internship);
}

function createSavedInternship(internship) {
    return {
        id: createInternshipId(internship),
        company: internship.company,
        role: internship.role,
        location: internship.location,
        applicationUrl: internship.applicationUrl,
        datePosted: internship.datePosted,
    };
}

async function writeSentInternships(internships) {
    await fs.writeFile(
        SENT_INTERNSHIPS_PATH,
        JSON.stringify(internships, null, 2),
        "utf8"
    );
}

function selectInternshipsFromHistory({
    internships,
    sentInternships,
    limit = 5,
}) {
    const sentIds = new Set(
        sentInternships.map(getSavedInternshipId)
    );

    const newInternships = internships.filter(
        (internship) =>
            !sentIds.has(createInternshipId(internship))
    );

    const internshipsToSend = newInternships.slice(
        0,
        limit
    );

    if (internshipsToSend.length < limit) {
        const remainingSlots =
            limit - internshipsToSend.length;

        const fallbackInternships = internships
            .filter((internship) =>
                sentIds.has(createInternshipId(internship))
            )
            .slice(0, remainingSlots);

        internshipsToSend.push(
            ...fallbackInternships
        );
    }

    return {
        internshipsToSend,
        sentIds,
    };
}

async function getInternshipsToSend(
    internships,
    limit = 5
) {
    const sentInternships =
        await readSentInternships();

    const {
        internshipsToSend,
        sentIds,
    } = selectInternshipsFromHistory({
        internships,
        sentInternships,
        limit,
    });

    return {
        internshipsToSend,
        sentInternships,
        sentIds,
    };
}

async function saveShownInternships({
    internshipsToSend,
    sentInternships,
    sentIds,
}) {
    for (const internship of internshipsToSend) {
        const id = createInternshipId(internship);

        if (!sentIds.has(id)) {
            sentInternships.push(
                createSavedInternship(internship)
            );

            sentIds.add(id);
        }
    }

    await writeSentInternships(
        sentInternships.filter(
            (internship) =>
                typeof internship !== "string"
        )
    );
}

async function runInternshipDigest({
    client,
    channelId,
    limit = 5,
}) {
    const rankedInternships =
        await getCurrentInternships();

    const {
        internshipsToSend,
        sentInternships,
        sentIds,
    } = await getInternshipsToSend(
        rankedInternships,
        limit
    );

    await sendInternshipNotification(
        client,
        channelId,
        internshipsToSend
    );

    await saveShownInternships({
        internshipsToSend,
        sentInternships,
        sentIds,
    });

    return internshipsToSend;
}

module.exports = {
    createSavedInternship,
    getSavedInternshipId,
    getInternshipsToSend,
    readSentInternships,
    runInternshipDigest,
    saveShownInternships,
    writeSentInternships,
};
