import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // loadEnv reads .env files (mode-aware) so proxy targets can live next to the
  // frontend env vars. process.env wins so `npm run dev` (server/dev.cjs) can pin
  // Streambert to the local instance it starts.
  const env = loadEnv(mode, import.meta.dirname, '');
  const streambertProxy = {
    '/api/streambert': {
      target: process.env.STREAMBERT_ORIGIN || env.STREAMBERT_ORIGIN || 'http://127.0.0.1:3001',
      changeOrigin: true,
    },
  };
  // Same-origin proxy for the genre database API (used when the frontend calls
  // /api/genres without an absolute VITE_API_BASE_URL). Point DB_API_ORIGIN at a
  // locally running database API if you have one.
  const genresProxy = {
    '/api/genres': {
      target: process.env.DB_API_ORIGIN || env.DB_API_ORIGIN || 'http://127.0.0.1:8001',
      changeOrigin: true,
    },
  };
  const devProxy = { ...streambertProxy, ...genresProxy };

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
      proxy: devProxy,
    },
    preview: {
      proxy: devProxy,
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
