import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures relative asset resolution on GitHub Pages
  server: {
    // Vite dev UI on 5173; the LAN game server (npm run lan:dev) stays on 3000.
    port: 5173,
    strictPort: true,
    host: true, // expose on the LAN so phones can open the dev build too
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
});

