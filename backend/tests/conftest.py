import os
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    raise RuntimeError(
        "TEST_DATABASE_URL is required. Tests must use an explicitly isolated, "
        "disposable database; refusing to use the application database."
    )
if not TEST_DATABASE_URL.startswith("sqlite:///") or TEST_DATABASE_URL == "sqlite:///:memory:":
    raise RuntimeError(
        "The API test fixture only supports a dedicated file-backed SQLite database. "
        "Use scripts/test-isolated.sh with TEST_DATABASE_URL=sqlite:///auto."
    )
workspace_env = Path(__file__).resolve().parents[2] / ".env"
configured_env = (Path.cwd() / "../.env").resolve()
if configured_env == workspace_env.resolve():
    raise RuntimeError(
        "Run isolated API tests through scripts/test-isolated.sh so the project .env is not loaded."
    )
sqlite_path = TEST_DATABASE_URL.removeprefix("sqlite:///")
if os.path.exists(sqlite_path):
    raise RuntimeError(
        "Refusing to reuse an existing SQLite database file. "
        "Choose a new disposable path or use scripts/test-isolated.sh with sqlite:///auto."
    )

from app import crud  # noqa: E402
from app.api.deps import get_db  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserCreate  # noqa: E402
from tests.utils.user import (  # noqa: E402
    authentication_token_from_email,
    create_random_user,
)

connect_args = {"check_same_thread": False}
test_engine = create_engine(TEST_DATABASE_URL, connect_args=connect_args)


@pytest.fixture(scope="session", autouse=True)
def create_test_schema() -> Generator[None]:
    """Create and remove tables only in the explicitly configured test database."""
    SQLModel.metadata.create_all(test_engine)
    with Session(test_engine) as session:
        superuser = session.exec(
            select(User).where(User.email == settings.FIRST_SUPERUSER)
        ).first()
        if superuser is None:
            crud.create_user(
                session=session,
                user_create=UserCreate(
                    email=settings.FIRST_SUPERUSER,
                    password=settings.FIRST_SUPERUSER_PASSWORD,
                    is_superuser=True,
                ),
            )
    yield
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture
def db() -> Generator[Session]:
    with Session(test_engine) as session:
        yield session


@pytest.fixture
def client() -> Generator[TestClient]:
    def override_get_db() -> Generator[Session]:
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    response = client.post(
        f"{settings.API_V1_STR}/login/access-token",
        data={
            "username": settings.FIRST_SUPERUSER,
            "password": settings.FIRST_SUPERUSER_PASSWORD,
        },
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def normal_user_token_headers(
    client: TestClient, db: Session
) -> dict[str, str]:
    user = create_random_user(db)
    assert user.email
    return authentication_token_from_email(
        client=client, email=str(user.email), db=db
    )
