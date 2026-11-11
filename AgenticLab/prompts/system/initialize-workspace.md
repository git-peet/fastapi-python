---
description: "Initialize AgenticLab in this workspace once: confirm scope, orient the codebase, and prepare local Pi wiring."
argument-hint: "[optional project or subproject focus]"
---

# First-use Workspace Initialization

This is a one-time, user-invoked setup and orientation flow for the current workspace. It is not a normal session-start action and must never run automatically on later Pi starts.

For first-use setup, the user simply asks the agent to read and follow `AgenticLab/prompts/system/initialize-workspace.md` from the workspace root. During approved setup, `.pi/settings.json` registers this template as `/initialize-workspace` and the payload's delivery prompts as `/plan`, `/implement`, and `/premortem`. Registration makes them available; it does not run them.

## Purpose and boundaries

Prepare five distinct things:

1. **Project scope** — user-confirmed project/subproject identity and boundaries in `AgenticLab/PROJECT-SCOPE.md`.
2. **AgenticLab/Pi integration** — project-local `.pi/settings.json` and `.pi/APPEND_SYSTEM.md`; never create or edit a workspace-root `AGENTS.md` or global Pi configuration.
3. **Project orientation profile** — a concise, source-cited `AgenticLab/PROJECT-OVERVIEW.md`, separate from both scope and durable knowledge records.
4. **Knowledge navigation scaffold** — a stable `AgenticLab/knowledge/INDEX.md` router, an empty `AgenticLab/knowledge/records/` destination, an empty `AgenticLab/knowledge/maps/` directory, and a minimal `AgenticLab/knowledge/MOC-template.md` skeleton when absent. This is structure only; it does not seed, promote, or synthesize records, and does not create populated MOCs.
5. **Workspace capture policy** — `AgenticLab/config/knowledge-capture-policy.json`, rendered from the generic template with the confirmed stable project key; staging starts disabled, metrics default off unless the user explicitly opts in, and project-specific triggers are empty.

This flow does not install or refresh the AgenticLab payload, run the application/tests, seed or promote AgenticLab knowledge records, import V4 knowledge, or build Graphify, semantic maps, symbol indexes, MOCs, or a DIGEST. It does not create or update files in the host application's paths. Do not access `.env`, secrets, protected `data/`, backups, production/customer data, dependencies, generated output, databases, or the network unless a separate task explicitly authorizes an exact path/action. Do not use shell for project discovery by default.

The user explicitly invoked setup, but that is **not** blanket approval for file writes. First confirm scope, then perform bounded read-only orientation. Use safe defaults for optional configuration choices unless the user explicitly opts in. Prepare the exact proposed setup changes and show the complete preview in the conversation. **Do not call any file-writing tool before the preview has been shown and the user has explicitly approved it in a subsequent message.** End the preview with one short approval question and wait. If the user rejects, requests changes, or has not yet approved, write nothing; revise and show a new preview if requested. After approval, use the normal project file tools to write only the approved setup files.

## Step 0 — Load the applicable AgenticLab contracts

Read, if present:

- `AgenticLab/AGENTS.md`
- `AgenticLab/brain/operating-contract.md`
- `AgenticLab/brain/knowledge-contract.md`
- `AgenticLab/knowledge/INDEX.md` (if present)
- `AgenticLab/config/knowledge-capture-policy.template.json` (if present)
- `AgenticLab/config/knowledge-capture-policy.json` (if present)
- `AgenticLab/PROJECT-SCOPE.md`

The first three paths above are the complete required AgenticLab instruction/contract set for this payload. Do not assume Pi discovered them automatically: the workspace may not have `.pi/APPEND_SYSTEM.md` yet. Do not search for or infer additional contract filenames. If any required path is missing or appears to be a partial/unknown payload, report that and stop rather than inventing its rules. The generic policy template is required for first-use policy creation; if it is missing, malformed, or has unsafe defaults, stop rather than inventing a replacement.

## Step 1 — Inspect only known setup paths

Inspect only these paths to determine whether initialization is new, partial, or already complete:

- `AgenticLab/AGENTS.md`
- `AgenticLab/PROJECT-SCOPE.md`
- `AgenticLab/PROJECT-OVERVIEW.md`
- `AgenticLab/knowledge/INDEX.md`
- `AgenticLab/knowledge/records/` (existence only; do not inspect record bodies)
- `AgenticLab/config/knowledge-capture-policy.template.json`
- `AgenticLab/config/knowledge-capture-policy.json` (existence and bounded config only; preserve if present)
- `.pi/settings.json`
- `.pi/APPEND_SYSTEM.md`

Do not list or inspect host application files during this setup preflight. Do not create, replace, move, or scaffold generic workspace-root paths such as `src/`, `tests/`, `package.json`, or a root `AGENTS.md`.

Classify the state:

- **Payload only:** AgenticLab exists but scope/profile/local Pi wiring are absent or incomplete. This is the normal first-run case.
- **Partially initialized:** one or more target-owned setup files already exist. Preserve them; identify only the missing pieces and conflicts.
- **Already initialized:** scope, overview, project-local Pi wiring, knowledge navigation scaffold, and workspace capture policy exist. Do not rescan or overwrite. Report that initialization appears complete; offer a separately requested, source-bounded refresh only if the user asks.
- If scope/overview exist but the knowledge index or records directory is absent, treat the workspace as **partially initialized** for additive scaffold creation only. Do not repeat project orientation.
- If `AgenticLab/config/knowledge-capture-policy.json` already exists, preserve it. Verify its `project` and `scope` agree with the confirmed stable key; if it is malformed or conflicts with the scope, stop and report the conflict rather than replacing or rewriting it.

If `AgenticLab/` is absent, stop: this prompt must be explicitly read from an AgenticLab payload. Do not infer or report the payload's development origin as part of the consuming project's orientation.

## Step 2 — Confirm project identity and scope before source inspection

If `PROJECT-SCOPE.md` exists, read it and ask only focused questions about missing or conflicting scope. Preserve existing scope text unless the user explicitly approves a change.

If it does not exist, ask for one concise response establishing:

- project name/type or the user's preferred identity;
- the stable project key used for `project:<key>` knowledge scope and capture policy; suggest a key only for explicit confirmation, and never infer it from the workspace directory name;
- which application/repository/subproject the orientation should cover;
- any paths or data that must not be read during this orientation;
- any permanent project boundaries or exclusions the user wants recorded, distinguished from temporary orientation limits.

Orientation is read-only: do not run the application, tests, scripts, or commands. Metrics are off by default; the user may explicitly request aggregate metrics as part of their setup answers.

A project name inferred from a folder is a suggestion, not user confirmation. Do not inspect source to infer authorization or decide which project paths are safe. If the task covers a monorepo, ask for or propose a bounded scope before scanning.

State the intended inspection boundary and exclusions back to the user. If there is unresolved ambiguity about protected data, ask before proceeding.

### Semantics of the generated `PROJECT-SCOPE.md`

`PROJECT-SCOPE.md` is project context, not a workflow permission matrix. It records only the user-confirmed project identity, included repository/subproject coverage, and explicit permanent exclusions. Do not put initialization limits, task-specific approval requirements, command permissions, or workflow rules in this file; those are governed by the current task, `AGENTS.md`, and the invoked workflow. A user statement that an operation is not permanently prohibited but requires authorization for a particular task is not a permanent exclusion and must not be copied into this file.

The read-only boundary for initialization governs only this orientation pass. If the user identifies a restriction as permanent, preserve it under permanent exclusions. Otherwise, do not convert the orientation boundary into an ongoing project-wide rule.

For a new scope file, use only this compact structure:

```markdown
# Project Scope

- **Project:** [user-confirmed identity]
- **Stable project key:** [confirmed key]
- **Knowledge scope:** project:[confirmed key]
- **Workspace root:** [confirmed workspace name or root]

## Included project scope
[Applications, packages, or subprojects covered by this workspace scope.]

## Permanent exclusions
[Only explicit, durable exclusions. State `None specified` if there are none.]
```

The preview may separately explain that initialization's read-only boundary is temporary, but this explanatory note must be outside the proposed `PROJECT-SCOPE.md` content and code block.

## Step 3 — Make a bounded read-only orientation

After scope is confirmed, inspect only sources needed to create a compact navigation profile. Prefer direct, known files and available native read-only tools. Use the confirmed scope to choose paths; do not recursively inventory the entire workspace by default.

Likely useful sources, only when within the confirmed scope:

- README/contributor/architecture documentation;
- package/workspace manifests and language/framework configuration;
- limited top-level structure for approved application paths;
- entry points named by project documentation or manifests;
- representative tests and test-runner configuration to identify layout/conventions;
- CI/build configuration only when useful to understand the project workflow.

Do not execute scripts found in manifests. Do not install dependencies, start services, run migrations, or run tests. Do not read any excluded/protected files. If available read-only tools cannot cover a requested area, report the limitation and ask whether to accept partial coverage; do not substitute a shell command or broaden the scan. If the source surface is too large for the agreed pass, stop with a partial-coverage report and offer a narrower follow-up.

For every material claim, distinguish source-verified fact from inference or unknown and retain supporting file paths. A profile is a useful map, not an exhaustive inventory or current truth for every future task.

Match orientation effort to the user-confirmed coverage. At minimum, if backend depth is requested, inspect the backend's documented entry point plus representative model/API/dependency source; if frontend or deployment mapping is requested, inspect the relevant frontend entry/config and deployment docs/config. Keep paths within the approved boundaries and do not execute them. The overview's coverage and source list must match what was actually read. Do not call coverage repository-wide if only a subset was inspected. If required coverage cannot be completed within the authorization, stop with a partial-coverage report and ask whether to narrow or accept the partial profile; do not present a full-coverage preview.

## Step 4 — Draft the project orientation profile

Draft `AgenticLab/PROJECT-OVERVIEW.md` with only useful, verified orientation material. Suggested structure:

```markdown
# Project Overview

- **Project:** [user-confirmed identity]
- **Oriented:** [date]
- **Coverage:** [areas inspected and important exclusions]

## Stack and workspace layout
[Languages/frameworks, packages/apps, concise directory map]

## Starting points and key flows
[Important entry points and a small number of useful source paths]

## Build and test approach
[Commands/configuration found in source; explicitly mark as inspected, not run]
[Known test-isolation or safety constraints, if verified]

## Known unknowns
[Material areas not inspected or facts needing confirmation]

Do not reference `wiki/index.md` here — the knowledge-system index is `AgenticLab/knowledge/INDEX.md` and should only be referenced if durable knowledge records exist.

## Sources
[Paths supporting the summary]
```

Do not set an arbitrary token limit; make it compact enough to be read in a fresh session. Do not copy scope rules into it as authority, duplicate decision rationale from records, or populate V4 persona memories, `SYSTEM_CORE.md`, DIGEST, Graphify, symbol/semantic indexes, or experience records. If a durable non-source-derived decision is uncovered, report it separately as a candidate for the future knowledge interface; do not save it here.

## Step 5 — Prepare local Pi wiring

Prepare `.pi/settings.json` by preserving all existing keys and adding only missing AgenticLab resources:

```json
{
  "extensions": ["../AgenticLab/adapters/pi/knowledge-write-gate.ts"],
  "prompts": [
    "../AgenticLab/prompts/system/initialize-workspace.md",
    "../AgenticLab/prompts/delivery/plan.md",
    "../AgenticLab/prompts/delivery/implement.md",
    "../AgenticLab/prompts/delivery/premortem.md"
  ]
}
```

When merging, preserve unrelated extensions/prompts/settings and do not duplicate the AgenticLab paths. If an existing value conflicts, is invalid, or cannot be safely merged, stop and show the conflict instead of replacing it.

Prepare `.pi/APPEND_SYSTEM.md` by preserving existing host content and adding a concise AgenticLab block equivalent to:

```markdown
For work in this workspace, read and follow `AgenticLab/AGENTS.md`.
Read `AgenticLab/PROJECT-SCOPE.md` before consequential work and stay within its boundaries.
If `AgenticLab/PROJECT-OVERVIEW.md` exists, read it once as fresh-session orientation; verify relevant facts against current source.
Do not create or modify a workspace-root `AGENTS.md` for AgenticLab.

**Knowledge retrieval trigger:** Before source inspection for design rationale, decision context, or reusable patterns:
1. Read `AgenticLab/knowledge/INDEX.md` as the stable workspace router when present; use it to identify scope, collections, and any curated topic maps. Do not expect an exhaustive record list or duplicated trigger-term list.
2. **Always** call `readKnowledgeRecords` before source inspection for each distinct topic, sub-question, or query — use an exact record `id` when known, otherwise a query. If the task establishes an explicit subproject scope or requests a category, pass the optional `scope` or `category` filter. The adapter inventories and filters active records recursively before returning selected bodies plus available source/evidence metadata. Do not use generic file reads to retrieve record bodies.
3. Only after the tool responds should you verify claims against current source. Treat `filtered`, `incomplete`, `unavailable`, and `no_knowledge_store` distinctly; only a complete `no_match`/`not_found` result supports a no-match claim. If there is a complete no-match, proceed to source inspection.

```

If either `.pi` file already contains equivalent AgenticLab guidance, leave it intact. Do not write global Pi settings/trust or host-root instruction files. Project `.pi` resources require project trust; do not claim they are active in the current process before a fresh trusted Pi process loads them.

**Write gate note:** Knowledge changes use the dedicated adapter lifecycle. `/plan` is read-only for application source; its final preview includes the exact transient checkpoint, including task-local handoff candidates, and user approval authorizes that one write. The write gate exempts only the exact `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` path to avoid a redundant second confirmation; no other knowledge write is covered by plan approval. `/implement` may write candidate state only through the staged lifecycle described in its prompt, with workspace opt-in and action-specific approvals. No host application paths are created during initialization.

## Step 5a — Prepare the knowledge navigation scaffold

After project scope is confirmed, prepare the following additive scaffold:

- If `AgenticLab/knowledge/INDEX.md` is absent, propose a new stable router using the confirmed workspace scope. It must identify `records/` as the canonical destination for newly promoted project records, explain that `readKnowledgeRecords` searches the active knowledge tree recursively (including legacy root-level active records during migration), state that a complete eligible-corpus scan—not map membership—is required for no-match, and include a note that topic maps may be added under `maps/` when a navigation need is established.
- If `AgenticLab/knowledge/INDEX.md` already exists, preserve it. If its stated scope conflicts with the confirmed scope or its routing is materially misleading, stop and show the conflict; do not silently replace it during initialization.
- If `AgenticLab/knowledge/records/` is absent, propose an empty directory scaffold with a zero-byte `AgenticLab/knowledge/records/.gitkeep` marker so the directory survives workspace copying. If it exists, preserve its contents.
- If `AgenticLab/knowledge/maps/` is absent, propose an empty directory scaffold with a zero-byte `AgenticLab/knowledge/maps/.gitkeep` marker so the directory survives workspace copying. If it exists, preserve its contents.
- If `AgenticLab/knowledge/MOC-template.md` is absent, propose a minimal blank MOC skeleton referencing `records/` as the collection. The template follows the structure defined in `AgenticLab/brain/knowledge-contract.md` (topic MOC/map template). It is a scaffold only — not a populated MOC.
- Do not list or copy active records, pending candidates, checkpoints, metrics, or user notes into the scaffold. Do not create MOCs until a real navigation need is established. This initialization step creates routing/structure only, not durable knowledge.

## Step 6 — Present one complete initialization preview

Use `metricsEnabled: false` unless the user explicitly requested privacy-minimized aggregate metrics in their setup answers. This safe default is not an approval to write; show the setting in the preview.

Prepare the exact contents for every setup file that needs to be created or updated. Show one complete preview in the conversation: identify each path and whether it will be created, updated, or preserved; include the full proposed contents for new files and the exact diff for updates. Confirm that the scope file contains only project identity, included areas, and explicitly permanent exclusions. End with this one short question: **“Approve these setup changes?”** Then stop and wait for the user's response; do not add another approval prompt. **Until the user explicitly approves that preview in a later message, do not call a tool or command that creates, changes, or deletes workspace files.** If the user requests a change, prepare and show the revised preview, then wait for approval again.

The setup preview may include only:

1. `AgenticLab/PROJECT-SCOPE.md`, containing project identity, included areas, and explicit permanent exclusions only. Explanations of temporary initialization limits belong in the conversation, not in this file.
2. `AgenticLab/PROJECT-OVERVIEW.md`, with bounded coverage, actually inspected project-source paths, and known uncertainties.
3. `.pi/settings.json` and `.pi/APPEND_SYSTEM.md`, preserving/merging existing unrelated settings as shown in the preview.
4. `AgenticLab/knowledge/INDEX.md` and, only when the records directory is absent, `AgenticLab/knowledge/records/.gitkeep` as a zero-byte marker. Preserve existing knowledge contents.
5. `AgenticLab/knowledge/maps/.gitkeep` as a zero-byte marker (only when the maps directory is absent). Preserve existing contents.
6. `AgenticLab/knowledge/MOC-template.md` as a minimal blank MOC skeleton (only when absent). The template follows the structure defined in `AgenticLab/brain/knowledge-contract.md`. It is a scaffold only — not a populated MOC.
7. `AgenticLab/config/knowledge-capture-policy.json`, rendered from the generic template with `schemaVersion: 1`, the confirmed `project` and matching `scope: project:<key>`, staging disabled, empty triggers, and metrics disabled unless the user explicitly opted in.

There must be no setup write before the user's explicit approval of the complete conversation preview. Do not treat answers to scope questions or optional configuration preferences as approval to write. Do not infer approval from silence, from the request to initialize, or from the user's review of a preview.

**Metrics:** The workspace capture policy lives at `AgenticLab/config/knowledge-capture-policy.json`; `.pi/settings.json` does not own this setting. Metrics default to `false`; enable them only if the user explicitly opted in during setup. This preference does not approve any file writes. The final preview must show the exact setting. Events go to `.pi/metrics/agenticlab.jsonl`; no raw user content is recorded.

After approval, create or update only the paths included in the approved preview. Preserve unrelated existing settings and all files omitted from the preview. If a write partially fails, stop and report exactly which approved paths completed; do not broaden the set. Do not create or modify active records, pending candidates, checkpoints, metrics, or MOCs. The INDEX and empty records marker are structural initialization artifacts, not knowledge records.

## Step 7 — Finish and activate Pi locally

Report exactly which files were created or merged and which were preserved. Tell the user to start a fresh Pi process from the workspace root and grant project trust when prompted. This restart activates the newly written `.pi` configuration; **it is not a request to read or run the initialization prompt again.** The initialization flow is now complete.

In the fresh trusted process, the project instructions should load normally. If an explicit smoke check is wanted, read `AgenticLab/PROJECT-SCOPE.md` and `AgenticLab/PROJECT-OVERVIEW.md` and report their key points; do not rescan the codebase or rerun initialization. Verify that:

- `.pi/APPEND_SYSTEM.md` instructions are active;
- the local knowledge-write extension is listed;
- `/initialize-workspace`, `/plan`, `/implement`, and `/premortem` are registered and available for explicit invocation; none was run automatically;
- `PROJECT-SCOPE.md` and the overview are directed to be read at fresh-session start; the scope contains only project identity, included areas, and explicit permanent exclusions, with no initialization-only restriction or task authorization matrix;
- `AgenticLab/knowledge/INDEX.md` exists as a scope-aware router and `AgenticLab/knowledge/records/` exists as an empty canonical destination unless preexisting content was preserved; if `AgenticLab/knowledge/maps/` exists, preserve its contents; if `AgenticLab/knowledge/MOC-template.md` exists, preserve its contents;
- `AgenticLab/config/knowledge-capture-policy.json` exists with `project` equal to the confirmed stable project key and `scope` equal to `project:<key>` in `PROJECT-SCOPE.md`, staging disabled, no unapproved project-specific triggers, and metrics off unless explicitly opted in;

**Enabling staging later:** If staging was disabled during init, enable it via the Pi runtime session with `pi "knowledge-opt-in"` (adapter command, not a CLI subcommand — do not run at shell); this sets `pendingStagingEnabled: true`.
- no active knowledge record or host application path was created or changed.

If `PROJECT-OVERVIEW.md` was just created, a bounded fresh-session read check verifies availability, not general delivery benefit.

## Later use

Ordinary sessions do not rerun this prompt. They read the confirmed scope and compact overview; task-specific persistent records remain selectively retrieved through the distinct AgenticLab knowledge interface. A later explicit `/initialize-workspace` invocation must detect the existing profile and stop unless the user specifically asks for a refresh. A refresh must show a source-bounded diff and require approval before updating setup/profile files.