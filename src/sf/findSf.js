import { existsSync } from "node:fs";
import { platform } from "node:os";
import { getConfig } from "../config/env.js";

let cachedPath = null;

const COMMON_PATHS = {
  win32: [
    "C:\\Program Files\\sf\\bin\\sf.cmd",
    "C:\\Program Files\\sf\\bin\\sf.exe",
    "C:\\Program Files (x86)\\sf\\bin\\sf.cmd",
    "C:\\Program Files (x86)\\sf\\bin\\sf.exe",
    `${process.env.LOCALAPPDATA ?? ""}\\sf\\bin\\sf.cmd`,
    `${process.env.LOCALAPPDATA ?? ""}\\sf\\bin\\sf.exe`,
  ],
  darwin: [
    "/usr/local/bin/sf",
    "/opt/homebrew/bin/sf",
    "/usr/bin/sf",
    `${process.env.HOME ?? ""}/.local/bin/sf`,
  ],
  linux: [
    "/usr/local/bin/sf",
    "/usr/bin/sf",
    "/opt/salesforce/cli/bin/sf",
    `${process.env.HOME ?? ""}/.local/bin/sf`,
  ],
};

export function clearSfPathCache() {
  cachedPath = null;
}

export function findSfPath() {
  if (cachedPath) {
    return cachedPath;
  }

  const { sfCliPath } = getConfig();
  if (sfCliPath) {
    cachedPath = sfCliPath;
    return cachedPath;
  }

  const os = platform();
  const candidates = COMMON_PATHS[os] ?? COMMON_PATHS.linux;
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      cachedPath = candidate;
      return cachedPath;
    }
  }

  cachedPath = "sf";
  return cachedPath;
}
