import { z } from "zod";
import {
  assertOrgAccess,
  assertWritable,
  isReadOnly,
} from "../config/permissions.js";
import { assertMutationAllowed } from "../config/safety.js";
import { failure, success } from "../lib/respond.js";
import { execSfJson } from "../sf/execSf.js";
import { resolveTargetOrg } from "../sf/resolveOrg.js";

const PackageCreateSchema = {
  name: z.string().min(1),
  packageType: z.enum(["Managed", "Unlocked", "OrgDependentUnlocked"]),
  path: z.string().min(1),
  description: z.string().optional(),
  targetDevHub: z.string().optional(),
  apiVersion: z.string().optional(),
  noNamespace: z.boolean().optional(),
  orgDependent: z.boolean().optional(),
  errorNotificationUsername: z.string().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const PackageInstallSchema = {
  package: z.string().min(1),
  targetOrg: z.string().optional(),
  installationKey: z.string().optional(),
  securityType: z.enum(["AllUsers", "AdminsOnly"]).optional(),
  apexCompile: z.enum(["all", "package"]).optional(),
  upgradeType: z.enum(["DeprecateOnly", "Delete"]).optional(),
  wait: z.number().int().min(1).max(120).optional(),
  publishWait: z.number().int().min(1).max(120).optional(),
  noPrompt: z.boolean().optional(),
  directory: z.string().optional(),
  confirm: z.boolean().optional(),
};

const PackageListSchema = {
  targetDevHub: z.string().optional(),
  verbose: z.boolean().optional(),
  directory: z.string().optional(),
};

async function resolveDevHub(targetDevHub, directory) {
  return resolveTargetOrg(targetDevHub, { cwd: directory });
}

export function registerPackagingTools(server) {
  server.tool(
    "sf_package_create",
    "Create a second-generation Salesforce package in a Dev Hub org.",
    PackageCreateSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_package_create");
        }

        const resolvedDevHub = await resolveDevHub(input.targetDevHub, input.directory);
        assertOrgAccess(resolvedDevHub);
        assertMutationAllowed({
          toolName: "sf_package_create",
          targetOrg: resolvedDevHub,
          confirm: input.confirm,
        });

        const args = [
          "package",
          "create",
          "--name",
          input.name,
          "--package-type",
          input.packageType,
          "--path",
          input.path,
          "--target-dev-hub",
          resolvedDevHub,
        ];

        if (input.description) {
          args.push("--description", input.description);
        }
        if (input.apiVersion) {
          args.push("--api-version", input.apiVersion);
        }
        if (input.noNamespace) {
          args.push("--no-namespace");
        }
        if (input.orgDependent) {
          args.push("--org-dependent");
        }
        if (input.errorNotificationUsername) {
          args.push("--error-notification-username", input.errorNotificationUsername);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetDevHub: resolvedDevHub,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_package_install",
    "Install a package version in a target org.",
    PackageInstallSchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_package_install");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_package_install",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "package",
          "install",
          "--package",
          input.package,
          "--target-org",
          resolvedTargetOrg,
        ];

        if (input.installationKey) {
          args.push("--installation-key", input.installationKey);
        }
        if (input.securityType) {
          args.push("--security-type", input.securityType);
        }
        if (input.apexCompile) {
          args.push("--apex-compile", input.apexCompile);
        }
        if (input.upgradeType) {
          args.push("--upgrade-type", input.upgradeType);
        }
        if (input.wait !== undefined) {
          args.push("--wait", String(input.wait));
        }
        if (input.publishWait !== undefined) {
          args.push("--publish-wait", String(input.publishWait));
        }
        if (input.noPrompt) {
          args.push("--no-prompt");
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          package: input.package,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_package_list",
    "List second-generation packages available in a Dev Hub org.",
    PackageListSchema,
    async (input) => {
      try {
        const resolvedDevHub = await resolveDevHub(input.targetDevHub, input.directory);
        assertOrgAccess(resolvedDevHub);

        const args = ["package", "list", "--target-dev-hub", resolvedDevHub];
        if (input.verbose) {
          args.push("--verbose");
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetDevHub: resolvedDevHub,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
