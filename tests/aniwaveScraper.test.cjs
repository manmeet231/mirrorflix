const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertPublicUrl,
  createAniwaveScraper,
  loadTlsOptions,
  parseCliArguments,
  parseEpisode,
  parseServers,
  selectServers,
} = require('../src/aniwave-scraper.cjs');
const { convertSrtToVtt } = require('../src/streambert-anime-test.cjs');

const WATCH_HTML = '<div id="watch-main" data-id="81553" data-url="/watch/one-piece-81553"></div>';
const EPISODE_HTML = `
  <a href="/watch/81553/ep-1" data-ids="81553&amp;eps=1" data-num="1"
    data-sub="1" data-dub="1" enabled="1">1</a>
  <a href="/watch/81553/ep-2" data-ids="81553&amp;eps=2" data-num="2"
    data-sub="1" data-dub="0" enabled="1">2</a>`;
const SERVER_HTML = `
  <div class="type" data-type="sub"><ul>
    <li data-sv-id="2" data-link-id="backup-link">Backup</li>
  </ul></div>
  <div class="type" data-type="ssub"><ul>
    <li data-sv-id="12" data-link-id="soft-link">MyCloud</li>
  </ul></div>
  <div class="type" data-type="dub"><ul>
    <li data-sv-id="4" data-link-id="dub-link">Vidplay</li>
  </ul></div>`;
const EMBED_URL = 'https://embed.example/embed-0/embed-token?autoPlay=0';

function response(body, status = 200) {
  return { status, body, headers: {}, url: 'https://example.test/' };
}

function envelope(result) {
  return JSON.stringify({ status: 200, result });
}

function createFixture(overrides = {}) {
  const calls = [];
  const requestImpl = async (urlValue, options) => {
    const url = new URL(urlValue);
    calls.push({ url, options });
    if (url.hostname === 'aniwaves.tv' && url.pathname === '/watch/one-piece-81553') {
      return overrides.watchResponse || response(WATCH_HTML);
    }
    if (url.pathname === '/ajax/episode/list/81553') {
      return response(envelope(overrides.episodeHtml || EPISODE_HTML));
    }
    if (url.pathname === '/ajax/server/list') {
      assert.equal(url.searchParams.get('servers'), '81553');
      assert.equal(url.searchParams.get('eps'), '1');
      return response(envelope(overrides.serverHtml || SERVER_HTML));
    }
    if (url.pathname === '/ajax/sources') {
      const id = url.searchParams.get('id');
      if (id === 'soft-link') {
        if (overrides.failSoftServer) return response('soft server unavailable', 503);
        return response(envelope({ url: EMBED_URL, sources: [], tracks: [] }));
      }
      if (id === 'backup-link') {
        return response(envelope({
          sources: [{ file: '/video/backup.mp4', type: 'mp4' }],
          tracks: [],
        }));
      }
      return response('upstream unavailable', 503);
    }
    if (url.href === EMBED_URL) {
      return response('<div id="screen" data-realid="resume-id" data-id="source-token"></div>');
    }
    if (url.pathname === '/embed-0/getSources') {
      assert.equal(url.searchParams.get('id'), 'source-token');
      return response(JSON.stringify(overrides.playerPayload || {
        sources: 'https://media.example/cdn/master.m3u8?token=fixture',
        tracks: [
          { file: '/subtitles/eng.srt', label: 'ENG', kind: 'captions', default: true },
          { file: 'https://media.example/japanese.vtt', label: 'Japanese', language: 'ja', kind: 'subtitles' },
          { file: 'https://media.example/thumbnails.vtt', label: 'Thumbnails', kind: 'thumbnails' },
        ],
      }));
    }
    throw new Error(`Unexpected URL: ${url.href}`);
  };
  const scraper = createAniwaveScraper({ requestImpl, validateUrlImpl: async (url) => url });
  return { calls, scraper };
}

test('scraper resolves the exact episode, soft-sub embed, HLS, and caption tracks', async () => {
  const { calls, scraper } = createFixture();
  const result = await scraper.scrapeAniwaveEpisode('one-piece-81553', '01');

  assert.equal(result.episode, '1');
  assert.equal(result.mode, 'sub');
  assert.deepEqual(result.server, { id: '12', name: 'MyCloud', type: 'ssub' });
  assert.deepEqual(result.video, {
    url: 'https://media.example/cdn/master.m3u8?token=fixture',
    type: 'hls',
    referer: EMBED_URL,
  });
  assert.deepEqual(result.subtitles, [
    {
      url: 'https://embed.example/subtitles/eng.srt',
      language: 'en',
      label: 'ENG',
      default: true,
    },
    {
      url: 'https://media.example/japanese.vtt',
      language: 'ja',
      label: 'Japanese',
      default: false,
    },
  ]);
  assert.equal(result.subtitles.some((track) => track.label === 'Thumbnails'), false);
  assert.deepEqual(calls.map(({ url }) => url.pathname), [
    '/watch/one-piece-81553',
    '/ajax/episode/list/81553',
    '/ajax/server/list',
    '/ajax/sources',
    '/embed-0/embed-token',
    '/embed-0/getSources',
  ]);
  assert.equal(calls[1].options.headers['X-Requested-With'], 'XMLHttpRequest');
  assert.equal(calls[4].options.headers.Referer, 'https://aniwaves.tv/watch/one-piece-81553');
  assert.equal(calls[5].options.headers.Referer, EMBED_URL);
});

test('scraper falls back to another server and supports direct MP4 payloads', async () => {
  const { scraper } = createFixture({ failSoftServer: true });
  const result = await scraper.scrapeAniwaveEpisode('one-piece-81553', 1);

  assert.equal(result.server.name, 'Backup');
  assert.equal(result.server.type, 'sub');
  assert.equal(result.video.url, 'https://aniwaves.tv/video/backup.mp4');
  assert.equal(result.video.type, 'mp4');
  assert.deepEqual(result.subtitles, []);
});

test('scraper rejects invalid input before making requests', async () => {
  let requests = 0;
  const scraper = createAniwaveScraper({
    requestImpl: async () => { requests += 1; throw new Error('Unexpected request'); },
  });

  await assert.rejects(scraper.scrapeAniwaveEpisode('81553', 1), (error) => error.status === 400);
  await assert.rejects(scraper.scrapeAniwaveEpisode('one-piece-81553', 0), (error) => error.status === 400);
  await assert.rejects(
    scraper.scrapeAniwaveEpisode('one-piece-81553', 1, { mode: 'raw' }),
    (error) => error.status === 400,
  );
  assert.equal(requests, 0);
});

test('scraper reports missing episodes and anti-bot responses clearly', async () => {
  const missing = createFixture().scraper;
  await assert.rejects(
    missing.scrapeAniwaveEpisode('one-piece-81553', 999),
    (error) => error.status === 404 && /not found/.test(error.message),
  );

  const challenged = createFixture({
    watchResponse: response('<title>Just a moment...</title>'),
  }).scraper;
  await assert.rejects(
    challenged.scrapeAniwaveEpisode('one-piece-81553', 1),
    (error) => error.status === 503 && /no challenge bypass/.test(error.message),
  );
});

test('parsers handle entities, unavailable versions, and server preference', () => {
  const episode = parseEpisode(EPISODE_HTML, '1');
  assert.equal(episode.ids, '81553&eps=1');
  assert.equal(episode.sub, true);
  assert.equal(episode.dub, true);
  assert.equal(parseEpisode(EPISODE_HTML, '2').dub, false);
  assert.equal(parseEpisode(EPISODE_HTML, '999'), null);

  const servers = parseServers(SERVER_HTML);
  assert.deepEqual(selectServers(servers, 'sub').map((server) => server.name), ['MyCloud', 'Backup']);
  assert.deepEqual(selectServers(servers, 'dub').map((server) => server.name), ['Vidplay']);
});

test('TLS credentials are loaded at runtime and incomplete configuration fails', () => {
  const reads = [];
  const options = loadTlsOptions({
    ANIWAVE_TLS_CERT_PATH: 'client.crt',
    ANIWAVE_TLS_KEY_PATH: 'client.key',
    ANIWAVE_TLS_CA_PATH: 'ca.crt',
    ANIWAVE_TLS_KEY_PASSWORD: 'secret',
  }, (file) => {
    reads.push(file);
    return Buffer.from(file);
  });

  assert.equal(reads.length, 3);
  assert.equal(options.passphrase, 'secret');
  assert.ok(Buffer.isBuffer(options.cert));
  assert.ok(Buffer.isBuffer(options.key));
  assert.ok(Buffer.isBuffer(options.ca));
  assert.throws(() => loadTlsOptions({ ANIWAVE_TLS_CERT_PATH: 'client.crt' }), /Both ANIWAVE/);
});

test('CLI parsing, SRT conversion, and private-network URL rejection work', async () => {
  assert.deepEqual(parseCliArguments(['one-piece-81553', '1', '--mode', 'dub']), {
    animeId: 'one-piece-81553', episode: '1', mode: 'dub',
  });
  assert.deepEqual(parseCliArguments(['--help']), { help: true });
  assert.throws(() => parseCliArguments(['one-piece-81553']), /Usage:/);

  const vtt = convertSrtToVtt('1\r\n00:00:01,500 --> 00:00:03,250\r\nHello\r\n');
  assert.match(vtt, /^WEBVTT\n\n/);
  assert.match(vtt, /00:00:01\.500 --> 00:00:03\.250/);
  assert.match(vtt, /Hello/);
  await assert.rejects(assertPublicUrl('http://127.0.0.1/media.m3u8'), /Private network/);
  await assert.rejects(assertPublicUrl('file:///etc/passwd'), /HTTP\(S\)/);
});
