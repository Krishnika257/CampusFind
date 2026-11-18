import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['client/src/**/*.test.jsx', 'server/src/**/*.test.js'],
    clearMocks: true,
    restoreMocks: true,
  },
});
