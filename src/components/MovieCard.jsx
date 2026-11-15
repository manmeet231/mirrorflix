import React from 'react';
import './MovieCard.css';

const MovieCard = ({ movie }) => {
  return (
    <div className="movie-card">
      <img
        src={movie.poster}
        alt={movie.title}
        className="movie-poster"
      />
    </div>
  );
};

export default MovieCard;
