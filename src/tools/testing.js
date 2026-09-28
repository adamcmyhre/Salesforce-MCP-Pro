import { z } from "zod";
import { assertOrgAccess } from "../config/permissions.js";
import { failure, success } from "../lib/respond.js";
import { execSfJson, execSfText } from "../sf/execSf.js";
import { parseApexCoverageReport } from "../sf/parseApexCoverage.js";
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

const FindApexCoverageGapsSchema = {
  targetOrg: z.string().optional(),
  directory: z.string().optional(),
  minimumCoverage: z.number().min(0).max(100).optional(),
  wait: z.number().int().min(0).max(120).optional(),
  tests: z.array(z.string()).optional(),
  suites: z.array(z.string()).optional(),
  testLevel: z.enum(["RunLocalTests", "RunAllTestsInOrg", "RunSpecifiedTests"]).optional(),
};

function appendRepeatedValues(args, flag, values) {
  if (!Array.isArray(values)) {
    return;
  }

  for (const value of values) {
    args.push(flag, value);
  }
}

export function buildApexCoverageGapArgs(input, targetOrg) {
  const wait = input.wait ?? 30;
  const args = [
    "apex",
    "test",
    "run",
    "-c",
    "-r",
    "human",
    "-w",
    String(wait),
    "-v",
    "--target-org",
    targetOrg,
  ];

  appendRepeatedValues(args, "--tests", input.tests);
  appendRepeatedValues(args, "--suites", input.suites);

  if (input.testLevel) {
    args.push("--test-level", input.testLevel);
  }

  return args;
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

  server.tool(
    "sf_find_apex_coverage_gaps",
    "Find Apex code coverage gaps by running `sf apex test run -c -r human -w 30 -v`. Returns classes and triggers below minimumCoverage (default 75) with uncovered lines from the human coverage report. Optional tests, suites, or testLevel narrow the run. Salesforce CLI may truncate long uncovered-line lists with an ellipsis.",
    FindApexCoverageGapsSchema,
    async (input) => {
      try {
        const resolvedTargetOrg = await resolveTargetOrg(input.targetOrg, {
          cwd: input.directory,
        });
        assertOrgAccess(resolvedTargetOrg);

        const minimumCoverage = input.minimumCoverage ?? 75;
        const waitMinutes = input.wait ?? 30;
        const args = buildApexCoverageGapArgs(
          { ...input, wait: waitMinutes, minimumCoverage },
          resolvedTargetOrg
        );
        const run = await execSfText(args, {
          cwd: input.directory,
          timeout: (waitMinutes + 5) * 60 * 1000,
        });

        if (run.timedOut) {
          return failure(
            `Salesforce CLI timed out while waiting for Apex test results (wait ${waitMinutes} minutes).`,
            { command: `sf ${args.join(" ")}`, stderr: run.stderr }
          );
        }

        if (run.maxBufferExceeded) {
          return failure("Apex coverage report exceeded the output size limit.", {
            command: `sf ${args.join(" ")}`,
            stderr: run.stderr,
          });
        }

        const parsed = parseApexCoverageReport(run.stdout, { minimumCoverage });
        if (!parsed.coverageTableFound) {
          return failure("Apex coverage report did not include a class coverage table.", {
            command: `sf ${args.join(" ")}`,
            exitCode: run.exitCode,
            stderr: run.stderr,
            stdout: run.stdout.slice(0, 8000),
          });
        }

        const orgWideBelowMinimum =
          parsed.orgWideCoverage !== null && parsed.orgWideCoverage < minimumCoverage;

        return success({
          targetOrg: resolvedTargetOrg,
          command: `sf ${args.join(" ")}`,
          exitCode: run.exitCode,
          minimumCoverage,
          outcome: parsed.outcome,
          testsRan: parsed.testsRan,
          passRate: parsed.passRate,
          failRate: parsed.failRate,
          orgWideCoverage: parsed.orgWideCoverage,
          testRunCoverage: parsed.testRunCoverage,
          orgWideBelowMinimum,
          classesReported: parsed.classesReported,
          gapCount: parsed.gaps.length,
          gaps: parsed.gaps,
        });
      } catch (error) {
        return failure(error.message, error.context ?? null);
      }
    }
  );
}
