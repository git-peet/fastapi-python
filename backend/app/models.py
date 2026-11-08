import uuid
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import EmailStr, field_validator
from sqlalchemy import CheckConstraint
from sqlmodel import Field, Relationship, SQLModel
from sqlmodel.sql.sqltypes import AutoString


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)  # noqa: UP037
    conversations: list["Conversation"] = Relationship(back_populates="owner", cascade_delete=True)  # noqa: UP037


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


class ItemPriority(StrEnum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    priority: ItemPriority = Field(
        default=ItemPriority.NORMAL,
        sa_type=AutoString(),
    )


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    priority: ItemPriority | None = Field(default=None)


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Conversation model
class ConversationBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    transcript: str = Field(min_length=1, max_length=10000)


class ConversationCreate(ConversationBase):
    pass


class ConversationUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    transcript: str | None = Field(default=None, min_length=1, max_length=10000)


class ConversationIntent(StrEnum):
    QUESTION = "question"
    REQUEST = "request"
    COMPLAINT = "complaint"
    FEEDBACK = "feedback"
    OTHER = "other"


class ConversationSentiment(StrEnum):
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class ConversationNextAction(StrEnum):
    RESPOND = "respond"
    ASK_CLARIFYING_QUESTION = "ask_clarifying_question"
    INVESTIGATE = "investigate"
    ESCALATE = "escalate"
    NO_ACTION = "no_action"


class ConversationTriageResult(SQLModel):
    summary: str = Field(min_length=1, max_length=500)
    intent: ConversationIntent
    sentiment: ConversationSentiment
    next_action: ConversationNextAction


class Conversation(ConversationBase, table=True):
    __table_args__ = (
        CheckConstraint(
            "(triage_summary IS NULL AND triage_intent IS NULL "
            "AND triage_sentiment IS NULL AND triage_next_action IS NULL "
            "AND triaged_at IS NULL) OR "
            "(triage_summary IS NOT NULL AND triage_intent IS NOT NULL "
            "AND triage_sentiment IS NOT NULL AND triage_next_action IS NOT NULL "
            "AND triaged_at IS NOT NULL)",
            name="ck_conversation_triage_all_or_none",
        ),
    )
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(default_factory=get_datetime_utc)
    updated_at: datetime | None = Field(default_factory=get_datetime_utc)
    triage_summary: str | None = Field(default=None, max_length=500)
    triage_intent: ConversationIntent | None = Field(default=None, sa_type=AutoString())
    triage_sentiment: ConversationSentiment | None = Field(default=None, sa_type=AutoString())
    triage_next_action: ConversationNextAction | None = Field(default=None, sa_type=AutoString())
    triaged_at: datetime | None = None
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="conversations")


# Properties to return via API, id is always required
class ConversationPublic(ConversationBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None
    updated_at: datetime | None = None
    triage_summary: str | None = None
    triage_intent: ConversationIntent | None = None
    triage_sentiment: ConversationSentiment | None = None
    triage_next_action: ConversationNextAction | None = None
    triaged_at: datetime | None = None


class ConversationsPublic(SQLModel):
    data: list[ConversationPublic]
    count: int


class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_legacy_priority(cls, value: object) -> object:
        """Normalize uppercase names stored by the earlier SQL enum mapping."""
        if isinstance(value, str) and value in ItemPriority.__members__:
            return ItemPriority[value]
        return value


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
