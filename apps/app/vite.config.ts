import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

const uiPath = path.resolve(__dirname, '../../packages/ui/src');
const sharedPath = path.resolve(__dirname, '../../packages/shared/src');

// Custom plugin to resolve @/ imports based on the importer location
function resolveAtPrefixImports(): Plugin {
  const appSrc = path.resolve(__dirname, './src');

  return {
    name: 'resolve-at-prefix-imports',
    enforce: 'pre',
    async resolveId(source, importer) {
      // Only process imports starting with @/
      if (!source.startsWith('@/')) return null;
      if (!importer) return null;

      // Determine the base path based on importer location
      let basePath: string;
      if (importer.includes('/packages/ui/')) {
        basePath = path.resolve(uiPath, source.slice(2));
      } else if (importer.includes('/packages/shared/')) {
        basePath = path.resolve(sharedPath, source.slice(2));
      } else {
        // App imports
        basePath = path.resolve(appSrc, source.slice(2));
      }

      // Try different extensions
      const extensions = ['.tsx', '.ts', '/index.tsx', '/index.ts', ''];
      for (const ext of extensions) {
        const fullPath = basePath + ext;
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return { id: fullPath };
        }
      }
      return { id: basePath };
    },
  };
}

export default defineConfig({
  plugins: [
    resolveAtPrefixImports(),
    react(),
    tailwindcss(),
  ],
  // Load .env files from monorepo root
  envDir: path.resolve(__dirname, '../..'),
  resolve: {
    alias: [
      // UI package imports (subpaths first, then root)
      { find: '@vanyshr/ui/components', replacement: uiPath + '/components' },
      { find: '@vanyshr/ui/assets', replacement: uiPath + '/assets' },
      { find: '@vanyshr/ui/providers', replacement: uiPath + '/providers' },
      { find: '@vanyshr/ui/utils', replacement: uiPath + '/utils' },
      { find: '@vanyshr/ui/styles', replacement: uiPath + '/styles' },
      { find: '@vanyshr/ui', replacement: uiPath },
      // Shared package imports
      { find: '@vanyshr/shared/hooks', replacement: sharedPath + '/hooks' },
      { find: '@vanyshr/shared', replacement: sharedPath },
      // Services package
      { find: '@vanyshr/services', replacement: path.resolve(__dirname, '../../packages/services/src') },
    ],
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'ES2020',
  },
});
