"""Auth tests: token verification (via the real HS256 path) and user upsert.

All requests go through GET /api/assessments — the cheapest authenticated
route — so these are integration tests of `get_current_user` end to end.
"""

import uuid

from app.models import User


class TestTokenValidation:
    def test_valid_token_is_accepted(self, client, auth_headers, user_id):
        r = client.get("/api/assessments", headers=auth_headers(user_id))
        assert r.status_code == 200
        assert r.json() == []

    def test_expired_token_is_401(self, client, auth_headers, user_id):
        r = client.get(
            "/api/assessments", headers=auth_headers(user_id, expires_in=-60)
        )
        assert r.status_code == 401

    def test_wrong_signature_is_401(self, client, auth_headers, user_id):
        r = client.get(
            "/api/assessments",
            headers=auth_headers(
                user_id, secret="a-different-secret-that-is-long-enough-for-hs256"
            ),
        )
        assert r.status_code == 401

    def test_wrong_audience_is_401(self, client, auth_headers, user_id):
        r = client.get(
            "/api/assessments", headers=auth_headers(user_id, aud="anon")
        )
        assert r.status_code == 401

    def test_missing_sub_claim_is_401(self, client, auth_headers):
        r = client.get("/api/assessments", headers=auth_headers(None))
        assert r.status_code == 401

    def test_non_uuid_sub_is_401(self, client, auth_headers):
        r = client.get("/api/assessments", headers=auth_headers("not-a-uuid"))
        assert r.status_code == 401

    def test_garbage_token_is_401(self, client):
        r = client.get(
            "/api/assessments", headers={"Authorization": "Bearer not.a.jwt"}
        )
        assert r.status_code == 401

    def test_401_carries_www_authenticate_header(self, client):
        r = client.get("/api/assessments")
        assert r.status_code == 401
        assert r.headers["WWW-Authenticate"] == "Bearer"


class TestUserUpsert:
    def test_first_request_creates_local_user(
        self, client, auth_headers, db_session, user_id
    ):
        r = client.get(
            "/api/assessments", headers=auth_headers(user_id, email="kat@example.com")
        )
        assert r.status_code == 200

        user = db_session.get(User, user_id)
        assert user is not None
        assert user.email == "kat@example.com"

    def test_repeat_requests_reuse_the_row(
        self, client, auth_headers, db_session, user_id
    ):
        for _ in range(2):
            assert (
                client.get(
                    "/api/assessments", headers=auth_headers(user_id)
                ).status_code
                == 200
            )
        assert db_session.query(User).count() == 1

    def test_changed_email_is_refreshed(
        self, client, auth_headers, db_session, user_id
    ):
        client.get(
            "/api/assessments", headers=auth_headers(user_id, email="old@example.com")
        )
        client.get(
            "/api/assessments", headers=auth_headers(user_id, email="new@example.com")
        )

        db_session.expire_all()
        user = db_session.get(User, user_id)
        assert user.email == "new@example.com"
        assert db_session.query(User).count() == 1

    def test_distinct_subjects_get_distinct_rows(self, client, auth_headers, db_session):
        client.get("/api/assessments", headers=auth_headers(uuid.uuid4()))
        client.get("/api/assessments", headers=auth_headers(uuid.uuid4()))
        assert db_session.query(User).count() == 2
