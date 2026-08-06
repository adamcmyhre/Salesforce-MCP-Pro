# Salesforce MCP Pro

Salesforce MCP Pro is a high-performance Node 22 MCP server for Salesforce development workflows. It is designed as a faster, more controllable replacement for the standard Salesforce MCP server, with broad DX and data coverage.

## Why Salesforce MCP Pro

- Fast startup and reliable local execution on Windows/macOS
- More than 30 Salesforce-focused tools across DX and data domains
- Hybrid backend (Salesforce CLI + jsforce) for broad coverage and practical performance
- Built-in operational safety controls for production-like orgs

## Capability Overview

Salesforce MCP Pro currently provides tool categories for:

- Org discovery and environment resolution
- SOQL, SOSL, and Named Query API access
- Tooling API discovery and metadata inspection
- Metadata deploy/retrieve lifecycle operations
- Apex testing, anonymous execution, and cursor-assisted workflows
- LWC and Flow baseline generation (with optional deploy-after-generate)
- Debug log retrieval and trace-flag management
- Access operations (permission sets, permission set groups, user creation)
- Record CRUD and upsert operations

Use your MCP client’s tool browser to see the current live tool catalog.

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

## Documentation Map

- Cutover guide: `docs/cutover.md`
- Query/search examples: `docs/search-examples.md`
- Tooling API examples: `docs/tooling-api-examples.md`
- DX operations examples: `docs/dx-operations-examples.md`
- CRUD examples: `docs/crud-examples.md`

## Local Smoke Test

1. Start the server with `npm start`.
2. Confirm stderr shows `Salesforce MCP Pro is running on stdio`.
3. In your MCP client, confirm the `Salesforce MCP Pro` server is connected and tools are available.
