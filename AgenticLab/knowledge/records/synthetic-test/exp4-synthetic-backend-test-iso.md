# Backend Test Isolation Convention

- **ID:** exp4-synthetic-backend-test-iso
- **Category:** fact
- **Scope:** exp4 / backend / tests
- **Status:** active
- **Source:** `backend/app/api/` test files; pytest fixtures
- **Evidence:** Each test module creates its own async DB session; no shared state between tests.
- **Recorded:** 2026-11-03
- **Verified:** 2026-11-03

## Claim or decision
Backend tests use per-test async DB sessions with transaction rollback; no cross-test data leakage.