import MovieRow from './MovieRow';
import { SKELETON_CARD_COUNT, TARGET_GENRES } from '../catalogConfig';
import './CategorizedAnimeSection.css';
import './ContentSection.css';

// Skeleton loader for a single movie card
const MovieCardSkeleton = () => (
  <article className="movie-card skeleton">
    <div className="movie-card-expanded">
      <div className="movie-card-visual skeleton-image"></div>
      <div className="movie-footer">
        <div className="movie-actions skeleton-actions">
          <div className="skeleton-btn"></div>
          <div className="skeleton-btn"></div>
          <div className="skeleton-btn"></div>
        </div>
        <div className="movie-metadata">
          <div className="movie-meta-top">
            <div className="skeleton-title"></div>
            <div className="skeleton-badge"></div>
            <div className="skeleton-badge"></div>
          </div>
          <div className="movie-genres">
            <div className="skeleton-genre"></div>
            <div className="skeleton-genre"></div>
            <div className="skeleton-genre"></div>
          </div>
        </div>
      </div>
    </div>
  </article>
);

// Skeleton loader for a full row (30 cards)
const MovieRowSkeleton = () => (
  <div className="movie-row">
    <div className="movie-row-container">
      <button className="scroll-btn scroll-left" disabled aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <div className="movie-row-posters skeleton-row">
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
          <MovieCardSkeleton key={index} />
        ))}
      </div>
      <button className="scroll-btn scroll-right" disabled aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
    </div>
  </div>
);

export default function CategorizedAnimeSection({
  title = 'Browse Anime',
  genreRows = [],
  onSelectMovie,
  loading = false,
  error = null,
}) {
  const displayRows = loading
    ? TARGET_GENRES.map((genreName) => ({ genreName, animes: [], isSkeleton: true }))
    : genreRows;

  let content;
  if (error) {
    content = <div className="error-state"><p className="error-message">{error}</p></div>;
  } else if (displayRows.length === 0) {
    content = <div className="empty-state"><p>No anime data available for the selected genres.</p></div>;
  } else {
    content = (
      <div className="all-categories">
        {displayRows.map((row) => (
          <section key={row.genreName} className="category-section" aria-label={row.genreName}>
            <h2 className="category-title">{row.genreName}</h2>
            {row.isSkeleton ? (
              <MovieRowSkeleton />
            ) : (
              <MovieRow movies={row.animes} title={row.genreName} onSelectMovie={onSelectMovie} />
            )}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="content-section">
      <div className="section anime-section" aria-busy={loading}>
        <h2 className="section-title">{title}</h2>
        {content}
      </div>
    </div>
  );
}

