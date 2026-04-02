/**
 * Vitest Setup File
 *
 * Runs before all tests to:
 * - Load environment variables from .env.test
 * - Initialize test database connections
 * - Set up global mocks and fixtures
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Load .env.test and populate process.env with test-specific values.
 * This ensures CRON_SECRET and other test secrets are available during test runs.
 */
function loadTestEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env.test');

  if (!fs.existsSync(envPath)) {
    console.warn(`[setup] Warning: .env.test not found at ${envPath}`);
    return;
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');

  envContent.split('\n').forEach((line) => {
    // Skip empty lines and comments
    if (!line || line.startsWith('#')) {
      return;
    }

    const [key, ...valueParts] = line.split('=');
    if (!key) {
      return;
    }

    const rawValue = valueParts.join('=').trim();

    // Remove surrounding quotes if present
    const value = rawValue.replace(/^["']|["']$/g, '');

    // Set environment variable for use in tests
    process.env[key.trim()] = value;
  });
}

// Load test environment variables before running tests
loadTestEnv();
