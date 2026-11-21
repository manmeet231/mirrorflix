const configuredBase = import.meta.env?.VITE_STREAMBERT_API_URL;
const API_BASE = (configuredBase || '/api/streambert').replace(/\/$/, '');

<<<<<<< HEAD
// This module is used by the browser app. Keep the Node/Electron test runner
// out of the browser dependency graph; its Node built-ins cannot be bundled by
// Vite and stream resolution is not implemented as a public browser API.
async function browserHianimeSearch(query) {
  // In a real implementation, this would make API calls to a proxy server
  // For now, return mock data
  console.log('Browser search not implemented yet');
  return [];
=======
async function requestStreambert(path, { signal, ...options } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    signal,
    headers: { Accept: 'application/json', ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Streambert request failed with HTTP ${response.status}.`);
  }
  return payload;
}

export async function fetchAnimeEpisodes(title, { alternativeTitles = [], expectedEpisodes, signal } = {}) {
  const params = new URLSearchParams({ title });
  for (const alternative of alternativeTitles) {
    if (alternative) params.append('alternativeTitles', alternative);
  }
  if (Number.isInteger(expectedEpisodes) && expectedEpisodes > 0) {
    params.set('expectedEpisodes', String(expectedEpisodes));
  }
  return requestStreambert(`/episodes?${params}`, { signal });
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
}

export async function fetchTitleIds(title, {
  year,
  mediaType = 'anime',
  anilistId,
  signal,
} = {}) {
  const params = new URLSearchParams({ title, mediaType });
  if (year) params.set('year', String(year));
  if (anilistId) params.set('anilistId', String(anilistId));
  return requestStreambert(`/title-ids?${params}`, { signal });
}

export async function fetchEpisodeStream(episodeId, { mode = 'sub', signal } = {}) {
  const params = new URLSearchParams({ episodeId: String(episodeId), mode });
  return requestStreambert(`/stream?${params}`, { signal });
}

<<<<<<< HEAD
export const hianimeSearch = browserHianimeSearch;
export const hianimeEpisodes = browserHianimeEpisodes;
export const hianimeStream = browserHianimeStream;
=======
// Compatibility helpers for the older eager-enrichment service.
export async function hianimeSearch(query, { signal } = {}) {
  return requestStreambert(`/search?${new URLSearchParams({ query })}`, { signal });
}

export async function hianimeEpisodes(showId, { signal } = {}) {
  return requestStreambert(`/episodes?${new URLSearchParams({ showId })}`, { signal });
}

export async function hianimeStream(episodeId, mode = 'sub') {
  const stream = await fetchEpisodeStream(episodeId, { mode });
  return {
    masterUrl: stream.videoUrl,
    subtitle: stream.subtitles?.[0]?.src || null,
    resolution: stream.resolution,
    malId: stream.malId,
  };
}
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
