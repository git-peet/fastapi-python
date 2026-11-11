---
id: "isolated-api-test-db-override"
title: "Isolated FastAPI tests must override the app database dependency"
category: "procedure"
scope: "project:exp4"
status: "active"
source: "file: backend/tests/conftest.py; backend/scripts/test-isolated.sh (revision working-tree source reviewed after PBI2 Phase 5 tests)"
evidence: "backend/tests/conftest.py requires TEST_DATABASE_URL, creates a test engine from it, and overrides FastAPI's get_db dependency so TestClient requests use that engine. backend/scripts/test-isolated.sh passes a target test file and runs pytest with the isolated database URL. Verified by running 14 Conversation API tests successfully against disposable SQLite."
recorded: "2026-11-05"
verified: "2026-11-05"
---

# Isolated FastAPI tests must override the app database dependency

## Claim or decision

> For FastAPI API tests to use a disposable database, require an explicit TEST_DATABASE_URL, create the test engine from that URL, and override the app's get_db dependency to provide sessions from the test engine. A fixture that only uses the test engine directly does not redirect API requests, which could otherwise use the application's configured database.

## Rationale / consequence

> This is a reusable safety pattern for API tests: it prevents endpoint requests from silently using the development or production database and makes tests reproducible against a disposable database.
