# AI Governance Risk Assessment Platform

A working web app for AI governance professionals. Describe an AI use case; an
LLM agent analyzes it against the major regulatory frameworks and returns a
structured, saved assessment with risks and mitigations.

- **Frameworks checked:** EU AI Act, NIST AI RMF, GDPR, ISO/IEC 42001
- **Backend:** Python · FastAPI · SQLAlchemy (SQLite)
- **Frontend:** React (Vite) · plain CSS
- **LLM:** Anthropic API (`claude-sonnet-4-20250514` by default) via the official `anthropic` Python SDK

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
│   │   ├── database.py    # Engine, session, Base
│   │   ├── config.py      # Env-based settings (reads ANTHROPIC_API_KEY)
│   │   └── seed.py        # Seeds one example assessment
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

# Configure your API key
cp .env.example .env
# then edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

Set the key (the app reads it from the environment; it is never hardcoded). The
`.env` file above is the easy path. Alternatively, export it in your shell:

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Run the API server:

```bash
# from backend/, with the venv active
uvicorn app.main:app --reload --port 8000
```

On first start the app creates the SQLite database (`backend/ai_risk.db`) and
seeds **one example assessment** so you can see the result and list views
immediately — no API call required.

- Health check: http://localhost:8000/api/health
  (`api_key_configured` tells you whether the key was found)
- Interactive API docs: http://localhost:8000/docs

> **Re-seed manually (optional):** `python -m app.seed` (from `backend/`, venv active).

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
| `ANTHROPIC_MODEL`     | No       | `claude-sonnet-4-20250514`  | Model to use                              |
| `ANTHROPIC_MAX_TOKENS`| No       | `8000`                      | Max output tokens per assessment          |
| `DATABASE_URL`        | No       | `sqlite:///backend/ai_risk.db` | SQLAlchemy database URL                |
| `CORS_ORIGINS`        | No       | `http://localhost:5173,...` | Allowed frontend origins                  |

> **Model note:** `claude-sonnet-4-20250514` is on a deprecation track (retires
> mid-2026). To upgrade, set `ANTHROPIC_MODEL` to a current model such as
> `claude-sonnet-4-6` or `claude-opus-4-8` — no code changes needed.

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
