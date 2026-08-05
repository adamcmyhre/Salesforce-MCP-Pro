import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { execSfJson } from "../sf/execSf.js";
import { resolveTargetOrg } from "../sf/resolveOrg.js";

const RunApexTestSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  tests: z.array(z.string()).optional(),
  suites: z.array(z.string()).optional(),
  testLevel: z.string().optional(),
  wait: z.number().int().min(1).max(120).optional(),
  codeCoverage: z.boolean().optional(),
};

const RunApexTestSuiteSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  suites: z.array(z.string()).min(1),
  wait: z.number().int().min(1).max(120).optional(),
  codeCoverage: z.boolean().optional(),
};

function appendRepeatedValues(args, flag, values) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    args.push(flag, value);
  }
}

export function registerTestingTools(server) {
  server.tool(
    "sf_run_apex_test",
    "Run Apex tests in a Salesforce org.",
    RunApexTestSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg);
        assertOrgAccess(resolvedTargetOrg);

        const args = ["apex", "run", "test", "--target-org", resolvedTargetOrg];
        appendRepeatedValues(args, "--tests", input.tests);
        appendRepeatedValues(args, "--suites", input.suites);

        if (input.testLevel) {
          args.push("--test-level", input.testLevel);
        }

        if (input.wait !== undefined) {
          args.push("--wait", String(input.wait));
        }

        if (input.codeCoverage) {
          args.push("--code-coverage");
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
    "sf_run_apex_test_suite",
    "Run Apex test suites (suite-first input) in a Salesforce org.",
    RunApexTestSuiteSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const args = ["apex", "run", "test", "--target-org", resolvedTargetOrg];
        appendRepeatedValues(args, "--suites", input.suites);

        if (input.wait !== undefined) {
          args.push("--wait", String(input.wait));
        }

        if (input.codeCoverage) {
          args.push("--code-coverage");
        }

        const result = await execSfJson(args, { cwd: input.directory });
        return success({
          targetOrg: resolvedTargetOrg,
          suites: input.suites,
          result,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
