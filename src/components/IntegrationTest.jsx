import React, { useState, useEffect } from 'react';
import { getCategorizedAnime } from './animeDataService';
import './IntegrationTest.css';

const IntegrationTest = () => {
  const [animeData, setAnimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching anime data...');
        const data = await getCategorizedAnime(
          { page: 1, perPage: 5 }, 
          { episodeNumber: 1, mode: 'sub' }
        );
        
        console.log('Anime data received:', data);
        setAnimeData(data);
      } catch (err) {
        console.error('Error fetching anime data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="integration-test">
        <h2>Integration Test</h2>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading anime data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="integration-test">
        <h2>Integration Test</h2>
        <div className="error-state">
          <p className="error-message">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!animeData) {
    return (
      <div className="integration-test">
        <h2>Integration Test</h2>
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="integration-test">
      <h2>Integration Test Results</h2>
      
      <div className="test-summary">
        <h3>Summary</h3>
        <p>Total anime: {animeData.anime.length}</p>
        <p>Categories: {Object.keys(animeData.categories).length}</p>
      </div>

      <div className="categories-test">
        <h3>Categories</h3>
        <ul>
          {Object.keys(animeData.categories).map(category => (
            <li key={category}>
              {category}: {Array.isArray(animeData.categories[category]) 
                ? animeData.categories[category].length 
                : Object.keys(animeData.categories[category]).length} items
            </li>
          ))}
        </ul>
      </div>

      <div className="anime-preview">
        <h3>First 3 Anime</h3>
        <div className="anime-list">
          {animeData.anime.slice(0, 3).map(anime => (
            <div key={anime.id} className="anime-item">
              <h4>{anime.title}</h4>
              <p>Genres: {anime.genres?.join(', ') || 'N/A'}</p>
              <p>Status: {anime.status || 'N/A'}</p>
              <p>Stream URL: {anime.streamUrl ? 'Available' : 'Not available'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntegrationTest;