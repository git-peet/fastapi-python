# Expense Date Format Decision

- **ID:** exp4-synthetic-expense-date
- **Category:** decision
- **Scope:** exp4 / backend
- **Status:** active
- **Source:** Project convention; verified in `backend/app/api/`
- **Evidence:** All expense records use `YYYY-MM-DD`; no alternate format present.
- **Recorded:** 2026-11-03
- **Verified:** 2026-11-03

## Claim or decision
Standardize expense entry dates to `YYYY-MM-DD`; reject `MM/DD/YYYY` at API validation.