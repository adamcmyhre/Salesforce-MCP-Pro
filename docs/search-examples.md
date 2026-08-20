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

## `sf_get_user_record_access`

Evaluate record access rights for one user across up to 200 records:

```json
{
  "userId": "005XXXXXXXXXXXXXXX",
  "recordIds": [
    "001XXXXXXXXXXXXXXX",
    "001YYYYYYYYYYYYYYY",
    "500ZZZZZZZZZZZZZZZ"
  ],
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_get_user_object_create_access`

Evaluate object-level create permission for one user across specific objects:

```json
{
  "userId": "005XXXXXXXXXXXXXXX",
  "objectApiNames": [
    "Account",
    "Case",
    "Custom_Object__c"
  ],
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

## `sf_describe_field`

Describe one field with detailed metadata:

```json
{
  "objectName": "Account",
  "fieldName": "ParentId",
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_list_object_fields`

List common editable fields:

```json
{
  "objectName": "Account",
  "isCreateable": true,
  "isUpdateable": true,
  "isNillable": true,
  "limit": 100,
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

List picklist-related fields by name filter:

```json
{
  "objectName": "Case",
  "nameContains": "Status",
  "fieldType": "picklist",
  "includeCalculated": false,
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_is_field_nillable`

Check whether a field can be null:

```json
{
  "objectName": "Account",
  "fieldName": "ParentId",
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
