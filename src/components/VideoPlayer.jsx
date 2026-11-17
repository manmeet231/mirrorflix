import React, { useState, useEffect } from 'react';
import './MovieModal.css';

const VideoPlayer = ({ episode, movie, onClose }) => {
  const [error, setError] = useState('');

  useEffect(() => {
    if (!episode) return;
    
    // Auto-play when component mounts
    const video = document.querySelector('video');
    if (video) {
      video.play().catch(err => {
        console.error('Auto-play failed:', err);
      });
    }
  }, [episode]);

  const handleClose = () => {
    onClose();
  };

  if (!episode) return null;

  return (
    <section className="show-player" aria-label={`Playing ${episode.title}`}>
      <h2>{episode.title}</h2>
      <video 
        key={episode.videoUrl} 
        controls 
        autoPlay 
        playsInline 
        poster={episode.thumbnail || movie.poster}
        onError={() => setError('Unable to load this video. Please try again later.')}
      >
        <source src={episode.videoUrl} />
        {episode.subtitles?.map((track) => (
          <track 
            key={track.src} 
            kind="subtitles" 
            src={track.src} 
            srcLang={track.language} 
            label={track.label} 
          />
        ))}
      </video>
      <button className="show-text-button" onClick={handleClose}>
        Close player
      </button>
      {error && <p role="status" className="show-notice">{error}</p>}
    </section>
  );
};

export default VideoPlayer;