const fs = require("fs/promises");
const path = require("path");

const { logWarn } = require("../../../shared/utils/logger");

const DEFAULT_RETENTION_DAYS = 90;

class SeenJobsStore {
  constructor(options = {}) {
    this.filePath =
      options.filePath ||
      path.resolve(__dirname, "../data/seen-jobs.json");

    this.retentionDays =
      options.retentionDays || DEFAULT_RETENTION_DAYS;

    this.entries = new Map();
    this.savePromise = Promise.resolve();
  }

  async load() {
    await fs.mkdir(path.dirname(this.filePath), {
      recursive: true,
    });

    try {
      const raw = await fs.readFile(this.filePath, "utf8");

      if (!raw.trim()) {
        this.entries.clear();
        return;
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Seen jobs file must contain a JSON object.");
      }

      this.entries = new Map(
        Object.entries(parsed).filter(
          ([jobId, firstSeen]) =>
            jobId &&
            typeof firstSeen === "string"
        )
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        this.entries.clear();
        await this.save();
        return;
      }

      logWarn(
        `Could not load seen jobs file. Starting with an empty store: ${error.message}`
      );

      this.entries.clear();
      await this.save();
    }
  }

  has(jobId) {
    return this.entries.has(jobId);
  }

  async markSeen(jobId) {
    if (!jobId) {
      throw new Error("Cannot mark a job as seen without a job ID.");
    }

    if (!this.entries.has(jobId)) {
      this.entries.set(jobId, new Date().toISOString());
    }

    await this.save();
  }

  prune() {
    const cutoff =
      Date.now() -
      this.retentionDays * 24 * 60 * 60 * 1000;

    let removedCount = 0;

    for (const [jobId, firstSeen] of this.entries) {
      const timestamp = Date.parse(firstSeen);

      if (!Number.isFinite(timestamp) || timestamp < cutoff) {
        this.entries.delete(jobId);
        removedCount += 1;
      }
    }

    return removedCount;
  }

  async save() {
    this.savePromise = this.savePromise.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), {
        recursive: true,
      });

      const temporaryPath = `${this.filePath}.tmp`;
      const contents = JSON.stringify(
        Object.fromEntries(this.entries),
        null,
        2
      );

      await fs.writeFile(temporaryPath, `${contents}\n`, "utf8");
      await fs.rename(temporaryPath, this.filePath);
    });

    return this.savePromise;
  }
}

module.exports = {
  SeenJobsStore,
};
