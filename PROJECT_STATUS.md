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
- Protected the content-writing genre endpoint with an `API_ADMIN_TOKEN`; the token is never embedded in frontend code.
- Connected the frontend to configurable API calls for featured movies, movies, and anime. Existing carousel, cards, modal, and player remain in use. The player only receives a stream URL if an actual source exists in content data.
- Kept the existing local featured preview as a fallback when the database has no featured movies or the API is unavailable.
- Added loading, error, and empty states for movie and anime sections.
- Added `.env.example`, `requirements-dev.txt`, API/deployment docs, and backend API tests.

## Production inspection findings

- PostgreSQL 16 listens on `127.0.0.1:5432`; the database is not bound to a public interface.
- Tables: `categories`, `featured_movies`, `genres`, `movies`, `ratings`, and `watch_history`.
- The inspected database had 7 genre rows, each with an empty anime list, and no rows in the other five tables. Movie, featured, and anime sections therefore have no database content yet; the frontend shows the existing preview titles for the featured hero.
- The backend schema includes category-to-movie, featured-to-movie, rating-to-movie, and watch-history-to-movie foreign keys. Genre anime data is stored in JSONB.
- The homepage returns HTTP 200. Public `/api/movies/featured` and `/api/genres` return 404 through Nginx. The existing FastAPI routes are reachable directly over HTTP on port 8001, but CORS preflight is rejected (405), so the HTTPS frontend cannot safely call that listener directly. The direct API returns seven genre names, but every anime list is empty.
- UFW allows ports 2105, 80, 443, and 8001 from anywhere. A Uvicorn process listens on `0.0.0.0:8001`; another process listens on `127.0.0.1:8000`. PostgreSQL remains local-only. No firewall or service changes were made.
- The live port-8001 API includes an unauthenticated `/api/genres/{genre_name}/animes` write route. The recovered local version now fails closed unless `API_ADMIN_TOKEN` is configured.
- The VPS checkout has an uncommitted `.gitignore` change and untracked backend/dependency files on commit `e0ad168`. These were preserved. The local repository is based on `cdea5c3` and changes are on `codex/mirrorflix-backend-integration`.

## Validation

- `npm run build`: passes. Vite still reports the existing esbuild/oxc configuration warning.
- `git diff --check`: passes.
- Backend tests are present in `tests/test_api.py`. Test collection is blocked in this Windows environment because Application Control prevents loading SQLAlchemy's compiled extension. No production database was used for local tests.
- Production API responses and browser-to-API behavior still need verification after a deployment is approved.

## Remaining work and known risks

- Confirm the running process/service behind ports 8000 and 8001 and verify the live API response formats.
- Review the public UFW allowance for port 8001 and decide whether it should be removed. No change has been made.
- Decide where the production `API_ADMIN_TOKEN` will be stored before enabling the write route.
- Run backend tests in an environment that permits the installed SQLAlchemy package, then verify API behavior with a test database.
- Review and approve a deployment plan before any production file, service, Nginx, firewall, or database change.
- Production deployment has not been performed. No database records were added, changed, or deleted.
