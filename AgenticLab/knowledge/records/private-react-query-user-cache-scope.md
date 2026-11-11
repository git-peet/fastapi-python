---
id: "private-react-query-user-cache-scope"
title: "Scope private React Query caches to the authenticated user"
category: "risk"
scope: "project:exp4"
status: "active"
source: "file: frontend/src/main.tsx; frontend/src/hooks/useAuth.ts; frontend/src/components/Conversations/queryKeys.ts; frontend/tests/conversations.spec.ts (revision working tree after PBI4 implementation and mocked Playwright validation, 2026-11-08)"
evidence: "The app has a shared QueryClient in frontend/src/main.tsx. useAuth stores/removes the bearer token and now removes conversation queries on login/logout. Conversation query keys include the authenticated user ID in frontend/src/components/Conversations/queryKeys.ts. The mocked Playwright test 'clears cached conversations when switching accounts' confirms User A's conversation is not shown after logout and login as User B. No backend or database was used for this test."
recorded: "2026-11-08"
verified: "2026-11-08"
---

# Scope private React Query caches to the authenticated user

## Claim or decision

> For private React Query resources, include the authenticated user's ID in query keys and remove the private resource queries on logout/account change. This prevents cached data from one account being reused or displayed after another account signs in.

## Rationale / consequence

> Future frontend features may cache user-owned data. Explicitly scoping and clearing private query caches reduces cross-account data exposure when authentication changes within the same browser session.
