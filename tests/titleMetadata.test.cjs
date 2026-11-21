const test = require('node:test');
const assert = require('node:assert/strict');
const { createTitleMetadata, scoreResult } = require('../server/titleMetadata.cjs');

function response(payload, ok = true, status = 200) {
  return { ok, status, json: async () => payload };
}

test('TMDB matching prefers an exact title and year over the first result', () => {
  const wrong = { name: 'One Punch Man Special', first_air_date: '2019-01-01', popularity: 50 };
  const correct = { name: 'One Punch Man', first_air_date: '2015-10-05', popularity: 10 };
  assert.ok(scoreResult(correct, 'One Punch Man', 2015) > scoreResult(wrong, 'One Punch Man', 2015));
});

test('metadata resolver returns TMDB, IMDb, and AniList identifiers', async () => {
  const requested = [];
  const metadata = createTitleMetadata({
    apiKey: 'server-only-key',
    fetchImpl: async (url) => {
      requested.push(url);
      if (url.pathname === '/3/search/tv') {
        return response({ results: [{ id: 95479, name: 'One Punch Man', first_air_date: '2015-10-05' }] });
      }
      if (url.pathname === '/3/tv/95479/external_ids') {
        return response({ imdb_id: 'tt4508902' });
      }
      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const result = await metadata.resolve({
    title: 'One Punch Man', year: 2015, mediaType: 'anime', anilistId: 21087,
  });
  assert.deepEqual(result, {
    tmdbId: 95479,
    imdbId: 'tt4508902',
    kinopoiskId: null,
    anilistId: 21087,
    mediaType: 'tv',
    title: 'One Punch Man',
    year: '2015',
  });
  assert.equal(requested.length, 2);
  assert.ok(requested.every((url) => url.searchParams.get('api_key') === 'server-only-key'));
});

test('metadata resolution fails clearly when the server key is missing', async () => {
  const metadata = createTitleMetadata({ apiKey: '' });
  await assert.rejects(
    metadata.resolve({ title: 'Example' }),
    (error) => error.status === 503 && /not configured/.test(error.message),
  );
});
