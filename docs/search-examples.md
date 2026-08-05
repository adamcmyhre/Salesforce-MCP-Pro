# Salesforce MCP Pro Query and Search Examples

These examples show SOQL, SOSL, object describe, and Apex cursor builder payloads.

## `sf_query_org`

Query records with SOQL.

```json
{
  "query": "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 20",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_query_org_paginated`

First page:

```json
{
  "query": "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "pageSize": 100
}
```

Next page:

```json
{
  "query": "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "nextRecordsUrl": "/services/data/v63.0/query/01gXXXXXXXXXXXX-2000",
  "pageSize": 100
}
```

## `sf_search_org`

Search across objects with SOSL.

```json
{
  "search": "FIND {acme*} IN ALL FIELDS RETURNING Account(Id, Name), Contact(Id, Name, Email)",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_execute_named_query`

Execute a Named Query by API name with request parameters.

```json
{
  "queryApiName": "GetAccountByName",
  "parameters": {
    "name": "Acme"
  },
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_describe_object`

Describe object schema and fields.

```json
{
  "objectName": "Account",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_build_apex_cursor_query`

Build from explicit SOQL:

```json
{
  "soqlQuery": "SELECT Id, Name, Amount FROM Opportunity WHERE IsClosed = false ORDER BY CreatedDate DESC",
  "fetchSize": 500,
  "accessLevel": "USER_MODE"
}
```

Build from parts with pagination cursor template:

```json
{
  "objectName": "Case",
  "fields": ["Id", "CaseNumber", "Status", "Priority"],
  "whereClause": "IsClosed = false",
  "orderBy": "CreatedDate DESC",
  "fetchSize": 200,
  "usePaginationCursor": true
}
```

## `sf_execute_apex_cursor_query`

Build and execute standard cursor Apex in one step:

```json
{
  "soqlQuery": "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 1000",
  "fetchSize": 200,
  "accessLevel": "USER_MODE",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

Execute against a protected org (requires explicit confirm):

```json
{
  "objectName": "Case",
  "fields": ["Id", "Status", "Priority"],
  "whereClause": "IsClosed = false",
  "fetchSize": 100,
  "targetOrg": "prod-main",
  "confirm": true
}
```

## Notes

- `directory` is optional in each tool and can be used to run from a specific project path.
- Keep SOQL/SOSL query sizes reasonable for prompt context.
