import React from 'react';
import MovieRow from './MovieRow';
import './ContentSection.css';

const ContentSection = ({ 
  title = "Featured Content", 
  movies = [], 
  sectionType = "anime",
  onSelectMovie 
}) => {
  const sectionClass = `${sectionType}-section`;
  
  return (
    <div className="content-section">
      <div className={`section ${sectionClass}`}>
        <h2 className="section-title">{title}</h2>
        {movies.length > 0 && (
          <MovieRow movies={movies} onSelectMovie={onSelectMovie} />
        )}
      </div>
    </div>
  );
};

export default ContentSection;