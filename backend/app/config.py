"""Application configuration.

All secrets and tunables are read from the environment. The API key is NEVER
hardcoded — it is read from ANTHROPIC_API_KEY. A local .env file (see
.env.example) is loaded automatically for convenience during development.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env if present. Paths are resolved relative to this file so the
# app behaves the same regardless of the current working directory.
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# --- Anthropic / LLM settings -------------------------------------------------

# Default to claude-sonnet-5, the current Sonnet-tier model — strong quality at a
# moderate cost, a good fit for self-hosters. The previous default,
# claude-sonnet-4-20250514, has reached end-of-life and now 404s. Override with
# the ANTHROPIC_MODEL env var (e.g. claude-opus-4-8 for maximum capability, or
# claude-haiku-4-5 for lower cost) without touching code.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")

# Read at call time (not import time) so a missing key produces a clear runtime
# error in the request path rather than crashing startup.
def get_api_key() -> str | None:
    return os.getenv("ANTHROPIC_API_KEY")


# Generous ceiling for a full assessment; well under the non-streaming timeout.
MAX_TOKENS = int(os.getenv("ANTHROPIC_MAX_TOKENS", "8000"))

# --- Database -----------------------------------------------------------------

# Postgres is the target database. DATABASE_URL is read from the environment so
# the same code runs against a local Postgres in development and a managed
# Postgres (Neon, Supabase, etc.) in production. Never commit a real connection
# string — set it in backend/.env locally or in the host's environment settings.
#
# The default points at a local Postgres for development. Use the SQLAlchemy +
# psycopg (v3) driver URL form: postgresql+psycopg://user:pass@host:port/dbname
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://ai_risk:ai_risk@localhost:5432/ai_risk",
)

# --- Authentication (Supabase) ------------------------------------------------

# Supabase is used purely as an identity provider. GoTrue (Supabase Auth) issues
# and signs JWTs; this backend only *verifies* them with the PyJWT library — no
# password hashing or hand-rolled crypto. Two verification methods are supported,
# so this works for Supabase Cloud and self-hosted Supabase alike:
#
#   1. Asymmetric (recommended; the default for current Supabase projects):
#      set SUPABASE_URL. Tokens are signed with the project's ES256/RS256 key and
#      verified against its public JWKS endpoint — no secret needed.
#   2. Legacy symmetric (older projects / some self-hosted setups):
#      set SUPABASE_JWT_SECRET (Project Settings -> API -> legacy "JWT Secret").
#
# If both are set, the shared secret (HS256) takes precedence.

# Supabase project URL, e.g. https://<ref>.supabase.co. Used to build the JWKS
# URL ({SUPABASE_URL}/auth/v1/.well-known/jwks.json) for asymmetric verification.
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")


# Read at call time so a missing config is a clear runtime error, not a crash.
def get_jwt_secret() -> str | None:
    return os.getenv("SUPABASE_JWT_SECRET")


def auth_configured() -> bool:
    return bool(get_jwt_secret() or SUPABASE_URL)


# Supabase access tokens carry aud="authenticated". Override only if your
# instance is configured differently.
SUPABASE_JWT_AUD = os.getenv("SUPABASE_JWT_AUD", "authenticated")

# --- CORS ---------------------------------------------------------------------

# The Vite dev server. The frontend also proxies /api -> backend, so CORS is a
# belt-and-suspenders convenience for running the two on separate origins.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
