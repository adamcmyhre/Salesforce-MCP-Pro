# Salesforce MCP Pro LWC Recipes Examples

These examples show how to discover and inspect components from `trailheadapps/lwc-recipes` without cloning locally.

## `sf_lwc_recipes_search`

Search by component keyword:

```json
{
  "query": "datatable",
  "limit": 10
}
```

Search by component and file names:

```json
{
  "query": "wire",
  "limit": 15,
  "includeFileNameSearch": true
}
```

## `sf_lwc_recipes_get_component`

Get file list for one component:

```json
{
  "componentName": "datatableInlineEditWithUiApi"
}
```

Get file list with file contents:

```json
{
  "componentName": "wireGetRecord",
  "includeContent": true
}
```
