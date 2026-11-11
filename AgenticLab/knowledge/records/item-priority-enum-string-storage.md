---
id: "item-priority-enum-string-storage"
title: "Keep Item priority enum validation with string database storage"
category: "decision"
scope: "project:exp4"
status: "active"
source: "file: backend/app/models.py; backend/app/alembic/versions/a1b2c3d4e5f6_add_priority_to_item.py; backend/tests/api/routes/test_items.py (revision working tree after PBI2 Phase 6 Alembic validation on 2026-11-05)"
evidence: "ItemBase.priority remains typed as ItemPriority for API validation but specifies AutoString as the SQL column type. The existing PBI1 migration creates the column as AutoString with lowercase default 'normal'. A focused test confirms low, normal, and high persist as lowercase strings; after this alignment, a fresh PostgreSQL 18 database migrated through head and `alembic check` reported no new operations."
recorded: "2026-11-05"
verified: "2026-11-05"
---

# Keep Item priority enum validation with string database storage

## Claim or decision

> When an API field must reject values outside a StrEnum but the existing schema migration stores lowercase strings, keep the Pydantic/SQLModel field typed as the enum and explicitly set its SQL storage type to AutoString. This preserves enum validation and the existing VARCHAR schema without requiring a data migration.

## Rationale / consequence

> This resolved an Alembic metadata mismatch without rewriting the applied PBI1 revision or converting existing stored values to a database enum. It preserves the approved low/normal/high contract and allows Alembic checks to pass.
