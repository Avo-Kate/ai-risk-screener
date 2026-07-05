# AI Governance Risk Assessment Platform — Claude Code Context

## What this project is

A web app for AI governance professionals. A user describes an AI use case via a structured form; a Claude agent analyzes it against the EU AI Act, NIST AI RMF, GDPR, and ISO/IEC 42001, then returns a structured JSON assessment that is saved to SQLite and displayed with risk badges, severity meters, and mitigation lists.

## Tech stack

| Layer    | Technology                                                   |
| -------- | ------------------------------------------------------------ |
| Backend  | Python 3.10+, FastAPI, SQLAlchemy (SQLite), Pydantic v2      |
| Frontend | React 18 (Vite), plain CSS — no UI framework                 |
| LLM      | Anthropic Python SDK — model set via `ANTHROPIC_MODEL` env var (default `claude-sonnet-4-20250514`) |
| DB       | SQLite via SQLAlchemy (`backend/ai_risk.db`)                 |

## Project layout

```
ai-risk-screener/
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app, routes, lifespan (init DB + seed)
│   │   ├── agent.py      # System prompt, Anthropic call, JSON parse/validate/retry
│   │   ├── schemas.py    # Pydantic: AssessmentInput, AssessmentResult, etc.
│   │   ├── models.py     # SQLAlchemy ORM: Assessment
│   │   ├── database.py   # Engine, SessionLocal, Base, get_db dependency
│   │   ├── config.py     # Env-based config (API key, model, DB URL, CORS)
│   │   └── seed.py       # Seeds one example assessment on startup
│   ├── requirements.txt
│   └── .env.example      # Copy to .env and set ANTHROPIC_API_KEY
└── frontend/
    ├── src/
    │   ├── App.jsx            # Top-level: tabs, state, routing between views
    │   ├── api.js             # fetch wrappers for all backend endpoints
    │   ├── constants.js       # Form vocabularies + badge CSS class maps
    │   ├── styles.css         # All styles — plain CSS, no framework
    │   └── components/
    │       ├── AssessmentForm.jsx    # Structured input form
    │       ├── AssessmentResult.jsx  # Full result view (badge, frameworks, risks)
    │       ├── AssessmentList.jsx    # Past assessments list
    │       └── LoadingState.jsx      # Spinner while the agent works
    ├── index.html
    ├── package.json
    └── vite.config.js    # Proxies /api -> localhost:8000 in dev
```

## How to run (dev)

```bash
# Terminal 1 — backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set ANTHROPIC_API_KEY in .env
uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev                   # opens on http://localhost:5173
```

The backend seeds one example assessment on first start — no API call needed to see the list/result views.

## Key architectural decisions

- **Vocab sync:** `constants.js` and `schemas.py` define the same controlled vocabularies (industries, deployment contexts, data types, geographic scopes). If you add a value, update both.
- **Agent JSON enforcement:** The system prompt demands JSON-only output. `agent.py` tries `json.loads`, then strips markdown fences, then falls back to the outermost `{…}` span. If Pydantic validation still fails, it retries once with a corrective message; after that it raises `AssessmentParseError`.
- **Prompt caching:** The large static system prompt is sent with `cache_control: ephemeral` so repeated assessments within a 5-minute window skip re-tokenising it.
- **No hardcoded secrets:** `config.py` calls `get_api_key()` at request time; a missing key raises `APIKeyMissingError` → HTTP 503. The frontend reads `/api/health` on mount and shows a warning banner if the key is absent.
- **Seed is idempotent:** `seed.py` checks for a row with the example project name before inserting; safe to run on every startup.
- **SQLite JSON columns:** Input and result are stored as JSON blobs. A few fields (project name, risk level, summary) are denormalised into typed columns for the cheap list query.

## Environment variables (`backend/.env`)

| Variable               | Default                       | Notes                              |
| ---------------------- | ----------------------------- | ---------------------------------- |
| `ANTHROPIC_API_KEY`    | —                             | Required for new assessments       |
| `ANTHROPIC_MODEL`      | `claude-sonnet-4-20250514`    | Swap to `claude-sonnet-4-6`, etc.  |
| `ANTHROPIC_MAX_TOKENS` | `8000`                        | Ceiling for a single assessment    |
| `DATABASE_URL`         | `sqlite:///backend/ai_risk.db`| SQLAlchemy URL                     |
| `CORS_ORIGINS`         | `http://localhost:5173,...`   | Comma-separated                    |

## API surface

| Method | Path                     | What it does                        |
| ------ | ------------------------ | ----------------------------------- |
| GET    | `/api/health`            | Liveness + `api_key_configured`     |
| POST   | `/api/assessments`       | Run + save; returns `AssessmentRecord` |
| GET    | `/api/assessments`       | List summaries, newest first        |
| GET    | `/api/assessments/{id}`  | Full record by id                   |

## Agent output schema

The model must return exactly:

```json
{
  "overall_risk_level": "low|medium|high|unacceptable",
  "summary": "...",
  "frameworks": [{ "name", "applicability", "classification", "rationale", "key_obligations" }],
  "risks": [{ "category", "description", "severity", "likelihood", "mitigations" }],
  "recommended_next_steps": ["..."],
  "disclaimer": "..."
}
```

Pydantic validators normalise values to lowercase and reject anything outside the controlled vocabularies.

## What's intentionally out of scope (v1)

- Authentication / multi-user
- PDF/Word export
- Assessment editing or deletion
- Production deployment config (gunicorn, Docker, etc.)
