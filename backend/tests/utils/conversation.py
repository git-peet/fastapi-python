import uuid

from sqlmodel import Session

from app.models import Conversation


def create_random_conversation(
    db: Session,
    *,
    owner_id: uuid.UUID,
    title: str = "Test conversation",
    transcript: str = "A safe test transcript.",
) -> Conversation:
    """Create a conversation row for an explicitly supplied owner."""
    conversation = Conversation(
        owner_id=owner_id,
        title=title,
        transcript=transcript,
    )
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation
