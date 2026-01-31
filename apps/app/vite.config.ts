import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vanyshr/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@vanyshr/services': path.resolve(__dirname, '../../packages/services/src'),
      '@vanyshr/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'terser',
    target: 'ES2020',
  },
});
