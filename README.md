# Salesforce MCP Pro

Salesforce MCP Pro is a high-performance Node 22 Model Context Protocol server for Salesforce development workflows, built as a faster and more controllable replacement for the standard Salesforce MCP server.

## Why Salesforce MCP Pro

- Fast local startup and reliable operation on Windows and macOS without `npx @salesforce/mcp`
- **More than 30 tools** across DX operations, org discovery, metadata workflows, query/search, debugging, generation, and CRUD automation
- Hybrid architecture (Salesforce CLI + jsforce) for broader capability with predictable behavior
- Structured JSON responses designed for agent clients and repeatable team workflows

## Requirements

- Node.js `>=22.19.0`
- Salesforce CLI (`sf`) installed and authenticated

## Run

```bash
npm install
npm start
```

## Cutover checklist

Use `docs/cutover.md` to migrate a project from `@salesforce/mcp` to `Salesforce MCP Pro`.

## Cursor MCP config (portable Option A)

This option avoids machine-specific absolute paths and works across team members' computers when repos are cloned in a shared sibling layout.

Assumed layout:

- `.../<salesforce-project>`
- `.../SalesforceMCP`

From `<salesforce-project>/.cursor/mcp.json`, use the relative path `../SalesforceMCP/src/index.js`.

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

If you use Claude Desktop, use the same `command` and `args` under your `mcpServers` object.

## Environment variables

- `SF_CLI_PATH` (optional): absolute path to `sf` executable if not on PATH (normally not needed)
- `ALLOWED_ORGS` (optional): comma-separated org aliases/usernames allowed
- `READ_ONLY` (optional): `true` to block mutating tools
- `ENFORCE_PROTECTED_ORG_CONFIRM` (optional, default `true`): require `confirm: true` for mutating tools when target org alias/username matches protected patterns
- `PROTECTED_ORG_PATTERNS` (optional): comma-separated values (default: `prod,production,live`)

## Team prerequisites for portable config

- Node.js `>=22.19.0` available on PATH (`node -v`)
- Salesforce CLI available on PATH (`sf --version`)
- Salesforce CLI authenticated (`sf org list`)

## Tools

### DX tools

#### Org and query tools

- `sf_get_username`
- `sf_list_all_orgs`
- `sf_query_org`
- `sf_query_org_paginated`
- `sf_search_org`
- `sf_execute_named_query`
- `sf_describe_object`

#### Apex, LWC, and Flow generation tools

- `sf_execute_anonymous_apex`
- `sf_build_apex_cursor_query`
- `sf_execute_apex_cursor_query`
- `sf_generate_lwc_component`
- `sf_generate_flow_definition`

#### Debug and metadata tools

- `sf_list_debug_logs`
- `sf_get_debug_log`
- `sf_enable_debug_logs`
- `sf_disable_debug_logs`
- `sf_deploy_metadata`
- `sf_deploy_metadata_validate`
- `sf_get_deploy_status`
- `sf_cancel_deploy`
- `sf_list_metadata`
- `sf_retrieve_metadata`

#### Testing and access tools

- `sf_run_apex_test`
- `sf_run_apex_test_suite`
- `sf_assign_permission_set`
- `sf_assign_permset_group`
- `sf_remove_permission_set`
- `sf_remove_permset_group`
- `sf_create_user`

### CRUD tools

- `sf_create_records`
- `sf_update_records`
- `sf_delete_records`
- `sf_upsert_records`

## Local smoke test

1. Start the server:
   ```bash
   npm start
   ```
2. Verify it prints `Salesforce MCP Pro is running on stdio` to stderr.
3. In Cursor, open MCP tools and confirm the `Salesforce MCP Pro` server loads with tools.

## Cutover

Use the cutover checklist in `docs/cutover.md` to migrate your project from `@salesforce/mcp` to Salesforce MCP Pro.

## CRUD examples

See `docs/crud-examples.md` for ready-to-use payload examples for:

- `sf_create_records`
- `sf_update_records`
- `sf_delete_records`
- `sf_upsert_records`

## Query and search examples

See `docs/search-examples.md` for ready-to-use payload examples for:

- `sf_query_org`
- `sf_query_org_paginated`
- `sf_search_org`
- `sf_execute_named_query`
- `sf_describe_object`
- `sf_build_apex_cursor_query`
- `sf_execute_apex_cursor_query`

## DX operations examples

See `docs/dx-operations-examples.md` for ready-to-use payload examples for:

- `sf_generate_lwc_component`
- `sf_generate_flow_definition`
- `sf_deploy_metadata_validate`
- `sf_get_deploy_status`
- `sf_cancel_deploy`
- `sf_list_metadata`
- `sf_run_apex_test_suite`
- `sf_execute_anonymous_apex`
- `sf_remove_permission_set`
- `sf_remove_permset_group`
- `sf_create_user`
- `sf_list_debug_logs`
- `sf_get_debug_log`
- `sf_enable_debug_logs`
- `sf_disable_debug_logs`

Generation tools (`sf_generate_lwc_component`, `sf_generate_flow_definition`) also support optional deployment with `deployAfterGenerate: true` plus `targetOrg`, `deployWait`, and `confirm` (required for protected org aliases when safety guard is enabled).
