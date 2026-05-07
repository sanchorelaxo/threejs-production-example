import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/vitest-setup.mjs'],
    include: ['src/**/*.test.js'],
  },
});
