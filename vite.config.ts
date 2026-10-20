import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from https://<user>.github.io/hazard-pulse/,
  // so every URL is under that sub-path (locally too: http://localhost:5173/hazard-pulse/).
  base: '/hazard-pulse/',
  build: {
    target: 'es2022',
    // MapLibre GL is most of the bundle; it is one cacheable file, so a larger warning limit is fine.
    chunkSizeWarningLimit: 2000
  }
});
