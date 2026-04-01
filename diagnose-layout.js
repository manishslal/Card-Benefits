const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function diagnose() {
  const browser = await chromium.launch({ headless: true });
  const report = [];
  
  report.push("=== DASHBOARD LAYOUT DIAGNOSTIC REPORT ===\n");
  report.push(new Date().toISOString() + "\n\n");

  try {
    // ===== DESKTOP LAYOUT (1440px) =====
    report.push("SECTION 1: DESKTOP LAYOUT (1440px)\n");
    report.push("=====================================\n");
    
    const desktopContext = await browser.createBrowserContext({
      viewport: { width: 1440, height: 900 }
    });
    const desktopPage = await desktopContext.newPage();
    
    // Capture console messages
    desktopPage.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        report.push(`[${msg.type()}] ${msg.text()}\n`);
      }
    });
    
    await desktopPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    report.push("✓ Page loaded\n\n");
    
    // Take desktop screenshot
    const desktopScreenshot = await desktopPage.screenshot({ fullPage: true, path: 'layout-desktop-full.png' });
    report.push("✓ Desktop screenshot saved to layout-desktop-full.png\n\n");
    
    // Measure layout dimensions
    const desktopMetrics = await desktopPage.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const main = document.querySelector('main');
      const mainContainer = document.querySelector('[class*="flex"]') || document.querySelector('[class*="container"]');
      
      return {
        bodyHeight: body.scrollHeight,
        bodyClientHeight: body.clientHeight,
        htmlHeight: html.scrollHeight,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
        mainHeight: main ? main.scrollHeight : 'N/A',
        mainClientHeight: main ? main.clientHeight : 'N/A',
        mainContainerHeight: mainContainer ? mainContainer.scrollHeight : 'N/A',
        overflowY: window.getComputedStyle(html).overflowY
      };
    });
    
    report.push("DESKTOP MEASUREMENTS:\n");
    report.push(`  Body scroll height: ${desktopMetrics.bodyHeight}px\n`);
    report.push(`  Body client height: ${desktopMetrics.bodyClientHeight}px\n`);
    report.push(`  HTML scroll height: ${desktopMetrics.htmlHeight}px\n`);
    report.push(`  Viewport: ${desktopMetrics.viewportWidth}x${desktopMetrics.viewportHeight}px\n`);
    report.push(`  Main element height: ${desktopMetrics.mainHeight} / ${desktopMetrics.mainClientHeight}px\n`);
    report.push(`  HTML overflow-y: ${desktopMetrics.overflowY}\n\n`);
    
    // Check DOM structure
    report.push("DESKTOP DOM STRUCTURE:\n");
    const domStructure = await desktopPage.evaluate(() => {
      const elements = {
        hasMain: !!document.querySelector('main'),
        hasNav: !!document.querySelector('nav'),
        hasSidebar: !!document.querySelector('aside'),
        hasTabs: !!document.querySelector('[role="tablist"]'),
        hasCards: document.querySelectorAll('[class*="card"], [class*="Card"]').length,
        playerTabsContainer: !!document.getElementById('player-tabs-container'),
        tabsContent: !!document.querySelector('[role="tabpanel"]'),
        cardTrackerPanel: !!document.querySelector('[class*="CardTrackerPanel"]'),
        benefitTable: !!document.querySelector('[class*="BenefitTable"]'),
      };
      
      // Get visibility of major sections
      const sections = [];
      document.querySelectorAll('section, [role="region"]').forEach((el, i) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        sections.push({
          index: i,
          height: el.scrollHeight,
          display: style.display,
          visibility: style.visibility,
          isInViewport: rect.top < window.innerHeight && rect.bottom > 0,
          top: rect.top,
          width: el.offsetWidth
        });
      });
      
      return { elements, sections };
    });
    
    report.push(`  Main element: ${domStructure.elements.hasMain ? '✓' : '✗'}\n`);
    report.push(`  Nav element: ${domStructure.elements.hasNav ? '✓' : '✗'}\n`);
    report.push(`  Sidebar: ${domStructure.elements.hasSidebar ? '✓' : '✗'}\n`);
    report.push(`  Tabs: ${domStructure.elements.hasTabs ? '✓' : '✗'}\n`);
    report.push(`  Cards found: ${domStructure.elements.hasCards}\n`);
    report.push(`  PlayerTabsContainer: ${domStructure.elements.playerTabsContainer ? '✓' : '✗'}\n`);
    report.push(`  TabsContent: ${domStructure.elements.tabsContent ? '✓' : '✗'}\n`);
    report.push(`  CardTrackerPanel: ${domStructure.elements.cardTrackerPanel ? '✓' : '✗'}\n`);
    report.push(`  BenefitTable: ${domStructure.elements.benefitTable ? '✓' : '✗'}\n\n`);
    
    report.push("SECTIONS FOUND:\n");
    domStructure.sections.forEach(s => {
      const visibility = s.display === 'none' ? '[HIDDEN]' : s.visibility === 'hidden' ? '[INVISIBLE]' : (s.isInViewport ? '[VISIBLE]' : '[OFFSCREEN]');
      report.push(`  Section ${s.index}: height=${s.height}px, display=${s.display}, ${visibility}\n`);
    });
    report.push("\n");
    
    // Scroll and check content below fold
    report.push("SCROLLING TEST:\n");
    await desktopPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await desktopPage.waitForTimeout(500);
    
    const desktopScrollMetrics = await desktopPage.evaluate(() => {
      return {
        scrollY: window.scrollY,
        bodyScrollHeight: document.body.scrollHeight,
        maxScroll: document.body.scrollHeight - window.innerHeight
      };
    });
    
    report.push(`  Page scrolled to: ${desktopScrollMetrics.scrollY}px\n`);
    report.push(`  Total scrollable height: ${desktopScrollMetrics.maxScroll}px\n`);
    report.push(`  Content exists below fold: ${desktopScrollMetrics.maxScroll > 0 ? '✓ YES' : '✗ NO'}\n\n`);
    
    const scrolledScreenshot = await desktopPage.screenshot({ fullPage: true, path: 'layout-desktop-scrolled.png' });
    report.push("✓ Desktop scrolled screenshot saved\n\n");
    
    await desktopContext.close();

    // ===== MOBILE LAYOUT (375px - iPhone SE) =====
    report.push("SECTION 2: MOBILE LAYOUT (375x667 - iPhone SE)\n");
    report.push("==============================================\n");
    
    const mobileContext = await browser.createBrowserContext({
      viewport: { width: 375, height: 667 }
    });
    const mobilePage = await mobileContext.newPage();
    
    mobilePage.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        report.push(`[${msg.type()}] ${msg.text()}\n`);
      }
    });
    
    await mobilePage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    report.push("✓ Mobile page loaded\n\n");
    
    const mobileScreenshot = await mobilePage.screenshot({ fullPage: true, path: 'layout-mobile-full.png' });
    report.push("✓ Mobile screenshot saved to layout-mobile-full.png\n\n");
    
    const mobileMetrics = await mobilePage.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        bodyHeight: body.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        isResponsive: window.innerWidth < 768,
        hasResponsiveClasses: document.querySelector('[class*="md:"], [class*="lg:"]') !== null
      };
    });
    
    report.push("MOBILE MEASUREMENTS:\n");
    report.push(`  Viewport: ${mobileMetrics.viewportWidth}x${mobileMetrics.viewportHeight}px\n`);
    report.push(`  Total page height: ${mobileMetrics.bodyHeight}px\n`);
    report.push(`  Is responsive width: ${mobileMetrics.isResponsive ? '✓' : '✗'}\n`);
    report.push(`  Has responsive classes: ${mobileMetrics.hasResponsiveClasses ? '✓' : '✗'}\n\n`);
    
    // Check responsive behavior
    const responsiveCheck = await mobilePage.evaluate(() => {
      const checks = {};
      
      // Check main container width
      const main = document.querySelector('main');
      if (main) {
        checks.mainWidth = main.offsetWidth;
        checks.mainIsFullWidth = main.offsetWidth <= window.innerWidth;
      }
      
      // Check for desktop-sized content
      const allElements = document.querySelectorAll('*');
      let maxWidth = 0;
      allElements.forEach(el => {
        const width = el.offsetWidth;
        if (width > maxWidth) maxWidth = width;
      });
      checks.maxElementWidth = maxWidth;
      checks.hasOversizedElements = maxWidth > window.innerWidth;
      
      // Check grid/flex layout
      const containers = document.querySelectorAll('[class*="grid"], [class*="flex"]');
      const gridStats = {
        gridElements: containers.length,
        gridAreSingleColumn: true
      };
      containers.forEach(el => {
        const style = window.getComputedStyle(el);
        const gridCols = style.gridTemplateColumns;
        if (gridCols && gridCols.split(' ').length > 1) {
          gridStats.gridAreSingleColumn = false;
        }
      });
      checks.gridStats = gridStats;
      
      return checks;
    });
    
    report.push("MOBILE RESPONSIVE CHECK:\n");
    report.push(`  Main container width: ${responsiveCheck.mainWidth || 'N/A'}px\n`);
    report.push(`  Main fills viewport: ${responsiveCheck.mainIsFullWidth ? '✓' : '✗'}\n`);
    report.push(`  Max element width: ${responsiveCheck.maxElementWidth}px\n`);
    report.push(`  Has oversized elements: ${responsiveCheck.hasOversizedElements ? '✗ YES (PROBLEM)' : '✓ NO'}\n`);
    if (responsiveCheck.gridStats) {
      report.push(`  Grid/Flex elements: ${responsiveCheck.gridStats.gridElements}\n`);
      report.push(`  Using single column layout: ${responsiveCheck.gridStats.gridAreSingleColumn ? '✓' : '✗'}\n`);
    }
    report.push("\n");
    
    await mobileContext.close();

    // ===== CSS INSPECTION =====
    report.push("SECTION 3: KEY CSS RULES\n");
    report.push("========================\n");
    
    const inspectContext = await browser.createBrowserContext({
      viewport: { width: 1440, height: 900 }
    });
    const inspectPage = await inspectContext.newPage();
    
    await inspectPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    const cssInspect = await inspectPage.evaluate(() => {
      const styles = {};
      
      // Main container
      const main = document.querySelector('main');
      if (main) {
        const computed = window.getComputedStyle(main);
        styles.main = {
          width: computed.width,
          height: computed.height,
          display: computed.display,
          overflow: computed.overflow,
          overflowX: computed.overflowX,
          overflowY: computed.overflowY,
          position: computed.position
        };
      }
      
      // Tabs container
      const tabList = document.querySelector('[role="tablist"]');
      if (tabList) {
        const computed = window.getComputedStyle(tabList);
        styles.tabList = {
          display: computed.display,
          width: computed.width,
          overflow: computed.overflow
        };
      }
      
      // Cards
      const firstCard = document.querySelector('[class*="card"], [class*="Card"]');
      if (firstCard) {
        const computed = window.getComputedStyle(firstCard);
        styles.card = {
          display: computed.display,
          width: computed.width,
          flexGrow: computed.flexGrow
        };
      }
      
      // Grid containers
      const grid = document.querySelector('[class*="grid"]');
      if (grid) {
        const computed = window.getComputedStyle(grid);
        styles.grid = {
          display: computed.display,
          gridTemplateColumns: computed.gridTemplateColumns,
          gap: computed.gap
        };
      }
      
      return styles;
    });
    
    report.push("COMPUTED STYLES:\n");
    Object.entries(cssInspect).forEach(([elem, styles]) => {
      report.push(`  ${elem}:\n`);
      Object.entries(styles).forEach(([prop, val]) => {
        report.push(`    ${prop}: ${val}\n`);
      });
    });
    
    await inspectContext.close();

  } catch (error) {
    report.push(`ERROR: ${error.message}\n`);
  } finally {
    await browser.close();
  }
  
  // Write report
  const reportText = report.join('');
  fs.writeFileSync('layout-diagnosis.txt', reportText);
  console.log(reportText);
  console.log("\n✓ Full report saved to layout-diagnosis.txt");
}

diagnose().catch(console.error);
