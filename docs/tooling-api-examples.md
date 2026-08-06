# Salesforce MCP Pro Tooling API Examples

These examples cover the introductory Tooling API tools.

## Run a Tooling query

```json
{
  "query": "SELECT Id, Name, ApiVersion, Status FROM ApexClass ORDER BY Name LIMIT 20",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## List Tooling objects

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## Describe a Tooling object

```json
{
  "objectName": "ApexClass",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## Fetch Apex class by name

```json
{
  "className": "AccountService",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```
