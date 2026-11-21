const http = require("node:http");
const path = require("node:path");

try {
  process.loadEnvFile?.(path.resolve(__dirname, "..", ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const scraper = require("../src/streambert-anime-test.cjs");
const aniwave = require("../src/aniwave-scraper.cjs");
const { createTitleMetadata } = require("./titleMetadata.cjs");

const {
  extractSeason,
  normalizeTitle,
  resolveShowEpisodes,
  selectShow,
  stripSeason,
} = require("./showResolver.cjs");

const API_PREFIX = "/api/streambert";
const DEFAULT_PORT = 3001;

function sendJson(res, status, payload) {
  if (res.headersSent) return;
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(body);
}

function getRequiredParam(url, name) {
  const value = url.searchParams.get(name)?.trim();
  if (!value) {
    const error = new Error(`Missing required query parameter: ${name}`);
    error.status = 400;
    throw error;
  }
  return value;
}

function createStreambertServer(
  scraperClient = scraper,
  titleMetadata = createTitleMetadata(),
  aniwaveClient = aniwave,
) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");

    try {
      if (req.method !== "GET" || !url.pathname.startsWith(`${API_PREFIX}/`)) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      if (url.pathname === `${API_PREFIX}/health`) {
        sendJson(res, 200, { status: "ok" });
        return;
      }

      if (url.pathname === `${API_PREFIX}/proxy`) {
        await scraperClient.handlePlaybackProxy(req, res, url);
        return;
      }

      if (url.pathname === `${API_PREFIX}/title-ids`) {
        const title = getRequiredParam(url, "title");
        const mediaType = url.searchParams.get("mediaType") || "anime";
        if (!["anime", "series", "movie"].includes(mediaType)) {
          sendJson(res, 400, { error: "mediaType must be anime, series, or movie." });
          return;
        }
        const ids = await titleMetadata.resolve({
          title,
          mediaType,
          year: url.searchParams.get("year") || undefined,
          anilistId: url.searchParams.get("anilistId") || undefined,
        });
        sendJson(res, 200, ids);
        return;
      }

      if (url.pathname === `${API_PREFIX}/search`) {
        const query = getRequiredParam(url, "query");
        const results = await scraperClient.hianimeSearch(query);
        sendJson(res, 200, results);
        return;
      }

      if (url.pathname === `${API_PREFIX}/episodes`) {
        const showId = url.searchParams.get("showId");
        if (showId) {
          const episodes = await scraperClient.hianimeEpisodes(showId);
          sendJson(res, 200, episodes);
          return;
        }

        const title = getRequiredParam(url, "title");
        const alternativeTitles = url.searchParams.getAll("alternativeTitles");
        const expectedEpisodes = Number(url.searchParams.get("expectedEpisodes")) || null;
        let results = await scraperClient.hianimeSearch(title);

        if (extractSeason(title)) {
          const baseTitle = stripSeason(title);
          if (baseTitle && baseTitle !== normalizeTitle(title)) {
            try {
              results = [...results, ...await scraperClient.hianimeSearch(baseTitle)];
            } catch {
              // The original search results can still provide a usable fallback.
            }
          }
        }

        if (!results.length) {
          sendJson(res, 404, { error: `No HiAnime results found for ${title}.` });
          return;
        }

        const { show, episodes } = await resolveShowEpisodes(results, {
          title,
          alternativeTitles,
          expectedEpisodes,
        }, scraperClient.hianimeEpisodes);
        episodes.sort((left, right) =>
          Number(left.number) - Number(right.number)
          || left.number.localeCompare(right.number, undefined, { numeric: true })
        );
        sendJson(res, 200, {
          show,
          episodes: episodes.map((episode) => ({
            id: episode.epId,
            number: episode.number,
            title: `Episode ${episode.number}`,
          })),
        });
        return;
      }

      if (url.pathname === `${API_PREFIX}/aniwave/stream`) {
        const animeId = getRequiredParam(url, "animeId");
        const episode = getRequiredParam(url, "episode");
        const mode = url.searchParams.get("mode") || "sub";
        if (!["sub", "dub"].includes(mode)) {
          sendJson(res, 400, { error: "mode must be sub or dub." });
          return;
        }
        const source = await aniwaveClient.scrapeAniwaveEpisode(animeId, episode, { mode });
        const session = scraperClient.createPlaybackSession({
          masterUrl: source.video.url,
          referer: source.video.referer,
          subtitles: source.subtitles,
          resolution: "auto",
        });
        sendJson(res, 200, {
          ...session,
          provider: "aniwave",
          animeId: source.animeId,
          episode: source.episode,
          mode: source.mode,
          server: source.server,
        });
        return;
      }

      if (url.pathname === `${API_PREFIX}/stream`) {
        const episodeId = getRequiredParam(url, "episodeId");
        if (!/^\d+$/.test(episodeId)) {
          sendJson(res, 400, { error: "episodeId must be numeric." });
          return;
        }
        const mode = url.searchParams.get("mode") || "sub";
        if (!["sub", "dub"].includes(mode)) {
          sendJson(res, 400, { error: "mode must be sub or dub." });
          return;
        }

        const stream = await scraperClient.hianimeStream(episodeId, mode);
        sendJson(res, 200, scraperClient.createPlaybackSession(stream));
        return;
      }

      sendJson(res, 404, { error: "Not found" });
    } catch (error) {
      console.error(`[streambert] ${req.method} ${url.pathname}: ${error.message}`);
      sendJson(res, error.status || 502, {
        error: error.message || "Streambert request failed.",
      });
    }
  });
}

if (require.main === module) {
  const port = Number(process.env.STREAMBERT_PORT || DEFAULT_PORT);
  const host = process.env.STREAMBERT_HOST || "127.0.0.1";
  const server = createStreambertServer();
  server.listen(port, host, () => {
    console.log(`[streambert] API listening on http://${host}:${port}${API_PREFIX}`);
  });
  server.on("error", (error) => {
    console.error(`[streambert] Server failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { createStreambertServer, normalizeTitle, selectShow };
