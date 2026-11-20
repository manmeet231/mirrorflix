/**
 * Database API Service
 * Fetches anime data from the MirrorFlix database API (port 8001)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://103.235.105.231:8001';

/**
 * Fetch all genres with their anime from the database
 * @returns {Promise<Array>} Array of genre objects: [{id, name, animes: [...]}]
 */
export async function fetchGenresFromDB() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/genres`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching genres from database:', error);
    throw error;
  }
}

/**
 * Fetch a specific genre by name
 * @param {string} genreName - Name of the genre
 * @returns {Promise<Object>} Genre object with animes
 */
export async function fetchGenreByName(genreName) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/genres/${encodeURIComponent(genreName)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching genre ${genreName}:`, error);
    throw error;
  }
}

/**
 * Get anime for specific genres, limited to 30 per genre, with cross-genre deduplication
 * @param {string[]} targetGenres - Array of genre names to fetch
 * @param {number} limitPerGenre - Max anime per genre (default: 30)
 * @returns {Promise<Array>} Array of {genreName, animes: [...]} for genres with 30+ anime
 */
export async function fetchGenreRows(targetGenres, limitPerGenre = 30) {
  try {
    console.log('fetchGenreRows: Fetching genres from DB...', { targetGenres, limitPerGenre });
    
    // Fetch all genres from database
    const allGenres = await fetchGenresFromDB();
    
    console.log('fetchGenreRows: All genres from DB:', allGenres.map(g => ({ name: g.name, count: (g.animes || []).length })));

    // Create a map for quick lookup (case-sensitive)
    const genreMap = {};
    allGenres.forEach(genre => {
      genreMap[genre.name] = genre.animes || [];
    });

    console.log('fetchGenreRows: Genre map keys:', Object.keys(genreMap));

    // Track assigned anime IDs for deduplication
    const assignedAnimeIds = new Set();
    const genreRows = [];

    for (const genreName of targetGenres) {
      const genreAnimes = genreMap[genreName] || [];
      
      console.log(`fetchGenreRows: Genre "${genreName}" has ${genreAnimes.length} anime before dedup`);
      
      // Filter out already assigned anime, take up to limit
      const filteredAnimes = genreAnimes
        .filter(anime => anime.id && !assignedAnimeIds.has(anime.id))
        .slice(0, limitPerGenre);
      
      console.log(`fetchGenreRows: Genre "${genreName}" has ${filteredAnimes.length} anime after dedup (need ${limitPerGenre})`);
      
      // Only include genre if it has 30+ anime after deduplication
      if (filteredAnimes.length >= limitPerGenre) {
        filteredAnimes.forEach(anime => assignedAnimeIds.add(anime.id));
        genreRows.push({
          genreName,
          animes: filteredAnimes
        });
      }
    }

    console.log('fetchGenreRows: Final genreRows:', genreRows.map(r => ({ name: r.genreName, count: r.animes.length })));
    return genreRows;
  } catch (error) {
    console.error('Error fetching genre rows:', error);
    throw error;
  }
}

export default {
  fetchGenresFromDB,
  fetchGenreByName,
  fetchGenreRows
};