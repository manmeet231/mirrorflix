import React from 'react';
import MovieRow from './MovieRow';
import { animeShow } from './animeData';
import './ContentSection.css';

const ContentSection = ({ onSelectMovie }) => {
  return (
    <div className="content-section">
      <div className="section anime-section">
        <h2 className="section-title">Anime Series</h2>
        <MovieRow movies={[animeShow]} onSelectMovie={onSelectMovie} />
      </div>
    </div>
  );
};

export default ContentSection;