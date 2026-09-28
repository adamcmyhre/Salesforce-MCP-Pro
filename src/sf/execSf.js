import { execFile } from "node:child_process";
import { platform } from "node:os";
import { findSfPath } from "./findSf.js";

const DEFAULT_MAX_BUFFER_BYTES = 50 * 1024 * 1024;

export class SfCommandError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = "SfCommandError";
    this.context = context;
  }
}

let execFileImpl = execFile;

export function setExecFileForTests(mockExecFile) {
  execFileImpl = mockExecFile;
}

export function resetExecFileForTests() {
  execFileImpl = execFile;
}

function parseMaybeJson(value) {
  if (!value || !value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function quoteWindowsArg(value) {
  const text = String(value);
  if (!/[\s"]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

export function buildSfExecInvocation(sfPath, cliArgs, osPlatform = platform()) {
  if (osPlatform === "win32" && /\.(cmd|bat)$/i.test(sfPath)) {
    const commandLine = ["call", quoteWindowsArg(sfPath), ...cliArgs.map(quoteWindowsArg)].join(
      " "
    );

    return {
      file: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", commandLine],
      options: {
        windowsVerbatimArguments: true,
      },
    };
  }

  return {
    file: sfPath,
    args: cliArgs,
    options: {},
  };
}

function isMissingSfError(error) {
  return (
    error.message.includes("not recognized") ||
    error.message.includes("ENOENT") ||
    error.message.includes("not found") ||
    error.code === "ENOENT" ||
    error.code === "EINVAL"
  );
}

function runSf(cliArgs, options = {}) {
  const sfPath = findSfPath();
  const invocation = buildSfExecInvocation(sfPath, cliArgs);

  return new Promise((resolve, reject) => {
    execFileImpl(
      invocation.file,
      invocation.args,
      {
        cwd: options.cwd,
        env: options.env ?? process.env,
        maxBuffer: options.maxBuffer ?? DEFAULT_MAX_BUFFER_BYTES,
        timeout: options.timeout,
        windowsHide: true,
        ...invocation.options,
      },
      (error, stdout, stderr) => {
        if (error && isMissingSfError(error)) {
          reject(
            new SfCommandError(
              "Salesforce CLI (sf) was not found. Install Salesforce CLI or set SF_CLI_PATH.",
              {
                sfPath,
                args: cliArgs,
                stderr,
              }
            )
          );
          return;
        }

        resolve({
          sfPath,
          error: error ?? null,
          stdout: stdout ?? "",
          stderr: stderr ?? "",
        });
      }
    );
  });
}

export function execSfText(args, options = {}) {
  return runSf(args, options).then(({ error, stdout, stderr }) => ({
    stdout,
    stderr,
    exitCode: error == null ? 0 : typeof error.code === "number" ? error.code : 1,
    timedOut: Boolean(error?.killed),
    maxBufferExceeded: error?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER",
  }));
}

export function execSfJson(args, options = {}) {
  const cliArgs = [...args, "--json"];

  return runSf(cliArgs, options).then(({ sfPath, error, stdout, stderr }) => {
    const parsed = parseMaybeJson(stdout);

    if (error) {
      throw new SfCommandError(`Salesforce CLI command failed: ${error.message}`, {
        sfPath,
        args: cliArgs,
        stdout,
        stderr,
        parsed,
      });
    }

    if (!parsed) {
      throw new SfCommandError("Failed to parse Salesforce CLI JSON output.", {
        sfPath,
        args: cliArgs,
        stdout,
        stderr,
      });
    }

    return parsed;
  });
}
