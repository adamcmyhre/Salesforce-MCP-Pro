#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerApexTools } from "./tools/apex.js";
import { registerAgentforceTools } from "./tools/agentforce.js";
import { registerChatterTools } from "./tools/chatter.js";
import { assertNodeVersion, getConfig } from "./config/env.js";
import { registerCrudTools } from "./tools/crud.js";
import { registerDataTools } from "./tools/data.js";
import { registerDescribeTools } from "./tools/describe.js";
import { registerDebugLogTools } from "./tools/debugLogs.js";
import { registerGenerationTools } from "./tools/generation.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerOrgTools } from "./tools/orgs.js";
import { registerPackagingTools } from "./tools/packaging.js";
import { registerSkillsTools } from "./tools/skills.js";
import { registerTestingTools } from "./tools/testing.js";
import { registerToolingApiTools } from "./tools/tooling.js";
import { registerUiTools } from "./tools/ui.js";
import { registerUserTools } from "./tools/users.js";
import { registerVersionControlTools } from "./tools/versionControl.js";
import { withObservedToolExecution } from "./lib/observability.js";

function buildDescription() {
  const config = getConfig();
  const allowed =
    config.allowedOrgs === "ALL" ? "all authenticated orgs" : config.allowedOrgs.join(", ");
  const writeMode = config.readOnly ? "read-only mode enabled" : "write tools enabled";

  return [
    "Salesforce MCP Pro for Salesforce DX workflows.",
    `Org access: ${allowed}.`,
    `Mode: ${writeMode}.`,
  ].join(" ");
}

const server = new McpServer(
  {
    name: "salesforce-mcp-pro",
    title: "Salesforce MCP Pro",
    version: "0.1.0",
    description: buildDescription(),
  },
  {
    capabilities: {
      logging: {},
    },
  }
);

const rawRegisterTool = server.tool.bind(server);
server.tool = (name, description, inputSchema, handler) =>
  rawRegisterTool(
    name,
    description,
    inputSchema,
    withObservedToolExecution(name, handler)
  );

registerOrgTools(server);
registerDataTools(server);
registerApexTools(server);
registerAgentforceTools(server);
registerChatterTools(server);
registerCrudTools(server);
registerDescribeTools(server);
registerDebugLogTools(server);
registerGenerationTools(server);
registerSkillsTools(server);
registerPackagingTools(server);
registerMetadataTools(server);
registerTestingTools(server);
registerToolingApiTools(server);
registerUiTools(server);
registerUserTools(server);
registerVersionControlTools(server);

async function registerLocalMatrikkelToolsIfPresent() {
  try {
    const { access } = await import("node:fs/promises");
    const { dirname, resolve } = await import("node:path");
    const { fileURLToPath, pathToFileURL } = await import("node:url");
    const here = dirname(fileURLToPath(import.meta.url));
    const localRegister = resolve(here, "..", "local", "matrikkel", "register.js");
    await access(localRegister);
    const mod = await import(pathToFileURL(localRegister).href);
    if (typeof mod.registerMatrikkelTools === "function") {
      mod.registerMatrikkelTools(server);
      console.error("Local matrikkel MCP tools registered");
    }
  } catch {
    // local/matrikkel is optional and gitignored
  }
}

async function main() {
  assertNodeVersion();
  await registerLocalMatrikkelToolsIfPresent();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Salesforce MCP Pro is running on stdio");
}

main().catch((error) => {
  console.error("Fatal server startup error:", error);
  process.exit(1);
});
