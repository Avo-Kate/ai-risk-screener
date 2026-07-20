"""API route tests: auth requirements, per-user isolation (404-not-403),
denormalised-column consistency, agent error → HTTP status mapping.

`run_assessment` is always monkeypatched at the `app.main` import site — no
test here calls the model.
"""

import uuid

import pytest

from app.agent import APIKeyMissingError, AssessmentParseError, UpstreamError
from app.models import Assessment
from app.schemas import AssessmentResult


@pytest.fixture()
def mock_agent(monkeypatch, sample_result):
    """Replace the agent with one that returns sample_result instantly."""

    def fake_run_assessment(payload):
        return AssessmentResult.model_validate(sample_result)

    monkeypatch.setattr("app.main.run_assessment", fake_run_assessment)
    return fake_run_assessment


def _create(client, auth_headers, sample_input, sub, **input_overrides):
    payload = dict(sample_input, **input_overrides)
    r = client.post("/api/assessments", json=payload, headers=auth_headers(sub))
    assert r.status_code == 200, r.text
    return r.json()


# --- Auth is required everywhere ----------------------------------------------


class TestAuthRequired:
    def test_health_needs_no_auth(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_post_requires_auth(self, client, sample_input):
        # Valid body, no token: must be 401, never a validation response.
        assert client.post("/api/assessments", json=sample_input).status_code == 401

    def test_list_requires_auth(self, client):
        assert client.get("/api/assessments").status_code == 401

    def test_get_requires_auth(self, client):
        assert client.get("/api/assessments/1").status_code == 401

    @pytest.mark.parametrize(
        "header", ["Basic abc123", "Bearer ", "bearer-token-without-scheme"]
    )
    def test_malformed_authorization_header_is_401(self, client, header):
        r = client.get("/api/assessments", headers={"Authorization": header})
        assert r.status_code == 401


# --- Create -------------------------------------------------------------------


class TestCreateAssessment:
    def test_create_returns_full_record(
        self, client, auth_headers, sample_input, sample_result, mock_agent, user_id
    ):
        body = _create(client, auth_headers, sample_input, user_id)

        assert body["project_name"] == sample_input["project_name"]
        assert body["overall_risk_level"] == sample_result["overall_risk_level"]
        assert body["summary"] == sample_result["summary"]
        assert (
            body["input"]["use_case_description"]
            == (sample_input["use_case_description"])
        )
        assert body["result"]["frameworks"][0]["name"] == "EU AI Act"
        assert "id" in body and "created_at" in body

    def test_denormalised_columns_match_result_json(
        self, client, auth_headers, sample_input, mock_agent, db_session, user_id
    ):
        # Invariant (see CLAUDE.md): project_name / overall_risk_level / summary
        # are denormalised copies and must stay consistent with the JSON blobs.
        _create(client, auth_headers, sample_input, user_id)

        row = db_session.query(Assessment).one()
        assert row.overall_risk_level == row.result_json["overall_risk_level"]
        assert row.summary == row.result_json["summary"]
        assert row.project_name == row.input_json["project_name"]
        assert row.user_id == user_id

    def test_blank_project_name_defaults(
        self, client, auth_headers, sample_input, mock_agent, user_id
    ):
        body = _create(client, auth_headers, sample_input, user_id, project_name="   ")
        assert body["project_name"] == "Untitled project"

    @pytest.mark.parametrize(
        "bad_field",
        [
            {"industry": "space mining"},
            {"deployment_context": "orbital"},
            {"data_types": ["telepathic data"]},
            {"geographic_scope": ["Mars"]},
            {"use_case_description": "too short"},
        ],
        ids=["industry", "deployment", "data-types", "geo-scope", "short-description"],
    )
    def test_out_of_vocabulary_input_is_422(
        self, client, auth_headers, sample_input, mock_agent, user_id, bad_field
    ):
        # Guard for the controlled-vocabulary invariant: the backend must
        # reject values the (mirrored) frontend form does not offer.
        payload = dict(sample_input, **bad_field)
        r = client.post("/api/assessments", json=payload, headers=auth_headers(user_id))
        assert r.status_code == 422

    @pytest.mark.parametrize(
        ("exc", "status"),
        [
            (APIKeyMissingError("key not set"), 503),
            (UpstreamError("anthropic said no"), 502),
            (AssessmentParseError("no valid JSON after retry"), 502),
        ],
        ids=["missing-key", "upstream", "parse"],
    )
    def test_agent_errors_map_to_http_status(
        self, client, auth_headers, sample_input, monkeypatch, user_id, exc, status
    ):
        def raise_exc(payload):
            raise exc

        monkeypatch.setattr("app.main.run_assessment", raise_exc)

        r = client.post(
            "/api/assessments", json=sample_input, headers=auth_headers(user_id)
        )
        assert r.status_code == status
        assert r.json()["detail"] == str(exc)


# --- List & get: per-user isolation -------------------------------------------


class TestOwnership:
    def test_list_returns_only_own_rows_newest_first(
        self, client, auth_headers, sample_input, mock_agent
    ):
        alice, bob = uuid.uuid4(), uuid.uuid4()
        first = _create(
            client, auth_headers, sample_input, alice, project_name="Alice one"
        )
        second = _create(
            client, auth_headers, sample_input, alice, project_name="Alice two"
        )
        _create(client, auth_headers, sample_input, bob, project_name="Bob one")

        r = client.get("/api/assessments", headers=auth_headers(alice))
        assert r.status_code == 200
        body = r.json()
        assert [row["id"] for row in body["items"]] == [second["id"], first["id"]]
        assert all(row["project_name"].startswith("Alice") for row in body["items"])
        # total counts only Alice's rows, never Bob's.
        assert body["total"] == 2

    def test_list_is_summary_shaped(
        self, client, auth_headers, sample_input, mock_agent, user_id
    ):
        _create(client, auth_headers, sample_input, user_id)
        body = client.get("/api/assessments", headers=auth_headers(user_id)).json()
        row = body["items"][0]
        # Summaries must stay light: no JSON blobs in the list view.
        assert "input" not in row and "result" not in row

    def test_get_own_assessment(
        self, client, auth_headers, sample_input, mock_agent, user_id
    ):
        created = _create(client, auth_headers, sample_input, user_id)
        r = client.get(
            f"/api/assessments/{created['id']}", headers=auth_headers(user_id)
        )
        assert r.status_code == 200
        assert r.json()["id"] == created["id"]

    def test_foreign_assessment_is_404_not_403(
        self, client, auth_headers, sample_input, mock_agent
    ):
        # Invariant (see CLAUDE.md): another user's assessment must be
        # indistinguishable from a nonexistent one — 404 with an identical
        # body, so the endpoint never leaks that the id exists.
        alice, bob = uuid.uuid4(), uuid.uuid4()
        created = _create(client, auth_headers, sample_input, alice)

        as_bob = client.get(
            f"/api/assessments/{created['id']}", headers=auth_headers(bob)
        )
        missing = client.get(
            f"/api/assessments/{created['id'] + 1000}", headers=auth_headers(bob)
        )

        assert as_bob.status_code == 404
        assert missing.status_code == 404
        assert as_bob.json() == missing.json()
