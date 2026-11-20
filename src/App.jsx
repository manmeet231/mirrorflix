import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AnimeSearchResults from './components/AnimeSearchResults';
import HeroSection from './components/HeroSection';
import CategorizedAnimeSection from './components/CategorizedAnimeSection';
import Footer from './components/Footer';
import MovieModal from './components/MovieModal';
import { fetchGenreRows } from './components/dbApiService';
import './App.css';

const App = () => {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [genreRows, setGenreRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const query = searchQuery.trim();
  const isSearching = query.length > 0;
  
  // Target genres to display (must have 30+ anime each)
  const TARGET_GENRES = [
    'Action',
    'Drama',
    'Adventure',
    'Comedy',
    'Romance',
    'Fantasy',
    'Slice of Life',
    'Mystery'
  ];

  // Featured shows for carousel
  const featuredShows = [
    {
      id: 1,
      title: "Stranger Things",
      description: "When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.",
      backgroundImage: "src/assets/strangerthings.jpg"
    },
    {
      id: 2,
      title: "The Crown",
      description: "Follow the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the 20th century.",
      backgroundImage: "src/assets/thecrown.jpg"
    },
    {
      id: 3,
      title: "Bridgerton",
      description: "In Regency London during the social season, ambitious young women and their mothers seek to capture the attention of eligible bachelors.",
      backgroundImage: "src/assets/bridgerton.jpg"
    },
    {
      id: 4,
      title: "The Witcher",
      description: "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
      backgroundImage: "src/assets/thewitcher.jpg"
    },
    {
      id: 5,
      title: "Money Heist",
      description: "A group of robbers carry out a sophisticated heist on the Royal Mint of Spain, under the leadership of the mysterious Professor.",
      backgroundImage: "src/assets/moneyheist.jpg"
    }
  ];
  


  // Fetch anime data on component mount
  useEffect(() => {
    const fetchAnimeData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch genre rows from database API (30 anime per genre, deduplicated)
        const rows = await fetchGenreRows(TARGET_GENRES, 30);
        
        console.log('App.jsx: Received genreRows:', rows.map(r => ({ name: r.genreName, count: r.animes.length })));

        setGenreRows(rows);
      } catch (err) {
        console.error('Error fetching anime data:', err);
        setError('Failed to load anime data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAnimeData();
  }, []);
  
  useEffect(() => {
    if (isSearching) window.scrollTo(0, 0);
  }, [isSearching]);

  // Handle movie selection
  const handleSelectMovie = (movie) => {
    setSelectedMovie(movie);
  };

  // Handle movie modal close
  const handleCloseModal = () => {
    setSelectedMovie(null);
  };

  return (
    <div className="app">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <main>
        {isSearching ? (
          <AnimeSearchResults
            key={query}
            query={query}
            catalog={genreRows.flatMap(r => r.animes)}
            onSelectMovie={handleSelectMovie}
          />
        ) : (
          <>
            <HeroSection featuredShows={featuredShows} />
            {/* Dynamic categorized anime section from database */}
            <CategorizedAnimeSection
              title="Browse Anime"
              genreRows={genreRows}
              onSelectMovie={handleSelectMovie}
              loading={loading}
              error={error}
            />
          </>
        )}
      </main>
      
      {/* Movie Modal */}
      <MovieModal 
        movie={selectedMovie} 
        showType={selectedMovie?.mediaType || 'series'}
        isOpen={Boolean(selectedMovie)} 
        onClose={handleCloseModal} 
      />
      
      <Footer />
    </div>
  );
};
export default App;
