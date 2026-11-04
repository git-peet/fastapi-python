"""Backend fixtures that require a dedicated PostgreSQL test database."""

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

# Importing this helper fails immediately unless TEST_DATABASE_URL is explicit
# and names a PostgreSQL database marked for testing.
from tests.test_db import TEST_DATABASE_URL, test_engine

# Ensure app configuration and all API database sessions use test-only values.
# FASTAPI_ENV=test also disables loading the workspace .env file.
os.environ["FASTAPI_ENV"] = "test"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "fastapi-test-only-secret-key"
os.environ["PROJECT_NAME"] = "FastAPI test"
os.environ["FIRST_SUPERUSER"] = "test-admin@example.com"
os.environ["FIRST_SUPERUSER_PASSWORD"] = "test-only-password"
os.environ["EMAIL_TEST_USER"] = "test-user@example.com"
os.environ["SENTRY_DSN"] = ""
os.environ["SMTP_HOST"] = ""
os.environ["SMTP_USER"] = ""
os.environ["SMTP_PASSWORD"] = ""
os.environ["EMAILS_FROM_EMAIL"] = ""

from app.api.deps import get_db  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.db import init_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Item, User  # noqa: E402
from tests.utils.user import authentication_token_from_email  # noqa: E402
from tests.utils.utils import get_superuser_token_headers  # noqa: E402


def override_get_db() -> Generator[Session, None, None]:
    with Session(test_engine) as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session, None, None]:
    """Seed and clean test rows; schema migrations are applied by the isolated runner."""
    with Session(test_engine) as session:
        init_db(session)
        yield session
        session.exec(delete(Item))
        session.exec(delete(User))
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(
    client: TestClient, db: Session
) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
