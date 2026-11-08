import uuid
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.api.routes.conversations import get_triage_client
from app.core.config import settings
from app.main import app
from app.models import (
    Conversation,
    ConversationIntent,
    ConversationNextAction,
    ConversationSentiment,
)
from app.services.triage import TriageTimeoutError
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


def test_triage_conversation_persists_typed_result(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)

    response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["triage_summary"] == "The conversation discusses a project and a follow-up."
    assert content["triage_intent"] == "request"
    assert content["triage_sentiment"] == "neutral"
    assert content["triage_next_action"] == "ask_clarifying_question"
    assert content["triaged_at"] is not None

    db.expire_all()
    stored = db.get(Conversation, conversation.id)
    assert stored is not None
    assert stored.triage_intent == ConversationIntent.REQUEST
    assert stored.triage_sentiment == ConversationSentiment.NEUTRAL
    assert stored.triage_next_action == ConversationNextAction.ASK_CLARIFYING_QUESTION
    assert stored.triaged_at is not None


def test_transcript_edit_invalidates_previous_triage(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)
    triage_response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )
    assert triage_response.status_code == 200
    assert triage_response.json()["triage_summary"] is not None

    response = client.put(
        f"{settings.API_V1_STR}/conversations/{conversation.id}",
        headers=normal_user_token_headers,
        json={"transcript": "The source conversation has materially changed."},
    )

    assert response.status_code == 200
    content = response.json()
    assert content["transcript"] == "The source conversation has materially changed."
    assert content["triage_summary"] is None
    assert content["triage_intent"] is None
    assert content["triage_sentiment"] is None
    assert content["triage_next_action"] is None
    assert content["triaged_at"] is None


def test_title_or_unchanged_transcript_edit_preserves_triage(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)
    transcript = conversation.transcript
    triage_response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )
    assert triage_response.status_code == 200
    existing_result = {
        key: triage_response.json()[key]
        for key in (
            "triage_summary",
            "triage_intent",
            "triage_sentiment",
            "triage_next_action",
            "triaged_at",
        )
    }

    for update in ({"title": "A new title"}, {"transcript": transcript}):
        response = client.put(
            f"{settings.API_V1_STR}/conversations/{conversation.id}",
            headers=normal_user_token_headers,
            json=update,
        )
        assert response.status_code == 200
        assert {
            key: response.json()[key] for key in existing_result
        } == existing_result


def test_database_rejects_partially_populated_triage_result(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)
    conversation.triage_summary = "Partial result"
    db.add(conversation)

    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_successful_retriage_replaces_previous_result(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)

    first = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )
    assert first.status_code == 200
    first_triaged_at = first.json()["triaged_at"]

    class ReplacementClient:
        def triage(self, transcript: str) -> str:
            return (
                '{"summary":"A different valid result.","intent":"feedback",'
                '"sentiment":"positive","next_action":"respond"}'
            )

    monkeypatch.setitem(
        app.dependency_overrides, get_triage_client, lambda: ReplacementClient()
    )
    response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 200
    content = response.json()
    assert content["triage_summary"] == "A different valid result."
    assert content["triage_intent"] == "feedback"
    assert content["triage_sentiment"] == "positive"
    assert content["triage_next_action"] == "respond"
    assert content["triaged_at"] != first_triaged_at


def test_failed_retriage_keeps_previous_result_and_hides_raw_output(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)
    first = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )
    assert first.status_code == 200
    previous_result = {
        key: first.json()[key]
        for key in (
            "triage_summary",
            "triage_intent",
            "triage_sentiment",
            "triage_next_action",
            "triaged_at",
        )
    }

    private_marker = "PRIVATE-RAW-TRIAGE-RESPONSE"

    class InvalidClient:
        def triage(self, transcript: str) -> str:
            return f"{{malformed {private_marker}"

    monkeypatch.setitem(app.dependency_overrides, get_triage_client, lambda: InvalidClient())
    response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 502
    assert private_marker not in response.text
    db.expire_all()
    stored = db.get(Conversation, conversation.id)
    assert stored is not None
    assert stored.triage_summary == previous_result["triage_summary"]
    assert stored.triage_intent == previous_result["triage_intent"]
    assert stored.triage_sentiment == previous_result["triage_sentiment"]
    assert stored.triage_next_action == previous_result["triage_next_action"]
    assert stored.triaged_at.isoformat().replace("+00:00", "Z") == previous_result["triaged_at"]


def test_triage_timeout_is_safe_and_not_retried(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_id = _current_user_id(client, normal_user_token_headers)
    conversation = create_random_conversation(db, owner_id=owner_id)

    class TimeoutClient:
        calls = 0

        def triage(self, transcript: str) -> str:
            self.calls += 1
            raise TriageTimeoutError("private timeout details")

    fake = TimeoutClient()
    monkeypatch.setitem(app.dependency_overrides, get_triage_client, lambda: fake)
    response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 504
    assert response.json()["detail"] == "Triage timed out; no result was saved."
    assert fake.calls == 1
    db.expire_all()
    stored = db.get(Conversation, conversation.id)
    assert stored is not None
    assert stored.triage_summary is None
    assert stored.triaged_at is None


def test_other_user_cannot_triage_conversation(
    client: TestClient,
    normal_user_token_headers: dict[str, str],
    db: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    other_user = create_random_user(db)
    assert other_user.id is not None
    conversation = create_random_conversation(db, owner_id=other_user.id)

    class MustNotRunClient:
        calls = 0

        def triage(self, transcript: str) -> str:
            self.calls += 1
            raise AssertionError("Unauthorized call must not reach the triage client")

    fake = MustNotRunClient()
    monkeypatch.setitem(app.dependency_overrides, get_triage_client, lambda: fake)
    response = client.post(
        f"{settings.API_V1_STR}/conversations/{conversation.id}/triage",
        headers=normal_user_token_headers,
    )

    assert response.status_code == 403
    assert fake.calls == 0
