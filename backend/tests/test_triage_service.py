import pytest

from app.models import (
    ConversationIntent,
    ConversationNextAction,
    ConversationSentiment,
    ConversationTriageResult,
)
from app.services.triage import (
    FakeTriageClient,
    InvalidTriageResultError,
    TriageClientError,
    TriageTimeoutError,
    run_triage,
    validate_triage_response,
)

VALID_RESPONSE = (
    '{"summary":"A short summary.","intent":"request",'
    '"sentiment":"neutral","next_action":"ask_clarifying_question"}'
)


@pytest.mark.parametrize(
    "raw_response",
    [
        '{"summary":',
        '{"summary":"Missing the other fields"}',
        '{"summary":"Test","intent":"unknown","sentiment":"neutral","next_action":"respond"}',
        '{"summary":"","intent":"request","sentiment":"neutral","next_action":"respond"}',
        '{"summary":"' + ("x" * 501) + '","intent":"request","sentiment":"neutral","next_action":"respond"}',
    ],
    ids=["malformed-json", "missing-fields", "invalid-enum", "empty-summary", "oversized-summary"],
)
def test_invalid_client_result_is_rejected_without_echoing_payload(
    raw_response: str,
) -> None:
    marker = "PRIVATE-TRIAGE-PAYLOAD"
    payload = raw_response + marker

    with pytest.raises(InvalidTriageResultError) as error:
        validate_triage_response(payload)

    assert marker not in str(error.value)
    assert "PRIVATE-TRIAGE-PAYLOAD" not in str(error.value)


def test_valid_response_is_parsed_into_typed_result() -> None:
    result = validate_triage_response(VALID_RESPONSE)

    assert result == ConversationTriageResult(
        summary="A short summary.",
        intent=ConversationIntent.REQUEST,
        sentiment=ConversationSentiment.NEUTRAL,
        next_action=ConversationNextAction.ASK_CLARIFYING_QUESTION,
    )


def test_fake_client_is_deterministic_and_does_not_echo_transcript() -> None:
    client = FakeTriageClient()
    private_transcript = "PRIVATE-TRANSCRIPT-CONTENT"

    first = client.triage(private_transcript)
    second = client.triage(private_transcript)

    assert first == second
    assert private_transcript not in first
    assert validate_triage_response(first).intent == ConversationIntent.REQUEST


def test_timeout_is_propagated_once_without_retry() -> None:
    class TimeoutClient:
        calls = 0

        def triage(self, transcript: str) -> str:
            self.calls += 1
            raise TriageTimeoutError("timeout")

    client = TimeoutClient()
    with pytest.raises(TriageTimeoutError):
        run_triage(client, "A private transcript")

    assert client.calls == 1


def test_client_error_is_propagated_once_without_retry() -> None:
    class FailingClient:
        calls = 0

        def triage(self, transcript: str) -> str:
            self.calls += 1
            raise TriageClientError("client failed")

    client = FailingClient()
    with pytest.raises(TriageClientError):
        run_triage(client, "A private transcript")

    assert client.calls == 1
