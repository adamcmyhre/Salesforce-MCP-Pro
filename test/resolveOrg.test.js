import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveOrgIdentity,
  resolveTargetOrg,
  resetExecSfJsonForTests,
  setExecSfJsonForTests,
} from "../src/sf/resolveOrg.js";

test("resolveTargetOrg returns explicit input when provided", async () => {
  const value = await resolveTargetOrg("week32");
  assert.equal(value, "week32");
});

test("resolveTargetOrg uses sf config target-org by default", async () => {
  setExecSfJsonForTests(async (args) => {
    assert.deepEqual(args, ["config", "get", "target-org"]);
    return {
      status: 0,
      result: [{ name: "target-org", value: "my-default" }],
    };
  });

  const value = await resolveTargetOrg();
  assert.equal(value, "my-default");
  resetExecSfJsonForTests();
});

test("resolveOrgIdentity reads display details for the target org", async () => {
  const calls = [];
  setExecSfJsonForTests(async (args) => {
    calls.push(args);

    if (args[0] === "config") {
      return {
        status: 0,
        result: [{ name: "target-org", value: "week32" }],
      };
    }

    return {
      status: 0,
      result: {
        alias: "week32",
        username: "user@example.com",
        id: "00D000000000001",
        instanceUrl: "https://example.my.salesforce.com",
      },
    };
  });

  const identity = await resolveOrgIdentity();
  assert.equal(identity.usernameOrAlias, "week32");
  assert.equal(identity.username, "user@example.com");
  assert.equal(calls.length, 2);
  resetExecSfJsonForTests();
});
