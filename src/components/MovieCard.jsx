
import React, { useState } from 'react';
import './MovieCard.css';

const MovieCard = ({
  movie,
  onClick,
  onPlay,
  onAddToList,
  onLike,
  onMore
}) => {
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);

  const handlePlay = () => {
    if (onPlay) {
      onPlay(movie);
    } else if (onClick) {
      onClick(movie);
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
    <article className="movie-card">
      <div className="movie-card-expanded">

        {/* Movie Image */}
        <button
          type="button"
          className="movie-card-visual"
          onClick={() => onClick?.(movie)}
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
