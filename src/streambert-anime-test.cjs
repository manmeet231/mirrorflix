/**
 * Streambert Anime Test Script
 * 
 * This script demonstrates the anime scraping and playback functionality
 * from Streambert, specifically for testing with Mob Psycho 100 Episode 1.
 * 
 * Requirements:
 * - Node.js (v18+)
 * - Dependencies: electron (for net.fetch), hls.js
 * - TMDB API key (if using metadata resolution)
 * 
 * Usage:
 * 1. Install dependencies: npm install electron hls.js
 * 2. Run: node src/streambert-anime-test.cjs
 * 
 * The script will:
 * 1. Search for "Mob Psycho 100" on HiAnime
 * 2. Get episode list for the show
 * 3. Resolve stream URL for Episode 1 (sub)
 * 4. Create a local player server
 * 5. Output a watchable URL
 */

let app;
let ipcMain;
let net;
try {
  ({ app, ipcMain, net } = require("electron"));
} catch {
  // Plain Node uses the HTTP fallback below; Electron is optional.
}
const https = require("https");
const http = require("http");
const fs = require("fs");
const dns = require("dns").promises;
const netMod = require("net");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");

// Configuration
const BASE_URL = "https://hianime.at";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const OBFUSCATION_KEY = Buffer.from("otaku-embed-v1", "utf8");
const SERVER_NAME = "ZokoAnime";
const MAX_TEXT_BYTES = 5 * 1024 * 1024;

// Keep-alive pools
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 16 });
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 16 });

// Test configuration - modify these to test different anime/episodes
const TEST_TITLE = "Mob Psycho 100"; // Change this to any anime title
const TEST_EPISODE = 1; // Change this to any episode number
const TEST_MODE = "sub"; // Change to "dub" for dubbed version

// SSRF Guard
function isPrivateIp(ip) {
  if (netMod.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  if (netMod.isIPv6(ip)) {
    const l = ip.toLowerCase();
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return (
      l === "::" ||
      l === "::1" ||
      l.startsWith("fc") ||
      l.startsWith("fd") ||
      /^fe[89ab]/.test(l)
    );
  }
  return true;
}

async function assertPublicUrl(urlStr) {
  let u;
  try {
    u = new URL(urlStr);
  } catch {
    throw new Error("Invalid url");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("Blocked protocol");
  }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (netMod.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("Blocked address");
    return u;
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    throw new Error("Blocked address");
  }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error("Blocked address");
  }
  return u;
}

// HTTP Helper
function nodeGet(urlStr, headers, timeoutMs, hops = 0) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch {
      return reject(new Error("invalid url: " + urlStr));
    }
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: "GET",
        headers: { "Accept-Encoding": "identity", ...headers },
        agent: lib === https ? httpsAgent : httpAgent,
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          hops < 8
        ) {
          res.resume();
          const loc = new URL(res.headers.location, urlStr).href;
          return assertPublicUrl(loc)
            .then(() => resolve(nodeGet(loc, headers, timeoutMs, hops + 1)))
            .catch(reject);
        }
        const chunks = [];
        let size = 0;
        res.on("data", (c) => {
          size += c.length;
          if (size > MAX_TEXT_BYTES) {
            req.destroy(new Error("response too large"));
            return;
          }
          chunks.push(c);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

async function hianimeGet(urlStr, { referer, accept } = {}) {
  await assertPublicUrl(urlStr);
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: accept || "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (referer) headers["Referer"] = referer;

  if (net && typeof net.fetch === "function") {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const init = { headers, redirect: "follow", signal: ctrl.signal };
      if (referer) {
        init.referrer = referer;
        init.referrerPolicy = "unsafe-url";
      }
      const res = await net.fetch(urlStr, init);
      if (res.url && res.url !== urlStr) await assertPublicUrl(res.url);
      const len = parseInt(res.headers.get("content-length") || "0", 10);
      if (len > MAX_TEXT_BYTES) throw new Error("response too large");
      const body = await res.text();
      if (body.length > MAX_TEXT_BYTES) throw new Error("response too large");
      return { status: res.status, body };
    } catch (e) {
      if (e?.name === "AbortError") throw new Error("timeout");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  return nodeGet(urlStr, headers, 12000);
}

async function hianimeCurl(urlStr, opts) {
  const res = await hianimeGet(urlStr, opts);
  if (/<title>\s*Just a moment/i.test(res.body)) {
    throw new Error("Blocked by Cloudflare (HiAnime)");
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Request failed: HTTP ${res.status} from ${urlStr}`);
  }
  return res.body;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getAttr(tagText, name) {
  const m = tagText.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

function unwrapApiHtml(body) {
  let text = body;
  try {
    const json = JSON.parse(body);
    const parts = [];
    const walk = (v) => {
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(json);
    if (parts.length) text = parts.join("\n");
  } catch {
    // not JSON → use the raw text
  }
  return text.replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\/g, "");
}

function deobfuscateBlob(blob) {
  const buf = Buffer.from(blob, "base64");
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = buf[i] ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.length];
  }
  return out.toString("utf8");
}

// Scraping Functions
async function hianimeSearch(query) {
  const q = encodeURIComponent(query).replace(/%20/g, "+");
  const html = await hianimeCurl(`${BASE_URL}/search?keyword=${q}`, {
    accept: "text/html",
  });
  const main = html.split('id="main-sidebar"')[0];
  const results = [];
  const re = /<h3 class="film-name">([\s\S]*?)<\/h3>/g;
  let m;
  while ((m = re.exec(main))) {
    const anchor = m[1].match(/<a\s+([^>]*)>/);
    if (!anchor) continue;
    const href = getAttr(anchor[1], "href");
    const title = getAttr(anchor[1], "title");
    if (!href || !title) continue;
    const id = href.split("?")[0].replace(/\/+$/, "").split("/").pop();
    if (!id) continue;
    const jname = getAttr(anchor[1], "data-jname");
    results.push({
      id,
      title: decodeEntities(title),
      jname: jname ? decodeEntities(jname) : null,
    });
  }
  return results;
}

async function hianimeEpisodes(showId) {
  const numericId = showId.slice(showId.lastIndexOf("-") + 1);
  if (!/^\d+$/.test(numericId)) throw new Error("Invalid show id");
  const body = await hianimeCurl(
    `${BASE_URL}/api/theme/episode/list/${numericId}`,
    { referer: BASE_URL + "/" },
  );
  const html = unwrapApiHtml(body);
  const episodes = [];
  for (const chunk of html.split("ep-item").slice(1)) {
    const number = getAttr(chunk, "data-number");
    const epId = getAttr(chunk, "data-id");
    if (!number || !epId || !/^\d+$/.test(epId)) continue;
    if (!chunk.includes(`/watch/${showId}?ep=`)) continue;
    episodes.push({ epId, number });
  }
  return episodes;
}

async function hianimeStream(epId, mode) {
  const body = await hianimeCurl(
    `${BASE_URL}/api/theme/episode/servers?episodeId=${epId}`,
    { referer: BASE_URL + "/" },
  );
  const html = unwrapApiHtml(body);

  let hash = null;
  for (const chunk of html.split("server-item").slice(1)) {
    if (
      getAttr(chunk, "data-type") === mode &&
      getAttr(chunk, "data-server-name") === SERVER_NAME
    ) {
      hash = getAttr(chunk, "data-hash");
      if (hash) break;
    }
  }
  if (!hash) throw new Error(`No ${SERVER_NAME} server for ${mode}`);

  const embedUrl = Buffer.from(hash, "base64").toString("utf8").trim();
  if (!/^https?:\/\//i.test(embedUrl)) throw new Error("Invalid embed url");

  const referer = embedUrl.replace(/^(https?:\/\/[^/]*).*$/, "$1/");
  const malMatch = embedUrl.match(/\/mal\/(\d+)\//);
  const malId = malMatch ? parseInt(malMatch[1], 10) : null;

  const embedHtml = await hianimeCurl(embedUrl);
  const blobMatch = embedHtml.match(/window\.__P="([^"]*)"/);
  if (!blobMatch) throw new Error("Embed config not found");

  const jsonText = deobfuscateBlob(blobMatch[1]);
  let masterUrl = null;
  let subtitle = null;
  try {
    const cfg = JSON.parse(jsonText);
    const findM3u8 = (v) => {
      if (typeof v === "string") return /\.m3u8/i.test(v) ? v : null;
      if (Array.isArray(v)) {
        for (const x of v) {
          const r = findM3u8(x);
          if (r) return r;
        }
      } else if (v && typeof v === "object") {
        if (typeof v.src === "string" && /\.m3u8/i.test(v.src)) return v.src;
        for (const x of Object.values(v)) {
          const r = findM3u8(x);
          if (r) return r;
        }
      }
      return null;
    };
    masterUrl = findM3u8(cfg);
    const subs = Array.isArray(cfg.subtitles) ? cfg.subtitles : [];
    const def = subs.find((s) => s && s.default) || null;
    subtitle = def?.src || null;
  } catch {
    const m = jsonText.match(/"src":"([^"]*\.m3u8[^"]*)"/);
    masterUrl = m ? m[1] : null;
    const sub = jsonText
      .split(/\},\s*\{/)
      .find((c) => /"default":true/.test(c) && /"src":"/.test(c));
    subtitle = sub ? (sub.match(/"src":"([^"]*)"/) || [])[1] || null : null;
  }
  if (!masterUrl) throw new Error("No m3u8 source in embed config");
  masterUrl = masterUrl.replace(/\\\//g, "/");
  if (subtitle) subtitle = subtitle.replace(/\\\//g, "/");

  return { masterUrl, referer, malId, subtitle, resolution: "auto" };
}

// Local Player Server
let _playerServer = null;
let _serverToken = crypto.randomBytes(24).toString("hex");
let _currentVideoUrl = null;
let _currentVideoReferer = BASE_URL + "/";
let _currentVideoSubtitle = null;
let _currentVideoStartTime = 0;

function proxied(u, token = _serverToken, prefix = "/proxy") {
  return `${prefix}?t=${token}&url=${encodeURIComponent(u)}`;
}

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function jsonForScript(v) {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(new RegExp("[\\u2028\\u2029]", "g"), "");
}

function rewritePlaylist(text, playlistUrl, token = _serverToken, prefix = "/proxy") {
  const abs = (u) => new URL(u, playlistUrl).href;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith("#")) {
        return line.replace(
          /URI="([^"]+)"/g,
          (_, u) => `URI="${proxied(abs(u), token, prefix)}"`,
        );
      }
      return proxied(abs(t), token, prefix);
    })
    .join("\n");
}

function buildPlayerHtml(videoUrl, startTime, subtitleUrl, nonce) {
  const track = subtitleUrl
    ? `<track kind="subtitles" src="${escapeHtmlAttr(proxied(subtitleUrl))}" srclang="en" label="Subtitles" default>`
    : "";
  const start = Number.isFinite(Number(startTime)) ? Number(startTime) : 0;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:contain;display:block}</style>
</head><body>
<video id="v" controls playsinline autoplay>${track}</video>
<script nonce="${nonce}" src="/hls.js?t=${_serverToken}"></script>
<script nonce="${nonce}">
  const video=document.getElementById('v');
  const src=${jsonForScript(proxied(videoUrl))};
  const startTime=${start};
  if(window.Hls&&Hls.isSupported()){
    const hls=new Hls({autoStartLoad:false});
    hls.loadSource(src);hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED,()=>{
      hls.startLevel=hls.levels.length-1;
      hls.startLoad(startTime>0?startTime:-1);
      video.play().catch(()=>{});
    });
  }else if(video.canPlayType('application/vnd.apple.mpegurl')){
    video.src=src;
    if(startTime>0)video.addEventListener('loadedmetadata',()=>{video.currentTime=startTime;},{once:true});
  }
</script>
</body></html>`;
}

async function proxyRequest(target, req, res, hops = 0, session = {}) {
  let targetUrl;
  try {
    targetUrl = await assertPublicUrl(target);
  } catch {
    res.writeHead(403);
    res.end();
    return;
  }
  const lib = targetUrl.protocol === "https:" ? https : http;
  const headers = {
    "User-Agent": USER_AGENT,
    Referer: session.referer || _currentVideoReferer,
    Accept: "*/*",
    "Accept-Encoding": "identity",
  };
  if (req.headers["range"]) headers["Range"] = req.headers["range"];

  const proxyReq = lib.request(
    {
      hostname: targetUrl.hostname,
      port: targetUrl.port || undefined,
      path: targetUrl.pathname + targetUrl.search,
      method: "GET",
      headers,
      agent: lib === https ? httpsAgent : httpAgent,
    },
    (proxyRes) => {
      const status = proxyRes.statusCode || 502;
      if (
        status >= 300 &&
        status < 400 &&
        proxyRes.headers.location &&
        hops < 8
      ) {
        proxyRes.resume();
        proxyRequest(
          new URL(proxyRes.headers.location, target).href,
          req,
          res,
          hops + 1,
          session,
        );
        return;
      }

      const contentType = String(proxyRes.headers["content-type"] || "");
      const isPlaylist =
        /\.m3u8(\?|$)/i.test(targetUrl.pathname + targetUrl.search) ||
        /mpegurl/i.test(contentType);

      if (isPlaylist && status === 200) {
        const chunks = [];
        let size = 0;
        proxyRes.on("data", (c) => {
          size += c.length;
          if (size > MAX_TEXT_BYTES) {
            proxyReq.destroy();
            return;
          }
          chunks.push(c);
        });
        proxyRes.on("end", () => {
          if (size > MAX_TEXT_BYTES) {
            res.writeHead(502);
            res.end();
            return;
          }
          const text = Buffer.concat(chunks).toString("utf8");
          let out = text;
          try {
            if (text.trimStart().startsWith("#EXTM3U")) {
              out = rewritePlaylist(
                text,
                target,
                session.token || _serverToken,
                session.prefix || "/proxy",
              );
            }
          } catch {
            res.writeHead(502);
            res.end();
            return;
          }
          res.writeHead(200, {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          });
          res.end(out);
        });
        proxyRes.on("error", () => {
          if (!res.headersSent) res.writeHead(502);
          res.end();
        });
        return;
      }

      const passHeaders = {};
      for (const h of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "last-modified",
        "etag",
      ]) {
        if (proxyRes.headers[h]) passHeaders[h] = proxyRes.headers[h];
      }
      passHeaders["Cache-Control"] = "no-store";
      passHeaders["X-Content-Type-Options"] = "nosniff";
      res.writeHead(status, passHeaders);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  proxyReq.setTimeout(20000, () => proxyReq.destroy());
  res.on("close", () => proxyReq.destroy());
  proxyReq.end();
}

let _hlsJs = null;
function loadHlsJs() {
  if (_hlsJs) return _hlsJs;
  try {
    _hlsJs = fs.readFileSync(require.resolve("hls.js/dist/hls.min.js"));
  } catch (e) {
    console.warn("hls.js not found in node_modules. Please install it: npm install hls.js");
    throw e;
  }
  return _hlsJs;
}

function getPlayerServer() {
  if (_playerServer) return Promise.resolve(_playerServer);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const port = server.address()?.port;
      if (req.method !== "GET" || req.headers.host !== `127.0.0.1:${port}`) {
        res.writeHead(403);
        res.end();
        return;
      }
      const url = new URL(req.url, "http://127.0.0.1");
      const given = Buffer.from(url.searchParams.get("t") || "");
      const want = Buffer.from(_serverToken);
      if (
        given.length !== want.length ||
        !crypto.timingSafeEqual(given, want)
      ) {
        res.writeHead(403);
        res.end();
        return;
      }

      if (url.pathname === "/player") {
        const nonce = crypto.randomBytes(16).toString("base64");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "Content-Security-Policy":
            `default-src 'none'; script-src 'self' 'nonce-${nonce}'; ` +
            "style-src 'unsafe-inline'; media-src 'self' blob:; " +
            "connect-src 'self'; worker-src blob:; img-src 'self' data:;",
        });
        res.end(
          buildPlayerHtml(
            _currentVideoUrl || "",
            _currentVideoStartTime || 0,
            _currentVideoSubtitle,
            nonce,
          ),
        );
        return;
      }

      if (url.pathname === "/hls.js") {
        let script;
        try {
          script = loadHlsJs();
        } catch (e) {
          console.error("[hianime] hls.js not found:", e.message);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("hls.js missing");
          return;
        }
        res.writeHead(200, {
          "Content-Type": "application/javascript",
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(script);
        return;
      }

      if (url.pathname === "/proxy") {
        const target = url.searchParams.get("url");
        if (!target) {
          res.writeHead(400);
          res.end();
          return;
        }
        proxyRequest(target, req, res);
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(0, "127.0.0.1", () => {
      _playerServer = server;
      resolve(server);
    });
    server.on("error", reject);
  });
}

const PLAYBACK_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_PLAYBACK_SESSIONS = 50;
const _playbackSessions = new Map();

function prunePlaybackSessions() {
  const now = Date.now();
  for (const [token, session] of _playbackSessions) {
    if (now - session.lastUsed > PLAYBACK_SESSION_TTL_MS) {
      _playbackSessions.delete(token);
    }
  }
  while (_playbackSessions.size >= MAX_PLAYBACK_SESSIONS) {
    _playbackSessions.delete(_playbackSessions.keys().next().value);
  }
}

function createPlaybackSession(stream) {
  prunePlaybackSessions();
  const token = crypto.randomBytes(24).toString("hex");
  const prefix = "/api/streambert/proxy";
  _playbackSessions.set(token, {
    referer: stream.referer,
    lastUsed: Date.now(),
  });

  return {
    videoUrl: proxied(stream.masterUrl, token, prefix),
    subtitles: stream.subtitle
      ? [{
          src: proxied(stream.subtitle, token, prefix),
          language: "en",
          label: "English",
          default: true,
        }]
      : [],
    resolution: stream.resolution,
    malId: stream.malId,
  };
}

function handlePlaybackProxy(req, res, url) {
  const token = url.searchParams.get("t") || "";
  const session = _playbackSessions.get(token);
  if (!session || Date.now() - session.lastUsed > PLAYBACK_SESSION_TTL_MS) {
    _playbackSessions.delete(token);
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Playback session expired or is invalid.");
    return;
  }

  const target = url.searchParams.get("url");
  if (!target) {
    res.writeHead(400);
    res.end("Missing proxy target.");
    return;
  }

  session.lastUsed = Date.now();
  return proxyRequest(target, req, res, 0, {
    token,
    prefix: "/api/streambert/proxy",
    referer: session.referer,
  });
}

// Test Function
async function testMobPsycho100() {
  console.log("🔍 Testing Mob Psycho 100 Episode 1...");
  
  try {
    // Step 1: Search for the show
    console.log(`\n🔍 Searching for "${TEST_TITLE}"...`);
    const searchResults = await hianimeSearch(TEST_TITLE);
    if (!searchResults.length) {
      throw new Error(`No results found for "${TEST_TITLE}"`);
    }
    
    console.log(`✅ Found ${searchResults.length} results:`);
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (${result.id})`);
    });
    
    // Use the first result
    const show = searchResults[0];
    console.log(`\n📺 Selected: ${show.title} (${show.id})`);
    
    // Step 2: Get episodes
    console.log("\n📋 Getting episode list...");
    const episodes = await hianimeEpisodes(show.id);
    if (!episodes.length) {
      throw new Error(`No episodes found for ${show.title}`);
    }
    
    console.log(`✅ Found ${episodes.length} episodes:`);
    episodes.slice(0, 10).forEach((ep, index) => {
      console.log(`  ${index + 1}. Episode ${ep.number} (ID: ${ep.epId})`);
    });
    
    // Find the requested episode
    const episode = episodes.find(ep => 
      parseFloat(ep.number) === TEST_EPISODE || ep.number === String(TEST_EPISODE)
    );
    
    if (!episode) {
      throw new Error(`Episode ${TEST_EPISODE} not found`);
    }
    
    console.log(`\n🎬 Selected Episode ${episode.number} (ID: ${episode.epId})`);
    
    // Step 3: Get stream URL
    console.log("\n🌐 Getting stream URL...");
    const stream = await hianimeStream(episode.epId, TEST_MODE);
    
    console.log("✅ Stream resolved:");
    console.log(`  Master URL: ${stream.masterUrl}`);
    console.log(`  Referer: ${stream.referer}`);
    console.log(`  Subtitle: ${stream.subtitle || "None"}`);
    console.log(`  Resolution: ${stream.resolution}`);
    console.log(`  MAL ID: ${stream.malId || "None"}`);
    
    // Step 4: Start player server
    console.log("\n🚀 Starting local player server...");
    const server = await getPlayerServer();
    const port = server.address().port;
    
    // Set current video
    _currentVideoUrl = stream.masterUrl;
    _currentVideoReferer = stream.referer;
    _currentVideoSubtitle = stream.subtitle;
    _currentVideoStartTime = 0;
    
    // Step 5: Generate player URL
    const playerUrl = `http://127.0.0.1:${port}/player?t=${_serverToken}`;
    
    console.log("\n🎉 Ready to watch!");
    console.log(`\n📺 Player URL: ${playerUrl}`);
    console.log(`\n💡 Instructions:`);
    console.log(`  1. Open the above URL in your web browser`);
    console.log(`  2. The video should start automatically`);
    console.log(`  3. Use the video player controls to play/pause/seek`);
    console.log(`  4. Subtitles should be available if present`);
    
    // Keep server running
    console.log("\n⏳ Server running... Press Ctrl+C to exit");
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down server...');
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });
    
    // Open in browser automatically (optional)
    const openBrowser = () => {
      const open = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
      
      console.log(`\n🌐 Opening in browser...`);
      spawn(open, [playerUrl], { 
        detached: true, 
        stdio: 'ignore',
        shell: true // Use shell to handle 'start' command on Windows
      }).unref();
    };
    
    // Try to open browser after a short delay
    setTimeout(openBrowser, 2000);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Export functions for reuse
module.exports = {
  hianimeSearch,
  hianimeEpisodes,
  hianimeStream,
  createPlaybackSession,
  handlePlaybackProxy,
  getPlayerServer,
  testMobPsycho100,
  runAnimeTest,
  // Configuration
  BASE_URL,
  SERVER_NAME,
  USER_AGENT
};

// Run anime test function
async function runAnimeTest(title, episode = 1, mode = 'sub') {
  console.log(`\n🔍 Testing ${title} Episode ${episode} (${mode})...`);
  
  try {
    // Step 1: Search for the show
    console.log(`\n🔍 Searching for "${title}"...`);
    const searchResults = await hianimeSearch(title);
    if (!searchResults.length) {
      throw new Error(`No results found for "${title}"`);
    }
    
    console.log(`✅ Found ${searchResults.length} results:`);
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (${result.id})`);
    });
    
    // Use the first result
    const show = searchResults[0];
    console.log(`\n📺 Selected: ${show.title} (${show.id})`);
    
    // Step 2: Get episodes
    console.log("\n📋 Getting episode list...");
    const episodes = await hianimeEpisodes(show.id);
    if (!episodes.length) {
      throw new Error(`No episodes found for ${show.title}`);
    }
    
    console.log(`✅ Found ${episodes.length} episodes:`);
    episodes.slice(0, 10).forEach((ep, index) => {
      console.log(`  ${index + 1}. Episode ${ep.number} (ID: ${ep.epId})`);
    });
    
    // Find the requested episode
    const episodeData = episodes.find(ep => 
      parseFloat(ep.number) === episode || ep.number === String(episode)
    );
    
    if (!episodeData) {
      throw new Error(`Episode ${episode} not found`);
    }
    
    console.log(`\n🎬 Selected Episode ${episodeData.number} (ID: ${episodeData.epId})`);
    
    // Step 3: Get stream URL
    console.log("\n🌐 Getting stream URL...");
    const stream = await hianimeStream(episodeData.epId, mode);
    
    console.log("✅ Stream resolved:");
    console.log(`  Master URL: ${stream.masterUrl}`);
    console.log(`  Referer: ${stream.referer}`);
    console.log(`  Subtitle: ${stream.subtitle || "None"}`);
    console.log(`  Resolution: ${stream.resolution}`);
    console.log(`  MAL ID: ${stream.malId || "None"}`);
    
    // Step 4: Start player server
    console.log("\n🚀 Starting local player server...");
    const server = await getPlayerServer();
    const port = server.address().port;
    
    // Set current video
    _currentVideoUrl = stream.masterUrl;
    _currentVideoReferer = stream.referer;
    _currentVideoSubtitle = stream.subtitle;
    _currentVideoStartTime = 0;
    
    // Step 5: Generate player URL
    const playerUrl = `http://127.0.0.1:${port}/player?t=${_serverToken}`;
    
    console.log("\n🎉 Ready to watch!");
    console.log(`\n📺 Player URL: ${playerUrl}`);
    console.log(`\n💡 Instructions:`);
    console.log(`  1. Open the above URL in your web browser`);
    console.log(`  2. The video should start automatically`);
    console.log(`  3. Use the video player controls to play/pause/seek`);
    console.log(`  4. Subtitles should be available if present`);
    
    // Keep server running
    console.log("\n⏳ Server running... Press Ctrl+C to exit");
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down server...');
      server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
      });
    });
    
    // Open in browser automatically (optional)
    const openBrowser = () => {
      const open = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
      
      console.log(`\n🌐 Opening in browser...`);
      spawn(open, [playerUrl], { 
        detached: true, 
        stdio: 'ignore',
        shell: true // Use shell to handle 'start' command on Windows
      }).unref();
    };
    
    // Try to open browser after a short delay
    setTimeout(openBrowser, 2000);
    
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Interactive mode function
async function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n🎬 Anime Stream Test - Interactive Mode');
  console.log('=====================================');

  try {
    const title = await new Promise(resolve => {
      rl.question('Enter anime title: ', resolve);
    });

    if (!title.trim()) {
      console.log('❌ Title cannot be empty. Using default: Mob Psycho 100');
      rl.close();
      return testMobPsycho100();
    }

    const episodeInput = await new Promise(resolve => {
      rl.question('Enter episode number (default: 1): ', resolve);
    });

    const episode = episodeInput.trim() ? parseInt(episodeInput) : 1;
    if (isNaN(episode) || episode < 1) {
      console.log('❌ Invalid episode number. Using default: 1');
      rl.close();
      return testMobPsycho100();
    }

    const modeInput = await new Promise(resolve => {
      rl.question('Enter mode (sub/dub, default: sub): ', resolve);
    });

    const mode = modeInput.trim().toLowerCase() === 'dub' ? 'dub' : 'sub';
    
    rl.close();

    // Run test with user input
    await runAnimeTest(title, episode, mode);

  } catch (error) {
    console.error('❌ Error in interactive mode:', error.message);
    rl.close();
  }
}


if (require.main === module) {
  const startInteractive = () => interactiveMode().catch((error) => {
    console.error(`Fatal scraper error: ${error.message}`);
    process.exitCode = 1;
  });

  if (app?.whenReady) app.whenReady().then(startInteractive);
  else startInteractive();
}
