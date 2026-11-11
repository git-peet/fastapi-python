---
id: "triage-client-parse-validate-boundary"
title: "Keep triage client output behind a parse-and-validate service boundary"
category: "procedure"
scope: "project:exp4"
status: "active"
source: "file: backend/app/services/triage.py; backend/tests/test_triage_service.py; backend/app/api/routes/conversations.py (revision working tree after PBI3 implementation and isolated validation, 2026-11-07)"
evidence: "The synchronous TriageClient protocol returns raw JSON text. run_triage passes it to validate_triage_response, which parses JSON and validates ConversationTriageResult before the route updates any Conversation triage fields. FakeTriageClient returns a deterministic canned result and never includes the transcript. Unit/API tests cover malformed JSON, missing fields, invalid enum values, summary bounds, timeout/client failures, owner isolation, successful persistence/replacement, and preservation of a previous result on failed retriage. The isolated tests passed; no live provider call was implemented or made."
recorded: "2026-11-07"
verified: "2026-11-07"
---

# Keep triage client output behind a parse-and-validate service boundary

## Claim or decision

> For synchronous structured triage, keep a small client interface that returns raw structured text, validate it in a separate service before persistence, and use an injectable deterministic fake for tests and the initial no-provider implementation. Convert failures to generic safe errors and do not overwrite prior valid results when validation or the client fails.

## Rationale / consequence

> This separates provider/client behavior from result validation and persistence, enables deterministic testing of malformed and failure responses without credentials or network calls, and prevents invalid output from corrupting previously stored triage data.
