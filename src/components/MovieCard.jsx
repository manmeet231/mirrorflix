
import React, { useRef, useState } from 'react';
import './MovieCard.css';

// Function to truncate title to 15 characters with dots
const truncateTitle = (title) => {
  if (!title) return '';
  if (title.length <= 30) return title;
  return title.substring(0, 30) + '..';
};

const MovieCard = ({
  movie,
  onClick,
  onPlay,
  onAddToList,
  onLike,
  onMore,
  variant
}) => {
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const visualButton = useRef(null);

  const openDetails = () => {
    if (!onClick) return;
    // The dialog restores focus here when it closes. Keep that focus from expanding the card.
    setPreviewCollapsed(true);
    onClick(movie);
  };

  const previewProps = {
    'data-preview-collapsed': previewCollapsed || undefined,
    onPointerMove: (event) => {
      if (previewCollapsed && event.pointerType !== 'touch') setPreviewCollapsed(false);
    },
    onKeyDown: () => {
      if (previewCollapsed) setPreviewCollapsed(false);
    },
    onBlur: (event) => {
      const next = event.relatedTarget;
      if (previewCollapsed && next && !event.currentTarget.contains(next) && !next.closest?.('.show-dialog')) {
        setPreviewCollapsed(false);
      }
    },
  };

  if (variant === 'search') {
    const image = movie.bannerImage || movie.thumbnail || movie.backdrop || movie.poster;
    return (
      <article className="movie-card movie-card--search" {...previewProps}>
        <button
          type="button"
          className="movie-card-search-button"
          onClick={openDetails}
          aria-label={`Show details for ${movie.title}`}
        >
          <span className="movie-card-search-thumbnail">
            {image ? (
              <img
                className={movie.bannerImage ? 'movie-poster' : 'movie-poster movie-poster--cover'}
                src={image}
                alt=""
                loading="lazy"
              />
            ) : (
              <span className="movie-card-search-placeholder" aria-hidden="true">{movie.title}</span>
            )}
          </span>
          <span className="movie-card-search-title">{movie.title}</span>
          {movie.year && <small>{movie.year}</small>}
        </button>
      </article>
    );
  }

  const truncatedTitle = truncateTitle(movie.title);

  const handlePlay = () => {
    if (onPlay) {
      onPlay(movie);
    } else if (onClick) {
      visualButton.current?.focus();
      openDetails();
    }
  };

  const handleAdd = () => {
    const next = !added;
    setAdded(next);
    onAddToList?.(movie, next);
  };

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    onLike?.(movie, next);
  };

  const match = movie.match ?? movie.matchPercentage;
  const rating = movie.ageRating ?? movie.rating;
  const seasons = movie.seasons;
  const quality = movie.quality;

  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : movie.genres
      ? [movie.genres]
      : [];

  return (
    <article className="movie-card" {...previewProps}>
      <div className="movie-card-expanded">

        {/* Movie Image */}
        <button
          type="button"
          className="movie-card-visual"
          ref={visualButton}
          onClick={openDetails}
          aria-label={`Show details for ${movie.title}`}
        >
          <img
            src={movie.backdrop || movie.poster}
            alt={movie.title}
            className="movie-poster"
          />
        </button>

        {/* Expandable Footer */}
        <div className="movie-footer">

          {/* Action Buttons */}
          <div className="movie-actions">

            <button
              type="button"
              className="action-button play-button"
              onClick={handlePlay}
              aria-label="Play"
              title="Play"
            >
              <span>▶</span>
            </button>

            <button
              type="button"
              className={`action-button ${added ? 'active' : ''}`}
              onClick={handleAdd}
              aria-label={added ? 'Remove from list' : 'Add to list'}
              title={added ? 'Remove from list' : 'Add to list'}
            >
              {added ? '✓' : '+'}
            </button>

            <button
              type="button"
              className={`action-button ${liked ? 'active' : ''}`}
              onClick={handleLike}
              aria-label={liked ? 'Unlike' : 'Like'}
              title={liked ? 'Unlike' : 'Like'}
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 10v11H4V10h3z" />
                <path d="M7 10l5-7c2 0 3 2 2 4l-1 3h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 2H7" />
              </svg>
            </button>

           <button
  type="button"
  className="action-button more-button"
  onClick={() => onMore?.(movie)}
  aria-label="More information"
  title="More information"
>
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
</button>

          </div>

          {/* Movie Metadata */}
          <div className="movie-metadata">

            <div className="movie-meta-top">

              <h3 className="movie-title">{truncatedTitle}</h3>

              {match != null && (
                <span className="match-percentage">
                  {String(match).replace(/%?\s*match$/i, '').replace(/%$/, '')}% match
                </span>
              )}

              {rating && (
                <span className="age-rating">
                  {rating}
                </span>
              )}

              {seasons != null && (
                <span className="season-info">
                  {seasons} {Number(seasons) === 1 ? 'Season' : 'Seasons'}
                </span>
              )}

              {movie.duration && seasons == null && (
                <span className="season-info">
                  {movie.duration}
                </span>
              )}

              {quality && (
                <span className="quality-badge">
                  {quality}
                </span>
              )}

            </div>

            {/* Genres */}
            {genres.length > 0 && (
              <div className="movie-genres">
                {genres.map((genre, index) => (
                  <span key={`${genre}-${index}`} className="genre-item">
                    {genre}
                  </span>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </article>
  );
};

export default MovieCard;
