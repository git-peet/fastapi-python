"""Test-only PostgreSQL engine; refuses to fall back to application settings."""

import os

from sqlalchemy.engine import make_url
from sqlmodel import create_engine

_raw_test_database_url = os.environ.get("TEST_DATABASE_URL")
if not _raw_test_database_url:
    raise RuntimeError(
        "TEST_DATABASE_URL is required. Backend tests must use an explicitly "
        "selected disposable PostgreSQL database; the application DB is never a fallback."
    )

_url = make_url(_raw_test_database_url)
if _url.get_backend_name() != "postgresql":
    raise RuntimeError("TEST_DATABASE_URL must use PostgreSQL")
if not _url.database or "test" not in _url.database.lower():
    raise RuntimeError("TEST_DATABASE_URL database name must contain 'test' as a safety check")

# Normalize SQLAlchemy to the driver used by this project and avoid printing credentials.
_url = _url.set(drivername="postgresql+psycopg")
TEST_DATABASE_URL = _url.render_as_string(hide_password=False)
test_engine = create_engine(_url, pool_pre_ping=True)

def describe_test_database() -> str:
    host = _url.host or "localhost"
    port = _url.port or 5432
    return f"{host}:{port}/{_url.database}"
