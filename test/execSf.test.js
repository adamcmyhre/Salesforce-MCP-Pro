import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSfExecInvocation,
  execSfJson,
  resetExecFileForTests,
  setExecFileForTests,
  SfCommandError,
} from "../src/sf/execSf.js";

test("execSfJson appends --json and parses result", async () => {
  setExecFileForTests((file, args, options, callback) => {
    callback(
      null,
      JSON.stringify({
        status: 0,
        result: { ok: true },
      }),
      ""
    );
  });

  const result = await execSfJson(["org", "list"]);
  assert.equal(result.status, 0);
  assert.equal(result.result.ok, true);
  resetExecFileForTests();
});

test("execSfJson throws SfCommandError on missing sf", async () => {
  setExecFileForTests((file, args, options, callback) => {
    callback(new Error("'sf' is not recognized"), "", "");
  });

  await assert.rejects(() => execSfJson(["org", "list"]), SfCommandError);
  resetExecFileForTests();
});

test("execSfJson throws SfCommandError for invalid json", async () => {
  setExecFileForTests((file, args, options, callback) => {
    callback(null, "not-json", "");
  });

  await assert.rejects(() => execSfJson(["org", "list"]), SfCommandError);
  resetExecFileForTests();
});

test("buildSfExecInvocation wraps Windows cmd shims for Node execFile", () => {
  const invocation = buildSfExecInvocation(
    "C:\\Program Files\\sf\\bin\\sf.cmd",
    ["org", "display", "--json"],
    "win32"
  );

  assert.match(invocation.file, /cmd\.exe$/i);
  assert.deepEqual(invocation.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.match(invocation.args[3], /^call "C:\\Program Files\\sf\\bin\\sf\.cmd" org display --json$/);
  assert.equal(invocation.options.windowsVerbatimArguments, true);
});

test("buildSfExecInvocation keeps direct executables unchanged", () => {
  const invocation = buildSfExecInvocation("/usr/local/bin/sf", ["org", "list", "--json"], "linux");

  assert.equal(invocation.file, "/usr/local/bin/sf");
  assert.deepEqual(invocation.args, ["org", "list", "--json"]);
  assert.deepEqual(invocation.options, {});
});
