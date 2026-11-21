# Integration guide

The production frontend and optional FastAPI sync service are documented in [frontend.md](frontend.md) and [backend.md](backend.md).

## Active integrations

- The browser reads genre and anime records directly from the external database API configured by `VITE_API_BASE_URL`.
- Anime search calls AniList directly from the browser.
- TV-series search calls TVmaze directly from the browser.
- The FastAPI service on port `8002` is an administrative proxy/synchronization service. It is not required by the current home-page browser code, but it needs the external database API on port `8001`.

## Streambert playback integration

`src/streambert-anime-test.cjs` contains the HiAnime search, episode extraction, HLS discovery, and media-proxy implementation. `server/streambert-server.cjs` exposes it to the browser under `/api/streambert/*`; `src/streambert-browser-adapter.js` is the browser client. `npm run dev` starts the API on port `3001` together with Vite, which forwards the same-origin API path.

Opening an anime modal retrieves numbered episodes. Selecting one resolves its stream and creates an expiring per-stream proxy session. `VideoPlayer` lazy-loads HLS.js where native HLS is unavailable and attempts autoplay.

The standalone interactive experiment remains available with:

```bash
node src/streambert-anime-test.cjs
```

This depends on third-party site markup and network access. Electron is optional; plain Node uses the built-in HTTP fallback. Browser playback uses the local API/proxy, not a FastAPI endpoint. Production must deploy the Node service and equivalent reverse-proxy forwarding.

`src/components/animeDataService.js` retains the older eager-enrichment compatibility workflow. Active modals call `fetchAnimeEpisodes` and `fetchEpisodeStream` on demand instead of resolving streams for every visible card.

## Aniwave episode scraper

`src/aniwave-scraper.cjs` resolves an HLS/MP4 source and all available caption tracks from a full Aniwave slug and episode number. It prefers soft-sub servers for subtitle extraction, falls back across compatible servers, and filters thumbnail tracks. It requires authorized use of Aniwave's episode and source endpoints; it does not bypass CAPTCHA, DRM, or third-party host protections.

Run it as a CLI (JSON is written to stdout):

```powershell
node src/aniwave-scraper.cjs one-piece-81553 1
node src/aniwave-scraper.cjs one-piece-81553 1 --mode dub
```

The local Streambert service also exposes:

```text
GET /api/streambert/aniwave/stream?animeId=one-piece-81553&episode=1&mode=sub
```

That endpoint returns the player's normal tokenized same-origin `videoUrl` and `subtitles` fields. SRT captions are converted to WebVTT by the playback proxy. Source URLs and upstream availability can change; offline fixture tests do not guarantee live playback.

Optional mutual-TLS credentials are loaded only for Aniwave requests, never sent to media hosts or committed to the repository:

- `ANIWAVE_TLS_CERT_PATH` and `ANIWAVE_TLS_KEY_PATH` must be set together.
- `ANIWAVE_TLS_CA_PATH` optionally identifies a custom CA file.
- `ANIWAVE_TLS_KEY_PASSWORD` optionally decrypts the private key.

Keep credential files outside the repository. The CLI reads the project `.env`; the Streambert service already loads it at startup.

## Verification

```bash
npm test
npm run build
cd backend
python -m unittest discover -s tests -v
```

These tests are offline. They do not validate third-party website availability, CORS, media playback, or a live database.
