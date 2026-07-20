"""Tests for the list endpoint's search, filter, sort and pagination params.

Every case also implicitly re-checks the ownership invariant: a query param must
never widen the result set beyond the caller's own rows.

`run_assessment` is monkeypatched throughout — no test here calls the model.
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Assessment
from app.schemas import AssessmentResult


@pytest.fixture()
def mock_agent(monkeypatch, sample_result):
    def fake_run_assessment(payload):
        return AssessmentResult.model_validate(sample_result)

    monkeypatch.setattr("app.main.run_assessment", fake_run_assessment)


@pytest.fixture()
def make_assessment(client, auth_headers, sample_input, mock_agent, db_session):
    """Create an assessment via the API, then force denormalised fields.

    Going through the API keeps the row realistic; the direct update afterwards
    is how tests get control over created_at and risk level, which the agent
    would otherwise decide.
    """

    def _make(
        sub,
        *,
        project_name="Project",
        summary=None,
        industry=None,
        risk=None,
        created_at=None,
    ):
        payload = dict(sample_input, project_name=project_name)
        if industry:
            payload["industry"] = industry
        r = client.post("/api/assessments", json=payload, headers=auth_headers(sub))
        assert r.status_code == 200, r.text
        row_id = r.json()["id"]

        row = db_session.get(Assessment, row_id)
        if summary is not None:
            row.summary = summary
        if risk is not None:
            row.overall_risk_level = risk
        if created_at is not None:
            row.created_at = created_at
        db_session.commit()
        return row_id

    return _make


def _list(client, auth_headers, sub, **params):
    r = client.get("/api/assessments", params=params, headers=auth_headers(sub))
    assert r.status_code == 200, r.text
    return r.json()


def _names(body):
    return [row["project_name"] for row in body["items"]]


# --- Text search --------------------------------------------------------------


class TestSearch:
    def test_matches_project_name_case_insensitively(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, project_name="Candidate Screening")
        make_assessment(user_id, project_name="Fraud Detection")

        body = _list(client, auth_headers, user_id, q="candidate")
        assert _names(body) == ["Candidate Screening"]
        assert body["total"] == 1

    def test_matches_summary(self, client, auth_headers, make_assessment, user_id):
        make_assessment(user_id, project_name="A", summary="involves biometric data")
        make_assessment(user_id, project_name="B", summary="plain text routing")

        body = _list(client, auth_headers, user_id, q="biometric")
        assert _names(body) == ["A"]

    def test_no_match_returns_empty_page(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, project_name="Candidate Screening")
        body = _list(client, auth_headers, user_id, q="nothing here")
        assert body["items"] == []
        assert body["total"] == 0

    @pytest.mark.parametrize("wildcard", ["%", "_"], ids=["percent", "underscore"])
    def test_like_wildcards_are_literal(
        self, client, auth_headers, make_assessment, user_id, wildcard
    ):
        # A user typing "%" means the character, not "match everything".
        make_assessment(user_id, project_name=f"Discount {wildcard} model")
        make_assessment(user_id, project_name="Unrelated project")

        body = _list(client, auth_headers, user_id, q=wildcard)
        assert _names(body) == [f"Discount {wildcard} model"]

    def test_search_does_not_cross_users(
        self, client, auth_headers, make_assessment, user_id
    ):
        other = uuid.uuid4()
        make_assessment(other, project_name="Secret Project")
        body = _list(client, auth_headers, user_id, q="secret")
        assert body["items"] == []
        assert body["total"] == 0


# --- Filters ------------------------------------------------------------------


class TestFilters:
    def test_single_risk_level(self, client, auth_headers, make_assessment, user_id):
        make_assessment(user_id, project_name="Low one", risk="low")
        make_assessment(user_id, project_name="High one", risk="high")

        body = _list(client, auth_headers, user_id, risk_level="high")
        assert _names(body) == ["High one"]

    def test_multiple_risk_levels_are_or_ed(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, project_name="Low one", risk="low")
        make_assessment(user_id, project_name="Medium one", risk="medium")
        make_assessment(user_id, project_name="High one", risk="high")

        body = _list(
            client, auth_headers, user_id, risk_level=["low", "high"], sort="risk"
        )
        assert set(_names(body)) == {"Low one", "High one"}
        assert body["total"] == 2

    def test_industry(self, client, auth_headers, make_assessment, user_id):
        make_assessment(user_id, project_name="HR tool", industry="HR/recruitment")
        make_assessment(user_id, project_name="Bank tool", industry="finance")

        body = _list(client, auth_headers, user_id, industry="finance")
        assert _names(body) == ["Bank tool"]

    def test_industry_column_matches_input_json(
        self, client, auth_headers, make_assessment, user_id, db_session
    ):
        # The denormalisation invariant, extended to the new column.
        make_assessment(user_id, project_name="HR tool", industry="HR/recruitment")
        row = db_session.query(Assessment).one()
        assert row.industry == row.input_json["industry"] == "HR/recruitment"

    def test_date_range(self, client, auth_headers, make_assessment, user_id):
        now = datetime.now(timezone.utc)
        make_assessment(
            user_id, project_name="Old", created_at=now - timedelta(days=10)
        )
        make_assessment(
            user_id, project_name="Recent", created_at=now - timedelta(days=1)
        )

        cutoff = (now - timedelta(days=5)).isoformat()
        assert _names(_list(client, auth_headers, user_id, created_after=cutoff)) == [
            "Recent"
        ]
        assert _names(_list(client, auth_headers, user_id, created_before=cutoff)) == [
            "Old"
        ]

    def test_filters_combine_as_and(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, project_name="Match", risk="high", industry="finance")
        make_assessment(
            user_id, project_name="Wrong risk", risk="low", industry="finance"
        )
        make_assessment(
            user_id, project_name="Wrong industry", risk="high", industry="education"
        )

        body = _list(
            client, auth_headers, user_id, risk_level="high", industry="finance"
        )
        assert _names(body) == ["Match"]


# --- Sorting ------------------------------------------------------------------


class TestSorting:
    def test_default_is_newest_first(
        self, client, auth_headers, make_assessment, user_id
    ):
        now = datetime.now(timezone.utc)
        make_assessment(
            user_id, project_name="Older", created_at=now - timedelta(days=2)
        )
        make_assessment(user_id, project_name="Newer", created_at=now)

        assert _names(_list(client, auth_headers, user_id)) == ["Newer", "Older"]

    def test_created_at_ascending(self, client, auth_headers, make_assessment, user_id):
        now = datetime.now(timezone.utc)
        make_assessment(
            user_id, project_name="Older", created_at=now - timedelta(days=2)
        )
        make_assessment(user_id, project_name="Newer", created_at=now)

        body = _list(client, auth_headers, user_id, sort="created_at", order="asc")
        assert _names(body) == ["Older", "Newer"]

    def test_project_name(self, client, auth_headers, make_assessment, user_id):
        make_assessment(user_id, project_name="Zebra")
        make_assessment(user_id, project_name="Alpha")

        body = _list(client, auth_headers, user_id, sort="project_name", order="asc")
        assert _names(body) == ["Alpha", "Zebra"]

    def test_risk_sorts_by_severity_not_alphabetically(
        self, client, auth_headers, make_assessment, user_id
    ):
        # Alphabetically this would be high, low, medium, unacceptable — which
        # is meaningless to a reader. Severity order is the point of the CASE.
        for name, risk in [
            ("H", "high"),
            ("L", "low"),
            ("M", "medium"),
            ("U", "unacceptable"),
        ]:
            make_assessment(user_id, project_name=name, risk=risk)

        body = _list(client, auth_headers, user_id, sort="risk", order="asc")
        assert _names(body) == ["L", "M", "H", "U"]

        body = _list(client, auth_headers, user_id, sort="risk", order="desc")
        assert _names(body) == ["U", "H", "M", "L"]

    def test_unknown_risk_value_sorts_last(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, project_name="Weird", risk="banana")
        make_assessment(user_id, project_name="High", risk="high")

        body = _list(client, auth_headers, user_id, sort="risk", order="asc")
        assert _names(body) == ["High", "Weird"]

    def test_invalid_sort_field_is_422(self, client, auth_headers, user_id):
        r = client.get(
            "/api/assessments",
            params={"sort": "summary"},
            headers=auth_headers(user_id),
        )
        assert r.status_code == 422


# --- Pagination ---------------------------------------------------------------


class TestPagination:
    @pytest.fixture()
    def five_rows(self, make_assessment, user_id):
        now = datetime.now(timezone.utc)
        for i in range(5):
            make_assessment(
                user_id,
                project_name=f"P{i}",
                created_at=now - timedelta(days=i),
            )

    def test_limit_and_total(self, client, auth_headers, user_id, five_rows):
        body = _list(client, auth_headers, user_id, limit=2)
        assert _names(body) == ["P0", "P1"]
        # total is the filtered count, not the page size.
        assert body["total"] == 5
        assert body["limit"] == 2 and body["offset"] == 0

    def test_offset_walks_the_set_without_gaps_or_repeats(
        self, client, auth_headers, user_id, five_rows
    ):
        seen = []
        for offset in (0, 2, 4):
            seen += _names(_list(client, auth_headers, user_id, limit=2, offset=offset))
        assert seen == ["P0", "P1", "P2", "P3", "P4"]

    def test_offset_past_the_end_is_empty_but_reports_total(
        self, client, auth_headers, user_id, five_rows
    ):
        body = _list(client, auth_headers, user_id, offset=99)
        assert body["items"] == []
        assert body["total"] == 5

    def test_pagination_is_stable_when_sort_values_tie(
        self, client, auth_headers, make_assessment, user_id
    ):
        # All five share a created_at, so only the id tiebreaker keeps paging
        # from dropping or repeating rows.
        same = datetime.now(timezone.utc)
        for i in range(5):
            make_assessment(user_id, project_name=f"T{i}", created_at=same)

        seen = []
        for offset in (0, 2, 4):
            seen += _names(_list(client, auth_headers, user_id, limit=2, offset=offset))
        assert sorted(seen) == ["T0", "T1", "T2", "T3", "T4"]

    @pytest.mark.parametrize(
        "params",
        [{"limit": 0}, {"limit": 101}, {"limit": -1}, {"offset": -1}],
        ids=["limit-zero", "limit-too-big", "limit-negative", "offset-negative"],
    )
    def test_out_of_range_pagination_is_422(
        self, client, auth_headers, user_id, params
    ):
        r = client.get("/api/assessments", params=params, headers=auth_headers(user_id))
        assert r.status_code == 422
