import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: { src: resolve(__dirname, './src') },
  },
  server: {
    port: 3000,
  },
  build: {
    target: 'es2020',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
  },
  envPrefix: 'REACT_APP_',
  plugins: [svgr({ exportAsDefault: true }), react()],
});
