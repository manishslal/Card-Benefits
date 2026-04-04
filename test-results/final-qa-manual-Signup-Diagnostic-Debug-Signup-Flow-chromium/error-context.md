# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: final-qa-manual.spec.ts >> Signup Diagnostic >> Debug Signup Flow
- Location: tests/final-qa-manual.spec.ts:7:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.textContent: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button[type="submit"]')

```

# Page snapshot

```yaml
- generic:
  - generic [active]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - navigation [ref=e6]:
            - button "previous" [disabled] [ref=e7]:
              - img "previous" [ref=e8]
            - generic [ref=e10]:
              - generic [ref=e11]: 1/
              - text: "1"
            - button "next" [disabled] [ref=e12]:
              - img "next" [ref=e13]
          - img
        - generic [ref=e15]:
          - link "Next.js 15.5.14 (outdated) Webpack" [ref=e16] [cursor=pointer]:
            - /url: https://nextjs.org/docs/messages/version-staleness
            - img [ref=e17]
            - generic "An outdated version detected (latest is 16.2.2), upgrade is highly recommended!" [ref=e19]: Next.js 15.5.14 (outdated)
            - generic [ref=e20]: Webpack
          - img
      - generic [ref=e21]:
        - dialog "Runtime Error" [ref=e22]:
          - generic [ref=e25]:
            - generic [ref=e26]:
              - generic [ref=e27]:
                - generic [ref=e29]: Runtime Error
                - generic [ref=e30]:
                  - button "Copy Error Info" [ref=e31] [cursor=pointer]:
                    - img [ref=e32]
                  - button "No related documentation found" [disabled] [ref=e34]:
                    - img [ref=e35]
                  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools" [ref=e37] [cursor=pointer]:
                    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
                    - img [ref=e38]
              - paragraph [ref=e47]: "ENOENT: no such file or directory, open '/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/.next/server/pages-manifest.json'"
            - generic [ref=e50]:
              - paragraph [ref=e51]:
                - text: Call Stack
                - generic [ref=e52]: "31"
              - button "Show 31 ignore-listed frame(s)" [ref=e53] [cursor=pointer]:
                - text: Show 31 ignore-listed frame(s)
                - img [ref=e54]
          - generic [ref=e56]:
            - generic [ref=e57]: "1"
            - generic [ref=e58]: "2"
        - contentinfo [ref=e59]:
          - region "Error feedback" [ref=e60]:
            - paragraph [ref=e61]:
              - link "Was this helpful?" [ref=e62] [cursor=pointer]:
                - /url: https://nextjs.org/telemetry#error-feedback
            - button "Mark as helpful" [ref=e63] [cursor=pointer]:
              - img [ref=e64]
            - button "Mark as not helpful" [ref=e67] [cursor=pointer]:
              - img [ref=e68]
    - generic [ref=e74] [cursor=pointer]:
      - button "Open Next.js Dev Tools" [ref=e75]:
        - img [ref=e76]
      - generic [ref=e79]:
        - button "Open issues overlay" [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e82]: "0"
            - generic [ref=e83]: "1"
          - generic [ref=e84]: Issue
        - button "Collapse issues badge" [ref=e85]:
          - img [ref=e86]
  - alert [ref=e88]
```

# Test source

```ts
  1  | import { test, expect, Page } from '@playwright/test';
  2  | 
  3  | // Diagnostic test for signup issue
  4  | test.describe('Signup Diagnostic', () => {
  5  |   const baseURL = 'http://localhost:3000';
  6  |   
  7  |   test('Debug Signup Flow', async ({ page }) => {
  8  |     const timestamp = Date.now();
  9  |     const randomEmail = `debug_${timestamp}@example.com`;
  10 |     
  11 |     console.log('🔍 Debugging signup flow...');
  12 |     
  13 |     // Navigate to signup
  14 |     await page.goto(`${baseURL}/signup`);
  15 |     await page.screenshot({ path: 'debug-signup-page.png', fullPage: true });
  16 |     
  17 |     console.log('📸 Screenshot taken: debug-signup-page.png');
  18 |     
  19 |     // Fill form
  20 |     await page.fill('input[name="firstName"]', 'Debug');
  21 |     await page.fill('input[name="lastName"]', 'Test');
  22 |     await page.fill('input[name="email"]', randomEmail);
  23 |     await page.fill('input[name="password"]', 'DebugPassword123!');
  24 |     await page.fill('input[name="confirmPassword"]', 'DebugPassword123!');
  25 |     
  26 |     await page.screenshot({ path: 'debug-form-filled.png', fullPage: true });
  27 |     console.log('📸 Form filled screenshot: debug-form-filled.png');
  28 |     
  29 |     // Submit form and wait to see what happens
  30 |     console.log('🔵 Clicking submit button...');
  31 |     await page.click('button[type="submit"]');
  32 |     
  33 |     // Wait 3 seconds and take screenshot
  34 |     await page.waitForTimeout(3000);
  35 |     await page.screenshot({ path: 'debug-after-submit.png', fullPage: true });
  36 |     console.log('📸 After submit screenshot: debug-after-submit.png');
  37 |     
  38 |     // Check current URL
  39 |     const currentUrl = page.url();
  40 |     console.log('🔗 Current URL:', currentUrl);
  41 |     
  42 |     // Check for any error messages
  43 |     const errorMessages = await page.locator('[data-testid="error-message"], .error, .alert-error, [class*="error"], [role="alert"]').allTextContents();
  44 |     console.log('❌ Error messages found:', errorMessages);
  45 |     
  46 |     // Check for loading states
  47 |     const loadingElements = await page.locator('[data-testid="loading"], .loading, .spinner, [class*="loading"]').allTextContents();
  48 |     console.log('⏳ Loading elements found:', loadingElements);
  49 |     
  50 |     // Check form validation state
> 51 |     const formButton = await page.locator('button[type="submit"]').textContent();
     |                                                                    ^ Error: locator.textContent: Test timeout of 30000ms exceeded.
  52 |     const isDisabled = await page.locator('button[type="submit"]').isDisabled();
  53 |     console.log('🔘 Submit button text:', formButton, 'Disabled:', isDisabled);
  54 |     
  55 |     // Wait longer and check again
  56 |     await page.waitForTimeout(5000);
  57 |     const finalUrl = page.url();
  58 |     const finalScreenshot = 'debug-final-state.png';
  59 |     await page.screenshot({ path: finalScreenshot, fullPage: true });
  60 |     
  61 |     console.log('🏁 Final URL:', finalUrl);
  62 |     console.log('📸 Final screenshot:', finalScreenshot);
  63 |     
  64 |     // Try to test API directly in browser
  65 |     const response = await page.evaluate(async (email) => {
  66 |       try {
  67 |         const res = await fetch('/api/auth/signup', {
  68 |           method: 'POST',
  69 |           headers: { 'Content-Type': 'application/json' },
  70 |           body: JSON.stringify({
  71 |             firstName: 'API',
  72 |             lastName: 'Test',
  73 |             email: email,
  74 |             password: 'ApiPassword123!'
  75 |           })
  76 |         });
  77 |         const data = await res.json();
  78 |         return { status: res.status, data };
  79 |       } catch (error) {
  80 |         return { error: error.message };
  81 |       }
  82 |     }, `api_test_${timestamp}@example.com`);
  83 |     
  84 |     console.log('🔌 Direct API test result:', response);
  85 |   });
  86 | });
```