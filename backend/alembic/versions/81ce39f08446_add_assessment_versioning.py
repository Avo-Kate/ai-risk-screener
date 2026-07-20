"""add assessment versioning

Revision ID: 81ce39f08446
Revises: fc467b4eaec3
Create Date: 2026-07-20 13:10:43.952312

"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "81ce39f08446"
down_revision: str | Sequence[str] | None = "fc467b4eaec3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # parent_id is NULL for an original assessment, so it needs no backfill.
    op.add_column("assessments", sa.Column("parent_id", sa.Integer(), nullable=True))

    # version does need one: every existing row is version 1. Add with a
    # server_default so the NOT NULL holds, then drop the default so the value
    # comes from the model on future inserts.
    op.add_column(
        "assessments",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("assessments", "version", server_default=None)

    op.create_index(
        op.f("ix_assessments_parent_id"), "assessments", ["parent_id"], unique=False
    )
    # SET NULL, not CASCADE: deleting one version must never delete the rest
    # of the family. See the note on Assessment.parent_id.
    # Named explicitly — autogenerate emitted None, which downgrade cannot drop.
    op.create_foreign_key(
        "fk_assessments_parent_id",
        "assessments",
        "assessments",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_assessments_parent_id", "assessments", type_="foreignkey")
    op.drop_index(op.f("ix_assessments_parent_id"), table_name="assessments")
    op.drop_column("assessments", "version")
    op.drop_column("assessments", "parent_id")
