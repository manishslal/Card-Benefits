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

async function checkConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

async function signUpUser(page: Page, user: any) {
  await page.goto('/signup');
  await page.fill('[name="firstName"]', user.firstName);
  await page.fill('[name="lastName"]', user.lastName);
  await page.fill('[name="email"]', user.email);
  await page.fill('[name="password"]', user.password);
  await page.click('button[type="submit"]');
}

async function loginUser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
}

// Main Test Suite
test.describe('Card Benefits Tracker - Comprehensive Functional QA', () => {
  let testUser: any;
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    testUser = await generateTestUser();
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Log any console errors found during the test
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
  });

  // 1. Authentication Flow Tests
  test.describe('1. Authentication Flow', () => {
    test('should allow user registration with valid data', async ({ page }) => {
      await page.goto('/signup');
      
      // Check page loads correctly
      await expect(page).toHaveTitle(/Card Benefits Tracker/);
      
      // Fill and submit registration form
      await signUpUser(page, testUser);
      
      // Should redirect to dashboard after successful signup
      await expect(page).toHaveURL(/\/dashboard/);
      
      // Should show user name in header
      await expect(page.locator('[data-testid="user-name"], .user-name, header')).toContainText(testUser.firstName, { timeout: 10000 });
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/signup');
      
      await page.fill('[name="firstName"]', testUser.firstName);
      await page.fill('[name="lastName"]', testUser.lastName);
      await page.fill('[name="email"]', testUser.email);
      
      // Test weak password
      await page.fill('[name="password"]', '123');
      await page.click('button[type="submit"]');
      
      // Should show validation error
      await expect(page.locator('.error, [role="alert"], .text-red-500')).toBeVisible({ timeout: 5000 });
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/signup');
      
      await page.fill('[name="firstName"]', testUser.firstName);
      await page.fill('[name="lastName"]', testUser.lastName);
      await page.fill('[name="email"]', 'invalid-email');
      await page.fill('[name="password"]', testUser.password);
      await page.click('button[type="submit"]');
      
      // Should show email validation error
      await expect(page.locator('.error, [role="alert"], .text-red-500')).toBeVisible({ timeout: 5000 });
    });

    test('should allow login after registration', async ({ page }) => {
      // First register
      await signUpUser(page, testUser);
      
      // Logout
      await page.click('[data-testid="logout"], .logout, button:has-text("Logout"), button:has-text("Sign Out")');
      
      // Login again
      await loginUser(page, testUser.email, testUser.password);
      
      // Should be on dashboard
      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('should reject invalid login credentials', async ({ page }) => {
      await page.goto('/login');
      
      await page.fill('[name="email"]', 'nonexistent@example.com');
      await page.fill('[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('.error, [role="alert"], .text-red-500')).toBeVisible({ timeout: 5000 });
    });
  });

  // 2. Dashboard Flow Tests
  test.describe('2. Dashboard Flow', () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, testUser);
    });

    test('should load dashboard after login', async ({ page }) => {
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('h1, h2')).toContainText(/Dashboard|Cards|My Cards/, { timeout: 10000 });
    });

    test('should show "No cards yet" message when empty', async ({ page }) => {
      await expect(page.locator('text="No cards yet", text="No credit cards", text="Add your first card"')).toBeVisible({ timeout: 10000 });
    });

    test('should have working Add Card button', async ({ page }) => {
      await page.click('button:has-text("Add Card"), [data-testid="add-card"]');
      
      // Modal should open
      await expect(page.locator('[role="dialog"], .modal, .popup')).toBeVisible({ timeout: 5000 });
    });

    test('should be responsive on different screen sizes', async ({ page }) => {
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      
      // Should still show main content
      await expect(page.locator('h1, h2')).toBeVisible();
      
      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      
      await expect(page.locator('h1, h2')).toBeVisible();
      
      // Test desktop view
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.reload();
      
      await expect(page.locator('h1, h2')).toBeVisible();
    });
  });

  // 3. Add Card Functionality Tests
  test.describe('3. Add Card Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, testUser);
    });

    test('should successfully add a new card', async ({ page }) => {
      // Open add card modal
      await page.click('button:has-text("Add Card"), [data-testid="add-card"]');
      
      // Wait for modal to open
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible({ timeout: 5000 });
      
      // Fill card details
      await page.selectOption('select[name="cardType"], [data-testid="card-type-select"]', { label: /Sapphire|Chase|Platinum/ });
      await page.fill('[name="nickname"]', 'My Test Card');
      await page.fill('[name="applyDate"], [type="date"]', '2024-01-15');
      
      // Submit form
      await page.click('button[type="submit"]:has-text("Add"), button:has-text("Save")');
      
      // Modal should close and card should appear
      await expect(page.locator('[role="dialog"], .modal')).toBeHidden({ timeout: 5000 });
      await expect(page.locator('text="My Test Card"')).toBeVisible({ timeout: 10000 });
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('button:has-text("Add Card"), [data-testid="add-card"]');
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
      
      // Try to submit without filling required fields
      await page.click('button[type="submit"]:has-text("Add"), button:has-text("Save")');
      
      // Should show validation errors
      await expect(page.locator('.error, [role="alert"], .text-red-500')).toBeVisible({ timeout: 5000 });
    });

    test('should persist card data after page reload', async ({ page }) => {
      // Add a card
      await page.click('button:has-text("Add Card"), [data-testid="add-card"]');
      await expect(page.locator('[role="dialog"], .modal')).toBeVisible();
      
      await page.selectOption('select[name="cardType"], [data-testid="card-type-select"]', { index: 0 });
      await page.fill('[name="nickname"]', 'Persistence Test Card');
      await page.fill('[name="applyDate"], [type="date"]', '2024-01-15');
      await page.click('button[type="submit"]:has-text("Add"), button:has-text("Save")');
      
      // Verify card appears
      await expect(page.locator('text="Persistence Test Card"')).toBeVisible({ timeout: 10000 });
      
      // Reload page
      await page.reload();
      
      // Card should still be there
      await expect(page.locator('text="Persistence Test Card"')).toBeVisible({ timeout: 10000 });
    });
  });

  // 5. Settings Page Flow Tests
  test.describe('5. Settings Page Flow', () => {
    test.beforeEach(async ({ page }) => {
      await signUpUser(page, testUser);
    });

    test('should navigate to settings page', async ({ page }) => {
      // Click settings link
      await page.click('a:has-text("Settings"), [data-testid="settings"], .settings');
      
      // Should be on settings page
      await expect(page).toHaveURL(/\/settings/);
      await expect(page.locator('h1, h2')).toContainText(/Settings|Profile/, { timeout: 10000 });
    });

    test('should show current user data in settings', async ({ page }) => {
      await page.click('a:has-text("Settings"), [data-testid="settings"], .settings');
      
      // Should show user's actual data, not placeholder
      await expect(page.locator('[name="firstName"]')).toHaveValue(testUser.firstName);
      await expect(page.locator('[name="lastName"]')).toHaveValue(testUser.lastName);
      await expect(page.locator('[name="email"]')).toHaveValue(testUser.email);
    });
  });

  // 9. Browser Console Tests
  test.describe('9. Browser Console Quality', () => {
    test('should have no critical console errors during normal usage', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      // Go through normal user flow
      await signUpUser(page, testUser);
      
      await page.click('button:has-text("Add Card"), [data-testid="add-card"]');
      await page.waitForTimeout(2000);
      
      if (await page.locator('[role="dialog"], .modal').isVisible()) {
        await page.keyboard.press('Escape');
      }
      
      // Filter out minor/expected errors
      const criticalErrors = errors.filter(error => 
        !error.includes('favicon') && 
        !error.includes('ads') &&
        !error.includes('analytics') &&
        !error.toLowerCase().includes('warning')
      );
      
      expect(criticalErrors).toEqual([]);
    });
  });
});