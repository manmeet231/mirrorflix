const test = require('node:test');
const assert = require('node:assert/strict');

const scraper = require('../src/streambert-anime-test.cjs');
const { createStreambertServer, selectShow } = require('../server/streambert-server.cjs');
const { selectServerEmbed } = require('../src/streambert-anime-test.cjs');

async function startServer(t, overrides = {}, aniwaveOverrides = {}) {
  const client = {
    hianimeSearch: async () => [
      { id: 'mob-psycho-100-926', title: 'Mob Psycho 100', jname: 'Mob Psycho 100' },
      { id: 'mob-psycho-100-iii-917', title: 'Mob Psycho 100 III', jname: 'Mob Psycho 100 III' },
    ],
    hianimeEpisodes: async () => [
      { epId: '2', number: '10' },
      { epId: '1', number: '2' },
      { epId: '3', number: '1' },
    ],
    hianimeStream: async () => ({
      masterUrl: 'https://media.example/master.m3u8',
      referer: 'https://embed.example/',
      subtitle: 'https://media.example/english.vtt',
      resolution: 'auto',
      malId: 123,
    }),
    createPlaybackSession: scraper.createPlaybackSession,
    handlePlaybackProxy: scraper.handlePlaybackProxy,
    ...overrides,
  };
  const aniwaveClient = {
    scrapeAniwaveEpisode: async (animeId, episode, { mode }) => ({
      animeId,
      episode: String(episode),
      mode,
      server: { id: '12', name: 'MyCloud', type: mode === 'sub' ? 'ssub' : 'dub' },
      video: {
        url: 'https://media.example/master.m3u8',
        type: 'hls',
        referer: 'https://embed.example/',
      },
      subtitles: [
        { url: 'https://media.example/english.srt', language: 'en', label: 'English', default: true },
        { url: 'https://media.example/spanish.vtt', language: 'es', label: 'Spanish', default: false },
      ],
    }),
    ...aniwaveOverrides,
  };
  const server = createStreambertServer(client, undefined, aniwaveClient);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/streambert`;
}

test('selectShow prefers exact alternative titles over the first result', () => {
  const results = [
    { id: 'first', title: 'Mob Psycho 100' },
    { id: 'third', title: 'Mob Psycho 100 III' },
  ];
  assert.equal(selectShow(results, 'Unknown', ['Mob Psycho 100 III']).id, 'third');
});

test('server selection accepts a renamed label for the compatible ZokoAnime host', () => {
  const embedUrl = 'https://zokoanime.video/stream/mal/62653/1/sub';
  const hash = Buffer.from(embedUrl).toString('base64');
  const html = `<div class="item server-item" data-type="sub"
    data-server-name="HD-1" data-hash="${hash}"></div>`;

  assert.deepEqual(selectServerEmbed(html, 'sub'), {
    embedUrl,
    serverName: 'HD-1',
  });
  assert.equal(selectServerEmbed(html, 'dub'), null);
});

test('server selection rejects unrelated embed hosts', () => {
  const hash = Buffer.from('https://unrelated.example/stream/1').toString('base64');
  const html = `<div class="server-item" data-type="sub"
    data-server-name="HD-1" data-hash="${hash}"></div>`;

  assert.equal(selectServerEmbed(html, 'sub'), null);
});

test('episodes endpoint resolves a show and returns sorted numbered episodes', async (t) => {
  const base = await startServer(t);
  const params = new URLSearchParams({ title: 'Mob Psycho 100 III' });
  const response = await fetch(`${base}/episodes?${params}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.show.id, 'mob-psycho-100-iii-917');
  assert.deepEqual(payload.episodes.map((episode) => episode.number), ['1', '2', '10']);
  assert.deepEqual(payload.episodes.map((episode) => episode.id), ['3', '1', '2']);
});

test('stream endpoint returns same-origin proxied video and subtitle sources', async (t) => {
  const base = await startServer(t);
  const response = await fetch(`${base}/stream?episodeId=15518&mode=sub`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.match(payload.videoUrl, /^\/api\/streambert\/proxy\?t=[a-f0-9]{48}&url=/);
  assert.match(decodeURIComponent(payload.videoUrl), /master\.m3u8/);
  assert.equal(payload.subtitles.length, 1);
  assert.match(payload.subtitles[0].src, /^\/api\/streambert\/proxy/);
  assert.equal(payload.subtitles[0].default, true);
});

test('Aniwave endpoint returns proxied video and every subtitle track', async (t) => {
  const base = await startServer(t);
  const params = new URLSearchParams({ animeId: 'one-piece-81553', episode: '1', mode: 'sub' });
  const response = await fetch(`${base}/aniwave/stream?${params}`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.provider, 'aniwave');
  assert.equal(payload.server.name, 'MyCloud');
  assert.match(decodeURIComponent(payload.videoUrl), /master\.m3u8/);
  assert.equal(payload.subtitles.length, 2);
  assert.deepEqual(payload.subtitles.map((track) => track.language), ['en', 'es']);
  assert.match(decodeURIComponent(payload.subtitles[0].src), /english\.srt/);
  assert.equal(payload.subtitles[0].default, true);
  assert.equal(payload.subtitles[1].default, false);
});

test('Aniwave endpoint validates required parameters and mode', async (t) => {
  const base = await startServer(t);
  const missing = await fetch(`${base}/aniwave/stream?episode=1`);
  const invalid = await fetch(`${base}/aniwave/stream?animeId=one-piece-81553&episode=1&mode=raw`);

  assert.equal(missing.status, 400);
  assert.equal(invalid.status, 400);
  assert.match((await invalid.json()).error, /sub or dub/);
});

test('API validates input and reports missing search results', async (t) => {
  const base = await startServer(t, { hianimeSearch: async () => [] });
  const invalid = await fetch(`${base}/stream?episodeId=abc`);
  const missing = await fetch(`${base}/episodes?title=Unknown`);

  assert.equal(invalid.status, 400);
  assert.equal(missing.status, 404);
  assert.match((await missing.json()).error, /No HiAnime results/);
});
