---
id: "backend-schema-migrations"
title: "Backend schema changes use reviewed Alembic revisions"
category: "procedure"
scope: "project:exp4"
status: "active"
source: "file: backend/README.md; backend/app/alembic/env.py; backend/scripts/prestart.sh; .github/workflows/deploy.yml (revision current workspace source reviewed 2026-11-03)"
evidence: "backend/README.md documents generating revisions with `uv run alembic revision --autogenerate`, committing generated revision files, and applying them with `uv run alembic upgrade head`. backend/app/alembic/env.py sets SQLModel.metadata as Alembic target metadata and reads DATABASE_URL from application settings. backend/scripts/prestart.sh applies `alembic upgrade head` before initializing data. .github/workflows/deploy.yml runs that prestart script against the configured database before deploying."
recorded: "2026-11-03"
verified: "2026-11-03"
---

# Backend schema changes use reviewed Alembic revisions

## Claim or decision

> Represent backend table-model changes with Alembic revision files generated from SQLModel metadata. Review and commit each generated revision, then apply it with `alembic upgrade head`. The prestart script applies pending revisions before initializing first-run data, and deployment runs that preparation step before deploying.

## Rationale / consequence

> This is a reusable backend maintenance procedure documented in project README and confirmed by the current Alembic configuration, prestart script, and deployment workflow. Capturing it can prevent future agents from assuming schema changes are applied automatically at app startup.
