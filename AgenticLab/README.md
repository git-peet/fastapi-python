# AgenticLab — exp4 Workspace Payload

This directory is the **initialized, project-specific AgenticLab payload** for the `exp4` workspace (`/home/peet/Projects/exp4`). It is not a generic distribution — it contains live project knowledge, scope profiles, checkpoints, implementation logs, and the C03 context-selection metrics slice.

## Contents

- `AGENTS.md` — operating and safety instructions for this workspace.
- `brain/` — portable operating and knowledge contracts.
- `adapters/pi/` — the optional Pi knowledge-capture and write-gate integration, extended with C03 context-selection metrics (`recordContextSelectionMetric` helper and Pi tool).
- `config/knowledge-capture-policy.json` — the rendered workspace policy. Metrics are enabled (`metricsEnabled: true`); candidate staging remains off.
- `knowledge/` — populated with `INDEX.md`, `MOC.md`, maps, and active records. Records are project-scoped (`project:exp4`).
- `knowledge-pending/` — private staging queue for reviewed candidates.
- `knowledge/checkpoints/` — transient plan/premortem checkpoints.
- `implementation-logs/exp4/` — per-PBI implementation logs.
- `prompts/system/initialize-workspace.md` — first-use initialization prompt (retained for reference; this workspace is already initialized).
- `prompts/delivery/` — opt-in `/plan`, `/implement`, and `/premortem` workflow prompts, extended with C03 minimal context selection, knowledge route & retrieval, context metrics, and checkpoint approval gate sections.
- `helpers/` — reserved empty scaffold.

## Current state (2026-11-11)

- **Initialized** — project scope is `project:exp4`, project identity is `AgenticLab v5 exp4`.
- **Knowledge records active** — see `knowledge/INDEX.md` for the full list.
- **C03 context-selection metrics** — the `recordContextSelectionMetric` Pi tool is registered and emits content-free events (`context_source_used`, `context_stop_rule_triggered`, `context_assembly_complete`) to `.pi/metrics/agenticlab.jsonl` during `/plan` and `/implement` sessions.
- **PBI 3 (synchronous conversation triage)** — already implemented; verified via isolated tests (9 service + 22 API tests passing).
- **PBI 4 (conversations UI)** — implemented.
- **PBI 1 (priority enum)** — implemented.

## First-use initialization

This workspace is already initialized. To re-run initialization from scratch, copy this payload as `<workspace>/AgenticLab/`, start Pi from the workspace root, and explicitly ask it to read/follow `AgenticLab/prompts/system/initialize-workspace.md`. Initialization confirms the project scope, performs a bounded read-only orientation, and previews the workspace-owned scope/profile, project-local `.pi` wiring, workspace capture policy, knowledge router, and records scaffold together. Nothing is written until the user approves that preview.

The generic policy template (`config/knowledge-capture-policy.template.json`) defaults candidate staging and metrics off and contains no workspace-specific scope or read triggers. Initialization keeps both off unless the user explicitly opts in, and previews the resulting policy with the confirmed project identity. Existing workspace policy and knowledge data must be preserved, not overwritten or imported from another project.

After approved setup, restart Pi from the workspace root and grant project trust when prompted. Project extensions are executable code with the Pi process's permissions; they are not an OS sandbox.

## Porting to clean payload

The C03 context-selection slice (metrics helper, tool registration, policy flag, prompt sections) has been ported to the generic clean payload at `/home/peet/Projects/C03-clean-payload/` and pushed to `main`. See `backlog/candidates/C03.1-context-engineering.md` for the gap analysis and next steps.