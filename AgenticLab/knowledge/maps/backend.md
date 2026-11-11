# exp4 Backend Engineering

- **Map ID:** `map-exp4-backend`
- **Collection:** `project-records`
- **Scope:** `project:exp4 / backend`
- **Purpose:** Navigate reusable backend API, persistence/migration, and isolated-testing guidance. This is a curated route, not a complete record inventory or authority for claims.
- **Aliases / trigger terms:** FastAPI, SQLModel, API ownership, Alembic, database migration, isolated API tests, item priority

## Concepts and routes

### Authenticated, owner-scoped API access
Use this route when adding or reviewing endpoints that access user-owned records.

- **Records:** [Backend item ownership checks use the authenticated user](../records/backend-item-ownership-auth.md) — `backend-item-ownership-auth`

### Database schema and model alignment
Use these records when changing SQLModel fields, persistence types, or Alembic revisions. Verify migration claims against current source and the actual target database.

- **Records:** [Backend schema changes use reviewed Alembic revisions](../records/backend-schema-migrations.md) — `backend-schema-migrations`
- **Records:** [Keep Item priority enum validation with string database storage](../records/item-priority-enum-string-storage.md) — `item-priority-enum-string-storage`
- **Records:** [Normalize legacy enum names in API responses after changing storage type](../records/legacy-enum-response-normalization.md) — `legacy-enum-response-normalization`

### Isolated API tests
Use this route when tests call FastAPI endpoints and must remain isolated from application databases.

- **Records:** [Isolated FastAPI tests must override the app database dependency](../records/isolated-api-test-db-override.md) — `isolated-api-test-db-override`

## Scope and maintenance

This map covers reusable backend patterns only. It does not redefine the PBI1-specific map or expand that map's scope. Records remain authoritative and searchable independently of this map; add or remove a link only when it improves navigation, not to maintain an exhaustive catalog.
