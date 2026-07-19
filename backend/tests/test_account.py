"""Tests for DELETE /api/me — per-user data deletion (session 1.3)."""

import uuid

import pytest

from app.models import Assessment, User
from app.schemas import AssessmentResult


@pytest.fixture()
def mock_agent(monkeypatch, sample_result):
    def fake_run_assessment(payload):
        return AssessmentResult.model_validate(sample_result)

    monkeypatch.setattr("app.main.run_assessment", fake_run_assessment)


def _create(client, auth_headers, sample_input, sub):
    r = client.post("/api/assessments", json=sample_input, headers=auth_headers(sub))
    assert r.status_code == 200, r.text
    return r.json()


class TestDeleteMyData:
    def test_requires_auth(self, client):
        assert client.delete("/api/me").status_code == 401

    def test_deletes_own_assessments_and_user_row(
        self, client, auth_headers, sample_input, mock_agent, db_session, user_id
    ):
        _create(client, auth_headers, sample_input, user_id)
        _create(client, auth_headers, sample_input, user_id)

        r = client.delete("/api/me", headers=auth_headers(user_id))
        assert r.status_code == 200
        assert r.json() == {"deleted_assessments": 2}

        assert db_session.query(Assessment).count() == 0
        assert db_session.get(User, user_id) is None

    def test_does_not_touch_other_users_data(
        self, client, auth_headers, sample_input, mock_agent, db_session
    ):
        alice, bob = uuid.uuid4(), uuid.uuid4()
        _create(client, auth_headers, sample_input, alice)
        kept = _create(client, auth_headers, sample_input, bob)

        client.delete("/api/me", headers=auth_headers(alice))

        db_session.expire_all()
        assert db_session.get(User, alice) is None
        assert db_session.get(User, bob) is not None
        rows = db_session.query(Assessment).all()
        assert [row.id for row in rows] == [kept["id"]]
        assert rows[0].user_id == bob

    def test_delete_with_no_data_is_ok(self, client, auth_headers, user_id):
        r = client.delete("/api/me", headers=auth_headers(user_id))
        assert r.status_code == 200
        assert r.json() == {"deleted_assessments": 0}

    def test_user_is_recreated_on_next_request(
        self, client, auth_headers, db_session, user_id
    ):
        # Deleting app data must not lock the account out: the Supabase login
        # still exists, so the next authenticated request upserts a fresh row.
        client.get("/api/assessments", headers=auth_headers(user_id))
        client.delete("/api/me", headers=auth_headers(user_id))

        r = client.get("/api/assessments", headers=auth_headers(user_id))
        assert r.status_code == 200
        assert r.json() == []
        db_session.expire_all()
        assert db_session.get(User, user_id) is not None
