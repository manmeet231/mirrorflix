import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendFromWatchHistory } from '../src/recommendations.js';

const catalog = [
  { id: 1, title: 'Watched action', genres: ['Action', 'Drama'] },
  { id: 2, title: 'Best match', genres: ['Action', 'Drama'], popularity: 20 },
  { id: 3, title: 'Partial match', genres: ['Action'], popularity: 100 },
  { id: 4, title: 'Unrelated', genres: ['Comedy'] },
  { id: '2', title: 'Duplicate', genres: ['Action', 'Drama'] },
];

test('recommendations use watched genres, exclude watched titles, and deduplicate IDs', () => {
  const progress = {
    1: { movieId: '1', genres: ['Action', 'Drama'], episodes: { 1: { position: 500, duration: 1000, completed: false } } },
  };
  assert.deepEqual(recommendFromWatchHistory(catalog, progress).map((movie) => movie.title), ['Best match', 'Partial match']);
});

test('completed episodes increase preference weight and empty history gives no generic suggestions', () => {
  assert.deepEqual(recommendFromWatchHistory(catalog, {}), []);
  const progress = {
    99: { movieId: '99', genres: 'Comedy', episodes: { 1: { position: 1000, duration: 1000, completed: true } } },
  };
  assert.deepEqual(recommendFromWatchHistory(catalog, progress).map((movie) => movie.id), [4]);
});

test('a zero progress record does not influence recommendations', () => {
  const progress = { 1: { movieId: '1', episodes: { 1: { position: 0, duration: 1000, completed: false } } } };
  assert.deepEqual(recommendFromWatchHistory(catalog, progress), []);
});
