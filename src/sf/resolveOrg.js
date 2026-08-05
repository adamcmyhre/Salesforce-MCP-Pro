import { execSfJson } from "./execSf.js";

let execSfJsonImpl = execSfJson;

export function setExecSfJsonForTests(mockExecSfJson) {
  execSfJsonImpl = mockExecSfJson;
}

export function resetExecSfJsonForTests() {
  execSfJsonImpl = execSfJson;
}

function inferConfigValue(configResult) {
  if (!configResult?.result) {
    return null;
  }

  if (Array.isArray(configResult.result)) {
    const first = configResult.result[0];
    return first?.value ?? null;
  }

  return configResult.result.value ?? null;
}

export async function resolveTargetOrg(targetOrg, options = {}) {
  if (targetOrg) {
    return String(targetOrg).trim();
  }

  const execOptions = options.cwd ? { cwd: options.cwd } : {};
  const configResult = await execSfJsonImpl(
    ["config", "get", "target-org"],
    execOptions
  );
  const configured = inferConfigValue(configResult);
  if (configured) {
    return configured;
  }

  const orgDisplay = await execSfJsonImpl(["org", "display"], execOptions);
  const fallback =
    orgDisplay?.result?.alias ?? orgDisplay?.result?.username ?? null;

  if (!fallback) {
    throw new Error(
      "Unable to resolve target org. Set a default org or pass targetOrg explicitly."
    );
  }

  return fallback;
}

export async function resolveOrgIdentity(targetOrg, options = {}) {
  const usernameOrAlias = await resolveTargetOrg(targetOrg, options);
  const execOptions = options.cwd ? { cwd: options.cwd } : {};
  const orgDisplay = await execSfJsonImpl(
    ["org", "display", "--target-org", usernameOrAlias],
    execOptions
  );

  return {
    usernameOrAlias,
    alias: orgDisplay?.result?.alias ?? null,
    username: orgDisplay?.result?.username ?? usernameOrAlias,
    orgId: orgDisplay?.result?.id ?? null,
    instanceUrl: orgDisplay?.result?.instanceUrl ?? null,
  };
}
