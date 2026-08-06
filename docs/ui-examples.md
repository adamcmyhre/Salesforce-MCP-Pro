# Salesforce MCP Pro UI (Playwright) Examples

These examples cover Phase 1 UI automation tools.

## Start a session (headless default)

```json
{
  "baseUrl": "https://your-org.lightning.force.com"
}
```

## Start a visible debug session with slow motion

```json
{
  "headless": false,
  "slowMoMs": 150,
  "baseUrl": "https://your-org.lightning.force.com",
  "viewportWidth": 1440,
  "viewportHeight": 900
}
```

## Navigate to a setup page

```json
{
  "path": "/lightning/setup/PlatformCache/home"
}
```

## Run the restart cache flow

```json
{
  "flowName": "restart_cache",
  "confirm": true
}
```

## Run clear sensitive field flow

```json
{
  "flowName": "clear_sensitive_field",
  "confirm": true,
  "variables": {
    "objectApiName": "Account",
    "recordId": "001XXXXXXXXXXXXXXX",
    "fieldSelector": "input[name='Secret_Field__c']"
  }
}
```

## Capture a screenshot

```json
{
  "fileName": "after-flow.png",
  "fullPage": true
}
```

## Stop session

```json
{}
```
