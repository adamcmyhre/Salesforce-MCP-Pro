# Salesforce MCP Pro Chatter Examples

These examples cover high-value Chatter collaboration workflows for records and groups.

## `sf_chatter_post_to_record`

Post an update to a record feed:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "recordId": "500XXXXXXXXXXXXXXX",
  "message": "Integration deployment completed successfully. Monitoring logs for 30 minutes."
}
```

Post to a protected org (requires confirm):

```json
{
  "targetOrg": "prod-main",
  "recordId": "500XXXXXXXXXXXXXXX",
  "message": "Production release has started. Follow runbook steps in order.",
  "confirm": true
}
```

## `sf_chatter_get_record_feed`

Read recent feed elements for a record:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "recordId": "500XXXXXXXXXXXXXXX",
  "pageSize": 20
}
```

## `sf_chatter_post_to_group`

Post an update to a Chatter group:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "groupId": "0F9XXXXXXXXXXXXXXX",
  "title": "Release Update",
  "message": "Sandbox regression is complete. UAT package install starts at 16:00 UTC."
}
```
