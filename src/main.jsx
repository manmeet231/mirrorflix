import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './components/AuthContext.jsx'
import './index.css'

// Polyfill for AbortSignal.any and AbortSignal.timeout (used in AnimeSearchResults)
if (typeof AbortSignal.any === 'undefined') {
  AbortSignal.any = function(signals) {
    const controller = new AbortController();
    signals.forEach(signal => {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    });
    return controller.signal;
  };
}
if (typeof AbortSignal.timeout === 'undefined') {
  AbortSignal.timeout = function(ms) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms);
    return controller.signal;
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
