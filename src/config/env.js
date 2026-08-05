const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 19;

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parseAllowedOrgs(value) {
  if (!value) {
    return "ALL";
  }

  const orgs = String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return orgs.length > 0 ? orgs : "ALL";
}

export function getConfig() {
  return {
    sfCliPath: process.env.SF_CLI_PATH?.trim() || null,
    readOnly: parseBoolean(process.env.READ_ONLY, false),
    allowedOrgs: parseAllowedOrgs(process.env.ALLOWED_ORGS),
  };
}

export function assertNodeVersion() {
  const [majorRaw, minorRaw] = process.versions.node.split(".");
  const major = Number(majorRaw);
  const minor = Number(minorRaw);

  if (
    Number.isNaN(major) ||
    Number.isNaN(minor) ||
    major < MIN_NODE_MAJOR ||
    (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)
  ) {
    throw new Error(
      `Salesforce MCP Pro requires Node >= ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}.0. ` +
        `Current version: ${process.versions.node}`
    );
  }
}
