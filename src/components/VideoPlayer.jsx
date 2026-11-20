import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import './VideoPlayer.css';

function PlayerIcon({ name }) {
  const paths = {
    play: 'M8 5v14l11-7z', pause: 'M8 5v14M16 5v14',
    back: 'M20 12H4m7-7-7 7 7 7',
    expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
    collapse: 'M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5',
  };
  return <svg width="25" height="25" viewBox="0 0 24 24" aria-hidden="true" fill={name === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={name === 'pause' ? 4 : 1.8} strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}


export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor(total / 60) % 60).padStart(hours ? 2 : 1, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function VideoPlayer({ episode, movie, onClose }) {
  const dialog = useRef(null);
  const video = useRef(null);
  const surface = useRef(null);
  const hideTimer = useRef(null);
  const fullscreenExitedAt = useRef(0);
  const titleId = useId();
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const isDemo = Boolean(episode.demo);

  const reveal = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (video.current && !video.current.paused &&
          !dialog.current?.querySelector('.vp-controls')?.contains(document.activeElement) &&
          document.activeElement !== dialog.current?.querySelector('.vp-back')) {
        setControlsVisible(false);
      }
    }, 3000);
  }, []);

  useEffect(() => {
    const playerDialog = dialog.current;
    const media = video.current;
    const fullscreenSurface = surface.current;
    const opener = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    let hls = null;
    let cancelled = false;
    document.body.style.overflow = 'hidden';
    setStatus('loading');
    setError('');
    media.pause();

    async function attachSource() {
      const isHlsSource = /\.m3u8/i.test(episode.videoUrl);
      const hasNativeHls = media.canPlayType('application/vnd.apple.mpegurl');
      if (isHlsSource && !hasNativeHls) {
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (Hls.isSupported()) {
          media.removeAttribute('src');
          hls = new Hls({ autoStartLoad: true });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (!data.fatal) return;
            setStatus('error');
            setError('The episode stream could not be loaded. Check the connection or try again.');
            setControlsVisible(true);
          });
          hls.attachMedia(media);
          hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(episode.videoUrl));
          return;
        }
      }
      if (!cancelled) media.src = episode.videoUrl;
    }

    playerDialog.showModal();
    playerDialog.focus();
    attachSource().catch(() => {
      if (cancelled) return;
      setStatus('error');
      setError('The video player could not be initialized. Please try again.');
    });
    const handleFullscreen = () => {
      const active = document.fullscreenElement === fullscreenSurface;
      setFullscreen(active);
      if (!active) fullscreenExitedAt.current = Date.now();
      reveal();
    };
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => {
      cancelled = true;
      clearTimeout(hideTimer.current);
      media.pause();
      hls?.destroy();
      media.removeAttribute('src');
      media.load();
      if (document.fullscreenElement === fullscreenSurface) document.exitFullscreen().catch(() => {});
      document.removeEventListener('fullscreenchange', handleFullscreen);
      playerDialog.close();
      document.body.style.overflow = oldOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [reveal, episode.videoUrl, retryCount]);

  async function startPlayback() {
    try {
      await video.current.play();
      setNotice('');
    } catch (failure) {
      if (failure.name === 'NotAllowedError') {
        setStatus('ready');
        setNotice('Press Play to start watching.');
      } else if (failure.name !== 'AbortError') {
        setStatus('error');
        setError('This video could not be played. Check the connection or try another source.');
      }
      setControlsVisible(true);
    }
  }

  function togglePlayback() {
    reveal();
    if (video.current.paused) startPlayback();
    else video.current.pause();
  }
  function seek(value) {
    if (!Number.isFinite(video.current.duration)) return;
    video.current.currentTime = Math.max(0, Math.min(value, video.current.duration));
    setTime(video.current.currentTime);
    reveal();
  }
  function toggleMute() { video.current.muted = !video.current.muted; reveal(); }
  async function toggleFullscreen() {
    reveal();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (surface.current.requestFullscreen) await surface.current.requestFullscreen();
      else setNotice('Browser fullscreen is unavailable. The player already fills the screen.');
    } catch {
      setNotice('Fullscreen could not open. You can keep watching here.');
    }
  }
  function close() { video.current.pause(); onClose(); }
  function onKeyDown(event) {
    reveal();
    if (event.key === 'Escape') {
      if (document.fullscreenElement) {
        event.preventDefault(); event.stopPropagation();
        document.exitFullscreen().catch(() => {});
      }
      return;
    }
    if (event.target.closest('input,select,textarea,button,[contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (![' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'm', 'f'].includes(key) || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    reveal();
    if (key === ' ') togglePlayback();
    if (key === 'arrowleft') seek(video.current.currentTime - 10);
    if (key === 'arrowright') seek(video.current.currentTime + 10);
    if (key === 'm') toggleMute();
    if (key === 'f') toggleFullscreen();
    if (key === 'arrowup' || key === 'arrowdown') {
      video.current.volume = Math.max(0, Math.min(1, video.current.volume + (key === 'arrowup' ? 0.1 : -0.1)));
      video.current.muted = false;
    }
  }
  function retry() { setRetryCount((count) => count + 1); }

  return (
    <dialog ref={dialog} tabIndex={-1} className={`vp-dialog ${controlsVisible || paused || status === 'error' ? '' : 'vp-idle'}`}
      aria-labelledby={titleId} onKeyDown={onKeyDown} onPointerMove={reveal} onPointerDown={reveal}
      onFocus={reveal} onBlur={reveal}
      onCancel={(event) => {
        event.preventDefault();
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else if (Date.now() - fullscreenExitedAt.current > 350) close();
      }}>
      <div ref={surface} className="vp-surface">
      <video ref={video} playsInline preload="metadata"
        poster={isDemo ? undefined : (episode.thumbnail || movie.poster)}
        aria-label={isDemo ? episode.demo.title : `${movie.title}: ${episode.title}`}
        onClick={togglePlayback}
        onLoadedMetadata={() => { setDuration(video.current.duration); setStatus('ready'); }}
        onDurationChange={() => setDuration(video.current.duration)}
        onCanPlay={() => setStatus((current) => current === 'error' || current === 'ended' ? current : 'ready')}
        onTimeUpdate={() => setTime(video.current.currentTime)}
        onPlay={() => { setPaused(false); setStatus('ready'); setNotice(''); reveal(); }}
        onPlaying={() => { setStatus('ready'); reveal(); }}
        onPause={() => { setPaused(true); setControlsVisible(true); }}
        onWaiting={() => setStatus('buffering')}
        onSeeking={() => setStatus('buffering')}
        onSeeked={() => setStatus('ready')}
        onEnded={() => { setStatus('ended'); setPaused(true); setControlsVisible(true); }}
        onVolumeChange={() => { setVolume(video.current.volume); setMuted(video.current.muted); }}
        onError={() => { setStatus('error'); setError('Unable to load this video. Check your connection or try again.'); setControlsVisible(true); }}
        onLoadedData={() => { if (video.current.paused) startPlayback(); }}>
        {episode.subtitles?.map((track) => <track key={track.src} kind="subtitles" src={track.src} srcLang={track.language} label={track.label} default={track.default} />)}
      </video>
      <div className="vp-top vp-chrome">
        <button className="vp-back" onClick={close} aria-label="Back to show details"><PlayerIcon name="back" /></button>
        <div className="vp-heading"><p>{isDemo ? 'DEMO PREVIEW · NOT THE ACTUAL EPISODE' : 'NOW PLAYING'}</p>
          <h2 id={titleId}>{isDemo ? episode.demo.title : movie.title}</h2>
          <span>{isDemo ? `Selected: ${movie.title} · ${episode.title}` : episode.title}</span>
        </div>
        <span className="vp-brand">ALTERBUCKET<span>PLAYER</span></span>
      </div>
      {(status === 'loading' || status === 'buffering') && <div className="vp-feedback" role="status"><span className="vp-spinner" /><p>{status === 'loading' ? 'Loading video…' : 'Buffering…'}</p></div>}
      {status === 'error' && <div className="vp-feedback vp-error" role="alert"><h3>Something went wrong</h3><p>{error}</p><button onClick={retry}>Try again</button></div>}
      {paused && !['loading', 'buffering', 'error'].includes(status) && <button className="vp-center-play" onClick={() => { if (status === 'ended') seek(0); startPlayback(); }} aria-label={status === 'ended' ? 'Replay video' : 'Play video'}><span aria-hidden="true">{status === 'ended' ? '↻' : '▶︎'}</span></button>}
      <div className="vp-bottom vp-chrome">
        {notice && <p className="vp-notice" role="status">{notice}</p>}
        <div className="vp-controls">
          <label className="vp-seek"><span className="vp-sr-only">Seek video</span><input type="range" min="0" max={Number.isFinite(duration) ? duration : 0} step="0.1" value={Math.min(time, Number.isFinite(duration) ? duration : 0)} disabled={!Number.isFinite(duration) || duration <= 0 || status === 'error'} onChange={(event) => seek(Number(event.target.value))} aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`} style={{ '--progress': `${duration ? time / duration * 100 : 0}%` }} /></label>
          <div className="vp-toolbar">
            <button onClick={togglePlayback} disabled={status === 'error'} aria-label={paused ? 'Play video' : 'Pause video'}><PlayerIcon name={paused ? 'play' : 'pause'} /></button>
            <button onClick={() => seek(time - 10)} aria-label="Rewind 10 seconds">↶<small>10</small></button>
            <button onClick={() => seek(time + 10)} aria-label="Forward 10 seconds">↷<small>10</small></button>
            <button onClick={toggleMute} aria-label={muted || volume === 0 ? 'Unmute video' : 'Mute video'}>{muted || volume === 0 ? '◖×' : '◖))'}</button>
            <label className="vp-volume"><span className="vp-sr-only">Volume</span><input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={(event) => { video.current.volume = Number(event.target.value); video.current.muted = false; }} /></label>
            <span className="vp-time">{formatTime(time)} <span>/ {formatTime(duration)}</span></span>
            <span className="vp-shortcuts">Space: pause · ← →: 10s</span>
            {!!episode.subtitles?.length && <label className="vp-captions"><span className="vp-sr-only">Subtitles</span><select defaultValue={String(episode.subtitles.findIndex((track) => track.default)) === '-1' ? 'off' : String(episode.subtitles.findIndex((track) => track.default))} aria-label="Subtitles" onChange={(event) => { Array.from(video.current.textTracks).forEach((track, index) => { track.mode = String(index) === event.target.value ? 'showing' : 'disabled'; }); }}><option value="off">CC Off</option>{episode.subtitles.map((track, index) => <option key={track.src} value={index}>{track.label}</option>)}</select></label>}
            <button className="vp-fullscreen" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><PlayerIcon name={fullscreen ? 'collapse' : 'expand'} /></button>
          </div>
        </div>
        {isDemo && <p className="vp-credit">Demo film: {episode.demo.title} · {episode.demo.credit}</p>}
      </div>
      </div>
    </dialog>
  );
}
