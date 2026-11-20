# MirrorFlix frontend

## Purpose and scope

MirrorFlix is a React single-page catalog interface built with Vite. The active application displays anime from an external genre database, provides live anime/TV-series search, shows title details in a modal, and supports native browser playback when a record contains an episode `videoUrl`.

There is no client-side router, authentication, account store, server-side rendering, or frontend DOM test runner. Navigation and search are state-driven within one page.

## Run and verify

Use a Node version supported by Vite 8; this checkout was verified with Node 26.

```powershell
npm ci
Copy-Item .env.example .env   # optional; edit the URL for your environment
npm run dev                   # Vite development server
npm test                     # offline Node tests for services and mapping
npm run build                # production files in dist/
npm run preview              # serve the production build locally
```

### Environment

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://103.235.105.231:8001` | Origin of the external genre database, without a trailing `/api`. |

Vite embeds `VITE_*` values in public browser JavaScript; never put secrets in them. An HTTPS frontend cannot call an HTTP API from secure browsers because of mixed-content blocking. The database must also allow the frontend origin through CORS. Restart Vite after changing `.env`.

## Request and rendering flow

1. `src/main.jsx` installs `AbortSignal.any`/`AbortSignal.timeout` fallbacks and mounts `App` inside React Strict Mode.
2. `App.jsx` requests `GET {VITE_API_BASE_URL}/api/genres`. The effect aborts obsolete requests during cleanup, which also prevents Strict Mode's first development request from updating state.
3. `buildGenreRows` processes genres in the priority order defined in `src/catalogConfig.js`: Action, Drama, Adventure, Comedy, Romance, Fantasy, Slice of Life, Mystery.
4. A row is shown only when it contains 30 unique anime after higher-priority rows have claimed their IDs. IDs are normalized to strings, so numeric `1` and string `"1"` are duplicates. Incomplete rows do not reserve their IDs.
5. The home view renders a static hero carousel and the completed genre rows. Loading rows are derived directly from configuration rather than duplicated in component state.
6. Selecting a card normalizes `description` to `synopsis` and genre arrays to display text, then opens `MovieModal`.
7. A non-empty search query replaces the home view with search results. Live requests begin at two characters after a 450 ms debounce and have an eight-second timeout. Anime and TV-series searches run independently.

The current app does **not** call the FastAPI port-`8002` service. That service is for synchronization and proxy administration; see [backend.md](backend.md).

## External HTTP APIs used by browser code

| API | Operation | Used for |
| --- | --- | --- |
| Database | `GET /api/genres` | Initial home catalog; expected response is an array of genres. |
| Database | `GET /api/genres/{genre_name}` | Available helper; returns `null` on 404. Not used by the current home flow. |
| AniList | `POST https://graphql.anilist.co` | Anime search, with `SEARCH_MATCH`, `isAdult: false`, and 24 results. |
| TVmaze | `GET https://api.tvmaze.com/search/shows?q=...` | Non-animation TV-series search, up to 24 title matches. |
| Apple iTunes | `GET https://itunes.apple.com/search` | `searchMovies` helper only; movie results are not currently rendered. |

A failed AniList search falls back to matching titles/synonyms in the already loaded, deduplicated home catalog. TVmaze has no local fallback. Individual source failures do not reject the other source.

## Source map

| File | Responsibility |
| --- | --- |
| `src/App.jsx` | Own catalog, loading/error, query, and selected-title state. |
| `src/catalogConfig.js` | Shared genre order, row size, and skeleton count. |
| `src/featuredShows.js` | Static hero content with bundled image imports. |
| `src/components/dbApiService.js` | Database requests, response checks, and pure row construction. |
| `src/components/anilistService.js` | Browser AniList GraphQL query and category helper. |
| `src/components/animeMapper.js` | Pure AniList-to-card mapping; no scraper dependency. |
| `src/components/mediaSearchService.js` | TVmaze and currently unused iTunes adapters. |
| `src/components/AnimeSearchResults.jsx` | Debounced multi-catalog search and fallback/status rendering. |
| `src/components/CategorizedAnimeSection.jsx` | Home rows, skeletons, empty and error states. |
| `src/components/MovieRow.jsx` | Horizontal rows, scroll buttons, resize/scroll awareness. |
| `src/components/MovieCard.jsx` | Card/search variants and local like/list button state. |
| `src/components/MovieModal.jsx` | Native dialog, seasons/episodes, external source links, player launch. |
| `src/components/VideoPlayer.jsx` | Native HTML5 video controls, captions, fullscreen, keyboard shortcuts. |
| `src/components/Hero*` and `CarouselControls.jsx` | Static auto-advancing hero; pauses on hover/touch. |
| `src/components/Navbar.jsx` | Search input and visual navigation state. |
| `src/components/Footer.jsx` | Static footer. |
| `src/components/animeDataService.js` | Legacy eager stream-enrichment workflow; not used by active pages. |
| `src/streambert-browser-adapter.js` | Empty browser stub plus lazy Node loading for the experimental scraper. |
| `src/streambert-anime-test.cjs` | Standalone third-party scraping/local-player experiment, not production UI. |

`animeData.js` and `netflixData.js` are static/demo datasets not imported by the active app. `ContentSection.jsx` is a generic reusable section but is not part of the current home tree.

## Catalog data contract

A genre is expected to look like `{ id, name, animes: [...] }`. Anime mapping and components recognize these fields:

- Identity/title: `id`, `malId`, `title`, `synonyms`.
- Text: `description` or `synopsis`, `genres`, `tags`, `cast`.
- Images: `poster`, `thumbnail`, `backdrop`, `coverImage`, `bannerImage`.
- Metadata: `matchPercentage`, `ageRating`, `seasons`, `year`, `rating`, `duration`, `status`, `season`, `seasonYear`, `popularity`, `nextAiringEpisode`, `isAdult`.
- Playback/search: `episodes`, `streamUrl`, `mediaType`, `sourceUrl`, `sourceLabel`, optional `demoVideo`.

The backend's `seasons` value is an episode-count label such as `12 Episodes`, not a season count. Descriptions and third-party summary HTML are displayed as text, not injected as HTML.

## Playback behavior and limits

An episode needs `videoUrl`; optional fields include `thumbnail`, `subtitles`, `description`, and `duration`. Subtitle tracks use `{ src, language, label, default }`. `demoVideo` on a movie is an explicit fallback used only by the static demo dataset. Current database records generally have empty episodes and no playable source.

The player supports browser-compatible progressive media and WebVTT captions. Despite the presence of `hls.js` in dependencies for the experiment, the active `VideoPlayer` does not implement HLS, DRM, quality selection, or authorized stream delivery. Likes/list selections are transient React state and are not persisted. Navbar TV Shows/Movies/My List buttons change visual selection but do not filter content; hero Play/More Info and placeholder footer links are not complete workflows.

## Styling and deployment

Component JSX imports its colocated CSS. Category hover/stacking rules are in `CategorizedAnimeSection.css`; no runtime style injection is used. Images are imported so Vite fingerprints them correctly. `vite.config.js` defines the `@` alias for `src`, polling for development, and Node built-ins/Electron as build externals for the optional code.

The GitHub workflow deploys only this frontend to an SSH host and runs `npm ci && npm run build`. Configure `VITE_API_BASE_URL` in the build environment and serve `dist/` with an SPA-capable static host. Backend startup is not part of that workflow.

`npm audit` currently reports high-severity advisories in Electron 28 and its `extract-zip` dependency. Electron is used only by the optional scraper, not by browser production code. The available fix is a major Electron upgrade and needs separate compatibility testing.

## Troubleshooting

- **Empty home with an error:** check database availability, browser network response, CORS, and mixed-content policy.
- **Rows missing:** this is expected when fewer than 30 unused anime remain for that genre; earlier genres have priority.
- **Search unavailable:** inspect AniList/TVmaze status and browser CORS/network errors. One-character input intentionally shows local guidance only.
- **Images work in dev but not production:** use imported assets, not literal `src/assets/...` URLs.
- **No Play button action:** catalog entries need episodes with valid `videoUrl` values; `streamUrl` alone is not consumed by `MovieModal`.

