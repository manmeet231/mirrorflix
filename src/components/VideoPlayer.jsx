import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { describeHlsError, describeMediaError } from '../playbackErrors';
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

export default function VideoPlayer({ episode, movie, onClose, onRetry, initialProgress = null, onProgress }) {
  const dialog = useRef(null);
  const video = useRef(null);
  const surface = useRef(null);
  const hideTimer = useRef(null);
  const fullscreenExitedAt = useRef(0);
  const onProgressRef = useRef(onProgress);
  const lastProgressAt = useRef(0);
  const lastProgressSignature = useRef('');
  const subtitlePanelOpen = useRef(false);
  onProgressRef.current = onProgress;
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
  const resumePosition = Math.max(0, Number(initialProgress?.position) || 0);
  const canResume = !initialProgress?.completed && resumePosition > 10 &&
    (!initialProgress?.duration || resumePosition < initialProgress.duration - 30);
  const [awaitingResume, setAwaitingResume] = useState(canResume);
  const [subtitleIndex, setSubtitleIndex] = useState(() => episode.subtitles?.findIndex((track) => track.default) ?? -1);
  const [subtitleText, setSubtitleText] = useState('');
  const [tracksReady, setTracksReady] = useState(0);
  const [subtitleSettings, setSubtitleSettings] = useState(false);
  const [subtitlePreferences, setSubtitlePreferences] = useState(() => {
    try {
      return { size: 100, position: 14, ...JSON.parse(window.localStorage.getItem('alterbucket.subtitles') || '{}') };
    } catch { return { size: 100, position: 14 }; }
  });
  const isDemo = Boolean(episode.demo);

  const reveal = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const playerDialog = dialog.current;
      const activeElement = document.activeElement;
      const controls = playerDialog?.querySelector('.vp-controls');
      const volumeHasFocus = playerDialog?.querySelector('.vp-volume')?.contains(activeElement);
      const keepForKeyboardFocus = (controls?.contains(activeElement) && !volumeHasFocus) ||
        activeElement === playerDialog?.querySelector('.vp-back');
      if (video.current && !video.current.paused && !subtitlePanelOpen.current && !keepForKeyboardFocus) {
        if (playerDialog?.querySelector('.vp-chrome')?.contains(activeElement)) playerDialog.focus();
        setControlsVisible(false);
      }
    }, 2000);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem('alterbucket.subtitles', JSON.stringify(subtitlePreferences)); } catch { /* Preferences still work for this session. */ }
  }, [subtitlePreferences]);

  useEffect(() => {
    const media = video.current;
    if (!media) return;
    const tracks = Array.from(media.textTracks);
    const updateCues = () => {
      const cues = subtitleIndex >= 0 ? Array.from(tracks[subtitleIndex]?.activeCues || []) : [];
      setSubtitleText(cues.map((cue) => cue.text).join('\n'));
    };
    tracks.forEach((track, index) => {
      track.mode = index === subtitleIndex ? 'hidden' : 'disabled';
      track.oncuechange = index === subtitleIndex ? updateCues : null;
    });
    updateCues();
    return () => { tracks.forEach((track) => { track.oncuechange = null; }); };
  }, [subtitleIndex, tracksReady, episode.videoUrl]);

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
            console.error('[player] Fatal HLS error', {
              type: data.type,
              details: data.details,
              status: data.response?.code || null,
              message: data.error?.message || '',
            });
            setStatus('error');
            setError(describeHlsError(data));
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
    attachSource().catch((failure) => {
      if (cancelled) return;
      console.error('[player] Initialization failed', { message: failure.message });
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
      reportProgress(true);
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

  function reportProgress(force = false) {
    const media = video.current;
    if (!media || !onProgressRef.current) return;
    const now = Date.now();
    if (!force && now - lastProgressAt.current < 5000) return;
    const position = Number(media.currentTime);
    const mediaDuration = Number(media.duration);
    if (!Number.isFinite(position) || (position === 0 && (!Number.isFinite(mediaDuration) || mediaDuration === 0))) return;
    const signature = `${position.toFixed(1)}:${Number.isFinite(mediaDuration) ? mediaDuration.toFixed(1) : 0}:${media.ended}`;
    if (signature === lastProgressSignature.current) return;
    lastProgressSignature.current = signature;
    lastProgressAt.current = now;
    onProgressRef.current({
      position,
      duration: Number.isFinite(mediaDuration) ? mediaDuration : 0,
      completed: media.ended,
    });
  }

  async function startPlayback() {
    try {
      await video.current.play();
      setNotice('');
    } catch (failure) {
      if (failure.name === 'NotAllowedError') {
        setStatus('ready');
        setNotice('Press Play to start watching.');
      } else if (failure.name !== 'AbortError') {
        console.error('[player] Playback rejected', { name: failure.name, message: failure.message });
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
  function close() { reportProgress(true); video.current.pause(); onClose(); }
  function toggleSubtitleSettings() {
    const next = !subtitleSettings;
    subtitlePanelOpen.current = next;
    setSubtitleSettings(next);
    reveal();
  }
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
  function retry() {
    if (onRetry) onRetry();
    else setRetryCount((count) => count + 1);
  }

  return (
    <dialog ref={dialog} tabIndex={-1} className={`vp-dialog ${controlsVisible || paused || subtitleSettings || status === 'error' ? '' : 'vp-idle'}`}
      aria-labelledby={titleId} onKeyDown={onKeyDown} onPointerMove={reveal} onPointerDown={reveal}
      onFocus={reveal} onBlur={reveal}
      onCancel={(event) => {
        event.preventDefault();
        if (subtitleSettings) toggleSubtitleSettings();
        else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else if (Date.now() - fullscreenExitedAt.current > 350) close();
      }}>
      <div ref={surface} className="vp-surface">
      <video ref={video} playsInline preload="metadata"
        poster={isDemo ? undefined : (episode.thumbnail || movie.poster)}
        aria-label={isDemo ? episode.demo.title : `${movie.title}: ${episode.title}`}
        onClick={togglePlayback}
        onLoadedMetadata={() => { setDuration(video.current.duration); setTracksReady((value) => value + 1); setStatus('ready'); }}
        onDurationChange={() => setDuration(video.current.duration)}
        onCanPlay={() => setStatus((current) => current === 'error' || current === 'ended' ? current : 'ready')}
        onTimeUpdate={() => { setTime(video.current.currentTime); reportProgress(); }}
        onPlay={() => { setPaused(false); setStatus('ready'); setNotice(''); reveal(); }}
        onPlaying={() => { setStatus('ready'); reveal(); }}
        onPause={() => { setPaused(true); setControlsVisible(true); reportProgress(true); }}
        onWaiting={() => setStatus('buffering')}
        onSeeking={() => setStatus('buffering')}
        onSeeked={() => setStatus('ready')}
        onEnded={() => { setStatus('ended'); setPaused(true); setControlsVisible(true); reportProgress(true); }}
        onVolumeChange={() => { setVolume(video.current.volume); setMuted(video.current.muted); reveal(); }}
        onError={() => {
          const code = video.current?.error?.code;
          console.error('[player] Media element error', {
            code: code || null,
            message: video.current?.error?.message || '',
          });
          setStatus('error');
          setError(describeMediaError(code));
          setControlsVisible(true);
        }}
        onLoadedData={() => { if (video.current.paused && !awaitingResume) startPlayback(); }}>
        {episode.subtitles?.map((track) => <track key={track.src} kind="subtitles" src={track.src} srcLang={track.language} label={track.label} onLoad={() => setTracksReady((value) => value + 1)} />)}
      </video>
      {subtitleText && <div className="vp-subtitle-overlay" style={{ '--subtitle-size': `${16 * subtitlePreferences.size / 100}px`, '--subtitle-bottom': `${subtitlePreferences.position}%` }}>{subtitleText}</div>}
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
      {awaitingResume && status !== 'loading' && status !== 'error' && <div className="vp-resume" role="group" aria-label="Resume saved progress"><p>You watched up to <strong>{formatTime(resumePosition)}</strong>.</p><div><button onClick={() => { setAwaitingResume(false); seek(resumePosition); startPlayback(); }}>Skip watched part</button><button onClick={() => { setAwaitingResume(false); seek(0); startPlayback(); }}>Start from beginning</button></div></div>}
      {paused && !awaitingResume && !['loading', 'buffering', 'error'].includes(status) && <button className="vp-center-play" onClick={() => { if (status === 'ended') seek(0); startPlayback(); }} aria-label={status === 'ended' ? 'Replay video' : 'Play video'}><span aria-hidden="true">{status === 'ended' ? '↻' : '▶︎'}</span></button>}
      <div className="vp-bottom vp-chrome">
        {notice && <p className="vp-notice" role="status">{notice}</p>}
        {subtitleSettings && <section className="vp-subtitle-panel" aria-label="Subtitle appearance"><div><strong>Subtitle appearance</strong><button onClick={toggleSubtitleSettings} aria-label="Close subtitle settings">×</button></div><label>Size <output>{subtitlePreferences.size}%</output><input type="range" min="75" max="200" step="25" value={subtitlePreferences.size} onChange={(event) => { setSubtitlePreferences((current) => ({ ...current, size: Number(event.target.value) })); reveal(); }} /></label><label>Position from bottom <output>{subtitlePreferences.position}%</output><input type="range" min="8" max="42" step="2" value={subtitlePreferences.position} onChange={(event) => { setSubtitlePreferences((current) => ({ ...current, position: Number(event.target.value) })); reveal(); }} /></label></section>}
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
            {!!episode.subtitles?.length && <><label className="vp-captions"><span className="vp-sr-only">Subtitles</span><select value={subtitleIndex} aria-label="Subtitles" onChange={(event) => { setSubtitleIndex(Number(event.target.value)); reveal(); }}><option value={-1}>CC Off</option>{episode.subtitles.map((track, index) => <option key={track.src} value={index}>{track.label}</option>)}</select></label><button className="vp-subtitle-settings-button" onClick={toggleSubtitleSettings} aria-label="Subtitle size and position" aria-expanded={subtitleSettings}>Aa</button></>}
            <button className="vp-fullscreen" onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}><PlayerIcon name={fullscreen ? 'collapse' : 'expand'} /></button>
          </div>
        </div>
        {isDemo && <p className="vp-credit">Demo film: {episode.demo.title} · {episode.demo.credit}</p>}
      </div>
      </div>
    </dialog>
  );
}
