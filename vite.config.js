import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
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
  },
  publicDir: 'public',
  build: {
    rollupOptions: {
      external: ['electron', 'fs', 'path', 'https', 'child_process', 'net', 'crypto', 'http', 'dns'],
    },
  },
})
