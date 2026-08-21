# Salesforce MCP Pro

Salesforce MCP Pro is a high-performance Node 22 MCP server for Salesforce development workflows. It is designed as a faster, more controllable replacement for the standard Salesforce MCP server, with broad DX and data coverage.

## Why Salesforce MCP Pro

- Fast startup and reliable local execution on Windows/macOS
- More than 75 Salesforce-focused tools across DX, data, and UI automation domains
- Hybrid backend (Salesforce CLI + jsforce) for broad coverage and practical performance
- Built-in operational safety controls for production-like orgs
- Structured stderr observability with per-tool request IDs, timing, org alias, and error classification

## Capability Overview

Salesforce MCP Pro currently provides tool categories for:

- Org discovery and environment resolution
- Agentforce lifecycle and programmatic preview tooling
- Tooling API discovery, metadata inspection, and dependency impact analysis
- Metadata API deploy/retrieve lifecycle operations
- 2GP packaging lifecycle operations
- SOQL, SOSL, Apex Cursors, Named Query API, DML operations
- Apex testing, anonymous execution and async job operations (schedule/batch)
- Chatter collaboration tooling for record feeds and group updates
- LWC and Flow generation
- Multi-Framework support: GraphQL queries and UIBundle scaffold/list/build/deploy workflows
- Create and publish Platform Events
- Debug log retrieval and trace-flag management
- Access operations (permission sets, permission set groups, user creation)
- Live Salesforce skill discovery from `forcedotcom/sf-skills` (including Flow and OmniStudio-focused skills)
- Live LWC recipe discovery from `trailheadapps/lwc-recipes`
- Live Trailhead catalog search and content fetch via public Trailhead MCP `mcp.trailhead.salesforce.com`
- Playwright-based UI automation for non-API tasks, including tooling to build and run test automation
- Support for Git-backed Salesforce projects

Use your MCP client’s tool browser to see the current live tool catalog.
Trailhead-prefixed tools (`sf_trailhead_*`) call the external Trailhead MCP endpoint and return Trailhead server capabilities/content, not the full local Salesforce MCP Pro tool catalog.

## Requirements

- Node.js `>=22.19.0`
- Salesforce CLI (`sf`) installed and authenticated

## Quick Start

```bash
npm install
npm start
```

## Portable MCP Config (Option A)

This avoids machine-specific absolute paths when repos are cloned with a shared sibling layout.

Assumed layout:

- `.../<salesforce-project>`
- `.../SalesforceMCP`

From `<salesforce-project>/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "Salesforce MCP Pro": {
      "command": "node",
      "args": ["../SalesforceMCP/src/index.js"]
    }
  }
}
```

For Claude Desktop, use the same `command` and `args` under `mcpServers`.

## Safety Model

- Org allow-listing (`ALLOWED_ORGS`)
- Global read-only mode (`READ_ONLY`)
- Protected-org mutation confirmation (enabled by default)

Key environment variables:

- `SF_CLI_PATH` (optional)
- `ALLOWED_ORGS` (optional)
- `READ_ONLY` (optional)
- `ENFORCE_PROTECTED_ORG_CONFIRM` (optional, default `true`)
- `PROTECTED_ORG_PATTERNS` (optional, default `prod,production,live`)
- `GITHUB_TOKEN` (optional, recommended for higher GitHub API rate limits when using skill-discovery tools)

## UI Automation Notes

- UI tools use Playwright and are designed for deterministic, definition-driven browser automation.
- `ui_session_start` defaults to `headless: true` for normal runs.
- Use `slowMoMs` during debugging:
  - `0` for normal speed
  - `100-250` for human-observable debugging
- For visual troubleshooting, set `headless: false` and capture screenshots with `ui_screenshot`.
- Ensure Playwright browser binaries are installed in the runtime environment used by this server.

## Documentation Map

- Query/search examples: `docs/search-examples.md`
- Agentforce examples: `docs/agentforce-examples.md`
- Tooling API examples: `docs/tooling-api-examples.md`
- DX operations examples: `docs/dx-operations-examples.md`
- Chatter examples: `docs/chatter-examples.md`
- Packaging examples: `docs/packaging-examples.md`
- CRUD examples: `docs/crud-examples.md`
- Skills discovery examples: `docs/skills-examples.md`
- LWC recipes examples: `docs/lwc-recipes-examples.md`
- Multi-Framework examples: `docs/multiframework-examples.md`
- Trailhead examples: `docs/trailhead-examples.md`
- UI automation examples: `docs/ui-examples.md`
- Version control examples: `docs/version-control-examples.md`

## Local Smoke Test

1. Start the server with `npm start`.
2. Confirm stderr shows `Salesforce MCP Pro is running on stdio`.
3. In your MCP client, confirm the `Salesforce MCP Pro` server is connected and tools are available.
