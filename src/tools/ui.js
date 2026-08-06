import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { z } from "zod";
import { failure, success } from "../lib/respond.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");
const defaultArtifactsDir = join(repoRoot, "artifacts", "ui-screenshots");
const defaultDefinitionsPath = join(repoRoot, "ui-definitions", "flows.json");

const sessions = new Map();
let activeSessionId = null;

const UiSessionStartSchema = {
  headless: z.boolean().optional(),
  slowMoMs: z.number().int().min(0).max(5000).optional(),
  baseUrl: z.string().optional(),
  viewportWidth: z.number().int().min(320).max(7680).optional(),
  viewportHeight: z.number().int().min(240).max(4320).optional(),
};

const UiSessionStopSchema = {
  sessionId: z.string().optional(),
};

const UiNavigateSchema = {
  sessionId: z.string().optional(),
  url: z.string().optional(),
  path: z.string().optional(),
  waitUntil: z.enum(["load", "domcontentloaded", "networkidle", "commit"]).optional(),
  timeoutMs: z.number().int().min(1000).max(180000).optional(),
};

const UiActionSchema = {
  sessionId: z.string().optional(),
  action: z.enum(["click", "fill", "type", "press", "select", "check", "uncheck"]),
  selector: z.string().min(1),
  value: z.union([z.string(), z.array(z.string())]).optional(),
  timeoutMs: z.number().int().min(1000).max(180000).optional(),
};

const UiExtractSchema = {
  sessionId: z.string().optional(),
  selector: z.string().min(1),
  all: z.boolean().optional(),
  attribute: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(180000).optional(),
};

const UiAssertSchema = {
  sessionId: z.string().optional(),
  selector: z.string().min(1),
  visible: z.boolean().optional(),
  textContains: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(180000).optional(),
};

const UiScreenshotSchema = {
  sessionId: z.string().optional(),
  fileName: z.string().optional(),
  fullPage: z.boolean().optional(),
};

const UiRunFlowSchema = {
  sessionId: z.string().optional(),
  flowName: z.string().min(1),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  confirm: z.boolean().optional(),
};

function getSessionOrThrow(sessionId) {
  const resolved = sessionId ?? activeSessionId;
  if (!resolved) {
    throw new Error("No active UI session. Run ui_session_start first.");
  }

  const session = sessions.get(resolved);
  if (!session) {
    throw new Error(`UI session not found: ${resolved}`);
  }
  return session;
}

function substituteTemplate(input, variables) {
  return input.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => {
    if (!(key in variables)) {
      throw new Error(`Missing required flow variable: ${key}`);
    }
    return String(variables[key]);
  });
}

function resolveFlowPageUrl(pageDefinition, variables) {
  if (pageDefinition.urlPathTemplate) {
    return substituteTemplate(pageDefinition.urlPathTemplate, variables);
  }
  if (pageDefinition.urlPath) {
    return pageDefinition.urlPath;
  }
  throw new Error("Page definition missing urlPath/urlPathTemplate.");
}

async function loadUiDefinitions() {
  if (!existsSync(defaultDefinitionsPath)) {
    throw new Error(`UI definitions file not found: ${defaultDefinitionsPath}`);
  }
  const raw = await readFile(defaultDefinitionsPath, "utf8");
  return JSON.parse(raw);
}

function buildAbsoluteUrl(session, input) {
  if (input.url) {
    return input.url;
  }

  if (!input.path) {
    throw new Error("Provide either url or path.");
  }

  if (!session.baseUrl) {
    throw new Error("Session has no baseUrl. Pass full url or start session with baseUrl.");
  }

  return new URL(input.path, session.baseUrl).toString();
}

async function clickAcrossFrames(page, selector, timeout) {
  const deadline = Date.now() + timeout;
  let lastError = null;

  for (const frame of page.frames()) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }

    try {
      await frame.click(selector, {
        timeout: Math.min(remaining, Math.max(1000, Math.floor(timeout / 2))),
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error(`Unable to click selector across frames: ${selector}`);
}

async function runStep(session, definitions, step, variables) {
  const { page } = session;
  const timeout = 30000;
  const pageDef = step.page ? definitions.pages?.[step.page] : null;
  const getSelector = () => {
    if (step.selector) return step.selector;
    if (step.selectorVar) {
      const value = variables?.[step.selectorVar];
      if (!value) throw new Error(`Missing flow variable selector: ${step.selectorVar}`);
      return String(value);
    }
    if (!pageDef || !step.element) {
      throw new Error("Step missing selector or page/element mapping.");
    }
    const selector = pageDef.elements?.[step.element];
    if (!selector) {
      throw new Error(`Element "${step.element}" not found in page "${step.page}".`);
    }
    return selector;
  };

  if (step.type === "navigate") {
    const urlOrPath = resolveFlowPageUrl(pageDef, variables ?? {});
    const target = urlOrPath.startsWith("http")
      ? urlOrPath
      : buildAbsoluteUrl(session, { path: urlOrPath });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 120000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { type: "navigate", target };
  }

  const selector = getSelector();
  if (step.type === "click" || step.type === "optionalClick") {
    try {
      await clickAcrossFrames(page, selector, timeout);
      return { type: step.type, selector, status: "clicked" };
    } catch (error) {
      if (step.type === "optionalClick") {
        return { type: step.type, selector, status: "skipped" };
      }
      throw error;
    }
  }

  if (step.type === "fill") {
    const value =
      step.value !== undefined
        ? String(step.value)
        : String(variables?.[step.valueVar] ?? "");
    await page.fill(selector, value, { timeout });
    return { type: "fill", selector };
  }

  if (step.type === "press") {
    const key = step.key ?? String(variables?.[step.keyVar] ?? "Enter");
    await page.press(selector, key, { timeout });
    return { type: "press", selector, key };
  }

  throw new Error(`Unsupported flow step type: ${step.type}`);
}

async function saveScreenshot(session, fileName, fullPage) {
  await mkdir(defaultArtifactsDir, { recursive: true });
  const safeFileName = fileName ?? `ui-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
  const finalPath = isAbsolute(safeFileName)
    ? safeFileName
    : join(defaultArtifactsDir, safeFileName);
  await session.page.screenshot({ path: finalPath, fullPage: Boolean(fullPage) });
  return finalPath;
}

export function registerUiTools(server) {
  server.tool(
    "ui_session_start",
    "Start a Playwright browser session for UI automation.",
    UiSessionStartSchema,
    async (input) => {
      try {
        const browser = await chromium.launch({
          headless: input.headless ?? true,
          slowMo: input.slowMoMs ?? 0,
        });
        const context = await browser.newContext({
          viewport: {
            width: input.viewportWidth ?? 1440,
            height: input.viewportHeight ?? 900,
          },
        });
        const page = await context.newPage();
        const sessionId = randomUUID();
        sessions.set(sessionId, {
          id: sessionId,
          browser,
          context,
          page,
          baseUrl: input.baseUrl ?? null,
          slowMoMs: input.slowMoMs ?? 0,
        });
        activeSessionId = sessionId;
        return success({
          sessionId,
          headless: input.headless ?? true,
          slowMoMs: input.slowMoMs ?? 0,
          baseUrl: input.baseUrl ?? null,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_session_stop",
    "Stop and dispose a Playwright UI session.",
    UiSessionStopSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        await session.context.close();
        await session.browser.close();
        sessions.delete(session.id);
        if (activeSessionId === session.id) {
          activeSessionId = null;
        }
        return success({ sessionId: session.id, closed: true });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_navigate",
    "Navigate the current UI session to a URL or path.",
    UiNavigateSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        const url = buildAbsoluteUrl(session, input);
        await session.page.goto(url, {
          waitUntil: input.waitUntil ?? "load",
          timeout: input.timeoutMs ?? 30000,
        });
        return success({ sessionId: session.id, url });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_action",
    "Perform a direct UI action on a selector.",
    UiActionSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        const timeout = input.timeoutMs ?? 30000;
        const { page } = session;

        switch (input.action) {
          case "click":
            await clickAcrossFrames(page, input.selector, timeout);
            break;
          case "fill":
            await page.fill(input.selector, String(input.value ?? ""), { timeout });
            break;
          case "type":
            await page.type(input.selector, String(input.value ?? ""), { timeout });
            break;
          case "press":
            await page.press(input.selector, String(input.value ?? "Enter"), { timeout });
            break;
          case "select": {
            const values = Array.isArray(input.value) ? input.value : [String(input.value ?? "")];
            await page.selectOption(input.selector, values, { timeout });
            break;
          }
          case "check":
            await page.check(input.selector, { timeout });
            break;
          case "uncheck":
            await page.uncheck(input.selector, { timeout });
            break;
          default:
            throw new Error(`Unsupported action: ${input.action}`);
        }

        return success({ sessionId: session.id, action: input.action, selector: input.selector });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_extract",
    "Extract text or attributes from page elements.",
    UiExtractSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        const timeout = input.timeoutMs ?? 30000;
        await session.page.waitForSelector(input.selector, { timeout });

        let values;
        if (input.all) {
          values = await session.page.$$eval(input.selector, (nodes, attr) =>
            nodes.map((node) => (attr ? node.getAttribute(attr) : node.textContent?.trim() ?? "")),
            input.attribute ?? null
          );
        } else {
          const locator = session.page.locator(input.selector).first();
          values = input.attribute
            ? await locator.getAttribute(input.attribute)
            : await locator.textContent();
        }

        return success({
          sessionId: session.id,
          selector: input.selector,
          value: values,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_assert",
    "Assert UI conditions (visibility and text).",
    UiAssertSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        const timeout = input.timeoutMs ?? 30000;
        const locator = session.page.locator(input.selector).first();
        await locator.waitFor({ state: "visible", timeout });

        if (input.visible === false) {
          throw new Error("visible=false is not supported when using ui_assert; use ui_extract/ui_action as needed.");
        }

        if (input.textContains) {
          const text = (await locator.textContent()) ?? "";
          if (!text.includes(input.textContains)) {
            throw new Error(
              `Assertion failed: selector text did not include "${input.textContains}". Actual: "${text}"`
            );
          }
        }

        return success({ sessionId: session.id, selector: input.selector, asserted: true });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_screenshot",
    "Capture a screenshot from the current UI session.",
    UiScreenshotSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        const savedPath = await saveScreenshot(session, input.fileName, input.fullPage);
        return success({
          sessionId: session.id,
          screenshotPath: savedPath,
          fileName: basename(savedPath),
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );

  server.tool(
    "ui_run_flow",
    "Run a named UI flow from ui-definitions/flows.json.",
    UiRunFlowSchema,
    async (input) => {
      try {
        const session = getSessionOrThrow(input.sessionId);
        const definitions = await loadUiDefinitions();
        const flow = definitions.flows?.[input.flowName];
        if (!flow) {
          throw new Error(`Flow not found: ${input.flowName}`);
        }

        if (flow.requiresConfirm && input.confirm !== true) {
          throw new Error(
            `Flow "${input.flowName}" requires explicit confirmation. Pass confirm=true to continue.`
          );
        }

        const variables = input.variables ?? {};
        for (const requiredVar of flow.requiredVariables ?? []) {
          if (!(requiredVar in variables)) {
            throw new Error(`Missing required flow variable: ${requiredVar}`);
          }
        }

        const stepResults = [];
        for (const step of flow.steps ?? []) {
          const result = await runStep(session, definitions, step, variables);
          stepResults.push(result);
        }

        return success({
          sessionId: session.id,
          flowName: input.flowName,
          stepsExecuted: stepResults.length,
          stepResults,
        });
      } catch (error) {
        return failure(error.message);
      }
    }
  );
}
