"""SQLAlchemy ORM models.

Each assessment is owned by a user. A user mirrors a Supabase identity: the id is
the Supabase user UUID (the JWT `sub` claim) and is upserted on first
authenticated request (see auth.py) — Supabase remains the source of truth for
credentials; this table only records ownership so assessments can FK to it.

Each assessment row is one saved assessment: the structured input the user
submitted plus the structured result returned by the agent. The full input and
result are kept as JSON; a few fields (project name, date, overall risk level)
are denormalised into columns so the list view is cheap to render.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    # The Supabase user id (JWT `sub`). We store it verbatim so assessments can
    # reference it without depending on where Supabase's own tables live.
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str] = mapped_column(String(320), default="", index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )


class Assessment(Base):
    __tablename__ = "assessments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, index=True
    )

    # Owner. Every assessment belongs to exactly one user; all queries filter by
    # it so users only ever see their own assessments.
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False, index=True
    )

    # Denormalised for the list view.
    project_name: Mapped[str] = mapped_column(String(255), default="Untitled project")
    overall_risk_level: Mapped[str] = mapped_column(String(32), default="medium")
    summary: Mapped[str] = mapped_column(Text, default="")

    # Full structured input and full structured result.
    input_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict] = mapped_column(JSON)
