# Salesforce MCP Pro DX Operations Examples

These examples cover deployment lifecycle and debug-log operations.

## `sf_get_default_scratch_org`

Get the default scratch org for the current CLI context:

```json
{
  "directory": "C:\\Repos\\your-project"
}
```

## `sf_get_org_limits`

Get current org limits and consumption snapshot:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_whoami`

Get current org identity and connection context:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_generate_lwc_component`

```json
{
  "componentName": "AccountHealthPanel",
  "directory": "C:\\Repos\\your-project",
  "createCss": true
}
```

Generate and deploy immediately:

```json
{
  "componentName": "AccountHealthPanel",
  "directory": "C:\\Repos\\your-project",
  "createCss": true,
  "deployAfterGenerate": true,
  "targetOrg": "DEFAULT_TARGET_ORG",
  "deployWait": 20
}
```

## `sf_generate_flow_definition`

```json
{
  "flowApiName": "Account_Health_Baseline",
  "label": "Account Health Baseline",
  "directory": "C:\\Repos\\your-project",
  "processType": "AutoLaunchedFlow"
}
```

Generate and deploy to a protected org (requires explicit confirm):

```json
{
  "flowApiName": "Account_Health_Baseline",
  "label": "Account Health Baseline",
  "directory": "C:\\Repos\\your-project",
  "processType": "AutoLaunchedFlow",
  "deployAfterGenerate": true,
  "targetOrg": "prod-main",
  "confirm": true
}
```

## `sf_deploy_metadata_validate`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "sourceDir": ["force-app/main/default/classes"],
  "testLevel": "RunLocalTests",
  "wait": 30
}
```

## `sf_get_deploy_status`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "jobId": "0AfXXXXXXXXXXXXXXX",
  "wait": 5
}
```

## `sf_cancel_deploy`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "jobId": "0AfXXXXXXXXXXXXXXX"
}
```

## `sf_list_metadata`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "metadataType": "CustomObject"
}
```

With a folder (for folder-based metadata, such as dashboards):

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "metadataType": "Dashboard",
  "folder": "Sales"
}
```

## `sf_run_apex_test_suite`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "suites": ["CoreRegressionSuite"],
  "wait": 30,
  "codeCoverage": true
}
```

## `sf_assign_permset_group`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "permissionSetGroupNames": ["Finance_Admin_Group"],
  "onBehalfOfUser": "admin@example.com"
}
```

## `sf_remove_permission_set`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "permissionSetNames": ["Legacy_Permissions"],
  "onBehalfOfUser": "admin@example.com"
}
```

## `sf_remove_permset_group`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "permissionSetGroupNames": ["Finance_Admin_Group"],
  "onBehalfOfUser": "admin@example.com"
}
```

## `sf_create_user`

Create using `profileName`:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "username": "new.user@example.com",
  "email": "new.user@example.com",
  "lastName": "User",
  "alias": "nuser",
  "profileName": "Standard User",
  "timeZoneSidKey": "Europe/Oslo",
  "localeSidKey": "en_US",
  "languageLocaleKey": "en_US"
}
```

Create in a protected org (requires confirm):

```json
{
  "targetOrg": "prod-main",
  "username": "new.user@example.com",
  "email": "new.user@example.com",
  "lastName": "User",
  "alias": "nuser",
  "profileName": "Standard User",
  "confirm": true
}
```

## Protected-org safety confirm

When target org alias/username looks like production (default patterns: `prod`, `production`, `live`), mutating tools require `confirm: true`.

Example:

```json
{
  "targetOrg": "prod-main",
  "permissionSetGroupNames": ["Finance_Admin_Group"],
  "confirm": true
}
```

## `sf_execute_anonymous_apex`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "apexCode": "System.debug('Salesforce MCP Pro execute anonymous test');"
}
```

## `sf_schedule_apex_job`

Schedule a class that implements `Schedulable`:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "className": "NightlyDataCleanupJob",
  "jobName": "Nightly Data Cleanup",
  "cronExpression": "0 0 2 * * ?"
}
```

Schedule in a protected org (requires confirm):

```json
{
  "targetOrg": "prod-main",
  "className": "NightlyDataCleanupJob",
  "jobName": "Nightly Data Cleanup",
  "cronExpression": "0 0 2 * * ?",
  "confirm": true
}
```

## `sf_unschedule_apex_job`

Unschedule by exact Salesforce job id:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "jobId": "08eXXXXXXXXXXXXXXX"
}
```

Unschedule by job name (all matching schedules):

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "jobName": "Nightly Data Cleanup",
  "abortAllMatches": true
}
```

## `sf_execute_batch_job`

Run a batch class immediately (class must support no-arg constructor):

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "batchClassName": "AccountRecalculationBatch",
  "scopeSize": 100
}
```

## `sf_list_debug_logs`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "limit": 20,
  "username": "developer@example.com"
}
```

## `sf_get_debug_log`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "logId": "07LXXXXXXXXXXXXXXX"
}
```

## `sf_enable_debug_logs`

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "username": "developer@example.com",
  "expirationMinutes": 30,
  "debugLevelDeveloperName": "SFDC_DevConsole",
  "logType": "DEVELOPER_LOG"
}
```

## `sf_disable_debug_logs`

Disable by trace flag id:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "traceFlagId": "7tfXXXXXXXXXXXXXXX"
}
```

Disable all active flags for a user:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "username": "developer@example.com"
}
```
