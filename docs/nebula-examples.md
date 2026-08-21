# Nebula Logger Examples

These helpers wrap Nebula Logger custom objects and auto-detect unlocked vs managed-package namespace prefixes.

## `sf_nebula_list_logs`

List recent parent logs:

```json
{
  "targetOrg": "my-dev-org",
  "limit": 25,
  "sinceHours": 24
}
```

## `sf_nebula_get_log_entries`

Get entries for one parent log:

```json
{
  "targetOrg": "my-dev-org",
  "logId": "a1Bxx0000001234EAA",
  "limit": 500
}
```

Filter by level:

```json
{
  "targetOrg": "my-dev-org",
  "logId": "a1Bxx0000001234EAA",
  "loggingLevels": ["ERROR", "WARN"]
}
```

## `sf_nebula_search_entries`

Search entry messages:

```json
{
  "targetOrg": "my-dev-org",
  "query": "null pointer",
  "sinceHours": 72,
  "limit": 100
}
```

Search by text + tags:

```json
{
  "targetOrg": "my-dev-org",
  "query": "integration timeout",
  "tags": ["integration", "api-timeout"],
  "loggingLevels": ["ERROR"],
  "sinceHours": 168
}
```

## `sf_nebula_find_logs_by_tag`

Find logs that contain any of the tags:

```json
{
  "targetOrg": "my-dev-org",
  "tags": ["billing", "overnight-batch"],
  "matchMode": "any",
  "sinceHours": 168,
  "limit": 50
}
```

Find logs that contain all tags + include matching entries preview:

```json
{
  "targetOrg": "my-dev-org",
  "tags": ["order-sync", "critical"],
  "matchMode": "all",
  "includeEntries": true,
  "entriesPerLog": 10
}
```

## Optional namespace override

If auto-detection is not desired, provide `namespace`:

```json
{
  "targetOrg": "my-dev-org",
  "namespace": "Nebula",
  "tags": ["flow"]
}
```

