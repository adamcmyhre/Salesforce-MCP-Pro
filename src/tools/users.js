import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { getJsforceConnection } from "../jsforce/connection.js";
import { execSfJson } from "../sf/execSf.js";
import { resolveTargetOrg } from "../sf/resolveOrg.js";

const AssignPermissionSetSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  permissionSetNames: z.array(z.string()).min(1),
  onBehalfOfUser: z.string().optional(),
  confirm: z.boolean().optional(),
};

const AssignPermissionSetGroupSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  permissionSetGroupNames: z.array(z.string()).min(1),
  onBehalfOfUser: z.string().optional(),
  confirm: z.boolean().optional(),
};

const RemovePermissionSetSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  permissionSetNames: z.array(z.string()).min(1),
  onBehalfOfUser: z.string().optional(),
  confirm: z.boolean().optional(),
};

const RemovePermissionSetGroupSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  permissionSetGroupNames: z.array(z.string()).min(1),
  onBehalfOfUser: z.string().optional(),
  confirm: z.boolean().optional(),
};

const CreateUserSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
  username: z.string().min(1),
  email: z.string().email(),
  lastName: z.string().min(1),
  alias: z.string().min(2).max(8),
  firstName: z.string().optional(),
  profileId: z.string().optional(),
  profileName: z.string().optional(),
  userRoleId: z.string().optional(),
  isActive: z.boolean().optional(),
  timeZoneSidKey: z.string().optional(),
  localeSidKey: z.string().optional(),
  emailEncodingKey: z.string().optional(),
  languageLocaleKey: z.string().optional(),
};

async function resolveProfileId(connection, profileId, profileName) {
  if (profileId) {
    return profileId;
  }

  if (!profileName) {
    throw new Error("Provide either profileId or profileName.");
  }

  const query =
    "SELECT Id, Name FROM Profile WHERE Name = '" +
    String(profileName).replace(/\\/g, "\\\\").replace(/'/g, "\\'") +
    "' LIMIT 1";
  const result = await connection.query(query);
  const record = result.records?.[0];
  if (!record?.Id) {
    throw new Error(`Profile not found with name "${profileName}".`);
  }
  return record.Id;
}

export function registerUserTools(server) {
  server.tool(
    "sf_assign_permission_set",
    "Assign one or more permission sets to a user in Salesforce.",
    AssignPermissionSetSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_assign_permission_set");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg);
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_assign_permission_set",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "org",
          "assign",
          "permset",
          "--target-org",
          resolvedTargetOrg,
          "--name",
          input.permissionSetNames.join(","),
        ];

        if (input.onBehalfOfUser) {
          args.push("--on-behalf-of", input.onBehalfOfUser);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_remove_permission_set",
    "Remove one or more permission sets from a user in Salesforce.",
    RemovePermissionSetSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_remove_permission_set");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_remove_permission_set",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "org",
          "revoke",
          "permset",
          "--target-org",
          resolvedTargetOrg,
          "--name",
          input.permissionSetNames.join(","),
        ];

        if (input.onBehalfOfUser) {
          args.push("--on-behalf-of", input.onBehalfOfUser);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_assign_permset_group",
    "Assign one or more permission set groups to a user in Salesforce.",
    AssignPermissionSetGroupSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_assign_permset_group");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_assign_permset_group",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "org",
          "assign",
          "permsetgroup",
          "--target-org",
          resolvedTargetOrg,
          "--name",
          input.permissionSetGroupNames.join(","),
        ];

        if (input.onBehalfOfUser) {
          args.push("--on-behalf-of", input.onBehalfOfUser);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_remove_permset_group",
    "Remove one or more permission set groups from a user in Salesforce.",
    RemovePermissionSetGroupSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_remove_permset_group");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_remove_permset_group",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "org",
          "revoke",
          "permsetgroup",
          "--target-org",
          resolvedTargetOrg,
          "--name",
          input.permissionSetGroupNames.join(","),
        ];

        if (input.onBehalfOfUser) {
          args.push("--on-behalf-of", input.onBehalfOfUser);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_create_user",
    "Create a Salesforce User record with profile and locale settings.",
    CreateUserSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_create_user");
        }

        const { targetOrg, connection } = await getJsforceConnection(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(targetOrg);
        assertMutationAllowed({
          toolName: "sf_create_user",
          targetOrg,
          confirm: input.confirm,
        });

        const resolvedProfileId = await resolveProfileId(
          connection,
          input.profileId,
          input.profileName
        );

        const payload = {
          Username: input.username,
          Email: input.email,
          LastName: input.lastName,
          Alias: input.alias,
          ProfileId: resolvedProfileId,
          FirstName: input.firstName,
          UserRoleId: input.userRoleId,
          IsActive: input.isActive,
          TimeZoneSidKey: input.timeZoneSidKey ?? "America/Los_Angeles",
          LocaleSidKey: input.localeSidKey ?? "en_US",
          EmailEncodingKey: input.emailEncodingKey ?? "UTF-8",
          LanguageLocaleKey: input.languageLocaleKey ?? "en_US",
        };

        const cleanPayload = Object.fromEntries(
          Object.entries(payload).filter(([, value]) => value !== undefined)
        );

        const result = await connection.sobject("User").create(cleanPayload);
        return success({
          targetOrg,
          profileId: resolvedProfileId,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
