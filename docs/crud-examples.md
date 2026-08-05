# Salesforce MCP Pro CRUD Examples

These examples show typical request payloads for the jsforce-backed CRUD tools.

## `sf_create_records`

Create one or more records for an object.

```json
{
  "objectName": "Contact",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "records": [
    {
      "FirstName": "Ada",
      "LastName": "Lovelace",
      "Email": "ada@example.com"
    },
    {
      "FirstName": "Grace",
      "LastName": "Hopper",
      "Email": "grace@example.com"
    }
  ]
}
```

## `sf_update_records`

Update one or more records. Each record must include `Id`.

```json
{
  "objectName": "Account",
  "records": [
    {
      "Id": "001XXXXXXXXXXXXXXX",
      "Name": "Acme Corp Updated"
    },
    {
      "Id": "001YYYYYYYYYYYYYYY",
      "Phone": "+47 555 12 345"
    }
  ]
}
```

## `sf_delete_records`

Delete one or more records by id.

```json
{
  "objectName": "Contact",
  "ids": [
    "003XXXXXXXXXXXXXXX",
    "003YYYYYYYYYYYYYYY"
  ]
}
```

## `sf_upsert_records`

Upsert records using an external id field.

```json
{
  "objectName": "Account",
  "externalIdField": "External_Id__c",
  "records": [
    {
      "External_Id__c": "ACCT-1001",
      "Name": "Acme Norway"
    },
    {
      "External_Id__c": "ACCT-1002",
      "Name": "Acme Sweden"
    }
  ]
}
```

## Optional fields

- `targetOrg`: override default org alias/username
- `directory`: run with a specific project working directory

## Notes

- Mutating tools are blocked when `READ_ONLY=true`.
- Org access restrictions are enforced through `ALLOWED_ORGS`.
- Tool responses include operation result details from jsforce for each record.
