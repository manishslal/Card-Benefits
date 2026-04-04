# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-qa-manual.spec.ts >> Final QA - Manual Test Suite >> ✅ CRITICAL: Complete End-to-End User Journey
- Location: tests/final-qa-manual.spec.ts:17:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - button "Open Next.js Dev Tools" [ref=e7] [cursor=pointer]:
    - img [ref=e8]
  - alert [ref=e11]
  - link "Skip to main content" [ref=e12] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e13]:
    - banner [ref=e14]:
      - generic [ref=e15]:
        - link "CardTrack" [ref=e16] [cursor=pointer]:
          - /url: /
          - img [ref=e18]
          - heading "CardTrack" [level=1] [ref=e20]
        - button "Switch to dark mode" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
    - main [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]:
          - heading "Create Account" [level=2] [ref=e27]
          - paragraph [ref=e28]: Start tracking your credit card benefits
          - generic [ref=e29]: Internal server error
          - generic [ref=e30]:
            - generic [ref=e31]:
              - generic [ref=e32]: First Name
              - textbox "First Name" [ref=e34]:
                - /placeholder: John
                - text: TestUser
            - generic [ref=e35]:
              - generic [ref=e36]: Last Name
              - textbox "Last Name" [ref=e38]:
                - /placeholder: Doe
                - text: QA
            - generic [ref=e39]:
              - generic [ref=e40]: Email Address
              - textbox "Email Address" [ref=e42]:
                - /placeholder: you@example.com
                - text: qatest_1775273716778@example.com
            - generic [ref=e43]:
              - generic [ref=e44]: Password
              - textbox "Password" [ref=e46]:
                - /placeholder: ••••••••
                - text: TestPassword123!
              - paragraph [ref=e47]: At least 12 characters with uppercase, lowercase, number, and special character
            - generic [ref=e48]:
              - generic [ref=e49]: Confirm Password
              - textbox "Confirm Password" [ref=e51]:
                - /placeholder: ••••••••
                - text: TestPassword123!
            - button "Create Account" [ref=e52] [cursor=pointer]
          - generic [ref=e55]: OR
          - paragraph [ref=e57]:
            - text: Already have an account?
            - link "Sign in" [ref=e58] [cursor=pointer]:
              - /url: /login
        - paragraph [ref=e59]:
          - text: By creating an account, you agree to our
          - link "Terms of Service" [ref=e60] [cursor=pointer]:
            - /url: "#"
          - text: and
          - link "Privacy Policy" [ref=e61] [cursor=pointer]:
            - /url: "#"
```

# Test source

```ts
  1   | import { test, expect, Page } from '@playwright/test';
  2   | 
  3   | // Manual QA test for final verification
  4   | test.describe('Final QA - Manual Test Suite', () => {
  5   |   const baseURL = 'http://localhost:3000';
  6   |   let randomEmail: string;
  7   |   let testFirstName = 'TestUser';
  8   |   let testLastName = 'QA';
  9   |   let testPassword = 'TestPassword123!';
  10  | 
  11  |   test.beforeEach(async () => {
  12  |     // Generate unique email for each test
  13  |     const timestamp = Date.now();
  14  |     randomEmail = `qatest_${timestamp}@example.com`;
  15  |   });
  16  | 
  17  |   test('✅ CRITICAL: Complete End-to-End User Journey', async ({ page }) => {
  18  |     // 1. Homepage Navigation
  19  |     console.log('🏠 Testing homepage...');
  20  |     await page.goto(baseURL);
  21  |     await expect(page).toHaveTitle(/Card Benefits Tracker/);
  22  |     
  23  |     // Check basic navigation
  24  |     await expect(page.locator('text=Get Started Free')).toBeVisible();
  25  |     
  26  |     // 2. Sign Up Flow
  27  |     console.log('✍️ Testing signup...');
  28  |     await page.click('text=Get Started Free');
  29  |     await page.waitForURL(/signup/);
  30  |     
  31  |     await page.fill('input[name="firstName"]', testFirstName);
  32  |     await page.fill('input[name="lastName"]', testLastName);
  33  |     await page.fill('input[name="email"]', randomEmail);
  34  |     await page.fill('input[name="password"]', testPassword);
  35  |     await page.fill('input[name="confirmPassword"]', testPassword);
  36  |     
  37  |     await page.click('button[type="submit"]');
  38  |     
  39  |     // Should redirect to dashboard after signup
> 40  |     await page.waitForURL(/dashboard/, { timeout: 10000 });
      |                ^ TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  41  |     console.log('✅ Signup successful - redirected to dashboard');
  42  |     
  43  |     // 3. Dashboard Verification
  44  |     console.log('📊 Testing dashboard...');
  45  |     await expect(page.locator('text=Welcome')).toBeVisible();
  46  |     await expect(page.locator('text=No cards yet')).toBeVisible();
  47  |     
  48  |     // 4. Add Card Flow
  49  |     console.log('💳 Testing add card...');
  50  |     await page.click('text=Add Card');
  51  |     await page.waitForURL(/add-card/);
  52  |     
  53  |     // Select a card from dropdown
  54  |     await page.click('[data-testid="card-select-trigger"], [role="combobox"], .relative button');
  55  |     await page.waitForTimeout(1000);
  56  |     
  57  |     // Click on first available card option
  58  |     await page.click('[role="option"]:first-child, [data-value]:first-child');
  59  |     await page.waitForTimeout(500);
  60  |     
  61  |     await page.click('button[type="submit"]');
  62  |     
  63  |     // Should redirect back to dashboard with card
  64  |     await page.waitForURL(/dashboard/, { timeout: 10000 });
  65  |     console.log('✅ Card added successfully');
  66  |     
  67  |     // Verify card appears on dashboard
  68  |     await expect(page.locator('.grid').locator('div').first()).toBeVisible();
  69  |     
  70  |     // 5. Add Benefit Flow
  71  |     console.log('🎁 Testing add benefit...');
  72  |     // Click on the card to view details
  73  |     await page.click('.grid div:first-child');
  74  |     
  75  |     // Look for Add Benefit button
  76  |     const addBenefitBtn = page.locator('text=Add Benefit').first();
  77  |     if (await addBenefitBtn.isVisible()) {
  78  |       await addBenefitBtn.click();
  79  |       
  80  |       // Fill benefit form
  81  |       await page.fill('input[name="title"]', 'Test Benefit');
  82  |       await page.fill('textarea[name="description"]', 'Test benefit description');
  83  |       await page.fill('input[name="category"]', 'Travel');
  84  |       await page.fill('input[name="value"]', '5%');
  85  |       
  86  |       await page.click('button[type="submit"]');
  87  |       console.log('✅ Benefit added successfully');
  88  |     }
  89  |     
  90  |     // 6. Settings Page Test
  91  |     console.log('⚙️ Testing settings...');
  92  |     await page.goto(`${baseURL}/settings`);
  93  |     
  94  |     // Verify user data loads
  95  |     await expect(page.locator('input[name="firstName"]')).toHaveValue(testFirstName);
  96  |     await expect(page.locator('input[name="lastName"]')).toHaveValue(testLastName);
  97  |     await expect(page.locator('input[name="email"]')).toHaveValue(randomEmail);
  98  |     
  99  |     // Update profile
  100 |     await page.fill('input[name="firstName"]', 'UpdatedName');
  101 |     await page.click('button[type="submit"]');
  102 |     
  103 |     // Wait for success message or navigation
  104 |     await page.waitForTimeout(2000);
  105 |     console.log('✅ Settings updated successfully');
  106 |     
  107 |     // 7. Logout Test
  108 |     console.log('🚪 Testing logout...');
  109 |     await page.goto(`${baseURL}/dashboard`);
  110 |     
  111 |     // Look for logout button or menu
  112 |     const logoutBtn = page.locator('text=Logout, text=Sign Out').first();
  113 |     if (await logoutBtn.isVisible()) {
  114 |       await logoutBtn.click();
  115 |       await page.waitForURL(baseURL, { timeout: 5000 });
  116 |       console.log('✅ Logout successful');
  117 |     }
  118 |     
  119 |     // 8. Login Test
  120 |     console.log('🔑 Testing login...');
  121 |     await page.goto(`${baseURL}/login`);
  122 |     await page.fill('input[name="email"]', randomEmail);
  123 |     await page.fill('input[name="password"]', testPassword);
  124 |     await page.click('button[type="submit"]');
  125 |     
  126 |     await page.waitForURL(/dashboard/, { timeout: 10000 });
  127 |     console.log('✅ Login successful');
  128 |     
  129 |     // 9. Data Persistence Check
  130 |     console.log('💾 Testing data persistence...');
  131 |     await page.goto(`${baseURL}/settings`);
  132 |     await expect(page.locator('input[name="firstName"]')).toHaveValue('UpdatedName');
  133 |     console.log('✅ Data persistence confirmed');
  134 |     
  135 |     console.log('🎉 All critical flows completed successfully!');
  136 |   });
  137 | 
  138 |   test('🔍 Console Error Check', async ({ page }) => {
  139 |     const errors: string[] = [];
  140 |     
```