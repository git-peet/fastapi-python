# Frontend Client Generation Safe Path

- **ID:** exp4-synthetic-frontend-client-gen
- **Category:** procedure
- **Scope:** exp4 / frontend
- **Status:** active
- **Source:** `frontend/package.json` scripts; `openapi-generator` config
- **Evidence:** `npm run generate:client` writes to `src/generated/` only; does not touch `src/routes/` or `src/hooks/`.
- **Recorded:** 2026-11-03
- **Verified:** 2026-11-03

## Claim or decision
Run `npm run generate:client` to regenerate API client in `src/generated/`. Never edit generated files; extend via wrappers in `src/lib/api/`.