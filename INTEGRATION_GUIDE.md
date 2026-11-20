# Integration guide

The production frontend and optional FastAPI sync service are documented in [frontend.md](frontend.md) and [backend.md](backend.md).

## Active integrations

- The browser reads genre and anime records directly from the external database API configured by `VITE_API_BASE_URL`.
- Anime search calls AniList directly from the browser.
- TV-series search calls TVmaze directly from the browser.
- The FastAPI service on port `8002` is an administrative proxy/synchronization service. It is not required by the current home-page browser code, but it needs the external database API on port `8001`.

## Experimental Streambert integration

`src/streambert-anime-test.cjs` is a standalone CommonJS/Electron-aware scraper and local-player experiment. It is not part of the Vite production import graph. `src/streambert-browser-adapter.js` returns empty results in a browser and dynamically loads the scraper only in Node.

Run the interactive experiment with:

```bash
node src/streambert-anime-test.cjs
```

This depends on third-party site markup, network access, and Electron when Electron's `net.fetch` path is desired. It is not a stable or supported browser API. No endpoint in the FastAPI service exposes it.

`src/components/animeDataService.js` contains the older eager stream-enrichment workflow. The active home page does not call it; normal search uses the pure mapper in `src/components/animeMapper.js` so the scraper is not bundled into the application.

## Verification

```bash
npm test
npm run build
cd backend
python -m unittest discover -s tests -v
```

These tests are offline. They do not validate third-party website availability, CORS, media playback, or a live database.
