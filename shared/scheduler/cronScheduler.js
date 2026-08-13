const cron = require("node-cron");

/**
 * Validates an hour value for daily scheduling.
 *
 * @param {number} hour - Hour in 24-hour time.
 * @throws {Error} If the hour is invalid.
 */
function validateHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error("Cron job hour must be an integer between 0 and 23.");
  }
}

/**
 * Validates a minute value for daily scheduling.
 *
 * @param {number} minute - Minute of the hour.
 * @throws {Error} If the minute is invalid.
 */
function validateMinute(minute) {
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error("Cron job minute must be an integer between 0 and 59.");
  }
}

/**
 * Validates an IANA timezone string.
 *
 * @param {string} timezone - IANA timezone name.
 * @throws {Error} If the timezone is invalid.
 */
function validateTimezone(timezone) {
  if (typeof timezone !== "string" || !timezone.trim()) {
    throw new Error("Cron job timezone must be a non-empty string.");
  }

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone.trim(),
    });
  } catch (error) {
    throw new Error(`Invalid cron job timezone: ${timezone}`);
  }
}

/**
 * Validates a scheduled job callback.
 *
 * @param {Function} job - Job callback.
 * @throws {Error} If the job is invalid.
 */
function validateJob(job) {
  if (typeof job !== "function") {
    throw new Error("Cron job callback must be a function.");
  }
}

/**
 * Schedules a job to run once per day at the requested local time.
 *
 * @param {object} options - Daily schedule options.
 * @param {number} options.hour - Hour in 24-hour time, from 0 to 23.
 * @param {number} options.minute - Minute of the hour, from 0 to 59.
 * @param {string} options.timezone - IANA timezone name.
 * @param {Function} options.job - Function to run on schedule.
 * @returns {import("node-cron").ScheduledTask} The scheduled cron task.
 * @throws {Error} If any schedule option is invalid.
 */
function scheduleDailyJob({ hour, minute, timezone, job }) {
  validateHour(hour);
  validateMinute(minute);
  validateTimezone(timezone);
  validateJob(job);

  const expression = `${minute} ${hour} * * *`;

  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression generated: ${expression}`);
  }

  return cron.schedule(expression, job, {
    timezone: timezone.trim(),
  });
}

module.exports = {
  scheduleDailyJob,
};
