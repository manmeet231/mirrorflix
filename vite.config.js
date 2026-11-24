import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(() => {
  const streambertProxy = {
    '/api/streambert': {
      target: process.env.STREAMBERT_ORIGIN || 'http://127.0.0.1:3001',
      changeOrigin: true,
    },
  };

  // In production the browser uses a same-origin relative path for the genre
  // database (see src/components/dbApiService.js); Nginx forwards /api/genres*
  // to the database API on 127.0.0.1:8001. Locally there is no database API on
  // port 8001 by default, so /api/genres is NOT proxied here. Set
  // VITE_API_BASE_URL in .env (e.g. http://103.235.105.231:8001) when you need
  // local dev to reach a remote database API. Local dev runs over HTTP, so no
  // mixed-content issue arises from pointing it at the VPS IP.
  const proxy = streambertProxy;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      host: '127.0.0.1',
      hmr: {
        protocol: 'ws',
        host: '127.0.0.1',
      },
      watch: {
        usePolling: true,
      },
      proxy,
    },
    preview: {
      proxy,
    },
    publicDir: 'public',
    build: {
      // The optional HLS runtime is lazy-loaded only when an HLS episode opens.
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        external: ['electron', 'fs', 'path', 'https', 'child_process', 'net', 'crypto', 'http', 'dns'],
      },
    },
  };
});
