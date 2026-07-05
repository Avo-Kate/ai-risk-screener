"""SQLAlchemy engine, session factory, and declarative base.

The schema is owned by Alembic migrations (see backend/alembic), not by
``create_all``. Run ``alembic upgrade head`` to create/upgrade the schema before
starting the app.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

# check_same_thread=False is required for SQLite when used across FastAPI's
# threadpool. It is ignored for other databases (e.g. Postgres).
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency that yields a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
