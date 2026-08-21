# Salesforce MCP Pro Trailhead Examples

These examples provide Trailhead learning discovery directly from the public Trailhead MCP endpoint.

Important behavior:
- These tools call the external Trailhead MCP server (`https://mcp.trailhead.salesforce.com/mcp`).
- `sf_trailhead_list_tools` returns Trailhead's toolset (such as `content_search` and `fetch_content`), not the full Salesforce MCP Pro local tool catalog.

## `sf_trailhead_list_tools`

List available tools exposed by Trailhead MCP:

```json
{}
```

## `sf_trailhead_search_content`

Basic search:

```json
{
  "query": "Agentforce",
  "first": 6
}
```

Search with role/level/type filters:

```json
{
  "query": "Apex",
  "roles": ["Developer"],
  "levels": ["Foundational"],
  "types": ["MODULE", "PROJECT"],
  "locale": "en-US",
  "first": 8
}
```

## `sf_trailhead_fetch_content`

Fetch a module/trail by apiName:

```json
{
  "apiName": "quickstart-apex"
}
```

Fetch a trail and expand children:

```json
{
  "apiName": "service-cloud-for-slack",
  "expand": true
}
```
