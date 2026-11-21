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

<<<<<<< HEAD
  // Apply z-index fix when component mounts and when category sections are available
  useEffect(() => {
    if (!loading && !error && animeData) {
      // Apply the fix after a short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        applyZIndexFix();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [loading, error, animeData]);

  // Get all unique genres from anime data
  const getAllGenres = () => {
    if (!animeData?.anime) return [];
    const genreSet = new Set();
    animeData.anime.forEach(anime => {
      if (anime.genres && Array.isArray(anime.genres)) {
        anime.genres.forEach(genre => genreSet.add(genre));
      }
    });
    return Array.from(genreSet).sort();
  };

  const allGenres = getAllGenres();
  

  
  // Define the order: Currently Airing first, then all genres
  const categoryOrder = ['Currently Airing', ...allGenres];



  // Render all category rows (Currently Airing + all genres)
  const renderAllCategoryRows = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading anime data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      );
    }

    if (!animeData?.anime?.length) {
      return <p className="catalog-state">No anime has been added to the catalog yet.</p>;
    }

    // Track which anime have been assigned to avoid duplication
    const assignedAnime = new Set();
    
    return (
=======
  let content;
  if (error) {
    content = <div className="error-state"><p className="error-message">{error}</p></div>;
  } else if (displayRows.length === 0) {
    content = <div className="empty-state"><p>No anime data available for the selected genres.</p></div>;
  } else {
    content = (
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
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
<<<<<<< HEAD
};

export default CategorizedAnimeSection;
=======
}
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
