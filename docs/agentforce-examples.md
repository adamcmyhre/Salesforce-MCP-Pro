# Salesforce MCP Pro Agentforce Examples

These examples cover baseline Agentforce lifecycle and programmatic preview operations.

## `sf_agent_create`

Create an agent from a local agent spec file:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "name": "Resort Manager",
  "apiName": "Resort_Manager",
  "specPath": "specs/resortManagerAgent.yaml"
}
```

Preview creation without saving in org:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "name": "Resort Manager",
  "specPath": "specs/resortManagerAgent.yaml",
  "preview": true
}
```

## `sf_agent_activate`

Activate a specific version:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "apiName": "Resort_Manager",
  "version": 2
}
```

## `sf_agent_deactivate`

Deactivate an agent:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "apiName": "Resort_Manager"
}
```

## `sf_agent_preview_start`

Start a preview session for a published activated agent:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "apiName": "Resort_Manager"
}
```

Start with an authoring bundle and simulated actions:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "authoringBundle": "Resort_Manager_Bundle",
  "simulateActions": true,
  "contextVariables": ["$Context.AccountId=001XXXXXXXXXXXXXXX", "SessionLanguage=en_US"]
}
```

## `sf_agent_preview_send`

Send an utterance:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "apiName": "Resort_Manager",
  "sessionId": "<SESSION_ID>",
  "utterance": "What can you help me with for onboarding?"
}
```

## `sf_agent_preview_end`

End one preview session:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "apiName": "Resort_Manager",
  "sessionId": "<SESSION_ID>"
}
```

End all sessions for an authoring bundle:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "authoringBundle": "Resort_Manager_Bundle",
  "endAll": true,
  "noPrompt": true
}
```

## `sf_agent_preview_sessions`

List locally cached preview sessions:

```json
{
  "directory": "C:\\Repos\\your-project"
}
```
