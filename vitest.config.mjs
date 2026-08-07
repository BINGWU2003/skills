import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/scripts/**/*.test.mjs'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['scripts/*.mjs'],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
      thresholds: {
        perFile: true,
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});
