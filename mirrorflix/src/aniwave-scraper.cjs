const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const dns = require("node:dns").promises;
const net = require("node:net");
const path = require("node:path");

const BASE_URL = "https://aniwaves.tv";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

class AniwaveError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "AniwaveError";
    this.status = status;
  }
}

function decodeEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"', "#39": "'" };
  return String(value || "").replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|quot);?/gi, (entity, key) => {
    if (key[0] !== "#") return named[key.toLowerCase()] || entity;
    const hex = key[1].toLowerCase() === "x";
    const code = Number.parseInt(key.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : entity;
  });
}

function getAttr(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag).match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function normalizeAnimeId(value) {
  const animeId = String(value || "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(animeId)) {
    throw new AniwaveError("animeId must be a full Aniwave slug ending in its numeric ID.", 400);
  }
  return animeId;
}

function normalizeEpisode(value) {
  const episode = String(value ?? "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(episode) || !Number.isFinite(Number(episode)) || Number(episode) <= 0) {
    throw new AniwaveError("episode must be a positive episode number.", 400);
  }
  return String(Number(episode));
}

function normalizeMode(value) {
  const mode = String(value || "sub").toLowerCase();
  if (!["sub", "dub"].includes(mode)) {
    throw new AniwaveError("mode must be sub or dub.", 400);
  }
  return mode;
}

function parseWatchPage(html) {
  const tag = String(html).match(/<div\b[^>]*>/gi)?.find((item) => getAttr(item, "id") === "watch-main");
  const animeId = tag && getAttr(tag, "data-id");
  if (!animeId || !/^\d+$/.test(animeId)) {
    throw new AniwaveError("Aniwave did not expose a valid anime ID on this watch page.", 502);
  }
  return { animeId };
}

function parseSearchResults(html) {
  const results = [];
  for (const match of String(html).matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)) {
    const item = match[0];
    const tag = item.match(/^<a\b[^>]*>/i)?.[0] || "";
    if (!/\bitem\b/i.test(getAttr(tag, "class") || "")) continue;
    const href = getAttr(tag, "href");
    const id = href?.match(/\/watch\/([^/?#]+)/)?.[1];
    if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*-\d+$/.test(id)) continue;
    const nameTag = [...item.matchAll(/<div\b[^>]*>/gi)]
      .map((name) => name[0])
      .find((name) => /\bname\b/i.test(getAttr(name, "class") || ""));
    const title = nameTag
      ? decodeEntities(item.slice(item.indexOf(nameTag) + nameTag.length).replace(/<[^>]*>[\s\S]*/, "").trim())
      : "";
    if (!title) continue;
    results.push({ id, title, jname: getAttr(nameTag, "data-jp") || title });
  }
  return results;
}

function parseEpisodeList(html) {
  const episodes = [];
  const seen = new Set();
  for (const match of String(html).matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const number = getAttr(tag, "data-num");
    const ids = getAttr(tag, "data-ids");
    if (!number || !ids || getAttr(tag, "enabled") === "0") continue;
    try {
      const normalized = normalizeEpisode(number);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      episodes.push({
        epId: normalized,
        number: normalized,
        sub: getAttr(tag, "data-sub") === "1",
        dub: getAttr(tag, "data-dub") === "1",
      });
    } catch {
      // Ignore non-numeric special entries that cannot be requested by number.
    }
  }
  return episodes;
}

function parseEpisode(html, wantedEpisode) {
  for (const match of String(html).matchAll(/<a\b[^>]*>/gi)) {
    const tag = match[0];
    const number = getAttr(tag, "data-num");
    if (!number) continue;
    let normalized;
    try {
      normalized = normalizeEpisode(number);
    } catch {
      continue;
    }
    if (normalized !== wantedEpisode) continue;
    const ids = getAttr(tag, "data-ids");
    if (!ids) throw new AniwaveError(`Episode ${wantedEpisode} has no server identifiers.`, 502);
    return {
      ids,
      number: wantedEpisode,
      enabled: getAttr(tag, "enabled") !== "0",
      sub: getAttr(tag, "data-sub") === "1",
      dub: getAttr(tag, "data-dub") === "1",
    };
  }
  return null;
}

function parseServers(html) {
  const text = String(html);
  const types = [...text.matchAll(/<div\b[^>]*>/gi)]
    .filter((match) => getAttr(match[0], "data-type"))
    .filter((match) => /\btype\b/i.test(getAttr(match[0], "class") || ""));
  const servers = [];

  types.forEach((typeMatch, index) => {
    const start = typeMatch.index;
    const end = types[index + 1]?.index ?? text.length;
    const section = text.slice(start, end);
    const type = getAttr(typeMatch[0], "data-type").toLowerCase();
    for (const item of section.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)) {
      const tag = item[0].match(/^<li\b[^>]*>/i)?.[0] || "";
      const linkId = getAttr(tag, "data-link-id");
      if (!linkId) continue;
      servers.push({
        id: getAttr(tag, "data-sv-id"),
        linkId,
        name: decodeEntities(item[0].replace(/<[^>]*>/g, "").trim()) || "Unknown",
        type,
      });
    }
  });
  return servers;
}

function selectServers(servers, mode) {
  const types = mode === "sub" ? ["ssub", "sub"] : ["dub"];
  return types.flatMap((type) => servers.filter((server) => server.type === type));
}

function parseApiPayload(body, label) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new AniwaveError(`${label} returned invalid JSON.`, 502);
  }
  if (!payload || typeof payload !== "object") {
    throw new AniwaveError(`${label} returned an invalid response.`, 502);
  }
  if (payload.ok === false || (payload.status !== undefined && Number(payload.status) !== 200)) {
    const status = Number(payload.status);
    throw new AniwaveError(payload.message || `${label} reported an error.`, status >= 400 && status < 500 ? status : 502);
  }
  return Object.hasOwn(payload, "result") ? payload.result : payload;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc")
      || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized);
  }
  return true;
}

async function assertPublicUrl(value) {
  let url;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new AniwaveError("Invalid URL.", 400);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new AniwaveError("Only unauthenticated HTTP(S) URLs are allowed.", 400);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new AniwaveError("Private network URLs are not allowed.", 400);
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new AniwaveError("Private network URLs are not allowed.", 400);
    return url;
  }
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new AniwaveError("Private network URLs are not allowed.", 400);
  }
  return url;
}

function loadTlsOptions(env = process.env, readFile = fs.readFileSync) {
  const certPath = env.ANIWAVE_TLS_CERT_PATH?.trim();
  const keyPath = env.ANIWAVE_TLS_KEY_PATH?.trim();
  if (!certPath && !keyPath) return {};
  if (!certPath || !keyPath) {
    throw new AniwaveError("Both ANIWAVE_TLS_CERT_PATH and ANIWAVE_TLS_KEY_PATH are required.", 500);
  }
  try {
    return {
      cert: readFile(path.resolve(certPath)),
      key: readFile(path.resolve(keyPath)),
      ...(env.ANIWAVE_TLS_CA_PATH?.trim()
        ? { ca: readFile(path.resolve(env.ANIWAVE_TLS_CA_PATH.trim())) }
        : {}),
      ...(env.ANIWAVE_TLS_KEY_PASSWORD ? { passphrase: env.ANIWAVE_TLS_KEY_PASSWORD } : {}),
    };
  } catch (error) {
    throw new AniwaveError(`Unable to load the Aniwave TLS credentials: ${error.message}`, 500);
  }
}

function createRequest({
  baseUrl = BASE_URL,
  env = process.env,
  maxBytes = DEFAULT_MAX_BYTES,
  readFile = fs.readFileSync,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 8, family: 4 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8, family: 4 });
  const certificateHost = new URL(baseUrl).hostname;
  let certificateAgent;

  async function request(urlValue, { headers = {}, redirects = 0 } = {}) {
    const url = await assertPublicUrl(urlValue);
    const isHttps = url.protocol === "https:";
    if (isHttps && url.hostname === certificateHost && !certificateAgent
      && (env.ANIWAVE_TLS_CERT_PATH || env.ANIWAVE_TLS_KEY_PATH)) {
      certificateAgent = new https.Agent({ keepAlive: true, maxSockets: 8, ...loadTlsOptions(env, readFile) });
    }
    const agent = isHttps && url.hostname === certificateHost && certificateAgent
      ? certificateAgent
      : isHttps ? httpsAgent : httpAgent;
    const transport = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = transport.request({
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent,
        headers: {
          Accept: "*/*",
          "Accept-Encoding": "identity",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": USER_AGENT,
          ...headers,
        },
      }, (res) => {
        const status = res.statusCode || 502;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects >= 5) {
            reject(new AniwaveError("Too many upstream redirects.", 502));
            return;
          }
          const target = new URL(res.headers.location, url);
          request(target, { headers, redirects: redirects + 1 }).then(resolve, reject);
          return;
        }
        const declaredLength = Number(res.headers["content-length"] || 0);
        if (declaredLength > maxBytes) {
          res.resume();
          req.destroy();
          reject(new AniwaveError("Upstream response exceeded the size limit.", 502));
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new AniwaveError("Upstream response exceeded the size limit.", 502));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({
          status,
          body: Buffer.concat(chunks).toString("utf8"),
          headers: res.headers,
          url: url.href,
        }));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.setTimeout(timeoutMs, () => req.destroy(new AniwaveError("Upstream request timed out.", 504)));
      req.end();
    });
  }

  return request;
}

function sourceCandidates(value, depth = 0) {
  if (depth > 6 || value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap((item) => sourceCandidates(item, depth + 1));
  if (typeof value !== "object") return [];
  const direct = [value.file, value.src, value.url, value.source]
    .filter((item) => typeof item === "string");
  const nested = Object.entries(value)
    .filter(([key]) => !["file", "src", "url", "source", "tracks", "subtitles"].includes(key))
    .flatMap(([, item]) => sourceCandidates(item, depth + 1));
  return [...direct, ...nested];
}

function collectTracks(payload) {
  if (!payload || typeof payload !== "object") return [];
  return [payload.tracks, payload.subtitles]
    .filter(Array.isArray)
    .flat();
}

function isMediaUrl(value) {
  return /\.(?:m3u8|mp4)(?:[?&#]|$)/i.test(String(value));
}

function languageCode(track) {
  const value = String(track.language || track.lang || track.srclang || track.label || "und").trim();
  const normalized = value.toLowerCase().replace(/_/g, "-");
  const aliases = { eng: "en", english: "en", spa: "es", spanish: "es", por: "pt", portuguese: "pt", jpn: "ja", japanese: "ja" };
  return aliases[normalized] || normalized || "und";
}

function createAniwaveScraper({
  baseUrl = BASE_URL,
  requestImpl,
  validateUrlImpl = assertPublicUrl,
} = {}) {
  const root = new URL(baseUrl);
  const request = requestImpl || createRequest({ baseUrl: root.origin });

  async function fetchResponse(url, { accept = "*/*", referer = root.origin + "/", ajax = false, label = "Aniwave" } = {}) {
    let response;
    try {
      response = await request(url, {
        headers: {
          Accept: accept,
          Referer: referer,
          ...(ajax ? { "X-Requested-With": "XMLHttpRequest" } : {}),
        },
      });
    } catch (error) {
      if (error instanceof AniwaveError) throw error;
      throw new AniwaveError(`${label} request failed: ${error.message}`, 502);
    }
    if (/<title>\s*(?:Just a moment|Attention Required)/i.test(response.body) || /cf-chl-widget/i.test(response.body)) {
      throw new AniwaveError(`${label} returned an anti-bot challenge; no challenge bypass was attempted.`, 503);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new AniwaveError(`${label} returned HTTP ${response.status}.`, response.status === 404 ? 404 : 502);
    }
    return response;
  }

  async function fetchJson(url, options) {
    const response = await fetchResponse(url, { ...options, accept: "application/json" });
    return parseApiPayload(response.body, options?.label || "Aniwave");
  }

  async function normalizeUrl(value, base) {
    let url;
    try {
      url = new URL(value, base);
    } catch {
      throw new AniwaveError("The source response contained an invalid media URL.", 502);
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new AniwaveError("The source response contained an unsafe media URL.", 502);
    }
    await validateUrlImpl(url);
    return url.href;
  }

  async function mediaFromPayload(payload, { base, referer, extraTracks = [] }) {
    if (!payload || typeof payload !== "object") return null;
    const candidates = sourceCandidates(payload.sources);
    if (!candidates.length && isMediaUrl(payload.url)) candidates.push(payload.url);
    if (!candidates.length) return null;
    const selected = candidates.find((value) => /\.m3u8(?:[?&#]|$)/i.test(value))
      || candidates.find((value) => /\.mp4(?:[?&#]|$)/i.test(value))
      || candidates[0];
    const videoUrl = await normalizeUrl(selected, base);
    const tracks = [...extraTracks, ...collectTracks(payload)];
    const subtitles = [];

    for (const track of tracks) {
      if (!track || typeof track !== "object") continue;
      const kind = String(track.kind || "subtitles").toLowerCase();
      if (!["captions", "subtitles"].includes(kind)) continue;
      const source = track.file || track.src || track.url;
      if (typeof source !== "string" || !source.trim()) continue;
      try {
        subtitles.push({
          url: await normalizeUrl(source, base),
          language: languageCode(track),
          label: String(track.label || track.name || track.language || "Subtitles"),
          default: track.default === true || String(track.default).toLowerCase() === "true",
        });
      } catch {
        // A broken optional subtitle must not discard an otherwise playable video.
      }
    }

    const uniqueSubtitles = subtitles.filter((track, index) =>
      subtitles.findIndex((candidate) => candidate.url === track.url && candidate.language === track.language) === index);
    if (uniqueSubtitles.length && !uniqueSubtitles.some((track) => track.default)) {
      const preferred = uniqueSubtitles.find((track) => track.language.split("-")[0] === "en") || uniqueSubtitles[0];
      preferred.default = true;
    }
    return {
      video: {
        url: videoUrl,
        type: /\.m3u8(?:[?&#]|$)/i.test(videoUrl) ? "hls" : "mp4",
        referer,
      },
      subtitles: uniqueSubtitles,
    };
  }

  async function resolveServer(server, watchUrl) {
    const sourceUrl = new URL("/ajax/sources", root);
    sourceUrl.searchParams.set("id", server.linkId);
    sourceUrl.searchParams.set("asi", "0");
    sourceUrl.searchParams.set("autoPlay", "0");
    const sourcePayload = await fetchJson(sourceUrl, {
      ajax: true,
      referer: watchUrl,
      label: `${server.name} source`,
    });
    if (!sourcePayload || typeof sourcePayload !== "object") {
      throw new AniwaveError(`${server.name} returned no source configuration.`, 502);
    }

    const direct = await mediaFromPayload(sourcePayload, { base: watchUrl, referer: watchUrl });
    if (direct) return direct;
    if (!sourcePayload.url) throw new AniwaveError(`${server.name} returned no embed URL.`, 502);
    const embedUrl = await normalizeUrl(sourcePayload.url, watchUrl);
    const embedResponse = await fetchResponse(embedUrl, {
      accept: "text/html",
      referer: watchUrl,
      label: `${server.name} embed`,
    });
    const screen = [...embedResponse.body.matchAll(/<div\b[^>]*>/gi)]
      .map((match) => match[0])
      .find((tag) => getAttr(tag, "id") === "screen");
    const sourceId = screen && getAttr(screen, "data-id");
    if (!sourceId) throw new AniwaveError(`${server.name} embed did not expose a source ID.`, 502);

    const playerUrl = new URL(`getSources?id=${encodeURIComponent(sourceId)}`, embedUrl);
    const playerPayload = await fetchJson(playerUrl, {
      referer: embedUrl,
      label: `${server.name} player`,
    });
    const media = await mediaFromPayload(playerPayload, {
      base: embedUrl,
      referer: embedUrl,
      extraTracks: collectTracks(sourcePayload),
    });
    if (!media) throw new AniwaveError(`${server.name} player returned no playable video.`, 502);
    return media;
  }

  async function aniwaveSearch(query) {
    const keyword = String(query || "").trim();
    if (!keyword) throw new AniwaveError("A search title is required.", 400);
    const searchUrl = new URL("/ajax/anime/search", root);
    searchUrl.searchParams.set("keyword", keyword);
    const result = await fetchJson(searchUrl, {
      ajax: true,
      referer: root.origin + "/",
      label: "Aniwave search",
    });
    return parseSearchResults(typeof result === "string" ? result : result?.html || "");
  }

  async function fetchEpisodeContext(animeId) {
    const watchUrl = new URL(`/watch/${animeId}`, root).href;
    const watchResponse = await fetchResponse(watchUrl, {
      accept: "text/html",
      label: "Aniwave watch page",
    });
    const watch = parseWatchPage(watchResponse.body);
    const episodeUrl = new URL(`/ajax/episode/list/${watch.animeId}`, root);
    episodeUrl.searchParams.set("style", "list");
    const episodeHtml = await fetchJson(episodeUrl, {
      ajax: true,
      referer: watchUrl,
      label: "Aniwave episode list",
    });
    return { episodeHtml, watchUrl };
  }

  async function aniwaveEpisodes(animeIdValue) {
    const animeId = normalizeAnimeId(animeIdValue);
    const { episodeHtml } = await fetchEpisodeContext(animeId);
    return parseEpisodeList(episodeHtml);
  }

  async function scrapeAniwaveEpisode(animeIdValue, episodeValue, { mode: modeValue = "sub" } = {}) {
    const animeId = normalizeAnimeId(animeIdValue);
    const episode = normalizeEpisode(episodeValue);
    const mode = normalizeMode(modeValue);
    const { episodeHtml, watchUrl } = await fetchEpisodeContext(animeId);
    const selectedEpisode = parseEpisode(episodeHtml, episode);
    if (!selectedEpisode) throw new AniwaveError(`Episode ${episode} was not found for ${animeId}.`, 404);
    if (!selectedEpisode.enabled) throw new AniwaveError(`Episode ${episode} is not enabled yet.`, 404);
    if (!selectedEpisode[mode]) throw new AniwaveError(`Episode ${episode} has no ${mode} version.`, 404);

    const [serverId, ...extraParams] = selectedEpisode.ids.split("&");
    if (!/^\d+$/.test(serverId)) throw new AniwaveError("The episode returned invalid server identifiers.", 502);
    const serverUrl = new URL("/ajax/server/list", root);
    serverUrl.searchParams.set("servers", serverId);
    for (const parameter of extraParams) {
      const separator = parameter.indexOf("=");
      if (separator <= 0) throw new AniwaveError("The episode returned invalid server parameters.", 502);
      serverUrl.searchParams.set(parameter.slice(0, separator), parameter.slice(separator + 1));
    }
    const serverHtml = await fetchJson(serverUrl, {
      ajax: true,
      referer: watchUrl,
      label: "Aniwave server list",
    });
    const candidates = selectServers(parseServers(serverHtml), mode);
    if (!candidates.length) throw new AniwaveError(`No ${mode} servers are available for episode ${episode}.`, 404);

    let lastError;
    for (const server of candidates) {
      try {
        const media = await resolveServer(server, watchUrl);
        return {
          animeId,
          episode,
          mode,
          server: { id: server.id, name: server.name, type: server.type },
          ...media,
        };
      } catch (error) {
        lastError = error;
      }
    }
    throw new AniwaveError(`No playable ${mode} source was found for episode ${episode}. Last server error: ${lastError?.message || "unknown error"}`, 502);
  }

  return { aniwaveEpisodes, aniwaveSearch, scrapeAniwaveEpisode };
}

const defaultScraper = createAniwaveScraper();
const { aniwaveEpisodes, aniwaveSearch, scrapeAniwaveEpisode } = defaultScraper;

function parseCliArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const positional = [];
  let mode = "sub";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--mode") {
      mode = argv[++index];
    } else if (argument.startsWith("--mode=")) {
      mode = argument.slice("--mode=".length);
    } else if (argument.startsWith("-")) {
      throw new AniwaveError(`Unknown option: ${argument}`, 400);
    } else {
      positional.push(argument);
    }
  }
  if (positional.length !== 2) {
    throw new AniwaveError("Usage: node src/aniwave-scraper.cjs <anime-slug> <episode> [--mode sub|dub]", 400);
  }
  return { animeId: positional[0], episode: positional[1], mode };
}

async function runCli(argv = process.argv.slice(2)) {
  const input = parseCliArguments(argv);
  if (input.help) {
    console.log("Usage: node src/aniwave-scraper.cjs <anime-slug> <episode> [--mode sub|dub]");
    return;
  }
  try {
    process.loadEnvFile?.(path.resolve(__dirname, "..", ".env"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const result = await scrapeAniwaveEpisode(input.animeId, input.episode, { mode: input.mode });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  runCli().catch((error) => {
    console.error(`Aniwave scraper: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  AniwaveError,
  aniwaveEpisodes,
  aniwaveSearch,
  assertPublicUrl,
  createAniwaveScraper,
  createRequest,
  loadTlsOptions,
  parseApiPayload,
  parseCliArguments,
  parseEpisode,
  parseEpisodeList,
  parseSearchResults,
  parseServers,
  parseWatchPage,
  runCli,
  scrapeAniwaveEpisode,
  selectServers,
};
