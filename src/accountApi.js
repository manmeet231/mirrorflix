const configuredBase = import.meta.env?.VITE_STREAMBERT_API_URL;
const API_BASE = (configuredBase || '/api/streambert').replace(/\/$/, '');

async function request(path, { token, body, signal, method } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    signal,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Account request failed with HTTP ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function registerAccount(credentials) {
  return request('/auth/register', { body: credentials });
}

export function loginAccount(credentials) {
  return request('/auth/login', { body: credentials });
}

export function fetchAccountSession(token, { signal } = {}) {
  return request('/auth/session', { token, signal });
}

export function logoutAccount(token) {
  return request('/auth/logout', { token, body: {} });
}

export function saveWatchProgress(token, progress) {
  return request('/progress', { token, body: progress, method: 'PUT' });
}

export function fetchForum(movieId, episodeId, { signal } = {}) {
  const params = new URLSearchParams({ movieId: String(movieId) });
  if (episodeId !== null && episodeId !== undefined) params.set('episodeId', String(episodeId));
  return request(`/forum?${params}`, { signal });
}

export function createForumPost(token, { movieId, episodeId, body }) {
  return request('/forum', {
    token,
    body: { movieId: String(movieId), episodeId: episodeId == null ? null : String(episodeId), body },
  });
}
