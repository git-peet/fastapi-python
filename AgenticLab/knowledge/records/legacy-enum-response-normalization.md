---
id: "legacy-enum-response-normalization"
title: "Normalize legacy enum names in API responses after changing storage type"
category: "procedure"
scope: "project:exp4"
status: "active"
source: "file: backend/app/models.py; backend/tests/api/routes/test_items.py (revision working tree after localhost GET /items 500 fix, verified 2026-11-05)"
evidence: "ItemPublic uses a before-validator to map known uppercase ItemPriority member names to canonical lowercase enum values. The test test_legacy_uppercase_priority_is_serialized_as_lowercase persists a synthetic legacy HIGH value and verifies the API list response returns high. The previous local backend traceback showed a Pydantic response-validation error on the priority field; no application database rows were inspected."
recorded: "2026-11-05"
verified: "2026-11-05"
---

# Normalize legacy enum names in API responses after changing storage type

## Claim or decision

> When older rows contain uppercase SQLAlchemy enum member names but the API contract uses lowercase values, normalize recognized names in the response schema to canonical lowercase values. This avoids response-validation failures without changing or migrating the stored data; request validation can remain strict on the documented lowercase values.

## Rationale / consequence

> This compatibility handling fixed a repeated GET /api/v1/items/ 500 after the backend mapper issue was fixed. It preserves the API contract and avoids inspecting or rewriting existing database rows.
