"""Unit tests for app/agent.py: JSON extraction, the retry loop, error mapping.

The Anthropic client is always faked (`_client` is monkeypatched); no test here
makes a network call.
"""

import json
from types import SimpleNamespace

import anthropic
import httpx
import pytest

from app import agent
from app.agent import (
    APIKeyMissingError,
    AssessmentParseError,
    UpstreamError,
    _extract_json,
    run_assessment,
)
from app.schemas import AssessmentInput, AssessmentResult

# --- Fakes --------------------------------------------------------------------


def _text_response(text: str):
    """Shape-compatible stand-in for an Anthropic Message with one text block."""
    return SimpleNamespace(content=[SimpleNamespace(type="text", text=text)])


class FakeClient:
    """Replays a scripted list of outcomes (responses or exceptions to raise)
    and records every messages.create call for assertions."""

    def __init__(self, outcomes):
        self._outcomes = list(outcomes)
        self.calls = []
        self.messages = SimpleNamespace(create=self._create)

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _api_error(cls, status: int):
    """Construct a real anthropic API error (they require an httpx response)."""
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    response = httpx.Response(status, request=request)
    return cls("simulated upstream error", response=response, body=None)


@pytest.fixture()
def agent_input(sample_input):
    return AssessmentInput(**sample_input)


def _use(monkeypatch, fake_client):
    monkeypatch.setattr(agent, "_client", lambda: fake_client)


# --- _extract_json ------------------------------------------------------------


class TestExtractJson:
    def test_clean_json(self):
        assert _extract_json('{"a": 1}') == {"a": 1}

    def test_padded_json(self):
        assert _extract_json('  \n {"a": 1} \n ') == {"a": 1}

    def test_fenced_json_with_language(self):
        assert _extract_json('```json\n{"a": 1}\n```') == {"a": 1}

    def test_fenced_json_without_language(self):
        assert _extract_json('```\n{"a": 1}\n```') == {"a": 1}

    def test_json_wrapped_in_prose(self):
        text = 'Here is the assessment:\n{"a": {"nested": true}}\nHope this helps!'
        assert _extract_json(text) == {"a": {"nested": True}}

    def test_no_json_raises(self):
        with pytest.raises(ValueError):
            _extract_json("I am unable to produce an assessment.")


# --- run_assessment: happy path -----------------------------------------------


class TestRunAssessment:
    def test_valid_first_response(self, monkeypatch, agent_input, sample_result):
        fake = FakeClient([_text_response(json.dumps(sample_result))])
        _use(monkeypatch, fake)

        result = run_assessment(agent_input)

        assert isinstance(result, AssessmentResult)
        assert result.overall_risk_level == "high"
        assert result.frameworks[0].name == "EU AI Act"
        assert len(fake.calls) == 1

    def test_system_prompt_is_cached(self, monkeypatch, agent_input, sample_result):
        # Invariant (see CLAUDE.md): the static system prompt is sent with
        # cache_control so repeated assessments reuse the prompt cache.
        fake = FakeClient([_text_response(json.dumps(sample_result))])
        _use(monkeypatch, fake)

        run_assessment(agent_input)

        system = fake.calls[0]["system"]
        assert system[0]["text"] == agent.SYSTEM_PROMPT
        assert system[0]["cache_control"] == {"type": "ephemeral"}

    def test_levels_are_normalized_to_lowercase(
        self, monkeypatch, agent_input, sample_result
    ):
        sample_result["overall_risk_level"] = "High"
        sample_result["risks"][0]["severity"] = "HIGH"
        sample_result["frameworks"][0]["applicability"] = "Partially Applies"
        fake = FakeClient([_text_response(json.dumps(sample_result))])
        _use(monkeypatch, fake)

        result = run_assessment(agent_input)

        assert result.overall_risk_level == "high"
        assert result.risks[0].severity == "high"
        assert result.frameworks[0].applicability == "partially applies"

    def test_missing_disclaimer_gets_default(
        self, monkeypatch, agent_input, sample_result
    ):
        # Invariant: a missing disclaimer must never block a save.
        del sample_result["disclaimer"]
        fake = FakeClient([_text_response(json.dumps(sample_result))])
        _use(monkeypatch, fake)

        result = run_assessment(agent_input)

        assert "not legal advice" in result.disclaimer

    def test_non_text_blocks_are_ignored(self, monkeypatch, agent_input, sample_result):
        response = SimpleNamespace(
            content=[
                SimpleNamespace(type="thinking", thinking="…"),
                SimpleNamespace(type="text", text=json.dumps(sample_result)),
            ]
        )
        fake = FakeClient([response])
        _use(monkeypatch, fake)

        assert run_assessment(agent_input).overall_risk_level == "high"


# --- run_assessment: retry loop -----------------------------------------------


class TestRetryLoop:
    def test_retries_once_then_succeeds(self, monkeypatch, agent_input, sample_result):
        bad_text = "I'm sorry, I can only describe the risks in prose."
        fake = FakeClient(
            [_text_response(bad_text), _text_response(json.dumps(sample_result))]
        )
        _use(monkeypatch, fake)

        result = run_assessment(agent_input)

        assert result.overall_risk_level == "high"
        assert len(fake.calls) == 2
        # The retry must feed the bad output back with a corrective instruction.
        retry_messages = fake.calls[1]["messages"]
        assert len(retry_messages) == 3
        assert retry_messages[1] == {"role": "assistant", "content": bad_text}
        assert "ONLY the JSON" in retry_messages[2]["content"]

    def test_schema_violation_also_triggers_retry(
        self, monkeypatch, agent_input, sample_result
    ):
        # Valid JSON but an out-of-vocabulary risk level → ValidationError → retry.
        invalid = dict(sample_result, overall_risk_level="extreme")
        fake = FakeClient(
            [
                _text_response(json.dumps(invalid)),
                _text_response(json.dumps(sample_result)),
            ]
        )
        _use(monkeypatch, fake)

        assert run_assessment(agent_input).overall_risk_level == "high"
        assert len(fake.calls) == 2

    def test_raises_after_exactly_two_attempts(self, monkeypatch, agent_input):
        # Invariant: initial attempt + one retry, then AssessmentParseError.
        fake = FakeClient([_text_response("no json"), _text_response("still no json")])
        _use(monkeypatch, fake)

        with pytest.raises(AssessmentParseError):
            run_assessment(agent_input)
        assert len(fake.calls) == 2


# --- run_assessment: error mapping --------------------------------------------


class TestErrorMapping:
    def test_missing_api_key(self, monkeypatch, agent_input):
        monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

        with pytest.raises(APIKeyMissingError):
            run_assessment(agent_input)

    @pytest.mark.parametrize(
        "upstream",
        [
            _api_error(anthropic.AuthenticationError, 401),
            _api_error(anthropic.RateLimitError, 429),
        ],
        ids=["authentication", "rate-limit"],
    )
    def test_upstream_errors_map_and_do_not_retry(
        self, monkeypatch, agent_input, upstream
    ):
        fake = FakeClient([upstream])
        _use(monkeypatch, fake)

        with pytest.raises(UpstreamError):
            run_assessment(agent_input)
        assert len(fake.calls) == 1
