import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this app under /HouseHill/, so all asset URLs need
// that prefix. For local dev (`vite`), base falls back to "/" so HMR works.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/HouseHill/' : '/',
  server: {
    port: 5173,
    host: true,
  },
}));
