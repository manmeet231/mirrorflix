import React, { useState, useEffect } from 'react';
import MovieRow from './MovieRow';
import MovieCard from './MovieCard';
import './ContentSection.css';

const CategorizedAnimeSection = ({ 
  title = "Browse Anime", 
  animeData = null, 
  onSelectMovie,
  loading = false,
  error = null
}) => {
  const [activeCategory, setActiveCategory] = useState('Currently Airing');
  const [categories, setCategories] = useState({});
  
  useEffect(() => {
    if (animeData && animeData.categories) {
      setCategories(animeData.categories);
    }
  }, [animeData]);

  // Get all unique genres from anime data
  const getAllGenres = () => {
    if (!animeData?.anime) return [];
    const genreSet = new Set();
    animeData.anime.forEach(anime => {
      if (anime.genres && Array.isArray(anime.genres)) {
        anime.genres.forEach(genre => genreSet.add(genre));
      }
    });
    return Array.from(genreSet).sort();
  };

  const allGenres = getAllGenres();
  

  
  // Define the order: Currently Airing first, then all genres
  const categoryOrder = ['Currently Airing', ...allGenres];



  // Render all category rows (Currently Airing + all genres)
  const renderAllCategoryRows = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading anime data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-state">
          <p className="error-message">{error}</p>
        </div>
      );
    }

    // Track which anime have been assigned to avoid duplication
    const assignedAnime = new Set();
    
    return (
      <div className="all-categories">
        {categoryOrder.map((categoryName) => {
          let animeForCategory = [];
          
          // Get anime for this category
          if (categoryName === 'Currently Airing') {
            animeForCategory = categories['Currently Airing'] || [];
          } else if (allGenres.includes(categoryName)) {
            animeForCategory = animeData?.anime?.filter(anime => 
              anime.genres && anime.genres.includes(categoryName)
            ) || [];
          }
          
          // Filter out anime that have already been assigned to previous categories
          const filteredAnime = animeForCategory.filter(anime => {
            if (assignedAnime.has(anime.id)) {
              return false; // Anime already assigned to a previous category
            }
            assignedAnime.add(anime.id);
            return true;
          });
          
          if (!filteredAnime || filteredAnime.length === 0) {
            return null; // Skip empty categories
          }
          
          return (
            <div key={categoryName} className="category-section">
              <h2 className="category-title">{categoryName}</h2>
              <MovieRow 
                movies={filteredAnime} 
                onSelectMovie={onSelectMovie}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="content-section">
      <div className="section anime-section">
        <h2 className="section-title">Browse Anime</h2>
        
        {renderAllCategoryRows()}
      </div>
    </div>
  );
};

export default CategorizedAnimeSection;