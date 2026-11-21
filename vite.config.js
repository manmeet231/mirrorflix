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

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      watch: {
        usePolling: true,
      },
      proxy: streambertProxy,
    },
    preview: {
      proxy: streambertProxy,
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
