# Salesforce MCP Pro - Next Steps

This document proposes the next implementation milestones after MVP, with a focus on reliability, team adoption, and expanded tool coverage.

## Immediate next steps (1-2 sprints)

1. **Team rollout**
   - Apply the portable Option A MCP config in your project's `.cursor/mcp.json`.
   - Validate all MVP tools against at least one shared sandbox and one scratch org.
   - Collect feedback from 2-3 daily users (timeouts, usability, missing parameters).

2. **Harden command execution**
   - Add retries for transient CLI failures (network/session hiccups).
   - Improve error normalization so tool responses always include:
     - `command`
     - `targetOrg`
     - `statusCode` (if available)
     - user-actionable message
   - Add per-tool timeout defaults with override support.

3. **Expand automated tests**
   - Add tests for each tool module (`orgs`, `data`, `metadata`, `testing`, `users`).
   - Add integration smoke tests (mocked CLI output fixtures from real `sf --json` responses).
   - Add startup test verifying Node version guard + server metadata.

## Additional tools to add (prioritized)

## Priority 1 - High value DX workflow

1. **`sf_retrieve_by_manifest`**
   - Manifest-first retrieval helper with stronger validation and clearer errors.
   - Useful for controlled package.xml-based flows.

2. **`sf_run_apex_test_suite_async`**
   - Suite-first async test execution with explicit run id and report polling.

## Priority 2 - Data and debugging

3. **`sf_manage_debug_levels`**
   - Create/update/list DebugLevel records used by trace flags.

4. **`sf_describe_profile_permissions`**
   - Read object/field permissions for a profile or permission set.

5. **`sf_retrieve_metadata_preview`**
   - Preview retrieve scope and expected members before running a retrieve.

## Cross-cutting enhancements

- **Read-only policy enforcement**
  - Ensure every mutating tool checks `READ_ONLY` consistently.

- **Org allowlist hardening**
  - Enforce `ALLOWED_ORGS` for all tool paths, including future additions.

- **Telemetry (local-only)**
  - Add optional local logs for duration/error metrics (stderr/file), with no credential output.

- **Prompt-ready consistency**
  - Keep tool input/output naming predictable (`targetOrg`, `directory`, `wait`, `result`).

## Suggested rollout order

1. Team rollout + hardening + test expansion
2. Priority 1 tools (metadata retrieval depth + permission model support)
3. Priority 2 tools (Apex operations + permission visibility + pagination)

## Definition of done for next phase

- At least 10 active tools available and documented.
- All tools covered by unit tests; critical flows covered by integration smoke tests.
- No machine-specific paths required in docs or team setup.
- Successful usage in daily development by multiple team members for 2+ weeks.
