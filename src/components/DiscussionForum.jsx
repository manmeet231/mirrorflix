import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import './DiscussionForum.css';

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function DiscussionForum({ movieId, episodeId = null }) {
  const { user, requestLogin, getForum, postToForum } = useAuth();
  const [posts, setPosts] = useState([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getForum(movieId, episodeId, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPosts(result.posts || []); })
      .catch((requestError) => { if (!controller.signal.aborted) setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [movieId, episodeId, retry, getForum]);

  async function submit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await postToForum({ movieId: String(movieId), episodeId, body: body.trim() });
      setPosts((current) => [result.post, ...current]);
      setBody('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="forum" aria-live="polite">
      {user ? (
        <form className="forum-composer" onSubmit={submit}>
          <label htmlFor={`forum-${movieId}-${episodeId || 'show'}`}>Join the discussion as <strong>{user.username}</strong></label>
          <textarea id={`forum-${movieId}-${episodeId || 'show'}`} value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={3} placeholder="Share your thoughts, theories, or favorite moments…" required />
          <div className="forum-composer-footer"><span>{body.length}/2000</span><button type="submit" disabled={submitting || !body.trim()}>{submitting ? 'Posting…' : 'Post message'}</button></div>
        </form>
      ) : (
        <div className="forum-login"><p>Log in to share your thoughts. You can read without an account.</p><button type="button" onClick={requestLogin}>Log in to post</button></div>
      )}
      {error && <div className="forum-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>}
      {loading ? <p className="forum-empty" role="status">Loading discussion…</p> : posts.length === 0 ? (
        <p className="forum-empty">No messages in this thread yet. Start the conversation.</p>
      ) : (
        <ol className="forum-posts">
          {posts.map((post) => <li key={post.id}><div className="forum-post-meta"><strong>{post.username}</strong><time dateTime={post.createdAt}>{dateFormatter.format(new Date(post.createdAt))}</time></div><p>{post.body}</p></li>)}
        </ol>
      )}
    </div>
  );
}
