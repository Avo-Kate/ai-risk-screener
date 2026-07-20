"""Tests for GET /api/stats — the dashboard aggregates.

The zero-filling behaviour is the part worth guarding: charts break quietly when
a category or a month is simply absent rather than present with a count of 0.
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
    def _make(sub, *, industry=None, risk=None, created_at=None):
        payload = dict(sample_input)
        if industry:
            payload["industry"] = industry
        r = client.post("/api/assessments", json=payload, headers=auth_headers(sub))
        assert r.status_code == 200, r.text
        row = db_session.get(Assessment, r.json()["id"])
        if risk is not None:
            row.overall_risk_level = risk
        if created_at is not None:
            row.created_at = created_at
        db_session.commit()
        return row.id

    return _make


def _stats(client, auth_headers, sub, **params):
    r = client.get("/api/stats", params=params, headers=auth_headers(sub))
    assert r.status_code == 200, r.text
    return r.json()


class TestStatsAuth:
    def test_requires_auth(self, client):
        assert client.get("/api/stats").status_code == 401


class TestStatsEmpty:
    def test_empty_account_still_returns_full_shape(
        self, client, auth_headers, user_id
    ):
        # A brand-new user must get a chartable response, not nulls.
        body = _stats(client, auth_headers, user_id)
        assert body["total"] == 0
        assert [r["level"] for r in body["by_risk_level"]] == [
            "low",
            "medium",
            "high",
            "unacceptable",
        ]
        assert all(r["count"] == 0 for r in body["by_risk_level"])
        assert body["by_industry"] == []
        assert len(body["over_time"]) == 12
        assert all(m["count"] == 0 for m in body["over_time"])


class TestStatsCounts:
    def test_totals_and_risk_breakdown(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, risk="low")
        make_assessment(user_id, risk="high")
        make_assessment(user_id, risk="high")

        body = _stats(client, auth_headers, user_id)
        assert body["total"] == 3
        counts = {r["level"]: r["count"] for r in body["by_risk_level"]}
        assert counts == {"low": 1, "medium": 0, "high": 2, "unacceptable": 0}

    def test_risk_levels_stay_in_severity_order(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, risk="unacceptable")
        body = _stats(client, auth_headers, user_id)
        assert [r["level"] for r in body["by_risk_level"]] == [
            "low",
            "medium",
            "high",
            "unacceptable",
        ]

    def test_industry_breakdown_is_largest_first(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id, industry="finance")
        make_assessment(user_id, industry="finance")
        make_assessment(user_id, industry="education")

        body = _stats(client, auth_headers, user_id)
        assert body["by_industry"][0] == {"industry": "finance", "count": 2}
        assert {"industry": "education", "count": 1} in body["by_industry"]

    def test_stats_are_per_user(self, client, auth_headers, make_assessment, user_id):
        # The ownership invariant applies to aggregates too — one user's counts
        # must never include another's rows.
        other = uuid.uuid4()
        make_assessment(user_id, risk="low")
        make_assessment(other, risk="high")
        make_assessment(other, risk="high")

        body = _stats(client, auth_headers, user_id)
        assert body["total"] == 1
        counts = {r["level"]: r["count"] for r in body["by_risk_level"]}
        assert counts["high"] == 0


class TestStatsOverTime:
    def test_current_month_is_last_and_counted(
        self, client, auth_headers, make_assessment, user_id
    ):
        make_assessment(user_id)
        body = _stats(client, auth_headers, user_id)
        now = datetime.now(timezone.utc)
        assert body["over_time"][-1] == {
            "month": f"{now.year:04d}-{now.month:02d}",
            "count": 1,
        }

    def test_months_are_chronological_and_gap_free(self, client, auth_headers, user_id):
        months = [
            m["month"] for m in _stats(client, auth_headers, user_id)["over_time"]
        ]
        assert months == sorted(months)
        # Consecutive keys must differ by exactly one calendar month.
        for earlier, later in zip(months, months[1:], strict=False):
            ey, em = (int(p) for p in earlier.split("-"))
            ly, lm = (int(p) for p in later.split("-"))
            assert (ly - ey) * 12 + (lm - em) == 1

    def test_window_width_is_configurable(self, client, auth_headers, user_id):
        assert len(_stats(client, auth_headers, user_id, months=6)["over_time"]) == 6

    @pytest.mark.parametrize("months", [0, 61], ids=["too-small", "too-large"])
    def test_out_of_range_window_is_422(self, client, auth_headers, user_id, months):
        r = client.get(
            "/api/stats", params={"months": months}, headers=auth_headers(user_id)
        )
        assert r.status_code == 422

    def test_rows_outside_the_window_are_excluded_from_series(
        self, client, auth_headers, make_assessment, user_id
    ):
        # Old row still counts toward the total, but has no bucket in a short
        # window — the series must not invent one for it.
        make_assessment(
            user_id, created_at=datetime.now(timezone.utc) - timedelta(days=400)
        )
        make_assessment(user_id)

        body = _stats(client, auth_headers, user_id, months=3)
        assert body["total"] == 2
        assert sum(m["count"] for m in body["over_time"]) == 1
