# Salesforce MCP Pro Packaging Examples

These examples cover package creation, installation, and package discovery operations.

## `sf_package_create`

Create an unlocked package in a Dev Hub:

```json
{
  "name": "Acme Core",
  "packageType": "Unlocked",
  "path": "force-app",
  "description": "Core metadata package",
  "targetDevHub": "DEVHUB",
  "orgDependent": false
}
```

Create a managed package in a protected Dev Hub (requires confirm):

```json
{
  "name": "Acme Managed",
  "packageType": "Managed",
  "path": "force-app",
  "targetDevHub": "prod-devhub",
  "confirm": true
}
```

## `sf_package_install`

Install a package version in a target org:

```json
{
  "package": "04tXXXXXXXXXXXXXXX",
  "targetOrg": "DEFAULT_TARGET_ORG",
  "wait": 30,
  "publishWait": 10,
  "securityType": "AdminsOnly",
  "apexCompile": "package",
  "noPrompt": true
}
```

Install in a protected org (requires confirm):

```json
{
  "package": "04tXXXXXXXXXXXXXXX",
  "targetOrg": "prod-main",
  "wait": 30,
  "confirm": true
}
```

## `sf_package_list`

List second-generation packages in Dev Hub:

```json
{
  "targetDevHub": "DEVHUB",
  "verbose": true
}
```
