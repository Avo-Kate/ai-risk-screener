"""Alembic migration environment.

The database URL and target metadata come from the application itself, so there
is a single source of truth and no connection string is ever hardcoded here:

- ``DATABASE_URL`` is read from the environment via ``app.config`` (default: a
  local Postgres). Never commit a real connection string.
- ``target_metadata`` is the app's SQLAlchemy metadata, so ``--autogenerate``
  can diff the models against the live database.

Run from the ``backend/`` directory (``prepend_sys_path = .`` in alembic.ini
puts it on the import path):

    alembic upgrade head          # create / upgrade the schema
    alembic revision --autogenerate -m "message"
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app import models  # noqa: F401  (registers tables on Base.metadata)

# Import the app's config and metadata. This makes `backend/` importable via
# `prepend_sys_path = .` in alembic.ini (run alembic from the backend dir).
from app.config import DATABASE_URL
from app.database import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Inject the runtime database URL from the environment rather than reading a
# hardcoded value from alembic.ini.
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
