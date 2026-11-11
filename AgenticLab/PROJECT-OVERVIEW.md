# Project Overview

- **Project:** exp4 — Full Stack FastAPI Template
- **Oriented:** 2025-11-03
- **Knowledge scope:** project:exp4
- **Coverage:** Backend (Python FastAPI), frontend (React/TS/Vite), deployment (Docker Compose with Traefik and PostgreSQL), CI (GitHub Actions), high-level project docs.

## Stack and workspace layout
- Languages: Python (FastAPI, SQLModel, Pydantic), TypeScript (React).
- Frameworks: FastAPI, SQLModel, Vite, TanStack Query, shadcn/ui, Tailwind CSS, Playwright, Pytest.
- Container: Docker Compose with Traefik reverse proxy, PostgreSQL.
- CI: GitHub Actions (test-backend, test-docker-compose, deploy, pre-commit, and others).
- Directories: `backend/` contains the Python app; `frontend/` contains Vite+React; `compose.yml` defines services; `.github/workflows/` contains CI jobs.

## Starting points and key flows
- Backend entry point: `backend/app/main.py` (FastAPI app serving `/` with static frontend `app.frontend("/", directory=FRONTEND_DIR)`).
- Frontend entry point: `frontend/` with Vite `bun run dev` (default port 5173).
- Docker Compose starts `proxy`, `db`, `adminer`, `backend` (with healthcheck).
- Build/test: Project uses standard Docker Compose up, `pytest` for backend unit/integration, and Playwright for frontend e2e tests; CI triggers these via `test-backend.yml` and `test-docker-compose.yml`.

## Build and test approach
- Backend: `docker compose run --rm backend bash scripts/prestart.sh` then `docker compose up -d` (services start with health checks).
- Frontend: In `frontend/` run `bun run dev` when serving via FastAPI; also can run `bun run build` to bundle.
- Tests: Run `docker compose up -d --wait backend` then `bunx playwright test` (frontend) and `pytest` (backend).
- CI workflow orchestrates these via GitHub Actions.

## Known unknowns
- Specific routes, API schemas, and frontend UI components beyond the high-level docs.
- Details of admin user flows, email templates, and exact CI configuration specifics (beyond compose.yml and workflow files).
- Exact behavior of custom OpenAPI unique ID generation and Sentry integration details.

## Sources
- `README.md` (project overview)
- `backend/app/main.py` (FastAPI entry point)
- `backend/pyproject.toml` (Python dependencies and tool config)
- `compose.yml` (Docker Compose services)
- `.github/workflows/` (CI jobs list)
- `frontend/README.md` (frontend development guide)