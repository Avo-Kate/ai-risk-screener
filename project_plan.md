# AI Risk Screener — Project Plan

**Owner:** Kat (AI Governance professional)
**Created:** 2026-07-19
**Status:** Phase 0 not started

This is the master plan for turning the current prototype into a proper,
hosted AI Governance assessment platform. It is broken into **phases**, and
each phase into **small sessions** sized for one focused Claude Code session
(~30–90 min) with a clear "done when" check you can verify by using the app.

> **How this document is used:** at the start of every session, tell the agent
> which session ID to do (see [Session workflow](#session-workflow)). At the end
> of a session, the agent ticks the checkbox here and commits. This file **is
> committed to git** (unlike `CLAUDE.md`, which is local-only agent context).

---

## Vision

Today: a working prototype that screens an AI use case against four
governance frameworks (EU AI Act, NIST AI RMF, GDPR, ISO/IEC 42001) using
Claude, with per-user saved assessments behind Supabase Auth.

Target: a polished, hosted platform I use for real assessment work and can
invite a few colleagues/clients into — professional UI, complete account
experience (password reset etc.), dashboard over past assessments, versioned
assessments, exportable PDF reports, more frameworks, and proper security,
privacy, and operations. Long-term ambition: grow toward a genuine AI
Governance platform (in the spirit of Deeploy/Credo AI) — see
[Phase 9](#phase-9--platform-future-backlog).

## Decisions made (2026-07-19)

These were decided up front so sessions don't re-litigate them:

| Decision | Choice | Why |
|---|---|---|
| Audience | **Me + a few invited users** | Real use + shareable with colleagues/clients; no open signup, no billing. |
| Hosting | **Vercel (frontend) + Railway (backend + Postgres) + Supabase (auth only)** | Cheapest professional setup (~$5–10/mo), auto-deploys from GitHub, near-zero maintenance. GCP Cloud Run is the documented *future* migration path (Phase 9), not the starting point. |
| Session size | **Small** (one Claude Code session each) | Each has a "done when" check verifiable by using the app, since Kat is not deep in the code day-to-day. |
| Feature priorities | PDF export, dashboard/analytics, versioned assessments, more/custom frameworks | All selected; ordered dashboard → versioning → PDF → frameworks in Phases 3–5. |
| CSS approach | **Migrate to Tailwind CSS v4** during the UI overhaul (Phase 2) | The 709-line hand-written `styles.css` is the hardest part of the app for agents to modify consistently; Tailwind makes every future UI session faster and more consistent. |
| PDF approach | **Client-side** (`@react-pdf/renderer`), print stylesheet first | Server-side tools (WeasyPrint) need native libraries via Homebrew — a known hazard on this machine (see `CLAUDE.md`). Client-side is pure JS and deploys anywhere. |

## Phase overview

| Phase | Name | Outcome | Sessions |
|---|---|---|---|
| 0 | Safety net & project hygiene | Tests, linting, CI — so later phases can't silently break things | 3 |
| 1 | Complete the account experience | Password reset, routing, account page — a "real website" | 4 |
| 2 | UI/UX overhaul | Professional design, navigation, form & result UX | 5 |
| 3 | Assessments done properly | Dashboard, search/filter, delete, versioned re-runs | 5 |
| 4 | Professional reports | Print-ready view + branded PDF export | 2 |
| 5 | Frameworks & custom criteria | More frameworks, per-assessment selection, custom criteria | 3 |
| 6 | Go live | Deployed, custom domain, auto-deploy from GitHub | 4 |
| 7 | Security, privacy & operations | Rate limiting, monitoring, backups, privacy pages, security review | 4 |
| 8 | Invite first users | Closed signup + invitation flow + onboarding polish | 2 |
| 9 | Platform future | Backlog only — GCP, teams, audit trail, AI system register | — |

**Recommended order is as numbered**, with one deliberate exception you may
take: Phase 6 (Go live) can be pulled forward to right after Phase 2 if you
want the app usable away from your laptop sooner. Everything in Phases 3–5
deploys automatically once Phase 6 exists.

---

## Session workflow

Copy-paste template to start any session with a Claude Code agent:

```
Read CLAUDE.md and project_plan.md. Do session <ID> from the plan.
Stay within that session's scope. When done: verify the "done when"
check by running the stack, tick the checkbox in project_plan.md,
and commit on a branch named after the session (e.g. session-1-2).
```

Rules for every session (agents: follow these):

1. **One session = one branch = one PR.** Branch from `main`, open a PR when
   the "done when" check passes. Kat merges.
2. **Schema changes always get an Alembic migration** (`alembic revision
   --autogenerate` + `upgrade head`). Never `create_all`. See `CLAUDE.md`.
3. **Don't edit `SYSTEM_PROMPT` in `app/agent.py`** unless the session
   explicitly says so — it invalidates the prompt cache and costs money.
4. **Verify by using the app**, not just by reading code. Start Postgres,
   backend, and frontend per the Commands section of `CLAUDE.md`.
5. If a session turns out bigger than expected, **stop and split it**: finish a
   coherent part, note the remainder as a new session in this file.
6. Update `CLAUDE.md` if a session changes an invariant it documents.

---

## Phase 0 — Safety net & project hygiene

*Why first: every later phase rewrites UI or touches the data model. Without
tests and CI, a regression in auth filtering or JSON parsing would be invisible
until it bites. There is currently **no test suite and no linter**.*

- [x] **0.1 — Backend test suite (pytest)** *(done 2026-07-19, branch `session-0-1`)*
  Set up `pytest` + FastAPI `TestClient` with a test database and a mocked
  Anthropic client (never call the real API in tests). Priority tests:
  auth required on all `/api/assessments` routes; user A cannot see user B's
  assessment (**and gets 404, not 403** — this is a documented invariant);
  `_extract_json` handles clean JSON, fenced JSON, and JSON wrapped in prose;
  the one-retry loop and `AssessmentParseError` after two failures;
  denormalised columns match `result_json` on save.
  *Done when:* `.venv/bin/python -m pytest` passes locally with ≥ those cases.

- [ ] **0.2 — Linting & formatting**
  Add `ruff` (lint + format) for the backend and Prettier + ESLint for the
  frontend, with config files committed. Run both once and commit the
  reformat as its own commit so future diffs stay readable. Also: add the
  `cryptography<49` pin to a `constraints-local.txt` with a comment (it is a
  this-machine-only issue — see `CLAUDE.md`), keeping `requirements.txt`
  portable.
  *Done when:* `ruff check` and `npx prettier --check .` pass; README notes the commands.

- [ ] **0.3 — CI on GitHub Actions**
  Workflow on push/PR: backend job (install deps, `ruff check`, `pytest`
  against a Postgres service container) and frontend job (`npm ci`,
  `npm run build`, prettier check). CI runs on Linux, so none of the local
  Intel-Homebrew problems apply there.
  *Done when:* a PR shows green checks for both jobs.

## Phase 1 — Complete the account experience

*The "proper website" gap: right now there is no password reset, no URLs (a
refresh loses your place), and no account page.*

- [ ] **1.1 — Add routing (react-router)**
  Introduce `react-router-dom` and restructure `App.jsx`'s conditional
  rendering into routes: `/` (workspace), `/assessments`, `/assessments/:id`,
  `/login`, `/reset-password`, `/account`. Protect authed routes with a
  layout that redirects to `/login`. Keep the existing per-user state
  clearing on logout.
  *Done when:* refreshing on any page keeps you there; opening a past
  assessment gives it a shareable URL; signed-out users land on `/login`.

- [ ] **1.2 — Password reset flow**
  "Forgot password?" on the login page → `supabase.auth.resetPasswordForEmail`
  with `redirectTo` the `/reset-password` route → page that calls
  `supabase.auth.updateUser({ password })`. **Requires config outside code:**
  in the Supabase dashboard, set the Site URL and add
  `http://localhost:5173/reset-password` to allowed redirect URLs (the prod
  URL gets added in Phase 6).
  *Done when:* full round trip works — request email, click link, set new
  password, sign in with it.

- [ ] **1.3 — Account page**
  `/account`: show email, change password (`updateUser`), change email (with
  Supabase's confirmation flow), and **"Delete my data"** — a new backend
  `DELETE /api/me` that removes the user's assessments and local `users` row.
  Note: deleting the Supabase *login itself* requires a service-role key,
  which this project deliberately never holds (see `CLAUDE.md`); the account
  page should say data is deleted and the login can be removed on request.
  Full account self-deletion is revisited in Phase 7.
  *Done when:* each action works end-to-end; data deletion verified in psql.

- [ ] **1.4 — Sign-up & email confirmation polish**
  Resend-confirmation button, clear messaging for unconfirmed accounts,
  password strength hint, friendly error copy for wrong credentials vs.
  unconfirmed email. Review `Login.jsx`'s existing no-session notice.
  *Done when:* signing up with confirmation enabled is self-explanatory
  without reading docs.

## Phase 2 — UI/UX overhaul

*Direction: calm, credible, professional — a governance instrument, not a
flashy SaaS landing page. Think regulator-friendly: strong typography, clear
risk-level color coding, generous whitespace.*

- [ ] **2.1 — Design foundation: Tailwind + design tokens**
  Install Tailwind CSS v4. Define tokens as CSS variables consumed by
  Tailwind: color palette (including one semantic color per risk level —
  these must stay consistent everywhere: lists, dashboard, PDF), type scale,
  spacing. Migrate the app shell (header/footer/container) as the proof.
  Delete migrated rules from `styles.css` as you go — no dead CSS left behind.
  *Done when:* app shell renders from Tailwind; token file documented; rest of
  the app still works on old CSS temporarily.

- [ ] **2.2 — App shell & navigation**
  Replace the header-tabs layout with a proper shell: left sidebar (Dashboard,
  New assessment, Past assessments, Account) + top bar (user menu, logout).
  Responsive: sidebar collapses on mobile. This creates the empty Dashboard
  slot that Phase 3 fills.
  *Done when:* navigation works on desktop and a phone-sized window; active
  route is highlighted.

- [ ] **2.3 — Assessment form UX**
  Rework `AssessmentForm.jsx`: group fields into logical steps or sections
  (About the system → Data & context → Scope), inline validation before
  submit, helper text explaining what each field influences, character
  guidance on the description (quality in → quality out). Migrate its styles
  to Tailwind.
  *Done when:* a first-time user can fill the form without guessing; invalid
  submits are impossible.

- [ ] **2.4 — Results presentation**
  Rework `AssessmentResult.jsx`: overall risk verdict as a prominent banner,
  one card per framework with expandable detail, consistent risk badges,
  clear obligations/recommendations lists, visible disclaimer. This layout is
  also the base for the PDF in Phase 4 — keep it print-sensible.
  *Done when:* a stakeholder could read the result cold and understand the
  verdict in 30 seconds.

- [ ] **2.5 — Loading, empty & error states**
  The assessment call takes 10–60 s with no streaming: design an honest
  progress state (what's happening, expected wait, don't navigate away).
  Empty states for no assessments yet; error states for 502/503 with
  plain-language explanations (e.g. API key vs. model failure). Finish the
  Tailwind migration; delete `styles.css`.
  *Done when:* every state reachable in the app looks intentional;
  `styles.css` is gone.

## Phase 3 — Assessments done properly

- [ ] **3.1 — Backend: list querying & pagination**
  Extend `GET /api/assessments` with query params: text search (project
  name/summary), filter by risk level / industry / date range, sort, and
  pagination (`limit`/`offset`, total count in response). Keep the
  `user_id` filter invariant on every query. Add tests.
  *Done when:* pytest covers each param; endpoint documented in FastAPI docs.

- [ ] **3.2 — Past assessments page: search & filters UI**
  Wire the list page to 3.1: search box, filter chips (risk level, industry),
  sort dropdown, pagination controls, count display.
  *Done when:* with 10+ assessments seeded, finding a specific one takes
  seconds.

- [ ] **3.3 — Dashboard**
  Fill the Phase 2 slot: stat tiles (total assessments, count by risk level),
  a risk-distribution chart, assessments-over-time chart, recent assessments
  list. Use a lightweight chart lib (e.g. Recharts). Backend: one
  `GET /api/stats` endpoint (per-user, obviously).
  *Done when:* dashboard reflects reality against psql counts; looks good
  with 1 assessment and with 50.

- [ ] **3.4 — Delete & archive**
  `DELETE /api/assessments/{id}` (404-not-403 pattern, same as GET) and an
  `archived` flag with an Alembic migration; archived items hidden by default,
  visible via filter. Confirm-dialog in UI, no accidental deletes.
  *Done when:* delete and archive/unarchive work; tests cover the ownership
  check on both.

- [ ] **3.5 — Versioned re-assessment**
  The governance-workflow feature: open a past assessment → "Revise & re-run"
  → form pre-filled with its inputs → new run saved as a new version of the
  same assessment. Data model: `parent_id` (self-reference) + `version` int
  via Alembic migration; list shows only latest versions with a version
  count; detail view gets a version-history switcher. Two sessions if needed
  (backend/model first, UI second — split per workflow rule 5).
  *Done when:* revise → re-run → both versions visible and openable; list
  isn't cluttered by old versions.

## Phase 4 — Professional reports

- [ ] **4.1 — Print stylesheet (quick win)**
  A print-optimised view of the result page (`@media print`: hide nav,
  page-break sensibly, black-on-white, footer with generated date +
  disclaimer). "Print / Save as PDF" button triggering `window.print()`.
  *Done when:* browser print preview produces a clean multi-page document.

- [ ] **4.2 — Branded PDF export**
  `@react-pdf/renderer` document mirroring the result layout: cover block
  (project, date, overall risk), per-framework sections, obligations,
  disclaimer. Downloaded as `<project>-assessment-v<version>.pdf`.
  **Client-side only — do not add WeasyPrint or other native-dependency PDF
  tools** (Homebrew hazard on this machine, see `CLAUDE.md`).
  *Done when:* downloaded PDF looks like a deliverable you'd send a client.

## Phase 5 — Frameworks & custom criteria

- [ ] **5.1 — Per-assessment framework selection**
  Let the form choose which of the four frameworks to screen against
  (default: all). Backend: selection stored in `input_json`, passed via
  `_build_user_message` — **not** by editing `SYSTEM_PROMPT` (cache).
  Result schema must tolerate a subset. Frontend renders only what came back.
  *Done when:* a two-framework assessment runs, saves, renders, and exports
  correctly.

- [ ] **5.2 — Add new built-in frameworks**
  Add 1–2 frameworks (candidates: Colorado AI Act, UK AI principles,
  sector-specific — Kat picks at session start). This is the one sanctioned
  `SYSTEM_PROMPT` edit — batch all new frameworks into a single edit
  (one-time cache invalidation), update `schemas.py` Literals **and** the
  mirrored frontend constants (documented invariant), and the PDF layout.
  *Done when:* new framework selectable, assessed, rendered, exported.

- [ ] **5.3 — Custom criteria (stretch)**
  User-defined screening criteria: a `custom_frameworks` table (name +
  criteria text, per user, Alembic migration), CRUD UI under Account or a new
  Settings page, injected into the *user message* at assessment time so the
  cached system prompt is untouched. Results for custom criteria render in a
  clearly-marked "Custom criteria" card.
  *Done when:* define a custom framework → include it in an assessment → see
  its verdict.

## Phase 6 — Go live

*Target architecture: Vercel serves the built frontend and **rewrites `/api/*`
to the Railway backend URL** — this preserves `api.js`'s relative-URL design
with zero code changes. Railway runs FastAPI + Postgres. Supabase stays auth-only.*

- [ ] **6.1 — Production readiness of the backend**
  Env-driven config review: `DATABASE_URL` from env (already supported),
  explicit CORS allowlist (Vercel domain), production server command
  (uvicorn with workers), a `/api/health` check Railway can probe,
  `Dockerfile` or Railway build config, and a release step that runs
  `alembic upgrade head` before boot.
  *Done when:* backend runs locally in "production mode" from a clean env
  with only env vars.

- [ ] **6.2 — Deploy backend + database (Railway)**
  Create the Railway project: Postgres + backend service deploying from the
  GitHub repo, env vars set (`ANTHROPIC_API_KEY`, `SUPABASE_URL`,
  `DATABASE_URL`), migrations run, seed **not** run in prod (demo data is
  local-only — decide at session start if the demo example should exist in prod).
  *Done when:* `https://<railway-url>/api/health` returns healthy with
  `api_key_configured: true`.

- [ ] **6.3 — Deploy frontend (Vercel) + Supabase prod config**
  Vercel project from the repo (`frontend/` root), env vars
  (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), `/api/*` rewrite to
  Railway. Supabase dashboard: add the Vercel URL to Site URL / redirect
  allowlist (password reset from 1.2 must work in prod). Optional: custom
  domain.
  *Done when:* full flow works on the public URL from a phone: sign in, run
  an assessment, view dashboard, reset password.

- [ ] **6.4 — Auto-deploy & smoke checklist**
  Confirm merge-to-main auto-deploys both sides; write
  `docs/smoke-checklist.md` (the 6.3 flow) to run after risky merges; add
  deployment section to README; record all prod URLs + where each secret
  lives in `CLAUDE.md`.
  *Done when:* a trivial PR merged to main appears on the live site without
  manual steps.

## Phase 7 — Security, privacy & operations

*As a governance product, this phase is also marketing: the app should
practice what it assesses.*

- [ ] **7.1 — Rate limiting & hardening**
  `slowapi` rate limits (strict on `POST /api/assessments` — it costs real
  money per call; generous on reads), request size limits, security headers
  (CSP, HSTS, nosniff, frame-deny) on both Vercel and FastAPI responses.
  *Done when:* hammering the assessment endpoint returns 429; headers verified
  with an online scanner (e.g. securityheaders.com).

- [ ] **7.2 — Error tracking & uptime**
  Sentry (free tier) on backend + frontend with secrets scrubbed from events;
  UptimeRobot (free) probing `/api/health` and the frontend, alerting Kat's
  email.
  *Done when:* a deliberate test error appears in Sentry; downtime test
  alert received.

- [ ] **7.3 — Backups & data export**
  Verify/enable Railway Postgres backups and **actually test a restore** into
  a scratch database. Add `GET /api/me/export` returning all of the user's
  data as JSON (GDPR-style portability), with a download button on the
  Account page.
  *Done when:* restore drill documented in `docs/`; export downloads and
  contains everything.

- [ ] **7.4 — Privacy notice, terms & security review**
  In-app `/privacy` and `/terms` pages written honestly for this app: what is
  stored (assessment inputs/results, email), that assessment text is sent to
  Anthropic's API for processing, retention, contact. Then run Claude Code's
  `/security-review` on the codebase and fix what it finds. Revisit the 1.3
  decision on full account self-deletion (options: Supabase edge function
  with service key held only in Supabase, or a documented manual process).
  *Done when:* pages live and linked from the footer; security review
  findings triaged (fixed or consciously accepted, noted here).

## Phase 8 — Invite first users

- [ ] **8.1 — Closed signup + invitations**
  Supabase dashboard: disable public signups. Invite via Supabase's
  "Invite user" (sends the email, no service key needed in the app). Login
  page: replace the sign-up form with "access by invitation" messaging;
  make sure the invite-acceptance redirect (set-password flow) works with the
  routes from 1.1/1.2.
  *Done when:* a fresh email address gets invited, sets a password, and lands
  signed-in; cold signup is impossible.

- [ ] **8.2 — Onboarding polish**
  First-login experience: a welcome/empty dashboard that points to "run your
  first assessment", an in-app "How screening works" page (methodology, the
  four+ frameworks, honest limitations — governance credibility), and a
  feedback link (mailto is fine).
  *Done when:* a brand-new invited user needs no verbal explanation from Kat.

## Phase 9 — Platform future (backlog)

*Not planned in detail. Revisit after Phase 8 and promote items into real
phases when wanted. Ordered by how naturally they extend the product:*

- **AI system register** — the strongest candidate: a per-organisation
  inventory of AI systems (lifecycle status, owner, risk classification,
  linked assessments, review dates). This is the core artefact of EU AI Act /
  ISO 42001 governance practice and would move the app from "screening tool"
  to "governance platform".
- **Teams / organisation workspaces** — shared assessments within an org,
  roles (viewer/assessor/admin).
- **Review & approval workflow** — assessments get a status
  (draft → in review → approved), a named reviewer, and sign-off; pairs with
  versioning from 3.5.
- **Audit trail** — immutable log of who did what when; a governance platform
  should be auditable itself.
- **Assessment templates** — pre-filled forms per use-case family.
- **API access** — token-authenticated REST API so orgs can integrate
  screening into their intake processes.
- **GCP migration** — Cloud Run (backend) + Cloud SQL (Postgres) + Cloud
  Storage; worth doing when a client requires it or for the CV. The Docker
  setup from 6.1 makes this mostly a re-pointing exercise, not a rewrite.
- **Streaming assessment output** — stream Claude's response so the 10–60 s
  wait shows progress; meaningful UX work in both backend and frontend.
- **Billing** — only if this ever goes beyond invited users.

---

## Running costs (target state, Phases 6–8)

| Service | Plan | Cost |
|---|---|---|
| Vercel (frontend) | Hobby | $0 |
| Railway (backend + Postgres) | Usage-based | ~$5–10/mo |
| Supabase (auth) | Free | $0 (watch the pause-on-inactivity gotcha — prod usage prevents it) |
| Anthropic API | Pay-as-you-go | Usage-dependent; prompt caching keeps repeat assessments cheap |
| Sentry + UptimeRobot | Free tiers | $0 |
| Domain (optional) | — | ~$10–15/yr |

## Progress log

Agents: append one line per completed session — date, session ID, PR, and
anything the next session should know.

| Date | Session | Notes |
|---|---|---|
| 2026-07-19 | 0.1 | 51 tests in `backend/tests/` (agent JSON parsing/retry, auth/JWT via real HS256 path, routes/ownership/404-not-403, denormalised-column consistency). Run: `.venv/bin/python -m pytest` from `backend/`. Tests use in-memory SQLite + `create_all` (Alembic still owns the real schema) and never call Anthropic or Supabase. Dev deps in `backend/requirements-dev.txt` (standalone on purpose — see file comment). For 0.3: CI can run the same suite; `TEST_DATABASE_URL` env var switches tests to a Postgres service container if wanted. |
