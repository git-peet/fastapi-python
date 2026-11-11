# Implementation Log

## Task
PBI 2 — Add Conversation storage and CRUD API

## Implementation Period
Started: 2026-11-04  
Completed: 2026-11-05  
Status: Complete; implementation log approved by user

## Summary
Implemented an owned Conversation resource with validated title/transcript fields, timestamps, an Alembic migration, authenticated owner-scoped CRUD endpoints, privacy-conscious validation errors, and isolated API tests. Updated the PBI2 learning tour and marked PBI2 implemented in `PBIs.md`.

## Files Changed

### Backend model and migration
- **backend/app/models.py**: Added `Conversation`, create/update/public schemas, the User relationship, title limit of 255 characters, transcript limit of 10,000 characters, and created/updated timestamps. Explicit forward-reference annotations were used for SQLModel relationships. Also made `Item.priority` explicitly use `AutoString` for database storage while retaining `ItemPriority` validation, aligning current metadata with the existing PBI1 VARCHAR migration. Added response-only normalization for known legacy uppercase priority enum names so they serialize as the canonical lowercase values.
- **backend/app/alembic/versions/828e4a07b99e_add_conversation_model.py**: Added the Conversation table migration. Corrected its parent to PBI1 revision `a1b2c3d4e5f6` and aligned column types/nullability with SQLModel metadata.

### API and validation
- **backend/app/api/routes/conversations.py**: Added authenticated create, list, get, update, and delete endpoints. All operations are owner-only, including for superusers; create assigns the owner from the authenticated user; update refreshes `updated_at`.
- **backend/app/api/main.py**: Registered the conversations router.
- **backend/app/main.py**: Added a validation-error handler that omits submitted transcript input from error details.
- **backend/app/api/deps.py**: Parses the JWT subject as a UUID before loading the user, supporting UUID-based lookup in the SQLite test database.

### Tests and test tooling
- **backend/tests/api/routes/test_conversations.py**: Added 14 API tests covering CRUD, size validation, transcript redaction, owner isolation, 404/403 behavior, and owner-deletion cascade.
- **backend/tests/api/routes/test_items.py**: Added regression tests confirming `low`, `normal`, and `high` persist as lowercase strings and legacy uppercase enum names serialize as lowercase.
- **backend/tests/conftest.py**: Requires `TEST_DATABASE_URL`, creates a separate test engine, and overrides FastAPI's DB dependency so requests use the disposable database.
- **backend/tests/utils/conversation.py**: Added a helper for creating conversations for a specified owner.
- **backend/scripts/test-isolated.sh**: Added test-target selection, safe cleanup/refusal to reuse an existing SQLite file, and test-only settings from `/tmp` so the project `.env` is not loaded by the runner.

### Documentation and workflow state
- **docs/PBI2 implementation tour.md**: Maintained a beginner-oriented implementation tour with phase details, concepts, and validation results.
- **PBIs.md**: Marked PBI2 implementation complete.
- **AgenticLab/knowledge/checkpoints/plan-checkpoint.json**: Added the documented checkpoint envelope while retaining the approved plan and handoff candidates. Kept for the user's planned `/premortem`.

## Verification
- **Conversation API tests:** 14 passed against a unique disposable SQLite database.
- **Item API regression tests:** 13 passed against a separate unique disposable SQLite database, including all three priority values and legacy uppercase normalization.
- **Alembic migration chain:** Applied through `828e4a07b99e` on a fresh disposable PostgreSQL 18 database; the container was removed afterward. No migration was applied to the application database.
- **Alembic metadata check:** `alembic check` reported `No new upgrade operations detected` after the Item priority model type was aligned with its existing VARCHAR migration.
- **Revision graph:** `alembic heads` reported one head, `828e4a07b99e`.
- **Static/syntax checks:** Ruff checks passed for changed Python files; `bash -n` passed for `test-isolated.sh`.
- **Local app error:** The reported authenticated `GET /api/v1/items/` returned 500. The first traceback showed SQLAlchemy relationship mapper resolution failing; the running image was stale. After refreshing the model in the local backend image, the next traceback showed response validation rejecting legacy uppercase priority values. Added response-only normalization for the known legacy enum names. In the running container, `configure_mappers()` succeeds and `ItemPublic` converts `HIGH` to `high`; root, health, docs, and OpenAPI return HTTP 200. The user's authenticated request was not replayed because their browser token was unavailable; they should retry it.
- A full Dockerfile build was attempted with network disabled and stopped at `bun install` because frontend packages were not cached. A small derived local image was then made from the existing image, copying only the updated backend model, with no network or package download; only the backend service was recreated.
- The local app database was not inspected or migrated.

## Knowledge Disposition
- **isolated-api-test-db-override** — Promoted to active knowledge after explicit user approval; documents overriding FastAPI's DB dependency to keep API tests on the disposable test engine.
- **item-priority-enum-string-storage** — Promoted to active knowledge after explicit user approval; documents preserving enum validation while storing the existing lowercase string representation.
- The approved plan checkpoint's remaining handoff proposals were retained in the checkpoint for premortem/workflow review; they were not independently promoted by this log.

## Environment and Safety Notes
- The test runs used disposable SQLite databases and the migration verification used a temporary disposable PostgreSQL container. Temporary test databases/configuration and the PostgreSQL container were cleaned up.
- No application/shared database was inspected or migrated.
- Earlier in the implementation session, `uv` was installed and globally activated via mise, and a Docker build fetched base-image/dependency layers. This was disclosed to the user as an environment side effect.

## Follow-up
- User plans to run `/premortem`; retain the approved checkpoint for that review.
- Diagnose the reported localhost issue after the user identifies the failing page/action and provides the redacted error/status. Do not apply a migration to the application database without separate explicit authorization.
