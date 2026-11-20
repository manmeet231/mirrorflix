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

## Verification

```bash
npm test
npm run build
cd backend
python -m unittest discover -s tests -v
```

These tests are offline. They do not validate third-party website availability, CORS, media playback, or a live database.
