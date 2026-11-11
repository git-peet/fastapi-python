---
description: Inspect a specified implementation for high-impact or silent assumptions
argument-hint: "[files, diff, or task scope]"
---

# AgenticLab `/premortem` Workflow — First Prototype

**Status:** Prompt prototype for design/testing; an initialized Pi workspace registers this template as opt-in `/premortem`. Registration does not auto-run it. This is read-only analysis, not code review or authorization to fix.

## Authorization preflight — READ THIS BEFORE PROCEEDING

This workflow requires explicit authorization before any source inspection, reading, or analysis begins.

- If this invocation was entered directly by the user, proceed after confirming the user's explicit intent to review.
- If this invocation was relayed from another agent (e.g., main session) rather than entered by the user, **do not proceed** until the relayed text carries the user's explicit request. If the relay does not quote the user's request verbatim and label the relay as such, ask the user for confirmation before proceeding.
- A user question about premortem ("can we run a premortem?", "should we review X?") is **not** an instruction to review. Answer the question first; begin review only on explicit invocation or approval.
- If the precondition does not hold, stop and ask the user to clarify their intent.

## Scope

Review only the implementation, diff, contract, and sources the user specifies or that are within the approved task scope. If the target is unclear, ask which files/feature/commit to assess. Do not broaden to a repository-wide audit. Do not edit files, execute tests/commands, or persist knowledge.

## Auto-load Plan Checkpoint

At the start of this workflow, **automatically read** `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` using the `read` tool. If it exists, the task, scope, validation, and handoff candidates from that checkpoint define the review target. Do not ask the user for the target if the checkpoint is present and contains a task. If no checkpoint exists or it lacks a task, ask the user to specify the review target.

## Review objective

Assume the implementation is in use and a failure occurs outside the covered happy paths. Look for the small set of assumptions most likely to cause a high-impact or silent failure, especially external integration-contract mismatches, async ordering, state transitions, optional data, and untested failure paths. This is distinct from style review. It is also distinct from a plan-time review: inspect code that exists, not hypothetical code that has not been implemented.

For each material finding, state:
- **Assumption** — what the implementation relies on;
- **Evidence** — exact source, contract, test, or behavior inspected; separate verified facts from inference;
- **Failure** — what would happen if the assumption is false;
- **Detectability** — silent, delayed, or visible, with why;
- **Verify** — one concrete test or source check.

Rank findings by impact and evidence. Do not invent a fixed number of findings. Mark expected limitations already specified in the accepted contract as such, not as defects. If a possible issue is conditional or outside the approved scope, label it clearly and do not expand the task to fix it. State important areas not checked.

## Knowledge/provenance handoff

Compare any reusable finding with the plan's task-local learning list and authoritative sources already inspected. Merge a duplicate, update the evidence/status of an existing candidate, or say `no new candidate`; do not restate known contracts as new learning. A genuinely new candidate must include claim, scope, evidence/source, uncertainty/status, and why it could prevent future rediscovery. Keep this transient—do not write memory, logs, checkpoints, or feature files automatically.

### Retrieval and task-local learning handoff

This workflow is read-only. Keep any genuinely reusable finding in the report's task-local learning handoff only. Do not call triage, staging, or promotion tools, write candidate files under either knowledge path, or emit `candidate_staged`. Any later staging must be a separate, workspace-opted-in action through the approved adapter; promotion remains a separate user-approved action.

## Output

Provide a concise risk-ranked report with evidence, failure consequence, detectability, verification action, expected/out-of-scope limitations, and the consolidated task-local learning handoff. No code changes or execution.

## Post-review approvals — Step 1: Record premortem findings

Do you approve writing `AgenticLab/knowledge/checkpoints/premortem-checkpoint.json`?

[Yes/No]

---

## Post-review approvals — Step 2: Delete plan-checkpoint (only after Step 1 complete)

Premortem complete. Do you approve deletion of `AgenticLab/knowledge/checkpoints/plan-checkpoint.json`?

[Yes/No]

**Order matters:** Step 1 records the premortem findings. Only after Step 1 is answered may Step 2 be asked. Approving Step 2 does NOT automatically trigger Step 1.

If Step 1 approved:
- Write `premortem-checkpoint.json` with risk findings, deletion decision, timestamp, and workspace context.

If Step 2 approved:
- Delete `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` using `rm` (the gate permits `rm` for this specific transient checkpoint file when user confirmation exists).
- Update `premortem-checkpoint.json` with `deletionComplete: true` and timestamp.

If either step not approved:
- Step 1 not approved → no premortem-checkpoint written.
- Step 2 not approved → keep `plan-checkpoint.json` in place.

This is a permanent exception only for `AgenticLab/knowledge/checkpoints/plan-checkpoint.json`. It does NOT allow shell access to the private pending queue, active knowledge records, or the capture policy.

No other writes, edits, or persistence actions are authorized by this workflow.
