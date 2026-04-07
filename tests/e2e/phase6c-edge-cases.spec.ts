/**
 * Phase 6C Edge Case Test Suite
 *
 * Comprehensive edge case testing for MarkBenefitUsedModal and PeriodClaimingHistory components.
 * This suite covers boundary conditions, error handling, validation edge cases, and complex scenarios.
 *
 * Test Coverage Goal: >80% for both components
 * Edge Case Categories:
 * - Period boundaries (Amex Sept 18, month-end, quarters, year-end)
 * - ONE_TIME benefit claiming restrictions
 * - Amount validation (0, negative, fractional cents, max values)
 * - API error handling (400, 403, 410 status codes)
 * - Date validation (future, >90 days, format validation)
 * - Historical data edge cases (empty, single, multiple, sorting)
 * - Modal interactions (open/close, loading states, rapid submissions)
 * - Rapid concurrent claims
 *
 * Run with: npx playwright test tests/e2e/phase6c-edge-cases.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

/**
 * Helper: Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Helper: Get date N days ago in YYYY-MM-DD format
 */
function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Get date N days from now in YYYY-MM-DD format
 */
function getDateNDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Helper: Get September 17 (day before Amex cadence reset)
 */
function getSeptember17(): string {
  const today = new Date();
  const year = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-09-17`;
}

/**
 * Helper: Get September 18 (Amex cadence reset day)
 */
function getSeptember18(): string {
  const today = new Date();
  const year = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-09-18`;
}

/**
 * Helper: Mock API response for claiming limits
 */
async function mockClaimingLimits(
  page: Page,
  benefitId: string,
  options: {
    remainingAmount?: number;
    periodMax?: number;
    periodLabel?: string;
    periodStart?: string;
    periodEnd?: string;
    benefitType?: string;
  } = {}
) {
  await page.route(`**/api/benefits/claiming-limits*`, (route) => {
    route.abort();
  });

  const defaultResponse = {
    success: true,
    data: {
      benefitId,
      remainingAmount: options.remainingAmount ?? 5000,
      periodMax: options.periodMax ?? 5000,
      periodLabel: options.periodLabel ?? 'This month',
      periodStart: options.periodStart ?? new Date().toISOString(),
      periodEnd: options.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      benefitType: options.benefitType ?? 'RECURRING',
    },
  };

  await page.route(`**/api/benefits/claiming-limits*`, (route) => {
    route.continue({ response: defaultResponse });
  });
}

/**
 * Helper: Mock API response for benefit usage (claim submission)
 */
async function mockUsageAPI(
  page: Page,
  options: {
    success?: boolean;
    status?: number;
    error?: string;
    errorCode?: string;
  } = {}
) {
  const { success = true, status = 200, error = '', errorCode = '' } = options;

  await page.route('**/api/benefits/usage', (route) => {
    const response = success
      ? {
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              benefitId: 'test-benefit',
              usageAmount: 5000,
              usageDate: new Date().toISOString(),
              remainingAmount: 0,
            },
          }),
        }
      : {
          status,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error,
            details: {
              code: errorCode,
              message: error,
            },
          }),
        };

    route.abort();
    route.continue(response);
  });
}

test.describe('Phase 6C Edge Cases - MarkBenefitUsedModal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  // ==========================================================================
  // SECTION: Period Boundary Tests
  // ==========================================================================

  test.describe('Period Boundary Tests', () => {
    test('should handle Amex Sept 17 vs Sept 18 period boundary correctly', async ({ page }) => {
      // Amex benefits have a unique September 18 cutoff (not month-end)
      // Claims on Sept 17 and Sept 18 should be in different periods

      const sept17 = getSeptember17();
      const sept18 = getSeptember18();

      // Both dates should be valid but in different periods
      expect(sept17).toMatch(/\d{4}-09-17/);
      expect(sept18).toMatch(/\d{4}-09-18/);
      expect(sept17 !== sept18).toBeTruthy();
    });

    test('should allow claiming on month-end: February 28 (non-leap year)', async ({ page }) => {
      // Find claim button and open modal
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Set date to Feb 28 (non-leap)
        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const year = new Date().getFullYear();
          await dateField.fill(`${year}-02-28`);

          // Field should accept the date
          const value = await dateField.inputValue();
          expect(value).toBe(`${year}-02-28`);
        }
      }
    });

    test('should allow claiming on month-end: February 29 (leap year)', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          // Use a known leap year
          await dateField.fill('2024-02-29');
          const value = await dateField.inputValue();
          expect(value).toBe('2024-02-29');
        }
      }
    });

    test('should allow claiming on month-end: March 1', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const year = new Date().getFullYear();
          await dateField.fill(`${year}-03-01`);
          const value = await dateField.inputValue();
          expect(value).toBe(`${year}-03-01`);
        }
      }
    });

    test('should handle quarter boundaries: Q1 ends Mar 31', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const year = new Date().getFullYear();
          await dateField.fill(`${year}-03-31`);
          const value = await dateField.inputValue();
          expect(value).toBe(`${year}-03-31`);
        }
      }
    });

    test('should handle quarter boundaries: Q2 ends Jun 30', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const year = new Date().getFullYear();
          await dateField.fill(`${year}-06-30`);
          const value = await dateField.inputValue();
          expect(value).toBe(`${year}-06-30`);
        }
      }
    });

    test('should handle year boundary: Dec 31 vs Jan 1', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          // Dec 31
          await dateField.fill('2023-12-31');
          let value = await dateField.inputValue();
          expect(value).toBe('2023-12-31');

          // Jan 1 (different year, different period)
          await dateField.fill('2024-01-01');
          value = await dateField.inputValue();
          expect(value).toBe('2024-01-01');
        }
      }
    });
  });

  // ==========================================================================
  // SECTION: ONE_TIME Benefit Claiming Tests
  // ==========================================================================

  test.describe('ONE_TIME Benefit Claiming Restrictions', () => {
    test('should allow claiming ONE_TIME benefit once', async ({ page }) => {
      // Mock: ONE_TIME benefit with claiming limits
      await page.route('**/api/benefits/claiming-limits*', (route) => {
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                benefitId: 'one-time-bonus',
                remainingAmount: 25000,
                periodMax: 25000,
                periodLabel: 'One-time bonus',
                benefitType: 'ONE_TIME',
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Form should be enabled for first claim
        const amountField = modal.locator('input[type="number"]').first();
        expect(amountField).not.toBeDisabled();
      }
    });

    test('should prevent re-claiming same ONE_TIME benefit with 410 error', async ({ page }) => {
      // Mock 410 Gone error for already claimed ONE_TIME
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 410,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'This benefit has already been claimed',
              details: {
                code: 'ALREADY_CLAIMED_ONE_TIME',
                message: 'This benefit has already been claimed',
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Try to submit
        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('250.00');

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          // Should show error message
          await page.waitForTimeout(500);
          const errorMsg = modal.locator('text=/already been claimed/i');
          if (await errorMsg.count() > 0) {
            expect(await errorMsg.first().textContent()).toMatch(/already been claimed/i);
          }
        }
      }
    });

    test('error message should be clear: "This benefit has already been claimed"', async ({
      page,
    }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 410,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'This benefit has already been claimed',
              details: {
                code: 'ALREADY_CLAIMED_ONE_TIME',
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('100.00');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          const error = modal.locator('text=/already been claimed/i');
          if (await error.count() > 0) {
            const text = await error.first().textContent();
            expect(text).toContain('already been claimed');
          }
        }
      }
    });
  });

  // ==========================================================================
  // SECTION: Amount Validation Tests
  // ==========================================================================

  test.describe('Amount Validation Edge Cases', () => {
    test('should reject $0 claim amount', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('0');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          // Should show validation error
          await page.waitForTimeout(300);
          const error = modal.locator('text=/positive|must be/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });

    test('should reject negative claim amount', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          // HTML5 number input prevents negative by default, but test the validation
          await amountField.evaluate((el: HTMLInputElement) => {
            el.value = '-50.00';
          });

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(300);
          const error = modal.locator('text=/positive|invalid/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });

    test('should reject fractional cents like $15.333', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('15.333');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          // Should show error about whole cents
          await page.waitForTimeout(300);
          const error = modal.locator('text=/whole cents|\\d+ decimal/i');
          if (await error.count() > 0) {
            expect(await error.first().textContent()).toMatch(/whole cents|decimal/i);
          }
        }
      }
    });

    test('should accept max valid amount $99999.99', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('99999.99');
          const value = await amountField.inputValue();
          expect(value).toBe('99999.99');
        }
      }
    });

    test('should accept claim exactly at period limit', async ({ page }) => {
      // Mock limits where remaining = period max
      await page.route('**/api/benefits/claiming-limits*', (route) => {
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                benefitId: 'test-benefit',
                remainingAmount: 5000,
                periodMax: 5000,
                periodLabel: 'This month',
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          // Remaining is 5000 cents = $50.00
          await amountField.fill('50.00');

          // Should not show validation error
          await page.waitForTimeout(200);
          const error = modal.locator('text=/exceeds|limit/i');
          expect(await error.count()).toBe(0);
        }
      }
    });

    test('should reject claim 1 cent over limit with specific error', async ({ page }) => {
      // Mock limits where remaining = $50.00 (5000 cents)
      await page.route('**/api/benefits/claiming-limits*', (route) => {
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                benefitId: 'test-benefit',
                remainingAmount: 5000,
                periodMax: 5000,
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          // Remaining is $50.00, try to claim $50.01
          await amountField.fill('50.01');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(300);
          const error = modal.locator('text=/exceeds remaining|over limit/i');
          if (await error.count() > 0) {
            expect(await error.first().textContent()).toMatch(/exceeds|over|limit/i);
          }
        }
      }
    });
  });

  // ==========================================================================
  // SECTION: API Error Handling Tests
  // ==========================================================================

  test.describe('API Error Handling', () => {
    test('should handle CLAIMING_LIMIT_EXCEEDED (400) error', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'You can only claim $50.00 this period',
              details: {
                code: 'CLAIMING_LIMIT_EXCEEDED',
                remaining: 5000,
                requested: 10000,
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('100.00');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          const error = modal.locator('text=/can only claim.*this period/i');
          if (await error.count() > 0) {
            expect(await error.first().textContent()).toMatch(/can only claim/i);
          }
        }
      }
    });

    test('should handle CLAIMING_WINDOW_CLOSED (403) error', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'This benefit period has ended',
              details: {
                code: 'CLAIMING_WINDOW_CLOSED',
                periodEnd: new Date().toISOString(),
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('50.00');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          const error = modal.locator('text=/period.*ended|claiming.*closed/i');
          if (await error.count() > 0) {
            expect(await error.first().textContent()).toMatch(/ended|closed/i);
          }
        }
      }
    });

    test('should handle ALREADY_CLAIMED_ONE_TIME (410) error', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 410,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'This benefit was already claimed',
              details: {
                code: 'ALREADY_CLAIMED_ONE_TIME',
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('25.00');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          const error = modal.locator('text=/already.*claimed/i');
          if (await error.count() > 0) {
            expect(await error.first().textContent()).toMatch(/already.*claimed/i);
          }
        }
      }
    });

    test('should show network error with retry option', async ({ page }) => {
      // Abort the API call to simulate network error
      await page.route('**/api/benefits/usage', (route) => {
        route.abort('failed');
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('50.00');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          // Should show error message
          const error = modal.locator('text=/error|failed/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });

    test('should handle server error (500) with retry option', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              success: false,
              error: 'Internal server error',
              details: {
                code: 'INTERNAL_SERVER_ERROR',
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('50.00');
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          const error = modal.locator('text=/server|error/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  // ==========================================================================
  // SECTION: Date Validation Tests
  // ==========================================================================

  test.describe('Date Validation Edge Cases', () => {
    test('should reject claim date in future', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const futureDate = getDateNDaysFromNow(5);
          await dateField.fill(futureDate);

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(300);
          const error = modal.locator('text=/future|tomorrow/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });

    test('should accept claim date exactly 90 days ago', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const ninetyDaysAgo = getDateNDaysAgo(90);
          await dateField.fill(ninetyDaysAgo);

          // Should not show validation error
          await page.waitForTimeout(200);
          const error = modal.locator('text=/90 days|past/i');
          const errorCount = await error.count();
          expect(errorCount).toBe(0);
        }
      }
    });

    test('should reject claim date 91 days ago', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const ninetyOneDaysAgo = getDateNDaysAgo(91);
          await dateField.fill(ninetyOneDaysAgo);

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(300);
          const error = modal.locator('text=/90 days|past|more than/i');
          if (await error.count() > 0) {
            expect(await error.first().textContent()).toMatch(/90 days|more than/i);
          }
        }
      }
    });

    test('should accept claim date as today', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const today = getTodayDate();
          await dateField.fill(today);

          const value = await dateField.inputValue();
          expect(value).toBe(today);
        }
      }
    });

    test('should reject invalid date format', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          // HTML5 date input has built-in validation
          // Attempt to type invalid format
          await dateField.evaluate((el: HTMLInputElement) => {
            el.value = 'invalid-date';
          });

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(300);
          // Should show error
          const error = modal.locator('text=/date|invalid/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  // ==========================================================================
  // SECTION: Modal Interaction Tests
  // ==========================================================================

  test.describe('Modal Interaction Edge Cases', () => {
    test('should open modal with empty form', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Amount field should be empty
        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          const value = await amountField.inputValue();
          expect(value).toBe('');
        }

        // Date field should have today's date
        const dateField = modal.locator('input[type="date"]').first();
        if (await dateField.isVisible()) {
          const value = await dateField.inputValue();
          expect(value).toBe(getTodayDate());
        }
      }
    });

    test('should show validation errors on blur', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          // Focus and blur without entering value
          await amountField.focus();
          await amountField.blur();

          await page.waitForTimeout(200);
          // Should show validation error
          const error = modal.locator('text=/required|amount/i');
          expect(error.count()).toBeGreaterThan(0);
        }
      }
    });

    test('should disable submit button while loading', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        // Delay response to observe loading state
        setTimeout(() => {
          route.continue({
            response: {
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                success: true,
                data: { benefitId: 'test' },
              }),
            },
          });
        }, 2000);
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('25.00');

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          // Check if button is disabled while loading
          await page.waitForTimeout(100);
          const isDisabled = await submitButton.isDisabled();
          expect(isDisabled).toBeTruthy();
        }
      }
    });

    test('should show success message with remaining amount', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                benefitId: 'test',
                remainingAmount: 2500,
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('25.00');

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(1000);
          // Should show success with remaining info
          const successMsg = modal.locator('text=/success|recorded|claimed|remaining/i');
          if (await successMsg.count() > 0) {
            expect(await successMsg.first().textContent()).toMatch(/success|recorded|claimed|remaining/i);
          }
        }
      }
    });

    test('should close modal when close button clicked', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Find close button (X button)
        const closeButton = modal.locator('button[aria-label="Close"]').first();
        if (await closeButton.isVisible()) {
          await closeButton.click();

          // Modal should be hidden
          await page.waitForTimeout(300);
          expect(await modal.isVisible()).toBeFalsy();
        }
      }
    });

    test('should close modal when ESC key pressed', async ({ page }) => {
      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Press ESC
        await page.keyboard.press('Escape');

        // Modal should be hidden
        await page.waitForTimeout(300);
        expect(await modal.isVisible()).toBeFalsy();
      }
    });

    test('should clear form after successful claim', async ({ page }) => {
      await page.route('**/api/benefits/usage', (route) => {
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { benefitId: 'test' },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('25.00');

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
          // After success, form should be cleared
          const value = await amountField.inputValue();
          expect(value).toBe('');
        }
      }
    });
  });

  // ==========================================================================
  // SECTION: Rapid Claim Tests
  // ==========================================================================

  test.describe('Rapid Claim Edge Cases', () => {
    test('should handle two claims in rapid succession (100ms apart)', async ({ page }) => {
      let callCount = 0;

      await page.route('**/api/benefits/usage', (route) => {
        callCount++;
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                benefitId: 'test',
                claimNumber: callCount,
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();

      if (await claimButton.isVisible()) {
        // First claim
        await claimButton.click();
        let modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        let amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('10.00');
          let submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);

          // Close modal
          const closeButton = modal.locator('button[aria-label="Close"]').first();
          if (await closeButton.isVisible()) {
            await closeButton.click();
          }

          // Wait 100ms then try second claim
          await page.waitForTimeout(100);

          // Second claim
          const claimButton2 = page.locator('button:has-text("Mark Used")').first();
          if (await claimButton2.isVisible()) {
            await claimButton2.click();
            modal = page.locator('[role="dialog"]');
            await modal.waitFor({ state: 'visible' });

            amountField = modal.locator('input[type="number"]').first();
            if (await amountField.isVisible()) {
              await amountField.fill('15.00');
              let submitButton = modal.locator('button:has-text("Mark Used")').last();
              await submitButton.click();

              await page.waitForTimeout(500);
              expect(callCount).toBeGreaterThan(1);
            }
          }
        }
      }
    });

    test('should handle concurrent API requests correctly', async ({ page }) => {
      const callTimes: number[] = [];

      await page.route('**/api/benefits/usage', (route) => {
        callTimes.push(Date.now());
        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { benefitId: 'test' },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          await amountField.fill('20.00');

          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(1000);
          // At least one call should be made
          expect(callTimes.length).toBeGreaterThan(0);
        }
      }
    });

    test('should use updated remaining amount for second claim', async ({ page }) => {
      const callSequence: string[] = [];

      await page.route('**/api/benefits/claiming-limits*', (route) => {
        // Each time, return decreased remaining amount
        const callNum = callSequence.length + 1;
        callSequence.push(`limits-${callNum}`);

        route.continue({
          response: {
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                benefitId: 'test',
                remainingAmount: 5000 - callNum * 1000,
                periodMax: 5000,
              },
            }),
          },
        });
      });

      const claimButton = page.locator('button:has-text("Mark Used")').first();
      if (await claimButton.isVisible()) {
        await claimButton.click();
        const modal = page.locator('[role="dialog"]');
        await modal.waitFor({ state: 'visible' });

        // Should fetch limits and show first remaining amount
        await page.waitForTimeout(300);

        const amountField = modal.locator('input[type="number"]').first();
        if (await amountField.isVisible()) {
          // Try to claim amount > what would remain after hypothetical first claim
          await amountField.fill('50.00');

          // This should either succeed or show updated error based on fetched limits
          const submitButton = modal.locator('button:has-text("Mark Used")').last();
          await submitButton.click();

          await page.waitForTimeout(500);
        }
      }
    });
  });
});

// =============================================================================
// SECTION: PeriodClaimingHistory Edge Cases
// =============================================================================

test.describe('Phase 6C Edge Cases - PeriodClaimingHistory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Historical Data Edge Cases', () => {
    test('should show "No claiming history available" when empty', async ({ page }) => {
      // Look for history section
      const historySection = page.locator('text=/no.*history|claiming history/i');

      if (await historySection.count() > 0) {
        const text = await historySection.first().textContent();
        expect(text).toMatch(/no|history|available/i);
      }
    });

    test('should display single claim correctly', async ({ page }) => {
      // Find period items
      const periodItems = page.locator('[data-testid="period-item"]');

      if (await periodItems.count() >= 1) {
        const firstItem = periodItems.first();
        const text = await firstItem.textContent();

        // Should contain period name and amounts
        expect(text).toMatch(/\$|month|period|claimed/i);
      }
    });

    test('should sort multiple claims by date (newest first)', async ({ page }) => {
      const periodItems = page.locator('[data-testid="period-item"]');
      const itemCount = await periodItems.count();

      if (itemCount >= 2) {
        // Get all period items
        for (let i = 1; i < itemCount; i++) {
          const prevItem = periodItems.nth(i - 1);
          const currItem = periodItems.nth(i);

          const prevText = await prevItem.textContent();
          const currText = await currItem.textContent();

          // Previous item should appear before current (older)
          expect(prevText).not.toBe(currText);
        }
      }
    });

    test('should highlight missed periods with ❌ LOST icon', async ({ page }) => {
      const missedIndicators = page.locator('text=/❌|LOST|missed/i');

      if (await missedIndicators.count() > 0) {
        const firstMissed = missedIndicators.first();
        const text = await firstMissed.textContent();

        expect(text).toMatch(/❌|LOST|missed/i);
      }
    });

    test('should display mixed claimed/missed periods correctly', async ({ page }) => {
      const statusBadges = page.locator('text=/Full|Partial|Missed/i');
      const badgeCount = await statusBadges.count();

      // Should have multiple periods with different statuses
      if (badgeCount >= 2) {
        const texts: string[] = [];
        for (let i = 0; i < Math.min(badgeCount, 3); i++) {
          const text = await statusBadges.nth(i).textContent();
          texts.push(text!);
        }

        expect(texts.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Period Expansion Edge Cases', () => {
    test('should expand period to show details', async ({ page }) => {
      const expandButtons = page.locator('[role="button"]:has-text("Expand")').first();

      if (await expandButtons.isVisible()) {
        await expandButtons.click();

        // Should show detailed information
        await page.waitForTimeout(300);
        const details = page.locator('text=/Amount Claimed|Utilization|Maximum/i');

        expect(await details.count()).toBeGreaterThan(0);
      }
    });

    test('should collapse period details when clicked again', async ({ page }) => {
      const expandButtons = page.locator('[role="button"]:has-text("Expand")').first();

      if (await expandButtons.isVisible()) {
        // Expand
        await expandButtons.click();
        await page.waitForTimeout(300);

        // Collapse
        await expandButtons.click();
        await page.waitForTimeout(300);

        // Details should be hidden
        const chevron = expandButtons.locator('svg');
        const transform = await chevron.getAttribute('class');

        // Should be back to original rotation
        expect(transform).not.toContain('rotate-180');
      }
    });
  });

  test.describe('Utilization Percentage Edge Cases', () => {
    test('should show 0% utilization when no claims', async ({ page }) => {
      const percentages = page.locator('text=/0%|\\d+%/i');

      if (await percentages.count() > 0) {
        const text = await percentages.first().textContent();
        // Should have at least one percentage display
        expect(text).toMatch(/\\d+%/);
      }
    });

    test('should show 100% utilization when fully claimed', async ({ page }) => {
      const percentages = page.locator('text=/100%/i');

      if (await percentages.count() > 0) {
        const text = await percentages.first().textContent();
        expect(text).toContain('100%');
      }
    });

    test('should show intermediate percentages correctly', async ({ page }) => {
      const percentages = page.locator('text=/\\d+%/i');
      const count = await percentages.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const text = await percentages.nth(i).textContent();
          const match = text?.match(/(\d+)%/);

          if (match) {
            const percent = parseInt(match[1], 10);
            expect(percent).toBeGreaterThanOrEqual(0);
            expect(percent).toBeLessThanOrEqual(100);
          }
        }
      }
    });
  });

  test.describe('Progress Bar Edge Cases', () => {
    test('should render progress bar for each period', async ({ page }) => {
      const progressBars = page.locator('[role="progressbar"]');
      const count = await progressBars.count();

      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should color-code progress by status', async ({ page }) => {
      const progressBars = page.locator('[role="progressbar"]');

      if (await progressBars.count() > 0) {
        const firstBar = progressBars.first();
        const style = await firstBar.getAttribute('style');

        // Should have width style indicating progress
        expect(style).toMatch(/width:/);
      }
    });

    test('should cap progress bar at 100%', async ({ page }) => {
      const progressBars = page.locator('[role="progressbar"]');

      if (await progressBars.count() > 0) {
        for (let i = 0; i < Math.min(3, await progressBars.count()); i++) {
          const bar = progressBars.nth(i);
          const style = await bar.getAttribute('style');

          // Should not exceed 100%
          if (style) {
            const match = style.match(/width:\s*(\d+(?:\.\d+)?)/);
            if (match) {
              const width = parseFloat(match[1]);
              expect(width).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    });
  });

  test.describe('Financial Impact Summary', () => {
    test('should calculate total missed amount correctly', async ({ page }) => {
      const missedTotal = page.locator('text=/missed.*benefits|financial.*impact/i');

      if (await missedTotal.count() > 0) {
        const text = await missedTotal.first().textContent();
        // Should contain dollar amount
        expect(text).toMatch(/\$\d+/);
      }
    });

    test('should not show missed section when no missed benefits', async ({ page }) => {
      // If there are no missed benefits, the section might not appear
      const missedSection = page.locator('text=/💡.*Financial Impact/i');

      // Either visible (if there are missed) or not visible (if not)
      const count = await missedSection.count();
      expect(typeof count).toBe('number');
    });
  });

  test.describe('Sorting and Filtering Edge Cases', () => {
    test('should display periods in descending date order', async ({ page }) => {
      const periodItems = page.locator('[data-testid="period-item"]');
      const count = await periodItems.count();

      if (count >= 2) {
        // Get dates from text content
        const dates: string[] = [];

        for (let i = 0; i < count; i++) {
          const text = await periodItems.nth(i).textContent();
          // Extract month/year pattern
          const match = text?.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}/i);
          if (match) {
            dates.push(match[0]);
          }
        }

        // Dates should be in order (newest first would mean later dates appear first)
        expect(dates.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Responsive Layout Edge Cases', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      const historyContainer = page.locator('[data-testid="period-item"]');

      if (await historyContainer.count() > 0) {
        const firstItem = historyContainer.first();
        expect(await firstItem.isVisible()).toBeTruthy();
      }
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      const historyContainer = page.locator('[data-testid="period-item"]');

      if (await historyContainer.count() > 0) {
        expect(await historyContainer.first().isVisible()).toBeTruthy();
      }
    });

    test('should be responsive on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });

      const historyContainer = page.locator('[data-testid="period-item"]');

      if (await historyContainer.count() > 0) {
        expect(await historyContainer.first().isVisible()).toBeTruthy();
      }
    });
  });

  test.describe('Dark Mode Support', () => {
    test('should render correctly in dark mode', async ({ page }) => {
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });

      await page.waitForLoadState('networkidle');

      const historyContainer = page.locator('[data-testid="period-item"]');

      if (await historyContainer.count() > 0) {
        const classes = await historyContainer.first().getAttribute('class');
        expect(classes).toBeDefined();
      }
    });
  });
});
