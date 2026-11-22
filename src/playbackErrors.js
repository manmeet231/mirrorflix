export function describeHlsError(data = {}) {
  const status = Number(data.response?.code) || null;
  if (status === 403) {
    return 'The episode link expired or was rejected (HTTP 403). Try again to resolve a fresh source.';
  }
  if (status === 404) {
    return 'The episode media is no longer available (HTTP 404). Try again or choose another source.';
  }
  if (status && status >= 500) {
    return `The media server or local playback proxy is unavailable (HTTP ${status}). Make sure npm run dev is running, then try again.`;
  }
  if (data.type === 'networkError') {
    return 'The episode stream could not be reached. Check that npm run dev is running and check your connection, then try again.';
  }
  if (data.type === 'mediaError') {
    return 'Your browser could not decode this episode\'s media. Try again or choose another source.';
  }
  return 'The episode stream could not be loaded. Try again or choose another source.';
}

export function describeMediaError(code) {
  const messages = {
    1: 'Playback was aborted. Try again.',
    2: 'A network error interrupted playback. Make sure npm run dev is running and check your connection.',
    3: 'Your browser could not decode this episode\'s media. Try another source.',
    4: 'This episode\'s media format is not supported by your browser. Try another source.',
  };
  return messages[code] || 'Unable to load this video. Check the connection or try again.';
}
