# Implementation Log

## Task
PBI 3 — Add synchronous conversation triage

## Implementation Period
Started: 2026-11-07  
Completed: 2026-11-07  
Status: Complete; implementation log approved by user

## Summary
Added synchronous, authenticated conversation triage using a deterministic fake client only. The service parses and validates the client's JSON against a bounded Pydantic/SQLModel result contract before persistence. The endpoint is owner-only, successful retriage replaces the most recent result, and failed attempts leave a previous valid result unchanged. No live provider/model call, credentials, paid request, or frontend UI was added.

## Files Changed

### Backend contract and persistence
- **backend/app/models.py**: Added `ConversationIntent`, `ConversationSentiment`, `ConversationNextAction`, and `ConversationTriageResult`. The summary is limited to 500 characters. Added nullable result columns and `triaged_at` to `Conversation`, exposed the triage result/timestamp in `ConversationPublic`, and added a table check constraint requiring all triage fields to be either all null or all populated.
- **backend/app/alembic/versions/d34f8c91a2b7_add_conversation_triage.py**: Added nullable triage result and timestamp columns plus the all-or-none check constraint. The revision follows `828e4a07b99e`.

### Fake client, service, and route
- **backend/app/services/__init__.py**: Added the service package.
- **backend/app/services/triage.py**: Added the synchronous `TriageClient` protocol, deterministic `FakeTriageClient`, raw-JSON parsing and schema validation, and safe client/timeout/invalid-result exceptions. No retry is performed. The fake accepts the transcript to match the interface but does not inspect, include, or log it.
- **backend/app/api/routes/conversations.py**: Added owner-only `POST /api/v1/conversations/{id}/triage`, using FastAPI dependency injection for the fake client. It persists only a fully validated result; timeout and other client/result failures return generic safe errors. It does not overwrite a previous result on failure. A changed transcript clears triage; title-only and unchanged-transcript updates preserve it.

### Tests and learning documentation
- **backend/tests/test_triage_service.py**: Added tests for valid output, malformed JSON, missing fields, invalid enum values, empty/oversized summary, deterministic fake behavior, timeout, client errors, and zero retries.
- **backend/tests/api/routes/test_conversations.py**: Added API tests for successful persistence, replacement on retriage, failure preserving existing data, timeout mapping, owner isolation, transcript-edit invalidation, title/unchanged-transcript preservation, and invalid partial-result rejection.
- **docs/PBI3 implementation tour.md**: Added a beginner-oriented guide to the contract, Protocol/client boundary, service validation, persistence, endpoint flow, tests, and scope limits.

## Approved Contract and Behavior
- Summary: non-empty, maximum 500 characters.
- Intent values: `question`, `request`, `complaint`, `feedback`, `other`.
- Sentiment values: `positive`, `neutral`, `negative`.
- Next-action values: `respond`, `ask_clarifying_question`, `investigate`, `escalate`, `no_action`.
- The default implementation uses deterministic fake output; no live provider is configured.
- Successful subsequent triage replaces the stored result. Failed triage preserves the last valid result and timestamp.
- The initial retry count is zero.
- All conversation triage access is owner-only, including for superusers.
- Errors do not return raw client output or transcript text.

## Verification
- **Triage service tests:** 9 passed against an isolated disposable SQLite database.
- **Conversation API tests:** 22 passed against isolated disposable SQLite, including PBI2 CRUD and PBI3 triage/hardening cases.
- **Item API regression tests:** 19 passed against a separate isolated disposable SQLite database.
- **Alembic migration:** Full chain applied through `d34f8c91a2b7` on a fresh disposable PostgreSQL database. The all-or-none check constraint was present. `alembic heads` reported `d34f8c91a2b7` as the sole head; `alembic check` reported `No new upgrade operations detected`.
- **Static/syntax checks:** Ruff checks passed for changed Python files; `bash -n` passed for the isolated test runner.
- No test used the regular application database. No migration was applied to it. No external provider was called.

## Knowledge Disposition
- **triage-client-parse-validate-boundary** — Staged and promoted to active knowledge after explicit user approval. It records the client/service validation boundary, deterministic fake use, safe errors, and preserving prior valid results on failure.
- The approved PBI3 plan checkpoint had no handoff candidates.
- One unrelated pending candidate (`auth-settings-centralized`) remains pending; it was not modified or reviewed as part of PBI3.

## Checkpoint Disposition
- PBI3 `AgenticLab/knowledge/checkpoints/plan-checkpoint.json` is retained for the user's planned `/premortem`.
- The earlier PBI2 checkpoint remains preserved at `AgenticLab/knowledge/checkpoints/pbi2-plan-checkpoint.json`.

## Post-Premortem Hardening
- Addressed the high-ranked stale-derived-result finding: changing transcript text clears the existing triage fields and timestamp in the same transaction; title-only edits and identical transcript submissions preserve triage.
- Addressed the partial-state finding: a database check constraint requires all triage result fields and `triaged_at` to be either all null or all populated.
- Added three API tests for changed transcript invalidation, title/unchanged transcript preservation, and database rejection of partially populated triage. Conversation tests now total 22 passed. Fresh disposable PostgreSQL migration and Alembic check passed again.

## Follow-up and Scope Boundaries
- PBI3 does not include a frontend UI, live model/provider integration, usage accounting, background jobs, or triage history.
- Live-provider integration requires a separate PBI and explicit provider, privacy, and cost approval.
