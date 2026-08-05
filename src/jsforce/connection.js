import jsforce from "jsforce";
import { execSfJson } from "../sf/execSf.js";
import { resolveTargetOrg } from "../sf/resolveOrg.js";

function isUsableAccessToken(token) {
  if (!token || typeof token !== "string") {
    return false;
  }

  return !token.includes("[REDACTED]");
}

async function resolveAccessToken(targetOrg, options = {}) {
  const tokenResult = await execSfJson(
    ["org", "auth", "show-access-token", "--target-org", targetOrg],
    { cwd: options.cwd }
  );
  const accessToken = tokenResult?.result?.accessToken;

  if (!isUsableAccessToken(accessToken)) {
    throw new Error(
      `Could not read access token for org "${targetOrg}". Run "sf org login web" and retry.`
    );
  }

  return accessToken;
}

export async function getJsforceConnection(targetOrg, options = {}) {
  const resolvedTargetOrg = await resolveTargetOrg(targetOrg, {
    cwd: options.cwd,
  });

  const orgInfo = await execSfJson(
    ["org", "display", "--target-org", resolvedTargetOrg, "--verbose"],
    { cwd: options.cwd }
  );

  const instanceUrl = orgInfo?.result?.instanceUrl;
  let accessToken = orgInfo?.result?.accessToken;

  if (!isUsableAccessToken(accessToken)) {
    accessToken = await resolveAccessToken(resolvedTargetOrg, options);
  }

  if (!accessToken || !instanceUrl) {
    throw new Error(
      `Could not establish jsforce connection for org "${resolvedTargetOrg}". Missing access token or instance URL.`
    );
  }

  const connection = new jsforce.Connection({
    accessToken,
    instanceUrl,
  });

  return {
    targetOrg: resolvedTargetOrg,
    connection,
  };
}
