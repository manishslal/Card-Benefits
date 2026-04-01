import { test, expect, Page } from '@playwright/test';

interface BreakpointConfig {
  name: string;
  width: number;
  height: number;
  expectedColumns: number;
  expectedTabBehavior: 'scroll' | 'grid';
}

const breakpoints: BreakpointConfig[] = [
  {
    name: 'Mobile',
    width: 375,
    height: 667,
    expectedColumns: 1,
    expectedTabBehavior: 'scroll'
  },
  {
    name: 'Tablet',
    width: 768,
    height: 1024,
    expectedColumns: 3, // Fixed: md:grid-cols-3 kicks in at 768px
    expectedTabBehavior: 'grid'
  },
  {
    name: 'Desktop',
    width: 1440,
    height: 900,
    expectedColumns: 3,
    expectedTabBehavior: 'grid'
  }
];

async function getGridColumns(page: Page): Promise<number> {
  // Look for the specific summary stats grid
  const summaryGrid = await page.locator('section div.grid').first();
  if (await summaryGrid.count() === 0) {
    return 1; // Fallback if no grid found
  }
  
  // Check computed styles for grid-template-columns
  const gridCols = await summaryGrid.evaluate((el) => {
    const computedStyle = window.getComputedStyle(el);
    const gridTemplateColumns = computedStyle.gridTemplateColumns;
    if (gridTemplateColumns && gridTemplateColumns !== 'none') {
      // Count the number of fr or px values (each represents a column)
      const matches = gridTemplateColumns.match(/(\d+\.?\d*fr|\d+px|minmax\([^)]*\)|auto)/g);
      return matches ? matches.length : 1;
    }
    return 1;
  });
  
  return gridCols || 1;
}

async function getVisibleCardCount(page: Page): Promise<number> {
  // Count the summary stat cards specifically
  await page.waitForSelector('section div.grid > div', { timeout: 5000 });
  const statCards = await page.locator('section div.grid > div').all();
  
  let visibleCount = 0;
  for (const card of statCards) {
    const isVisible = await card.isVisible();
    if (isVisible) {
      visibleCount++;
    }
  }
  
  return visibleCount;
}

async function checkTabScrollBehavior(page: Page): Promise<'scroll' | 'grid'> {
  const tabsContainer = await page.locator('[role="tablist"]').first();
  if (await tabsContainer.count() === 0) {
    return 'grid'; // Fallback
  }
  
  // Check the parent div that wraps the tablist for overflow-x-auto class
  const tabsWrapper = await page.locator('div.overflow-x-auto').first();
  if (await tabsWrapper.count() > 0) {
    // Check if overflow is actually needed (scroll width > client width)
    const needsScroll = await tabsWrapper.evaluate((el) => {
      return el.scrollWidth > el.clientWidth;
    });
    return needsScroll ? 'scroll' : 'grid';
  }
  
  return 'grid';
}

async function collectConsoleMessages(page: Page) {
  const messages: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  page.on('console', (msg) => {
    const text = msg.text();
    messages.push(text);
    
    if (msg.type() === 'error') {
      errors.push(text);
    } else if (msg.type() === 'warning') {
      warnings.push(text);
    }
  });
  
  return { messages, errors, warnings };
}

test.describe('Responsive Layout Tests', () => {
  let consoleData: { messages: string[], errors: string[], warnings: string[] };
  
  test.beforeEach(async ({ page }) => {
    consoleData = await collectConsoleMessages(page);
  });

  for (const breakpoint of breakpoints) {
    test(`${breakpoint.name} Layout (${breakpoint.width}x${breakpoint.height})`, async ({ page }) => {
      console.log(`\n=== Testing ${breakpoint.name} Layout ===`);
      
      // Set viewport
      await page.setViewportSize({ 
        width: breakpoint.width, 
        height: breakpoint.height 
      });
      
      // Navigate to the page
      await page.goto('http://localhost:3000');
      
      // Wait for page to load completely
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Additional wait for any hydration
      
      // Take screenshot
      await page.screenshot({ 
        path: `layout-${breakpoint.name.toLowerCase()}-${breakpoint.width}x${breakpoint.height}.png`,
        fullPage: true 
      });
      console.log(`📸 Screenshot taken: layout-${breakpoint.name.toLowerCase()}-${breakpoint.width}x${breakpoint.height}.png`);
      
      // Count visible cards
      const visibleCards = await getVisibleCardCount(page);
      console.log(`🃏 Visible cards: ${visibleCards}`);
      
      // Check grid columns
      const actualColumns = await getGridColumns(page);
      console.log(`📊 Grid columns detected: ${actualColumns}`);
      
      // Check tab behavior
      const tabBehavior = await checkTabScrollBehavior(page);
      console.log(`📑 Tab behavior: ${tabBehavior}`);
      
      // Verify grid columns match expected
      expect(actualColumns).toBe(breakpoint.expectedColumns);
      
      // Verify tab behavior matches expected
      expect(tabBehavior).toBe(breakpoint.expectedTabBehavior);
      
      // For desktop, we expect exactly 3 summary cards (not 9+ credit cards)
      if (breakpoint.name === 'Desktop') {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        
        const totalCards = await getVisibleCardCount(page);
        console.log(`🃏 Total cards after scrolling: ${totalCards}`);
        expect(totalCards).toBe(3); // Should be exactly 3 summary cards
      }
      
      // Check for console errors and warnings
      const hasHydrationWarnings = consoleData.warnings.some(warning => 
        warning.includes('hydration') || warning.includes('mismatch')
      );
      
      console.log(`⚠️ Console errors: ${consoleData.errors.length}`);
      console.log(`⚠️ Console warnings: ${consoleData.warnings.length}`);
      console.log(`💧 Hydration warnings: ${hasHydrationWarnings}`);
      
      if (consoleData.errors.length > 0) {
        console.log('❌ Console Errors:', consoleData.errors);
      }
      
      if (hasHydrationWarnings) {
        console.log('❌ Hydration Warnings:', consoleData.warnings.filter(w => 
          w.includes('hydration') || w.includes('mismatch')
        ));
      }
      
      // Assert no critical errors
      expect(consoleData.errors.filter(error => 
        !error.includes('favicon') && !error.includes('404')
      ).length).toBe(0);
      
      // Assert no hydration warnings
      expect(hasHydrationWarnings).toBe(false);
      
      console.log(`✅ ${breakpoint.name} layout test PASSED`);
    });
  }
  
  test('Summary Report', async ({ page }) => {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESPONSIVE LAYOUT TEST SUMMARY');
    console.log('='.repeat(60));
    
    const results = [];
    
    for (const breakpoint of breakpoints) {
      await page.setViewportSize({ 
        width: breakpoint.width, 
        height: breakpoint.height 
      });
      
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const visibleCards = await getVisibleCardCount(page);
      const actualColumns = await getGridColumns(page);
      const tabBehavior = await checkTabScrollBehavior(page);
      
      const result = {
        breakpoint: `${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`,
        visibleCards,
        gridColumns: actualColumns,
        expectedColumns: breakpoint.expectedColumns,
        tabBehavior,
        expectedTabBehavior: breakpoint.expectedTabBehavior,
        layoutStatus: actualColumns === breakpoint.expectedColumns ? 'PASS' : 'FAIL',
        tabStatus: tabBehavior === breakpoint.expectedTabBehavior ? 'PASS' : 'FAIL'
      };
      
      results.push(result);
    }
    
    // Print summary table
    console.log('\nBreakpoint Analysis:');
    console.log('-'.repeat(100));
    console.log('| Breakpoint        | Cards | Grid Cols | Tab Layout | Layout Status | Tab Status |');
    console.log('-'.repeat(100));
    
    results.forEach(result => {
      console.log(
        `| ${result.breakpoint.padEnd(17)} | ${String(result.visibleCards).padEnd(5)} | ` +
        `${result.gridColumns}/${result.expectedColumns}       | ${result.tabBehavior.padEnd(10)} | ` +
        `${result.layoutStatus.padEnd(13)} | ${result.tabStatus.padEnd(10)} |`
      );
    });
    
    console.log('-'.repeat(100));
    
    const allLayoutsPassed = results.every(r => r.layoutStatus === 'PASS');
    const allTabsPassed = results.every(r => r.tabStatus === 'PASS');
    const overallStatus = allLayoutsPassed && allTabsPassed ? 'PASS' : 'FAIL';
    
    console.log(`\n🎯 Overall Status: ${overallStatus}`);
    console.log(`📐 Layout Tests: ${allLayoutsPassed ? 'PASS' : 'FAIL'}`);
    console.log(`📑 Tab Tests: ${allTabsPassed ? 'PASS' : 'FAIL'}`);
    
    if (overallStatus === 'FAIL') {
      const failedTests = results.filter(r => r.layoutStatus === 'FAIL' || r.tabStatus === 'FAIL');
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(result => {
        console.log(`   - ${result.breakpoint}: Layout=${result.layoutStatus}, Tabs=${result.tabStatus}`);
      });
    }
    
    console.log('\n📸 Screenshots generated:');
    results.forEach(result => {
      const name = result.breakpoint.split(' ')[0].toLowerCase();
      const size = result.breakpoint.match(/\((.*?)\)/)?.[1] || '';
      console.log(`   - layout-${name}-${size.replace('x', 'x')}.png`);
    });
    
    console.log('='.repeat(60));
  });
});