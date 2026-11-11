# AgenticLab — Generic System Payload

This directory is an uninitialized, workspace-independent AgenticLab payload. It contains system contracts, prompts, and Pi adapters—not a project's knowledge, scope profile, checkpoints, metrics, or implementation history.

## Contents

- `AGENTS.md` — operating and safety instructions for a consuming workspace.
- `brain/` — portable operating and knowledge contracts.
- `adapters/pi/` — the optional Pi knowledge-capture and write-gate integration.
- `config/knowledge-capture-policy.template.json` — safe generic defaults. First-use initialization renders the workspace policy at `config/knowledge-capture-policy.json` with the confirmed project scope; metrics and candidate staging default off.
- `knowledge/` — empty structural scaffold only; initialization creates the scope-aware `INDEX.md` and empty `records/` destination.
- `prompts/system/initialize-workspace.md` — explicit first-use initialization prompt.
- `prompts/delivery/` — opt-in `/plan`, `/implement`, and `/premortem` workflow prompts plus their checkpoint schema.
- `helpers/` — reserved empty scaffold; no context-assembly implementation is shipped in this payload.

The `adapters/pi/tests/` development suite is not included in this runtime payload. It is retained separately for the port-validation process and is not copied into an installed workspace.

## First-use initialization

Copy this payload as `<workspace>/AgenticLab/`. Start Pi from the workspace root and explicitly ask it to read/follow `AgenticLab/prompts/system/initialize-workspace.md`. Initialization confirms the project scope, performs a bounded read-only orientation, and previews the workspace-owned scope/profile, project-local `.pi` wiring, workspace capture policy, knowledge router, and empty records scaffold together. Nothing is written until the user approves that preview.

The generic policy template defaults candidate staging and metrics off and contains no workspace-specific scope or read triggers. Initialization keeps both off unless the user explicitly opts in, and previews the resulting policy with the confirmed project identity. Existing workspace policy and knowledge data must be preserved, not overwritten or imported from another project.

After approved setup, restart Pi from the workspace root and grant project trust when prompted. Project extensions are executable code with the Pi process's permissions; they are not an OS sandbox.

