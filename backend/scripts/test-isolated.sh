#!/usr/bin/env bash
# Run backend API tests only against an explicitly selected disposable PostgreSQL DB.
set -euo pipefail

if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  echo "ERROR: TEST_DATABASE_URL is required; refusing to use the application database." >&2
  exit 2
fi

# Validate only URL structure and the database name; never print credentials.
target=$(python3 - <<'PY'
import os
from urllib.parse import urlsplit

raw = os.environ["TEST_DATABASE_URL"]
parsed = urlsplit(raw)
if parsed.scheme not in {"postgresql", "postgresql+psycopg"}:
    raise SystemExit("TEST_DATABASE_URL must use PostgreSQL")
database = parsed.path.lstrip("/").split("/", 1)[0]
if not database or "test" not in database.lower():
    raise SystemExit("TEST_DATABASE_URL database name must contain 'test' as a safety check")
print(f"{parsed.hostname or 'localhost'}:{parsed.port or 5432}/{database}")
PY
)

# Override any application defaults. FASTAPI_ENV=test disables loading the workspace .env.
export DATABASE_URL="$TEST_DATABASE_URL"
export FASTAPI_ENV=test
export PROJECT_NAME="FastAPI test"
export SECRET_KEY="fastapi-test-only-secret-key"
export FIRST_SUPERUSER="test-admin@example.com"
export FIRST_SUPERUSER_PASSWORD="test-only-password"
export EMAIL_TEST_USER="test-user@example.com"

printf 'Using isolated test database target: %s\n' "$target"
printf 'This script applies migrations to that database; do not point it at shared or production data.\n'

cd "$(dirname "$0")/.."
uv run --offline --no-sync alembic upgrade head
uv run --offline --no-sync pytest tests/api/routes/test_items.py -v --tb=short "$@"

printf 'Test database was left in place for explicit cleanup/reuse.\n'
