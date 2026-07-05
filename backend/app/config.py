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

# The user explicitly requested claude-sonnet-4-20250514. It stays configurable
# so you can move to a newer model (e.g. claude-sonnet-4-6, claude-opus-4-8)
# without touching code.
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")

# Read at call time (not import time) so a missing key produces a clear runtime
# error in the request path rather than crashing startup.
def get_api_key() -> str | None:
    return os.getenv("ANTHROPIC_API_KEY")


# Generous ceiling for a full assessment; well under the non-streaming timeout.
MAX_TOKENS = int(os.getenv("ANTHROPIC_MAX_TOKENS", "8000"))

# --- Database -----------------------------------------------------------------

# Default to a SQLite file inside backend/. Override with DATABASE_URL if needed.
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'ai_risk.db'}")

# --- CORS ---------------------------------------------------------------------

# The Vite dev server. The frontend also proxies /api -> backend, so CORS is a
# belt-and-suspenders convenience for running the two on separate origins.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")
