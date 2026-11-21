# MirrorFlix project status

## Objective and architecture

MirrorFlix is a React/Vite frontend backed by FastAPI and PostgreSQL:

```text
React/Vite → Nginx → FastAPI/Uvicorn → PostgreSQL
```

The production site is served by Nginx for `alterbucket.in` and `www.alterbucket.in`. The observed Nginx configuration serves `/var/www/alterbucket/frontend/dist` and contains a proxy to `127.0.0.1:8000`; however, public `/api/...` paths currently return 404, so that proxy does not expose the recovered API routes.

## Current implementation

- Recovered the VPS backend source files into the local repository: `backend/database.py`, `backend/main.py`, `backend/models.py`, and `requirements.txt`.
- Kept database credentials out of the recovered files. The backend reads `DATABASE_URL` from the process environment or ignored `.env` files.
- Added paginated movie listing, movie details, categories, anime listing/detail, database health, and CORS configuration while retaining the existing featured and genre endpoints.
- Made database setup compatible with MySQL via the active service's separate `DB_*` settings and kept `DATABASE_URL` support for local development. Backend imports support both the current service's `main:app` launch from `backend/` and project-root `backend.main:app` launch. Replaced PostgreSQL-specific JSONB with generic JSON and added MySQL-compatible null sorting.
- Added a guarded schema initializer that requires an explicit database-name confirmation and refuses to run on any database that already has tables. It has not been run on production.
- Protected the content-writing genre endpoint with an `API_ADMIN_TOKEN`; the token is never embedded in frontend code.
- Connected the frontend to configurable API calls for featured movies, movies, and anime. Existing carousel, cards, modal, and player remain in use. The player only receives a stream URL if an actual source exists in content data.
- Kept the existing local featured preview as a fallback when the database has no featured movies or the API is unavailable.
- Added loading, error, and empty states for movie and anime sections.
- Added `.env.example`, `requirements-dev.txt`, API/deployment docs, and backend API tests.

## Production inspection findings

- PostgreSQL 16 listens on `127.0.0.1:5432`; the database is not bound to a public interface.
- The earlier inspected `mirrorflix_db` had tables `categories`, `featured_movies`, `genres`, `movies`, `ratings`, and `watch_history`, with 7 genre rows (empty anime lists) and zero rows in the other five tables. The live service's database-check endpoint instead reports `alterbucket_db`; its schema and contents have not yet been inspected, so the earlier table and row-count findings do not establish production content availability.
- The homepage returns HTTP 200. The complete Nginx HTTPS server block has `location /api/` proxying to `127.0.0.1:8000`, but public `/api/movies/featured` and `/api/genres` still return 404. The recovered FastAPI routes are reachable directly over HTTP on port 8001, but CORS preflight is rejected (405), so the HTTPS frontend cannot safely call that listener directly. The direct API returns seven genre names, but every anime list is empty.
- UFW allows ports 2105, 80, 443, and 8001 from anywhere. The `127.0.0.1:8000` process belongs to `alterbucket-api.service` (`/system.slice/alterbucket-api.service`). A separate Uvicorn process listens on `0.0.0.0:8001` under an interactive root login session (`/user.slice/user-0.slice/session-870.scope`); it is not the Nginx upstream. PostgreSQL remains local-only. No firewall or service changes were made.
- `alterbucket-api.service` is active as `deploy:deploy`, working from `/home/deploy/alterbucket/backend` and loading `/home/deploy/alterbucket/backend/.env`. Its current deployed route set is only `/`, `/api/health`, and `/api/database-check`; the movie/anime API routes are absent. Only environment variable names were read, never values.
- The active service's `.env` points to `127.0.0.1:3306` and `alterbucket_db`; its database engine is MySQL/MariaDB, separate from the PostgreSQL 16 instance on port 5432 and `mirrorflix_db` inspected earlier. The deployed `/api/database-check` reports `alterbucket_db`. The active venv has FastAPI 0.163.1 and PyMySQL 1.2.4, but no SQLAlchemy. A read-only table listing returned only the database name and no tables. Local code now supports MySQL, but the schema must be initialized before data-backed routes can work.
- The live port-8001 API includes an unauthenticated `/api/genres/{genre_name}/animes` write route. The recovered local version now fails closed unless `API_ADMIN_TOKEN` is configured.
- The VPS checkout has an uncommitted `.gitignore` change and untracked backend/dependency files on commit `e0ad168`. These were preserved. The local repository is based on `cdea5c3` and changes are on `codex/mirrorflix-backend-integration`.

## Validation

- `npm run build`: passes. Vite still reports the existing esbuild/oxc configuration warning.
- `git diff --check`: passes.
- Backend tests are present in `tests/test_api.py`. Test collection is blocked in this Windows environment because Application Control prevents loading SQLAlchemy's compiled extension. No production database was used for local tests.
- Production API responses and browser-to-API behavior still need verification after a deployment is approved.

## Remaining work and known risks

- Validate the MySQL backend and guarded schema initializer locally; run backend tests in an environment that permits the SQLAlchemy package. Then prepare a production change plan for installing SQLAlchemy, deploying backend/frontend assets, and initializing the currently empty database. The managed service's unit, launch path, environment-file path, and existing route set are confirmed; the 8001 process is session-scoped rather than a managed service.
- Review the public UFW allowance for port 8001 and decide whether it should be removed. No change has been made.
- Decide where the production `API_ADMIN_TOKEN` will be stored before enabling the write route.
- Run backend tests in an environment that permits the installed SQLAlchemy package, then verify API behavior with a test database.
- Review and approve a deployment plan before any production file, service, Nginx, firewall, or database change.
- Production deployment has not been performed. No database records were added, changed, or deleted.
