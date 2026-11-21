export const PLAYER_SOURCES = [
  {
    id: 'hianime',
    label: 'HiAnime',
    tag: 'NATIVE',
    note: 'Native player and subtitles',
  },
  {
    id: 'vidsrc',
    label: 'VidSrc',
    supportsProgress: true,
    langParam: 'ds_lang',
    params: { autoplay: '1' },
    movieUrl: (id) => `https://vsembed.su/embed/movie/${id}`,
    tvUrl: (id, season, episode) => `https://vsembed.su/embed/tv/${id}/${season}/${episode}`,
  },
  {
    id: 'vidfast',
    label: 'Vidfast',
    supportsProgress: true,
    colorParam: 'theme',
    langParam: 'sub',
    params: { autoPlay: 'true', poster: 'true', title: 'true', pip: 'hide' },
    movieUrl: (id) => `https://vidfast.vc/movie/${id}`,
    tvUrl: (id, season, episode) => `https://vidfast.vc/tv/${id}/${season}/${episode}`,
  },
  {
    id: 'vidlove',
    label: 'Vidlove',
    supportsProgress: true,
    colorParam: 'primarycolor',
    params: {
      autoplay: 'true', autonext: 'false', tour: 'true',
      showNextEpisode: 'false', hideautonext: 'true', hidenextbutton: 'true',
    },
    movieUrl: (id) => `https://player.vidlove.cc/embed/movie/${id}`,
    tvUrl: (id, season, episode) => `https://player.vidlove.cc/embed/tv/${id}/${season}/${episode}`,
  },
  {
    id: 'aether',
    label: 'Aether',
    note: 'Multi Lang',
    disabledReason: 'Aether currently denies iframe embedding.',
    params: {},
    movieUrl: (id) => `https://aether.ist/media/tmdb-movie-${id}`,
    tvUrl: (id, season, episode) => `https://aether.ist/media/tmdb-tv-${id}/${season}/${episode}`,
  },
  {
    id: 'vidrift',
    label: 'Vidrift',
    note: 'Multi Lang, Anime',
    supportsProgress: true,
    colorParam: 'brandColor',
    langParam: 'sub',
    params: { title: 'true', hide: 'next,episodes,cast' },
    movieUrl: (id) => `https://embed.vidrift.net/embed/movie/${id}`,
    tvUrl: (id, season, episode) => `https://embed.vidrift.net/embed/tv/${id}/${season}/${episode}`,
  },
  {
    id: 'vidnest',
    label: 'Vidnest',
    note: 'Anime',
    supportsProgress: true,
    supportsAnime: true,
    params: {},
    movieUrl: (id) => `https://vidnest.fun/movie/${id}`,
    tvUrl: (id, season, episode) => `https://vidnest.fun/tv/${id}/${season}/${episode}`,
    animeUrl: (anilistId, episode, language) =>
      `https://vidnest.fun/anime/${anilistId}/${episode}/${language}`,
  },
  {
    id: 'devideosrc',
    label: 'DeVideoSrc',
    note: 'German',
    idType: 'imdb',
    colorParam: 'color',
    colorWithHash: true,
    params: { autoplay: '1', muted: '0' },
    movieUrl: (id) => `https://devideosrc.co/custom/movie/${id}`,
    tvUrl: (id, season, episode) => `https://devideosrc.co/custom/serial/${id}/${season}/${episode}`,
  },
  {
    id: 'frembed',
    label: 'Frembed',
    note: 'French',
    params: {},
    movieUrl: (id) => `https://frembed.uno/embed/movie/${id}`,
    tvUrl: (id, season, episode) => `https://frembed.uno/embed/serie/${id}?sa=${season}&epi=${episode}`,
  },
  {
    id: 'kinohub',
    label: 'KinoHub',
    note: 'Russian',
    idType: 'kinopoisk',
    movieOnly: true,
    params: {},
    movieUrl: (id) => `https://on.kinohub.vip/movie/${id}`,
  },
];

export function buildPlayerSourceUrl(source, {
  mediaType = 'anime',
  tmdbId,
  imdbId,
  anilistId,
  kinopoiskId,
  season = 1,
  episode = 1,
  language = 'en',
  mode = 'sub',
} = {}) {
  if (!source || source.id === 'hianime' || source.disabledReason) return null;
  if (source.movieOnly && mediaType !== 'movie') return null;

  const ids = { tmdb: tmdbId, imdb: imdbId, kinopoisk: kinopoiskId };
  const id = ids[source.idType || 'tmdb'];
  let rawUrl = null;

  if (mediaType === 'anime' && source.supportsAnime && anilistId) {
    rawUrl = source.animeUrl(anilistId, episode, mode);
  } else if (mediaType === 'movie') {
    if (id) rawUrl = source.movieUrl?.(id);
  } else if (id) {
    rawUrl = source.tvUrl?.(id, season, episode);
  }

  if (!rawUrl) return null;
  const url = new URL(rawUrl);
  for (const [key, value] of Object.entries(source.params || {})) {
    url.searchParams.set(key, value);
  }
  if (source.colorParam) {
    const color = source.colorWithHash ? '#e50914' : 'e50914';
    url.searchParams.set(source.colorParam, color);
  }
  if (source.langParam) url.searchParams.set(source.langParam, language);
  return url.href;
}
