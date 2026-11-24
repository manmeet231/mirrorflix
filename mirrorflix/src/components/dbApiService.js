const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL;
// Same-origin by default: Vite proxies /api/genres in dev, nginx routes it in
// production. Never fall back to a hard-coded VPS IP — the database API only
// listens on the VPS loopback, so that fallback could never connect.
const API_BASE_URL = (configuredBaseUrl || '').replace(/\/$/, '');

async function requestDatabase(path, { signal, notFoundValue, ...options } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    signal,
    headers: { Accept: 'application/json', ...options.headers },
  });

  if (response.status === 404 && notFoundValue !== undefined) return notFoundValue;
  if (!response.ok) throw new Error(`Database request failed with HTTP ${response.status}.`);
  return response.json();
}

export async function fetchGenresFromDB({ signal } = {}) {
  const genres = await requestDatabase('/api/genres', { signal });
  if (!Array.isArray(genres)) throw new Error('Database returned an invalid genre catalog.');
  return genres;
}

export async function fetchGenreByName(genreName, { signal } = {}) {
  return requestDatabase(`/api/genres/${encodeURIComponent(genreName)}`, {
    signal,
    notFoundValue: null,
  });
}

/** Build complete rows in priority order without repeating an anime across rows. */
export function buildGenreRows(allGenres, targetGenres, limitPerGenre = 30) {
  const genreMap = new Map(allGenres.map((genre) => [genre.name, genre.animes || []]));
  const assignedAnimeIds = new Set();
  const rows = [];

  for (const genreName of targetGenres) {
    const selected = [];
    const selectedIds = new Set();

    for (const anime of genreMap.get(genreName) || []) {
      if (anime?.id === null || anime?.id === undefined || anime.id === '') continue;
      const id = String(anime.id);
      if (assignedAnimeIds.has(id) || selectedIds.has(id)) continue;
      selected.push(anime);
      selectedIds.add(id);
      if (selected.length === limitPerGenre) break;
    }

    if (selected.length === limitPerGenre) {
      selectedIds.forEach((id) => assignedAnimeIds.add(id));
      rows.push({ genreName, animes: selected });
    }
  }

  return rows;
}

export async function fetchGenreRows(targetGenres, limitPerGenre = 30, { signal } = {}) {
  const allGenres = await fetchGenresFromDB({ signal });
  return buildGenreRows(allGenres, targetGenres, limitPerGenre);
}

export default { fetchGenresFromDB, fetchGenreByName, fetchGenreRows };
