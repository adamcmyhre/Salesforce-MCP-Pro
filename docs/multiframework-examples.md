# Salesforce MCP Pro Multi-Framework Examples

These examples cover GraphQL and UIBundle workflows for Salesforce Multi-Framework apps.

## `sf_graphql_query`

Run a GraphQL query against Salesforce:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "operationName": "Accounts",
  "query": "query Accounts($first: Int!) { uiapi { query { Account(first: $first) { edges { node { Id Name { value } } } } } } }",
  "variables": {
    "first": 5
  }
}
```

## `sf_uibundle_list`

List UIBundle components in the org:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG"
}
```

## `sf_uibundle_build`

Install and build a local UIBundle:

```json
{
  "directory": "C:\\Repos\\your-project",
  "bundleDirectory": "force-app\\main\\react-recipes\\uiBundles\\reactRecipes",
  "installDependencies": true
}
```

Build with a custom command:

```json
{
  "directory": "C:\\Repos\\your-project",
  "bundleDirectory": "force-app\\main\\react-recipes\\uiBundles\\reactRecipes",
  "installDependencies": false,
  "buildCommand": "npm run build:prod"
}
```

## `sf_uibundle_scaffold`

Scaffold a starter UIBundle project:

```json
{
  "directory": "C:\\Repos\\your-project",
  "bundleName": "reactOpsHub",
  "label": "React Ops Hub",
  "description": "Internal operations hub built with React",
  "outputDir": "force-app/main/default/uiBundles"
}
```

Scaffold with TypeScript and immediately install/build:

```json
{
  "directory": "C:\\Repos\\your-project",
  "bundleName": "reactOpsHub",
  "includeTypeScript": true,
  "installDependencies": true,
  "buildAfterScaffold": true
}
```

## `sf_uibundle_deploy`

Deploy one or more UIBundle source directories:

```json
{
  "targetOrg": "DEFAULT_TARGET_ORG",
  "sourceDir": [
    "force-app/main/react-recipes/uiBundles/reactRecipes"
  ],
  "wait": 30
}
```
