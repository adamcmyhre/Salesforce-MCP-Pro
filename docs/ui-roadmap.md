# Salesforce MCP Pro UI Automation Roadmap

This roadmap defines a UI-centric automation track for tasks that cannot be completed via API alone (for example, cache restarts or sensitive field cleanup flows).

## Goals

- Add safe browser automation for non-API Salesforce and platform tasks.
- Maintain reusable, versioned page/flow definitions (UTAM-style concept).
- Support agent-assisted rediscovery and maintenance of selectors over time.

## Architecture direction

- **Execution layer (MCP tools):** Playwright-backed tools for deterministic browser actions.
- **Definition layer (versioned JSON):** `ui-definitions/` for pages, elements, and named flows.
- **Workflow layer (skills):** higher-level domain instructions that call UI tools and flows.

## Phase 1 (implemented)

- Session lifecycle tools (`ui_session_start`, `ui_session_stop`)
- Core interaction tools (`ui_navigate`, `ui_action`, `ui_extract`, `ui_screenshot`)
- Named flow execution (`ui_run_flow`) using `ui-definitions/flows.json`
- Confirmation guard for sensitive flows (`requiresConfirm` + `confirm: true`)
- Two baseline flows:
  - `restart_cache`
  - `clear_sensitive_field`

## Phase 2

- Definition maintenance tools:
  - `ui_list_flows`
  - `ui_get_flow`
  - `ui_validate_flow`
- Selector health report and flow dry-run mode.
- Optional screenshot-on-step-failure artifact capture.

## Phase 3

- Agent-assisted rediscovery:
  - Discover candidate selectors from live DOM snapshots.
  - Suggest updates to element mappings.
  - Generate definition diffs for review.
- Optional auto-PR workflow for accepted definition updates.

## Guardrails

- Sensitive or destructive flows require `confirm: true`.
- Keep flow definitions explicit and reviewable in source control.
- Prefer semantic selectors (labels, values, titles, roles) over brittle runtime ids such as `j_id*`.
- Capture execution telemetry (step status, duration, errors).
- Default to headless mode; allow visible mode for debugging.
