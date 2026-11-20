# MirrorFlix AniList Sync Service

FastAPI backend service for fetching anime from AniList and syncing to your genre-based database.

## Features

- Fetch anime from AniList via GraphQL API
- Categorize anime by status (Currently Airing, Upcoming, Completed)
- Sync anime to your database by genre
- Batch fetching with pagination
- Append mode (preserves existing anime)

## Setup

1. Install Python on your system
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure your `.env` file (optional - uses defaults):

```env
API_BASE_URL=http://127.0.0.1:8001
ANILIST_API=https://graphql.anilist.co
BATCH_SIZE=50
MAX_DOWNLOADS=1000
PORT=8002
LOG_LEVEL=INFO
log_file=logs/sync.log
```

## Run the Server

```bash
cd backend
python main.py
```

Or start with uvicorn directly:
```bash
uvicorn main:app --reload --port 8002
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Sync Anime
Fetch anime from AniList and sync to database:
```bash
POST /api/fetch-anime?page=1&per_page=50&max_pages=20&status_filter=RELEASING
```

### Get Sync Status
Check current sync state:
```bash
GET /api/sync/status
```

### List Genres
Get all genres from your database:
```bash
GET /api/genres
```

### Get Genre
Get a specific genre:
```bash
GET /api/genres/Action
```

### Post Anime to Genre
Add/update anime in a genre:
```bash
POST /api/genres/{genre_name}/animes
Content-Type: application/json

{
  "animes": [
    {
      "id": "1",
      "malId": 12345,
      "title": "Anime Title",
      "description": "...",
      "poster": "url...",
      "thumbnail": "url...",
      "backdrop": "url...",
      "genres": ["Action"],
      "matchPercentage": "85%",
      "ageRating": "U/A",
      "seasons": "24 Episodes",
      "year": "2024",
      "rating": "TV",
      "duration": "24 min",
      "status": "Currently Airing",
      "season": "Winter",
      "seasonYear": "2024",
      "popularity": 1000,
      "nextAiringEpisode": {"episode": 12, "airingAt": 1234567890},
      "streamUrl": null,
      "episodes": [],
      "isAdult": false,
      "synonyms": ["Title in Japanese"],
      "coverImage": {...},
      "bannerImage": "url..."
    }
  ]
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| API_BASE_URL | http://127.0.0.1:8001 | Your database API URL |
| ANILIST_API | https://graphql.anilist.co | AniList GraphQL endpoint |
| BATCH_SIZE | 50 | Anime per AniList page |
| MAX_DOWNLOADS | 1000 | Maximum anime to fetch |
| PORT | 8002 | API server port |
| LOG_LEVEL | INFO | Logging level |
| log_file | logs/sync.log | Log file path |

## Data Flow

1. Client calls `POST /api/fetch-anime`
2. Service fetches manga from AniList (paginated)
3. Maps manga data to database JSON schema
4. Groups by genre and posts to `/api/genres/{genre}/animes`
5. Returns sync statistics

## Output

Logs are written to:
- Console output
- `backend/logs/sync.log`

## Troubleshooting

### Port already in use
Change the `PORT` in `.env` to a different value.

### Connection to database failed
Ensure your database API is running at `http://127.0.0.1:8001`.

### No anime synced
- Check your internet connection
- Verify AniList API is accessible
- Check log file in `backend/logs/`

## Dependencies

- fastapi - Web framework
- uvicorn - ASGI server
- aiohttp - Async HTTP client
- pydantic - Data validation
- python-dotenv - Environment variables
- apscheduler - Task scheduling

## Endpoints

- `/` - Root endpoint
- `/health` - Health check
- `/api/genres` - List all genres
- `/api/genres/{name}` - Get specific genre
- `/api/genres/{name}/animes` - POST anime data
- `/api/fetch-anime` - Trigger AniList sync
- `/api/sync/status` - Sync status