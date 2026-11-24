import React, { useEffect, useId, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import EmbedPlayer from './EmbedPlayer';
import {
  fetchAnimeEpisodes,
  fetchAniwaveEpisodes,
  fetchAniwaveEpisodeStream,
  fetchEpisodeStream,
  fetchTitleIds,
} from '../streambert-browser-adapter';
import { PLAYER_SOURCES, buildPlayerSourceUrl, requiresTitleMetadata } from '../playerSources';
import './MovieModal.css';

// Strip HTML tags (<br>, </br>, <i>, </i>, etc.) from a string
function stripHtmlTags(html) {
  return html.replace(/<[^>]*>/g, '');
}

// Anime episodes load on demand; non-anime flat and seasonList data are flattened.
export default function MovieModal({ 
  movie, 
  isOpen, 
  onClose, 
  onPlay,
  showType = 'series',
  eyebrowText = 'ALTERBUCKET · SERIES',
  showVideoPlayer = true 
}) {
  const dialog = useRef(null);
  const streamController = useRef(null);
  const headingId = useId();
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodeError, setEpisodeError] = useState('');
  const [episodeRetry, setEpisodeRetry] = useState(0);
  const [streamLoadingId, setStreamLoadingId] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('aniwave');
  const [episodeShowId, setEpisodeShowId] = useState(null);
  const [titleIds, setTitleIds] = useState(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState('');
  const isAnime = movie?.mediaType === 'anime' || !movie?.mediaType;
  const mediaType = isAnime ? 'anime' : showType === 'movie' ? 'movie' : 'series';
  const expectedEpisodeCount = movie?.episodeCount || Number.parseInt(movie?.seasons, 10) || null;
  
  useEffect(() => {
    if (!isOpen) return;
    setPlaying(null);
    setEpisodes([]);
    setEpisodesLoading(false);
    setEpisodeError('');
    setStreamLoadingId(null);
    setError('');
    setSelectedSourceId(isAnime ? 'aniwave' : 'hianime');
    setEpisodeShowId(null);
    setTitleIds(null);
    setMetadataLoading(false);
    setMetadataError('');
    setSaved(false);
    setLiked(false);
    streamController.current?.abort();

    const previous = document.activeElement;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      streamController.current?.abort();
      dialog.current?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [isOpen, movie?.id]);

  useEffect(() => {
    if (!isOpen || !movie || !isAnime) return;
    const controller = new AbortController();
    const loadEpisodes = selectedSourceId === 'aniwave' ? fetchAniwaveEpisodes : fetchAnimeEpisodes;
    setEpisodes([]);
    setEpisodeShowId(null);
    setEpisodesLoading(true);
    setEpisodeError('');

    loadEpisodes(movie.title, {
      alternativeTitles: movie.synonyms || [],
      expectedEpisodes: expectedEpisodeCount,
      signal: controller.signal,
    }).then((catalog) => {
      if (controller.signal.aborted) return;
      setEpisodes(catalog.episodes || []);
      setEpisodeShowId(selectedSourceId === 'aniwave' ? catalog.show?.id || null : null);
    }).catch((requestError) => {
      if (!controller.signal.aborted) setEpisodeError(requestError.message);
    }).finally(() => {
      if (!controller.signal.aborted) setEpisodesLoading(false);
    });

    return () => controller.abort();
  }, [isOpen, movie?.id, movie?.title, isAnime, episodeRetry, expectedEpisodeCount, selectedSourceId]);

  useEffect(() => {
    if (!isOpen || !movie) return;
    const source = PLAYER_SOURCES.find((item) => item.id === selectedSourceId);
    if (!requiresTitleMetadata(source)) {
      setMetadataLoading(false);
      setMetadataError('');
      return;
    }
    const controller = new AbortController();
    setMetadataLoading(true);
    setMetadataError('');

    fetchTitleIds(movie.title, {
      year: movie.year,
      mediaType,
      anilistId: isAnime ? movie.id : undefined,
      signal: controller.signal,
    }).then((ids) => {
      if (!controller.signal.aborted) setTitleIds(ids);
    }).catch((requestError) => {
      if (!controller.signal.aborted) setMetadataError(requestError.message);
    }).finally(() => {
      if (!controller.signal.aborted) setMetadataLoading(false);
    });

    return () => controller.abort();
  }, [isOpen, movie?.id, movie?.title, movie?.year, mediaType, isAnime, selectedSourceId]);
  if (!isOpen || !movie) return null;
  const availableEpisodes = isAnime
    ? episodes
    : movie.seasonList?.length
      ? movie.seasonList.flatMap((season) => season.episodes || [])
      : movie.episodes || [];

  async function play(episode) {
    setError('');
    if (!episode) { setError('No episodes are available yet.'); return; }
    if (onPlay) { onPlay(episode, movie); return; }
    if (!showVideoPlayer) { setError('Playback is disabled for this view.'); return; }

    const source = PLAYER_SOURCES.find((item) => item.id === selectedSourceId);
    if (source && !source.nativeAnime) {
      const episodeNumber = Number(episode.number) || 1;
      const controller = new AbortController();
      streamController.current?.abort();
      streamController.current = controller;
      setStreamLoadingId(episode.id || episodeNumber);

      try {
        let ids = titleIds;
        let initialUrl = buildPlayerSourceUrl(source, {
          mediaType,
          ...ids,
          anilistId: isAnime ? movie.id : ids?.anilistId,
          season: 1,
          episode: episodeNumber,
        });

        if (!initialUrl && !ids) {
          ids = await fetchTitleIds(movie.title, {
            year: movie.year,
            mediaType,
            anilistId: isAnime ? movie.id : undefined,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          setTitleIds(ids);
        }

        const embedUrl = initialUrl || buildPlayerSourceUrl(source, {
          mediaType,
          ...ids,
          season: 1,
          episode: episodeNumber,
        });
        if (!embedUrl) {
          throw new Error(
            source.disabledReason
              || `${source.label} does not support this title with the available identifiers.`,
          );
        }

        setPlaying({
          ...episode,
          id: episode.id || `${source.id}-${episodeNumber}`,
          title: episode.title || `Episode ${episodeNumber}`,
          embedUrl,
          sourceLabel: source.label,
          subtitles: [],
        });
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError.message);
      } finally {
        if (streamController.current === controller) {
          streamController.current = null;
          setStreamLoadingId(null);
        }
      }
      return;
    }

    if (episode.videoUrl) { setPlaying(episode); return; }

    if (isAnime && episode.id) {
      streamController.current?.abort();
      const controller = new AbortController();
      streamController.current = controller;
      setStreamLoadingId(episode.id);

      try {
        if (selectedSourceId === 'aniwave' && !episodeShowId) {
          throw new Error('The Aniwave show is not resolved yet. Please try again.');
        }
        const source = selectedSourceId === 'aniwave'
          ? await fetchAniwaveEpisodeStream(episodeShowId, episode.number, { signal: controller.signal })
          : await fetchEpisodeStream(episode.id, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setPlaying({
          ...episode,
          title: episode.title || `Episode ${episode.number}`,
          videoUrl: source.videoUrl,
          subtitles: source.subtitles || [],
        });
      } catch (requestError) {
        if (!controller.signal.aborted) setError(requestError.message);
      } finally {
        if (streamController.current === controller) {
          streamController.current = null;
          setStreamLoadingId(null);
        }
      }
      return;
    }

    if (movie.demoVideo) {
      setPlaying({ ...episode, videoUrl: movie.demoVideo.url, demo: movie.demoVideo, subtitles: [] });
    } else {
      setError('Video is not available yet.');
    }
  }
  
  const closeModal = () => {
    streamController.current?.abort();
    setStreamLoadingId(null);
    setPlaying(null);
    onClose();
  };
  
  function changeSource(sourceId) {
    streamController.current?.abort();
    streamController.current = null;
    setStreamLoadingId(null);
    setPlaying(null);
    setError('');
    setSelectedSourceId(sourceId);
  }

  const getShowTypeText = () => {
    if (showType === 'movie') return 'ALTERBUCKET · MOVIE';
    if (showType === 'documentary') return 'ALTERBUCKET · DOCUMENTARY';
    return eyebrowText;
  };
  return (
    <dialog ref={dialog} className="show-dialog" aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); if (!playing) closeModal(); }}
      onClick={(event) => { if (event.target === dialog.current) closeModal(); }}>
      <article className="show-panel">
        <button className="show-close show-circle" onClick={closeModal} aria-label="Close show details">×</button>
        <header className="show-hero">
          {(movie.backdrop || movie.poster) && (
            <img className="show-backdrop" src={movie.backdrop || movie.poster} alt="" />
          )}
          <div className="show-hero-content">
            <p className="show-eyebrow">{getShowTypeText()}</p>
            <h1 id={headingId}>{movie.title}</h1>
            <div className="show-actions">
              <button 
                className="show-play" 
                onClick={() => play(availableEpisodes[0])}
                disabled={availableEpisodes.length === 0 || episodesLoading}
              >
                <span aria-hidden="true">▶︎</span> Play
              </button>
              <button className="show-circle" aria-label="Add to my list" aria-pressed={saved} onClick={() => setSaved(!saved)}>
                {saved ? '✓' : '+'}
              </button>
              <button className="show-circle" aria-label="Like this show" aria-pressed={liked} onClick={() => setLiked(!liked)}>
                ♡
              </button>
            </div>
          </div>
        </header>
        <div className="show-body">
          {showVideoPlayer && playing && (
            playing.embedUrl ? (
              <EmbedPlayer
                key={`${playing.id ?? playing.title}-${playing.embedUrl}`}
                episode={playing}
                movie={movie}
                onClose={() => setPlaying(null)}
              />
            ) : (
              <VideoPlayer
                key={`${playing.id ?? playing.title}-${playing.videoUrl}`}
                episode={playing}
                movie={movie}
                onClose={() => setPlaying(null)}
                onRetry={() => {
                  setPlaying(null);
                  play(playing);
                }}
              />
            )
          )}
          {error && <p role="status" className="show-notice">{error}</p>}
          <div className="show-details">
            <section>
              <div className="show-metadata">
                <strong>{movie.matchPercentage && `${movie.matchPercentage} match`}</strong>
                <span>{movie.year}</span>
                {(movie.seasons || (!movie.sourceUrl && showType === 'series' && !isAnime)) && (
                  <span>{movie.seasons || `${movie.seasonList?.length || 1} Seasons`}</span>
                )}
                {movie.quality && <span className="show-badge">{movie.quality}</span>}
              </div>
              <p className="show-rating">
                <span className="show-badge">{movie.ageRating || 'Not rated'}</span> 
                {movie.rating}
              </p>
              <h2 className="show-synopsis-title">Synopsis</h2>
              <p className="show-synopsis">{stripHtmlTags(movie.synopsis || '')}</p>
              {movie.language && <span className="show-language">{movie.language}</span>}
              {movie.sourceUrl && (
                <a className="catalog-source-link" href={movie.sourceUrl} target="_blank" rel="noreferrer">
                  {movie.sourceLabel}
                </a>
              )}
            </section>
            <aside className="show-facts">
              {movie.cast && <p><span>Cast: </span>{movie.cast}</p>}
              {movie.genres && <p><span>Genres: </span>{movie.genres}</p>}
              {movie.tags && movie.tags.length > 0 && <p><span>This show is: </span>{movie.tags.join(', ')}</p>}
            </aside>
          </div>
          {(isAnime || showType === 'series' || showType === 'documentary') && (!movie.sourceUrl || isAnime || availableEpisodes.length > 0) && (
            <section className="show-episodes" aria-label="Episodes">
              <div className="show-episode-header">
                <h2>Episodes</h2>
                <select
                  className="show-source-picker"
                  value={selectedSourceId}
                  onChange={(event) => changeSource(event.target.value)}
                  aria-label="Playback source"
                >
                  {PLAYER_SOURCES.map((source) => (
                    <option
                      key={source.id}
                      value={source.id}
                      disabled={Boolean(source.disabledReason)
                        || (source.movieOnly && mediaType !== 'movie')
                        || (source.id === 'aniwave' && !isAnime)}
                    >
                      {source.label}
                      {source.note ? ` · ${source.note}` : ''}
                      {source.disabledReason ? ' · unavailable' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {isAnime && episodesLoading && <p role="status">Loading episodes…</p>}
              {isAnime && episodeError && (
                <div className="show-episode-error" role="alert">
                  <p>{episodeError}</p>
                  <button type="button" onClick={() => setEpisodeRetry((value) => value + 1)}>Try again</button>
                </div>
              )}
              {!episodesLoading && !episodeError && availableEpisodes.length === 0 && (
                <p>No episodes were found for this title.</p>
              )}
              {availableEpisodes.length > 0 && (
                <div className="show-episode-grid">
                  {availableEpisodes.map((episode, index) => {
                    const number = episode.number || index + 1;
                    const isLoading = streamLoadingId === episode.id;
                    return (
                      <button
                        type="button"
                        key={episode.id || number}
                        className={`show-episode-button ${isLoading ? 'is-loading' : ''}`}
                        onClick={() => play(episode)}
                        disabled={streamLoadingId !== null}
                        aria-label={`Play episode ${number}`}
                        aria-busy={isLoading}
                      >
                        {number}
                      </button>
                    );
                  })}
                </div>
              )}
              {streamLoadingId !== null && <p role="status">Resolving episode stream…</p>}
            </section>
          )}
        </div>
      </article>
    </dialog>
  );
}
