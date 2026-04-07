import { test, expect, Page } from '@playwright/test';
import { testUserData } from './fixtures/phase6c-test-data';

// Configure test environment
test.use({
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
});

/**
 * Helper function to set up authenticated test user
 */
async function setupTestUser(page: Page) {
  // Navigate to login and authenticate with test user
  await page.goto('/auth/signin');
  await page.waitForLoadState('networkidle');

  // Fill in test credentials
  await page.fill('input[type="email"]', testUserData.email);
  await page.fill('input[type="password"]', testUserData.password);
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForURL(/\/dashboard/);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper to mock current date for consistent testing
 */
async function mockCurrentDate(page: Page, dateStr: string) {
  await page.addInitScript(`{
    // Mock Date.now() and new Date() to return fixed date
    const mockDate = new Date('${dateStr}').getTime();
    Date.now = () => mockDate;
    const OriginalDate = Date;
    Date = class extends Date {
      constructor(...args) {
        if (args.length === 0) {
          super(mockDate);
        } else {
          super(...args);
        }
      }
    };
    Date.now = () => mockDate;
  }`);
}

/**
 * Helper to navigate to benefit claiming modal
 */
async function openClaimModal(page: Page, benefitName: string) {
  // Find the benefit card or row
  const benefitLocator = page.locator(`[data-testid="benefit-card"], [data-testid="benefit-row"]`)
    .filter({ hasText: benefitName });
  
  await expect(benefitLocator).toBeVisible();
  
  // Click the "Claim" or "Use" button
  const claimButton = benefitLocator.locator('button')
    .filter({ hasText: /claim|use/i });
  
  await claimButton.click();
  
  // Wait for modal to open
  await page.waitForSelector('[data-testid="claim-modal"], [role="dialog"]');
}

// ============================================================================
// SCENARIO 1: Happy Path - Monthly Benefit (Desktop)
// ============================================================================

test('Phase 6C Scenario 1: Monthly Uber benefit - Happy path claiming flow', async ({ page }) => {
  // Set desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  
  // Mock current date to March 15, 2026 (mid-month)
  await mockCurrentDate(page, '2026-03-15T10:00:00.000Z');
  
  // Setup authenticated user
  await setupTestUser(page);
  
  // Navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Verify Uber benefit shows correct monthly status
  const uberBenefit = page.locator('[data-testid="benefit-card"]')
    .filter({ hasText: 'Uber' });
  
  await expect(uberBenefit).toBeVisible();
  
  // Check for monthly status indicator
  await expect(uberBenefit.locator('.urgency-indicator, .period-status'))
    .toContainText(/\$15.*THIS MONTH.*Mar 31/i);
  
  // Verify urgency icon/color (should be low/green since mid-month)
  const urgencyIndicator = uberBenefit.locator('.urgency-indicator');
  await expect(urgencyIndicator).toHaveCSS('color', /green|#22c55e/);
  
  // Open claim modal
  await openClaimModal(page, 'Uber');
  
  // Verify modal shows correct pre-filled amount
  const modal = page.locator('[data-testid="claim-modal"]');
  await expect(modal).toBeVisible();
  
  const amountInput = modal.locator('input[name="amount"], input[name="usageAmount"]');
  await expect(amountInput).toHaveValue('15');
  
  // Verify modal shows period info
  await expect(modal).toContainText(/\$15.*available.*this month/i);
  await expect(modal).toContainText(/expires.*mar.*31/i);
  
  // Confirm the claim
  const confirmButton = modal.locator('button').filter({ hasText: /claim|confirm/i });
  await confirmButton.click();
  
  // Verify success message
  await expect(page.locator('.success-message, .toast'))
    .toContainText(/successfully.*claimed/i);
  
  // Verify modal closes
  await expect(modal).not.toBeVisible();
  
  // Verify progress bar shows 100%
  const progressBar = uberBenefit.locator('.progress-bar, [role="progressbar"]');
  await expect(progressBar).toHaveAttribute('aria-valuenow', '100');
  
  // Verify benefit status updated to "Used"
  await expect(uberBenefit).toContainText(/used|claimed|100%/i);
  
  // Take screenshot for visual verification
  await expect(page).toHaveScreenshot('scenario1-uber-claimed.png', {
    fullPage: true,
  });
});

// ============================================================================
// SCENARIO 2: Error - Over Limit (Mobile)
// ============================================================================

test('Phase 6C Scenario 2: Entertainment benefit over-limit error handling on mobile', async ({ page }) => {
  // Set mobile viewport
  await page.setViewportSize({ width: 375, height: 667 });
  
  // Mock current date
  await mockCurrentDate(page, '2026-03-20T14:30:00.000Z');
  
  // Setup authenticated user
  await setupTestUser(page);
  
  // Navigate to dashboard
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Find Entertainment benefit ($15/month limit)
  const entertainmentBenefit = page.locator('[data-testid="benefit-card"]')
    .filter({ hasText: /entertainment|streaming/i });
  
  await expect(entertainmentBenefit).toBeVisible();
  
  // Open claim modal
  await openClaimModal(page, 'Entertainment');
  
  const modal = page.locator('[data-testid="claim-modal"]');
  
  // Try to claim $20 (over $15 limit)
  const amountInput = modal.locator('input[name="amount"], input[name="usageAmount"]');
  await amountInput.clear();
  await amountInput.fill('20');
  
  // Submit the invalid amount
  const submitButton = modal.locator('button').filter({ hasText: /claim|submit/i });
  await submitButton.click();
  
  // Verify error message appears
  await expect(modal.locator('.error-message, .text-red'))
    .toContainText(/only.*\$15.*available/i);
  
  // Verify "Claim $15 instead?" suggestion button
  const suggestButton = modal.locator('button').filter({ hasText: /claim.*\$15.*instead/i });
  await expect(suggestButton).toBeVisible();
  
  // Click the suggestion button
  await suggestButton.click();
  
  // Verify amount input updated to $15
  await expect(amountInput).toHaveValue('15');
  
  // Confirm the corrected claim
  await submitButton.click();
  
  // Verify success
  await expect(page.locator('.success-message, .toast'))
    .toContainText(/successfully.*claimed/i);
  
  // Take mobile screenshot
  await expect(page).toHaveScreenshot('scenario2-mobile-over-limit.png', {
    fullPage: true,
  });
});

// ============================================================================
// SCENARIO 3: One-Time Benefit
// ============================================================================

test('Phase 6C Scenario 3: Global Entry one-time benefit claiming and re-attempt blocking', async ({ page }) => {
  // Desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  
  await mockCurrentDate(page, '2026-03-25T16:00:00.000Z');
  await setupTestUser(page);
  
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Find Global Entry benefit (ONE_TIME, $109)
  const globalEntryBenefit = page.locator('[data-testid="benefit-card"]')
    .filter({ hasText: /global.?entry/i });
  
  await expect(globalEntryBenefit).toBeVisible();
  
  // Verify it shows "One-time credit"
  await expect(globalEntryBenefit).toContainText(/one.?time.*credit/i);
  
  // Verify checkmark icon or similar indicator
  await expect(globalEntryBenefit.locator('.one-time-icon, .checkmark'))
    .toBeVisible();
  
  // Open claim modal
  await openClaimModal(page, 'Global Entry');
  
  const modal = page.locator('[data-testid="claim-modal"]');
  
  // Verify $109 amount
  const amountInput = modal.locator('input[name="amount"], input[name="usageAmount"]');
  await expect(amountInput).toHaveValue('109');
  
  // Claim the full amount
  const claimButton = modal.locator('button').filter({ hasText: /claim|confirm/i });
  await claimButton.click();
  
  // Verify success
  await expect(page.locator('.success-message, .toast'))
    .toContainText(/successfully.*claimed/i);
  
  // Wait for page to update
  await page.waitForTimeout(1000);
  
  // Verify benefit now shows "Already claimed" or similar
  await expect(globalEntryBenefit).toContainText(/already.*claimed|used/i);
  
  // Try to claim again - button should be disabled or show error
  const claimButtonAfter = globalEntryBenefit.locator('button')
    .filter({ hasText: /claim|use/i });
  
  if (await claimButtonAfter.isVisible()) {
    // If button still visible, it should be disabled
    await expect(claimButtonAfter).toBeDisabled();
  } else {
    // Or button might not be shown at all for one-time benefits
    await expect(globalEntryBenefit).toContainText(/already.*claimed/i);
  }
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

test('Phase 6C Accessibility: Focus management in claim modal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  
  await setupTestUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Open claim modal
  const benefit = page.locator('[data-testid="benefit-card"]').first();
  const claimButton = benefit.locator('button').filter({ hasText: /claim|use/i });
  await claimButton.click();
  
  // Modal should receive focus
  const modal = page.locator('[data-testid="claim-modal"], [role="dialog"]');
  await expect(modal).toBeFocused();
  
  // Tab through modal elements
  await page.keyboard.press('Tab');
  const amountInput = modal.locator('input[name="amount"], input[name="usageAmount"]');
  await expect(amountInput).toBeFocused();
  
  // Escape should close modal and return focus to trigger
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(claimButton).toBeFocused();
});

test('Phase 6C Accessibility: ARIA labels and screen reader support', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  
  await setupTestUser(page);
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  
  // Check benefit cards have proper ARIA labels
  const benefits = page.locator('[data-testid="benefit-card"]');
  
  for (let i = 0; i < Math.min(3, await benefits.count()); i++) {
    const benefit = benefits.nth(i);
    
    // Should have accessible name
    const accessibleName = await benefit.getAttribute('aria-label') || 
                          await benefit.locator('h3, .benefit-name').textContent();
    expect(accessibleName?.length).toBeGreaterThan(0);
    
    // Progress bars should have proper ARIA
    const progressBar = benefit.locator('[role="progressbar"]');
    if (await progressBar.isVisible()) {
      await expect(progressBar).toHaveAttribute('aria-valuenow');
      await expect(progressBar).toHaveAttribute('aria-valuemax');
      await expect(progressBar).toHaveAttribute('aria-label');
    }
  }
  
  // Check modal accessibility when opened
  await openClaimModal(page, 'Uber');
  
  const modal = page.locator('[data-testid="claim-modal"], [role="dialog"]');
  await expect(modal).toHaveAttribute('role', 'dialog');
  await expect(modal).toHaveAttribute('aria-modal', 'true');
  
  // Should have accessible title
  const title = modal.locator('h1, h2, [role="heading"]');
  const titleId = await title.getAttribute('id');
  if (titleId) {
    await expect(modal).toHaveAttribute('aria-labelledby', titleId);
  }
});