const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
const defaultBase = import.meta.env.DEV ? 'http://127.0.0.1:8000' : '';
const apiBase = (configuredBase || defaultBase).replace(/\/+$/, '');
const pendingRequests = new Map();

async function getJson(path) {
  const url = `${apiBase}${path}`;
  if (pendingRequests.has(url)) return pendingRequests.get(url);

  const request = fetch(url, {
    headers: { Accept: 'application/json' },
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = typeof payload?.detail === 'string' ? payload.detail : `Request failed (${response.status})`;
      throw new Error(detail);
    }
    return payload;
  }).finally(() => {
    pendingRequests.delete(url);
  });

  pendingRequests.set(url, request);
  return request;
}

function toQueryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function fetchFeaturedMovies(options = {}) {
  return getJson(`/api/movies/featured${toQueryString(options)}`);
}

export function fetchMovies(options = {}) {
  return getJson(`/api/movies${toQueryString(options)}`);
}

export function fetchMovie(movieId) {
  return getJson(`/api/movies/${encodeURIComponent(movieId)}`);
}

export function fetchCategories() {
  return getJson('/api/categories');
}

export function fetchAnime(options = {}) {
  return getJson(`/api/anime${toQueryString(options)}`);
}
