const TMDB_ROOT = "https://api.themoviedb.org/3";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function scoreResult(result, title, year) {
  const names = [result.name, result.original_name, result.title, result.original_title]
    .map(normalize)
    .filter(Boolean);
  const wanted = normalize(title);
  const resultYear = String(result.first_air_date || result.release_date || "").slice(0, 4);
  let score = names.includes(wanted) ? 100 : 0;
  if (year && resultYear === String(year)) score += 30;
  if (year && resultYear && resultYear !== String(year)) score -= 20;
  return score + Math.min(Number(result.popularity) || 0, 100) / 1000;
}

function createTitleMetadata({
  apiKey = process.env.TMDB_KEY,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const cache = new Map();

  async function request(path, params = {}) {
    if (!apiKey) {
      const error = new Error("TMDB metadata is not configured on the server.");
      error.status = 503;
      throw error;
    }
    const url = new URL(`${TMDB_ROOT}${path}`);
    url.searchParams.set("api_key", apiKey);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000),
      });
    } catch (error) {
      const metadataError = new Error(
        "TMDB metadata service is unreachable. Check outbound HTTPS access and try again.",
      );
      metadataError.status = 503;
      metadataError.cause = error;
      throw metadataError;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(`TMDB request failed with HTTP ${response.status}.`);
      error.status = 502;
      throw error;
    }
    return payload;
  }

  async function resolveKinopoisk(imdbId) {
    if (!imdbId) return null;
    const query = `SELECT ?kinopoisk WHERE { ?item wdt:P345 "${imdbId}"; wdt:P2603 ?kinopoisk. } LIMIT 1`;
    const url = new URL("https://query.wikidata.org/sparql");
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");
    const response = await fetchImpl(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": "MirrorFlix/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload.results?.bindings?.[0]?.kinopoisk?.value || null;
  }

  async function resolve({ title, year, mediaType = "anime", anilistId }) {
    const kind = mediaType === "movie" ? "movie" : "tv";
    const cacheKey = [kind, normalize(title), year || "", anilistId || ""].join(":");
    const cached = cache.get(cacheKey);
    if (cached && now() - cached.createdAt < CACHE_TTL_MS) return cached.value;

    const search = await request(kind === "movie" ? "/search/movie" : "/search/tv", {
      query: title,
      include_adult: "false",
      ...(kind === "movie" ? { year } : { first_air_date_year: year }),
    });
    const results = Array.isArray(search.results) ? search.results : [];
    if (!results.length) {
      const error = new Error(`No TMDB match found for ${title}.`);
      error.status = 404;
      throw error;
    }

    const selected = results
      .map((result, index) => ({ result, index, score: scoreResult(result, title, year) }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0].result;
    const external = await request(`/${kind}/${selected.id}/external_ids`);
    const imdbId = external.imdb_id || null;
    let kinopoiskId = null;
    if (kind === "movie" && imdbId) {
      try {
        kinopoiskId = await resolveKinopoisk(imdbId);
      } catch {
        // KinoHub is optional; TMDB and IMDb sources remain available.
      }
    }

    const value = {
      tmdbId: selected.id,
      imdbId,
      kinopoiskId,
      anilistId: anilistId || null,
      mediaType: kind,
      title: selected.name || selected.title,
      year: String(selected.first_air_date || selected.release_date || "").slice(0, 4) || null,
    };
    cache.set(cacheKey, { createdAt: now(), value });
    return value;
  }

  return { resolve };
}

module.exports = { createTitleMetadata, scoreResult };
