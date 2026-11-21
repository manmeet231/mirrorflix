const configuredBase = import.meta.env?.VITE_STREAMBERT_API_URL;
const API_BASE = (configuredBase || '/api/streambert').replace(/\/$/, '');

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
