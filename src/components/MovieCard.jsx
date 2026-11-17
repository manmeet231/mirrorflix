import React from 'react';
import './MovieCard.css';

const MovieCard = ({ movie, onClick }) => {
  return (
    <button type="button" className="movie-card" onClick={onClick} aria-label={`Show details for ${movie.title}`} style={{ border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}>
      <img
        src={movie.poster}
        alt={movie.title}
        className="movie-poster"
      />
    </button>
  );
};

export default MovieCard;
