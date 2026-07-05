"""FastAPI application: routes, startup (DB init + seed), and error handling."""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

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
    AssessmentRecord,
    AssessmentResult,
    AssessmentSummary,
)
from .seed import seed_example

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_risk")


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
        created_at=row.created_at,
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
        input_json=payload.model_dump(),
        result_json=result.model_dump(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_record(row)


@app.get("/api/assessments", response_model=list[AssessmentSummary])
def list_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the caller's own assessments, newest first."""
    rows = (
        db.query(Assessment)
        .filter(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
        .all()
    )
    return rows


@app.get("/api/assessments/{assessment_id}", response_model=AssessmentRecord)
def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return one of the caller's own assessments by id.

    Returns 404 (not 403) for both a missing id and one owned by another user,
    so the endpoint never reveals that an assessment exists for someone else.
    """
    row = db.get(Assessment, assessment_id)
    if row is None or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _to_record(row)
