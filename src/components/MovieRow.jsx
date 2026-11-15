import React, { useState, useRef, useEffect } from 'react';
import MovieCard from './MovieCard';
import './MovieRow.css';

const MovieRow = ({ title, movies }) => {
  const rowRef = useRef(null);
  const [isLeftVisible, setIsLeftVisible] = useState(false);
  const [isRightVisible, setIsRightVisible] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = row;
      setIsLeftVisible(scrollLeft > 0);
      setIsRightVisible(scrollLeft < scrollWidth - clientWidth);
    };

    row.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => row.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollLeft = () => {
    rowRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    rowRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  };

  return (
    <div className="movie-row">
      <h2 className="category-title">{title}</h2>
      <div className="movie-row-container">
        <button
          className={`scroll-btn scroll-left ${isLeftVisible ? 'visible' : ''}`}
          onClick={scrollLeft}
          aria-label="Scroll left"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
        </button>
        
        <div className="movie-row-posters" ref={rowRef}>
          {movies.map((movie, index) => (
            <MovieCard key={index} movie={movie} />
          ))}
        </div>
        
        <button
          className={`scroll-btn scroll-right ${isRightVisible ? 'visible' : ''}`}
          onClick={scrollRight}
          aria-label="Scroll right"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MovieRow;
