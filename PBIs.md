# exp4 — Proposed PBIs

**Status:** Reconciled 2026-11-13 under `EXP4-PBI-RECON-20261113-001`. Per user decision, PBIs 1–4 are closed to further work; any remaining verification gaps, temporary state, or unresolved decisions are non-blocking leftovers, not open scope. Do not reopen these PBIs; any follow-up requires a new PBI and approval. PBIs 5–6 are deferred. PBIs 7–9 below are candidate proposals only, not implementation authorization. Approve a bounded plan before each new PBI.

### Reconciliation record — EXP4-PBI-RECON-20261113-001

- **Recorded:** 2026-11-13T16:58:09+01:00
- **Decision:** Treat PBI1–PBI4 as completed and closed for active work. Residuals are leftovers; do not resume implementation under those PBIs.
- **Known leftover:** PBI1's disposable-PostgreSQL verification was not completed. This does not reopen PBI1; address it only under a newly approved PBI if still needed.
- **PBI2 validation:** The final validation-only rerun passed 22/22 Conversation CRUD tests with the isolated disposable-database runner. No source or persistent database changes were made in that run.
- **Boundary:** This is a planning/status reconciliation, not authorization for further PBI1–PBI4 implementation.

## Completed sequence and future candidates

1. **Completed — PBI 1:** Add a small field to the template's `Item` resource as a full-stack vertical slice. Disposable-PostgreSQL verification remains a non-blocking leftover.
2. **Completed — PBI 2:** Add an owned `Conversation` resource and CRUD API.
3. **Completed — PBI 3:** Add synchronous conversation triage behind a fakeable client interface; live-provider integration remains excluded.
4. **Completed — PBI 4:** Add the Conversations UI and triage interaction.
5. **Deferred — PBI 5:** Content-free usage accounting awaits an approved provider boundary.
6. **Deferred — PBI 6:** Asynchronous triage awaits measured latency/reliability need.
7. **Candidate — PBI 7:** Owner-scoped conversation search and pagination.
8. **Candidate — PBI 8:** Export one owned conversation in a documented format.
9. **Candidate — PBI 9:** Record structured user feedback on the current triage result.
10. **Candidate — PBI 10:** Add a deterministic delivery-plan preflight validator.

Document embeddings/vector search remain a separate future Project 2 discovery.

## Learning approach for every PBI

- Before implementation, list the main Python/framework concepts in plain language and identify which existing files demonstrate them.
- Keep each approved slice to one major new concept at a time; explain the request → validation → persistence → response path before adding abstractions.
- Use the repository's isolated-test-database runner for database tests; never use the application database as a test fallback.
- End each PBI with a short learning review: what changed, how the data/request flows through it, what tests prove, what remains uncertain, and what you learned or want to practice next.
- Distinguish application source changes from local DB state, generated build output, and AgenticLab workspace state; only source/docs intended for the public app repository become app commits.

## PBI 1 — Add priority to demo items

**Status:** Closed per `EXP4-PBI-RECON-20261113-001`. Implementation is complete and published in `fastapi-python` commit `3b53690`. Backend/API and Playwright tests were added, but disposable-PostgreSQL verification remains a non-blocking leftover; PBI1 will not be reopened for it.

### Learning outcomes
- Trace a Python `StrEnum` and SQLModel field through request/response schemas and a database migration.
- Understand how OpenAPI generation produces the frontend TypeScript client types.
- Follow a value through the React form, API request, persistence, and table display.

### User story
As a user, I want to assign a priority to an item, so that I can distinguish items that need attention sooner from those that can wait.

### Implemented contract
Use `low`, `normal`, and `high`, with `normal` as the default. Unknown values are rejected by the request schema.

### Acceptance criteria
- Persist the priority on the SQLModel `Item` table with a migration; existing items receive the agreed default.
- Validate priority on create and update; reject unknown values rather than silently coercing them.
- Return priority in the item API schemas while preserving current owner scoping and superuser behavior.
- Regenerate the OpenAPI frontend client after the API schema changes.
- Add priority selection to the item create/edit flow and display it in the item list.
- Cover defaulting, valid values, invalid values, persistence, and UI behavior with focused backend and frontend tests.
- Database tests use an isolated disposable test database; never a shared development or production database.
- Do not change unrelated authentication, item ownership, or deployment behavior.

## PBI 2 — Add Conversation storage and CRUD API

**Status:** Closed per `EXP4-PBI-RECON-20261113-001`. Implementation and isolated verification are complete. See `docs/PBI2 implementation tour.md`; the migration applied to a fresh disposable PostgreSQL database, isolated API tests passed, and the final validation-only Conversation CRUD rerun passed 22/22. No further work is authorized under PBI2.

### Recommended learning slices
1. **Model and migration:** define a minimal owned Conversation model, its SQLModel/Pydantic schemas, and a migration; add model/schema tests.
2. **Basic API:** implement create and list/get endpoints using the existing FastAPI dependency/session patterns; test response schemas and authentication.
3. **Ownership and lifecycle:** add update/delete, owner-isolation tests, transcript limits, and the agreed behavior when an owner is deleted. Keep privacy/retention decisions explicit.

Review and understand each slice before proceeding to the next; avoid adding transcript workflows or triage to PBI2.

### Learning outcomes
- Learn SQLModel tables/relationships, Alembic migrations, Pydantic schemas, FastAPI dependencies, and session-based CRUD.
- Understand authenticated owner scoping and test it with two distinct users.

### User story
As a signed-in user, I want to create and manage conversations that I own, so that I can use them in later triage workflows.

### Acceptance criteria
- Add a `Conversation` model with a required owner, title, transcript text, and created/updated timestamps.
- Define and enforce a documented maximum size for title and transcript before implementation; do not accept unbounded transcript input.
- Provide authenticated create, list, get, update, and delete endpoints using the project's established API patterns.
- Scope list and item operations to the authenticated owner. Cross-user access is denied; do not assume that superuser status grants access to private transcripts without an explicit product decision.
- Decide and document what happens to a user's conversations when that user is deleted; implement the approved retention/deletion behavior.
- Add an Alembic migration and focused API/service tests for CRUD, validation, ownership isolation, and deletion behavior.
- Use an isolated disposable test database. Do not read `.env`, inspect an existing database, or run migrations against a shared database.
- Do not log transcript text or include it in error messages.

## PBI 3 — Add synchronous conversation triage

**Status:** Closed per `EXP4-PBI-RECON-20261113-001`. Synchronous fake-client triage was implemented in exp4; live model/provider integration remains explicitly excluded and is not an open PBI3 item.

### Recommended learning slices
1. **Contract and fake client:** define the triage result schema and a deterministic fake-client interface; test valid and invalid results without an API route or provider.
2. **Service behavior:** implement validation, bounded retry/error handling, and persistence rules against fake responses.
3. **Endpoint integration:** add the authorized route for an owned conversation and test owner isolation and stored results. Keep this synchronous; do not add queues or live provider calls.

### Learning outcomes
- Learn Python interfaces/protocols and dependency injection by comparing the fake client with the service boundary.
- Practice Pydantic validation, error handling, and testing failure cases without external services.

### User story
As a signed-in user, I want to request a structured triage of a conversation I own, so that I can understand its main intent and a suggested next action.

### Acceptance criteria
- Add `POST /conversations/{id}/triage`; authorize access using the conversation owner rules from PBI 2.
- Put triage behind a small injectable client/interface. The initial implementation and tests use a deterministic fake client; no external LLM call, provider credential, or paid request is made.
- Validate the result with a Pydantic schema containing `summary`, `intent`, `sentiment`, and `next_action`; define allowed values and size limits before implementation.
- Persist the validated result and a triage timestamp on the owned conversation; define whether a later request replaces or versions the prior result.
- Handle malformed JSON, missing fields, invalid enum values, timeout, and provider errors. Any retry policy must be bounded (at most one retry) and tested; after that, return a safe error without storing an invalid result.
- Tests use fake responses and verify owner isolation, validation failures, retry limits, and persistence without a live provider.
- Never log transcripts, prompts, model output, secrets, or credentials. A live provider integration requires a separate PBI and explicit provider/privacy/cost approval.

## PBI 4 — Add the Conversations UI

**Status:** Closed per `EXP4-PBI-RECON-20261113-001`. The Conversations UI and triage interaction were implemented in exp4. Any remaining polish or decisions are leftovers and require a new PBI to resume.

### Learning outcomes
- This is primarily a TypeScript/React learning slice; connect UI actions to the generated API client and existing TanStack Query patterns.
- Keep frontend acceptance separate from backend/API correctness so failures are easier to locate.

### User story
As a signed-in user, I want to create, find, and review my conversations and their triage results in the web interface, so that I can use the workflow without calling the API manually.

### Acceptance criteria
- Add a Conversations route with a list and a detail view, scoped to the signed-in user through the API.
- Provide a form to create a conversation and validate the agreed title/transcript limits before submission.
- Provide clear loading, empty, success, and error states for list, create, detail, and delete/update operations that are included in the approved scope.
- Add a “Run triage” action for an owned conversation; show pending/loading and failure states, then display the validated summary, intent, sentiment, and next action.
- Use the generated API client and TanStack Query patterns; regenerate the client when the backend OpenAPI schema changes.
- Add focused frontend tests for form validation, the main list/detail flow, and triage loading/error/result states without starting the application or requiring a live model provider.
- Do not expose another user's conversation in routes, caches, or UI state.

## PBI 5 — Add content-free triage usage accounting

**Status:** Deferred. Revisit only after a provider boundary is explicitly approved; a live provider is not implicitly approved by this PBI.

### User story
As an administrator, I want to review aggregate triage usage and latency without seeing conversation content, so that I can monitor cost and performance.

### Acceptance criteria
- Define the recorded fields before implementation: timestamp, provider/model identifier, outcome/status, latency, and input/output token counts when supplied by the client.
- Record unknown token counts as unavailable; do not estimate them silently.
- Never store transcripts, prompts, model output, credentials, or other raw content in usage records.
- Keep usage access admin-only and separate from user conversation access.
- Add tests proving usage records contain metadata only, access is authorized, and failures do not block or corrupt conversation data.
- Start with fake client metadata in tests. Live-provider accounting and any provider-specific billing semantics require a separately approved integration decision.
- Defer an admin usage UI until the persisted usage contract and access rules are validated.

## PBI 6 — Consider asynchronous triage

**Status:** Deferred; only pursue if measured synchronous latency or reliability needs justify background processing.

### User story
As a user, I want long-running triage to complete reliably in the background, so that I can continue using the application while it runs.

### Acceptance criteria
- First measure the synchronous flow and document why a background job is needed; do not add queue infrastructure speculatively.
- Select and approve the job mechanism, persistence model, retry limits, idempotency behavior, and failure/recovery semantics before implementation.
- Represent triage state as `pending`, `done`, or `failed`, scoped to an authorized conversation owner.
- The UI polls or refreshes status without duplicate submissions, unbounded requests, or leaking another user's status.
- Tests cover successful completion, terminal failure, retry bounds, duplicate requests, and owner isolation.
- Any new service/dependency or deployment change requires a separate scope and validation plan.

## PBI 7 — Add owner-scoped conversation search and pagination

**Status:** Candidate for review; not approved for implementation.

**C03 evaluation marker for its first plan/implement run:** `C03-EVAL-ID: EXP4-C03-PBI7-001`. Include this exact marker in the explicit `/plan` task context to opt into one sanitized evaluation card under the approved plan scope; the marker does not authorize implementing this PBI.

### User story
As a signed-in user with many conversations, I want to search and navigate my conversation list, so that I can find a specific conversation without loading an unbounded list.

### Candidate acceptance criteria
- Add bounded, owner-scoped title search; transcript full-text search is out of scope unless separately approved.
- Use the existing `skip`/`limit` API contract or propose a bounded cursor alternative; define maximum page size and deterministic ordering before implementation.
- Ensure both the filtered result count and page results are scoped to the authenticated owner.
- Update the Conversations list UI with search, pagination, loading, empty, and error states; reset pagination when the query changes.
- Add backend tests for filtering, pagination boundaries, stable ordering, and cross-owner isolation, plus focused UI tests.
- Do not log raw search text or return another user's conversations.

## PBI 8 — Export an owned conversation

**Status:** Candidate for review; not approved for implementation.

### User story
As a signed-in user, I want to download a copy of a conversation I own, so that I can keep or move my data outside the application.

### Candidate acceptance criteria
- Export one conversation at a time in a documented JSON format, including only explicitly selected conversation fields and current triage metadata.
- Require ownership authorization; cross-user access follows the existing 403/404 policy.
- Bound export size and use a safe download filename/content type; never log transcript or triage content.
- Provide a UI action and clear loading/error behavior.
- Add tests for format, size limits, ownership isolation, and absence of database mutation.
- Bulk export, import, external storage, and scheduled retention are out of scope.

## PBI 9 — Capture structured feedback on triage results

**Status:** Candidate for review; not approved for implementation.

### User story
As a signed-in user, I want to mark whether a conversation's current triage was useful, so that I can distinguish reviewed results from unreviewed ones and inform later product decisions.

### Candidate acceptance criteria
- Allow feedback only for the current triage result on a conversation owned by the caller; start with controlled values such as `helpful` and `not_helpful`, not free text.
- Define how feedback relates to the triage result timestamp/version and whether transcript edits or re-triage clear prior feedback before implementation.
- Display and update the feedback in the conversation detail UI without implying a live model or changing the triage result.
- Test ownership, missing/stale triage, feedback replacement/clearing behavior, and UI states.
- Do not send feedback or conversation content to an external provider; any aggregate usage reporting remains under the separate PBI 5.

## PBI 10 — Add deterministic delivery-plan preflight validator

**Status:** Candidate for review; not approved for implementation.

### User story
As a developer using the delivery workflows, I want a lightweight plan preflight before plan presentation to catch missing opt-in markers, scope/outcome conflicts, unverified validation targets, and inconsistent open-decision statements, so that a normal PBI plus an optional C03-EVAL-ID produces an accurate, reviewable plan in one pass.

### Candidate acceptance criteria
- Add a preflight check in the `/plan` flow that runs before final plan presentation.
- If a PBI reference is supplied, resolve any `C03-EVAL-ID` marker from the PBI entry and carry it into the plan and checkpoint.
- Verify plan outcome, scope, and exclusions are mutually consistent; planning-session no-change/no-test restrictions must not be misread as future-implementation prohibitions.
- Verify referenced source paths and validation commands against actual repository files before finalizing the plan.
- Verify open design decisions are labeled open rather than closed; do not emit a "None" outcome while decisions remain open.
- Include the scoped C03 evaluation-card append in `/implement` scope when a marker is present; do not present a marker-less plan for a marked task.
- If any preflight check fails, withhold the plan and present only the identified gaps.
- Add regression tests for the preflight behavior without adding synthetic PBI stages.
- Out of scope: permanent telemetry, automatic plan rewriting, or broad workflow re-architecture.

## Future Project 2 — Document retrieval / embeddings discovery

**Status:** Future discovery only; not part of the initial exp4 sequence.

### Proposed discovery questions
- Which document types and access boundaries must be supported?
- Which embedding provider/model is acceptable, and what content may be sent to it?
- Does the actual PostgreSQL image and deployment environment support `pgvector`? Verify the selected image/version and extension installation before choosing a schema or committing to it.
- What are the retention, re-indexing, deletion, and tenant/owner-isolation requirements?
- What search-quality evaluation set and success criteria will be used?

Do not add `pgvector`, embed documents, or send project content to an external provider until these questions and the data boundary are explicitly approved.
