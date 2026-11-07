import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
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

router = APIRouter(prefix="/conversations", tags=["conversations"])


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
