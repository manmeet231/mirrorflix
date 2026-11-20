import React from 'react';
import MovieRow from './MovieRow';
import './ContentSection.css';

const ContentSection = ({ 
  title = "Featured Content", 
  movies = [], 
  sectionType = "anime",
  onSelectMovie,
  loading = false,
  error = null,
  emptyMessage = 'No content is available yet.',
}) => {
  const sectionClass = `${sectionType}-section`;
  
  return (
    <div className="content-section">
      <div className={`section ${sectionClass}`}>
        <h2 className="section-title">{title}</h2>
        {loading && <p className="catalog-state" role="status">Loading {title.toLowerCase()}…</p>}
        {!loading && error && <p className="catalog-state catalog-error" role="alert">{error}</p>}
        {!loading && !error && movies.length > 0 && (
          <MovieRow movies={movies} onSelectMovie={onSelectMovie} />
        )}
        {!loading && !error && movies.length === 0 && (
          <p className="catalog-state">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
};

export default ContentSection;
