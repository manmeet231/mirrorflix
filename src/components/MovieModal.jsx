import React, { useEffect, useId, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { fetchAnimeEpisodes, fetchEpisodeStream } from '../streambert-browser-adapter';
import './MovieModal.css';

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
  const isAnime = movie?.mediaType === 'anime' || !movie?.mediaType;
  
  useEffect(() => {
    if (!isOpen) return;
    setPlaying(null);
    setEpisodes([]);
    setEpisodesLoading(false);
    setEpisodeError('');
    setStreamLoadingId(null);
    setError('');
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
    setEpisodesLoading(true);
    setEpisodeError('');

    fetchAnimeEpisodes(movie.title, {
      alternativeTitles: movie.synonyms || [],
      signal: controller.signal,
    }).then((catalog) => {
      if (!controller.signal.aborted) setEpisodes(catalog.episodes || []);
    }).catch((requestError) => {
      if (!controller.signal.aborted) setEpisodeError(requestError.message);
    }).finally(() => {
      if (!controller.signal.aborted) setEpisodesLoading(false);
    });

    return () => controller.abort();
  }, [isOpen, movie?.id, movie?.title, isAnime, episodeRetry]);
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
    if (episode.videoUrl) { setPlaying(episode); return; }

    if (isAnime && episode.id) {
      streamController.current?.abort();
      const controller = new AbortController();
      streamController.current = controller;
      setStreamLoadingId(episode.id);

      try {
        const source = await fetchEpisodeStream(episode.id, { signal: controller.signal });
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
            <VideoPlayer 
              key={`${playing.id ?? playing.title}-${playing.videoUrl}`}
              episode={playing} 
              movie={movie} 
              onClose={() => setPlaying(null)} 
            />
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
              <p className="show-synopsis">{movie.synopsis}</p>
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
