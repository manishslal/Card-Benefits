/**
 * Vitest Setup File
 *
 * Runs before all tests to:
 * - Load environment variables from .env.test
 * - Initialize test database connections
 * - Set up global mocks and fixtures
 * - Provide type-safe test assertion utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ActionResponse, SuccessResponse, ErrorResponse } from '@/lib/errors';
import type { ErrorCode } from '@/lib/errors';

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

// ============================================================================
// TYPE-SAFE TEST ASSERTION UTILITIES
// ============================================================================

/**
 * Type guard assertion for ActionResponse success narrowing.
 *
 * Asserts that a response is successful, allowing safe access to response.data.
 * Throws an error with useful debugging information if the response failed.
 *
 * Usage in tests:
 * ```typescript
 * const result = await someServerAction();
 * assertSuccess(result, 'Expected action to succeed');
 * expect(result.data.cards).toHaveLength(1);
 * ```
 *
 * This is safer and more readable than:
 * ```typescript
 * expect(result.success).toBe(true);
 * if (result.success) {
 *   expect(result.data.cards).toHaveLength(1);
 * }
 * ```
 */
export function assertSuccess<T>(
  result: ActionResponse<T>,
  message?: string,
): asserts result is SuccessResponse<T> {
  if (!result.success) {
    const errorResponse = result as ErrorResponse;
    throw new Error(
      message ||
        `Expected success but got error: ${errorResponse.code} - ${errorResponse.error}`,
    );
  }
}

/**
 * Type guard assertion for ActionResponse error narrowing.
 *
 * Asserts that a response is an error, allowing safe access to error properties.
 * Optionally validates the error code matches an expected value.
 * Throws an error if the response was actually successful.
 *
 * Usage in tests:
 * ```typescript
 * const result = await someServerAction();
 * assertError(result, ERROR_CODES.VALIDATION_FIELD);
 * expect(result.code).toBe(ERROR_CODES.VALIDATION_FIELD);
 * ```
 */
export function assertError(
  result: ActionResponse<any>,
  expectedCode?: ErrorCode,
  message?: string,
): asserts result is ErrorResponse {
  if (result.success) {
    throw new Error(
      message || 'Expected error but operation succeeded unexpectedly',
    );
  }
  if (expectedCode && result.code !== expectedCode) {
    throw new Error(
      message ||
        `Expected error code ${expectedCode} but got ${result.code}: ${result.error}`,
    );
  }
}

/**
 * Helper to safely access response data with type narrowing.
 *
 * Returns data if successful, null if failed. Avoids assertions when
 * you need to handle both success and failure paths more gracefully.
 *
 * Usage in tests:
 * ```typescript
 * const result = await someServerAction();
 * const data = getResponseData(result);
 * if (data) {
 *   expect(data.cards).toHaveLength(1);
 * } else {
 *   // handle failure
 * }
 * ```
 */
export function getResponseData<T>(
  result: ActionResponse<T>,
): T | null {
  return result.success ? result.data : null;
}
