# AI Governance Risk Assessment Platform

A working web app for AI governance professionals. Describe an AI use case; an
LLM agent analyzes it against the major regulatory frameworks and returns a
structured, saved assessment with risks and mitigations.

- **Frameworks checked:** EU AI Act, NIST AI RMF, GDPR, ISO/IEC 42001
- **Backend:** Python · FastAPI · SQLAlchemy (PostgreSQL) · Alembic migrations
- **Frontend:** React (Vite) · plain CSS
- **LLM:** Anthropic API (`claude-sonnet-5` by default) via the official `anthropic` Python SDK

The agent is forced to return JSON-only output matching a fixed schema. The
backend parses and validates it, **retries once** on failure, and otherwise
returns a clear error. The large system prompt uses **prompt caching**, so
repeated assessments are far cheaper.

---

## Project structure

```
ai-risk-screener/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app, routes, startup (init DB + seed)
│   │   ├── agent.py       # System prompt, Anthropic call, parse/validate/retry
│   │   ├── schemas.py     # Pydantic: input + output schema (validation)
│   │   ├── models.py      # SQLAlchemy ORM model
│   │   ├── database.py    # Engine, session, Base (schema owned by Alembic)
│   │   ├── config.py      # Env-based settings (reads ANTHROPIC_API_KEY, DATABASE_URL)
│   │   └── seed.py        # Seeds one example assessment (idempotent)
│   ├── alembic/           # Alembic migration environment + versions/
│   ├── alembic.ini        # Alembic config (URL injected from DATABASE_URL)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── constants.js
│   │   ├── styles.css
│   │   └── components/    # Form, Loading, Result, List
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── README.md
└── CLAUDE.md
```

---

## Prerequisites

- **Python 3.10+**
- **PostgreSQL 14+** — a local server for development, or a managed Postgres
  (Neon, Supabase, etc.) in production
- **Node.js 18+** and npm (for the frontend)
- An **Anthropic API key** — https://console.anthropic.com/

---

## 1. Backend setup & run

From the project root:

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure your key and database
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=sk-ant-...
# DATABASE_URL is optional; it defaults to a local Postgres (see below).
```

Set the key (the app reads it from the environment; it is never hardcoded). The
`.env` file above is the easy path. Alternatively, export it in your shell:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Create the database and run migrations** (see
[Database & migrations](#database--migrations) for the local Postgres setup),
then apply the schema:

```bash
# from backend/, with the venv active
alembic upgrade head
```

Run the API server:

```bash
# from backend/, with the venv active
uvicorn app.main:app --reload --port 8000
```

The schema is owned by Alembic migrations — the app no longer creates tables on
startup, so run `alembic upgrade head` before the first launch. On startup the
app seeds **one example assessment** so you can see the result and list views
immediately — no API call required. The seed is idempotent: it inserts the
example only if it is not already present, so restarts never duplicate it.

- Health check: http://localhost:8000/api/health
  (`api_key_configured` tells you whether the key was found)
- Interactive API docs: http://localhost:8000/docs

---

## 2. Frontend setup & run

In a **second terminal**, from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default **http://localhost:5173**).

The dev server proxies `/api` to the backend on port 8000, so no extra
configuration is needed. Run the backend first.

---

## Database & migrations

The app uses **PostgreSQL**, with the schema owned by **Alembic** migrations.
The connection string comes from `DATABASE_URL` (a SQLAlchemy + `psycopg` v3
URL). It is never hardcoded and never committed — set it in `backend/.env` for
local development, or in the host's environment settings in production.

### Local Postgres (development)

If `DATABASE_URL` is unset, the app defaults to:

```
postgresql+psycopg://ai_risk:ai_risk@localhost:5432/ai_risk
```

Create a matching role and database once (example using a local Postgres where
your OS user is a superuser — e.g. Homebrew's `postgresql@16`):

```bash
# create the login role and an owned database
psql -d postgres -c "CREATE ROLE ai_risk LOGIN PASSWORD 'ai_risk';"
createdb -O ai_risk ai_risk
```

To point at a different database (managed Postgres, a different local name),
set `DATABASE_URL` in `backend/.env` instead — see `.env.example`.

### Running migrations

All commands run from `backend/` with the venv active:

```bash
alembic upgrade head                         # apply all migrations (create/upgrade schema)
alembic current                              # show the applied revision
alembic downgrade -1                          # roll back the last migration
alembic revision --autogenerate -m "message"  # create a new migration after changing models.py
```

`alembic upgrade head` is required before the **first** launch, and any time
new migrations are added. After editing `app/models.py`, generate a new
revision with `--autogenerate`, review the generated file in
`alembic/versions/`, then `alembic upgrade head`.

> **Re-seed manually (optional):** `python -m app.seed` (from `backend/`, venv
> active). Requires the schema to already exist (`alembic upgrade head`). The
> seed is idempotent — it will not create duplicates.

---

## Using the app

1. **New assessment** — fill in the form (use-case description is required),
   choose industry, deployment context, data types, whether it affects decisions
   about people, and geographic scope. Click **Run assessment**.
2. A loading state shows while the agent works (~10–30s).
3. The result appears: an overall risk badge, summary, per-framework analysis,
   a scannable risk list with severity/likelihood meters, recommended next
   steps, and a disclaimer.
4. **Past assessments** — every assessment is saved. Open any past one to
   re-view the full result.

---

## Configuration reference (`backend/.env`)

| Variable              | Required | Default                     | Purpose                                   |
| --------------------- | -------- | --------------------------- | ----------------------------------------- |
| `ANTHROPIC_API_KEY`   | **Yes**  | —                           | Your Anthropic API key                    |
| `ANTHROPIC_MODEL`     | No       | `claude-sonnet-5`           | Model to use                              |
| `ANTHROPIC_MAX_TOKENS`| No       | `8000`                      | Max output tokens per assessment          |
| `DATABASE_URL`        | No       | `postgresql+psycopg://ai_risk:ai_risk@localhost:5432/ai_risk` | Postgres URL (SQLAlchemy + psycopg v3) — see [Database & migrations](#database--migrations) |
| `CORS_ORIGINS`        | No       | `http://localhost:5173,...` | Allowed frontend origins                  |

> **Model note:** The default is `claude-sonnet-5`. For higher capability set
> `ANTHROPIC_MODEL=claude-opus-4-8`; for lower cost, `claude-haiku-4-5` — no code
> changes needed. (The original default, `claude-sonnet-4-20250514`, has reached
> end-of-life and is no longer available.)

---

## Error handling

- **Missing API key** — the frontend shows a warning banner on load, and
  attempting a new assessment returns a clear `503` with guidance. The seeded
  example is still viewable.
- **Model returns invalid JSON** — the backend retries once with a corrective
  instruction, then returns a `502` with a clear message if it still fails.
- **Upstream API errors** (auth, rate limit, server) — surfaced as a `502`/`503`
  with a readable message; the frontend shows it in an error banner.
- **Backend unreachable** — the frontend tells you to start the API server.

---

## API endpoints

| Method | Path                       | Description                          |
| ------ | -------------------------- | ------------------------------------ |
| GET    | `/api/health`              | Liveness + whether the key is set    |
| POST   | `/api/assessments`         | Run + save an assessment             |
| GET    | `/api/assessments`         | List saved assessments (newest first)|
| GET    | `/api/assessments/{id}`    | Get one full assessment              |

---

## Disclaimer

This tool is automated **decision-support, not legal advice**. Validate all
findings with qualified legal and compliance professionals.
