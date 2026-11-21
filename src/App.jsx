<<<<<<< HEAD
import React, { useEffect, useMemo, useState } from 'react';
=======
import { useEffect, useMemo, useState } from 'react';
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
import Navbar from './components/Navbar';
import AnimeSearchResults from './components/AnimeSearchResults';
import HeroSection from './components/HeroSection';
import CategorizedAnimeSection from './components/CategorizedAnimeSection';
import ContentSection from './components/ContentSection';
import Footer from './components/Footer';
import MovieModal from './components/MovieModal';
<<<<<<< HEAD
import { fetchAnime, fetchFeaturedMovies, fetchMovies } from './services/api';
import bridgertonImage from './assets/bridgerton.jpg';
import moneyHeistImage from './assets/moneyheist.jpg';
import strangerThingsImage from './assets/strangerthings.jpg';
import theCrownImage from './assets/thecrown.jpg';
import theWitcherImage from './assets/thewitcher.jpg';
import './App.css';

const fallbackFeaturedShows = [
  {
    id: 'fallback-stranger-things',
    title: 'Stranger Things',
    description: 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.',
    backgroundImage: strangerThingsImage,
  },
  {
    id: 'fallback-the-crown',
    title: 'The Crown',
    description: "Follow the political rivalries and romance of Queen Elizabeth II's reign and the events that shaped the second half of the 20th century.",
    backgroundImage: theCrownImage,
  },
  {
    id: 'fallback-bridgerton',
    title: 'Bridgerton',
    description: 'In Regency London during the social season, ambitious young women and their mothers seek to capture the attention of eligible bachelors.',
    backgroundImage: bridgertonImage,
  },
  {
    id: 'fallback-the-witcher',
    title: 'The Witcher',
    description: 'Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.',
    backgroundImage: theWitcherImage,
  },
  {
    id: 'fallback-money-heist',
    title: 'Money Heist',
    description: 'A group of robbers carry out a sophisticated heist on the Royal Mint of Spain, under the leadership of the mysterious Professor.',
    backgroundImage: moneyHeistImage,
  },
];

function normalizeFeaturedShow(movie) {
  return {
    ...movie,
    backgroundImage: movie.backgroundImage || movie.backdrop || movie.poster || movie.posterUrl,
    contentType: 'movie',
  };
}

function normalizeAnime(item, index) {
  const titleValue = item.title;
  const title = typeof titleValue === 'string'
    ? titleValue
    : titleValue?.english || titleValue?.romaji || titleValue?.native || item.name || `Anime ${index + 1}`;
  const poster = item.poster || item.posterUrl || item.poster_url ||
    item.coverImage?.extraLarge || item.coverImage?.large || item.coverImage?.medium ||
    item.cover_image?.extraLarge || item.cover_image?.large;
  const backdrop = item.backdrop || item.backdropUrl || item.bannerImage || item.banner_image || poster;
  const rawGenres = Array.isArray(item.genres) ? item.genres : (item.genre ? [item.genre] : []);
  const genres = [...new Set(rawGenres.filter((genre) => typeof genre === 'string' && genre.trim()))];

  return {
    ...item,
    id: item.id ?? item.malId ?? item.mal_id ?? `anime-${index}`,
    title,
    description: item.description || item.synopsis || '',
    synopsis: item.synopsis || item.description || '',
    poster,
    thumbnail: item.thumbnail || poster,
    backdrop,
    year: item.year || item.seasonYear || item.release_year || item.startDate?.year || null,
    matchPercentage: item.matchPercentage || (item.averageScore ? `${item.averageScore}%` : null),
    seasons: item.seasons || (item.episodes ? `${item.episodes} Episodes` : null),
    rating: item.rating || item.format || null,
    genres,
    episodes: Array.isArray(item.episodes) ? item.episodes : [],
    contentType: 'series',
  };
}

function createAnimeCatalog(items) {
  const anime = items.map(normalizeAnime);
  return {
    anime,
    categories: {
      'Currently Airing': anime.filter((item) => item.status === 'RELEASING'),
    },
  };
}

function App() {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [featuredShows, setFeaturedShows] = useState(fallbackFeaturedShows);
  const [featuredNotice, setFeaturedNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [movies, setMovies] = useState([]);
  const [movieLoading, setMovieLoading] = useState(true);
  const [movieError, setMovieError] = useState(null);
  const [animeData, setAnimeData] = useState({ anime: [], categories: {} });
  const [animeLoading, setAnimeLoading] = useState(true);
  const [animeError, setAnimeError] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      const [featuredResult, animeResult] = await Promise.allSettled([
        fetchFeaturedMovies({ limit: 10 }),
        fetchAnime({ limit: 100, offset: 0 }),
      ]);

      if (!active) return;

      if (featuredResult.status === 'fulfilled' && Array.isArray(featuredResult.value) && featuredResult.value.length > 0) {
        setFeaturedShows(featuredResult.value.map(normalizeFeaturedShow));
        setFeaturedNotice('');
      } else if (featuredResult.status === 'rejected') {
        setFeaturedNotice('The featured catalog is unavailable. Showing the built-in preview titles.');
      } else {
        setFeaturedShows(fallbackFeaturedShows);
        setFeaturedNotice('No featured titles are in the catalog yet. Showing the built-in preview titles.');
      }

      if (animeResult.status === 'fulfilled') {
        const payload = animeResult.value;
        setAnimeData(createAnimeCatalog(Array.isArray(payload) ? payload : (payload?.items || [])));
        setAnimeError(null);
      } else {
        setAnimeData({ anime: [], categories: {} });
        setAnimeError('Anime content could not be loaded. Please try again later.');
      }
      setAnimeLoading(false);
    }

    loadCatalog();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setMovieLoading(true);
    setMovieError(null);

    fetchMovies({ limit: 100, offset: 0, sort: 'recent', search: searchQuery })
      .then((payload) => {
        if (!active) return;
        setMovies(Array.isArray(payload) ? payload : (payload?.items || []));
      })
      .catch(() => {
        if (!active) return;
        setMovies([]);
        setMovieError('Movie content could not be loaded. Please try again later.');
      })
      .finally(() => {
        if (active) setMovieLoading(false);
      });

    return () => { active = false; };
  }, [searchQuery]);

  const movieRows = useMemo(() => {
    const groups = new Map();
    for (const movie of movies) {
      const category = movie.category || movie.genres?.[0] || 'Other Movies';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(movie);
    }
    return [...groups.entries()].map(([title, items]) => ({ title, movies: items }));
  }, [movies]);

  const handleSelectMovie = (movie) => setSelectedMovie(movie);
  const handleCloseModal = () => setSelectedMovie(null);

  return (
    <div className="app">
      <Navbar onSearch={setSearchQuery} />
      <main>
        <HeroSection featuredShows={featuredShows} onSelectMovie={handleSelectMovie} />
        {featuredNotice && <p className="catalog-notice" role="status">{featuredNotice}</p>}

        <ContentSection
          title={searchQuery ? `Search results for “${searchQuery}”` : 'Movies'}
          sectionType="movies"
          movies={movies}
          onSelectMovie={handleSelectMovie}
          loading={movieLoading}
          error={movieError}
          emptyMessage={searchQuery ? `No movie titles match “${searchQuery}”.` : 'No movies have been added to the catalog yet.'}
        />
        {!searchQuery && movieRows.map((row) => (
          <ContentSection
            key={row.title}
            title={row.title}
            sectionType="movies"
            movies={row.movies}
            onSelectMovie={handleSelectMovie}
          />
        ))}

        <CategorizedAnimeSection
          title="Browse Anime"
          animeData={animeData}
          onSelectMovie={handleSelectMovie}
          loading={animeLoading}
          error={animeError}
        />
=======
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
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
      </main>

      <MovieModal
        movie={selectedMovie}
<<<<<<< HEAD
        isOpen={Boolean(selectedMovie)}
        onClose={handleCloseModal}
        showType={selectedMovie?.contentType === 'movie' ? 'movie' : 'series'}
      />

=======
        showType={selectedMovie?.mediaType || 'series'}
        isOpen={Boolean(selectedMovie)}
        onClose={() => setSelectedMovie(null)}
      />
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
      <Footer />
    </div>
  );
}
<<<<<<< HEAD

export default App;
=======
>>>>>>> fa6fa660e2d653b219e6a06e304453857ed1f23d
