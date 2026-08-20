import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";
import { execSfJson } from "../sf/execSf.js";
import { resolveOrgIdentity } from "../sf/resolveOrg.js";

const GetUsernameSchema = {
  targetOrg: z.string().optional(),
  defaultTargetOrg: z.boolean().optional(),
  directory: z.string().optional(),
};

const GetDefaultScratchOrgSchema = {
  directory: z.string().optional(),
};

const GetOrgLimitsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

const WhoAmISchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
};

function normalizeScratchOrgEntry(entry) {
  return {
    username: entry.username ?? entry.usernameOrAlias ?? null,
    alias: entry.alias ?? null,
    orgId: entry.orgId ?? entry.id ?? null,
    status: entry.status ?? null,
    expirationDate: entry.expirationDate ?? null,
    isDefaultUsername: Boolean(entry.isDefaultUsername),
    isScratchOrg: true,
    raw: entry,
  };
}

function findScratchByIdentity(scratchOrgs, identity) {
  const key = identity?.usernameOrAlias?.toLowerCase();
  if (!key) {
    return null;
  }

  return (
    scratchOrgs.find((entry) => entry.username?.toLowerCase() === key) ??
    scratchOrgs.find((entry) => entry.alias?.toLowerCase() === key) ??
    null
  );
}

function normalizeLimits(rawLimits) {
  const entries = Object.entries(rawLimits ?? {}).map(([name, payload]) => {
    const max = Number(payload?.Max ?? 0);
    const remaining = Number(payload?.Remaining ?? 0);
    const used = Math.max(max - remaining, 0);
    const usedPercent = max > 0 ? Number(((used / max) * 100).toFixed(2)) : null;

    return {
      name,
      max,
      remaining,
      used,
      usedPercent,
    };
  });

  entries.sort((a, b) => {
    const aScore = a.usedPercent ?? -1;
    const bScore = b.usedPercent ?? -1;
    return bScore - aScore || a.name.localeCompare(b.name);
  });

  return entries;
}

function sanitizeOrgDisplay(displayResult) {
  if (!displayResult || typeof displayResult !== "object") {
    return {};
  }

  const clone = { ...displayResult };
  delete clone.accessToken;
  delete clone.sfdxAuthUrl;
  return clone;
}

export function registerOrgTools(server) {
  server.tool(
    "sf_list_all_orgs",
    "List authenticated Salesforce orgs from Salesforce CLI.",
    {},
    async () => {
      try {
        const result = await execSfJson(["org", "list"]);
        return success(result);
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_get_default_scratch_org",
    "Identify the default scratch org for the current Salesforce CLI context.",
    GetDefaultScratchOrgSchema,
    async ({ directory }) => {
      try {
        const orgList = await execSfJson(["org", "list"], { cwd: directory });
        const scratchOrgs = (orgList?.result?.scratchOrgs ?? []).map(normalizeScratchOrgEntry);

        if (scratchOrgs.length === 0) {
          return success({
            found: false,
            reason: "No authenticated scratch orgs were found in this CLI context.",
            scratchOrgCount: 0,
          });
        }

        const byDefaultFlag =
          scratchOrgs.find((entry) => entry.isDefaultUsername === true) ?? null;
        if (byDefaultFlag) {
          assertOrgAccess(byDefaultFlag.username ?? byDefaultFlag.alias);
          return success({
            found: true,
            source: "org-list default flag",
            scratchOrg: byDefaultFlag,
            scratchOrgCount: scratchOrgs.length,
          });
        }

        const identity = await resolveOrgIdentity(undefined, { cwd: directory });
        const byIdentity = findScratchByIdentity(scratchOrgs, identity);
        if (byIdentity) {
          assertOrgAccess(byIdentity.username ?? byIdentity.alias);
          return success({
            found: true,
            source: "target-org config match",
            scratchOrg: byIdentity,
            scratchOrgCount: scratchOrgs.length,
          });
        }

        return success({
          found: false,
          reason:
            "No scratch org matched the current default target org. Set a default scratch org with `sf config set target-org=<alias>`.",
          defaultTargetOrg: identity,
          scratchOrgCount: scratchOrgs.length,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_get_org_limits",
    "Get current Salesforce org limits and usage snapshot.",
    GetOrgLimitsSchema,
    async ({ targetOrg, directory }) => {
      try {
        const { targetOrg: resolvedTargetOrg, connection } = await getJsforceConnection(
          targetOrg,
          {
            cwd: directory,
          }
        );
        assertOrgAccess(resolvedTargetOrg);

        const limitsPath = `/services/data/v${connection.version}/limits`;
        const limits = await connection.request(limitsPath);
        const normalized = normalizeLimits(limits);

        return success({
          targetOrg: resolvedTargetOrg,
          apiVersion: connection.version,
          limits,
          normalized,
          mostConsumed: normalized.slice(0, 10),
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_whoami",
    "Return current Salesforce org identity and connection context.",
    WhoAmISchema,
    async ({ targetOrg, directory }) => {
      try {
        const identity = await resolveOrgIdentity(targetOrg, {
          cwd: directory,
        });
        assertOrgAccess(identity.usernameOrAlias);

        const display = await execSfJson(
          ["org", "display", "--target-org", identity.usernameOrAlias, "--verbose"],
          { cwd: directory }
        );
        const result = sanitizeOrgDisplay(display?.result ?? {});

        return success({
          ...identity,
          loginUrl: result.loginUrl ?? null,
          connectedStatus: result.connectedStatus ?? null,
          apiVersion: result.apiVersion ?? null,
          instanceApiVersion: result.instanceApiVersion ?? null,
          edition: result.edition ?? null,
          createdBy: result.createdBy ?? null,
          expiryDate: result.expirationDate ?? null,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_get_username",
    "Resolve username and alias for a target org or default target org.",
    GetUsernameSchema,
    async ({ targetOrg, defaultTargetOrg, directory }) => {
      try {
        const requestedTargetOrg = defaultTargetOrg ? undefined : targetOrg;
        const identity = await resolveOrgIdentity(requestedTargetOrg, {
          cwd: directory,
        });
        assertOrgAccess(identity.usernameOrAlias);
        return success(identity);
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
