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
