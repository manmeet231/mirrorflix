import React, { useState, useEffect } from 'react';
import MovieRow from './MovieRow';
import MovieCard from './MovieCard';
import './ContentSection.css';

const CategorizedAnimeSection = ({ 
  title = "Anime Categories", 
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

  // Get available category names
  const categoryNames = Object.keys(categories).filter(key => 
    key !== 'Genres' && key !== 'Seasons' && key !== 'Years'
  );

  // Get anime for the active category
  const getAnimeForCategory = (categoryName) => {
    if (categoryName === 'Genres' || categoryName === 'Seasons' || categoryName === 'Years') {
      // For dynamic categories, return all anime that belong to this category
      return animeData?.anime || [];
    }
    return categories[categoryName] || [];
  };

  // Get specific category items (for genres, seasons, years)
  const getSpecificCategoryItems = (categoryType) => {
    const category = categories[categoryType];
    if (!category) return [];
    
    return Object.entries(category).map(([name, anime]) => ({
      name,
      anime,
      count: anime.length
    }));
  };

  // Render category tabs
  const renderCategoryTabs = () => {
    if (!categories || Object.keys(categories).length === 0) {
      return null;
    }

    return (
      <div className="category-tabs">
        <div className="category-tabs-primary">
          {categoryNames.map(categoryName => (
            <button
              key={categoryName}
              className={`category-tab ${activeCategory === categoryName ? 'active' : ''}`}
              onClick={() => setActiveCategory(categoryName)}
            >
              {categoryName}
            </button>
          ))}
        </div>
        
        {activeCategory === 'Genres' && (
          <div className="category-subtabs">
            {getSpecificCategoryItems('Genres').map(item => (
              <button
                key={item.name}
                className={`subtab ${activeCategory === item.name ? 'active' : ''}`}
                onClick={() => setActiveCategory(item.name)}
              >
                {item.name} ({item.count})
              </button>
            ))}
          </div>
        )}
        
        {activeCategory === 'Seasons' && (
          <div className="category-subtabs">
            {getSpecificCategoryItems('Seasons').map(item => (
              <button
                key={item.name}
                className={`subtab ${activeCategory === item.name ? 'active' : ''}`}
                onClick={() => setActiveCategory(item.name)}
              >
                {item.name} ({item.count})
              </button>
            ))}
          </div>
        )}
        
        {activeCategory === 'Years' && (
          <div className="category-subtabs">
            {getSpecificCategoryItems('Years').map(item => (
              <button
                key={item.name}
                className={`subtab ${activeCategory === item.name ? 'active' : ''}`}
                onClick={() => setActiveCategory(item.name)}
              >
                {item.name} ({item.count})
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render category content
  const renderCategoryContent = () => {
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

    const animeForCategory = getAnimeForCategory(activeCategory);
    
    if (!animeForCategory || animeForCategory.length === 0) {
      return (
        <div className="empty-state">
          <p>No anime found in this category.</p>
        </div>
      );
    }

    return (
      <div className="category-content">
        <MovieRow 
          title={activeCategory} 
          movies={animeForCategory} 
          onSelectMovie={onSelectMovie}
        />
      </div>
    );
  };

  return (
    <div className="content-section">
      <div className="section anime-section">
        <h2 className="section-title">{title}</h2>
        
        {renderCategoryTabs()}
        {renderCategoryContent()}
      </div>
    </div>
  );
};

export default CategorizedAnimeSection;