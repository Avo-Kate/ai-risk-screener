"""Tests for DELETE /api/assessments/{id} and the archived flag.

Both routes are ownership-sensitive, so the 404-not-403 invariant is checked on
each of them — a destructive endpoint leaking existence would be worse than the
read endpoint doing it.
"""

import uuid

import pytest

from app.models import Assessment
from app.schemas import AssessmentResult


@pytest.fixture()
def mock_agent(monkeypatch, sample_result):
    def fake_run_assessment(payload):
        return AssessmentResult.model_validate(sample_result)

    monkeypatch.setattr("app.main.run_assessment", fake_run_assessment)


@pytest.fixture()
def make_assessment(client, auth_headers, sample_input, mock_agent):
    def _make(sub, *, project_name="Project"):
        payload = dict(sample_input, project_name=project_name)
        r = client.post("/api/assessments", json=payload, headers=auth_headers(sub))
        assert r.status_code == 200, r.text
        return r.json()["id"]

    return _make


def _names(client, auth_headers, sub, **params):
    r = client.get("/api/assessments", params=params, headers=auth_headers(sub))
    assert r.status_code == 200, r.text
    return [row["project_name"] for row in r.json()["items"]]


# --- Delete -------------------------------------------------------------------


class TestDelete:
    def test_requires_auth(self, client):
        assert client.delete("/api/assessments/1").status_code == 401

    def test_deletes_own_assessment(
        self, client, auth_headers, make_assessment, user_id, db_session
    ):
        row_id = make_assessment(user_id)

        r = client.delete(f"/api/assessments/{row_id}", headers=auth_headers(user_id))
        assert r.status_code == 204

        assert (
            client.get(
                f"/api/assessments/{row_id}", headers=auth_headers(user_id)
            ).status_code
            == 404
        )
        assert db_session.get(Assessment, row_id) is None

    def test_foreign_delete_is_404_and_leaves_the_row(
        self, client, auth_headers, make_assessment, db_session
    ):
        alice, bob = uuid.uuid4(), uuid.uuid4()
        row_id = make_assessment(alice)

        as_bob = client.delete(f"/api/assessments/{row_id}", headers=auth_headers(bob))
        missing = client.delete(
            f"/api/assessments/{row_id + 1000}", headers=auth_headers(bob)
        )

        assert as_bob.status_code == 404
        assert missing.status_code == 404
        assert as_bob.json() == missing.json()
        # Alice's row must be untouched.
        db_session.expire_all()
        assert db_session.get(Assessment, row_id) is not None


# --- Archive ------------------------------------------------------------------


class TestArchive:
    def test_new_assessments_start_active(
        self, client, auth_headers, make_assessment, user_id
    ):
        row_id = make_assessment(user_id)
        r = client.get(f"/api/assessments/{row_id}", headers=auth_headers(user_id))
        assert r.json()["archived"] is False

    def test_archiving_hides_from_the_default_list(
        self, client, auth_headers, make_assessment, user_id
    ):
        keep = make_assessment(user_id, project_name="Keep")
        shelve = make_assessment(user_id, project_name="Shelve")

        r = client.patch(
            f"/api/assessments/{shelve}",
            json={"archived": True},
            headers=auth_headers(user_id),
        )
        assert r.status_code == 200
        assert r.json()["archived"] is True

        assert _names(client, auth_headers, user_id) == ["Keep"]
        assert _names(client, auth_headers, user_id, archived=True) == ["Shelve"]
        # The row is hidden, not gone.
        assert (
            client.get(
                f"/api/assessments/{shelve}", headers=auth_headers(user_id)
            ).status_code
            == 200
        )
        assert keep

    def test_unarchiving_restores_it(
        self, client, auth_headers, make_assessment, user_id
    ):
        row_id = make_assessment(user_id, project_name="Back")
        client.patch(
            f"/api/assessments/{row_id}",
            json={"archived": True},
            headers=auth_headers(user_id),
        )
        client.patch(
            f"/api/assessments/{row_id}",
            json={"archived": False},
            headers=auth_headers(user_id),
        )
        assert _names(client, auth_headers, user_id) == ["Back"]
        assert _names(client, auth_headers, user_id, archived=True) == []

    def test_archived_rows_are_excluded_from_stats(
        self, client, auth_headers, make_assessment, user_id
    ):
        # The dashboard describes the active portfolio.
        active = make_assessment(user_id, project_name="Active")
        shelved = make_assessment(user_id, project_name="Shelved")
        client.patch(
            f"/api/assessments/{shelved}",
            json={"archived": True},
            headers=auth_headers(user_id),
        )

        body = client.get("/api/stats", headers=auth_headers(user_id)).json()
        assert body["total"] == 1
        assert sum(m["count"] for m in body["over_time"]) == 1
        assert active

    def test_patch_ignores_omitted_fields(
        self, client, auth_headers, make_assessment, user_id
    ):
        row_id = make_assessment(user_id)
        client.patch(
            f"/api/assessments/{row_id}",
            json={"archived": True},
            headers=auth_headers(user_id),
        )
        r = client.patch(
            f"/api/assessments/{row_id}", json={}, headers=auth_headers(user_id)
        )
        assert r.status_code == 200
        assert r.json()["archived"] is True

    def test_content_is_not_editable(
        self, client, auth_headers, make_assessment, user_id
    ):
        # A saved assessment records what the model said; PATCH must not become
        # a way to rewrite that.
        row_id = make_assessment(user_id, project_name="Original")
        r = client.patch(
            f"/api/assessments/{row_id}",
            json={"project_name": "Rewritten", "summary": "Rewritten"},
            headers=auth_headers(user_id),
        )
        assert r.status_code == 200
        assert r.json()["project_name"] == "Original"
        assert r.json()["summary"] != "Rewritten"

    def test_foreign_patch_is_404(self, client, auth_headers, make_assessment):
        alice, bob = uuid.uuid4(), uuid.uuid4()
        row_id = make_assessment(alice)

        r = client.patch(
            f"/api/assessments/{row_id}",
            json={"archived": True},
            headers=auth_headers(bob),
        )
        assert r.status_code == 404

    def test_requires_auth(self, client):
        assert (
            client.patch("/api/assessments/1", json={"archived": True}).status_code
            == 401
        )
