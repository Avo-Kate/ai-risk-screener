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
from .database import get_db, init_db
from .models import Assessment
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
    # Create tables and ensure the example assessment is present on startup.
    init_db()
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
def create_assessment(payload: AssessmentInput, db: Session = Depends(get_db)):
    """Run an assessment via the agent, save it, and return the full record."""
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
def list_assessments(db: Session = Depends(get_db)):
    """List past assessments, newest first."""
    rows = db.query(Assessment).order_by(Assessment.created_at.desc()).all()
    return rows


@app.get("/api/assessments/{assessment_id}", response_model=AssessmentRecord)
def get_assessment(assessment_id: int, db: Session = Depends(get_db)):
    """Return a single full assessment by id."""
    row = db.get(Assessment, assessment_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return _to_record(row)
