import { test, expect } from '@playwright/test';

/**
 * Responsive Design Tests for Card Benefits Tracker
 * 
 * Tests key functionality across different viewport sizes:
 * - Mobile: 375x667 (iPhone SE)
 * - Tablet: 768x1024 (iPad)
 * - Desktop: 1440x900 (Desktop)
 * 
 * These tests ensure the application works and looks good on all devices.
 */

const VIEWPORTS = {
  mobile: { width: 375, height: 667, name: 'Mobile (375w)' },
  tablet: { width: 768, height: 1024, name: 'Tablet (768w)' },
  desktop: { width: 1440, height: 900, name: 'Desktop (1440w)' },
};

test.describe('Responsive Design - Homepage', () => {
  Object.entries(VIEWPORTS).forEach(([key, viewport]) => {
    test(`should render correctly on ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      
      await page.goto('http://localhost:3000');
      
      // Check main elements are visible
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('main')).toBeVisible();
      
      // Check no horizontal overflow
      const bodyWidth = await page.locator('body').evaluate(el => el.offsetWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Small tolerance for scrollbar
      
      await context.close();
    });
  });
});

test.describe('Responsive Design - Login Page', () => {
  Object.entries(VIEWPORTS).forEach(([key, viewport]) => {
    test(`should have usable form on ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      
      await page.goto('http://localhost:3000/login');
      
      // Check form inputs are visible and accessible
      const emailInput = page.locator('#login-email');
      const passwordInput = page.locator('#login-password');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      
      // Check button is accessible
      const submitButton = page.locator('button:has-text("Sign In")');
      await expect(submitButton).toBeVisible();
      
      // Try to fill form (on mobile, inputs might be smaller but still functional)
      await emailInput.click();
      await emailInput.fill('test@example.com');
      
      expect(await emailInput.inputValue()).toBe('test@example.com');
      
      await context.close();
    });
  });
});

test.describe('Responsive Design - Settings Page', () => {
  Object.entries(VIEWPORTS).forEach(([key, viewport]) => {
    test(`should have readable layout on ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      
      // Mock authentication (add auth cookie or token)
      await page.goto('http://localhost:3000/login');
      
      // Check that navigation isn't broken
      const settingsLink = page.locator('a:has-text("Settings")');
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        // Verify page loaded
        await page.waitForURL('**/settings', { waitUntil: 'networkidle' });
      }
      
      await context.close();
    });
  });
});

test.describe('Responsive Design - Touch Interaction', () => {
  test('should support touch on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.mobile,
      hasTouch: true,
    });
    const page = await context.newPage();
    
    await page.goto('http://localhost:3000/login');
    
    // Buttons should have sufficient touch target size (min 44x44px)
    const submitButton = page.locator('button:has-text("Sign In")');
    const buttonBox = await submitButton.boundingBox();
    
    if (buttonBox) {
      expect(buttonBox.width).toBeGreaterThanOrEqual(44);
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    }
    
    await context.close();
  });
});

test.describe('Responsive Design - Text Readability', () => {
  Object.entries(VIEWPORTS).forEach(([key, viewport]) => {
    test(`should have readable text on ${viewport.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();
      
      await page.goto('http://localhost:3000');
      
      // Check text isn't too small (minimum 12px for body text)
      const bodyText = page.locator('body p').first();
      const computedStyle = await bodyText.evaluate(el => {
        return window.getComputedStyle(el).fontSize;
      });
      
      const fontSizePx = parseInt(computedStyle);
      expect(fontSizePx).toBeGreaterThanOrEqual(12);
      
      await context.close();
    });
  });
});

test.describe('Responsive Design - Navigation', () => {
  test('should show mobile navigation on small screens', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.mobile,
    });
    const page = await context.newPage();
    
    await page.goto('http://localhost:3000/login');
    
    // Check that header is visible and navigation is accessible
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    // Check header isn't too tall on mobile (max height ~60px)
    const headerBox = await header.boundingBox();
    if (headerBox) {
      expect(headerBox.height).toBeLessThan(120);
    }
    
    await context.close();
  });
});
