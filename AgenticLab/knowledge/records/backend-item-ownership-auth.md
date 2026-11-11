---
id: "backend-item-ownership-auth"
title: "Backend item ownership checks use the authenticated user"
category: "fact"
scope: "project:exp4"
status: "active"
source: "file: backend/app/api/deps.py; backend/app/api/routes/login.py; backend/app/api/routes/items.py; backend/app/models.py (revision working-tree source reviewed 2026-11-03 (not a git checkout))"
evidence: "Login creates a signed expiring token with user.id as sub (login.py:23-42; core/security.py:19-26). get_current_user validates the token, loads the referenced user, and rejects missing/inactive users (deps.py:30-49). Item listing filters by owner_id for non-superusers; read/update/delete check owner_id against current_user.id and permit superusers; creation sets owner_id from current_user (items.py:28-42, 48-72, 75-113). ItemUpdate omits owner_id (models.py:89-103)."
recorded: "2026-11-03"
verified: "2026-11-03"
---

# Backend item ownership checks use the authenticated user

## Claim or decision

> Item routes identify the caller via a validated bearer token whose subject identifies a database user. For non-superusers, list queries are scoped to that user's owner_id, and individual read/update/delete operations reject items whose owner_id differs from current_user.id. New items receive owner_id from current_user, not request data. Superusers bypass these ownership checks; ItemUpdate does not expose owner_id.

## Rationale / consequence

> This is a reusable backend authorization pattern that helps future reviews trace identity resolution through to item-level enforcement. Verified against current source.
