import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Replaces %API_BASE% in index.html with the resolved backend URL so the
// CSP `connect-src` directive matches whatever Vite is actually pointing at.
// Resolution order: process env → .env.local → .env → fallback.
const cspInjector = (apiBase: string): Plugin => ({
  name: 'csp-api-base-injector',
  transformIndexHtml(html) {
    return html.replaceAll('%API_BASE%', apiBase);
  },
});

// GitHub Pages serves this app under /HouseHill/, so all asset URLs need
// that prefix. For local dev (`vite`), base falls back to "/" so HMR works.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase =
    process.env.VITE_API_BASE_URL ||
    env.VITE_API_BASE_URL ||
    'https://househill.de.r.appspot.com';

  return {
    plugins: [react(), cspInjector(apiBase)],
    base: command === 'build' ? '/HouseHill/' : '/',
    server: {
      port: 5173,
      host: true,
    },
  };
});
