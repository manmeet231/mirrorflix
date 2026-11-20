# MirrorFlix

A React/Vite media catalog with AniList and TVmaze search, an external anime database, and an optional FastAPI synchronization service.

## Documentation

- [frontend.md](frontend.md): frontend architecture, browser integrations, data contracts, playback, deployment, and limitations.
- [backend.md](backend.md): FastAPI setup, internals, every endpoint, sync parameters, responses, and operations.
- [INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md): active versus experimental integrations.
- [docs/video-player.md](docs/video-player.md): detailed native player behavior.

## Quick start

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

The frontend expects a genre database at the configured `VITE_API_BASE_URL`. An optional persistent MySQL catalog implementation and TMDB batch importer are now available; see [backend/CATALOG_SETUP.md](backend/CATALOG_SETUP.md).

To run the optional sync service:

```powershell
pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
Set-Location backend
python main.py
```

It listens on `127.0.0.1:8002` by default and expects the external database on port `8001`.

## Verification

```powershell
npm test
npm run build
Set-Location backend
python -m unittest discover -s tests -v
```

The automated tests are offline. Live third-party APIs, database writes, browser playback, and the experimental Streambert scraper require separate integration testing.

## Important boundaries

- The current browser does not call FastAPI directly.
- Catalog likes/list selections and navbar filters are not persisted or fully implemented.
- Playback requires episode `videoUrl` data; the active player does not provide HLS or DRM.
- Streambert is a standalone experiment and is not a production browser API.
- The sync service has no authentication and should not be exposed publicly without protection.
