import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'src/background.ts'),
      output: {
        entryFileNames: 'background.js',
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