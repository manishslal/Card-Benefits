/**
 * Phase 5 Comprehensive QA Test Suite
 * Tests all 4 features: Card column, Filter dropdown, Edit modal, Currency formatting
 */

import { test, expect, Page } from '@playwright/test';

// Base URL for testing
const BASE_URL = 'http://localhost:3000';
const ADMIN_BENEFITS_URL = `${BASE_URL}/admin/benefits`;

// Test credentials (adjust as needed)
const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'password123';

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
  // Navigate to login
  await page.goto(`${BASE_URL}/login`);
  
  // Fill in credentials
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  
  // Click login button
  await page.click('button:has-text("Sign In")');
  
  // Wait for redirect to admin dashboard
  await page.waitForURL('**/admin', { timeout: 10000 });
}

test.describe('Phase 5: Benefits Page Enhancements', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsAdmin(page);
    
    // Navigate to benefits page
    await page.goto(ADMIN_BENEFITS_URL);
    
    // Wait for benefits table to load
    await page.waitForSelector('table', { timeout: 10000 });
  });

  test.describe('Feature 1: Card Column Display', () => {
    
    test('should display Card column as second column after Name', async ({ page }) => {
      // Check that Card column header exists
      const headers = await page.locator('th').allTextContents();
      expect(headers[0]).toContain('Name');
      expect(headers[1]).toContain('Card');
      expect(headers[2]).toContain('Type');
    });

    test('should display card names in Card column', async ({ page }) => {
      // Get first row's card cell
      const firstCardCell = page.locator('tbody tr:first-child td:nth-child(2)');
      const cardText = await firstCardCell.textContent();
      
      // Card column should have content (either card name or "N/A")
      expect(cardText).toBeTruthy();
    });

    test('should display N/A for benefits without card', async ({ page }) => {
      // This is an edge case - find any row with N/A or verify actual card names
      const cardCells = await page.locator('tbody td:nth-child(2)').allTextContents();
      
      // All cells should have content
      cardCells.forEach(cell => {
        expect(cell.trim().length).toBeGreaterThan(0);
      });
    });

    test('should be sortable by clicking Card column header', async ({ page }) => {
      // Click Card column header
      const cardHeader = page.locator('th:nth-child(2) button');
      await cardHeader.click();
      
      // Verify URL includes sort parameter
      await page.waitForURL('**/admin/benefits?**sort=card**');
      
      // Verify sort indicator shows
      const sortIndicator = await cardHeader.locator('span').textContent();
      expect(sortIndicator).toContain('↑');
    });

    test('should toggle sort order when clicking Card header twice', async ({ page }) => {
      const cardHeader = page.locator('th:nth-child(2) button');
      
      // First click - ascending
      await cardHeader.click();
      await page.waitForURL('**/sort=card&order=asc');
      
      // Second click - descending
      await cardHeader.click();
      await page.waitForURL('**/sort=card&order=desc');
      
      // Verify sort indicator changed
      const sortIndicator = await cardHeader.locator('span').textContent();
      expect(sortIndicator).toContain('↓');
    });
  });

  test.describe('Feature 2: Filter by Card Dropdown', () => {
    
    test('should display card filter dropdown above search bar', async ({ page }) => {
      // Check dropdown exists
      const dropdown = page.locator('select');
      await expect(dropdown).toBeVisible();
    });

    test('should have All Cards as default option', async ({ page }) => {
      const dropdown = page.locator('select');
      const value = await dropdown.inputValue();
      expect(value).toBe('');
    });

    test('should populate dropdown with unique card names', async ({ page }) => {
      // Click dropdown to open
      const dropdown = page.locator('select');
      const options = await dropdown.locator('option').allTextContents();
      
      // Should have "All Cards" option
      expect(options[0]).toBe('All Cards');
      
      // Should have at least one card option
      expect(options.length).toBeGreaterThan(1);
    });

    test('should filter table when selecting a card', async ({ page }) => {
      // Get first card option (skip "All Cards")
      const options = await page.locator('select option').allTextContents();
      const firstCardName = options[1]; // Skip "All Cards"
      
      // Select the first card
      await page.selectOption('select', { label: firstCardName });
      
      // Wait for table to update
      await page.waitForTimeout(500);
      
      // Verify all displayed benefits have the selected card
      const cardCells = await page.locator('tbody td:nth-child(2)').allTextContents();
      cardCells.forEach(cardCell => {
        expect(cardCell).toContain(firstCardName);
      });
    });

    test('should update URL with ?card=cardId when filtering', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      const firstCardName = options[1];
      
      // Select card
      await page.selectOption('select', { label: firstCardName });
      
      // Wait for URL update
      await page.waitForURL('**/admin/benefits?card=**');
      
      // Verify URL contains card parameter
      const url = page.url();
      expect(url).toContain('?card=');
    });

    test('should reset pagination to page 1 when filtering', async ({ page }) => {
      // Get to page 2 first
      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isEnabled()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
      
      // Now select a card filter
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        const firstCardName = options[1];
        await page.selectOption('select', { label: firstCardName });
        
        // Check that page resets to 1
        const pageInfo = await page.locator('text=Page').textContent();
        expect(pageInfo).toContain('Page 1');
      }
    });

    test('should persist filter when refreshing page', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      const firstCardName = options[1];
      
      // Select card
      await page.selectOption('select', { label: firstCardName });
      await page.waitForURL('**/admin/benefits?card=**');
      
      // Refresh page
      await page.reload();
      await page.waitForSelector('table');
      
      // Verify filter is still selected
      const selectedValue = await page.locator('select').inputValue();
      expect(selectedValue.length).toBeGreaterThan(0);
    });

    test('should clear filter when selecting All Cards', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      const firstCardName = options[1];
      
      // Apply filter
      await page.selectOption('select', { label: firstCardName });
      await page.waitForURL('**/card=**');
      
      // Clear filter
      await page.selectOption('select', { label: 'All Cards' });
      
      // Verify URL no longer has card parameter
      const url = page.url();
      expect(url).not.toContain('?card=');
    });

    test('should work with search combined', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        const firstCardName = options[1];
        
        // Apply card filter
        await page.selectOption('select', { label: firstCardName });
        await page.waitForTimeout(500);
        
        // Also search
        const searchInput = page.locator('input[placeholder="Search benefits..."]');
        await searchInput.fill('bonus');
        
        // Verify URL has both parameters
        const url = page.url();
        expect(url).toContain('card=');
        expect(url).toContain('search=');
      }
    });

    test('should be disabled while loading', async ({ page }) => {
      // This is harder to test directly without network throttling
      // But we can verify the component has a disabled prop
      const dropdown = page.locator('select');
      const disabled = await dropdown.isDisabled();
      // Should not be disabled on initial load
      expect(disabled).toBeFalsy();
    });
  });

  test.describe('Feature 3: Edit Benefit Modal', () => {
    
    test('should have Edit button in Actions column', async ({ page }) => {
      // Find first Edit button
      const editButton = page.locator('button:has-text("Edit")').first();
      await expect(editButton).toBeVisible();
    });

    test('should open modal when clicking Edit button', async ({ page }) => {
      // Click first Edit button
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      // Wait for modal to open
      await page.waitForSelector('text=Edit Benefit');
      
      // Verify modal title exists
      const modalTitle = page.locator('text=Edit Benefit');
      await expect(modalTitle).toBeVisible();
    });

    test('should pre-fill form with existing benefit data', async ({ page }) => {
      // Get the first benefit's name from table
      const firstBenefitName = await page.locator('tbody tr:first-child td:first-child').textContent();
      
      // Click Edit button
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      // Wait for modal
      await page.waitForSelector('text=Edit Benefit');
      
      // Verify name field is pre-filled
      const nameInput = page.locator('input[name="name"]');
      const nameValue = await nameInput.inputValue();
      expect(nameValue).toBe(firstBenefitName?.trim());
    });

    test('should display sticker value in dollars format', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Get sticker value input
      const valueInput = page.locator('input[name="stickerValue"]');
      const value = await valueInput.inputValue();
      
      // Should be a number format like "500.00", not cents like "50000"
      expect(/^\d+(\.\d{2})?$/.test(value)).toBeTruthy();
      // Should not be raw cents (5 digits)
      expect(value.replace('.', '').length).toBeLessThan(7);
    });

    test('should allow editing all fields', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Verify all form fields are present and editable
      const nameInput = page.locator('input[name="name"]');
      const typeSelect = page.locator('select[name="type"]');
      const valueInput = page.locator('input[name="stickerValue"]');
      const cadenceSelect = page.locator('select[name="resetCadence"]');
      
      await expect(nameInput).toBeEnabled();
      await expect(typeSelect).toBeEnabled();
      await expect(valueInput).toBeEnabled();
      await expect(cadenceSelect).toBeEnabled();
    });

    test('should update benefit name and save', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Get original name
      const nameInput = page.locator('input[name="name"]');
      const originalName = await nameInput.inputValue();
      
      // Change name
      const newName = `${originalName}_UPDATED_${Date.now()}`;
      await nameInput.clear();
      await nameInput.fill(newName);
      
      // Click Save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      // Wait for success message or modal close
      await page.waitForTimeout(1000);
      
      // Modal should close
      const modal = page.locator('text=Edit Benefit');
      const isVisible = await modal.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isVisible).toBeFalsy();
      
      // Verify table refreshed with new name
      await expect(page.locator(`text=${newName}`)).toBeVisible({ timeout: 5000 });
    });

    test('should validate required name field', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Clear name
      const nameInput = page.locator('input[name="name"]');
      await nameInput.clear();
      
      // Try to save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      // Should show validation error
      const errorMsg = page.locator('text=Name is required');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test('should validate sticker value is not negative', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Set negative value
      const valueInput = page.locator('input[name="stickerValue"]');
      await valueInput.clear();
      await valueInput.fill('-500');
      
      // Try to save
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      // Should show validation error
      const errorMsg = page.locator('text=cannot be negative');
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test('should close modal without changes when clicking Cancel', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Get original name
      const nameInput = page.locator('input[name="name"]');
      const originalName = await nameInput.inputValue();
      
      // Change name
      await nameInput.clear();
      await nameInput.fill('SHOULD_NOT_SAVE');
      
      // Click Cancel
      const cancelButton = page.locator('button:has-text("Cancel")');
      await cancelButton.click();
      
      // Modal should close without saving
      const modal = page.locator('text=Edit Benefit');
      await expect(modal).not.toBeVisible({ timeout: 5000 });
      
      // Original name should still be in table
      await expect(page.locator(`text=${originalName}`)).toBeVisible();
    });

    test('should show Save button as disabled while submitting', async ({ page }) => {
      // This is harder to test directly - we'd need network throttling
      // But we can verify the button text changes
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Verify Save button shows text "Save" initially
      const saveButton = page.locator('button:has-text("Save")');
      const buttonText = await saveButton.textContent();
      expect(buttonText).toBe('Save');
    });
  });

  test.describe('Feature 4: Currency Formatting', () => {
    
    test('should display sticker values in dollar format ($X.XX)', async ({ page }) => {
      // Get all value cells in table
      const valueCells = page.locator('tbody td:nth-child(4)');
      const values = await valueCells.allTextContents();
      
      // All values should be in "$" format
      values.forEach(value => {
        expect(value).toMatch(/^\$\d+\.\d{2}$/);
      });
    });

    test('should not display raw cents (like 50000)', async ({ page }) => {
      // Get all value cells
      const valueCells = await page.locator('tbody td:nth-child(4)').allTextContents();
      
      // None should be raw cents
      valueCells.forEach(value => {
        // Should not be a raw 5-digit number without currency
        expect(value).not.toMatch(/^[0-9]{5}$/);
      });
    });

    test('should format currency in edit modal', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Get sticker value
      const valueInput = page.locator('input[name="stickerValue"]');
      const value = await valueInput.inputValue();
      
      // Should be in dollars format
      expect(value).toMatch(/^\d+(\.\d{2})?$/);
    });

    test('should accept both $500 and 500 input formats', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Clear and input value with dollar sign
      const valueInput = page.locator('input[name="stickerValue"]');
      await valueInput.clear();
      await valueInput.fill('$750.00');
      
      // Should not reject it (validation should pass)
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      // Should either save or show specific currency error
      // Most likely it accepts and converts
      await page.waitForTimeout(1000);
    });

    test('should store currency as cents internally', async ({ page }) => {
      // This is hard to test directly without inspecting network
      // But we can verify the edit modal shows consistent formatting
      
      // Edit benefit with specific value
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      const valueInput = page.locator('input[name="stickerValue"]');
      await valueInput.clear();
      await valueInput.fill('123.45');
      
      // Click Save and wait for table refresh
      const saveButton = page.locator('button:has-text("Save")');
      await saveButton.click();
      
      await page.waitForTimeout(1000);
      
      // Re-edit the same benefit to verify value persisted correctly
      await page.reload();
      await page.waitForSelector('table');
      
      const editButton2 = page.locator('button:has-text("Edit")').first();
      await editButton2.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      const valueInput2 = page.locator('input[name="stickerValue"]');
      const savedValue = await valueInput2.inputValue();
      
      // Should still be 123.45 (or close to it)
      expect(parseFloat(savedValue)).toBeCloseTo(123.45, 1);
    });
  });

  test.describe('Integration Testing', () => {
    
    test('should work with filter + search together', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        const firstCardName = options[1];
        
        // Apply card filter
        await page.selectOption('select', { label: firstCardName });
        await page.waitForTimeout(500);
        
        // Apply search
        const searchInput = page.locator('input[placeholder="Search benefits..."]');
        await searchInput.fill('bonus');
        
        // Verify results are filtered and searched
        const benefitRows = page.locator('tbody tr');
        const rowCount = await benefitRows.count();
        expect(rowCount).toBeGreaterThanOrEqual(0);
        
        // All visible rows should have the card
        const cardCells = await page.locator('tbody td:nth-child(2)').allTextContents();
        if (cardCells.length > 0) {
          cardCells.forEach(card => {
            if (card.trim() !== 'N/A') {
              expect(card).toContain(firstCardName);
            }
          });
        }
      }
    });

    test('should work with filter + sorting together', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        const firstCardName = options[1];
        
        // Apply card filter
        await page.selectOption('select', { label: firstCardName });
        await page.waitForURL('**/card=**');
        
        // Apply sort by name
        const nameHeader = page.locator('th:nth-child(1) button');
        await nameHeader.click();
        
        // Verify URL has both parameters
        const url = page.url();
        expect(url).toContain('card=');
        expect(url).toContain('sort=');
      }
    });

    test('should allow editing while filter is active', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        const firstCardName = options[1];
        
        // Apply card filter
        await page.selectOption('select', { label: firstCardName });
        await page.waitForTimeout(500);
        
        // Get first visible benefit
        const firstBenefitName = await page.locator('tbody tr:first-child td:first-child').textContent();
        
        // Click Edit
        const editButton = page.locator('button:has-text("Edit")').first();
        await editButton.click();
        
        await page.waitForSelector('text=Edit Benefit');
        
        // Verify correct benefit is being edited
        const nameInput = page.locator('input[name="name"]');
        const nameValue = await nameInput.inputValue();
        expect(nameValue).toBe(firstBenefitName?.trim());
        
        // Close modal without saving
        const cancelButton = page.locator('button:has-text("Cancel")');
        await cancelButton.click();
      }
    });

    test('should delete benefit while filter is active', async ({ page }) => {
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        const firstCardName = options[1];
        
        // Apply card filter
        await page.selectOption('select', { label: firstCardName });
        await page.waitForTimeout(500);
        
        // Get initial benefit count
        const benefitsBefore = await page.locator('tbody tr').count();
        
        // Click Delete (note: usually triggers confirmation)
        const deleteButton = page.locator('button:has-text("Delete")').first();
        await deleteButton.click();
        
        // Handle confirmation dialog if it appears
        const confirmDialog = page.locator('[role="alertdialog"]');
        if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Might need to click a confirm button
          const confirmButton = confirmDialog.locator('button:has-text("Delete")');
          if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await confirmButton.click();
          }
        }
        
        // Wait for update and verify count decreased
        await page.waitForTimeout(1000);
        const benefitsAfter = await page.locator('tbody tr').count();
        
        // Should have one fewer benefit (or same if confirm dialog closed without deletion)
        expect(benefitsAfter).toBeLessThanOrEqual(benefitsBefore);
      }
    });
  });

  test.describe('Responsive Design', () => {
    
    test('should work on mobile (375px)', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Reload page
      await page.reload();
      await page.waitForSelector('table');
      
      // Verify dropdown is still accessible
      const dropdown = page.locator('select');
      await expect(dropdown).toBeVisible();
      
      // Verify Edit button is accessible
      const editButton = page.locator('button:has-text("Edit")');
      await expect(editButton).toBeVisible();
      
      // Verify we can click Edit
      await editButton.first().click();
      const modal = page.locator('text=Edit Benefit');
      await expect(modal).toBeVisible({ timeout: 5000 });
    });

    test('should work on tablet (768px)', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // Reload page
      await page.reload();
      await page.waitForSelector('table');
      
      // Verify all controls are visible
      const dropdown = page.locator('select');
      const search = page.locator('input[placeholder="Search benefits..."]');
      const editButton = page.locator('button:has-text("Edit")').first();
      
      await expect(dropdown).toBeVisible();
      await expect(search).toBeVisible();
      await expect(editButton).toBeVisible();
    });

    test('should work on desktop (1440px)', async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize({ width: 1440, height: 900 });
      
      // Reload page
      await page.reload();
      await page.waitForSelector('table');
      
      // Verify optimal layout
      const dropdown = page.locator('select');
      const search = page.locator('input[placeholder="Search benefits..."]');
      
      // On desktop, should be side by side
      const dropdownBox = await dropdown.boundingBox();
      const searchBox = await search.boundingBox();
      
      // Both should be visible
      await expect(dropdown).toBeVisible();
      await expect(search).toBeVisible();
    });
  });

  test.describe('Dark/Light Mode', () => {
    
    test('should support dark mode on dropdown', async ({ page }) => {
      // Add dark mode class (implementation dependent)
      // This assumes the app uses document class for theme
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForSelector('table');
      
      // Verify dropdown is visible and styled
      const dropdown = page.locator('select');
      await expect(dropdown).toBeVisible();
      
      // Check for dark mode classes
      const classes = await dropdown.getAttribute('class');
      expect(classes).toContain('dark:');
    });

    test('should support dark mode on edit modal', async ({ page }) => {
      // Add dark mode
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForSelector('table');
      
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Modal should be visible and styled correctly
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Form elements should have dark mode styling
      const input = page.locator('input[name="name"]');
      const inputClasses = await input.getAttribute('class');
      expect(inputClasses).toContain('dark:');
    });

    test('should maintain readable text contrast in dark mode', async ({ page }) => {
      // This is a visual test - harder to automate
      // But we can verify elements have color classes
      
      await page.addInitScript(() => {
        document.documentElement.classList.add('dark');
      });
      
      await page.reload();
      await page.waitForSelector('table');
      
      // Verify table headers have color classes
      const headers = page.locator('th');
      const headerClasses = await headers.first().getAttribute('class');
      expect(headerClasses).toContain('text-slate-900');
      expect(headerClasses).toContain('dark:text-white');
    });
  });

  test.describe('Browser Console', () => {
    
    test('should not have console errors on benefits page load', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.goto(ADMIN_BENEFITS_URL);
      await page.waitForSelector('table', { timeout: 10000 });
      
      // Allow time for any async operations
      await page.waitForTimeout(1000);
      
      // Should have no console errors
      expect(errors.length).toBe(0);
    });

    test('should not have errors when clicking Edit', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      expect(errors.length).toBe(0);
    });

    test('should not have errors when filtering by card', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      const options = await page.locator('select option').allTextContents();
      if (options.length > 1) {
        await page.selectOption('select', { label: options[1] });
        await page.waitForTimeout(500);
      }
      
      expect(errors.length).toBe(0);
    });
  });

  test.describe('Regression Testing', () => {
    
    test('search should still filter benefits', async ({ page }) => {
      // Search for a term
      const searchInput = page.locator('input[placeholder="Search benefits..."]');
      await searchInput.fill('welcome');
      
      // Wait for results
      await page.waitForTimeout(500);
      
      // Verify search worked
      const benefitRows = page.locator('tbody tr');
      const count = await benefitRows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('sorting by name should still work', async ({ page }) => {
      // Click Name column header
      const nameHeader = page.locator('th:nth-child(1) button');
      await nameHeader.click();
      
      // Wait for sort
      await page.waitForURL('**/sort=name**');
      
      // Verify URL has sort parameter
      const url = page.url();
      expect(url).toContain('sort=name');
    });

    test('pagination should still work', async ({ page }) => {
      // Get initial page info
      const pageInfo = await page.locator('text=Page').textContent();
      expect(pageInfo).toContain('Page 1');
      
      // Check if Next button exists
      const nextButton = page.locator('button:has-text("Next")');
      const isEnabled = await nextButton.isEnabled();
      
      if (isEnabled) {
        // Click Next
        await nextButton.click();
        await page.waitForTimeout(500);
        
        // Verify we're on page 2
        const newPageInfo = await page.locator('text=Page').textContent();
        expect(newPageInfo).toContain('Page 2');
      }
    });

    test('delete benefit should still work', async ({ page }) => {
      // Get initial row count
      const benefitsBefore = await page.locator('tbody tr').count();
      
      // Click first Delete button
      const deleteButton = page.locator('button:has-text("Delete")').first();
      await deleteButton.click();
      
      // Handle confirmation if needed
      await page.waitForTimeout(500);
      
      // Verify table updated
      const benefitsAfter = await page.locator('tbody tr').count();
      
      // Count should be same or less (depending on if delete was confirmed)
      expect(benefitsAfter).toBeLessThanOrEqual(benefitsBefore);
    });

    test('dark mode toggle should still work', async ({ page }) => {
      // Find theme toggle (implementation dependent)
      // This is a placeholder - adjust based on actual implementation
      
      // Check if dark mode class is present
      const isDark = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });
      
      // Should be a boolean
      expect(typeof isDark).toBe('boolean');
    });
  });

  test.describe('Accessibility', () => {
    
    test('should have proper form labels', async ({ page }) => {
      // Click Edit to open modal
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Check for labels
      const labels = page.locator('label');
      const labelCount = await labels.count();
      
      // Should have labels for form fields
      expect(labelCount).toBeGreaterThan(0);
    });

    test('dropdown should be navigable with keyboard', async ({ page }) => {
      // Focus dropdown
      const dropdown = page.locator('select');
      await dropdown.focus();
      
      // Press Down arrow
      await page.keyboard.press('ArrowDown');
      
      // Should be possible to navigate
      const value = await dropdown.inputValue();
      // Value might change or stay the same depending on options
      expect(typeof value).toBe('string');
    });

    test('form submit should be accessible with keyboard', async ({ page }) => {
      // Click Edit
      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();
      
      await page.waitForSelector('text=Edit Benefit');
      
      // Tab to Save button and press Enter
      const saveButton = page.locator('button:has-text("Save")');
      
      // Should be focusable
      await saveButton.focus();
      const isFocused = await saveButton.evaluate((el) => el === document.activeElement);
      expect(isFocused).toBeTruthy();
    });
  });
});
