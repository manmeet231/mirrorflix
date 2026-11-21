const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveShowEpisodes } = require('../server/showResolver.cjs');

const shows = [
  { id: 's3-empty', title: 'One Punch Man Season 3 Part 2' },
  { id: 's2', title: 'One Punch Man 2nd Season' },
  { id: 'special', title: 'One Punch Man: Road to Hero' },
  { id: 's1', title: 'One Punch Man' },
  { id: 's3', title: 'One-Punch Man Season 3' },
];

function episodes(count) {
  return Array.from({ length: count }, (_, index) => ({
    epId: String(index + 1),
    number: String(index + 1),
  }));
}

function loadById(counts) {
  return async (id) => episodes(counts[id] || 0);
}

test('season one recovers the base show instead of an empty later-season result', async () => {
  const result = await resolveShowEpisodes(shows, {
    title: 'One Punch Man Season 1',
    expectedEpisodes: 12,
  }, loadById({ s1: 12, s2: 12, s3: 12, special: 1 }));

  assert.equal(result.show.id, 's1');
  assert.equal(result.episodes.length, 12);
});

test('an explicitly requested later season wins even when counts are equal', async () => {
  const result = await resolveShowEpisodes(shows, {
    title: 'One Punch Man Season 2',
    expectedEpisodes: 12,
  }, loadById({ s1: 12, s2: 12, s3: 12, special: 1 }));

  assert.equal(result.show.id, 's2');
});

test('a one-episode special is not replaced by a longer series', async () => {
  const result = await resolveShowEpisodes(shows, {
    title: 'One Punch Man: Road to Hero',
    expectedEpisodes: 12,
  }, loadById({ s1: 12, s2: 12, s3: 12, special: 1 }));

  assert.equal(result.show.id, 'special');
  assert.equal(result.episodes.length, 1);
});

test('equally relevant duplicates use the most complete episode list', async () => {
  const duplicates = [
    { id: 'partial', title: 'Example Anime' },
    { id: 'complete', title: 'Example Anime' },
  ];
  const result = await resolveShowEpisodes(duplicates, {
    title: 'Example Anime',
    expectedEpisodes: 12,
  }, loadById({ partial: 1, complete: 12 }));

  assert.equal(result.show.id, 'complete');
  assert.equal(result.episodes.length, 12);
});
