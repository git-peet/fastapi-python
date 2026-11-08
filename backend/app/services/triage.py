import json
from typing import Protocol

from pydantic import ValidationError

from app.models import ConversationTriageResult


class TriageClientError(Exception):
    """A client-side failure that is safe to handle at the API boundary."""


class TriageTimeoutError(TriageClientError):
    """The triage client did not return before its deadline."""


class InvalidTriageResultError(TriageClientError):
    """The client response was not valid JSON matching the triage contract."""


class TriageClient(Protocol):
    """Synchronous boundary between triage logic and its result source."""

    def triage(self, transcript: str) -> str:
        """Return raw JSON text for the service to parse and validate."""
        ...


class FakeTriageClient:
    """Deterministic local fake; it does not call a model or echo the transcript."""

    _response = (
        '{"summary":"The conversation discusses a project and a follow-up.",'
        '"intent":"request","sentiment":"neutral",'
        '"next_action":"ask_clarifying_question"}'
    )

    def triage(self, transcript: str) -> str:
        # Accept the transcript to match the client contract, but never inspect,
        # include, or log it. The fake response is stable for local development.
        del transcript
        return self._response


def validate_triage_response(raw_response: str) -> ConversationTriageResult:
    """Parse untrusted client text and validate it without exposing its contents."""
    try:
        payload = json.loads(raw_response)
        return ConversationTriageResult.model_validate(payload)
    except (json.JSONDecodeError, TypeError, ValidationError):
        raise InvalidTriageResultError("Triage client returned an invalid result") from None


def run_triage(client: TriageClient, transcript: str) -> ConversationTriageResult:
    """Call once, parse once, and do not retry in this initial fake-backed slice."""
    try:
        raw_response = client.triage(transcript)
    except TriageTimeoutError:
        raise
    except TriageClientError:
        raise
    except TimeoutError:
        raise TriageTimeoutError("Triage request timed out") from None
    except Exception:
        # Do not leak exception messages which might contain transcripts or output.
        raise TriageClientError("Triage client failed") from None

    return validate_triage_response(raw_response)
