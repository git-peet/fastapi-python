#!/usr/bin/env bash
# Dedicated isolated test runner - fails closed if isolation is not guaranteed.

set -euo pipefail

backend_dir="$(cd "$(dirname "$0")/.." && pwd)"
cleanup_db=""

cleanup() {
    if [[ -n "$cleanup_db" && -f "$cleanup_db" ]]; then
        echo "Cleaning up disposable test database: $cleanup_db"
        rm -f -- "$cleanup_db"
    fi
}
trap cleanup EXIT

# Require explicit test database URL - no fallback to development/production.
if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
    echo "ERROR: TEST_DATABASE_URL not set"
    echo "This runner requires an explicitly isolated disposable database."
    echo "Set TEST_DATABASE_URL to a unique test database (e.g., sqlite:///auto)."
    exit 1
fi

# This runner destroys/recreates test tables, so only allow a disposable SQLite file.
if [[ "$TEST_DATABASE_URL" != sqlite:///* || "$TEST_DATABASE_URL" == "sqlite:///:memory:" ]]; then
    echo "ERROR: this runner only accepts file-backed SQLite databases."
    echo "Use TEST_DATABASE_URL=sqlite:///auto or a new, dedicated SQLite file."
    exit 1
fi

# Generate a unique SQLite file on request, or require the supplied file to be new.
if [[ "$TEST_DATABASE_URL" == "sqlite:///auto" ]]; then
    TEST_DATABASE_URL="sqlite:///test_$(date +%s)_$$.db"
    export TEST_DATABASE_URL
fi
if [[ "$TEST_DATABASE_URL" == sqlite:///* ]]; then
    sqlite_path="${TEST_DATABASE_URL#sqlite:///}"
    if [[ -e "$sqlite_path" ]]; then
        echo "Refusing to use existing SQLite file: $sqlite_path"
        echo "Choose a new disposable test database path."
        exit 1
    fi
    cleanup_db="$sqlite_path"
fi

echo "Running isolated tests with database: $TEST_DATABASE_URL"

test_target="${1:-tests/api/routes/test_items.py}"
if (($# > 0)); then
    shift
fi
if [[ "$test_target" != /* ]]; then
    test_target="$backend_dir/$test_target"
fi

# Run outside the repository so Pydantic cannot discover the project .env file.
# These are test-only settings; application DB access is separately overridden
# in tests/conftest.py to use TEST_DATABASE_URL exclusively.
cd /tmp
export PYTHONPATH="$backend_dir"
export DATABASE_URL="postgresql://test:test@127.0.0.1:1/test_only"
export SECRET_KEY="$(openssl rand -hex 32)"
export PROJECT_NAME="Isolated API tests"
export FIRST_SUPERUSER="test-admin@example.com"
export FIRST_SUPERUSER_PASSWORD="$(openssl rand -hex 24)"
export FASTAPI_ENV=development
uv run --project "$backend_dir" pytest "$test_target" -v --tb=short "$@"
