from playwright.sync_api import sync_playwright

def diagnose():
    report = []
    report.append("=== DASHBOARD LAYOUT DIAGNOSTIC REPORT ===\n\n")
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        try:
            # ===== DESKTOP LAYOUT (1440px) =====
            report.append("SECTION 1: DESKTOP LAYOUT (1440px)\n")
            report.append("=====================================\n")
            
            desktop_page = browser.new_page(viewport={'width': 1440, 'height': 900})
            desktop_page.goto('http://localhost:3000', wait_until='networkidle')
            report.append("✓ Page loaded\n\n")
            
            # Take desktop screenshot
            desktop_page.screenshot(path='layout-desktop-full.png', full_page=True)
            report.append("✓ Desktop full-page screenshot saved to layout-desktop-full.png\n\n")
            
            # Measure layout dimensions
            desktop_metrics = desktop_page.evaluate('''() => {
                const body = document.body;
                const html = document.documentElement;
                const main = document.querySelector('main');
                
                return {
                    bodyHeight: body.scrollHeight,
                    bodyClientHeight: body.clientHeight,
                    htmlHeight: html.scrollHeight,
                    viewportHeight: window.innerHeight,
                    viewportWidth: window.innerWidth,
                    mainHeight: main ? main.scrollHeight : 'N/A',
                    mainClientHeight: main ? main.clientHeight : 'N/A',
                    overflowY: window.getComputedStyle(html).overflowY
                };
            }''')
            
            report.append("DESKTOP MEASUREMENTS:\n")
            report.append(f"  Body scroll height: {desktop_metrics['bodyHeight']}px\n")
            report.append(f"  Body client height: {desktop_metrics['bodyClientHeight']}px\n")
            report.append(f"  HTML scroll height: {desktop_metrics['htmlHeight']}px\n")
            report.append(f"  Viewport: {desktop_metrics['viewportWidth']}x{desktop_metrics['viewportHeight']}px\n")
            report.append(f"  Main element height: {desktop_metrics['mainHeight']} / {desktop_metrics['mainClientHeight']}px\n")
            report.append(f"  HTML overflow-y: {desktop_metrics['overflowY']}\n\n")
            
            # Check DOM structure
            report.append("DESKTOP DOM STRUCTURE:\n")
            dom_structure = desktop_page.evaluate('''() => {
                const elements = {
                    hasMain: !!document.querySelector('main'),
                    hasNav: !!document.querySelector('nav'),
                    hasSidebar: !!document.querySelector('aside'),
                    hasTabs: !!document.querySelector('[role="tablist"]'),
                    hasCards: document.querySelectorAll('[class*="card"], [class*="Card"]').length,
                    playerTabsContainer: !!document.getElementById('player-tabs-container'),
                    tabsContent: !!document.querySelector('[role="tabpanel"]'),
                };
                
                // Get visibility of major sections
                const sections = [];
                document.querySelectorAll('section, [role="region"], [class*="section"]').forEach((el, i) => {
                    const style = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    sections.push({
                        index: i,
                        height: el.scrollHeight,
                        display: style.display,
                        visibility: style.visibility,
                        isInViewport: rect.top < window.innerHeight && rect.bottom > 0,
                        top: Math.round(rect.top)
                    });
                });
                
                return { elements, sections };
            }''')
            
            report.append(f"  Main element: {'✓' if dom_structure['elements']['hasMain'] else '✗'}\n")
            report.append(f"  Nav element: {'✓' if dom_structure['elements']['hasNav'] else '✗'}\n")
            report.append(f"  Sidebar: {'✓' if dom_structure['elements']['hasSidebar'] else '✗'}\n")
            report.append(f"  Tabs: {'✓' if dom_structure['elements']['hasTabs'] else '✗'}\n")
            report.append(f"  Cards found: {dom_structure['elements']['hasCards']}\n")
            report.append(f"  PlayerTabsContainer: {'✓' if dom_structure['elements']['playerTabsContainer'] else '✗'}\n")
            report.append(f"  TabsContent: {'✓' if dom_structure['elements']['tabsContent'] else '✗'}\n\n")
            
            if dom_structure['sections']:
                report.append("SECTIONS FOUND:\n")
                for s in dom_structure['sections']:
                    visibility = '[HIDDEN]' if s['display'] == 'none' else '[INVISIBLE]' if s['visibility'] == 'hidden' else ('[VISIBLE]' if s['isInViewport'] else '[OFFSCREEN]')
                    report.append(f"  Section {s['index']}: height={s['height']}px, display={s['display']}, top={s['top']}px {visibility}\n")
                report.append("\n")
            
            # Scroll and check content below fold
            report.append("SCROLLING TEST:\n")
            desktop_page.evaluate('() => window.scrollTo(0, document.body.scrollHeight)')
            desktop_page.wait_for_timeout(500)
            
            desktop_scroll_metrics = desktop_page.evaluate('''() => {
                return {
                    scrollY: window.scrollY,
                    bodyScrollHeight: document.body.scrollHeight,
                    maxScroll: document.body.scrollHeight - window.innerHeight
                };
            }''')
            
            report.append(f"  Page scrolled to: {desktop_scroll_metrics['scrollY']}px\n")
            report.append(f"  Total scrollable height: {desktop_scroll_metrics['maxScroll']}px\n")
            report.append(f"  Content exists below fold: {'✓ YES' if desktop_scroll_metrics['maxScroll'] > 0 else '✗ NO'}\n\n")
            
            desktop_page.screenshot(path='layout-desktop-scrolled.png', full_page=True)
            report.append("✓ Desktop scrolled screenshot saved\n\n")
            
            desktop_page.close()

            # ===== MOBILE LAYOUT (375px) =====
            report.append("SECTION 2: MOBILE LAYOUT (375x667 - iPhone SE)\n")
            report.append("==============================================\n")
            
            mobile_page = browser.new_page(viewport={'width': 375, 'height': 667})
            mobile_page.goto('http://localhost:3000', wait_until='networkidle')
            report.append("✓ Mobile page loaded\n\n")
            
            mobile_page.screenshot(path='layout-mobile-full.png', full_page=True)
            report.append("✓ Mobile full-page screenshot saved to layout-mobile-full.png\n\n")
            
            mobile_metrics = mobile_page.evaluate('''() => {
                return {
                    bodyHeight: document.body.scrollHeight,
                    viewportWidth: window.innerWidth,
                    viewportHeight: window.innerHeight,
                    isResponsive: window.innerWidth < 768
                };
            }''')
            
            report.append("MOBILE MEASUREMENTS:\n")
            report.append(f"  Viewport: {mobile_metrics['viewportWidth']}x{mobile_metrics['viewportHeight']}px\n")
            report.append(f"  Total page height: {mobile_metrics['bodyHeight']}px\n")
            report.append(f"  Is responsive width: {'✓' if mobile_metrics['isResponsive'] else '✗'}\n\n")
            
            # Check responsive behavior
            responsive_check = mobile_page.evaluate('''() => {
                const checks = {};
                
                const main = document.querySelector('main');
                if (main) {
                    checks.mainWidth = main.offsetWidth;
                    checks.mainIsFullWidth = main.offsetWidth <= window.innerWidth;
                }
                
                let maxWidth = 0;
                document.querySelectorAll('*').forEach(el => {
                    const width = el.offsetWidth;
                    if (width > maxWidth) maxWidth = width;
                });
                checks.maxElementWidth = maxWidth;
                checks.hasOversizedElements = maxWidth > window.innerWidth;
                
                return checks;
            }''')
            
            report.append("MOBILE RESPONSIVE CHECK:\n")
            if 'mainWidth' in responsive_check:
                report.append(f"  Main container width: {responsive_check['mainWidth']}px\n")
                report.append(f"  Main fills viewport: {'✓' if responsive_check['mainIsFullWidth'] else '✗'}\n")
            report.append(f"  Max element width: {responsive_check['maxElementWidth']}px\n")
            report.append(f"  Has oversized elements: {'✗ YES (PROBLEM!)' if responsive_check['hasOversizedElements'] else '✓ NO'}\n\n")
            
            mobile_page.close()

            # ===== CSS INSPECTION =====
            report.append("SECTION 3: CSS COMPUTED STYLES\n")
            report.append("=============================\n")
            
            inspect_page = browser.new_page(viewport={'width': 1440, 'height': 900})
            inspect_page.goto('http://localhost:3000', wait_until='networkidle')
            
            css_inspect = inspect_page.evaluate('''() => {
                const styles = {};
                
                const main = document.querySelector('main');
                if (main) {
                    const computed = window.getComputedStyle(main);
                    styles.main = {
                        width: computed.width,
                        height: computed.height,
                        display: computed.display,
                        overflow: computed.overflow,
                    };
                }
                
                const tabPanel = document.querySelector('[role="tabpanel"]');
                if (tabPanel) {
                    const computed = window.getComputedStyle(tabPanel);
                    styles.tabPanel = {
                        display: computed.display,
                        width: computed.width,
                        height: computed.height,
                    };
                }
                
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
            }''')
            
            report.append("COMPUTED STYLES:\n")
            for elem, styles in css_inspect.items():
                report.append(f"  {elem}:\n")
                for prop, val in styles.items():
                    report.append(f"    {prop}: {val}\n")
            report.append("\n")
            
            inspect_page.close()

        except Exception as e:
            report.append(f"ERROR: {str(e)}\n")
        
        finally:
            browser.close()
    
    report_text = ''.join(report)
    with open('layout-diagnosis.txt', 'w') as f:
        f.write(report_text)
    
    print(report_text)
    print("\n✓ Report saved to layout-diagnosis.txt")
    return report_text

if __name__ == '__main__':
    diagnose()
