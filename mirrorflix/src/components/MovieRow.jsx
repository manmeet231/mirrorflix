import React, { useState, useRef, useEffect } from 'react';
import MovieCard from './MovieCard';
import './MovieRow.css';

const MovieRow = ({ movies, onSelectMovie, title, variant }) => {
  const isSearch = variant === 'search';
  const rowRef = useRef(null);
  const [isLeftVisible, setIsLeftVisible] = useState(false);
  const [isRightVisible, setIsRightVisible] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = row;
      setIsLeftVisible(scrollLeft > 0);
      setIsRightVisible(scrollLeft < scrollWidth - clientWidth - 1);
    };

    row.addEventListener('scroll', handleScroll);
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(handleScroll) : null;
    resize?.observe(row);
    handleScroll();

    return () => {
      row.removeEventListener('scroll', handleScroll);
      resize?.disconnect();
    };
  }, [movies.length]);

  const scrollLeft = () => {
    rowRef.current.scrollBy({ left: -300, behavior: isSearch ? 'auto' : 'smooth' });
  };

  const scrollRight = () => {
    rowRef.current.scrollBy({ left: 300, behavior: isSearch ? 'auto' : 'smooth' });
  };

  return (
    <div className={isSearch ? 'movie-row movie-row--search' : 'movie-row'}>
      <div className="movie-row-container">
        <button
          className={`scroll-btn scroll-left ${isLeftVisible ? 'visible' : ''}`}
          onClick={scrollLeft}
          aria-label={title ? `Scroll ${title} left` : 'Scroll left'}
          hidden={isSearch && !isLeftVisible}
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
            <MovieCard
              key={movie.id || index}
              movie={movie}
              variant={variant}
              onClick={() => onSelectMovie?.(movie)}
            />
          ))}
        </div>
        
        <button
          className={`scroll-btn scroll-right ${isRightVisible ? 'visible' : ''}`}
          onClick={scrollRight}
          aria-label={title ? `Scroll ${title} right` : 'Scroll right'}
          hidden={isSearch && !isRightVisible}
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
