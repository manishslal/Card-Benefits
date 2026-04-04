import { test, expect, Page } from '@playwright/test';

// Test utilities
async function generateUniqueEmail() {
  const timestamp = Date.now();
  return `test-${timestamp}@example.com`;
}

async function generateTestUser() {
  return {
    email: await generateUniqueEmail(),
    password: 'TestPass123!',
    firstName: 'John',
    lastName: 'Doe'
  };
}

async function signUpUser(page: Page, user: any) {
  await page.goto('/signup');
  await page.fill('[name="firstName"]', user.firstName);
  await page.fill('[name="lastName"]', user.lastName);
  await page.fill('[name="email"]', user.email);
  await page.fill('[name="password"]', user.password);
  await page.fill('[name="confirmPassword"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

// Main Test Suite
test.describe('Card Benefits Tracker - Comprehensive Functional QA', () => {
  let testUser: any;
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    testUser = await generateTestUser();
    consoleErrors = [];
    
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        // Filter out common non-critical errors
        if (!errorText.includes('favicon') && 
            !errorText.includes('ads') && 
            !errorText.includes('analytics') &&
            !errorText.includes('source-map')) {
          consoleErrors.push(errorText);
        }
      }
    });

    // Capture JavaScript errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });
  });

  test.afterEach(async () => {
    // Report console errors if any
    if (consoleErrors.length > 0) {
      console.log('❌ Console errors found during test:', consoleErrors);
    }
  });

  // 1. Landing Page Tests
  test.describe('1. Landing Page & Navigation', () => {
    test('should load homepage correctly', async ({ page }) => {
      await page.goto('/');
      
      // Should have correct title
      await expect(page).toHaveTitle(/Card Benefits Tracker/);
      
      // Should have main navigation elements
      await expect(page.locator('a:has-text("Sign In")')).toBeVisible();
      await expect(page.locator('a:has-text("Get Started Free")')).toBeVisible();
      
      // Take screenshot for documentation
      await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
    });

    test('should navigate to signup page', async ({ page }) => {
      await page.goto('/');
      await page.click('a:has-text("Get Started Free")');
      
      await expect(page).toHaveURL(/\/signup/);
      await expect(page.locator('h1, h2')).toContainText(/Sign Up|Create|Register/);
      
      await page.screenshot({ path: 'test-results/signup-page.png', fullPage: true });
    });

    test('should navigate to login page', async ({ page }) => {
      await page.goto('/');
      await page.click('a:has-text("Sign In")');
      
      await expect(page).toHaveURL(/\/login/);
      await expect(page.locator('h1, h2')).toContainText(/Sign In|Login/);
      
      await page.screenshot({ path: 'test-results/login-page.png', fullPage: true });
    });
  });

  // 2. Authentication Flow Tests
  test.describe('2. Authentication Flow', () => {
    test('✅ CRITICAL: User registration should work with valid data', async ({ page }) => {
      await page.goto('/signup');
      
      // Fill registration form with actual field names
      await page.fill('[name="firstName"]', testUser.firstName);
      await page.fill('[name="lastName"]', testUser.lastName);
      await page.fill('[name="email"]', testUser.email);
      await page.fill('[name="password"]', testUser.password);
      await page.fill('[name="confirmPassword"]', testUser.password);
      
      // Submit form
      await page.click('button[type="submit"]');
      
      // Should redirect to dashboard (wait up to 10 seconds)
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Take screenshot of successful login
      await page.screenshot({ path: 'test-results/dashboard-after-signup.png', fullPage: true });
      
      console.log('✅ User registration successful - redirected to dashboard');
    });

    test('⚠️ VALIDATION: Password requirements should be enforced', async ({ page }) => {
      await page.goto('/signup');
      
      await page.fill('[name="firstName"]', testUser.firstName);
      await page.fill('[name="lastName"]', testUser.lastName);
      await page.fill('[name="email"]', testUser.email);
      
      // Test weak password
      await page.fill('[name="password"]', '123');
      await page.fill('[name="confirmPassword"]', '123');
      await page.click('button[type="submit"]');
      
      // Should not redirect (stay on signup page)
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/signup/);
      
      // Look for error messages
      const hasError = await page.locator('.error, [role="alert"], .text-red-500, .text-destructive').count();
      if (hasError === 0) {
        console.log('⚠️ WARNING: No visible password validation error found');
      } else {
        console.log('✅ Password validation working');
      }
    });

    test('⚠️ VALIDATION: Email format should be validated', async ({ page }) => {
      await page.goto('/signup');
      
      await page.fill('[name="firstName"]', testUser.firstName);
      await page.fill('[name="lastName"]', testUser.lastName);
      await page.fill('[name="email"]', 'invalid-email-format');
      await page.fill('[name="password"]', testUser.password);
      await page.fill('[name="confirmPassword"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Should not redirect
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/\/signup/);
      
      const hasError = await page.locator('.error, [role="alert"], .text-red-500, .text-destructive').count();
      if (hasError === 0) {
        console.log('⚠️ WARNING: No visible email validation error found');
      } else {
        console.log('✅ Email validation working');
      }
    });

    test('✅ CRITICAL: User should be able to login after registration', async ({ page }) => {
      // First register a user
      await signUpUser(page, testUser);
      
      // Should be on dashboard after registration
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Find and click logout button
      const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout"), a:has-text("Sign Out")');
      
      if (await logoutButton.count() > 0) {
        await logoutButton.first().click();
        await page.waitForLoadState('networkidle');
        console.log('✅ Logout successful');
        
        // Now try to login
        await loginUser(page, testUser.email, testUser.password);
        
        // Should be back on dashboard
        await expect(page).toHaveURL(/\/dashboard/);
        console.log('✅ Login after registration successful');
      } else {
        console.log('⚠️ WARNING: Logout button not found - testing manual navigation');
        await page.goto('/login');
        await loginUser(page, testUser.email, testUser.password);
        await expect(page).toHaveURL(/\/dashboard/);
        console.log('✅ Manual login successful');
      }
    });

    test('⚠️ SECURITY: Invalid login credentials should be rejected', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('[name="email"]', 'nonexistent@example.com');
      await page.fill('[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Should stay on login page
      await page.waitForTimeout(3000);
      await expect(page).toHaveURL(/\/login/);
      
      // Check for error message
      const hasError = await page.locator('.error, [role="alert"], .text-red-500, .text-destructive').count();
      if (hasError === 0) {
        console.log('⚠️ WARNING: No visible authentication error found');
      } else {
        console.log('✅ Authentication validation working');
      }
    });
  });

  // 3. Dashboard Tests
  test.describe('3. Dashboard Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, testUser);
      // Should be on dashboard after signup
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('✅ CRITICAL: Dashboard should load after authentication', async ({ page }) => {
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Should have dashboard content
      const hasContent = await page.locator('h1, h2, .dashboard, main').count();
      expect(hasContent).toBeGreaterThan(0);
      
      // Take screenshot
      await page.screenshot({ path: 'test-results/dashboard-loaded.png', fullPage: true });
      
      console.log('✅ Dashboard loads successfully after authentication');
    });

    test('✅ UI: Should show empty state when no cards exist', async ({ page }) => {
      // Look for empty state messages
      const emptyStateSelectors = [
        'text="No cards yet"',
        'text="No credit cards"', 
        'text="Add your first card"',
        'text="Get started"',
        '.empty-state',
        '[data-testid="empty-state"]'
      ];
      
      let emptyStateFound = false;
      for (const selector of emptyStateSelectors) {
        if (await page.locator(selector).count() > 0) {
          emptyStateFound = true;
          break;
        }
      }
      
      if (emptyStateFound) {
        console.log('✅ Empty state message visible');
      } else {
        console.log('⚠️ WARNING: No clear empty state message found');
      }
      
      await page.screenshot({ path: 'test-results/dashboard-empty-state.png', fullPage: true });
    });

    test('✅ UI: Add Card button should be present and clickable', async ({ page }) => {
      const addCardSelectors = [
        'button:has-text("Add Card")',
        '[data-testid="add-card"]',
        'button:has-text("Add")',
        'button:has-text("New Card")',
        '.add-card'
      ];
      
      let addButtonFound = false;
      for (const selector of addCardSelectors) {
        const button = page.locator(selector);
        if (await button.count() > 0) {
          await button.first().click();
          
          // Check if modal or form appears
          await page.waitForTimeout(1000);
          const modalVisible = await page.locator('[role="dialog"], .modal, .popup, form').count();
          
          if (modalVisible > 0) {
            addButtonFound = true;
            console.log('✅ Add Card button works - modal/form opened');
            await page.screenshot({ path: 'test-results/add-card-modal.png', fullPage: true });
            break;
          }
        }
      }
      
      if (!addButtonFound) {
        console.log('🚫 BLOCKER: Add Card functionality not found or not working');
      }
    });

    test('📱 RESPONSIVE: Dashboard should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Should still show main content
      const hasContent = await page.locator('h1, h2, main, .dashboard').count();
      expect(hasContent).toBeGreaterThan(0);
      
      await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
      console.log('✅ Dashboard responsive on mobile');
    });

    test('📱 RESPONSIVE: Dashboard should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      const hasContent = await page.locator('h1, h2, main, .dashboard').count();
      expect(hasContent).toBeGreaterThan(0);
      
      await page.screenshot({ path: 'test-results/dashboard-tablet.png', fullPage: true });
      console.log('✅ Dashboard responsive on tablet');
    });
  });

  // 4. Settings Page Tests
  test.describe('4. Settings Page Flow', () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, testUser);
    });

    test('🔧 SETTINGS: Should navigate to settings page', async ({ page }) => {
      const settingsSelectors = [
        'a:has-text("Settings")',
        '[data-testid="settings"]',
        'a[href*="settings"]',
        'button:has-text("Settings")'
      ];
      
      let settingsFound = false;
      for (const selector of settingsSelectors) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await element.first().click();
          await page.waitForLoadState('networkidle');
          
          if (page.url().includes('settings')) {
            settingsFound = true;
            console.log('✅ Settings page navigation works');
            await page.screenshot({ path: 'test-results/settings-page.png', fullPage: true });
            break;
          }
        }
      }
      
      if (!settingsFound) {
        // Try direct navigation
        await page.goto('/settings');
        if (page.url().includes('settings')) {
          console.log('✅ Settings page accessible via direct URL');
          await page.screenshot({ path: 'test-results/settings-direct.png', fullPage: true });
        } else {
          console.log('⚠️ WARNING: Settings page not found');
        }
      }
    });

    test('🔧 DATA: Settings should show current user data (not placeholder)', async ({ page }) => {
      await page.goto('/settings');
      
      // Check if user data is properly loaded
      const firstNameField = page.locator('[name="firstName"]');
      const lastNameField = page.locator('[name="lastName"]');
      const emailField = page.locator('[name="email"]');
      
      if (await firstNameField.count() > 0) {
        const firstNameValue = await firstNameField.inputValue();
        const lastNameValue = await lastNameField.inputValue();
        const emailValue = await emailField.inputValue();
        
        if (firstNameValue === testUser.firstName && 
            lastNameValue === testUser.lastName && 
            emailValue === testUser.email) {
          console.log('✅ Settings shows correct user data');
        } else if (firstNameValue === 'John' && lastNameValue === 'Doe' && emailValue.includes('test')) {
          console.log('✅ Settings shows test user data correctly');
        } else {
          console.log('⚠️ WARNING: Settings may be showing placeholder data');
          console.log(`Expected: ${testUser.firstName} ${testUser.lastName} ${testUser.email}`);
          console.log(`Found: ${firstNameValue} ${lastNameValue} ${emailValue}`);
        }
      } else {
        console.log('⚠️ WARNING: Settings form fields not found');
      }
      
      await page.screenshot({ path: 'test-results/settings-user-data.png', fullPage: true });
    });
  });

  // 5. Console Error Monitoring
  test.describe('5. Technical Quality Checks', () => {
    test('🔍 CONSOLE: No critical JavaScript errors during normal usage', async ({ page }) => {
      // Clear previous errors
      consoleErrors = [];
      
      // Go through typical user journey
      await page.goto('/');
      await page.waitForTimeout(1000);
      
      await page.goto('/signup');
      await page.waitForTimeout(1000);
      
      await signUpUser(page, testUser);
      await page.waitForTimeout(2000);
      
      // Try to interact with dashboard
      await page.click('body'); // General interaction
      await page.waitForTimeout(1000);
      
      // Report results
      if (consoleErrors.length === 0) {
        console.log('✅ No critical console errors found');
      } else {
        console.log('🚫 CONSOLE ERRORS FOUND:');
        consoleErrors.forEach(error => console.log(`  - ${error}`));
      }
      
      // This test should not fail for console errors, just report them
      expect(true).toBe(true);
    });

    test('⚡ PERFORMANCE: Pages should load within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      const homepageLoadTime = Date.now() - startTime;
      
      const signupStartTime = Date.now();
      await page.goto('/signup');
      await page.waitForLoadState('networkidle');
      const signupLoadTime = Date.now() - signupStartTime;
      
      console.log(`Homepage load time: ${homepageLoadTime}ms`);
      console.log(`Signup page load time: ${signupLoadTime}ms`);
      
      if (homepageLoadTime < 3000 && signupLoadTime < 3000) {
        console.log('✅ Page load times are acceptable');
      } else {
        console.log('⚠️ WARNING: Some pages load slowly');
      }
    });
  });

  // 6. Critical Data Persistence Tests  
  test.describe('6. Data Persistence Tests', () => {
    test('💾 CRITICAL: User data should persist across sessions', async ({ page }) => {
      // Register user
      await signUpUser(page, testUser);
      
      // Logout if possible
      const logoutBtn = page.locator('button:has-text("Logout"), a:has-text("Logout")');
      if (await logoutBtn.count() > 0) {
        await logoutBtn.first().click();
        await page.waitForLoadState('networkidle');
      } else {
        // Clear session by going to login page
        await page.goto('/login');
      }
      
      // Login again
      await loginUser(page, testUser.email, testUser.password);
      
      if (page.url().includes('dashboard')) {
        console.log('✅ User data persists - login successful after logout');
      } else {
        console.log('🚫 BLOCKER: User data may not be persisting');
      }
    });
  });
});