# MirrorFlix backend

## Role and architecture

The backend is a FastAPI administrative service for reading/writing an **external** genre database and synchronizing anime from AniList. The database implementation itself is not in this repository. By default it is expected at `http://127.0.0.1:8001`; this FastAPI service listens on port `8002`.

```text
POST /api/fetch-anime
  -> api/routes.py (validation + process-local state)
  -> services/anilist_service.py (GraphQL pages, retries, delays, deduplication)
  -> services/mapping_service.py (AniList -> database fields)
  -> services/db_client.py (grouped HTTP writes to external database)

GET/POST genre routes -> routes.py -> db_client.py -> external database API
```

The current browser home page talks to the external database directly, not through this service. There is no local SQL database, ORM, authentication layer, background worker, scheduler, WebSocket, or Streambert endpoint in FastAPI. Anime playback uses the separate Node service in `server/streambert-server.cjs`, documented in [frontend.md](frontend.md).

## Setup and run

Python 3.11+ is recommended; this checkout was verified with Python 3.15. Run commands from the repository root unless shown otherwise.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env  # optional
Set-Location backend
python main.py
```

Equivalent ASGI command from `backend/`: `uvicorn main:app --reload --port 8002`.

For offline tests, install `backend/requirements-dev.txt`, then from `backend/` run:

```powershell
python -m unittest discover -s tests -v
python -m compileall -q api services main.py logging_config.py
```

`backend/test_api.py` is instead a live integration script: it fetches real AniList data and writes to the configured database. Do not run it against production unintentionally.

## Configuration

`python-dotenv` loads `backend/.env` when `main.py` is imported from the normal working directory.

| Variable | Default | Description |
| --- | --- | --- |
| `API_BASE_URL` | `http://127.0.0.1:8001` | External database origin. All proxy and sync requests use it. |
| `ANILIST_API` | `https://graphql.anilist.co` | AniList GraphQL endpoint. |
| `HOST` | `127.0.0.1` | Bind address used by `python main.py`. |
| `PORT` | `8002` | Listen port used by `python main.py`. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins. Credentials are enabled only for an explicit origin list. |
| `LOG_LEVEL` | `INFO` | Standard Python logging level. |
| `LOG_FILE` | `logs/sync.log` | Rotating log path, relative to the process working directory. Legacy `log_file` is also accepted. |

Old documentation's `BATCH_SIZE` and `MAX_DOWNLOADS` variables are not read. APScheduler is not used or required. Log files rotate at 5 MiB with three backups. Use one process/worker unless sync locking is redesigned.

## Application lifecycle and internals

- `main.py` configures logging/CORS, registers routes, and uses a FastAPI lifespan context to close the shared aiohttp session on shutdown.
- `logging_config.py` provides console and rotating-file handlers without duplicate handlers.
- `DatabaseClient` owns a reusable session, a 30-second total timeout, URL encoding, JSON decoding, and downstream/network errors. It is created lazily as a singleton.
- Downstream 4xx responses are preserved by proxy routes. Downstream 5xx, invalid responses, connection failures, and timeouts become `502 Bad Gateway`.
- `AniListService` uses one GraphQL query with typed variables, retries transient network failures, and handles HTTP 429 using `Retry-After`, rate-limit reset, or backoff. There is a 3.5-second delay between pages.
- AniList numeric IDs and database string IDs are normalized to strings before deduplication.
- Mapping selects English, then Romaji, then native title. Only the **first genre** determines the destination database group; records without genres go to `Uncategorized`.

## HTTP endpoints

Interactive OpenAPI documentation is at `http://127.0.0.1:8002/docs`; the schema is at `/openapi.json`.

### `GET /`

Local service metadata. Response: `{ "name", "version", "status": "running" }`. No downstream request is made.

### `GET /api/health`

Local liveness response: `{ "status": "healthy", "message": "MirrorFlix AniList Sync Service is running" }`. This does not prove AniList or the database is reachable.

### `GET /api/sync/status`

Returns current-process state:

```json
{ "is_syncing": false, "last_sync": "completed", "total_animes_synced": 0 }
```

`last_sync` is `null` before/while running, `completed`, or `failed`. `total_animes_synced` describes the most recent sync response, not a cumulative lifetime count. State is memory-only, resets on restart, and is not shared between workers.

### `GET /api/genres`

Proxies `GET {API_BASE_URL}/api/genres`. Expected success response:

```json
[{ "id": 1, "name": "Action", "animes": [{ "id": "21", "title": "Example" }] }]
```

The complete external anime object is passed through. No pagination or response-size limit is applied here.

### `GET /api/genres/{genre_name}`

Proxies one genre, URL-encoding the path segment (for example, `Slice%20of%20Life`). A downstream 404 remains a 404.

### `POST /api/genres/{genre_name}/animes`

The request body is a **raw JSON array**, not an object:

```json
[{ "id": "21", "title": "Example", "genres": ["Action"] }]
```

The client wraps it as `{ "animes": [...] }` for the external database. A successful downstream JSON body is returned unchanged. An empty array returns `{ "success": true, "message": "No anime to post" }` without a downstream call. Downstream 409 and other 4xx statuses are preserved.

### `POST /api/fetch-anime`

Runs synchronization synchronously; the HTTP response arrives only after fetching and writing finish.

| Query parameter | Default | Validation/meaning |
| --- | --- | --- |
| `status_filters` | all three statuses | Repeat the parameter. Allowed: `RELEASING`, `FINISHED`, `NOT_YET_RELEASED`; values are uppercased. |
| `per_page` | `50` | Integer 1–50; AniList page size. |
| `max_pages_per_status` | `100` | Integer 1–100. |
| `target_total` | `5000` | Integer 1–100000; maximum unique new anime across statuses. |
| `skip_existing` | `true` | Load database IDs first to avoid fetching known records. |

Example:

```http
POST /api/fetch-anime?status_filters=RELEASING&status_filters=FINISHED&per_page=50&max_pages_per_status=2&target_total=100&skip_existing=true
```

Successful response shape:

```json
{
  "success": true,
  "message": "Sync completed successfully. Added 100 new anime.",
  "result": {
    "total_anime": 100,
    "genres_updated": 3,
    "entries_added": 100,
    "entries_skipped": 0,
    "errors": [],
    "by_genre": { "Action": { "added": 60, "status": "success" } }
  }
}
```

`entries_added` counts items submitted in successful (200/201) genre requests; the external API is responsible for final persistence/deduplication. Per-genre errors are accumulated in `result.errors`, so partial success is possible even when top-level `success` is true. If no new records are found, all result counts are zero and sync state becomes `completed`.

Errors: `422` for invalid parameters/statuses, `429` when this process already has a sync running, and `500` for an aborted sync. The `finally` path always releases the local running flag. This is not a durable or background job; clients must tolerate long requests and upstream proxy timeouts.

## Mapped anime fields

`map_anime_to_db` emits `id`, `malId`, `title`, `description`, `poster`, `thumbnail`, `backdrop`, `genres`, `matchPercentage`, `ageRating`, `seasons`, `year`, `rating`, `duration`, `status`, `season`, `seasonYear`, `popularity`, `nextAiringEpisode`, `streamUrl`, `episodes`, `isAdult`, `synonyms`, `coverImage`, and `bannerImage`.

Statuses map to Currently Airing, Upcoming, Completed, Hiatus, or Cancelled. `seasons` is actually an episode-count label, `duration` includes `min`, and sync initializes `streamUrl` to `null` and `episodes` to `[]`.

## Security and operations

There is no authentication or authorization. Anyone who can reach the service can trigger expensive AniList/database writes. Bind to loopback or protect it with an authenticated reverse proxy, restrict `CORS_ORIGINS`, use HTTPS in production, and add rate limiting before exposing it publicly. CORS is not access control.

Check `logs/sync.log` for upstream failures. For `502`, verify `API_BASE_URL` and the external database. For `429`, wait for the existing request; after a process crash/restart the memory lock resets naturally. AniList throttling can make large syncs take a long time by design.
