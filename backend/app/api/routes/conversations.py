import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
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


def get_triage_client() -> TriageClient:
    """Provide the deterministic fake until a separate provider PBI is approved."""
    return FakeTriageClient()


@router.get("/", response_model=ConversationsPublic)
def read_conversations(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve conversations owned by the current user.
    """
    count_statement = (
        select(func.count())
        .select_from(Conversation)
        .where(Conversation.owner_id == current_user.id)
    )
    count = session.exec(count_statement).one()
    statement = (
        select(Conversation)
        .where(Conversation.owner_id == current_user.id)
        .order_by(col(Conversation.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    conversations = session.exec(statement).all()

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
