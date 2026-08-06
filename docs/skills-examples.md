# Salesforce MCP Pro Skills Discovery Examples

These examples use the live `forcedotcom/sf-skills` repository without a local clone.

## Search for Flow skills

```json
{
  "query": "flow",
  "limit": 10,
  "includeContentSearch": true
}
```

## Search for OmniStudio-related skills

```json
{
  "query": "omnistudio",
  "limit": 10,
  "includeContentSearch": true
}
```

## Fetch one skill definition

```json
{
  "skillName": "automation-flow-generate",
  "includeReferences": true
}
```

## List available skill domains

```json
{
  "limitPerDomain": 6
}
```
