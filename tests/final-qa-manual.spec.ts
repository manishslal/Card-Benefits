import { test, expect, Page } from '@playwright/test';

// Diagnostic test for signup issue
test.describe('Signup Diagnostic', () => {
  const baseURL = 'http://localhost:3000';
  
  test('Debug Signup Flow', async ({ page }) => {
    const timestamp = Date.now();
    const randomEmail = `debug_${timestamp}@example.com`;
    
    console.log('🔍 Debugging signup flow...');
    
    // Navigate to signup
    await page.goto(`${baseURL}/signup`);
    await page.screenshot({ path: 'debug-signup-page.png', fullPage: true });
    
    console.log('📸 Screenshot taken: debug-signup-page.png');
    
    // Fill form
    await page.fill('input[name="firstName"]', 'Debug');
    await page.fill('input[name="lastName"]', 'Test');
    await page.fill('input[name="email"]', randomEmail);
    await page.fill('input[name="password"]', 'DebugPassword123!');
    await page.fill('input[name="confirmPassword"]', 'DebugPassword123!');
    
    await page.screenshot({ path: 'debug-form-filled.png', fullPage: true });
    console.log('📸 Form filled screenshot: debug-form-filled.png');
    
    // Submit form and wait to see what happens
    console.log('🔵 Clicking submit button...');
    await page.click('button[type="submit"]');
    
    // Wait 3 seconds and take screenshot
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'debug-after-submit.png', fullPage: true });
    console.log('📸 After submit screenshot: debug-after-submit.png');
    
    // Check current URL
    const currentUrl = page.url();
    console.log('🔗 Current URL:', currentUrl);
    
    // Check for any error messages
    const errorMessages = await page.locator('[data-testid="error-message"], .error, .alert-error, [class*="error"], [role="alert"]').allTextContents();
    console.log('❌ Error messages found:', errorMessages);
    
    // Check for loading states
    const loadingElements = await page.locator('[data-testid="loading"], .loading, .spinner, [class*="loading"]').allTextContents();
    console.log('⏳ Loading elements found:', loadingElements);
    
    // Check form validation state
    const formButton = await page.locator('button[type="submit"]').textContent();
    const isDisabled = await page.locator('button[type="submit"]').isDisabled();
    console.log('🔘 Submit button text:', formButton, 'Disabled:', isDisabled);
    
    // Wait longer and check again
    await page.waitForTimeout(5000);
    const finalUrl = page.url();
    const finalScreenshot = 'debug-final-state.png';
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    
    console.log('🏁 Final URL:', finalUrl);
    console.log('📸 Final screenshot:', finalScreenshot);
    
    // Try to test API directly in browser
    const response = await page.evaluate(async (email) => {
      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'API',
            lastName: 'Test',
            email: email,
            password: 'ApiPassword123!'
          })
        });
        const data = await res.json();
        return { status: res.status, data };
      } catch (error) {
        return { error: error.message };
      }
    }, `api_test_${timestamp}@example.com`);
    
    console.log('🔌 Direct API test result:', response);
  });
});