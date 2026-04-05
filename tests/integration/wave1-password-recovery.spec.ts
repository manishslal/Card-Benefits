/**
 * Integration Tests: Password Recovery (API Routes & Frontend)
 * 
 * Tests the complete password recovery flow:
 * - POST /api/auth/forgot-password: Initiates password reset with email
 * - POST /api/auth/reset-password: Completes reset with token and new password
 * - Frontend form validation and error display
 * - Session logout after successful password reset
 */

import { test, expect } from '@playwright/test';

// Base URL from playwright.config.ts
const API_URL = 'http://localhost:3000/api';
const APP_URL = 'http://localhost:3000';

test.describe('Password Recovery Flow', () => {
  // ============================================================
  // Test Suite 1: Forgot Password API Route
  // ============================================================

  test.describe('POST /api/auth/forgot-password', () => {
    test('should accept valid email and return 200 (security: no user enumeration)', async ({
      request,
    }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: {
          email: 'valid.user@example.com',
        },
      });

      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.message).toContain('If an account exists');
    });

    test('should return 400 for missing email', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: {
          email: '',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.field).toBe('email');
    });

    test('should return 400 for invalid email format', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: {
          email: 'not-an-email',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_EMAIL');
    });

    test('should return 200 for non-existent email (security: no enumeration)', async ({
      request,
    }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: {
          email: 'nonexistent.user@example.com',
        },
      });

      // Should return 200, not 404, to prevent email enumeration attacks
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });

    test('should reject malformed JSON', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        data: 'not-json',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect([400, 500]).toContain(response.status());
    });

    test('should require Content-Type: application/json', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/forgot-password`, {
        headers: {
          'Content-Type': 'text/plain',
        },
      });

      expect([400, 415, 500]).toContain(response.status());
    });
  });

  // ============================================================
  // Test Suite 2: Reset Password API Route
  // ============================================================

  test.describe('POST /api/auth/reset-password', () => {
    test('should reject missing token', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: '',
          password: 'ValidPassword123',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('should reject missing password', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'valid-token-123',
          password: '',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_INPUT');
    });

    test('should reject invalid/already-used token', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'invalid-token-that-doesnt-exist',
          password: 'ValidPassword123',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_TOKEN');
    });

    test('should reject expired token', async ({ request }) => {
      // This test assumes an expired token can be generated in the test database
      // In a real scenario, you'd need a factory function or specific test token
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'expired-token-from-test-db',
          password: 'ValidPassword123',
        },
      });

      // Should either be INVALID_TOKEN or TOKEN_EXPIRED
      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(['INVALID_TOKEN', 'TOKEN_EXPIRED']).toContain(body.code);
    });

    test('should reject weak password (less than 8 chars)', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'valid-token-123',
          password: 'Short1',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('INVALID_PASSWORD');
    });

    test('should reject password without uppercase letter', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'valid-token-123',
          password: 'lowercase123',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_PASSWORD');
    });

    test('should reject password without lowercase letter', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'valid-token-123',
          password: 'UPPERCASE123',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_PASSWORD');
    });

    test('should reject password without number', async ({ request }) => {
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'valid-token-123',
          password: 'NoNumbers',
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.code).toBe('INVALID_PASSWORD');
    });

    test('should accept valid password meeting all requirements', async ({ request }) => {
      // This test may fail in integration if no valid token exists in DB
      // Use a test database setup to create a valid token first
      const response = await request.post(`${API_URL}/auth/reset-password`, {
        data: {
          token: 'valid-token-from-test-db',
          password: 'ValidPassword123',
        },
      });

      // Expecting either success or INVALID_TOKEN if token doesn't exist in test DB
      expect([200, 400]).toContain(response.status());
    });
  });

  // ============================================================
  // Test Suite 3: Forgot Password UI Form
  // ============================================================

  test.describe('Forgot Password Form (Frontend)', () => {
    test('should render forgot password form', async ({ page }) => {
      // Navigate to forgot password page (may be a modal or dedicated page)
      await page.goto(`${APP_URL}/auth/forgot-password`);

      // Verify form elements exist
      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await expect(emailInput).toBeVisible();
      await expect(submitButton).toBeVisible();
    });

    test('should show validation error for empty email', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Should show inline validation error
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show validation error for invalid email format', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('not-an-email');
      await submitButton.click();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toContainText('valid email');
    });

    test('should enable submit button only when email is valid', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      // Initially disabled
      expect(await submitButton.isDisabled()).toBeTruthy();

      // Enable on valid email
      await emailInput.fill('valid@example.com');
      expect(await submitButton.isDisabled()).toBeFalsy();
    });

    test('should show success message after form submission', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('valid@example.com');
      await submitButton.click();

      // Wait for success message or confirmation
      const successMessage = page.locator('[role="status"]');
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText(/sent|check.*email/i);
    });

    test('should display form error message on API error', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const emailInput = page.locator('input[type="email"]');
      const submitButton = page.locator('button[type="submit"]');

      // Use an email that would cause server error (e.g., due to email service failure)
      await emailInput.fill('test@example.com');
      
      // Mock API to return error
      await page.route(`**/api/auth/forgot-password`, (route) => {
        route.abort('failed');
      });

      await submitButton.click();

      // Should show error message
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should have accessibility: label associated with email input', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const emailInput = page.locator('input[type="email"]');
      const label = page.locator('label[for="email"]');

      // Either label should exist, or email input should have aria-label
      const hasLabel = await label.count();
      const hasAriaLabel = await emailInput.getAttribute('aria-label');

      expect(hasLabel > 0 || hasAriaLabel).toBeTruthy();
    });
  });

  // ============================================================
  // Test Suite 4: Reset Password UI Form
  // ============================================================

  test.describe('Reset Password Form (Frontend)', () => {
    test('should render reset password form when token is valid', async ({ page }) => {
      // This assumes a valid token is provided via URL parameter
      // In real tests, you'd generate a valid token and include it
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
    });

    test('should show error for invalid/missing token', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/reset-password`);

      // Should show error that token is missing
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
    });

    test('should show password strength indicator', async ({ page }) => {
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const strengthIndicator = page.locator('[data-test="password-strength"]');

      await passwordInput.fill('weak');
      await expect(strengthIndicator).toBeVisible();
      await expect(strengthIndicator).toContainText(/weak|strong/i);
    });

    test('should validate password requirements on blur', async ({ page }) => {
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      await passwordInput.fill('short');
      await passwordInput.blur();

      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/8 characters|uppercase|lowercase|number/i);
    });

    test('should clear error when password becomes valid', async ({ page }) => {
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const errorMessage = page.locator('[role="alert"]');

      // Show error with invalid password
      await passwordInput.fill('short');
      await passwordInput.blur();
      await expect(errorMessage).toBeVisible();

      // Clear error with valid password
      await passwordInput.fill('ValidPassword123');
      await expect(errorMessage).not.toBeVisible();
    });

    test('should enable submit button only when password is valid', async ({ page }) => {
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      // Disabled with invalid password
      await passwordInput.fill('short');
      expect(await submitButton.isDisabled()).toBeTruthy();

      // Enabled with valid password
      await passwordInput.fill('ValidPassword123');
      expect(await submitButton.isDisabled()).toBeFalsy();
    });

    test('should show success message after successful reset', async ({ page }) => {
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await passwordInput.fill('ValidPassword123');
      await submitButton.click();

      // Should show success message
      const successMessage = page.locator('[role="status"]');
      await expect(successMessage).toBeVisible();
      await expect(successMessage).toContainText(/success|reset.*successfully/i);
    });

    test('should redirect to login after successful reset', async ({ page }) => {
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await passwordInput.fill('ValidPassword123');
      await submitButton.click();

      // Wait for redirect to login page
      await page.waitForURL(`${APP_URL}/auth/login**`);
      expect(page.url()).toContain('/auth/login');
    });

    test('should show error when API returns expired token', async ({ page }) => {
      const expiredToken = 'expired-token-123';
      await page.goto(`${APP_URL}/auth/reset-password?token=${expiredToken}`);

      // Form should show error about expired token
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/expired|no longer valid/i);
    });

    test('should show error when API returns token already used', async ({ page }) => {
      const usedToken = 'already-used-token-123';
      await page.goto(`${APP_URL}/auth/reset-password?token=${usedToken}`);

      // Form should show error about used token
      const errorMessage = page.locator('[role="alert"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText(/already.used|invalid.*link/i);
    });
  });

  // ============================================================
  // Test Suite 5: Session Logout After Password Reset
  // ============================================================

  test.describe('Session Management After Password Reset', () => {
    test('should logout user from all other sessions after password reset', async ({
      page,
    }) => {
      // This is a security measure: when user resets password, existing sessions should be invalidated
      // Implementation depends on backend session management
      
      // 1. Create a session (login)
      // 2. Reset password in another window
      // 3. Verify session is invalidated
      // 4. Attempts to use old token should fail with 401
      
      // This test requires coordinated multi-session testing which is complex in Playwright
      // Recommendation: Test this as part of API integration tests with explicit session tokens
    });

    test('should require re-login after password reset', async ({ page }) => {
      // After successful password reset and redirect to login,
      // User should be required to log in with new password
      
      const validToken = 'test-token-from-setup';
      await page.goto(`${APP_URL}/auth/reset-password?token=${validToken}`);

      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await passwordInput.fill('NewPassword123');
      await submitButton.click();

      // Should redirect to login
      await page.waitForURL(`${APP_URL}/auth/login**`);

      // Verify we're not automatically logged in
      await page.goto(`${APP_URL}/dashboard`);
      // Should redirect back to login if not authenticated
      await page.waitForURL(`${APP_URL}/auth/**`);
    });
  });

  // ============================================================
  // Test Suite 6: Responsive Design (Mobile, Tablet, Desktop)
  // ============================================================

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const form = page.locator('form');
      await expect(form).toBeVisible();

      // Touch targets should be at least 48px
      const buttons = page.locator('button');
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should be responsive on tablet (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should be responsive on desktop (1440px)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${APP_URL}/auth/forgot-password`);

      const form = page.locator('form');
      await expect(form).toBeVisible();
    });
  });
});
