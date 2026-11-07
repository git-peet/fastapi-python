# PBI2 Implementation Tour — Add Conversation Storage and CRUD API

**Status:** Implementation complete; implementation-log approval pending
**Last Updated:** 2026-11-05

---

## Overview

PBI2 establishes the first project-specific data resource: a `Conversation` model with full CRUD API, ownership scoping, validation, and isolated test infrastructure.

**Learning Outcomes Targeted:**
- SQLModel tables/relationships, Alembic migrations, Pydantic schemas, FastAPI dependencies, and session-based CRUD
- Authenticated owner scoping and testing with two distinct users

---

## Phase 1: Model & Migration

### Files Changed
- `backend/app/models.py` — Added Conversation model and schemas
- `backend/app/alembic/versions/828e4a07b99e_add_conversation_model.py` — New migration

### What Was Implemented

#### SQLModel Definitions (`models.py`)

```python
# SQLModel is a library that combines SQLAlchemy (database tools) and Pydantic (validation tools)
# This lets us define database tables with Python classes that automatically handle validation
from sqlmodel import SQLModel, Field, Relationship

# Field(...) tells SQLModel about validation rules for each attribute
# min_length: the minimum acceptable value (1 character, here)
# max_length: the maximum acceptable value (255 characters, here)

# ConversationBase is a base class with shared validation rules
class ConversationBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)   # Title must be 1-255 chars
    transcript: str = Field(min_length=1, max_length=10000)  # Transcript must be 1-10,000 chars

# ConversationCreate is used for creating a new conversation (all fields required)
class ConversationCreate(ConversationBase):
    pass  # Inherits title and transcript with their validation rules

# ConversationUpdate is used for updating (all fields optional - partial update pattern)
class ConversationUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # Optional: None means "don't change this field"
    transcript: str | None = Field(default=None, min_length=1, max_length=10000)

# Conversation is the actual database table (table=True marks it as a DB table)
class Conversation(ConversationBase, table=True):
    # id: unique identifier (UUID - Universally Unique Identifier, like a giant random number)
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # created_at / updated_at: datetime objects; default_factory gives a timestamp when created
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)
    # owner_id: foreign key - links to the user who owns this conversation
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    # owner: relationship - tells SQLAlchemy how to link back to User
    owner: User | None = Relationship(back_populates="conversations")

# ConversationPublic is the response schema - what the API returns to the user
class ConversationPublic(ConversationBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None

# ConversationsPublic wraps a list with a count - common API pattern for lists
class ConversationsPublic(SQLModel):
    data: list[ConversationPublic]
    count: int
```

#### User Model Update
```python
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    conversations: list["Conversation"] = Relationship(back_populates="owner", cascade_delete=True)
```

**Key Learning Points:**
- `ConversationBase` defines shared validation (title ≤ 255 chars, transcript ≤ 10,000 chars)
- `ConversationCreate` inherits required fields; `ConversationUpdate` makes all optional for partial updates
- `Conversation` table has `owner_id` FK with `ondelete="CASCADE"` — conversations are deleted when their owner is deleted
- `User` now has a `conversations` relationship with `cascade_delete=True` — same pattern as `items`
- Response schema (`ConversationPublic`) includes read-only fields (`id`, `owner_id`, timestamps)

#### Alembic Migration (`828e4a07b99e_add_conversation_model.py`)

```python
def upgrade():
    # op.create_table creates the new database table
    op.create_table(
        "conversation",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("transcript", sa.String(length=10000), nullable=False),
        sa.Column("created_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("updated_at", sqlmodel.sql.sqltypes.UTCDateTime(), nullable=True),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["user.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
```

**Key Learning Points:**
- `created_at` and `updated_at` are nullable in the schema and get Python-side defaults from `get_datetime_utc()` when the app creates a row; the migration does not add a database server default.
- `updated_at` is set again by the API when a conversation is updated.
- `ondelete="CASCADE"` on the owner foreign key expresses the database-level deletion rule.
- A migration should match SQLModel's actual column types and nullability; this was verified against a fresh PostgreSQL database.

---

## Phase 2: API Endpoints

### Files Changed
- `backend/app/api/routes/conversations.py` — New file with 5 CRUD routes
- `backend/app/api/main.py` — Registered the conversations router

### What Was Implemented

#### Routes Module (`conversations.py`)

```python
# FastAPI Router - organizes related API endpoints
# prefix="/conversations" means all these routes will be at /api/v1/conversations/
router = APIRouter(prefix="/conversations", tags=["conversations"])

@router.get("/", response_model=ConversationsPublic)
def read_conversations(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100):
    # Every account sees only rows matching its own owner_id, even superusers
    # Returns {data: [...], count: N} envelope matching ItemsPublic pattern

@router.get("/{id}", response_model=ConversationPublic)
def read_conversation(session: SessionDep, current_user: CurrentUser, id: uuid.UUID):
    # Ownership check: 404 if not found, 403 if not the owner (regardless of role)

@router.post("/", response_model=ConversationPublic)
def create_conversation(*, session: SessionDep, current_user: CurrentUser, conversation_in: ConversationCreate):
    # Sets owner_id from current_user.id automatically
    # Returns created conversation with all fields

@router.put("/{id}", response_model=ConversationPublic)
def update_conversation(*, session: SessionDep, current_user: CurrentUser, id: uuid.UUID, conversation_in: ConversationUpdate):
    # Ownership check + partial update via model_dump(exclude_unset=True)

@router.delete("/{id}")
def delete_conversation(session: SessionDep, current_user: CurrentUser, id: uuid.UUID):
    # Ownership check + delete, returns Message("Conversation deleted successfully")
```

#### Router Registration (`main.py`)

```python
from app.api.routes import conversations, items, login, private, users, utils

api_router = APIRouter()
# ... other includes ...
api_router.include_router(conversations.router)
```

**Key Learning Points:**
- All routes use `CurrentUser` dependency for authentication — same pattern as `items.py`
- Ownership scoping: list endpoint filters by `owner_id`; individual endpoints check `conversation.owner_id == current_user.id`
- Every account, including superusers, is restricted to its own conversations. The PBI says not to assume superusers can read private transcripts; no product decision granting that access was made.
- Response envelope `{data: [...], count: int}` matches `ItemsPublic` pattern
- `model_dump(exclude_unset=True)` enables partial updates (only sent fields are updated)

---

## Phase 5: Isolated API Tests

### Files Changed
- `backend/tests/api/routes/test_conversations.py` — CRUD, validation, ownership, and deletion tests
- `backend/tests/api/routes/test_items.py` — Added regression tests that check all three PBI1 priorities persist as lowercase strings and legacy uppercase enum names serialize as lowercase
- `backend/app/models.py` — Made the Item priority column's database type explicitly `AutoString`, matching its existing migration while keeping enum request validation
- `backend/tests/utils/conversation.py` — Helper to create test conversations for a chosen owner
- `backend/tests/conftest.py` — Requires `TEST_DATABASE_URL`, creates a separate test engine, and overrides FastAPI's database dependency so API requests use only that test database
- `backend/scripts/test-isolated.sh` — Accepts a test target, supplies fake test-only settings, and runs from `/tmp` so Pydantic does not load the project `.env` file
- `backend/app/main.py` — Validation-error handler removes raw transcript input from error details
- `backend/app/api/deps.py` — Parses the JWT subject as a UUID before loading the user, which allows the SQLite test database's UUID column to work correctly
- `backend/app/models.py` — Uses explicit forward references for SQLModel relationships; this avoids the mapper error found while running the tests
- `backend/app/api/routes/conversations.py` — All conversation access is owner-only, including for superusers

### What the Tests Cover
- Creating and reading a conversation owned by the authenticated user
- Listing only the current user's conversations
- Updating and deleting the owner's conversation
- Returning 404 for an unknown conversation and 403 for another user's conversation
- Rejecting a title over 255 characters and transcript over 10,000 characters
- Ensuring a validation error does not echo the submitted transcript text
- Deleting a user's conversations when that user is deleted

### Verification Completed
- ✅ Conversation API tests: **14 passed** using a unique disposable SQLite database
- ✅ Existing item API tests: **13 passed** using a separate unique disposable SQLite database
- ✅ Test runner removes its newly created SQLite test file after the run and refuses to reuse an existing SQLite file
- ✅ Migration verification was completed separately against a fresh disposable PostgreSQL 18 database; the Conversation table was created and Alembic reached the single PBI2 head.

---

## Phase 6: Migration Verification & Acceptance

- Fixed the PBI2 migration parent metadata to follow PBI1 (`a1b2c3d4e5f6`), restoring a single linear Alembic head instead of leaving two branch heads.
- Aligned migration column types and nullability with the SQLModel model: transcript is bounded `VARCHAR(10000)` and timestamps use `UTCDateTime` and remain nullable.
- Applied the complete migration chain through `828e4a07b99e` on a fresh, disposable PostgreSQL 18 container. The container was removed afterward; the application database was not used.
- Confirmed the resulting conversation columns: UUID id/owner, bounded title/transcript, and nullable timezone-aware timestamps.
- Fixed the `item.priority` metadata mismatch by explicitly keeping its database column as a string while the API/model field remains an enum. This matches the already-existing PBI1 migration and does not require a new migration.
- `alembic check` on the fresh PostgreSQL database now reports: `No new upgrade operations detected.`
- Added and passed focused tests confirming `updated_at` changes on update and PBI1 priority values persist as lowercase strings.

## Verification Completed

- ✅ OpenAPI schema includes the conversation routes at `/api/v1/conversations/`
- ✅ Conversation API tests: 14 passed; Item API regression tests: 13 passed, each against a separate disposable SQLite database.
- ✅ Migration chain applied successfully to a fresh disposable PostgreSQL 18 database and ended at one Alembic head.
- ✅ Ruff checks and test-runner shell syntax check passed.
- ✅ After fixing the local runtime, the backend ORM mappers configured successfully in the running container; `/`, the health check, `/docs`, and OpenAPI returned HTTP 200.
- The old backend image first produced SQLAlchemy relationship-resolution errors on authenticated requests. Updating model annotations fixed mapper setup; a subsequent request exposed legacy uppercase priority values failing response validation. `ItemPublic` now normalizes those known enum names to lowercase without changing database contents.
- A full Dockerfile build was attempted offline but could not complete because frontend Bun packages were not cached. To avoid network access, the local backend image was derived from the existing image with the updated `models.py`, then only the backend service was recreated.
- In the running container, SQLAlchemy mappers configure successfully and `ItemPublic` serializes a legacy `HIGH` value as `high`. The user's authenticated request has not been replayed with their browser token; no application database was inspected or migrated.

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Model & migration | ✅ Complete and migration-tested |
| 2 | CRUD API | ✅ Complete |
| 3 | Validation | ✅ Complete |
| 4 | Ownership & lifecycle | ✅ Complete (owner-only access and cascade tested) |
| 5 | Isolated API testing | ✅ Complete (14 Conversation tests; 13 Item regression tests passed) |
| 6 | Migration verification and acceptance review | ✅ Complete; clean Alembic check on disposable PostgreSQL |

---

## Learning Notes

### Patterns Reused from PBI1 / Existing Codebase
1. **SQLModel relationships** — `ForeignKey` + `Relationship` with `ondelete="CASCADE"` and `cascade_delete=True`
2. **Ownership scoping** — Filter list by `owner_id`, check `owner_id == current_user.id` on individual operations
3. **API response envelope** — `{data: [...], count: int}` for list endpoints
4. **Alembic migration** — Review revisions against model nullability, types, defaults, and ancestry; the Conversation timestamps use Python-side defaults rather than server defaults.
5. **Enum validation vs storage type** — An API field can use an enum for allowed values while its database column remains a string, when that matches the approved migration and stored values.
6. **Isolated test pattern** — `TEST_DATABASE_URL` env var, unique SQLite per run, API dependency override, and a working directory that prevents `.env` loading

### New Patterns for Conversations
1. **Updated timestamp** — Added `updated_at` field (Items don't have this)
2. **Bounded transcript** — both title and transcript have API/model limits; transcript is stored as a bounded `VARCHAR(10000)`, not unbounded `TEXT`.
3. **PBI1 migration alignment** — `ItemPriority` validates allowed API values while `Item.priority` is stored as a string, matching the existing PBI1 migration and avoiding an unnecessary data migration.
4. **Owner isolation** — All users, including superusers, can access only conversations they own unless a separate product decision changes that rule.
5. **Validation privacy** — FastAPI's default validation response may include the invalid input value. The app removes the submitted value for transcript errors, and a test checks that a distinctive marker is not echoed.
6. **Forward references** — When one model refers to another class defined later in the file, the relationship annotation uses a quoted type name. A mapper check exposed why this matters with the current SQLModel/SQLAlchemy versions.
7. **SQLite UUIDs** — JWT subjects are text, while the model primary key is a UUID. The auth dependency parses the token subject into a UUID before querying, which is needed by SQLite's UUID binding.

---

*This document will be updated as implementation phases progress.*