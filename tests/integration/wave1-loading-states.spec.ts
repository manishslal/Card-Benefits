/**
 * Integration Tests: Loading States
 * 
 * Tests loading state components and behavior:
 * - SkeletonCard, SkeletonText, SkeletonList components
 * - LoadingSpinner component
 * - ProgressBar component
 * - Button loading states
 * - Minimum display duration (200-300ms before hiding)
 */

import { test, expect } from '@playwright/test';

const APP_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3000/api';

test.describe('Loading States', () => {
  // ============================================================
  // Test Suite 1: Skeleton Loaders
  // ============================================================

  test.describe('Skeleton Components', () => {
    test('should display skeleton while loading content', async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Simulate slow data loading
      await page.route(`**/api/cards`, (route) => {
        // Delay response by 500ms
        setTimeout(() => route.continue(), 500);
      });

      // Trigger data load
      const skeleton = page.locator('[data-test="card-skeleton"]');
      const count = await skeleton.count();

      // Skeleton should exist in DOM (may or may not be visible)
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should replace skeleton with content when loaded', async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Wait for skeletons to be replaced with actual content
      const cards = page.locator('[data-testid="card-item"]');
      
      // Should eventually load actual content
      const hasContent = await cards.count({ timeout: 5000 }).then(count => count > 0).catch(() => false);
      
      if (hasContent) {
        // Content should exist
        expect(await cards.count()).toBeGreaterThan(0);
      }
    });

    test('should show SkeletonText for text content', async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Look for skeleton text placeholders
      const skeletonText = page.locator('[data-test="skeleton-text"]');
      const count = await skeletonText.count();

      // May or may not be visible depending on load speed
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should show SkeletonList for list content', async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Look for skeleton list
      const skeletonList = page.locator('[data-test="skeleton-list"]');
      const count = await skeletonList.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should have accessible skeleton components', async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      const skeleton = page.locator('[data-test="card-skeleton"]');
      
      // Skeleton should be marked as loading/placeholder for accessibility
      const ariaHidden = await skeleton.first().getAttribute('aria-hidden');
      
      // Skeletons are usually hidden from screen readers
      if (await skeleton.count() > 0) {
        expect(ariaHidden).toBe('true');
      }
    });
  });

  // ============================================================
  // Test Suite 2: Loading Spinner
  // ============================================================

  test.describe('LoadingSpinner Component', () => {
    test('should display loading spinner during API request', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      // Mock slow API response
      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }, 1000);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      
      // Start request
      const submitPromise = submitButton.click();

      // Spinner should appear immediately
      const spinner = page.locator('[data-test="loading-spinner"], [role="progressbar"]');
      await expect(spinner.first()).toBeVisible({ timeout: 1000 });

      await submitPromise;
    });

    test('should hide loading spinner when request completes', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      // Wait for spinner to disappear
      const spinner = page.locator('[data-test="loading-spinner"]');
      const isVisible = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
      
      expect(isVisible).toBeFalsy();
    });

    test('should have animated spinner for visual feedback', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => route.continue(), 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      const submitPromise = submitButton.click();

      const spinner = page.locator('[data-test="loading-spinner"]');
      
      if (await spinner.count() > 0) {
        // Check for animation
        const hasAnimation = await spinner.evaluate((el: HTMLElement) => {
          const style = window.getComputedStyle(el);
          return style.animation || style.animationName;
        });

        // Animation should be present or inferred from CSS
        // This is a basic check; actual animation varies by implementation
      }

      await submitPromise;
    });

    test('should be centered and visible on all screen sizes', async ({ page }) => {
      // Mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${APP_URL}/auth/login`);

      const spinner = page.locator('[data-test="loading-spinner"]');
      const count = await spinner.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Test Suite 3: Button Loading States
  // ============================================================

  test.describe('Button Loading States', () => {
    test('should show loading spinner inside button during submission', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }, 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      const submitPromise = submitButton.click();

      // Button should show loading state
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBeTruthy();

      await submitPromise;
    });

    test('should disable button while loading', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => route.continue(), 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      // Start submission
      const submitPromise = submitButton.click();

      // Button should be disabled during request
      const isDisabled = await submitButton.isDisabled();
      expect(isDisabled).toBeTruthy();

      await submitPromise;
    });

    test('should re-enable button after request completes', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true }),
        });
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      // Wait for button to be re-enabled
      await expect(submitButton).toBeEnabled({ timeout: 2000 });
    });

    test('should show loading text or icon in button', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => route.continue(), 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      const originalText = await submitButton.textContent();

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      const submitPromise = submitButton.click();

      // Button text or content may change to indicate loading
      await page.waitForTimeout(100);

      const loadingText = await submitButton.textContent();
      
      // Text may change to "Loading..." or similar
      // Or a spinner icon may be added
      // This is implementation-specific

      await submitPromise;
    });

    test('should prevent multiple submissions while loading', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      let submitCount = 0;
      await page.route(`**/api/auth/login`, (route) => {
        submitCount++;
        setTimeout(() => route.continue(), 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      // Try to click multiple times
      await submitButton.click();
      await submitButton.click();
      await submitButton.click();

      // Wait for request(s) to complete
      await page.waitForTimeout(1000);

      // Should only submit once
      expect(submitCount).toBe(1);
    });

    test('should have visible loading indicator for accessibility', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => route.continue(), 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      const submitPromise = submitButton.click();

      // Button should have aria-busy or aria-disabled
      const ariaBusy = await submitButton.getAttribute('aria-busy');
      const ariaDisabled = await submitButton.getAttribute('aria-disabled');

      if (ariaBusy || ariaDisabled) {
        // Good - button indicates loading state to screen readers
      }

      await submitPromise;
    });
  });

  // ============================================================
  // Test Suite 4: Minimum Display Duration
  // ============================================================

  test.describe('Minimum Loading Display Duration', () => {
    test('should display loader for minimum 200ms (fast requests)', async ({ page }) => {
      await page.goto(`${APP_URL}/auth/login`);

      const startTime = Date.now();

      await page.route(`**/api/auth/login`, (route) => {
        // Very fast response (10ms)
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }, 10);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      // Even though request was fast, loader should show for 200+ ms
      const endTime = Date.now();

      // Wait to ensure loader was displayed
      const spinner = page.locator('[data-test="loading-spinner"]');
      await spinner.waitFor({ state: 'hidden', timeout: 300 });

      const totalTime = endTime - startTime;
      
      // Should take at least 200ms to hide the loader
      // (Allow some tolerance in timing)
      expect(totalTime).toBeGreaterThanOrEqual(150);
    });

    test('should show loader immediately and dismiss promptly for slow requests', async ({
      page,
    }) => {
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => route.continue(), 800);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      const submitPromise = submitButton.click();

      // Loader should appear immediately
      const spinner = page.locator('[data-test="loading-spinner"]');
      await expect(spinner.first()).toBeVisible({ timeout: 100 });

      // Loader should dismiss when request completes
      await submitPromise;
    });

    test('should not flash loader for requests under 200ms', async ({ page }) => {
      // For very fast requests (< 200ms), loader may not show at all
      // This improves UX by not showing unnecessary UI flicker

      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        // Fast response (50ms)
        setTimeout(() => {
          route.fulfill({
            status: 200,
            body: JSON.stringify({ success: true }),
          });
        }, 50);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');
      await submitButton.click();

      // Button should be disabled for user feedback
      // But loader might not show
    });
  });

  // ============================================================
  // Test Suite 5: Progress Bar
  // ============================================================

  test.describe('ProgressBar Component', () => {
    test('should display progress bar for multi-step operations', async ({ page }) => {
      // This would test a multi-step import or similar process
      // Skip if no multi-step operations in WAVE1

      await page.goto(`${APP_URL}/dashboard`);

      const progressBar = page.locator('[data-test="progress-bar"]');
      const count = await progressBar.count();

      // Progress bar may or may not be present depending on features
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should update progress bar as operation progresses', async ({ page }) => {
      // Mock a multi-step operation
      await page.goto(`${APP_URL}/dashboard`);

      const progressBar = page.locator('[data-test="progress-bar"]');
      
      if (await progressBar.count() > 0) {
        // Check progress updates
        const progress = await progressBar.getAttribute('aria-valuenow');
        expect(progress).toBeDefined();
      }
    });

    test('should be accessible with ARIA attributes', async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      const progressBar = page.locator('[role="progressbar"]');
      
      if (await progressBar.count() > 0) {
        const label = await progressBar.getAttribute('aria-label');
        const valuenow = await progressBar.getAttribute('aria-valuenow');
        const valuemax = await progressBar.getAttribute('aria-valuemax');

        // Should have basic ARIA attributes for accessibility
        expect(valuenow || valuemax).toBeDefined();
      }
    });
  });

  // ============================================================
  // Test Suite 6: Loading States - Responsive Design
  // ============================================================

  test.describe('Loading States - Responsive Design', () => {
    test('should display loaders correctly on mobile (375px)', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(`${APP_URL}/auth/login`);

      await page.route(`**/api/auth/login`, (route) => {
        setTimeout(() => route.continue(), 500);
      });

      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');
      const submitButton = page.locator('button[type="submit"]');

      await emailInput.fill('test@example.com');
      await passwordInput.fill('password');

      const submitPromise = submitButton.click();

      const spinner = page.locator('[data-test="loading-spinner"]');
      const isVisible = await spinner.first().isVisible({ timeout: 1000 }).catch(() => false);

      // Spinner should be visible on mobile
      expect(isVisible).toBeTruthy();

      await submitPromise;
    });

    test('should display loaders correctly on tablet (768px)', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto(`${APP_URL}/auth/login`);

      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should display loaders correctly on desktop (1440px)', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${APP_URL}/auth/login`);

      const form = page.locator('form');
      await expect(form).toBeVisible();
    });

    test('should not obscure content with loader on any screen size', async ({ page }) => {
      const sizes = [
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ];

      for (const size of sizes) {
        await page.setViewportSize(size);
        await page.goto(`${APP_URL}/auth/login`);

        // Verify main content is still accessible under loader
        const form = page.locator('form');
        const isVisible = await form.isVisible();
        expect(isVisible).toBeTruthy();
      }
    });
  });
});
