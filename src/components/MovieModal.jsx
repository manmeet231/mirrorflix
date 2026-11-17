import React, { useEffect, useId, useRef, useState } from 'react';
import './MovieModal.css';

// Existing flat episode data is supported; add seasonList for multiple seasons.
export default function MovieModal({ movie, isOpen, onClose, onPlay }) {
  const dialog = useRef(null);
  const headingId = useId();
  const [seasonIndex, setSeasonIndex] = useState(0);
  const [playing, setPlaying] = useState(null);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setSeasonIndex(0); setPlaying(null); setError(''); setSaved(false); setLiked(false);
    const previous = document.activeElement;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [isOpen, movie?.id]);
  if (!isOpen || !movie) return null;
  const seasons = movie.seasonList?.length ? movie.seasonList : [{ title: 'Season 1', episodes: movie.episodes || [] }];
  const current = seasons[seasonIndex] || seasons[0];
  function play(episode) {
    setError('');
    if (!episode) { setError('No episodes are available yet.'); return; }
    if (onPlay) { onPlay(episode, movie); return; }
    if (!episode.videoUrl) { setError('Video is not available yet. Add a videoUrl for this episode.'); return; }
    setPlaying(episode);
  }
  return (
    <dialog ref={dialog} className="show-dialog" aria-labelledby={headingId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialog.current) onClose(); }}>
      <article className="show-panel">
        <button className="show-close show-circle" onClick={onClose} aria-label="Close show details">×</button>
        <header className="show-hero">
          <img className="show-backdrop" src={movie.backdrop || movie.poster} alt="" />
          <div className="show-hero-content">
            <p className="show-eyebrow">ALTERBUCKET · SERIES</p>
            <h1 id={headingId}>{movie.title}</h1>
            <div className="show-actions">
              <button className="show-play" onClick={() => play(current.episodes[0])}><span aria-hidden="true">▶︎</span> Play</button>
              <button className="show-circle" aria-label="Add to my list" aria-pressed={saved} onClick={() => setSaved(!saved)}>{saved ? '✓' : '+'}</button>
              <button className="show-circle" aria-label="Like this show" aria-pressed={liked} onClick={() => setLiked(!liked)}>♡</button>
            </div>
          </div>
        </header>
        <div className="show-body">
          {playing && <section className="show-player" aria-label={`Playing ${playing.title}`}>
            <h2>{playing.title}</h2>
            <video key={playing.videoUrl} controls autoPlay playsInline poster={playing.thumbnail} onError={() => setError('Unable to load this video. Please try again later.')}>
              <source src={playing.videoUrl} />
              {playing.subtitles?.map((track) => <track key={track.src} kind="subtitles" src={track.src} srcLang={track.language} label={track.label} />)}
            </video>
            <button className="show-text-button" onClick={() => setPlaying(null)}>Close player</button>
          </section>}
          {error && <p role="status" className="show-notice">{error}</p>}
          <div className="show-details">
            <section>
              <div className="show-metadata"><strong>{movie.matchPercentage && `${movie.matchPercentage} match`}</strong><span>{movie.year}</span><span>{movie.seasons || `${seasons.length} Seasons`}</span><span className="show-badge">HD</span></div>
              <p className="show-rating"><span className="show-badge">{movie.ageRating || 'Not rated'}</span> {movie.rating}</p>
              <h2 className="show-synopsis-title">Synopsis</h2>
              <p className="show-synopsis">{movie.synopsis}</p>
              <span className="show-language">{movie.language || 'Japanese'}</span>
            </section>
            <aside className="show-facts">
              <p><span>Cast: </span>{movie.cast || 'Not provided'}</p>
              <p><span>Genres: </span>{movie.genres || 'Not provided'}</p>
              <p><span>This show is: </span>{(movie.tags || []).join(', ')}</p>
            </aside>
          </div>
          <section className="show-episodes" aria-label="Episodes">
            <div className="show-episode-header"><h2>Episodes</h2><label><span className="show-visually-hidden">Select season</span><select value={seasonIndex} onChange={(event) => { setSeasonIndex(Number(event.target.value)); setError(''); }}>
              {seasons.map((season, index) => <option key={index} value={index}>{season.title} ({season.episodes.length} EP)</option>)}
            </select></label></div>
            <ol className="show-episode-list">
              {current.episodes.map((episode, index) => <li key={episode.id || index}>
                <button className={`show-episode ${playing?.id === episode.id ? 'is-playing' : ''}`} onClick={() => play(episode)} aria-label={`Play episode ${index + 1}: ${episode.title}`}>
                  <span className="show-episode-number">{index + 1}</span>
                  <span className="show-thumbnail"><img src={episode.thumbnail || movie.poster} alt="" loading="lazy" /><span aria-hidden="true">▶︎</span></span>
                  <span className="show-episode-copy"><span className="show-episode-title">{episode.title}</span><span className="show-episode-description">{episode.description}</span></span>
                  <span className="show-duration">{episode.duration}</span>
                </button>
              </li>)}
            </ol>
            {!current.episodes.length && <p>Episodes are coming soon.</p>}
          </section>
        </div>
      </article>
    </dialog>
  );
}
