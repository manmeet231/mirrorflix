import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createForumPost,
  fetchAccountSession,
  fetchForum,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveWatchProgress,
} from '../accountApi';
import AuthModal from './AuthModal';

const AuthContext = createContext(null);
const TOKEN_KEY = 'alterbucket.session';

function storedToken() {
  try { return window.localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(storedToken);
  const [user, setUser] = useState(null);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const saveQueue = useRef(Promise.resolve());

  const applySession = useCallback((session) => {
    setUser(session.user);
    setProgress(session.progress || {});
  }, []);

  const clearSession = useCallback(() => {
    setToken('');
    setUser(null);
    setProgress({});
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be unavailable. */ }
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const controller = new AbortController();
    fetchAccountSession(token, { signal: controller.signal })
      .then(applySession)
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 401) clearSession();
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, applySession, clearSession]);

  const authenticate = useCallback(async (mode, credentials) => {
    const session = mode === 'register'
      ? await registerAccount(credentials)
      : await loginAccount(credentials);
    try { window.localStorage.setItem(TOKEN_KEY, session.token); } catch { /* Keep the in-memory session. */ }
    setToken(session.token);
    applySession(session);
    setLoading(false);
    setAuthOpen(false);
  }, [applySession]);

  const logout = useCallback(async () => {
    const currentToken = token;
    clearSession();
    if (currentToken) await logoutAccount(currentToken).catch(() => {});
  }, [token, clearSession]);

  const saveProgress = useCallback(({ movie, episodeId, position, duration, completed }) => {
    if (!token || !user || !movie?.id) return Promise.resolve(null);
    const genres = Array.isArray(movie.genres) ? movie.genres : String(movie.genres || '').split(',');
    const operation = saveQueue.current.then(async () => {
      const result = await saveWatchProgress(token, {
        movieId: String(movie.id),
        episodeId: String(episodeId),
        title: movie.title,
        poster: movie.thumbnail || movie.poster || movie.backdrop || '',
        genres,
        position,
        duration,
        completed,
      });
      setProgress(result.progress || {});
      return result;
    }).catch((error) => {
      if (error.status === 401) clearSession();
      console.warn('[account] Could not save watch progress:', error.message);
      return null;
    });
    saveQueue.current = operation;
    return operation;
  }, [token, user, clearSession]);

  const getEpisodeProgress = useCallback((movieId, episodeId) =>
    progress?.[String(movieId)]?.episodes?.[String(episodeId)] || null, [progress]);

  const getForum = useCallback((movieId, episodeId, options) => fetchForum(movieId, episodeId, options), []);
  const postToForum = useCallback((input) => createForumPost(token, input), [token]);

  const value = useMemo(() => ({
    user,
    progress,
    loading,
    authenticate,
    logout,
    saveProgress,
    getEpisodeProgress,
    requestLogin: () => setAuthOpen(true),
    getForum,
    postToForum,
  }), [user, progress, loading, authenticate, logout, saveProgress, getEpisodeProgress, getForum, postToForum]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal open={authOpen} loading={loading} onClose={() => setAuthOpen(false)} onAuthenticate={authenticate} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
