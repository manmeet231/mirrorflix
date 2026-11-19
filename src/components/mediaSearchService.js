async function fetchCatalog(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}.`);
  return response.json();
}

function matchesTitle(title, query) {
  return typeof title === 'string' && title.toLowerCase().includes(query.toLowerCase());
}

function movieSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && ['itunes.apple.com', 'tv.apple.com'].includes(url.hostname)) {
      return url.href;
    }
  } catch {
    // A listing can lack a store URL.
  }
  return undefined;
}

export async function searchTvShows(query, signal) {
  const url = new URL('https://api.tvmaze.com/search/shows');
  url.searchParams.set('q', query);
  const results = await fetchCatalog(url, signal);
  return results
    .map((result) => result.show)
    .filter((show) => show?.type !== 'Animation' && matchesTitle(show?.name, query))
    .slice(0, 24)
    .map((show) => ({
      id: `tv:${show.id}`,
      title: show.name,
      synopsis: show.summary?.replace(/<[^>]+>/g, '').trim(),
      year: show.premiered?.slice(0, 4),
      thumbnail: show.image?.medium || show.image?.original,
      backdrop: show.image?.original || show.image?.medium,
      genres: show.genres,
      mediaType: 'series',
      sourceUrl: `https://www.tvmaze.com/shows/${show.id}`,
      sourceLabel: 'View on TVmaze',
    }));
}

export async function searchMovies(query, signal) {
  const url = new URL('https://itunes.apple.com/search');
  url.search = new URLSearchParams({ term: query, country: 'US', limit: '50', explicit: 'No' });
  const { results } = await fetchCatalog(url, signal);
  const seen = new Set();
  return results
    .filter((movie) => {
      if (movie.kind !== 'feature-movie' || !matchesTitle(movie.trackName, query)) return false;
      const key = `${movie.trackName.toLowerCase()}:${movie.releaseDate?.slice(0, 4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24)
    .map((movie) => ({
      id: `movie:${movie.trackId}`,
      title: movie.trackName,
      synopsis: movie.longDescription || movie.shortDescription,
      year: movie.releaseDate?.slice(0, 4),
      genres: movie.primaryGenreName ? [movie.primaryGenreName] : [],
      ageRating: movie.contentAdvisoryRating,
      mediaType: 'movie',
      sourceUrl: movieSource(movie.trackViewUrl),
      sourceLabel: 'View store listing',
    }));
}
