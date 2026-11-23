import { useEffect, useId, useRef, useState } from 'react';
import './AuthModal.css';

export default function AuthModal({ open, loading, onClose, onAuthenticate }) {
  const dialog = useRef(null);
  const titleId = useId();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPassword('');
    dialog.current?.showModal();
    dialog.current?.querySelector('input')?.focus();
    return () => dialog.current?.close();
  }, [open]);

  if (!open) return null;
  const isRegister = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onAuthenticate(mode, { username: username.trim(), password });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog ref={dialog} className="auth-dialog" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialog.current && !submitting) onClose(); }}>
      <section className="auth-panel">
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close login">×</button>
        <p className="auth-brand">ALTERBUCKET</p>
        <h1 id={titleId}>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-intro">Keep your episode progress and join the conversation.</p>
        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button type="button" role="tab" aria-selected={!isRegister} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
          <button type="button" role="tab" aria-selected={isRegister} onClick={() => { setMode('register'); setError(''); }}>Create account</button>
        </div>
        <form onSubmit={submit}>
          <label>Username<input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={24} required autoFocus /></label>
          <label>Password<input name="password" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
          {isRegister && <p className="auth-hint">Use 3–24 letters, numbers, underscores, or spaces. Password must be at least 8 characters.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting || loading}>{submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}</button>
        </form>
        <p className="auth-privacy">Your password is salted and hashed. Watch history is tied only to your account.</p>
      </section>
    </dialog>
  );
}
