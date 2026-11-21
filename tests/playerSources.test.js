import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_SOURCES, buildPlayerSourceUrl } from '../src/playerSources.js';

const source = (id) => PLAYER_SOURCES.find((item) => item.id === id);

test('Vidnest uses the dedicated AniList route for anime', () => {
  const url = new URL(buildPlayerSourceUrl(source('vidnest'), {
    mediaType: 'anime', anilistId: 21087, episode: 12, mode: 'sub',
  }));
  assert.equal(url.origin, 'https://vidnest.fun');
  assert.equal(url.pathname, '/anime/21087/12/sub');
});

test('VidSrc builds a TMDB TV URL with playback and language parameters', () => {
  const url = new URL(buildPlayerSourceUrl(source('vidsrc'), {
    mediaType: 'series', tmdbId: 95479, season: 1, episode: 2, language: 'en',
  }));
  assert.equal(url.pathname, '/embed/tv/95479/1/2');
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.get('ds_lang'), 'en');
});

test('DeVideoSrc requires IMDb and encodes the accent color', () => {
  assert.equal(buildPlayerSourceUrl(source('devideosrc'), {
    mediaType: 'series', tmdbId: 95479,
  }), null);

  const url = new URL(buildPlayerSourceUrl(source('devideosrc'), {
    mediaType: 'series', imdbId: 'tt4508902', episode: 1,
  }));
  assert.equal(url.pathname, '/custom/serial/tt4508902/1/1');
  assert.equal(url.searchParams.get('color'), '#e50914');
});

test('Aether and unavailable movie-only sources are not offered as playable URLs', () => {
  assert.equal(buildPlayerSourceUrl(source('aether'), {
    mediaType: 'series', tmdbId: 95479,
  }), null);
  assert.equal(buildPlayerSourceUrl(source('kinohub'), {
    mediaType: 'anime', kinopoiskId: '12345',
  }), null);
});

test('Frembed preserves its season and episode query parameters', () => {
  const url = new URL(buildPlayerSourceUrl(source('frembed'), {
    mediaType: 'series', tmdbId: 95479, season: 2, episode: 4,
  }));
  assert.equal(url.searchParams.get('sa'), '2');
  assert.equal(url.searchParams.get('epi'), '4');
});
