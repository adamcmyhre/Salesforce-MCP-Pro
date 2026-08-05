# Salesforce MCP Pro Cutover

This checklist migrates a Salesforce project from `@salesforce/mcp` to `Salesforce MCP Pro`.

## 1) Update MCP server config

Edit `<your-project>/.cursor/mcp.json`:

Assumed repo layout:

- `.../<your-project>`
- `.../SalesforceMCP`

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

Prerequisites:

- Node.js `>=22.19.0` on PATH
- Salesforce CLI (`sf`) on PATH
- Authenticated org access via `sf org list`

## 2) Reload MCP in Cursor

- Restart MCP servers or reload Cursor window.
- Confirm `Salesforce MCP Pro` appears in MCP tools list.

## 3) Validate default org behavior

Run `sf_get_username` with `defaultTargetOrg: true` and verify it resolves the expected default org alias/username.

## 4) Validate core workflow tools

Run one basic call for each tool:

- `sf_list_all_orgs`
- `sf_query_org` with `SELECT Id, Name FROM Organization LIMIT 1`
- `sf_retrieve_metadata` on one known component
- `sf_deploy_metadata` on one small metadata change
- `sf_run_apex_test` on one test class
- `sf_assign_permission_set` on a safe non-prod user

## 5) Update project rule text

In your project's Cursor rule files:

- Replace references to `Salesforce DX MCP Server` / `@salesforce/mcp` with `Salesforce MCP Pro`.
- Keep the same workflow requirement (deploy/retrieve/tests/query via MCP).
- Remove workaround notes that are specific to `@salesforce/mcp` version pinning.

## 6) Rollback option for first sprint

Keep a commented backup block in `mcp.json` for the old server for one sprint. Remove it once the team confirms stable usage.
