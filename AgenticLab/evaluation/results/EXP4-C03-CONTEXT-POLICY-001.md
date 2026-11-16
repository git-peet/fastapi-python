# EXP4-C03-CONTEXT-POLICY-001 — Context-source policy calibration

- **Status:** Fresh-Pi selector/guard smoke and validation-only PBI2 plan/implement run complete; implementation gates resolved
- **Prepared:** 2026-11-11T12:39:47+01:00
- **Updated:** 2026-11-13T17:19:13+01:00
- **Workspace:** `/home/peet/Projects/exp4/`
- **Scope:** exp4 `/plan` and `/implement` context-selection prototype only; default-work guidance is deferred
- **Privacy:** This report contains summarized observations only. It does not copy prompts, transcripts, source text, queries, claims, or raw metric values.

## Objective

Check whether the context-source policy selects proportionate layers in real Pi planning/implementation flows, whether the agent follows the selected policy, and whether the content-free metrics are emitted.

## Metrics baseline

Captured before the synthetic runs at **2026-11-11T12:24:07+01:00** from `exp4/.pi/metrics/agenticlab.jsonl`:

- Metrics enabled: `true`
- Rows: `121`; malformed rows: `0`
- Existing context events: `context_source_used=3`, `context_assembly_complete=3`, `context_stop_rule_triggered=1` (`true`)
- Latest event timestamp: `2026-11-10T14:58:42.646Z`
- Existing log contained 22 source values and 3 outcomes outside the new allowlists. Their raw values were not printed or copied; treat them as potentially free-form legacy values.

A sanitized aggregate check after both task-1 attempts found the same row count, context-event counts, and latest timestamp: **no metric delta was recorded**.

## Synthetic task 1 — copy-only Conversations page-title plan

The task intentionally left the replacement copy unspecified and did not say whether “page title” meant the on-page heading, browser-tab title, or both.

### Attempt A — `/plan` invoked before supplying task context

- **Selection/tool evidence:** No `selectContextSources` invocation appeared in the supplied output.
- **Observed behavior:** The agent used broad shell search across the workspace before establishing a policy selection. It did not call `readKnowledgeRecords` or the context-metric recorder.
- **Outcome:** No metric delta; no files or checkpoint changed.

### Attempt B — `/plan` invoked with task context

- **Policy selection:** `selectContextSources` ran before inspection and returned `user_request`, `operating_instructions`, `current_source`, and `workflow_prompt`. It omitted `project_knowledge` and `domain_perspective`, proportionate for this copy-only task.
- **Actual inspection:** The agent used `ls`, `find`, and `grep` during `/plan`, despite the planning-only workflow boundary prohibiting command execution. It did not call `readKnowledgeRecords`; no no-match claim was made.
- **Metrics:** `recordContextSelectionMetric` was not called. No context events were emitted for this attempt.
- **Clarification:** The agent correctly stopped because the replacement text was unspecified. The question should also distinguish the on-page heading from the browser-tab metadata title.
- **Outcome:** Selection decision passed; workflow-boundary compliance and metrics capture failed. No files or checkpoint changed.

## Synthetic task 2 — backend isolated-database test plan

- **Policy/retrieval result:** The supplied plan reports one applicable active procedure record (`isolated-api-test-db-override`, scope `project:exp4`) and other results filtered by scope or status. Retrieval was reported complete.
- **Context metrics:** The live JSONL aggregate increased from 121 to 125 rows: `retrieval_success` +1, `context_source_used` +1, `context_stop_rule_triggered` +1 (`true`), and `context_assembly_complete` +1. The new source event contains one occurrence each of `user_request`, `operating_instructions`, `current_source`, `project_knowledge`, and `workflow_prompt`; the new assembly outcome is `complete`. No new unallowlisted source or outcome values were observed.
- **Execution boundary:** The plan reports no shell commands or tests; no file or checkpoint write is reported.
- **Evidence limitation:** The supplied final plan does not show the actual `selectContextSources` tool result or retrieval call arguments. The metrics confirm the recorded source layers and a successful retrieval event, but not the exact tool-call sequence or the requested scope argument independently.
- **Outcome:** Knowledge inclusion and content-free event recording worked in this completed planning run. The recorded source selection is proportionate to the task.

## Synthetic implementation run — task 2 checkpoint

- **Implementation:** The Pi completion report says it added `test_api_requests_use_isolated_test_database` in `backend/tests/api/routes/test_items.py`. This is a real backend test-file change under the approved task-2 plan, not a C03-only no-source-change run.
- **Validation:** The report says `backend/scripts/test-isolated.sh` ran the focused module with a fresh disposable SQLite database: 20 passed, one Starlette deprecation warning. The report says the runner uses an unusable application `DATABASE_URL`, making a missing override fail closed. This result is from the Pi report; it was not independently rerun here.
- **Metrics:** The JSONL aggregate increased from 125 after task-2 planning to 129 rows. Deltas: `retrieval_success` +1, `context_source_used` +1, `context_stop_rule_triggered` +1 (`true`), and `context_assembly_complete` +1 (`complete`). The actual source-layer counts each increased by one for `user_request`, `operating_instructions`, `current_source`, `project_knowledge`, and `workflow_prompt`. No new unallowlisted source/outcome values appeared; no `candidate_staged` event was added.
- **Knowledge:** The completion report says the checkpoint had no handoff candidates and no knowledge records changed.
- **Checkpoint:** Retained pending the user's explicit choice to keep it for `/premortem` or authorize deletion. No checkpoint read or deletion was performed here.

## Synthetic task 3 — fully specified low-knowledge plan

- **Selection/actual sources:** The supplied plan reports only the copy change in the page source. The live metric records add one each for `user_request`, `operating_instructions`, `current_source`, and `workflow_prompt`; there is no additional `project_knowledge` value.
- **Metrics:** The aggregate increased from 129 to 132 rows: `context_source_used` +1, `context_stop_rule_triggered` +1 (`true`), and `context_assembly_complete` +1 (`complete`). No retrieval event or new unallowlisted value was added.
- **Execution boundary:** The supplied output reports no commands or tests. No file or checkpoint write was reported.
- **Outcome:** Low-knowledge selection and metric recording passed on a completed plan path. The task was fully specified, so the clarification-path gap from task 1B was not exercised again.

## Synthetic task 4 — fresh-Pi shell-guard and metrics smoke

- **Extension/guard:** Fresh Pi listed `knowledge-write-gate.ts`; the selector ran. The intentional `printf` shell attempt was blocked before execution, with no marker output. The task proceeded via reads and produced the plan; no edits, tests, retrieval, or checkpoint write were reported.
- **Metrics:** Aggregate increased from 132 to 136 rows: `context_source_selected`, `context_source_used`, `context_stop_rule_triggered=true`, and `context_assembly_complete=complete` each increased by one. No retrieval event was added. The selected and used source lists contained `user_request`, `operating_instructions`, `current_source`, and `workflow_prompt`.
- **Source-accounting discrepancy:** `AgenticLab/PROJECT-OVERVIEW.md` exists and the agent reports reading it, but neither the selected nor actual-used metrics contain `project_orientation`. The current selector had no planning/implementation input to include that layer; at this stage it only auto-included it for bootstrap.
- **Outcome:** Live shell blocking and content-free metrics passed. Orientation-source accounting failed to reflect the overview read.

## Assessment

1. The selector produced proportionate low-knowledge selections in tasks 1B and 3; task 2 included project knowledge when relevant.
2. Task 2 retrieved an applicable active procedure and filtered other records; its completed planning path recorded content-free metrics.
3. The task-2 `/implement` report and metric deltas show that the implementation flow also recorded context sources, a fired stop rule, and a completed assembly. It changed an application test file and validated it with the isolated runner.
4. Task 1B stopped for clarification and emitted no events. Metrics on blocked/clarification exits remain unverified and were absent in that run.
5. Task 1B violated `/plan`'s no-command boundary, while task 4's live Pi guard blocked a shell attempt before execution. Guard behavior now has both fake-Pi tests and one live smoke result.
6. Task 4 revealed under-reporting of `project_orientation`: the overview was read but omitted from selection/use metrics.

## Calibration decision

For these narrow plan/implement paths, the mechanism has positive evidence: the selector omitted knowledge when it was unlikely to help, included it when relevant, retrieval filtered records, and completed paths emitted allowlisted content-free metrics. This is not evidence of robust policy enforcement across all prompts or workloads. The two known gaps were clarification-path metric capture and the non-blocking shell boundary observed in task 1B. Default-work instructions remain phase two. The backend test change and C03 prototype changes remain local and uncommitted. The checkpoint is absent from the working tree following the `/implement` disposition flow.

## Local calibration follow-up

- Added the content-free `context_source_selected` event when `selectContextSources` runs, separate from actual source-use/assembly metrics.
- Updated `/plan` and `/implement` instructions to record actual source use with outcome `blocked` before pausing for clarification or retrieval blockage.
- Added a `/plan`-scoped shell guard for Pi `bash` and `user_bash` calls, with `/plan-cancel` as an explicit recovery command. Reads and registered context tools remain available; `/implement` and default work are not guarded.
- Regression coverage now includes blocked-outcome metrics, selector event recording (including metrics-storage failure), plan/clarification state transitions, shell blocking, and unaffected reads/workflow switches.
- Validation before orientation follow-up: 16 Node tests passed; edited `.mjs` files passed `node --check`; `git diff --check` passed. A fresh Pi smoke then verified extension loading, selector/recorder operation, and blocked shell execution.
- Orientation follow-up: added `projectOrientationNeeded` to the selector and Pi tool; `/plan` and `/implement` now set it when fresh-session guidance requires checking the project overview. Bootstrap still includes the layer automatically. Regression tests cover explicit inclusion, omission, and bootstrap inclusion.
- Validation after orientation follow-up: 18 Node tests passed; edited `.mjs` files passed `node --check`; `git diff --check` passed. A fresh Pi smoke confirmed orientation selection, actual source metrics, and the approval gates.
- Unit tests used temporary workspaces; no metrics were emitted to exp4's live `.pi/metrics/agenticlab.jsonl` by those tests.

## PBI2 validation-only plan/implement run — final gate check

- **Validation:** The fresh Pi `/implement` run reported 22/22 Conversation CRUD API tests passed via `backend/scripts/test-isolated.sh` with a fresh disposable SQLite database; it reported cleanup on exit and no source/configuration changes.
- **Knowledge:** No handoff candidates; no knowledge records changed. The approved checkpoint was deleted only after the user's explicit B disposition. The user declined the separate implementation-log write.
- **Metrics:** The live JSONL snapshot was 164 rows. The plan and implementation phases emitted selected/used source events, stop-rule evaluations (`true` during plan, `false` during implementation), and `context_assembly_complete` with `complete` outcomes. A retrieval-success event was recorded for the relevant PBI2 context. The implementation used `approved_plan` context.
- **Source-attribution note:** The plan's selected-source event included `project_orientation`, while its actual-used event did not, despite the plan report saying the overview was read. The implementation-phase selected/used lists aligned. This may reflect whether the overview materially informed the plan; keep it as an attribution question rather than a retrieval or test failure.
- **Gate result:** The fresh Pi flow asked A/B, waited for the explicit checkpoint choice, then separately asked about the implementation log. Both were resolved as intended.

## Workflow findings — first marked PBI7 plan run

- `EXP4-C03-PBI7-001` marked a real PBI7 `/plan` and `/implement` run. The first plan required mid-flow corrections: the marker was not carried into the plan from the PBI entry, scope conflicted with outcome, one frontend route path was incorrect, validation commands were not source-verified, and open design choices were presented as closed.
- The user supplied targeted correction guidance mid-run; planning stayed read-only and no checkpoint was written during the first approval gate.
- Recorded as a qualitative workflow finding only; metrics content-free.

## Opt-in C03 evaluation card format

A card is created only for a real plan/implement task whose user context contains a unique `C03-EVAL-ID`. It is appended after implementation validation and the approved workflow gates; no card is emitted for unmarked tasks.

```markdown
### C03-EVAL-ID: <stable-run-id>
- Date / task: <date, PBI or task ID>
- Workflow phases: <plan, implement, or both>
- Checkpoint/log decisions: <kept or deleted; implementation-log approved or declined>
- Selected sources: <source-layer IDs>
- Actually used sources: <source-layer IDs>
- Retrieval: <status, complete flag, match/filter counts, or not_requested>
- Stop rule / assembly: <true|false|unknown; outcome>
- Validation: <named check and pass/fail/count, or not_run>
- Handoffs: <none or counts/dispositions only>
- Clarifications / approvals / blocked actions: <counts, separated by type>
- Q1 source usefulness: <yes|partial|no|unclear> — <brief content-free reason>
- Q2 missing or irrelevant context: <none|missing|irrelevant|mixed|unclear>
- Q3 cheaper derivation from current source: <yes|no|unclear>
- Q4 handoff traceable/non-duplicate: <pass|fail|none|unclear>
- Q5 interruptions: <counts and required/unnecessary/unclear assessment>
```

Use current workflow tool results and metric arguments; never read or copy raw JSONL records into the card. Do not include prompts, transcripts, source text, queries, claims, secrets, or customer data. Mark unavailable evidence as `unclear`/`unknown`; do not infer. `C03-EVAL-ID` authorizes only this one sanitized evaluation-card append in the approved plan scope.

<!-- C03-EVAL-CARDS -->

### C03-EVAL-ID: EXP4-C03-PBI7-001
- Date / task: 2026-11-16, PBI 7 — owner-scoped conversation search and pagination
- Workflow phases: plan and implement
- Checkpoint/log decisions: deleted after explicit B approval; implementation log approved and written
- Selected sources: `user_request`, `operating_instructions`, `current_source`, `project_knowledge`, `project_orientation`, `workflow_prompt`, `approved_plan`, `task_local_handoff`
- Actually used sources: `user_request`, `operating_instructions`, `current_source`, `project_knowledge`, `project_orientation`, `workflow_prompt`, `approved_plan`, `task_local_handoff` (phase metrics varied; listed as aggregate)
- Retrieval: filtered; complete; the task-local risk candidate exact-ID check returned 0 matches and 17 filtered records
- Stop rule / assembly: true; plan assembly complete; implementation assemblies complete/filtered
- Validation: backend isolated API tests 30 passed; focused non-writing Biome check passed; TypeScript check failed on existing auth-hook type errors in the detail route; Playwright not run
- Handoffs: 1 proposed; 0 staged/promoted/rejected; 1 remains task-local pending user choice
- Clarifications / approvals / blocked actions: clarifications 0; required approvals 4; unexpected/blocked validation interruption 1
- Q1 source usefulness: yes — source and scoped knowledge informed implementation and isolated validation
- Q2 missing or irrelevant context: mixed — safe, environment-isolated UI test path unavailable; existing unrelated type errors surfaced
- Q3 cheaper derivation from current source: yes — primary feature contracts were available in current source
- Q4 handoff traceable/non-duplicate: unclear — provenance is traceable; filtered retrieval limits duplicate certainty
- Q5 interruptions: clarification 0; required approvals 4; unexpected/repeated interruptions 1

