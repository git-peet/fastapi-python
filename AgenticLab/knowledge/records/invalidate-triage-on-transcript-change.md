---
id: "invalidate-triage-on-transcript-change"
title: "Invalidate derived triage when its source transcript changes"
category: "procedure"
scope: "project:exp4"
status: "active"
source: "file: backend/app/api/routes/conversations.py; backend/tests/api/routes/test_conversations.py (revision working tree after PBI3 premortem hardening and isolated validation, 2026-11-07)"
evidence: "update_conversation compares a supplied transcript with the stored transcript and clears triage_summary, triage_intent, triage_sentiment, triage_next_action, and triaged_at only when the transcript changes. The focused test test_transcript_edit_invalidates_previous_triage verifies the result is cleared; test_title_or_unchanged_transcript_edit_preserves_triage verifies unrelated and identical-content updates preserve it. The Conversation API test module passed 22 tests against disposable SQLite."
recorded: "2026-11-07"
verified: "2026-11-07"
---

# Invalidate derived triage when its source transcript changes

## Claim or decision

> When a derived result is stored alongside mutable source content, invalidate the result when that source materially changes. Preserve it for unrelated edits and resubmission of identical source content, and clear it in the same transaction as the source update.

## Rationale / consequence

> This avoids silently presenting a previously valid analysis as if it described edited source text. The transaction-level invalidation keeps source and derived-result state aligned for current API callers.
