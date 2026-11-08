# PBI3 Implementation Tour — Synchronous Conversation Triage

**Status:** Implementation complete; post-premortem hardening included
**Scope:** Backend triage only; no UI or live provider

## Goal

Let an authenticated conversation owner request a small structured triage result. The response is deterministic in this PBI: the app uses a fake client, not a live AI/provider service.

## Learning path

1. **Result contract — `backend/app/models.py`**
   - `ConversationTriageResult` is the shape of a valid result.
   - `summary` is required and limited to 500 characters.
   - `intent`, `sentiment`, and `next_action` are enums. Enums are named sets of allowed values; they prevent arbitrary strings from entering the result.

2. **Client boundary and service — `backend/app/services/triage.py`**
   - `TriageClient` is a Python `Protocol`: it describes what a client must do without tying the rest of the app to a particular provider.
   - The client receives transcript text and returns raw JSON text. The service parses that JSON and validates it against `ConversationTriageResult` before the API stores anything.
   - `FakeTriageClient` returns a stable sample result. It does not call the network or include the transcript in its result.
   - The initial retry policy is zero retries. Bad JSON, invalid fields, timeout, and client errors become safe errors; exception details and raw output are not returned to the caller.

3. **Persistence — `backend/app/models.py` and Alembic revision**
   - Conversation stores the latest triage summary, intent, sentiment, next action, and `triaged_at` timestamp.
   - A successful later triage replaces the previous result. A failed attempt leaves the prior result and timestamp unchanged.
   - Changing the transcript clears the existing triage result in the same update. Title-only edits and resubmitting identical transcript text preserve it.
   - A database check constraint requires triage fields to be either all null or all populated, including the timestamp.
   - The Alembic migration adds nullable columns and the consistency constraint so existing Conversation rows remain valid before they are triaged.

4. **Endpoint — `backend/app/api/routes/conversations.py`**
   - `POST /api/v1/conversations/{id}/triage` first finds the conversation, then checks ownership, then calls the injected client/service.
   - Only after the result validates does the endpoint update and commit the Conversation row.
   - Access remains owner-only, including for superusers. The route response exposes the stored result and timestamp.

## Tests and verification

- Service tests use fake results/errors to cover parsing, required fields, enum validation, summary bounds, timeout, client error, and the no-retry rule.
- API tests cover success, replacement, owner isolation, safe errors, failures preserving prior data, transcript-edit invalidation, title/unchanged-transcript preservation, and rejection of partial triage data.
- API tests use the isolated file-backed SQLite runner; migration verification uses a fresh disposable PostgreSQL database. The normal application database is not a test target.
- No transcript, prompt, raw client response, or credential should be logged or included in API error details.
- The premortem found that transcript edits could leave stale triage attached and that separate nullable columns allowed partial state. Both were addressed with transcript-change invalidation and a database all-or-none check constraint.

## Scope boundary

No live provider, provider credentials, frontend UI, usage-accounting records, queue, or background job is part of PBI3. Those require separate PBIs and approvals.
