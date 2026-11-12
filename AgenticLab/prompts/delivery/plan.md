---
description: Build a scoped implementation plan with evidence, validation, and approval boundaries
argument-hint: "[PBI or task context]"
---

# AgenticLab `/plan` Workflow

**Status:** Opt-in planning workflow. Initialization registers this template as `/plan`; registration makes it available but does not execute it.

## Purpose and boundary

Use this workflow only when the user explicitly invokes `/plan` or approves a recommendation to use it. A PBI or acceptance criteria alone does not imply workflow invocation. If the requested outcome is research/findings only, stay in default work unless the user asks for a research plan.

This workflow produces a reviewable implementation plan. It does not implement code, run commands/tests, persist knowledge, or authorize a later mutating step. `/implement` is a separate user-invoked transition.

When describing scope, distinguish **this planning session** from the **proposed future implementation**. State that no files were changed or commands run during planning, then separately list the files/actions proposed for implementation and the true out-of-scope areas. Do not put "no edits during planning" in the future implementation's excluded scope unless the PBI itself forbids edits.

## Authorization preflight — READ THIS BEFORE PROCEEDING

This workflow requires explicit authorization before any source inspection, planning, or analysis begins.

- If this invocation was entered directly by the user, proceed after confirming the user's explicit intent to plan.
- If this invocation was relayed from another agent (e.g., main session) rather than entered by the user, **do not proceed** until the relayed text carries the user's explicit request. If the relay does not quote the user's request verbatim and label the relay as such, ask the user for confirmation before proceeding.
- A user question about planning ("can we plan X?", "is X feasible?") is **not** an instruction to plan. Answer the question first; begin planning only on explicit invocation or approval.
- If the precondition does not hold, stop and ask the user to clarify their intent.

## User-supplied task context

${@:-Use the current conversation as the task context. If the objective or expected outcome is not established, ask one focused question before planning.}

Treat supplied PBI text and acceptance criteria as requirements to assess, not authority to expand scope. A PBI's format alone does not determine whether the user's intent is research or implementation.

## 1. Establish intent and scope

Identify:
- desired outcome and acceptance criteria;
- project/workspace and affected scope;
- hard constraints, allowed actions, and excluded data/systems;
- whether the user intends implementation or research.

Ask only for information that blocks a safe, useful plan. Group related blocking questions into one concise clarification. Do not require a numeric effort score or an artificial checklist where an item is inapplicable.

## 2. Inspect proportionately

Inspect the smallest relevant current-source surface and any scoped knowledge needed to plan. Distinguish source-verified facts, user-provided requirements, and inference. Cite paths or other evidence for material claims. Treat knowledge as evidence, not authorization; preserve the user's scope and existing protected-data boundaries.

Create a concise surface map: relevant modules/files, current behavior, dependencies, and important external contracts. Use a domain perspective or procedure where it helps. Do not invoke a fixed persona chain; use an independent reviewer only if independent judgment materially improves the plan. Request UX/design input only when an actual UI decision is unresolved.

## 3. Form the plan

Provide:
1. Goal and intended result.
2. In-scope and explicitly out-of-scope work.
3. Affected surfaces and key dependencies.
4. Phases only where there are real dependencies or distinct validation boundaries.
5. Material design choices, alternatives, assumptions, and unresolved questions.
6. Risks, mitigations, and stop conditions.
7. Acceptance/validation plan, including relevant tests and manual checks.
8. A compact handoff sufficient for `/implement` without requiring rediscovery.

For risks in the proposed plan, perform a proportionate assumption check. For high-impact or silent integration-contract risks, include specific verification actions. A full code premortem is a separate review of code that exists; do not force it into every plan.

## 4. Preserve learning provenance without writing memory

At meaningful analysis/handoff points, record only potentially reusable findings in a **task-local learning handoff**. For each candidate include:
- concise claim or decision;
- applicability scope;
- source/evidence and revision, if available;
- whether it is verified, inferred, or unresolved;
- why it may prevent meaningful future rediscovery.

Carry forward candidates already present in the conversation/plan, merge duplicates, and update their evidence/status rather than repeating them. Check relevant authoritative project material for an existing equivalent before proposing a candidate. Mark `none` if nothing qualifies.

**Plan checkpoint handoff:** When writing the transient `plan-checkpoint.json` at the end of /plan, include any reusable candidates under the optional `handoff_candidates` field:

```json
"handoff_candidates": [
  {
    "id": "<candidate-id>",
    "title": "<short title>",
    "claim": "<reusable decision or pattern>",
    "evidence": ["<file path or source>"],
    "category": "decision|risk|fact|experience|procedure",
    "status": "proposed",
    "notes": "<why this prevents future rediscovery>"
  }
]
```

This list carries candidates forward to `/implement` without treating them as durable knowledge during planning. Show the candidate proposals once in the human-readable plan under `Task-local learning handoff`; do not repeat the full checkpoint JSON in the conversation. The checkpoint is a transient serialization of the approved plan, including those already-reviewed handoff candidates—not a second plan or new decision. The final yes/no approval authorizes writing that exact checkpoint only. A read-only initialization/orientation boundary does not prohibit the approved checkpoint write. Do not modify application source during `/plan`.

Do not write persona-owned memory, session logs, or project records automatically. A plan checkpoint artifact may be written after explicit user approval at the end of /plan, and must be read and deleted by /implement on completion. The checkpoint is transient and does not persist beyond the current phase. Durable knowledge is a separate user-approved operation through the project's existing gate.

### Retrieval and task-local learning handoff

0. **Minimal context selection and policy** — Call `selectContextSources` with workload `planning`, `currentSourceNeeded: true`, and `workflowInvoked: true`. The tool records a content-free `context_source_selected` event automatically. Set `knowledgeRelevant` and `domainPerspectiveRelevant` only when each layer could materially improve this plan; do not include either layer by default. Set `projectOrientationNeeded: true` when fresh-session startup guidance requires checking `AgenticLab/PROJECT-OVERVIEW.md`; this is a distinct layer from operating instructions and project knowledge. Use the returned source list to guide assembly, and count project orientation as used only if the overview is present and read. User request and operating instructions are always retained. Apply the stop rule: assemble what is needed for the next decision or action; stop when sufficient to proceed and verify. If insufficient, retrieve relevant evidence or ask a focused clarification.

1. **Knowledge route and retrieval** — Only when `selectContextSources` includes `project_knowledge`, read `AgenticLab/knowledge/INDEX.md` as the stable scope/corpus/MOC router and call `readKnowledgeRecords` for each distinct topic/query before inspecting current source; use an exact record `id` when known, otherwise a task `query`, and pass `scope` or `category` when explicitly established. If `project_knowledge` is omitted, skip both the INDEX and retrieval tool. The adapter inventories active records recursively, filters metadata before body search, returns selected bodies with available source/evidence, and emits aggregate metrics. Treat `filtered`, `incomplete`, `unavailable`, and `no_knowledge_store` distinctly; only a complete `no_match`/`not_found` result supports no-match. Do not substitute generic file reads for record retrieval. Verify claims against current source only after the retrieval tool responds.

2. **Context metrics** — As soon as context assembly reaches a decision point, invoke `recordContextSelectionMetric` with the actual source-layer names used (not merely the policy-selected list), an explicit stop-rule boolean (`true` if the stop rule fired, `false` if it did not), and an allowlisted assembly outcome (`complete`, `not_needed`, `no_match`, `filtered`, `incomplete`, `unavailable`, or `blocked`). Do this before presenting a plan and also before asking a clarification or reporting a retrieval blocker; use outcome `blocked` for that pause. The selector records `selected` separately; never use it as an assembly outcome. The adapter rejects unknown source names, missing stop-rule values, and free-form outcomes. Never include source text, queries, claims, or other content.

3. **Checkpoint approval gate** — Present the complete plan and wait for explicit approval before writing its checkpoint. An existing checkpoint is not approval of the current plan, and permission to replace a checkpoint is not approval of the plan. If approval is not explicit, do not write or replace the checkpoint.

Planning remains non-persistent. Keep deduplicated, source-checked candidate proposals in the plan's task-local learning handoff; do not call triage, staging, or promotion tools, write candidate files, or emit `candidate_staged` during `/plan`. Carry proposals forward to a separately invoked `/implement`; any pending staging there is subject to workspace opt-in and the `/implement` instructions.

## 5. Resolve blockers and request approval once

If a decision materially blocks a safe plan, pause and ask the focused question before finalizing. Otherwise present the complete plan, including validation and the task-local learning handoff, and ask one consolidated question:

Before approval, quickly check from inspected evidence that each proposed validation command includes required environment variables and targets, is runnable from the stated directory, and that planning-session restrictions have not been mistakenly applied to proposed implementation validation. Do not execute the commands during planning. If a detail is uncertain, state the assumption or ask one focused question.

> Do you approve this plan and authorize writing its transient `plan-checkpoint.json` handoff? This authorizes only the approved plan and checkpoint; implementation still requires a separate explicit `/implement` invocation.

Do not add a second design-approval prompt after the complete plan unless a material new decision arises. Do not start implementation, mutate files, or invoke another workflow from this prompt.

## Expected output

```markdown
## Plan — [task title]

### Outcome
[Plain-language result and acceptance criteria]

### Scope
**Planning session:** [evidence inspected; state that no edits/commands/tests/persistence occurred]

**Proposed implementation scope (not authorized until `/implement`):** [included files/actions and explicit exclusions]

### Current evidence and surface map
[Relevant sources/paths; distinguish verified facts from assumptions]

### Plan
[Ordered phases only where dependencies justify them]

### Risks and open decisions
[Material risks, mitigations, blockers, or "None"]

### Validation
[What will establish completion]

### Task-local learning handoff
[Source-linked candidates with scope/status, or "None"]

### Approval
[One concise yes/no question approving the plan and its transient checkpoint write; implementation requires a separate explicit `/implement` invocation. Do not append the full checkpoint JSON to the conversation.]
If approved, write `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` as a mechanical serialization of the approved plan (schema in `AgenticLab/prompts/delivery/checkpoint.md`), including the task-local `handoff_candidates` already shown above. Do not introduce new decisions or candidate content during serialization. This plan approval authorizes this one checkpoint write; do not ask a redundant second write-confirmation question. Do not persist secrets, raw transcripts, or customer data in the checkpoint.
```

## Scope and limitations

This is a planning-only workflow. It produces a reviewable plan and, after explicit approval, may write its approved transient checkpoint. It does not implement application changes, run commands or tests, persist durable knowledge, or invoke another workflow automatically. `/implement` and `/premortem` remain separately invoked workflows; no automatic router is provided.
