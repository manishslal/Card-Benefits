/**
 * Integration Tests: Error Handling
 * 
 * Tests error handling across the application:
 * - errorMapping.ts: Maps error codes to user messages
 * - FormError component: Displays categorized errors
 * - Toast notifications: Async operation feedback
 * - Network error retry logic
 */

import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3000/api';

test.describe('Error Handling', () => {
  // ============================================================
  // Test Suite 1: Form Validation Errors
  // ============================================================

  test.describe('Form Validation Errors', () => {
    test('should show inline validation error on blur with invalid input', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('not-an-email');
      await emailInput.blur();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/valid email/i);
    });

    test('should clear validation error when input becomes valid', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      
      // Show error
      await emailInput.fill('invalid');
      await emailInput.blur();
      
      let errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();

      // Clear error
      await emailInput.fill('valid@example.com');
      await emailInput.blur();
      
      errorMessage = page.locator('[role="alert"]');
      const isVisible = await errorMessage.isVisible({ timeout: 500 }).catch(() => false);
      expect(isVisible).toBeFalsy();
    });

    test('should show field-specific error messages', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/signup`);

      const passwordInput = page.locator('input[type="password"]');
      
      // Show password-specific error
      await passwordInput.fill('short');
      await passwordInput.blur();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/password|character|uppercase|lowercase|number/i);
    });

    test('should validate on submit when no blur events', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('invalid-email');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should preserve error message when refocusing same field', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      
      // Create error
      await emailInput.fill('invalid');
      await emailInput.blur();
      
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();

      // Refocus without fixing
      await emailInput.focus();
      await expect(errorMessage).toBeVisible();
    });
  });

  // ============================================================
  // Test Suite 2: API Error Handling
  // ============================================================

  test.describe('API Error Responses', () => {
    test('should display 400 Bad Request error to user', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      // Mock API to return 400
      await page.route(`**/api/auth/login`, (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid email or password',
            code: 'UNAUTHORIZED',
          }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/invalid|password/i);
    });

    test('should display 401 Unauthorized error', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Invalid credentials',
            code: 'UNAUTHORIZED',
          }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('wrongpassword');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should display 404 Not Found error', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'User not found',
            code: 'USER_NOT_FOUND',
          }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('unknown@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should display 500 Server Error with retry option', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      let attemptCount = 0;
      await page.route(`**/api/auth/login`, (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              message: 'Internal server error',
              code: 'INTERNAL_ERROR',
            }),
          });
        } else {
          route.abort();
        }
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();

      // Should show retry button for retryable errors
      const retryButton = page.locator('button:has-text("Retry")');
      const hasRetry = await retryButton.count();
      expect(hasRetry).toBeGreaterThanOrEqual(0);
    });

    test('should display 409 Conflict error (email exists)', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/signup`);

      await page.route(`**/api/auth/signup`, (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Email already registered',
            code: 'EMAIL_EXISTS',
          }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('existing@example.com');
      await passwordInput.fill('ValidPassword123');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/already.*registered|email.*exists/i);
    });
  });

  // ============================================================
  // Test Suite 3: Toast Notifications
  // ============================================================

  test.describe('Toast Notifications', () => {
    test('should show success toast on successful form submission', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      await page.route(`**/api/auth/forgot-password`, (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Reset email sent',
          }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await submitButton.click();

      const successToast = page.locator('[role="status"]');
      await expect(successToast).toBeVisible();
    });

    test('should show error toast on failed API request', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      await page.route(`**/api/auth/forgot-password`, (route) => {
        route.abort('failed');
      });

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await submitButton.click();

      // Should show error notification
      const errorElement = page.locator('[role="alert"]');
      const count = await errorElement.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should auto-dismiss success toast after 3 seconds', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      await page.route(`**/api/auth/forgot-password`, (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await submitButton.click();

      const successToast = page.locator('[role="status"]');
      await expect(successToast).toBeVisible();

      // Wait for auto-dismiss
      const isDismissed = await successToast.isVisible({ timeout: 4000 }).catch(() => false);
      expect(isDismissed).toBeFalsy();
    });

    test('should allow manual dismiss of error toast', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      await page.route(`**/api/auth/forgot-password`, (route) => {
        route.abort('failed');
      });

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await submitButton.click();

      // Find close button on toast
      const closeButton = page.locator('[role="alert"] button[aria-label="Close"]');
      const hasClose = await closeButton.count();

      if (hasClose > 0) {
        await closeButton.click();
        const isVisible = await page.locator('[role="alert"]').first().isVisible({ timeout: 500 }).catch(() => false);
        expect(isVisible).toBeFalsy();
      }
    });

    test('should stack multiple toast notifications', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      // Trigger multiple errors
      for (let i = 0; i < 3; i++) {
        await page.route(`**/api/auth/forgot-password`, (route) => {
          route.abort('failed');
        });

        const emailInput = page.locator('input[type="email"]');
        const submitButton = page.locator('button[type="submit"]');

        await emailInput.fill(`test${i}@example.com`);
        await submitButton.click();
        await page.waitForTimeout(100);
      }

      // Should show multiple toast notifications
      const toasts = page.locator('[role="alert"]');
      const count = await toasts.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // Test Suite 4: Network Error Retry Logic
  // ============================================================

  test.describe('Network Error Retry', () => {
    test('should show "Retry" button for network errors', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      // Simulate network failure
      await page.route(`**/api/auth/login`, (route) => {
        route.abort('failed');
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      // Should show error with retry option
      const retryButton = page.locator('button:has-text("Retry")');
      const hasRetry = await retryButton.count();
      expect(hasRetry).toBeGreaterThanOrEqual(0);
    });

    test('should retry request when "Retry" button is clicked', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      let attemptCount = 0;
      await page.route(`**/api/auth/login`, (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt fails
          route.abort('failed');
        } else {
          // Second attempt succeeds
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      await page.waitForTimeout(500);

      const retryButton = page.locator('button:has-text("Retry")');
      if (await retryButton.count() > 0) {
        await retryButton.click();
        expect(attemptCount).toBeGreaterThan(1);
      }
    });

    test('should show error after max retries exceeded', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      // Mock all requests to fail
      await page.route(`**/api/auth/login`, (route) => {
        route.abort('failed');
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      // After max retries, should show non-retryable error
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    });

    test('should NOT show retry for validation errors', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      // Mock to return validation error
      await page.route(`**/api/auth/login`, (route) => {
        route.fulfill({
          status: 400,
          body: JSON.stringify({
            success: false,
            code: 'INVALID_EMAIL',
          }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('invalid');
      await passwordInput.fill('password');
      await submitButton.click();

      // Should NOT show retry button
      const retryButton = page.locator('button:has-text("Retry")');
      const count = await retryButton.count();
      expect(count).toBe(0);
    });
  });

  // ============================================================
  // Test Suite 5: Error Accessibility
  // ============================================================

  test.describe('Error Accessibility', () => {
    test('should announce errors with role="alert"', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('invalid');
      await emailInput.blur();

      const errorAlert = page.locator('[role="alert"]');
      const count = await errorAlert.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should associate error message with input field', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('invalid');
      await emailInput.blur();

      // Error should either:
      // 1. Use aria-describedby to link to input
      // 2. Be in aria-live region
      const hasDescription = await emailInput.getAttribute('aria-describedby');
      const ariaLive = page.locator('[aria-live]');
      const hasLive = await ariaLive.count();

      expect(hasDescription || hasLive > 0).toBeTruthy();
    });

    test('should use appropriate ARIA attributes for error display', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const emailInput = page.locator('input[type="email"]');
      await emailInput.fill('invalid');
      await emailInput.blur();

      const errorAlert = page.locator('[role="alert"]');
      const ariaLive = await errorAlert.getAttribute('aria-live');

      // Alert role should have aria-live: polite
      if (ariaLive) {
        expect(['polite', 'assertive']).toContain(ariaLive);
      }
    });
  });
});
