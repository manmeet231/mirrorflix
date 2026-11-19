import { useEffect, useState } from 'react';
import { fetchAniListAnime } from './anilistService';
import { mapAnimeToCardFormat } from './animeDataService';
import './AnimeSearchResults.css';

export default function AnimeSearchResults({ query, catalog, onSelectMovie }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      try {
        const data = await fetchAniListAnime({
          search: query,
          perPage: 24,
          sort: ['SEARCH_MATCH'],
          isAdult: false,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!controller.signal.aborted) setResult({ anime: data.Page.media });
      } catch {
        if (!controller.signal.aborted) setResult({ error: true });
      }
    }, 300);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [query]);

  const normalizedQuery = query.toLowerCase();
  const matches = result?.error
    ? (catalog || []).filter((anime) =>
      !anime.isAdult && [anime.title, ...(anime.synonyms || [])].some((title) =>
        title?.toLowerCase().includes(normalizedQuery)
      )
    ).slice(0, 24)
    : (result?.anime || []).map((anime) => mapAnimeToCardFormat(anime));

  let status = 'Searching anime…';
  if (result?.error) {
    status = matches.length
      ? 'Live search is unavailable. Showing matches from the loaded catalog.'
      : 'Search is unavailable right now. Try again in a moment.';
  } else if (result) {
    status = result.anime.length
      ? `${result.anime.length} ${result.anime.length === 1 ? 'result' : 'results'} shown`
      : 'No matching anime. Try a different title.';
  }

  return (
    <section className="anime-search-results" aria-labelledby="anime-search-title">
      <header className="anime-search-heading">
        <h1 id="anime-search-title">Results for <span>“{query}”</span></h1>
        <p role="status">{status}</p>
      </header>
      {matches.length > 0 && (
        <ul className="anime-search-grid">
          {matches.map((card) => (
            <li key={card.id}>
              <button
                type="button"
                className="anime-search-card"
                onClick={() => onSelectMovie({
                  ...card,
                  synopsis: card.synopsis || card.description,
                  genres: card.genres?.join(', '),
                })}
              >
                <span className="anime-search-poster">
                  {card.thumbnail && <img src={card.thumbnail} alt="" loading="lazy" />}
                </span>
                <span className="anime-search-card-copy">
                  <span>{card.title}</span>
                  {card.year && <small>{card.year}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
