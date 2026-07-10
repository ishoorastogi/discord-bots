const INTERNSHIP_TERMS = [
  "intern",
  "internship",
  "co-op",
  "coop",
  "university graduate intern",
  "student program",
];

const EXCLUDED_TITLE_TERMS = [
  "senior",
  "staff",
  "principal",
  "director",
  "manager",
  "lead",
  "head of",
  "vice president",
  "vp",
];

function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

function containsAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function isInternship(job) {
  const title = normalizeText(job?.role);
  const description = normalizeText(job?.description);

  if (!title && !description) {
    return false;
  }

  const titleIsExcluded = containsAny(title, EXCLUDED_TITLE_TERMS);

  if (titleIsExcluded) {
    return false;
  }

  return (
    containsAny(title, INTERNSHIP_TERMS) ||
    containsAny(description, INTERNSHIP_TERMS)
  );
}

function filterInternships(jobs) {
  if (!Array.isArray(jobs)) {
    return [];
  }

  return jobs.filter(isInternship);
}

module.exports = {
  isInternship,
  filterInternships,
};