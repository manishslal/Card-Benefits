import { test, expect } from '@playwright/test';

test.describe('UI Structure Explorer', () => {
  test('explore app structure', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    console.log('Page title:', await page.title());
    console.log('Current URL:', page.url());
    
    // Take screenshot of homepage
    await page.screenshot({ path: 'homepage.png', fullPage: true });
    
    // Log all links on homepage
    const links = await page.locator('a').all();
    for (let link of links) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      console.log(`Link: "${text}" -> "${href}"`);
    }
    
    // Try to find signup link and navigate
    const signupLink = page.locator('a:has-text("Sign Up"), a:has-text("Register"), a[href*="signup"], button:has-text("Get Started")');
    if (await signupLink.count() > 0) {
      await signupLink.first().click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct navigation to signup
      await page.goto('/signup');
    }
    
    console.log('Signup page URL:', page.url());
    
    // Take screenshot of signup page
    await page.screenshot({ path: 'signup-page.png', fullPage: true });
    
    // Log all form fields on signup page
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} inputs on signup page:`);
    for (let input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      console.log(`Input: name="${name}", type="${type}", placeholder="${placeholder}"`);
    }
    
    // Log all buttons on signup page
    const buttons = await page.locator('button').all();
    console.log(`Found ${buttons.length} buttons on signup page:`);
    for (let button of buttons) {
      const text = await button.textContent();
      const type = await button.getAttribute('type');
      console.log(`Button: "${text}", type="${type}"`);
    }
    
    // Try to navigate to login page
    const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign In"), a[href*="login"]');
    if (await loginLink.count() > 0) {
      await loginLink.first().click();
      await page.waitForLoadState('networkidle');
      console.log('Login page URL:', page.url());
      await page.screenshot({ path: 'login-page.png', fullPage: true });
    } else {
      await page.goto('/login');
      console.log('Direct login page URL:', page.url());
      await page.screenshot({ path: 'login-page.png', fullPage: true });
    }
  });
});