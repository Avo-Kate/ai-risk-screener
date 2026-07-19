"""Shared test fixtures.

Design notes:

* **Database** — tests run against an in-memory SQLite database by default
  (override with TEST_DATABASE_URL) via a `get_db` dependency override. The
  schema is created with `Base.metadata.create_all`: Alembic owns the *real*
  database's schema (see CLAUDE.md), but tests verify app behaviour, not
  migrations. The app's own engine is never touched — the TestClient is
  deliberately not used as a context manager, so the lifespan hook (which
  seeds via the real engine) never runs.

* **Auth** — tests exercise the real verification code path using the HS256
  legacy mode: SUPABASE_JWT_SECRET is set *before* app modules are imported,
  and it takes precedence over any SUPABASE_URL in a developer's backend/.env
  (see app/auth.py), so no JWKS fetch ever happens. Tokens are minted with
  the same claims Supabase uses (sub, email, aud, exp).

* **Anthropic** — the real client must never be called. Route tests
  monkeypatch `app.main.run_assessment`; agent tests monkeypatch
  `app.agent._client`.
"""

import os
import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pytest

TEST_JWT_SECRET = "test-only-secret-not-a-real-supabase-secret"

# Must happen before `app.*` imports below: config reads the secret at call
# time, but setting it here guarantees HS256 precedence for every code path.
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import config  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite://")


# --- Database -----------------------------------------------------------------


@pytest.fixture()
def engine():
    if TEST_DATABASE_URL.startswith("sqlite"):
        # StaticPool: one shared connection, so every session sees the same
        # in-memory database. check_same_thread=False for the TestClient's
        # threadpool (same reasoning as app/database.py).
        eng = create_engine(
            TEST_DATABASE_URL,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
    else:
        eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db_session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session(db_session_factory):
    """A session for test setup/assertions, on the same database the app sees."""
    session = db_session_factory()
    yield session
    session.close()


@pytest.fixture()
def client(db_session_factory):
    def override_get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    # NOT a context manager on purpose — entering it runs the lifespan hook,
    # which would seed the real (non-test) database engine.
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()


# --- Auth helpers -------------------------------------------------------------


def _make_token(
    sub,
    *,
    email: str = "user@example.com",
    secret: str = TEST_JWT_SECRET,
    aud: str | None = None,
    expires_in: int = 3600,
) -> str:
    """Mint a Supabase-shaped access token. sub=None omits the claim."""
    now = datetime.now(timezone.utc)
    payload = {
        "email": email,
        "aud": aud if aud is not None else config.SUPABASE_JWT_AUD,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    if sub is not None:
        payload["sub"] = str(sub)
    return pyjwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture()
def make_token():
    return _make_token


@pytest.fixture()
def auth_headers():
    def _headers(sub, **kwargs):
        return {"Authorization": f"Bearer {_make_token(sub, **kwargs)}"}

    return _headers


@pytest.fixture()
def user_id():
    return uuid.uuid4()


# --- Sample data --------------------------------------------------------------


@pytest.fixture()
def sample_input():
    """A valid AssessmentInput payload (respects the controlled vocabularies)."""
    return {
        "project_name": "CV screening assistant",
        "use_case_description": (
            "A machine-learning model ranks incoming job applications and "
            "shortlists candidates for human recruiters."
        ),
        "industry": "HR/recruitment",
        "deployment_context": "internal tool",
        "data_types": ["personal data"],
        "affects_decisions": True,
        "geographic_scope": ["EU"],
    }


@pytest.fixture()
def sample_result():
    """A valid AssessmentResult payload, as the model should return it."""
    return {
        "overall_risk_level": "high",
        "summary": "High-risk employment use case under the EU AI Act.",
        "frameworks": [
            {
                "name": "EU AI Act",
                "applicability": "applies",
                "classification": "high-risk system under Annex III point 4 (employment)",
                "rationale": "The system ranks candidates and influences hiring decisions in the EU.",
                "key_obligations": ["risk management system", "human oversight"],
            }
        ],
        "risks": [
            {
                "category": "bias and discrimination",
                "description": "Ranking may systematically disadvantage protected groups.",
                "severity": "high",
                "likelihood": "medium",
                "mitigations": ["bias testing across protected attributes"],
            }
        ],
        "recommended_next_steps": ["Run a DPIA", "Establish human review of shortlists"],
        "disclaimer": "Decision-support, not legal advice.",
    }
