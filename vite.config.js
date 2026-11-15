import { defineConfig } from 'vite';

// Project site: https://aultbyel.github.io/Birthday_Treat/
export default defineConfig({
  base: '/Birthday_Treat/',
  build: {
    target: 'es2020',
    cssCodeSplit: false,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
