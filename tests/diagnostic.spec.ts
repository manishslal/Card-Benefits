import { test, expect } from '@playwright/test';

test('Diagnostic - Check app basic functionality', async ({ page }) => {
  console.log('🔍 STARTING DIAGNOSTIC TEST');
  
  // Check if server is running
  const response = await page.goto('/');
  console.log(`Homepage response status: ${response?.status()}`);
  
  // Check console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    consoleErrors.push(`Page Error: ${error.message}`);
  });
  
  // Take screenshot of current state
  await page.screenshot({ path: 'test-results/diagnostic-homepage.png', fullPage: true });
  
  // Check if we can navigate to key pages
  try {
    await page.goto('/signup');
    console.log('✅ Signup page accessible');
    await page.screenshot({ path: 'test-results/diagnostic-signup.png', fullPage: true });
  } catch (e) {
    console.log('❌ Signup page not accessible:', e);
  }
  
  try {
    await page.goto('/login');
    console.log('✅ Login page accessible');
    await page.screenshot({ path: 'test-results/diagnostic-login.png', fullPage: true });
  } catch (e) {
    console.log('❌ Login page not accessible:', e);
  }
  
  // Try a basic signup flow
  try {
    await page.goto('/signup');
    const timestamp = Date.now();
    
    await page.fill('[name="firstName"]', 'TestUser');
    await page.fill('[name="lastName"]', 'QA');
    await page.fill('[name="email"]', `qa-test-${timestamp}@example.com`);
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.fill('[name="confirmPassword"]', 'TestPassword123!');
    
    console.log('✅ Form fields filled successfully');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`URL after signup attempt: ${currentUrl}`);
    
    if (currentUrl.includes('dashboard')) {
      console.log('✅ Signup successful - redirected to dashboard');
      await page.screenshot({ path: 'test-results/diagnostic-dashboard.png', fullPage: true });
    } else {
      console.log('⚠️ Signup may have failed or validation prevented submission');
      await page.screenshot({ path: 'test-results/diagnostic-signup-result.png', fullPage: true });
    }
    
  } catch (e) {
    console.log('❌ Signup flow failed:', e);
  }
  
  // Report console errors
  if (consoleErrors.length > 0) {
    console.log('🚨 CONSOLE ERRORS DETECTED:');
    consoleErrors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
  } else {
    console.log('✅ No console errors detected');
  }
  
  console.log('🔍 DIAGNOSTIC TEST COMPLETE');
});