import { useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import AnimeSearchResults from './components/AnimeSearchResults';
import HeroSection from './components/HeroSection';
import CategorizedAnimeSection from './components/CategorizedAnimeSection';
import Footer from './components/Footer';
import MovieModal from './components/MovieModal';
import { fetchGenreRows } from './components/dbApiService';
import { GENRE_ROW_LIMIT, TARGET_GENRES } from './catalogConfig';
import { featuredShows } from './featuredShows';
import './App.css';

function normalizeMovie(movie) {
  return {
    ...movie,
    synopsis: movie.synopsis || movie.description,
    genres: Array.isArray(movie.genres) ? movie.genres.join(', ') : movie.genres,
  };
}

export default function App() {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [genreRows, setGenreRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const query = searchQuery.trim();
  const isSearching = query.length > 0;
  const catalog = useMemo(() => genreRows.flatMap((row) => row.animes), [genreRows]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalog() {
      try {
        setLoading(true);
        setError(null);
        const rows = await fetchGenreRows(TARGET_GENRES, GENRE_ROW_LIMIT, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setGenreRows(rows);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        console.error('Error fetching anime data:', requestError);
        setError('Failed to load anime data. Please try again later.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCatalog();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (isSearching) window.scrollTo(0, 0);
  }, [isSearching]);

  return (
    <div className="app">
      <Navbar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <main>
        {isSearching ? (
          <AnimeSearchResults
            key={query}
            query={query}
            catalog={catalog}
            onSelectMovie={(movie) => setSelectedMovie(normalizeMovie(movie))}
          />
        ) : (
          <>
            <HeroSection featuredShows={featuredShows} />
            <CategorizedAnimeSection
              title="Browse Anime"
              genreRows={genreRows}
              onSelectMovie={(movie) => setSelectedMovie(normalizeMovie(movie))}
              loading={loading}
              error={error}
            />
          </>
        )}
      </main>

      <MovieModal
        movie={selectedMovie}
        showType={selectedMovie?.mediaType || 'series'}
        isOpen={Boolean(selectedMovie)}
        onClose={() => setSelectedMovie(null)}
      />
      <Footer />
    </div>
  );
}

