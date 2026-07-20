"""Tests for versioned re-assessment.

The behaviour that matters: a re-run never overwrites the earlier verdict, the
list shows only the newest version of each family, and every version stays
reachable through the history endpoint from any member of the family.
"""

import uuid

import pytest

from app.schemas import AssessmentResult


@pytest.fixture()
def mock_agent(monkeypatch, sample_result):
    """Agent whose risk level can be changed between runs, to tell versions apart."""
    state = {"risk": "high", "summary": sample_result["summary"]}

    def fake_run_assessment(payload):
        return AssessmentResult.model_validate(
            dict(
                sample_result,
                overall_risk_level=state["risk"],
                summary=state["summary"],
            )
        )

    monkeypatch.setattr("app.main.run_assessment", fake_run_assessment)
    return state


@pytest.fixture()
def create(client, auth_headers, sample_input, mock_agent):
    def _create(sub, **overrides):
        payload = dict(sample_input, **overrides)
        r = client.post("/api/assessments", json=payload, headers=auth_headers(sub))
        assert r.status_code == 200, r.text
        return r.json()

    return _create


@pytest.fixture()
def revise(client, auth_headers, sample_input):
    def _revise(sub, assessment_id, **overrides):
        payload = dict(sample_input, **overrides)
        r = client.post(
            f"/api/assessments/{assessment_id}/revise",
            json=payload,
            headers=auth_headers(sub),
        )
        return r

    return _revise


def _list(client, auth_headers, sub, **params):
    r = client.get("/api/assessments", params=params, headers=auth_headers(sub))
    assert r.status_code == 200, r.text
    return r.json()


class TestReviseCreatesVersions:
    def test_first_assessment_is_version_one(self, create, user_id):
        assert create(user_id)["version"] == 1
        assert create(user_id)["parent_id"] is None

    def test_revision_increments_version_and_points_at_the_root(
        self, create, revise, user_id
    ):
        original = create(user_id, project_name="Screening tool")
        r = revise(user_id, original["id"], project_name="Screening tool v2")
        assert r.status_code == 200

        v2 = r.json()
        assert v2["version"] == 2
        assert v2["parent_id"] == original["id"]
        assert v2["id"] != original["id"]

    def test_third_version_still_points_at_the_root_not_the_predecessor(
        self, create, revise, user_id
    ):
        # parent_id is a root pointer, so v3's parent is v1 — this is what keeps
        # "show all versions" a single equality test instead of a recursion.
        original = create(user_id)
        v2 = revise(user_id, original["id"]).json()
        v3 = revise(user_id, v2["id"]).json()

        assert v3["version"] == 3
        assert v3["parent_id"] == original["id"]

    def test_revising_an_old_version_continues_the_family_numbering(
        self, create, revise, user_id
    ):
        # Opening v1 and revising it must not collide with the existing v2.
        original = create(user_id)
        revise(user_id, original["id"])  # v2
        from_v1 = revise(user_id, original["id"]).json()

        assert from_v1["version"] == 3
        assert from_v1["parent_id"] == original["id"]

    def test_earlier_version_is_left_untouched(
        self, client, auth_headers, create, revise, user_id, mock_agent
    ):
        mock_agent["risk"] = "high"
        original = create(user_id)

        mock_agent["risk"] = "low"
        revise(user_id, original["id"])

        r = client.get(
            f"/api/assessments/{original['id']}", headers=auth_headers(user_id)
        )
        assert r.status_code == 200
        assert r.json()["overall_risk_level"] == "high"


class TestListShowsLatestOnly:
    def test_list_hides_superseded_versions(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id, project_name="Original name")
        v2 = revise(user_id, original["id"], project_name="Revised name").json()

        body = _list(client, auth_headers, user_id)
        assert [row["id"] for row in body["items"]] == [v2["id"]]
        assert body["total"] == 1

    def test_list_reports_the_version_count(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id)
        revise(user_id, original["id"])
        revise(user_id, original["id"])

        row = _list(client, auth_headers, user_id)["items"][0]
        assert row["version"] == 3
        assert row["version_count"] == 3

    def test_unrevised_assessment_reports_a_count_of_one(
        self, client, auth_headers, create, user_id
    ):
        create(user_id)
        row = _list(client, auth_headers, user_id)["items"][0]
        assert row["version"] == 1
        assert row["version_count"] == 1

    def test_separate_families_are_counted_separately(
        self, client, auth_headers, create, revise, user_id
    ):
        a = create(user_id, project_name="Family A")
        create(user_id, project_name="Family B")
        revise(user_id, a["id"], project_name="Family A")

        body = _list(client, auth_headers, user_id)
        assert body["total"] == 2
        counts = {row["project_name"]: row["version_count"] for row in body["items"]}
        assert counts == {"Family A": 2, "Family B": 1}

    def test_another_users_versions_do_not_affect_the_list(
        self, client, auth_headers, create, revise, user_id
    ):
        other = uuid.uuid4()
        create(other, project_name="Theirs")
        mine = create(user_id, project_name="Mine")
        revise(user_id, mine["id"], project_name="Mine")

        body = _list(client, auth_headers, user_id)
        assert [row["project_name"] for row in body["items"]] == ["Mine"]
        assert body["total"] == 1


class TestVersionHistory:
    def test_lists_every_version_newest_first(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id)
        v2 = revise(user_id, original["id"]).json()
        v3 = revise(user_id, original["id"]).json()

        r = client.get(
            f"/api/assessments/{v3['id']}/versions", headers=auth_headers(user_id)
        )
        assert r.status_code == 200
        assert [row["version"] for row in r.json()] == [3, 2, 1]
        assert [row["id"] for row in r.json()] == [v3["id"], v2["id"], original["id"]]

    def test_reachable_from_any_member_of_the_family(
        self, client, auth_headers, create, revise, user_id
    ):
        # A bookmarked v1 URL must still show the full history.
        original = create(user_id)
        revise(user_id, original["id"])

        from_root = client.get(
            f"/api/assessments/{original['id']}/versions",
            headers=auth_headers(user_id),
        ).json()
        assert [row["version"] for row in from_root] == [2, 1]

    def test_single_version_family_returns_just_itself(
        self, client, auth_headers, create, user_id
    ):
        original = create(user_id)
        r = client.get(
            f"/api/assessments/{original['id']}/versions", headers=auth_headers(user_id)
        )
        assert [row["id"] for row in r.json()] == [original["id"]]

    def test_foreign_history_is_404(self, client, auth_headers, create):
        alice, bob = uuid.uuid4(), uuid.uuid4()
        original = create(alice)
        r = client.get(
            f"/api/assessments/{original['id']}/versions", headers=auth_headers(bob)
        )
        assert r.status_code == 404


class TestDeletingVersions:
    """Deleting one version must never take the rest of the family with it.

    The root is the dangerous case: later versions reference it, so a cascading
    delete would silently destroy the whole history.
    """

    def test_deleting_a_later_version_keeps_the_others(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id)
        v2 = revise(user_id, original["id"]).json()
        v3 = revise(user_id, original["id"]).json()

        assert (
            client.delete(
                f"/api/assessments/{v3['id']}", headers=auth_headers(user_id)
            ).status_code
            == 204
        )

        history = client.get(
            f"/api/assessments/{original['id']}/versions",
            headers=auth_headers(user_id),
        ).json()
        assert [row["id"] for row in history] == [v2["id"], original["id"]]

    def test_deleting_the_root_keeps_the_later_versions(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id)
        v2 = revise(user_id, original["id"]).json()
        v3 = revise(user_id, original["id"]).json()

        assert (
            client.delete(
                f"/api/assessments/{original['id']}", headers=auth_headers(user_id)
            ).status_code
            == 204
        )

        # Both survivors must still exist and still be one family.
        for row_id in (v2["id"], v3["id"]):
            assert (
                client.get(
                    f"/api/assessments/{row_id}", headers=auth_headers(user_id)
                ).status_code
                == 200
            )

        history = client.get(
            f"/api/assessments/{v3['id']}/versions", headers=auth_headers(user_id)
        ).json()
        assert [row["version"] for row in history] == [3, 2]

    def test_list_still_shows_one_row_after_the_root_is_deleted(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id, project_name="Family")
        revise(user_id, original["id"], project_name="Family")
        v3 = revise(user_id, original["id"], project_name="Family").json()

        client.delete(
            f"/api/assessments/{original['id']}", headers=auth_headers(user_id)
        )

        body = client.get("/api/assessments", headers=auth_headers(user_id)).json()
        assert body["total"] == 1
        assert body["items"][0]["id"] == v3["id"]
        assert body["items"][0]["version_count"] == 2

    def test_revising_after_the_root_was_deleted_keeps_numbering(
        self, client, auth_headers, create, revise, user_id
    ):
        original = create(user_id)
        revise(user_id, original["id"])  # v2
        client.delete(
            f"/api/assessments/{original['id']}", headers=auth_headers(user_id)
        )

        # v2 is the new root; the next revision must be v3, not v2 again.
        body = client.get("/api/assessments", headers=auth_headers(user_id)).json()
        survivor = body["items"][0]["id"]
        assert revise(user_id, survivor).json()["version"] == 3


class TestReviseAuthAndErrors:
    def test_requires_auth(self, client, sample_input):
        r = client.post("/api/assessments/1/revise", json=sample_input)
        assert r.status_code == 401

    def test_revising_someone_elses_assessment_is_404(
        self, create, revise, sample_input
    ):
        alice, bob = uuid.uuid4(), uuid.uuid4()
        original = create(alice)
        assert revise(bob, original["id"]).status_code == 404

    def test_revising_a_missing_assessment_is_404(self, revise, user_id):
        assert revise(user_id, 999999).status_code == 404

    def test_agent_failure_does_not_create_a_version(
        self, client, auth_headers, create, sample_input, monkeypatch, user_id
    ):
        from app.agent import UpstreamError

        original = create(user_id)

        def boom(payload):
            raise UpstreamError("anthropic said no")

        monkeypatch.setattr("app.main.run_assessment", boom)

        r = client.post(
            f"/api/assessments/{original['id']}/revise",
            json=sample_input,
            headers=auth_headers(user_id),
        )
        assert r.status_code == 502

        history = client.get(
            f"/api/assessments/{original['id']}/versions",
            headers=auth_headers(user_id),
        ).json()
        assert len(history) == 1
