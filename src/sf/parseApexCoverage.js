const DEFAULT_MINIMUM_COVERAGE = 75;

function parseLabeledValue(report, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sameLine = report.match(new RegExp(`^\\s*${escaped}\\s{2,}([^\\r\\n]+)`, "im"));
  if (sameLine) {
    return sameLine[1].trim();
  }

  const nextLine = report.match(new RegExp(`^\\s*${escaped}\\s*\\r?\\n\\s*([^\\r\\n]+)`, "im"));
  return nextLine ? nextLine[1].trim() : null;
}

function parsePercent(value) {
  if (!value) {
    return null;
  }

  const match = String(value).match(/(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

function isSeparator(line) {
  return /^[\s\u2500-\u257F\u2550\-|]+$/.test(line) && line.trim().length > 0;
}

function parseCoverageRow(line) {
  const match = line.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)%(?:\s+(.*))?$/);
  if (!match) {
    return null;
  }

  const uncoveredLines = (match[3] ?? "").trim();
  return {
    name: match[1],
    coveredPercent: Number(match[2]),
    uncoveredLines: uncoveredLines || null,
    uncoveredLinesTruncated: uncoveredLines.includes("..."),
  };
}

function parseCoverageTable(report) {
  const lines = String(report ?? "").split(/\r?\n/);
  let inTable = false;
  let coverageTableFound = false;
  const classes = [];

  for (const line of lines) {
    if (/^===\s+/.test(line)) {
      if (inTable) {
        break;
      }
      continue;
    }

    if (/class/i.test(line) && /percent/i.test(line) && /uncovered/i.test(line)) {
      coverageTableFound = true;
      inTable = true;
      continue;
    }

    if (!inTable) {
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      if (classes.length > 0) {
        break;
      }
      continue;
    }

    if (isSeparator(trimmed)) {
      continue;
    }

    const row = parseCoverageRow(trimmed);
    if (row) {
      classes.push(row);
    }
  }

  return { classes, coverageTableFound };
}

export function parseApexCoverageReport(report, options = {}) {
  const minimumCoverage = options.minimumCoverage ?? DEFAULT_MINIMUM_COVERAGE;
  const text = String(report ?? "");
  const { classes, coverageTableFound } = parseCoverageTable(text);
  const outcome = parseLabeledValue(text, "Outcome");
  const testsRanValue = parseLabeledValue(text, "Tests Ran");
  const testsRan = testsRanValue && /^\d+$/.test(testsRanValue) ? Number(testsRanValue) : null;

  const gaps = classes
    .filter((entry) => entry.coveredPercent < minimumCoverage)
    .sort((left, right) => left.coveredPercent - right.coveredPercent || left.name.localeCompare(right.name));

  return {
    minimumCoverage,
    outcome,
    testsRan,
    passRate: parseLabeledValue(text, "Pass Rate"),
    failRate: parseLabeledValue(text, "Fail Rate"),
    orgWideCoverage: parsePercent(parseLabeledValue(text, "Org Wide Coverage")),
    testRunCoverage: parsePercent(parseLabeledValue(text, "Test Run Coverage")),
    coverageTableFound,
    classesReported: classes.length,
    gaps,
  };
}
