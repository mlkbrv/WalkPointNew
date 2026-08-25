import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // _redirects has to reach the deploy output for Netlify/Pages to see it.
    copyPublicDir: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // The API runs on its own origin; proxying keeps the browser same-origin in dev
    // so no CORS setup is needed just to click around locally.
    proxy: {
      '/v1': { target: 'http://localhost:8000', changeOrigin: true },
      '/media': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
