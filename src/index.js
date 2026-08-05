#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerApexTools } from "./tools/apex.js";
import { assertNodeVersion, getConfig } from "./config/env.js";
import { registerCrudTools } from "./tools/crud.js";
import { registerDataTools } from "./tools/data.js";
import { registerDescribeTools } from "./tools/describe.js";
import { registerDebugLogTools } from "./tools/debugLogs.js";
import { registerGenerationTools } from "./tools/generation.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerOrgTools } from "./tools/orgs.js";
import { registerTestingTools } from "./tools/testing.js";
import { registerUserTools } from "./tools/users.js";

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

registerOrgTools(server);
registerDataTools(server);
registerApexTools(server);
registerCrudTools(server);
registerDescribeTools(server);
registerDebugLogTools(server);
registerGenerationTools(server);
registerMetadataTools(server);
registerTestingTools(server);
registerUserTools(server);

async function main() {
  assertNodeVersion();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Salesforce MCP Pro is running on stdio");
}

main().catch((error) => {
  console.error("Fatal server startup error:", error);
  process.exit(1);
});
