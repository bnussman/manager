import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  resolve: {
    alias: { src: resolve(__dirname, './src') },
  },
  envPrefix: 'REACT_APP_',
  plugins: [svgr({ exportAsDefault: true }), react()],
});
