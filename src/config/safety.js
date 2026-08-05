const DEFAULT_PROTECTED_PATTERNS = ["prod", "production", "live"];

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function parsePatterns(value) {
  if (!value) {
    return DEFAULT_PROTECTED_PATTERNS;
  }

  const parsed = String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_PROTECTED_PATTERNS;
}

export function getProtectedOrgPatterns() {
  return parsePatterns(process.env.PROTECTED_ORG_PATTERNS);
}

export function isProdSafetyEnabled() {
  return parseBoolean(process.env.ENFORCE_PROTECTED_ORG_CONFIRM, true);
}

export function isProtectedOrg(targetOrg) {
  if (!targetOrg) {
    return false;
  }

  const normalizedTarget = String(targetOrg).toLowerCase();
  return getProtectedOrgPatterns().some((pattern) =>
    normalizedTarget.includes(pattern.toLowerCase())
  );
}

export function assertMutationAllowed({ toolName, targetOrg, confirm }) {
  if (!isProdSafetyEnabled()) {
    return;
  }

  if (!isProtectedOrg(targetOrg)) {
    return;
  }

  if (confirm === true) {
    return;
  }

  throw new Error(
    `Mutation blocked for protected org "${targetOrg}" in tool "${toolName}". ` +
      "Set confirm=true to proceed intentionally."
  );
}
