import test from "node:test";
import assert from "node:assert/strict";
import { parseApexCoverageReport } from "../src/sf/parseApexCoverage.js";
import { buildApexCoverageGapArgs } from "../src/tools/testing.js";

const HUMAN_REPORT = `
=== Test Results
TEST NAME                 OUTCOME  MESSAGE  RUNTIME (MS)
────────────────────────  ───────  ───────  ────────────
MyClassTest.myTest        Pass              50
MyClassTest.other         Fail     boom     12

=== Apex Code Coverage by Class
CLASSES                        PERCENT  UNCOVERED LINES
─────────────────────────────  ───────  ──────────────────
AccountTrigger                 100%
ns__TriggerHandler             33%      38,42,53,56,61,...
AccountTriggerHandler          80%      12,15
FullyCovered                   75%
LowCoverage                    0%       1,2,3
RangeExample                   50%      20-22,30

=== Test Summary
NAME                 VALUE
───────────────────  ───────────────────────────
Outcome              Failed
Tests Ran            2
Pass Rate            50%
Fail Rate            50%
Skip Rate            0%
Test Run Id          707Dn00006eC4pE
Org Id               00DDn000008jOSpMAM
Username             user@example.com
Org Wide Coverage    68%
Test Run Coverage    40%
`;

test("parseApexCoverageReport returns classes under the default 75% threshold", () => {
  const parsed = parseApexCoverageReport(HUMAN_REPORT);

  assert.equal(parsed.coverageTableFound, true);
  assert.equal(parsed.outcome, "Failed");
  assert.equal(parsed.testsRan, 2);
  assert.equal(parsed.passRate, "50%");
  assert.equal(parsed.failRate, "50%");
  assert.equal(parsed.orgWideCoverage, 68);
  assert.equal(parsed.testRunCoverage, 40);
  assert.equal(parsed.classesReported, 6);
  assert.deepEqual(
    parsed.gaps.map((gap) => gap.name),
    ["LowCoverage", "ns__TriggerHandler", "RangeExample"]
  );
  assert.equal(parsed.gaps[1].uncoveredLines, "38,42,53,56,61,...");
  assert.equal(parsed.gaps[1].uncoveredLinesTruncated, true);
  assert.equal(parsed.gaps[0].uncoveredLinesTruncated, false);
  assert.equal(parsed.gaps[2].uncoveredLines, "20-22,30");
});

test("parseApexCoverageReport honors a custom minimum and Windows newlines", () => {
  const parsed = parseApexCoverageReport(HUMAN_REPORT.replace(/\n/g, "\r\n"), {
    minimumCoverage: 100,
  });

  assert.equal(parsed.minimumCoverage, 100);
  assert.equal(parsed.gaps.length, 5);
  assert.equal(
    parsed.gaps.some((gap) => gap.name === "AccountTrigger"),
    false
  );
  assert.equal(
    parsed.gaps.some((gap) => gap.name === "AccountTriggerHandler"),
    true
  );
});

test("parseApexCoverageReport reports a missing coverage table", () => {
  const parsed = parseApexCoverageReport("=== Test Summary\nOutcome              Passed\n");

  assert.equal(parsed.coverageTableFound, false);
  assert.equal(parsed.outcome, "Passed");
  assert.deepEqual(parsed.gaps, []);
});

test("buildApexCoverageGapArgs matches sf apex test run -c -r human -w 30 -v", () => {
  assert.deepEqual(buildApexCoverageGapArgs({}, "dev"), [
    "apex",
    "test",
    "run",
    "-c",
    "-r",
    "human",
    "-w",
    "30",
    "-v",
    "--target-org",
    "dev",
  ]);
});

test("buildApexCoverageGapArgs appends optional test filters", () => {
  assert.deepEqual(
    buildApexCoverageGapArgs(
      {
        wait: 10,
        tests: ["AccountServiceTest"],
        testLevel: "RunSpecifiedTests",
      },
      "dev"
    ),
    [
      "apex",
      "test",
      "run",
      "-c",
      "-r",
      "human",
      "-w",
      "10",
      "-v",
      "--target-org",
      "dev",
      "--tests",
      "AccountServiceTest",
      "--test-level",
      "RunSpecifiedTests",
    ]
  );
});
