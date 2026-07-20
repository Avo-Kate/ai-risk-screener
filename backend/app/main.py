"""FastAPI application: routes, startup (DB init + seed), and error handling."""

import logging
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import asc, case, desc, func, or_, select
from sqlalchemy.orm import Session, aliased

from . import config
from .agent import (
    APIKeyMissingError,
    AssessmentParseError,
    UpstreamError,
    run_assessment,
)
from .auth import get_current_user
from .database import get_db
from .models import Assessment, User
from .schemas import (
    AssessmentInput,
    AssessmentPage,
    AssessmentRecord,
    AssessmentResult,
    AssessmentSummary,
    AssessmentUpdate,
    IndustryCount,
    MonthCount,
    RiskCount,
    SortField,
    SortOrder,
    StatsResponse,
)
from .seed import seed_example

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_risk")

# Sorting by risk has to follow severity, not the alphabet — otherwise "high"
# sorts before "low" before "medium" before "unacceptable", which is nonsense
# to a reader. Unknown values sort last.
RISK_ORDER = case(
    {"low": 1, "medium": 2, "high": 3, "unacceptable": 4},
    value=Assessment.overall_risk_level,
    else_=99,
)


# Severity order, mirrored in the frontend's RISK_LEVELS.
RISK_LEVELS_ORDERED = ["low", "medium", "high", "unacceptable"]

# The key identifying a version family. Roots carry parent_id = NULL and are
# their own family; every re-run points its parent_id at the root (see the
# versioning note in models.py).
FAMILY_ID = func.coalesce(Assessment.parent_id, Assessment.id)


def _family_id(row: Assessment) -> int:
    return row.parent_id or row.id


def _escape_like(term: str) -> str:
    """Neutralise LIKE wildcards so a user searching for "50%" means literally that."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _month_key(moment: datetime) -> str:
    """Bucket a timestamp into "YYYY-MM"."""
    return f"{moment.year:04d}-{moment.month:02d}"


def _recent_month_keys(months: int) -> list[str]:
    """The last `months` month keys, oldest first, ending with the current one."""
    now = datetime.now(timezone.utc)
    keys = []
    year, month = now.year, now.month
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    return list(reversed(keys))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The schema is owned by Alembic migrations (run `alembic upgrade head`
    # before starting the app), not created here. On startup we only ensure the
    # example assessment is present. seed_example is idempotent, so this is safe
    # to run against an already-seeded database.
    from .database import SessionLocal

    db = SessionLocal()
    try:
        if seed_example(db):
            logger.info("Seeded example assessment.")
    finally:
        db.close()
    yield


app = FastAPI(
    title="AI Governance Risk Assessment Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _to_record(row: Assessment) -> AssessmentRecord:
    """Build the full API response object from an ORM row."""
    return AssessmentRecord(
        id=row.id,
        project_name=row.project_name,
        overall_risk_level=row.overall_risk_level,
        summary=row.summary,
        industry=row.industry,
        archived=row.archived,
        created_at=row.created_at,
        version=row.version,
        parent_id=row.parent_id,
        input=AssessmentInput.model_validate(row.input_json),
        result=AssessmentResult.model_validate(row.result_json),
    )


@app.get("/api/health")
def health():
    """Liveness probe that also reports whether the API key is configured."""
    return {"status": "ok", "api_key_configured": bool(config.get_api_key())}


@app.post("/api/assessments", response_model=AssessmentRecord)
def create_assessment(
    payload: AssessmentInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run an assessment via the agent, save it for the caller, and return it."""
    try:
        result = run_assessment(payload)
    except APIKeyMissingError as e:
        # 503: the service is not configured to talk to the model.
        raise HTTPException(status_code=503, detail=str(e)) from e
    except UpstreamError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except AssessmentParseError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    row = Assessment(
        user_id=current_user.id,
        project_name=payload.project_name,
        overall_risk_level=result.overall_risk_level,
        summary=result.summary,
        industry=payload.industry,
        input_json=payload.model_dump(),
        result_json=result.model_dump(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_record(row)


@app.get("/api/assessments", response_model=AssessmentPage)
def list_assessments(
    q: str | None = Query(
        None,
        max_length=200,
        description="Case-insensitive substring match on project name or summary.",
    ),
    risk_level: list[str] | None = Query(
        None,
        description="Repeatable. Keep only these overall risk levels.",
    ),
    industry: list[str] | None = Query(
        None,
        description="Repeatable. Keep only these industries.",
    ),
    created_after: datetime | None = Query(
        None, description="Only assessments created at or after this instant."
    ),
    created_before: datetime | None = Query(
        None, description="Only assessments created at or before this instant."
    ),
    archived: bool = Query(
        False,
        description="False (default) lists active assessments; true lists archived ones.",
    ),
    sort: SortField = Query("created_at"),
    order: SortOrder = Query("desc"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the caller's own assessments, with search, filters and pagination.

    The `user_id` filter is applied first and is never optional — see the
    ownership invariant in CLAUDE.md. `total` counts everything matching the
    filters, before limit/offset, so the UI can show result counts.
    """
    # "Latest version of each family" as a correlated NOT EXISTS: keep a row
    # only when no newer version of the same family exists. A window function
    # would read better but does not have one portable spelling across the
    # Postgres the app runs on and the SQLite the tests use.
    newer = aliased(Assessment)
    has_newer_version = (
        select(1)
        .where(
            func.coalesce(newer.parent_id, newer.id) == FAMILY_ID,
            newer.version > Assessment.version,
            newer.user_id == current_user.id,
        )
        .exists()
    )

    query = db.query(Assessment).filter(
        Assessment.user_id == current_user.id,
        # Archived rows are a separate view, never mixed into the active list.
        Assessment.archived.is_(archived),
        # Superseded versions stay reachable through the version-history
        # endpoint, but must not clutter the list.
        ~has_newer_version,
    )

    if q:
        # ilike is case-insensitive on Postgres; on SQLite LIKE is already
        # case-insensitive for ASCII, so this behaves the same in tests.
        pattern = f"%{_escape_like(q)}%"
        query = query.filter(
            or_(
                Assessment.project_name.ilike(pattern, escape="\\"),
                Assessment.summary.ilike(pattern, escape="\\"),
            )
        )
    if risk_level:
        query = query.filter(Assessment.overall_risk_level.in_(risk_level))
    if industry:
        query = query.filter(Assessment.industry.in_(industry))
    if created_after:
        query = query.filter(Assessment.created_at >= created_after)
    if created_before:
        query = query.filter(Assessment.created_at <= created_before)

    # Count the filtered set before paginating.
    total = query.count()

    direction = asc if order == "asc" else desc
    if sort == "risk":
        sort_column = RISK_ORDER
    elif sort == "project_name":
        sort_column = Assessment.project_name
    else:
        sort_column = Assessment.created_at
    # id is a stable tiebreaker, so paging can't drop or repeat a row when
    # several share a sort value.
    query = query.order_by(direction(sort_column), Assessment.id.desc())

    items = query.limit(limit).offset(offset).all()
    return AssessmentPage(
        items=_summaries_with_version_counts(db, items),
        total=total,
        limit=limit,
        offset=offset,
    )


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(
    months: int = Query(12, ge=1, le=60, description="Width of the time series."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregates over the caller's own assessments, for the dashboard.

    Grouping happens in Python rather than SQL on purpose. Month bucketing has
    no portable SQL spelling (Postgres `date_trunc` vs SQLite `strftime`), and
    this reads three narrow columns for one user — a personal-scale query. If a
    single user ever holds enough assessments for this to matter, move the
    grouping into dialect-specific SQL then, not before.
    """
    rows = (
        db.query(
            Assessment.overall_risk_level,
            Assessment.industry,
            Assessment.created_at,
        )
        .filter(
            Assessment.user_id == current_user.id,
            # Archived work is excluded: the dashboard describes the active
            # portfolio, and an archived assessment is one the user has set
            # aside on purpose.
            Assessment.archived.is_(False),
        )
        .all()
    )

    risk_counts = Counter(row.overall_risk_level for row in rows)
    industry_counts = Counter(row.industry for row in rows)
    month_counts = Counter(_month_key(row.created_at) for row in rows)

    return StatsResponse(
        total=len(rows),
        # Zero-filled and in severity order, so the chart's categories are
        # stable no matter what the data happens to contain.
        by_risk_level=[
            RiskCount(level=level, count=risk_counts.get(level, 0))
            for level in RISK_LEVELS_ORDERED
        ],
        # Largest first; only industries actually present.
        by_industry=[
            IndustryCount(industry=name, count=count)
            for name, count in industry_counts.most_common()
        ],
        # Zero-filled across the whole window so the time axis has no holes.
        over_time=[
            MonthCount(month=key, count=month_counts.get(key, 0))
            for key in _recent_month_keys(months)
        ],
    )


@app.delete("/api/me")
def delete_my_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all of the caller's data: their assessments and local users row.

    This is app-level data deletion (GDPR-style). The Supabase login itself is
    not touched — this backend deliberately holds no Supabase admin credential
    (see CLAUDE.md); the users row would simply be recreated on a later
    authenticated request. Removing the login is a manual/admin step.
    """
    deleted = (
        db.query(Assessment)
        .filter(Assessment.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.delete(current_user)
    db.commit()
    logger.info("Deleted data for user %s (%d assessments)", current_user.id, deleted)
    return {"deleted_assessments": deleted}


def _summaries_with_version_counts(
    db: Session, rows: list[Assessment]
) -> list[AssessmentSummary]:
    """Attach each row's family version count, in one extra query for the page.

    Storing the count on the row would mean updating every sibling on each
    re-run; deriving it per row would mean a query per row. One grouped query
    scoped to the families actually on this page is the middle ground.
    """
    if not rows:
        return []

    families = {_family_id(row) for row in rows}
    counts = dict(
        db.query(FAMILY_ID, func.count(Assessment.id))
        .filter(FAMILY_ID.in_(families))
        .group_by(FAMILY_ID)
        .all()
    )

    return [
        AssessmentSummary(
            id=row.id,
            project_name=row.project_name,
            overall_risk_level=row.overall_risk_level,
            summary=row.summary,
            industry=row.industry,
            created_at=row.created_at,
            version=row.version,
            version_count=counts.get(_family_id(row), 1),
        )
        for row in rows
    ]


def _owned_or_404(db: Session, assessment_id: int, current_user: User) -> Assessment:
    """Fetch one of the caller's assessments, or raise 404.

    404 — never 403 — for both a missing id and another user's row, so no
    endpoint ever reveals that an assessment exists for someone else. Every
    single-assessment route must go through this.
    """
    row = db.get(Assessment, assessment_id)
    if row is None or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return row


@app.get("/api/assessments/{assessment_id}", response_model=AssessmentRecord)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one of the caller's own assessments by id."""
    return _to_record(_owned_or_404(db, assessment_id, current_user))


@app.patch("/api/assessments/{assessment_id}", response_model=AssessmentRecord)
def update_assessment(
    assessment_id: int,
    payload: AssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the mutable flags on an assessment — currently just `archived`.

    The assessment's content is never editable: a saved assessment is a record
    of what the model said at a point in time. To reassess, run a new version
    (see the revise endpoint).
    """
    row = _owned_or_404(db, assessment_id, current_user)
    if payload.archived is not None:
        row.archived = payload.archived
    db.commit()
    db.refresh(row)
    return _to_record(row)


@app.get(
    "/api/assessments/{assessment_id}/versions",
    response_model=list[AssessmentSummary],
)
def list_versions(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every version of this assessment's family, newest first.

    Works from any member of the family, not just the latest — a bookmarked v1
    URL must still be able to show its history.
    """
    row = _owned_or_404(db, assessment_id, current_user)
    family = _family_id(row)

    rows = (
        db.query(Assessment)
        .filter(
            Assessment.user_id == current_user.id,
            FAMILY_ID == family,
        )
        .order_by(Assessment.version.desc())
        .all()
    )
    return _summaries_with_version_counts(db, rows)


@app.post("/api/assessments/{assessment_id}/revise", response_model=AssessmentRecord)
def revise_assessment(
    assessment_id: int,
    payload: AssessmentInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-run an assessment with revised inputs, saved as the next version.

    The earlier version is left exactly as it was — that is the point. The new
    row joins the same family, so the list shows only this one while the history
    endpoint still reaches the old verdict.
    """
    original = _owned_or_404(db, assessment_id, current_user)
    family = _family_id(original)

    try:
        result = run_assessment(payload)
    except APIKeyMissingError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except (UpstreamError, AssessmentParseError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    # Take the next version number from the whole family, not from the row the
    # caller happened to open — reviving an old version must not collide.
    highest = (
        db.query(func.max(Assessment.version))
        .filter(
            Assessment.user_id == current_user.id,
            FAMILY_ID == family,
        )
        .scalar()
        or 0
    )

    row = Assessment(
        user_id=current_user.id,
        project_name=payload.project_name,
        overall_risk_level=result.overall_risk_level,
        summary=result.summary,
        industry=payload.industry,
        input_json=payload.model_dump(),
        result_json=result.model_dump(),
        parent_id=family,
        version=highest + 1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_record(row)


def _detach_version_family(db: Session, row: Assessment) -> None:
    """Keep the rest of a version family intact when its root is deleted.

    Later versions point their parent_id at the root, so deleting the root would
    orphan them. Promote the earliest survivor to root and re-point the others
    at it, which keeps COALESCE(parent_id, id) constant across the family and
    leaves the history intact — just without the version that was deleted.

    Only the root needs this: deleting any other version affects nothing else.
    """
    if row.parent_id is not None:
        return

    children = (
        db.query(Assessment)
        .filter(Assessment.parent_id == row.id)
        .order_by(Assessment.version.asc())
        .all()
    )
    if not children:
        return

    new_root, *rest = children
    new_root.parent_id = None
    for child in rest:
        child.parent_id = new_root.id
    db.flush()


@app.delete("/api/assessments/{assessment_id}", status_code=204)
def delete_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently delete one version of one of the caller's assessments.

    Deletes exactly the row addressed — other versions of the same assessment
    survive. Irreversible; the UI offers archiving as the reversible
    alternative and confirms before calling this.
    """
    row = _owned_or_404(db, assessment_id, current_user)
    _detach_version_family(db, row)
    db.delete(row)
    db.commit()
    return Response(status_code=204)
