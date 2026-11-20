import { useEffect, useState } from 'react';
import { fetchAniListAnime } from './anilistService';
import MovieRow from './MovieRow';
import { mapAnimeToCardFormat } from './animeDataService';
import { searchTvShows } from './mediaSearchService';
import './AnimeSearchResults.css';

const groups = [
  { id: 'tv', label: 'TV Series', source: 'TVmaze', url: 'https://www.tvmaze.com/', search: searchTvShows },
  { id: 'anime', label: 'Anime', source: 'AniList', url: 'https://anilist.co/', search: searchAnime },
];

async function searchAnime(query, signal) {
  const data = await fetchAniListAnime({
    search: query,
    perPage: 24,
    sort: ['SEARCH_MATCH'],
    isAdult: false,
    signal,
  });
  return data.Page.media.map((anime) => mapAnimeToCardFormat(anime));
}

export default function AnimeSearchResults({ query, catalog, onSelectMovie }) {
  const [results, setResults] = useState({});

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const debounce = window.setTimeout(() => {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
      for (const group of groups) {
        group.search(query, signal).then((items) => {
          if (!controller.signal.aborted) setResults((previous) => ({ ...previous, [group.id]: { items } }));
        }).catch(() => {
          if (!controller.signal.aborted) setResults((previous) => ({ ...previous, [group.id]: { error: true } }));
        });
      }
    }, 450);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  const animeFallback = results.anime?.error
    ? (catalog || []).filter((anime) =>
      !anime.isAdult && [anime.title, ...(anime.synonyms || [])].some((title) =>
        title?.toLowerCase().includes(query.toLowerCase())
      )
    ).slice(0, 24)
    : [];

  const sections = groups.map((group) => ({
    ...group,
    items: results[group.id]?.items || (group.id === 'anime' ? animeFallback : []),
  }));
  const pending = query.length >= 2 && groups.some(({ id }) => !results[id]);
  const failed = groups.filter(({ id }) => results[id]?.error);
  const count = sections.reduce((total, group) => total + group.items.length, 0);
  let status = `${count} ${count === 1 ? 'result' : 'results'} shown`;
  if (query.length < 2) status = 'Type at least two characters to search.';
  else if (pending) status = count ? `${status}. Searching other catalogs…` : 'Searching titles…';
  else if (failed.length) {
    const unavailable = failed.map(({ label }) => label).join(', ');
    status = count ? `${status}. Live search unavailable for ${unavailable}.` : `Search unavailable for ${unavailable}. Try again in a moment.`;
  } else if (!count) status = 'No matching titles. Try a different search.';

  return (
    <section className="anime-search-results" aria-labelledby="anime-search-title">
      <header className="anime-search-heading">
        <h1 id="anime-search-title">Results for <span>"{query}"</span></h1>
        <p role="status">{status}</p>
      </header>
      {sections.filter(({ items }) => items.length > 0).map((group) => (
        <section className="catalog-search-group" key={group.id} aria-labelledby={`search-group-${group.id}`}>
          <div className="catalog-search-group-heading">
            <h2 id={`search-group-${group.id}`}>{group.label}</h2>
            <a href={group.url} target="_blank" rel="noreferrer">{group.source}</a>
          </div>
          <MovieRow
            movies={group.items}
            title={group.label}
            variant="search"
            onSelectMovie={(card) => onSelectMovie({
              ...card,
              synopsis: card.synopsis || card.description,
              genres: Array.isArray(card.genres) ? card.genres.join(', ') : card.genres,
            })}
          />
        </section>
      ))}
    </section>
  );
}