# Salesforce MCP Pro Version Control Examples

These examples cover read-only Git tools exposed by Salesforce MCP Pro.

## `git_status`

```json
{
  "directory": "C:\\Repos\\your-project"
}
```

## `git_recent_commits`

```json
{
  "directory": "C:\\Repos\\your-project",
  "limit": 25
}
```

## `git_last_commit_for_file`

```json
{
  "directory": "C:\\Repos\\your-project",
  "filePath": "force-app/main/default/classes/AccountService.cls"
}
```

## `git_file_history`

```json
{
  "directory": "C:\\Repos\\your-project",
  "filePath": "force-app/main/default/classes/AccountService.cls",
  "limit": 30
}
```

## `git_last_commit_files`

```json
{
  "directory": "C:\\Repos\\your-project"
}
```
