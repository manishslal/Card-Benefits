import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use globals like describe, it, expect without imports
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    // Exclude Playwright E2E tests and manual tests from Vitest (they have their own test runners)
    exclude: ['tests/**/*.spec.ts', 'tests/**/*.manual.test.ts', 'node_modules/**'],
    // Code coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'src/__tests__/',
        'src/__tests__/mocks/',
        '.next/',
        'coverage/',
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
      all: true,
    },
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
