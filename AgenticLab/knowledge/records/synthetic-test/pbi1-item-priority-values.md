# PBI1 Item Priority Values Decision

- **ID:** pbi1-item-priority-values
- **Category:** decision
- **Scope:** exp4 / backend / pbi1
- **Status:** active
- **Source:** PBI1 acceptance criteria; backend model `Item`
- **Evidence:** `Item.priority` uses enum `low | normal | high`; no `critical` or numeric values.
- **Recorded:** 2026-11-03
- **Verified:** 2026-11-03

## Claim or decision
Item priority restricted to `low`, `normal`, `high`. Do not add `critical` or integer weights.