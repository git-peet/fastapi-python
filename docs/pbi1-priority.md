# PBI1 — Item priority vertical slice

**Status:** Source changes and focused tests are prepared for the PBI1 phase. The new tests have not yet been run against a disposable PostgreSQL test database; do not describe the database acceptance criteria as verified until that run succeeds.

## Feature contract

Items support `low`, `normal`, and `high` priority, with `normal` as the default. Unknown values should be rejected by request validation.

## Implementation

- Backend: `ItemPriority` and the `priority` field are defined in the SQLModel item schemas.
- Database: an Alembic migration adds a non-null `priority` column with server default `normal` for existing rows.
- API/client: `scripts/generate-client.sh` generates the OpenAPI input locally; `frontend/openapi.json` is intentionally ignored as a generated intermediate. The generated TypeScript types and client exports that include the priority field are tracked.
- UI: Add/Edit forms allow selecting priority; the items table displays the value.

## Tests and verification status

- Backend API tests cover defaulting, the supported values, rejection of an unknown value, and updating priority.
- Playwright coverage exercises selecting priority on create and edit.
- These tests are added but **not run in this repository yet**. Use `backend/scripts/test-isolated.sh` with an explicitly disposable PostgreSQL database whose name contains `test`; it applies migrations to that database. Never point it at a shared or production database.

No local database contents, manual SQL changes, credentials, or environment files are part of this implementation commit. The Dockerfile was already present in the clean baseline and is not a PBI1 delta.
