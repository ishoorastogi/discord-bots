const { fetchGreenhouseJobs } = require("../sources/greenhouse");
const { filterInternships } = require("./internshipFilter");
const sendInternshipNotification = require("../sendInternshipNotification");
const { logInfo, logWarn, logError } = require("../../../shared/utils/logger");

class InternshipPoller {
    constructor(client, config, seenJobsStore) {
        this.client = client;
        this.config = config;
        this.seenJobsStore = seenJobsStore;

        this.timer = null;
        this.running = false;
    }

    async runOnce() {
        if (this.running) {
            logWarn("Polling already running.");
            return;
        }

        this.running = true;

        try {
            let fetched = 0;
            let internships = 0;
            let sent = 0;

            for (const board of this.config.greenhouseBoards) {
                try {
                    logInfo(`Checking ${board.companyName}...`);

                    const jobs = await fetchGreenhouseJobs(
                        board.boardToken,
                        board.companyName
                    );

                    fetched += jobs.length;

                    const filtered = filterInternships(jobs);

                    internships += filtered.length;

                    for (const job of filtered) {

                        if (this.seenJobsStore.has(job.id)) {
                            continue;
                        }

                        await sendInternshipNotification(
                            this.client,
                            job
                        );

                        await this.seenJobsStore.markSeen(job.id);

                        sent++;

                        await delay(1000);
                    }

                } catch (err) {
                    logError(
                        `Failed processing ${board.companyName}`,
                        err
                    );
                }
            }

            logInfo(
                `Polling complete. Fetched=${fetched}, Internships=${internships}, Sent=${sent}`
            );

        } finally {
            this.running = false;
        }
    }

    start() {

        if (this.timer) {
            return;
        }

        const interval =
            this.config.pollIntervalMinutes *
            60 *
            1000;

        this.timer = setInterval(
            () => this.runOnce(),
            interval
        );

        logInfo(
            `Polling every ${this.config.pollIntervalMinutes} minutes.`
        );
    }

    stop() {

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = InternshipPoller;
