# MirrorFlix API

The API is implemented in `backend/main.py`. Responses are JSON. The frontend uses the configured API origin plus the `/api` path; production can use same-origin requests through Nginx.

## Endpoints

### Health

`GET /api/health`

Checks database connectivity with `SELECT 1`.

```json
{"status":"ok","database":"connected"}
```

Returns `503` if PostgreSQL is unavailable.

### Featured movies

`GET /api/movies/featured?limit=10`

Returns active featured movies ordered by featured score. `limit` is 1–50. The response remains an array for compatibility with the existing carousel.

Each item includes `id`, `title`, `description`, `year`, `poster`, `backdrop`, `backgroundImage`, `averageRating`, `totalViews`, `category`, `genres`, and `contentType`.

### Movie catalog

`GET /api/movies?limit=24&offset=0&category=Action&search=sample&sort=recent`

- `limit`: 1–100; default 24.
- `offset`: 0 or greater; default 0.
- `category`: category ID or case-insensitive category name.
- `search`: case-insensitive title match.
- `sort`: `recent`, `popular`, `rating`, or `title`.

Response:

```json
{"items":[],"total":0,"limit":24,"offset":0,"hasMore":false}
```

### Movie details

`GET /api/movies/{movie_id}`

Returns one movie in the same card/detail shape. Returns `404` when the ID is missing.

### Categories

`GET /api/categories`

Returns category IDs and names for movie rows.

### Anime catalog

`GET /api/anime?genre=Action&limit=24&offset=0`

Flattens anime JSONB lists from the `genres` table, merges genre names, deduplicates entries by ID, and paginates the result. `genre` is optional; an unknown genre returns `404`.

Response:

```json
{"items":[],"total":0,"limit":24,"offset":0,"hasMore":false}
```

`GET /api/anime/{anime_id}` returns a matching anime item or `404`.

### Genres

- `GET /api/genres` returns each genre and its stored anime list.
- `GET /api/genres/{genre_name}` returns one genre or `404`.

### Add anime to a genre

`POST /api/genres/{genre_name}/animes`

Accepts a JSON object and upserts by its `id` within that genre. Requires the `X-Admin-Token` header matching the server-side `API_ADMIN_TOKEN`. If the token is not configured, the endpoint returns `503`; an invalid or missing token returns `401`. The token must never be placed in the frontend.

Example request body:

```json
{"id":123,"title":"Example title","genres":["Action"]}
```

## Error responses

- `404`: requested movie, anime, or genre does not exist.
- `401`: invalid or missing admin token for content writes.
- `422`: invalid path or query parameter.
- `503`: database unavailable or content management is not configured.
- Other unexpected server errors use FastAPI's generic response and do not return database connection details.
