"""add users and assessment ownership

Revision ID: b229705b8963
Revises: 3c6d7526617b
Create Date: 2026-07-05 11:18:13.339345

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b229705b8963'
down_revision: Union[str, Sequence[str], None] = '3c6d7526617b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Fixed demo user that owns the seeded example assessment. Keep in sync with
# DEMO_USER_ID / DEMO_USER_EMAIL in app/seed.py. The all-zero UUID is clearly
# synthetic and cannot collide with a real Supabase user id.
DEMO_USER_ID = "00000000-0000-0000-0000-000000000000"
DEMO_USER_EMAIL = "demo@ai-risk-screener.local"


def upgrade() -> None:
    """Add the users table and an owning user_id on assessments.

    Ordering matters: add user_id nullable, ensure a demo user exists, backfill
    any pre-existing assessments to it, then enforce NOT NULL + the foreign key.
    """
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.add_column("assessments", sa.Column("user_id", sa.Uuid(), nullable=True))

    # Ensure the demo user exists, then adopt any existing (pre-auth) rows so the
    # NOT NULL + FK below hold. On a fresh database the UPDATE affects 0 rows.
    # Cast the string bind params to uuid explicitly — Postgres does not
    # implicitly coerce a text parameter into a uuid column.
    op.execute(
        sa.text(
            "INSERT INTO users (id, email, created_at) "
            "VALUES (CAST(:id AS uuid), :email, now()) ON CONFLICT (id) DO NOTHING"
        ).bindparams(id=DEMO_USER_ID, email=DEMO_USER_EMAIL)
    )
    op.execute(
        sa.text(
            "UPDATE assessments SET user_id = CAST(:id AS uuid) WHERE user_id IS NULL"
        ).bindparams(id=DEMO_USER_ID)
    )

    op.alter_column("assessments", "user_id", existing_type=sa.Uuid(), nullable=False)
    op.create_foreign_key(
        "fk_assessments_user_id_users",
        "assessments",
        "users",
        ["user_id"],
        ["id"],
    )
    op.create_index(
        op.f("ix_assessments_user_id"), "assessments", ["user_id"], unique=False
    )


def downgrade() -> None:
    """Reverse: drop user_id from assessments and drop the users table."""
    op.drop_index(op.f("ix_assessments_user_id"), table_name="assessments")
    op.drop_constraint(
        "fk_assessments_user_id_users", "assessments", type_="foreignkey"
    )
    op.drop_column("assessments", "user_id")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
