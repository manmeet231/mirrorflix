/** Map an AniList media object to the shape consumed by cards and dialogs. */
export function mapAnimeToCardFormat(anime, streamData = null) {
  const cover = anime.coverImage || {};
  const title = anime.title || {};

  return {
    id: anime.id,
    malId: anime.idMal,
    title: title.english || title.romaji || title.native || 'Untitled',
    description: anime.description || '',
    poster: anime.bannerImage || cover.extraLarge || cover.large || cover.medium,
    thumbnail: cover.large || cover.medium,
    backdrop: anime.bannerImage || cover.extraLarge,
    genres: anime.genres || [],
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
    isAdult: Boolean(anime.isAdult),
    mediaType: 'anime',
    synonyms: anime.synonyms || [],
    coverImage: cover,
    bannerImage: anime.bannerImage,
  };
}
