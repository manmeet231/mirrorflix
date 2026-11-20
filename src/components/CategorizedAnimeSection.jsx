import React, { useState, useEffect } from 'react';
import MovieRow from './MovieRow';
import './ContentSection.css';

// Apply z-index fix dynamically
const applyZIndexFix = () => {
  const styleId = 'injected-z-index-fix';
  let styleElement = document.getElementById(styleId);

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = `
    .category-section {
      position: relative !important;
      z-index: 1 !important;
      isolation: auto !important;
      transition: transform 0.3s ease, box-shadow 0.3s ease !important;
      overflow: visible !important;
    }

    .category-section:hover,
    .category-section:has(.movie-card:hover),
    .category-section:has(.movie-card.expanded) {
      z-index: 9999 !important;
      transform: translateY(-10px) !important;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.8) !important;
    }

    .category-section .movie-row-posters {
      overflow: visible !important;
      z-index: 1 !important;
    }

    .category-section .scroll-btn {
      z-index: 10000 !important;
    }
  `;

  const sections = document.querySelectorAll('.category-section');
  const data = {
    count: sections.length,
    applied: true,
    currentStyles: Array.from(sections).map(s => ({
      title: s.querySelector('h2')?.textContent,
      zIndex: window.getComputedStyle(s).zIndex,
      position: window.getComputedStyle(s).position
    }))
  };

  console.log('Z-index fix applied:', data);
};

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
        {Array.from({ length: 30 }).map((_, i) => (
          <MovieCardSkeleton key={i} />
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

const CategorizedAnimeSection = ({ 
  title = "Browse Anime", 
  genreRows = [],
  onSelectMovie,
  loading = false,
  error = null
}) => {
  const [displayRows, setDisplayRows] = useState([]);
  
  // Apply z-index fix when loading completes
  useEffect(() => {
    if (!loading && !error) {
      const timer = setTimeout(() => {
        applyZIndexFix();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, error]); // Removed displayRows from deps

  // Update display rows when genreRows or loading changes
  useEffect(() => {
    if (loading) {
      const targetGenres = [
        'Action',
        'Drama',
        'Adventure',
        'Comedy',
        'Romance',
        'Fantasy',
        'Slice of Life',
        'Mystery'
      ];
      const newRows = targetGenres.map(name => ({ genreName: name, animes: [], isSkeleton: true }));
      setDisplayRows(prev => {
        // Only update if different to prevent unnecessary renders
        if (prev.length !== newRows.length) return newRows;
        return prev.every((p, i) => p.genreName === newRows[i].genreName && p.isSkeleton === newRows[i].isSkeleton) ? prev : newRows;
      });
    } else {
      const newRows = genreRows.map(row => ({ ...row, isSkeleton: false }));
      setDisplayRows(prev => {
        if (prev.length !== newRows.length) return newRows;
        return prev.every((p, i) => p.genreName === newRows[i].genreName && p.isSkeleton === newRows[i].isSkeleton) ? prev : newRows;
      });
    }
  }, [genreRows, loading]);

  const renderCategoryRows = () => {
    if (error) {
      return <div className="error-state"><p className="error-message">{error}</p></div>;
    }
    if (displayRows.length === 0) {
      return <div className="empty-state"><p>No anime data available for the selected genres.</p></div>;
    }
    return (
      <div className="all-categories">
        {displayRows.map((row) => (
          <div key={row.genreName} className="category-section">
            <h2 className="category-title">{row.genreName}</h2>
            {row.isSkeleton ? <MovieRowSkeleton /> : <MovieRow movies={row.animes} onSelectMovie={onSelectMovie} />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="content-section">
      <div className="section anime-section">
        <h2 className="section-title">Browse Anime</h2>
        {renderCategoryRows()}
      </div>
    </div>
  );
};

export default CategorizedAnimeSection;
