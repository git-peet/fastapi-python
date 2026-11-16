import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Conversation,
    ConversationCreate,
    ConversationPublic,
    ConversationsPublic,
    ConversationUpdate,
    Message,
    get_datetime_utc,
)
from app.services.triage import (
    FakeTriageClient,
    TriageClient,
    TriageClientError,
    TriageTimeoutError,
    run_triage,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])

# Bounded pagination contract shared by the list and search routes.
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 100

SkipParam = Annotated[int, Query(ge=0)]
LimitParam = Annotated[int, Query(ge=1, le=MAX_PAGE_SIZE)]


def get_triage_client() -> TriageClient:
    """Provide the deterministic fake until a separate provider PBI is approved."""
    return FakeTriageClient()


class ConversationSearchRequest(BaseModel):
    """Search request. The raw term lives in the request body, never the URL."""

    query: str = Field(default="", max_length=255)


def _title_filter(query: str):
    """Match a literal case-insensitive substring, escaping SQL LIKE syntax."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return col(Conversation.title).ilike(f"%{escaped}%", escape="\\")


def _owner_count(
    session: SessionDep, current_user: CurrentUser, query: str | None
) -> int:
    count_statement = select(func.count()).select_from(Conversation).where(
        Conversation.owner_id == current_user.id
    )
    if query:
        count_statement = count_statement.where(_title_filter(query))
    return session.exec(count_statement).one()


def _owner_page(
    session: SessionDep,
    current_user: CurrentUser,
    query: str | None,
    skip: int,
    limit: int,
) -> list[Conversation]:
    statement = select(Conversation).where(
        Conversation.owner_id == current_user.id
    )
    if query:
        statement = statement.where(_title_filter(query))
    statement = (
        statement.order_by(
            col(Conversation.created_at).desc(), col(Conversation.id).desc()
        ).offset(skip).limit(limit)
    )
    return session.exec(statement).all()


def _search_term(query: str | None) -> str | None:
    """Normalize the search term; blank or whitespace means unfiltered."""
    if query is None:
        return None
    normalized = query.strip()
    return normalized or None


@router.get("/", response_model=ConversationsPublic)
def read_conversations(
    session: SessionDep,
    current_user: CurrentUser,
    skip: SkipParam = 0,
    limit: LimitParam = DEFAULT_PAGE_SIZE,
) -> Any:
    """
    Retrieve conversations owned by the current user, bounded and deterministic.
    """
    count = _owner_count(session, current_user, None)
    conversations = _owner_page(session, current_user, None, skip, limit)

    conversations_public = [
        ConversationPublic.model_validate(c) for c in conversations
    ]
    return ConversationsPublic(data=conversations_public, count=count)


@router.post("/search", response_model=ConversationsPublic)
def search_conversations(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    body: ConversationSearchRequest = Body(default_factory=ConversationSearchRequest),
    skip: SkipParam = 0,
    limit: LimitParam = DEFAULT_PAGE_SIZE,
) -> Any:
    """
    Search the current user's conversation titles. The term is sent in the
    request body so it never appears in the URL; pagination is bounded.
    """
    term = _search_term(body.query)
    count = _owner_count(session, current_user, term)
    conversations = _owner_page(session, current_user, term, skip, limit)

    conversations_public = [
        ConversationPublic.model_validate(c) for c in conversations
    ]
    return ConversationsPublic(data=conversations_public, count=count)


@router.get("/{id}", response_model=ConversationPublic)
def read_conversation(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Get conversation by ID.
    """
    conversation = session.get(Conversation, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return conversation


@router.post("/", response_model=ConversationPublic)
def create_conversation(
    *, session: SessionDep, current_user: CurrentUser, conversation_in: ConversationCreate
) -> Any:
    """
    Create new conversation.
    """
    conversation = Conversation.model_validate(
        conversation_in, update={"owner_id": current_user.id}
    )
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


@router.post("/{id}/triage", response_model=ConversationPublic)
def triage_conversation(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    triage_client: TriageClient = Depends(get_triage_client),
) -> ConversationPublic:
    """Run fake-backed synchronous triage on a conversation owned by the caller."""
    conversation = session.get(Conversation, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    try:
        result = run_triage(triage_client, conversation.transcript)
    except TriageTimeoutError:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Triage timed out; no result was saved.",
        ) from None
    except TriageClientError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Triage failed; no result was saved.",
        ) from None

    # Replace the previous result only after a complete, validated response.
    conversation.triage_summary = result.summary
    conversation.triage_intent = result.intent
    conversation.triage_sentiment = result.sentiment
    conversation.triage_next_action = result.next_action
    conversation.triaged_at = get_datetime_utc()
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return ConversationPublic.model_validate(conversation)


@router.put("/{id}", response_model=ConversationPublic)
def update_conversation(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    conversation_in: ConversationUpdate,
) -> Any:
    """
    Update a conversation.
    """
    conversation = session.get(Conversation, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    update_dict = conversation_in.model_dump(exclude_unset=True)
    if "transcript" in update_dict and update_dict["transcript"] != conversation.transcript:
        # A derived result is no longer trustworthy after its source text changes.
        conversation.triage_summary = None
        conversation.triage_intent = None
        conversation.triage_sentiment = None
        conversation.triage_next_action = None
        conversation.triaged_at = None
    conversation.sqlmodel_update(update_dict)
    conversation.updated_at = get_datetime_utc()
    session.add(conversation)
    session.commit()
    session.refresh(conversation)
    return conversation


@router.delete("/{id}")
def delete_conversation(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Message:
    """
    Delete a conversation.
    """
    conversation = session.get(Conversation, id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conversation.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    session.delete(conversation)
    session.commit()
    return Message(message="Conversation deleted successfully")
