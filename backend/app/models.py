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

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
)
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

    # Denormalised for the list view. These must stay consistent with the JSON
    # blobs below — nothing enforces it at the database level.
    #
    # `industry` is copied out of input_json (rather than queried inside it) so
    # the list endpoint can filter and index on it without parsing JSON, which
    # is the whole reason the other three are denormalised too.
    project_name: Mapped[str] = mapped_column(String(255), default="Untitled project")
    overall_risk_level: Mapped[str] = mapped_column(String(32), default="medium")
    summary: Mapped[str] = mapped_column(Text, default="")
    industry: Mapped[str] = mapped_column(String(64), default="other", index=True)

    # Archived rows are hidden from the default list and excluded from the
    # dashboard aggregates, but are never deleted — archiving is the reversible
    # alternative to DELETE.
    archived: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    # --- Versioning -----------------------------------------------------------
    # Re-running an assessment creates a *new row* rather than overwriting: the
    # point of versioning is that the earlier verdict stays readable.
    #
    # `parent_id` points at the ROOT of the version family, not at the immediate
    # predecessor — so v3's parent is v1, not v2. A chain would need recursion to
    # answer "show me every version"; a root pointer makes it one equality test.
    # The root itself has parent_id = NULL, which is why the family key is
    # COALESCE(parent_id, id) — see FAMILY_ID in main.py.
    # SET NULL, deliberately not CASCADE: deleting one version must never take
    # the rest of the family with it. The delete route re-parents the survivors
    # explicitly (see _detach_version_family), so this only ever fires as a
    # fail-safe — and it fails in the direction that preserves data, leaving an
    # orphan as its own root rather than deleting it.
    parent_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("assessments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # 1 for an original assessment, incrementing for each re-run.
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Full structured input and full structured result.
    input_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict] = mapped_column(JSON)
