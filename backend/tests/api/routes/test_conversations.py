import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import Conversation
from tests.utils.conversation import create_random_conversation
from tests.utils.user import create_random_user


def _current_user_id(client: TestClient, headers: dict[str, str]) -> uuid.UUID:
    response = client.get(f"{settings.API_V1_STR}/users/me", headers=headers)
    assert response.status_code == 200
    return uuid.UUID(response.json()["id"])


def test_create_conversation(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    data = {"title": "Project discussion", "transcript": "We discussed the project."}

    response = client.post(
        f"{settings.API_V1_STR}/conversations/",
        headers=normal_user_token_headers,
        json=data,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["transcript"] == data["transcript"]
    assert uuid.UUID(content["owner_id"]) == _current_user_id(
        client, normal_user_token_headers
    )
    assert "id" in content
    assert "created_at" in content
    assert "updated_at" in content


def test_create_conversation_rejects_too_long_title(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.post(
        f"{settings.API_V1_STR}/conversations/",
        headers=normal_user_token_headers,
        json={"title": "t" * 256, "transcript": "A short transcript."},
    )
    assert response.status_code == 422


def test_create_conversation_rejects_oversized_transcript_without_echoing_it(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    marker = "PRIVATE-TRANSCRIPT-MARKER"
    oversized_transcript = marker + ("x" * 10000)
    response = client.post(
        f"{settings.API_V1_STR}/conversations/",
        headers=normal_user_token_headers,
        json={"title": "A title", "transcript": oversized_transcript},
    )
    assert response.status_code == 422
    assert marker not in response.text


def test_read_conversation(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)

    response = client.get(
        f"{settings.API_V1_STR}/conversations/{conversation.id}",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["title"] == conversation.title
    assert content["transcript"] == conversation.transcript
    assert content["id"] == str(conversation.id)
    assert content["owner_id"] == str(owner_id)


def test_read_conversation_not_found(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/conversations/{uuid.uuid4()}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found"


def test_read_other_users_conversation_is_forbidden(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    other_user = create_random_user(db)
    assert other_user.id is not None
    conversation = create_random_conversation(db, owner_id=other_user.id)

    response = client.get(
        f"{settings.API_V1_STR}/conversations/{conversation.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403


def test_list_conversations_returns_only_current_users_records(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    own = create_random_conversation(db, owner_id=owner_id)
    other_user = create_random_user(db)
    assert other_user.id is not None
    create_random_conversation(db, owner_id=other_user.id)

    response = client.get(
        f"{settings.API_V1_STR}/conversations/",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["count"] == 1
    assert [row["id"] for row in content["data"]] == [str(own.id)]


def test_update_conversation(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)
    updated_at = datetime(2030, 1, 1, tzinfo=UTC)
    monkeypatch.setattr(
        "app.api.routes.conversations.get_datetime_utc", lambda: updated_at
    )
    data = {"title": "Updated title", "transcript": "Updated transcript."}

    response = client.put(
        f"{settings.API_V1_STR}/conversations/{conversation.id}",
        headers=normal_user_token_headers,
        json=data,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["title"] == data["title"]
    assert content["transcript"] == data["transcript"]
    assert datetime.fromisoformat(content["updated_at"]) == updated_at
    assert content["id"] == str(conversation.id)


def test_update_other_users_conversation_is_forbidden(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    other_user = create_random_user(db)
    assert other_user.id is not None
    conversation = create_random_conversation(db, owner_id=other_user.id)

    response = client.put(
        f"{settings.API_V1_STR}/conversations/{conversation.id}",
        headers=normal_user_token_headers,
        json={"title": "Attempted change"},
    )
    assert response.status_code == 403


def test_update_conversation_not_found(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.put(
        f"{settings.API_V1_STR}/conversations/{uuid.uuid4()}",
        headers=normal_user_token_headers,
        json={"title": "Updated title"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found"


def test_delete_conversation(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)
    conversation_id = conversation.id

    response = client.delete(
        f"{settings.API_V1_STR}/conversations/{conversation_id}",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Conversation deleted successfully"
    db.expire_all()
    assert db.get(Conversation, conversation_id) is None


def test_delete_other_users_conversation_is_forbidden(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    other_user = create_random_user(db)
    assert other_user.id is not None
    conversation = create_random_conversation(db, owner_id=other_user.id)

    response = client.delete(
        f"{settings.API_V1_STR}/conversations/{conversation.id}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 403


def test_delete_conversation_not_found(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    response = client.delete(
        f"{settings.API_V1_STR}/conversations/{uuid.uuid4()}",
        headers=normal_user_token_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Conversation not found"


def test_user_deletion_cascades_to_conversations(
    client: TestClient,
    superuser_token_headers: dict[str, str],
    db: Session,
) -> None:
    owner = create_random_user(db)
    assert owner.id is not None
    conversation = create_random_conversation(db, owner_id=owner.id)
    conversation_id = conversation.id

    response = client.delete(
        f"{settings.API_V1_STR}/users/{owner.id}",
        headers=superuser_token_headers,
    )

    assert response.status_code == 200
    db.expire_all()
    assert db.get(Conversation, conversation_id) is None
