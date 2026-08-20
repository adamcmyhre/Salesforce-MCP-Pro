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

## Analyze metadata impact (dependency graph edges)

```json
{
  "metadataName": "AccountService",
  "metadataType": "ApexClass",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "maxResultsPerDirection": 200
}
```

Include managed-package dependencies:

```json
{
  "metadataName": "My_Flow",
  "metadataType": "Flow",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "includeManaged": true
}
```

Analyze transitive blast radius up to depth 3:

```json
{
  "metadataName": "CaseAutomationOrchestrator",
  "metadataType": "ApexClass",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "maxDepth": 3,
  "maxResultsPerDirection": 400
}
```

Stop traversal at specific types (still included in output):

```json
{
  "metadataName": "CaseAutomationOrchestrator",
  "metadataType": "ApexClass",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "maxDepth": 4,
  "stopAtTypes": ["Flow", "CustomLabel"]
}
```
