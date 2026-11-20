import test from 'node:test';
import assert from 'node:assert/strict';

import { buildGenreRows, fetchGenreByName, fetchGenresFromDB } from '../src/components/dbApiService.js';
import { mapAnimeToCardFormat } from '../src/components/animeMapper.js';
import { categorizeAnime } from '../src/components/anilistService.js';

test('buildGenreRows keeps complete rows and deduplicates normalized IDs', () => {
  const genres = [
    { name: 'Action', animes: [{ id: 1 }, { id: '1' }, { id: 2 }] },
    { name: 'Drama', animes: [{ id: '1' }, { id: 3 }, { id: 4 }] },
  ];

  assert.deepEqual(buildGenreRows(genres, ['Action', 'Drama'], 2), [
    { genreName: 'Action', animes: [{ id: 1 }, { id: 2 }] },
    { genreName: 'Drama', animes: [{ id: 3 }, { id: 4 }] },
  ]);
});

test('buildGenreRows omits incomplete rows without reserving their IDs', () => {
  const genres = [
    { name: 'Action', animes: [{ id: 1 }] },
    { name: 'Drama', animes: [{ id: 1 }, { id: 2 }] },
  ];

  assert.deepEqual(buildGenreRows(genres, ['Action', 'Drama'], 2), [
    { genreName: 'Drama', animes: [{ id: 1 }, { id: 2 }] },
  ]);
});

test('database requests validate catalog responses and encode genre names', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith('/Slice%20of%20Life')) {
      return { status: 404, ok: false };
    }
    return { status: 200, ok: true, json: async () => [] };
  };

  try {
    assert.deepEqual(await fetchGenresFromDB(), []);
    assert.equal(await fetchGenreByName('Slice of Life'), null);
    assert.match(calls[0], /\/api\/genres$/);
    assert.match(calls[1], /\/api\/genres\/Slice%20of%20Life$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('anime mapper supplies safe defaults and optional stream metadata', () => {
  const mapped = mapAnimeToCardFormat(
    {
      id: 10,
      title: { english: 'English title', romaji: 'Romaji title' },
      coverImage: { large: 'cover.jpg' },
      genres: null,
    },
    { masterUrl: 'stream.m3u8', episodes: [{ id: 'episode-1' }] },
  );

  assert.equal(mapped.title, 'English title');
  assert.equal(mapped.poster, 'cover.jpg');
  assert.deepEqual(mapped.genres, []);
  assert.equal(mapped.streamUrl, 'stream.m3u8');
  assert.equal(mapped.episodes.length, 1);
});

test('categorizeAnime handles missing optional genre data', () => {
  const categories = categorizeAnime([{ id: 1, status: 'RELEASING' }]);
  assert.equal(categories['Currently Airing'].length, 1);
  assert.deepEqual(categories.Genres, {});
});
