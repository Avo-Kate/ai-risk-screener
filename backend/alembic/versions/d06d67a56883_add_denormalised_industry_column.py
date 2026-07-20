"""add denormalised industry column

Copies `industry` out of input_json into its own indexed column so the list
endpoint can filter on it without parsing JSON — the same reasoning behind the
existing project_name / overall_risk_level / summary columns.

Autogenerate produced a plain NOT NULL ADD COLUMN, which fails on a table that
already has rows. This does it in three steps instead: add nullable, backfill
from the existing JSON, then tighten to NOT NULL.

Revision ID: d06d67a56883
Revises: b229705b8963
Create Date: 2026-07-20 12:50:55.776231

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d06d67a56883"
down_revision: str | Sequence[str] | None = "b229705b8963"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "assessments",
        sa.Column("industry", sa.String(length=64), nullable=True),
    )

    # Backfill from the JSON already stored on each row. Both Postgres and
    # SQLite (3.38+) support ->> for JSON text extraction; the fallback keeps
    # rows whose input_json somehow lacks the key from breaking the NOT NULL.
    op.execute(
        sa.text(
            "UPDATE assessments "
            "SET industry = COALESCE(input_json ->> 'industry', 'other')"
        )
    )

    op.alter_column(
        "assessments",
        "industry",
        existing_type=sa.String(length=64),
        nullable=False,
    )
    op.create_index(
        op.f("ix_assessments_industry"), "assessments", ["industry"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_assessments_industry"), table_name="assessments")
    op.drop_column("assessments", "industry")
