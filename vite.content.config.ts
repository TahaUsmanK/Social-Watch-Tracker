import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/contentScript.tsx'),
      output: {
        entryFileNames: 'contentScript.js',
        format: 'iife',
        inlineDynamicImports: true
      }
    },
    outDir: 'dist',
    emptyOutDir: false,
    copyPublicDir: false,
    target: 'es2020',
    minify: false
  }
});