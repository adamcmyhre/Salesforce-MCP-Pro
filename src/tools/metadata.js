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

const sharedMetadataSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  sourceDir: z.array(z.string()).optional(),
  manifest: z.string().optional(),
  wait: z.number().int().min(1).max(120).optional(),
};

const DeploySchema = {
  ...sharedMetadataSchema,
  ignoreConflicts: z.boolean().optional(),
  testLevel: z.string().optional(),
  tests: z.array(z.string()).optional(),
  confirm: z.boolean().optional(),
};

const DeployStatusSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  jobId: z.string().min(1),
  wait: z.number().int().min(1).max(120).optional(),
};

const RetrieveSchema = {
  ...sharedMetadataSchema,
  metadata: z.array(z.string()).optional(),
  packageName: z.string().optional(),
};

const ListMetadataSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  metadataType: z.string().min(1),
  folder: z.string().optional(),
  apiVersion: z.string().optional(),
};

function appendMultiValueArg(args, flag, values) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    args.push(flag, value);
  }
}

function appendDeployOptions(args, input) {
  appendMultiValueArg(args, "--source-dir", input.sourceDir);

  if (input.manifest) {
    args.push("--manifest", input.manifest);
  }

  if (input.wait !== undefined) {
    args.push("--wait", String(input.wait));
  }

  if (input.testLevel) {
    args.push("--test-level", input.testLevel);
  }

  appendMultiValueArg(args, "--tests", input.tests);

  if (input.ignoreConflicts) {
    args.push("--ignore-conflicts");
  }
}

export function registerMetadataTools(server) {
  server.tool(
    "sf_deploy_metadata",
    "Deploy Salesforce metadata from local project files.",
    DeploySchema,
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_deploy_metadata");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg);
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_deploy_metadata",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "project",
          "deploy",
          "start",
          "--target-org",
          resolvedTargetOrg,
        ];

        appendDeployOptions(args, input);

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
    "sf_deploy_metadata_validate",
    "Validate Salesforce metadata deployment without committing changes.",
    DeploySchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);
        assertMutationAllowed({
          toolName: "sf_cancel_deploy",
          targetOrg: resolvedTargetOrg,
          confirm: input.confirm,
        });

        const args = [
          "project",
          "deploy",
          "validate",
          "--target-org",
          resolvedTargetOrg,
        ];
        appendDeployOptions(args, input);

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
    "sf_get_deploy_status",
    "Get deployment status and details by deploy job id.",
    DeployStatusSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const args = [
          "project",
          "deploy",
          "report",
          "--job-id",
          input.jobId,
          "--target-org",
          resolvedTargetOrg,
        ];

        if (input.wait !== undefined) {
          args.push("--wait", String(input.wait));
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          jobId: input.jobId,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_cancel_deploy",
    "Cancel a running deployment by deploy job id.",
    {
      targetOrg: z.string().optional(),
      directory: z.string().optional(),
      jobId: z.string().min(1),
      confirm: z.boolean().optional(),
    },
    async (input) => {
      try {
        if (isReadOnly()) {
          assertWritable("sf_cancel_deploy");
        }

        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const args = [
          "project",
          "deploy",
          "cancel",
          "--job-id",
          input.jobId,
          "--target-org",
          resolvedTargetOrg,
        ];

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          jobId: input.jobId,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_list_metadata",
    "List metadata components by metadata type for discovery.",
    ListMetadataSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const args = [
          "org",
          "list",
          "metadata",
          "--metadata-type",
          input.metadataType,
          "--target-org",
          resolvedTargetOrg,
        ];

        if (input.folder) {
          args.push("--folder", input.folder);
        }

        if (input.apiVersion) {
          args.push("--api-version", input.apiVersion);
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          metadataType: input.metadataType,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );

  server.tool(
    "sf_retrieve_metadata",
    "Retrieve metadata from a Salesforce org to local project files.",
    RetrieveSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg);
        assertOrgAccess(resolvedTargetOrg);

        const args = [
          "project",
          "retrieve",
          "start",
          "--target-org",
          resolvedTargetOrg,
        ];

        appendMultiValueArg(args, "--source-dir", input.sourceDir);
        appendMultiValueArg(args, "--metadata", input.metadata);

        if (input.manifest) {
          args.push("--manifest", input.manifest);
        }

        if (input.packageName) {
          args.push("--package-name", input.packageName);
        }

        if (input.wait !== undefined) {
          args.push("--wait", String(input.wait));
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
}
