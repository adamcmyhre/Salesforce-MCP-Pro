import { getConfig } from "./env.js";

function normalized(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function isReadOnly() {
  return getConfig().readOnly;
}

export function getAllowedOrgs() {
  return getConfig().allowedOrgs;
}

export function canAccessOrg(targetOrg) {
  const allowedOrgs = getAllowedOrgs();
  if (allowedOrgs === "ALL") {
    return true;
  }

  const needle = normalized(targetOrg);
  return allowedOrgs.some((entry) => normalized(entry) === needle);
}

export function assertOrgAccess(targetOrg) {
  if (!canAccessOrg(targetOrg)) {
    throw new Error(`Access denied for target org "${targetOrg}".`);
  }
}

export function assertWritable(toolName) {
  if (isReadOnly()) {
    throw new Error(
      `Tool "${toolName}" is blocked because READ_ONLY=true.`
    );
  }
}
