"""SQLAlchemy ORM models.

Each row is one saved assessment: the structured input the user submitted plus
the structured result returned by the agent. The full input and result are kept
as JSON; a few fields (project name, date, overall risk level) are denormalised
into columns so the list view is cheap to render.
"""

from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )

    # Denormalised for the list view.
    project_name: Mapped[str] = mapped_column(String(255), default="Untitled project")
    overall_risk_level: Mapped[str] = mapped_column(String(32), default="medium")
    summary: Mapped[str] = mapped_column(Text, default="")

    # Full structured input and full structured result.
    input_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict] = mapped_column(JSON)
