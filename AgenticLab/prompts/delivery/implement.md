---
description: Execute an approved plan within its stated scope and verify the result
argument-hint: "[approved plan or task context]"
---

# V5 `/implement` Workflow — First Prototype

**Status:** Prompt prototype for design/testing; an initialized Pi workspace registers this template as opt-in `/implement`. Registration does not auto-run it; a separate user invocation with an approved plan is required.

## Purpose and authority

Execute an approved plan, not re-plan it. Invocation of this workflow with an approved plan explicitly authorizes changes listed in that plan and no others. A read-only boundary used only for initial orientation does not prohibit these approved changes. A scope boundary explicitly marked as permanent still applies; if it conflicts with the plan, stop and ask. This workflow does not authorize unrelated edits, protected-data access, external actions, or scope expansion. If the approved plan is absent, stale, or materially contradicted by current source, stop and ask.

The workflow may use only the task's authorized project scope and tools. Tests or commands must be named in the approved validation plan and confirmed safe for the selected environment. Do not access `.env`, production databases, or other protected data unless the user explicitly authorizes that exact scope.

## User-supplied task context

${@:-Use the approved plan already present in this conversation. If no approved plan and scope are present, ask for them and do not edit.}

### Plan checkpoint (transient)

**Minimal context selection** — Before proceeding, call `selectContextSources` with workload `implementation`, `currentSourceNeeded: true`, and `workflowInvoked: true`. It records a content-free `context_source_selected` event automatically. Set `approvedPlanPresent: true` only after the matching approved checkpoint is verified. Set `knowledgeRelevant` or `domainPerspectiveRelevant` only when that layer could materially improve the next action. Set `projectOrientationNeeded: true` when fresh-session startup guidance requires checking `AgenticLab/PROJECT-OVERVIEW.md`; this is distinct from operating instructions and project knowledge. Use the returned source list and do not load omitted layers by default; count project orientation as used only if the overview is present and read. User request and operating instructions are always retained. Apply the stop rule: assemble what is needed for the next decision or action; stop when sufficient to proceed and verify. If insufficient, retrieve relevant evidence or ask a focused clarification. When `selectContextSources` includes `project_knowledge`, call `readKnowledgeRecords` once per distinct topic/query before source inspection, passing scope/category filters when explicitly established; only a complete `no_match`/`not_found` result supports a no-match claim. If `project_knowledge` is omitted, skip retrieval and make no no-match claim. As soon as context assembly reaches a decision point, invoke `recordContextSelectionMetric` with the actual source-layer names used, an explicit stop-rule boolean (`true` if the stop rule fired, `false` if it did not), and an allowlisted assembly outcome (`complete`, `not_needed`, `no_match`, `filtered`, `incomplete`, `unavailable`, or `blocked`). Do this before proceeding and also before asking a clarification or reporting a retrieval blocker; use outcome `blocked` for that pause. The selector records `selected` separately; never use it as an assembly outcome. The adapter rejects unknown source names, missing stop-rule values, and free-form outcomes. Never include source text, queries, claims, or other content in metrics.

Before inspection, use Pi's `read` tool to read `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` at workspace root. If present and its `task` matches the current invocation, treat its contents as the approved plan. Do not use shell/bash commands to check for this file — the gate blocks shell access to project knowledge. If missing, stale, or mismatched, ask the user for the approved plan and do not edit. If the checkpoint contains `handoff_candidates`, treat them as transient proposals from the approved `/plan` session—not as persistent records or permission to stage/promote. Verify each candidate's claim/evidence against current source after the required `readKnowledgeRecords` call, then deduplicate against active knowledge and pending metadata. Do not treat pending candidates as active evidence. For task-local proposals, use status `candidate`; set scope exactly to the approved checkpoint's root scope when it matches the configured policy. Never guess scope from workspace name/title/path; stop on mismatch. Use `source.kind` from `file`, `conversation`, `artifact`, or `user-decision` to match actual provenance.

For each relevant task-local proposal not already pending, present two choices at the end-of-implementation review: `stage for review` or `leave task-local (not persisted)`. Ask the user to choose. Leaving it task-local does not delete or alter the checkpoint; its lifecycle follows the separately approved checkpoint disposition. The explicit choice to stage authorizes writing only that identified candidate to pending; it does not amend code scope, modify the checkpoint, or authorize promotion. If the user chooses staging while workspace opt-in is disabled, explain that the separate workspace opt-in is required and ask whether to enable it. Only after explicit yes, invoke the confirmation-gated `/knowledge-opt-in` command; if that confirmation is declined/unavailable, do not stage. Once opt-in succeeds, stage only the already-authorized candidate via `triageKnowledgeCandidates` and `stageKnowledgeCandidates`. If the user declines staging/opt-in, keep the candidate task-local and report it was not persisted. Do not silently discard a candidate or demand a general scope-file rewrite.

Staging leaves the candidate inactive in `knowledge-pending`; it is not promotion. After staging, preview the pending candidate, present `promote`, `reject/discard`, or `keep pending`, and ask for a disposition. Promotion/rejection requires the adapter's full action preview and explicit UI confirmation. If no handoff candidates or relevant pending candidates exist, skip this review; do not invent candidates.

### Completion report

At the end of this workflow, report clearly:
- **Implementation complete**: The approved plan's changes have been applied (or verified already present).
- **Validation**: Exact focused tests/checks run and their results; state anything blocked or not run.
- **Knowledge disposition**: Counts and IDs staged to `knowledge-pending`, promoted to active knowledge, rejected/discarded, or left task-local/pending; if none, say no candidates were proposed or relevant. Always check `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` for `handoff_candidates`—never infer silently. Summarize the relevant candidate IDs and dispositions; do not dump or repeat the full checkpoint JSON.
- **Metrics**: Relevant content-free event types/count changes, interpreted alongside tool outcomes; do not treat event counts alone as proof of complete retrieval.
- **Checkpoint disposition**: Initially report as pending the user's A/B choice; after the user answers, report whether it was retained for `/premortem` or deleted after explicit approval. Never infer a choice from silence or from no deletion request.

Do not delete `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` during this workflow. Deletion requires explicit user approval after implementation completion. This gate applies to every `/implement` invocation, including test-/validation-only runs and runs with no source-file changes. You may report the task's implementation or validation as complete, but the `/implement` workflow remains pending until the user explicitly chooses A or B; no answer leaves the checkpoint unchanged.

### End-of-implementation knowledge review and disposition

Run this review after implementation validation and before the completion report when the approved checkpoint contains handoff candidates, this implementation staged candidates, or a relevant existing pending candidate was identified during work. If none applies, skip the review; do not create ceremony for an empty queue.

1. Call `listPendingKnowledgeCandidates` to inventory metadata in the configured scope. Never read, grep, edit, or delete `knowledge-pending/` files directly.
2. Restrict full review to candidates linked to this task or materially relevant to its outcome. For a task-local handoff not yet pending, use its checkpoint content; call `readKnowledgeRecords` to check active-record overlap and use pending metadata to check for a duplicate. If staging was excluded from the approved implementation scope, show the candidate and ask whether the user authorizes a separate post-task staging action. This is not a PBI scope amendment and does not require another plan or checkpoint. If declined, leave it task-local. If approved and workspace staging opt-in is enabled, use `triageKnowledgeCandidates` and `stageKnowledgeCandidates` for that candidate only. Then use `previewPendingKnowledgeCandidate` for non-mutating full-content review. If retrieval is incomplete/unavailable, report that limitation and do not bypass it.
3. Present a concise disposition table with candidate ID, claim, scope, evidence/provenance, duplicate/active-record check, and a recommendation: `promote`, `reject/discard`, or `keep pending`. A recommendation is not authorization. If the evidence is insufficient or the candidate is a duplicate, recommend keeping pending or rejecting it; never promote merely to empty the queue.
4. Ask the user to select a disposition. Do not invoke `promoteKnowledgeCandidate` or `rejectPendingKnowledgeCandidate` just to inspect or recommend. Only after the user explicitly chooses an action, call the matching tool for that one candidate. Review its complete action preview and require its explicit UI confirmation; the chat choice authorizes the action but does not replace the UI confirmation. Declining leaves the candidate pending.
5. After each confirmed action, verify its result and relist pending metadata. For promotion, call `readKnowledgeRecords` by the promoted ID and confirm the active body/provenance are retrievable. For rejection, confirm only the selected candidate left pending and no active record was created. Stop on unexpected state or scope change.
6. INDEX/MOC updates are not automatic consequences of promotion. Propose them separately only when a genuine navigation relationship changes, and require separate approval.

This is an autonomous review/orchestration step, not autonomous activation: the agent gathers evidence and recommends dispositions; the user chooses; the existing per-action confirmation gate protects each durable write or discard. Do not persist raw queries or candidate contents in metrics/logs.

### User approval gate — checkpoint deletion

After reporting the implementation or validation result, always ask the user to choose one option, including for test-/validation-only runs and runs with no source-file changes:

> A) Are you planning to run /premortem? If so, plan-checkpoint.json will be kept for premortem reference.
> B) Not planning to run /premortem? I explicitly authorize deleting plan-checkpoint.json.

Do not infer A from silence or from “no deletion requested.” Until the user answers, leave the checkpoint unchanged and state that workflow disposition is pending. If A is chosen, retain it. If B is explicitly chosen, delete only then. After that disposition is handled, ask the separate implementation-log approval question; do not combine the two approval gates.

### Implementation-log auto-trigger

After implementation completes and checkpoint disposition is handled, the workflow will automatically request user approval to write the implementation-log:

1. Implementation completes successfully (or verification confirms existing implementation is complete)
2. Checkpoint disposition is resolved (kept for premortem reference, or deleted)
3. The workflow automatically generates the implementation-log summary based on:
   - Files changed during this implementation
   - Tests run (if any) and metrics outcomes (`no_match` counts, `candidate_staged` events, etc.)
   - Candidate disposition summary: staged to `knowledge-pending`, promoted to active, rejected/discarded, left pending, or none detected
   - Plan-checkpoint disposition (kept for premortem reference or deleted)
4. This approval is separate from checkpoint disposition and also applies to validation-only runs, even if no source files changed. The workflow then asks the user:
   > "Implementation/validation complete. Do you approve writing the implementation-log?"
   > [Yes/No]
5. If the user approves:
   - The implementation-log is written to `AgenticLab/implementation-logs/<workspace-key>/<pbi-id-slug>/implementation-log.md` directly from the `/implement` session state with user approval
   - No snapshot file is written or consumed — the log is written directly
   - The workflow completes successfully
6. If the user declines:
   - No implementation-log is written
   - The workflow completes successfully without writing the log
   - The implementation remains complete and verified

**Note:** This is an automated process with an explicit user approval gate. No additional prompts are required beyond this single approval step.
