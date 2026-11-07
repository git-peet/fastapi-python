# exp4 Local Startup Guide

This guide describes how to start the Full Stack FastAPI Template locally at `http://localhost:8000`. Docker Compose is the recommended path when you want to run the application in containers; host-native development is also documented below.

## Before starting

- Run commands from the repository root unless a step says otherwise.
- Use local development settings only. Do not display, paste into chat, or commit `.env` values, passwords, keys, or tokens.
- `scripts/prestart.sh` applies Alembic migrations and ensures the initial administrator exists. It changes the local database schema; use it only on the intended local database.
- Never use `docker compose down -v` as routine cleanup. The `-v` flag deletes database volumes.
- Do not install packages, build or pull images, run migrations, or change database credentials unless the user has authorized those steps. Startup commands below use `--no-build --pull never` so missing images cause a failure instead of an implicit build or pull. If an image or other prerequisite is missing, stop and ask before taking additional action.

## Recommended: default Docker Compose project

Use this when host port `5432` is free and the required images are available locally.

1. Check the current project services and relevant ports:

   ```bash
   docker compose ps -a
   ss -ltnp '( sport = :5432 or sport = :8000 )'
   ```

2. Start PostgreSQL and Mailpit:

   ```bash
   docker compose up -d --no-build --pull never db mailpit
   ```

   The default `compose.override.yml` publishes PostgreSQL on host port `5432`. If another service already owns that port, do not stop it blindly; use the isolated-project option below.

3. Prepare the database **only if migrations/initial setup are needed and authorized**:

   ```bash
   docker compose run --rm --pull never backend bash scripts/prestart.sh
   ```

   This runs migrations and may create the configured initial administrator. Do not run it against a shared or valuable database without checking first.

4. Start the backend:

   ```bash
   docker compose up -d --no-build --pull never backend
   docker compose ps backend db mailpit
   ```

   The Compose override maps the backend to port `8000`. If the backend image is missing, this command fails because builds and pulls are disabled; stop and get approval before building or pulling it.

5. Verify locally:

   ```bash
   curl -sS -o /dev/null -w 'App: HTTP %{http_code}\n' http://localhost:8000/
   curl -sS -o /dev/null -w 'Health: HTTP %{http_code}\n' http://localhost:8000/api/v1/utils/health-check/
   curl -sS -o /dev/null -w 'API docs: HTTP %{http_code}\n' http://localhost:8000/docs
   ```

   The previous successful startup returned HTTP 200 for all three. Mailpit, if started, is available at `http://localhost:8025`.

To stop the local services without deleting database data:

```bash
docker compose stop backend db mailpit
```

`docker compose down` removes containers and the network but keeps named volumes by default. Do not add `-v` unless deleting the database is explicitly intended and approved.

## If host port 5432 is already in use

The default override maps the container's PostgreSQL port to host port `5432`. The previous successful workaround used an isolated Compose project named `exp4-local` and a temporary override that published only the backend port. It used the base `compose.yml` plus that override, **not** the default `compose.override.yml`, so PostgreSQL stayed on the private Compose network and did not bind host port `5432`.

Create `/tmp/exp4-compose-local.yml` with:

```yaml
services:
  backend:
    ports:
      - "8000:8000"
    command:
      - fastapi
      - run
      - --host
      - 0.0.0.0
```

This isolated mode also uses `/tmp/exp4-local.env` for local `SECRET_KEY` and `POSTGRES_PASSWORD` values. The earlier run created it with restrictive permissions. **Never print or commit its values.** Keep the same file for the lifetime of that database volume: changing `POSTGRES_PASSWORD` in an env file does not change the password already stored in an initialized PostgreSQL volume.

Only for a **brand-new isolated `exp4-local` database** with no existing `exp4-local` volume and no matching env file, generate one once:

```bash
umask 077
printf 'SECRET_KEY=%s\nPOSTGRES_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 24)" > /tmp/exp4-local.env
```

If the volume exists but its matching env file is missing, stop and ask for help. Do not generate a replacement password, alter the database role, or remove the volume automatically.

For a new isolated local database, the documented command pattern is:

```bash
docker compose --env-file .env --env-file /tmp/exp4-local.env \
  -p exp4-local -f compose.yml -f /tmp/exp4-compose-local.yml \
  up -d --pull never --no-build db

docker compose --env-file .env --env-file /tmp/exp4-local.env \
  -p exp4-local -f compose.yml -f /tmp/exp4-compose-local.yml \
  run --rm --no-deps --pull never backend bash scripts/prestart.sh

docker compose --env-file .env --env-file /tmp/exp4-local.env \
  -p exp4-local -f compose.yml -f /tmp/exp4-compose-local.yml \
  up -d --pull never --no-build backend
```

`--pull never --no-build` uses local images only. If an image is missing, stop and get approval before pulling or building. Use the same `-p` and `-f` arguments for later status, logs, stop, or down commands; this stack has a separate database volume from the default `exp4` project.

### Historical password-mismatch recovery

During the previous startup, a persistent `exp4-local` database had a different PostgreSQL password from the newly generated temp env file. The one-time recovery changed the local database role password, then reran migrations. **That is not a normal startup step.** If authentication fails, stop and ask before changing a database role or removing/resetting a volume.

## Optional host-native development

The project also documents running FastAPI on the host and Vite separately. This requires `uv`, Python `>=3.14`, and Bun. `uv` was not available in the host shell during the previous session, so this path has not been verified here.

Once the tools and dependencies are installed, the documented sequence is:

```bash
# Start local PostgreSQL and Mailpit from the project root
docker compose up -d db mailpit

# In a terminal from backend/
uv sync
uv run bash scripts/prestart.sh
uv run fastapi dev

# In another terminal from the project root
bun install
bun run dev
```

This serves the Vite frontend at `http://localhost:5173` and the API at `http://localhost:8000`. `uv sync` and `bun install` may download dependencies; review their effects before running them, and do not install packages or use network access without authorization.

After startup, use the verification commands in step 5 to check the application, health endpoint, and API docs. Do not treat successful HTTP responses as proof that an unverified database migration has been applied.
