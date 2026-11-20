import React, { useState, useEffect } from 'react';
import MovieRow from './MovieRow';
import MovieCard from './MovieCard';
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

  // Apply z-index fix when component mounts and when category sections are available
  useEffect(() => {
    if (!loading && !error && animeData) {
      // Apply the fix after a short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        applyZIndexFix();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [loading, error, animeData]);

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

    if (!animeData?.anime?.length) {
      return <p className="catalog-state">No anime has been added to the catalog yet.</p>;
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
