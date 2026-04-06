import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use globals like describe, it, expect without imports
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    // Exclude:
    // - Playwright E2E tests and manual tests (they have their own test runners)
    // - Component tests in tsx (they require jsdom/browser environment and proper React test setup)
    // - Modal tests (JSX components)
    // - Phase 1 MVP tests (require browser APIs like localStorage, document)
    // - Integration tests that require running server (pagination, modals)
    exclude: [
      'tests/**/*.spec.ts',
      'tests/**/*.manual.test.ts',
      'tests/modals/**/*.test.tsx',
      'tests/integration/**/*.test.ts',
      'tests/security/**/*.test.ts',
      'src/__tests__/components/**/*.test.tsx',
      'src/__tests__/phase1-mvp-bugs-test-suite.test.ts',
      'node_modules/**'
    ],
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
