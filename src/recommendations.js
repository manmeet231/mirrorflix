function genreList(value) {
  const genres = Array.isArray(value) ? value : String(value || '').split(',');
  return genres.map((genre) => String(genre).trim().toLowerCase()).filter(Boolean);
}

function historyEntries(progress) {
  return Object.values(progress || {}).filter((entry) =>
    entry && Object.values(entry.episodes || {}).some((episode) => episode.position > 0 || episode.completed));
}

/** Rank unwatched titles by genres in the user's actual viewing history. */
export function recommendFromWatchHistory(catalog, progress, limit = 30) {
  const byId = new Map((catalog || []).map((movie) => [String(movie.id), movie]));
  const genreWeights = new Map();
  const watchedIds = new Set();

  for (const entry of historyEntries(progress)) {
    const id = String(entry.movieId);
    watchedIds.add(id);
    const watched = byId.get(id);
    const episodes = Object.values(entry.episodes || {});
    const weight = Math.max(1, episodes.reduce((total, episode) =>
      total + (episode.completed ? 2 : episode.position > 0 ? 1 : 0), 0));
    for (const genre of new Set(genreList(watched?.genres || entry.genres))) {
      genreWeights.set(genre, (genreWeights.get(genre) || 0) + weight);
    }
  }

  if (!genreWeights.size) return [];
  const seen = new Set();
  return (catalog || [])
    .filter((movie) => {
      const id = String(movie.id);
      if (watchedIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((movie) => ({
      movie,
      score: genreList(movie.genres).reduce((score, genre) => score + (genreWeights.get(genre) || 0), 0),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || (right.movie.popularity || 0) - (left.movie.popularity || 0))
    .slice(0, limit)
    .map((entry) => entry.movie);
}
