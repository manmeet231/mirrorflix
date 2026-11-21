/**
 * Anime Data Service
 * Integrates AniList data with Streambert functionality
 */

import { fetchAniListAnime, categorizeAnime } from './anilistService.js';
import { hianimeSearch, hianimeEpisodes, hianimeStream } from '../streambert-browser-adapter.js';

// Map AniList anime to the format expected by MovieCard components
function mapAnimeToCardFormat(anime, streamData = null) {
  // Use bannerImage as poster when available, otherwise use coverImage
  const poster = anime.bannerImage || 
                 (anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium);
  
  // Use coverImage for thumbnail (smaller image)
  const thumbnail = anime.coverImage?.large || anime.coverImage?.medium;
  
  // Use coverImage for backdrop when bannerImage is not used as poster
  const backdrop = anime.bannerImage ? anime.bannerImage : anime.coverImage?.extraLarge;
  
  return {
    id: anime.id,
    malId: anime.idMal,
    title: anime.title.romaji || anime.title.english || anime.title.native,
    description: anime.description,
    poster: poster,
    thumbnail: thumbnail,
    backdrop: backdrop,
    genres: anime.genres,
    matchPercentage: anime.averageScore ? `${anime.averageScore}%` : null,
    ageRating: anime.isAdult ? '18+' : 'U/A',
    seasons: anime.episodes ? `${anime.episodes} Episodes` : null,
    year: anime.seasonYear,
    rating: anime.format,
    duration: anime.duration ? `${anime.duration} min` : null,
    status: anime.status,
    season: anime.season,
    seasonYear: anime.seasonYear,
    popularity: anime.popularity,
    nextAiringEpisode: anime.nextAiringEpisode,
    streamUrl: streamData?.masterUrl || null,
    episodes: streamData?.episodes || [],
    isAdult: anime.isAdult,
    synonyms: anime.synonyms,
    // Add the original image data for reference
    coverImage: anime.coverImage,
    bannerImage: anime.bannerImage
  };
}

// Get stream data from Streambert for a specific anime
async function getStreamData(animeTitle, episodeNumber = 1, mode = 'sub') {
  try {
    // Search for the anime on HiAnime
    const searchResults = await hianimeSearch(animeTitle);
    if (!searchResults.length) {
      console.log(`No stream found for ${animeTitle}`);
      return null;
    }

    // Use the first search result
    const show = searchResults[0];
    
    // Get episodes
    const episodes = await hianimeEpisodes(show.id);
    if (!episodes.length) {
      console.log(`No episodes found for ${animeTitle}`);
      return null;
    }

    // Find the requested episode
    const episode = episodes.find(ep => 
      parseFloat(ep.number) === episodeNumber || ep.number === String(episodeNumber)
    );

    if (!episode) {
      console.log(`Episode ${episodeNumber} not found for ${animeTitle}`);
      return null;
    }

    // Get stream URL
    const stream = await hianimeStream(episode.epId, mode);
    
    return {
      masterUrl: stream.masterUrl,
      referer: stream.referer,
      subtitle: stream.subtitle,
      resolution: stream.resolution,
      malId: stream.malId,
      episodes: episodes.map(ep => ({
        id: ep.epId,
        number: ep.number,
        title: `Episode ${ep.number}`
      }))
    };
  } catch (error) {
    console.error(`Error getting stream data for ${animeTitle}:`, error.message);
    return null;
  }
}

// Fetch anime with stream data
async function fetchAnimeWithStreams(options = {}, streamOptions = {}) {
  const { page = 1, perPage = 100 } = options;
  const { episodeNumber = 1, mode = 'sub' } = streamOptions;
  
  try {
    // Fetch anime from AniList
    const anilistData = await fetchAniListAnime({
      page,
      perPage,
      sort: ['TRENDING_DESC']
    });
    
    // Get anime list
    const animeList = anilistData.Page.media;
    
    // Process anime data and add stream information
    const processedAnime = [];
    
    for (const anime of animeList) {
      try {
        // Try to get stream data
        const streamData = await getStreamData(
          anime.title.romaji || anime.title.english, 
          episodeNumber, 
          mode
        );
        
        const mappedAnime = mapAnimeToCardFormat(anime, streamData);
        processedAnime.push(mappedAnime);
      } catch (error) {
        console.error(`Error processing anime ${anime.title.romaji}:`, error.message);
        // Add anime without stream data
        const mappedAnime = mapAnimeToCardFormat(anime);
        processedAnime.push(mappedAnime);
      }
    }
    
    return {
      anime: processedAnime,
      pageInfo: anilistData.Page.pageInfo
    };
  } catch (error) {
    console.error('Error fetching anime with streams:', error);
    throw error;
  }
}

// Get categorized anime data
async function getCategorizedAnime(options = {}, streamOptions = {}) {
  const animeData = await fetchAnimeWithStreams(options, streamOptions);
  const categories = categorizeAnime(animeData.anime);
  
  return {
    anime: animeData.anime,
    categories,
    pageInfo: animeData.pageInfo
  };
}

export { 
  fetchAnimeWithStreams, 
  getCategorizedAnime, 
  mapAnimeToCardFormat,
  getStreamData 
};