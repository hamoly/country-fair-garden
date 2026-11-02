import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built game also works when opened from a sub-folder.
  base: './',
  build: {
    // three.js is a big library; one chunk of ~600 kB is expected.
    chunkSizeWarningLimit: 900,
  },
});
