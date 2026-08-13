const GREENHOUSE_API_BASE =
  "https://boards-api.greenhouse.io/v1/boards";

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGreenhouseJob(job, boardToken, companyName) {
  return {
    id: `greenhouse:${boardToken}:${job.id}`,
    source: "Greenhouse",
    sourceCompanyToken: boardToken,
    company: companyName,
    role: job.title?.trim() || "Untitled role",
    location: job.location?.name?.trim() || "Location not listed",
    url: job.absolute_url || "",
    description: stripHtml(job.content || ""),
    postedAt: job.updated_at ? new Date(job.updated_at) : null,
  };
}

async function fetchGreenhouseJobs(boardToken, companyName) {
  if (!boardToken || !companyName) {
    throw new Error(
      "fetchGreenhouseJobs requires both boardToken and companyName"
    );
  }

  const encodedBoardToken = encodeURIComponent(boardToken);
  const url =
    `${GREENHOUSE_API_BASE}/${encodedBoardToken}/jobs?content=true`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "discord-internship-bot",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Greenhouse request failed for ${companyName} ` +
        `(${response.status} ${response.statusText})`
    );
  }

  let payload;

  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(
      `Greenhouse returned invalid JSON for ${companyName}: ${error.message}`
    );
  }

  if (!Array.isArray(payload.jobs)) {
    throw new Error(
      `Greenhouse response for ${companyName} did not contain a jobs array`
    );
  }

  return payload.jobs.map((job) =>
    normalizeGreenhouseJob(job, boardToken, companyName)
  );
}

module.exports = {
  fetchGreenhouseJobs,
  normalizeGreenhouseJob,
  stripHtml,
};