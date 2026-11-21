import React, { useEffect, useId, useRef, useState } from 'react';
import './VideoPlayer.css';
import './EmbedPlayer.css';

export default function EmbedPlayer({ episode, movie, onClose }) {
  const dialog = useRef(null);
  const surface = useRef(null);
  const titleId = useId();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const playerDialog = dialog.current;
    const opener = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    playerDialog.showModal();
    playerDialog.focus();

    return () => {
      if (document.fullscreenElement === surface.current) {
        document.exitFullscreen().catch(() => {});
      }
      playerDialog.close();
      document.body.style.overflow = oldOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await surface.current.requestFullscreen();
    } catch {
      // The iframe's own fullscreen control remains available.
    }
  }

  return (
    <dialog
      ref={dialog}
      tabIndex={-1}
      className="vp-dialog embed-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div ref={surface} className="vp-surface">
        <iframe
          key={episode.embedUrl}
          className="embed-frame"
          src={episode.embedUrl}
          title={`${movie.title}: ${episode.title} on ${episode.sourceLabel}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
          allowFullScreen
        />
        {!loaded && (
          <div className="vp-feedback embed-loading" role="status">
            <span className="vp-spinner" />
            <p>Loading {episode.sourceLabel}…</p>
          </div>
        )}
        <div className="vp-top vp-chrome">
          <button className="vp-back" onClick={onClose} aria-label="Back to episodes">←</button>
          <div className="vp-heading">
            <p>NOW PLAYING · {episode.sourceLabel}</p>
            <h2 id={titleId}>{movie.title}</h2>
            <span>{episode.title} · Captions are managed by {episode.sourceLabel}.</span>
          </div>
          <button className="embed-fullscreen" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
            ⛶
          </button>
        </div>
      </div>
    </dialog>
  );
}
