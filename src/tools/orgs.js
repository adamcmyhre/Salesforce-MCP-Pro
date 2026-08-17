import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
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
