import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      // Don't warn about dynamic imports we intentionally load at runtime
      external: [],
      onwarn(warning, warn) {
        // Suppress known safe warnings
        if (warning.code === 'MISSING_EXPORT') return;
        warn(warning);
      }
    }
  },
  assetsInclude: ['**/*.wasm']
});
