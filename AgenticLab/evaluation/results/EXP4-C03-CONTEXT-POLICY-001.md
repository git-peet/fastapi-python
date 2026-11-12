# EXP4-C03-CONTEXT-POLICY-001 — Context-source policy calibration

- **Status:** Fresh-Pi smoke complete; orientation-layer follow-up implemented and unit-tested; fresh-Pi verification of that follow-up pending
- **Prepared:** 2026-11-11T12:39:47+01:00
- **Updated:** 2026-11-12T07:19:34+01:00
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
- Validation after orientation follow-up: 17 Node tests passed; edited `.mjs` files passed `node --check`; `git diff --check` passed. A fresh Pi smoke is still needed to verify the new signal end-to-end.
- Unit tests used temporary workspaces; no metrics were emitted to exp4's live `.pi/metrics/agenticlab.jsonl` by those tests.
