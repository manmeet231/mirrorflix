/**
 * AniList Service
 * Handles fetching anime data from AniList API
 */

const ANILIST_API = 'https://graphql.anilist.co';

// GraphQL query for fetching anime
const ANIME_QUERY = `
  query($page: Int, $perPage: Int, $sort: [MediaSort], $type: MediaType) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(type: $type, sort: $sort) {
        id
        idMal
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          large
          medium
          color
        }
        bannerImage
        genres
        season
        seasonYear
        format
        status
        episodes
        duration
        averageScore
        popularity
        isAdult
        synonyms
        nextAiringEpisode {
          episode
          airingAt
        }
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
      }
    }
  }
`;

async function fetchAniListAnime(options = {}) {
  const {
    page = 1,
    perPage = 20,
    sort = ['TRENDING_DESC'],
    type = 'ANIME'
  } = options;

  try {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: ANIME_QUERY,
        variables: {
          page,
          perPage,
          sort,
          type
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching AniList data:', error);
    throw error;
  }
}

function categorizeAnime(animeList) {
  const categories = {
    'Currently Airing': [],
    'Upcoming': [],
    'Completed': [],
    'Genres': {},
    'Seasons': {},
    'Years': {}
  };

  animeList.forEach(anime => {
    // Categorize by status
    if (anime.status === 'RELEASING') {
      categories['Currently Airing'].push(anime);
    } else if (anime.status === 'NOT_YET_RELEASED') {
      categories['Upcoming'].push(anime);
    } else {
      categories['Completed'].push(anime);
    }

    // Categorize by genres
    anime.genres.forEach(genre => {
      if (!categories['Genres'][genre]) {
        categories['Genres'][genre] = [];
      }
      categories['Genres'][genre].push(anime);
    });

    // Categorize by seasons
    if (anime.season && anime.seasonYear) {
      const seasonKey = `${anime.season} ${anime.seasonYear}`;
      if (!categories['Seasons'][seasonKey]) {
        categories['Seasons'][seasonKey] = [];
      }
      categories['Seasons'][seasonKey].push(anime);
    }

    // Categorize by years
    if (anime.seasonYear) {
      const yearKey = anime.seasonYear.toString();
      if (!categories['Years'][yearKey]) {
        categories['Years'][yearKey] = [];
      }
      categories['Years'][yearKey].push(anime);
    }
  });

  return categories;
}

export { fetchAniListAnime, categorizeAnime };