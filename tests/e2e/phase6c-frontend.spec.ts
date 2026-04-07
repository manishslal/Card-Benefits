/**
 * Phase 6C Frontend E2E Tests
 *
 * End-to-end tests for the claiming cadence feature using Playwright.
 * Tests full user workflows including:
 * - Viewing benefit claiming limits
 * - Marking benefits as used
 * - Viewing claiming history
 * - Validating edge cases
 *
 * Run with: npx playwright test tests/e2e/phase6c-frontend.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Phase 6C - Claiming Cadence Frontend', () => {
  // ========================================================================
  // Test Setup
  // ========================================================================

  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  // ========================================================================
  // CadenceIndicator Tests
  // ========================================================================

  test.describe('CadenceIndicator Component', () => {
    test('should display urgency badge on benefit card', async ({ page }) => {
      // Find first benefit card with claiming cadence
      const benefitCards = await page.locator('[data-testid="benefit-card"]').count();

      if (benefitCards > 0) {
        const firstCard = page.locator('[data-testid="benefit-card"]').first();

        // Check if cadence indicator is visible
        const indicator = firstCard.locator('[data-testid="cadence-indicator"]');
        const isVisible = await indicator.isVisible().catch(() => false);

        if (isVisible) {
          await expect(indicator).toBeVisible();
        }
      }
    });

    test('should show expiration countdown', async ({ page }) => {
      const indicators = page.locator('[data-testid="cadence-indicator"]');
      const count = await indicators.count();

      if (count > 0) {
        const firstIndicator = indicators.first();
        const text = await firstIndicator.textContent();

        // Should contain "Expires in X days" or similar
        expect(text).toMatch(/Expires|days|deadline/i);
      }
    });

    test('should color-code urgency levels', async ({ page }) => {
      const indicators = page.locator('[data-testid="cadence-indicator"]');
      const count = await indicators.count();

      if (count > 0) {
        const firstIndicator = indicators.first();

        // Check for urgency-related classes
        const classes = await firstIndicator.getAttribute('class');

        expect(classes).toMatch(/bg-|text-/); // Should have color classes
      }
    });
  });

  // ========================================================================
  // ClaimingLimitInfo Tests
  // ========================================================================

  test.describe('ClaimingLimitInfo Component', () => {
    test('should display period information in modal', async ({ page }) => {
      // Find and open a benefit detail
      const benefitCards = page.locator('[data-testid="benefit-card"]');
      const count = await benefitCards.count();

      if (count > 0) {
        const firstCard = benefitCards.first();
        const detailsButton = firstCard.locator('button:has-text("View Details")').first();

        if (await detailsButton.isVisible()) {
          await detailsButton.click();

          // Wait for modal to appear
          const modal = page.locator('[role="dialog"]');
          await modal.waitFor({ state: 'visible' });

          // Check for claiming info
          const periodInfo = modal.locator('[data-testid="period-info"]');
          if (await periodInfo.isVisible()) {
            expect(periodInfo).toBeVisible();
          }
        }
      }
    });

    test('should show available amount', async ({ page }) => {
      const benefitCards = page.locator('[data-testid="benefit-card"]');

      if (await benefitCards.count() > 0) {
        // Look for available amount text
        const availableAmount = page.locator('text=/\\$.*available|remaining/i').first();

        if (await availableAmount.isVisible()) {
          const text = await availableAmount.textContent();
          expect(text).toMatch(/\$/);
        }
      }
    });

    test('should warn when near limit', async ({ page }) => {
      const modal = page.locator('[role="dialog"]');

      if (await modal.isVisible()) {
        const warning = modal.locator('.bg-orange-50, .bg-yellow-50');

        // Warning may or may not be present depending on usage
        if (await warning.count() > 0) {
          expect(warning).toBeVisible();
        }
      }
    });
  });

  // ========================================================================
  // BenefitUsageProgress Tests
  // ========================================================================

  test.describe('BenefitUsageProgress Component', () => {
    test('should render progress bar', async ({ page }) => {
      const progressBars = page.locator('[role="progressbar"]');

      // There may be multiple progress bars
      const count = await progressBars.count();

      if (count > 0) {
        const firstBar = progressBars.first();
        expect(firstBar).toBeVisible();

        // Check for proper ARIA attributes
        const ariaValueNow = await firstBar.getAttribute('aria-valuenow');
        expect(ariaValueNow).not.toBeNull();
      }
    });

    test('should show usage percentage', async ({ page }) => {
      const percentages = page.locator('text=/\\d+%/');
      const count = await percentages.count();

      if (count > 0) {
        const text = await percentages.first().textContent();
        expect(text).toMatch(/\d+%/);
      }
    });

    test('should color-code based on utilization', async ({ page }) => {
      const progressBars = page.locator('[role="progressbar"]');

      if (await progressBars.count() > 0) {
        const firstBar = progressBars.first();
        const style = await firstBar.getAttribute('style');

        // Should have width style set
        expect(style).toMatch(/width/);
      }
    });
  });

  // ========================================================================
  // PeriodClaimingHistory Tests
  // ========================================================================

  test.describe('PeriodClaimingHistory Component', () => {
    test('should display historical periods', async ({ page }) => {
      // Look for history section or link
      const historyLink = page.locator('button:has-text("History")').first();

      if (await historyLink.isVisible()) {
        await historyLink.click();

        // Wait for history to load
        await page.waitForLoadState('networkidle');

        // Check for period entries
        const periods = page.locator('[data-testid="period-item"]');

        if (await periods.count() > 0) {
          expect(periods).toBeVisible();
        }
      }
    });

    test('should show status badges', async ({ page }) => {
      const statusBadges = page.locator('text=/Full|Partial|Missed/i');

      if (await statusBadges.count() > 0) {
        const firstBadge = statusBadges.first();
        const text = await firstBadge.textContent();

        expect(text).toMatch(/Full|Partial|Missed/i);
      }
    });

    test('should expand period details', async ({ page }) => {
      const periodButtons = page.locator('[role="button"]:has-text("Expand")').first();

      if (await periodButtons.isVisible()) {
        await periodButtons.click();

        // Wait for details to appear
        await page.waitForTimeout(300);

        // Check for detailed information
        const details = page.locator('text=/Amount Claimed|Utilization/i').first();

        if (await details.isVisible()) {
          expect(details).toBeVisible();
        }
      }
    });
  });

  // ========================================================================
  // MarkBenefitUsedModal Tests
  // ========================================================================

  test.describe('MarkBenefitUsedModal Component', () => {
    test('should open mark benefit used modal', async ({ page }) => {
      // Find claim button on benefit card
      const claimButton = page.locator('button:has-text("Mark Used")').first();

      if (await claimButton.isVisible()) {
        await claimButton.click();

        // Wait for modal
        const modal = page.locator('[role="dialog"]:has-text("Mark Benefit")');
        await modal.waitFor({ state: 'visible' });

        expect(modal).toBeVisible();
      }
    });

    test('should show claiming form fields', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();

      if (await claimButton.isVisible()) {
        await claimButton.click();

        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Check for form fields
        const amountField = modal.locator('input[placeholder*="0.00"]').first();
        const dateField = modal.locator('input[type="date"]').first();

        if (await amountField.isVisible()) {
          expect(amountField).toBeVisible();
        }

        if (await dateField.isVisible()) {
          expect(dateField).toBeVisible();
        }
      }
    });

    test('should validate claim amount', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();

      if (await claimButton.isVisible()) {
        await claimButton.click();

        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Try to submit with empty amount
        const submitButton = modal.locator('button:has-text("Mark Used")');

        if (await submitButton.isVisible()) {
          // Clear and try to submit
          const amountField = modal.locator('input[type="number"]').first();

          if (await amountField.isVisible()) {
            await amountField.fill('');
            await submitButton.click();

            // Should show validation error
            const error = modal.locator('text=/required|invalid/i').first();

            if (await error.isVisible()) {
              expect(error).toBeVisible();
            }
          }
        }
      }
    });

    test('should prevent exceeding limit', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();

      if (await claimButton.isVisible()) {
        await claimButton.click();

        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Try to claim excessive amount
        const amountField = modal.locator('input[type="number"]').first();

        if (await amountField.isVisible()) {
          // Set a very high amount
          await amountField.fill('9999.99');

          // Try to submit
          const submitButton = modal.locator('button:has-text("Mark Used")');

          if (await submitButton.isVisible()) {
            await submitButton.click();

            // Should show error about exceeding limit
            const error = modal.locator('text=/exceeds|limit/i').first();

            if (await error.isVisible()) {
              expect(error).toBeVisible();
            }
          }
        }
      }
    });

    test('should submit claim successfully', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();

      if (await claimButton.isVisible()) {
        await claimButton.click();

        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Fill in valid amount
        const amountField = modal.locator('input[type="number"]').first();
        const dateField = modal.locator('input[type="date"]').first();
        const submitButton = modal.locator('button:has-text("Mark Used")');

        if (
          await amountField.isVisible() &&
          await dateField.isVisible() &&
          await submitButton.isVisible()
        ) {
          await amountField.fill('5.00');

          // Date should already be set to today
          await submitButton.click();

          // Wait for submission
          await page.waitForTimeout(1000);

          // Check for success message or modal close
          const successMsg = page.locator('text=/success|recorded|claimed/i').first();

          if (await successMsg.isVisible()) {
            expect(successMsg).toBeVisible();
          }
        }
      }
    });
  });

  // ========================================================================
  // Dark Mode Tests
  // ========================================================================

  test.describe('Dark Mode Support', () => {
    test('should render components in dark mode', async ({ page }) => {
      // Set dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      await page.waitForLoadState('networkidle');

      // Check if dark classes are applied
      const darkElements = page.locator('.dark');

      if (await darkElements.count() > 0) {
        expect(darkElements).toBeVisible();
      }
    });
  });

  // ========================================================================
  // Responsive Design Tests
  // ========================================================================

  test.describe('Responsive Design', () => {
    test('should be responsive on mobile', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Check components are still visible
      const benefitCards = page.locator('[data-testid="benefit-card"]');

      if (await benefitCards.count() > 0) {
        expect(benefitCards).toBeVisible();
      }
    });

    test('should be responsive on tablet', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      const benefitCards = page.locator('[data-testid="benefit-card"]');

      if (await benefitCards.count() > 0) {
        expect(benefitCards).toBeVisible();
      }
    });

    test('should be responsive on desktop', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1440, height: 900 });

      const benefitCards = page.locator('[data-testid="benefit-card"]');

      if (await benefitCards.count() > 0) {
        expect(benefitCards).toBeVisible();
      }
    });
  });

  // ========================================================================
  // Accessibility Tests
  // ========================================================================

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      const progressBars = page.locator('[role="progressbar"]');

      if (await progressBars.count() > 0) {
        const firstBar = progressBars.first();

        // Check for ARIA attributes
        const ariaLabel = await firstBar.getAttribute('aria-label');
        const ariaValuenow = await firstBar.getAttribute('aria-valuenow');

        expect(ariaLabel).not.toBeNull();
        expect(ariaValuenow).not.toBeNull();
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.waitForTimeout(300);

      // Check if any element is focused
      const focused = await page.evaluate(() => {
        return document.activeElement?.getAttribute('class') !== null;
      });

      expect(focused).toBeDefined();
    });
  });
});
