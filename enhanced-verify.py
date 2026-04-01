#!/usr/bin/env python3
"""
Enhanced visual verification with full scrolling and card counting.
"""

from playwright.sync_api import sync_playwright
import time

def enhanced_verification():
    print("\n" + "="*70)
    print("ENHANCED VISUAL VERIFICATION - FULL PAGE ANALYSIS")
    print("="*70)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        viewports = [
            ("Desktop (1440px)", 1440, 900),
            ("Tablet (768px)", 768, 1024),
            ("Mobile (375px)", 375, 667),
        ]
        
        for viewport_name, width, height in viewports:
            print(f"\n{'='*70}")
            print(f"DETAILED ANALYSIS: {viewport_name} ({width}x{height})")
            print(f"{'='*70}")
            
            page.set_viewport_size({"width": width, "height": height})
            page.goto('http://localhost:3000', wait_until='networkidle')
            time.sleep(1)
            
            # Take full-page screenshot
            screenshot_path = f'/tmp/{viewport_name.lower().replace(" ", "-").replace("(", "").replace(")", "")}-detailed.png'
            page.screenshot(path=screenshot_path, full_page=True)
            print(f"✓ Full-page screenshot: {screenshot_path}")
            
            # Get detailed measurements
            measurements = page.evaluate("""() => {
                // Find TabsContent
                const tabsContent = document.querySelector('[role="tabpanel"]');
                const tabsContentBox = tabsContent ? tabsContent.getBoundingClientRect() : null;
                const tabsContentComputed = tabsContent ? window.getComputedStyle(tabsContent) : null;
                
                // Find grid containers
                const grids = document.querySelectorAll('[class*="grid-cols"]');
                let primaryGrid = null;
                let gridInfo = {};
                
                for (let grid of grids) {
                    if (grid.children.length > 0) {
                        primaryGrid = grid;
                        break;
                    }
                }
                
                if (primaryGrid) {
                    const computed = window.getComputedStyle(primaryGrid);
                    gridInfo = {
                        childCount: primaryGrid.children.length,
                        width: primaryGrid.offsetWidth,
                        height: primaryGrid.offsetHeight,
                        columnCount: computed.gridTemplateColumns.split(' ').length,
                        className: primaryGrid.className
                    };
                }
                
                // Find all CardTrackerPanel or Card components
                // They typically have specific classes
                const cardSelectors = [
                    '[class*="rounded-lg"][class*="border"][class*="transition"]',
                    '.group/card',
                    '[data-card-id]'
                ];
                
                let allCards = new Set();
                for (let selector of cardSelectors) {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                        // Only count if it looks like a card (has enough content)
                        if (el.textContent.length > 50) {
                            allCards.add(el);
                        }
                    });
                }
                
                // More specific: find cards with American Express or card issuer names
                const cardIssuerElements = document.querySelectorAll('div');
                let cardCount = 0;
                cardIssuerElements.forEach(el => {
                    const text = el.textContent;
                    if ((text.includes('American Express') || text.includes('Visa') || text.includes('Mastercard')) 
                        && el.offsetParent !== null) {  // Only visible elements
                        // Check if it's a card-like element
                        const rect = el.getBoundingClientRect();
                        if (rect.height > 200 && rect.height < 1000) {  // Card-like height
                            cardCount++;
                        }
                    }
                });
                
                return {
                    tabsContent: {
                        visible: tabsContent ? tabsContent.offsetParent !== null : false,
                        width: tabsContentBox ? tabsContentBox.width : 0,
                        height: tabsContentBox ? tabsContentBox.height : 0,
                        classes: tabsContent ? tabsContent.className : '',
                        hasWFull: tabsContent ? tabsContent.className.includes('w-full') : false,
                        hasFlex: tabsContent ? tabsContent.className.includes('flex') : false
                    },
                    grid: gridInfo,
                    cardCount: allCards.size,
                    cardCountByIssuer: Math.ceil(cardCount / 3),  // Rough estimate
                    pageHeight: document.documentElement.scrollHeight,
                    windowHeight: window.innerHeight,
                    viewport: {
                        width: window.innerWidth,
                        height: window.innerHeight
                    }
                };
            }""")
            
            print(f"\n[TabsContent]")
            print(f"  • Width: {measurements['tabsContent']['width']:.0f}px")
            print(f"  • Height: {measurements['tabsContent']['height']:.0f}px")
            print(f"  • Has w-full: {measurements['tabsContent']['hasWFull']}")
            print(f"  • Has flex: {measurements['tabsContent']['hasFlex']}")
            
            print(f"\n[Grid]")
            print(f"  • Child count: {measurements['grid'].get('childCount', 'N/A')}")
            print(f"  • Grid width: {measurements['grid'].get('width', 'N/A')}px")
            print(f"  • Expected columns: {measurements['grid'].get('columnCount', 'N/A')}")
            print(f"  • Classes: {measurements['grid'].get('className', 'N/A')[:80]}")
            
            print(f"\n[Page Layout]")
            print(f"  • Page height: {measurements['pageHeight']}px")
            print(f"  • Viewport height: {measurements['windowHeight']}px")
            print(f"  • Total scrollable content: {measurements['pageHeight']}px")
            
            # Count actual cards in viewport
            print(f"\n[Card Detection]")
            print(f"  • Cards found (heuristic): {measurements['cardCountByIssuer']}")
            
            # Scroll through page and count visible cards
            print(f"\n[Scrolling Analysis]")
            
            # Scroll to top first
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.5)
            
            # Count unique card names as we scroll
            unique_cards = set()
            max_scrolls = 5
            scroll_height = measurements['pageHeight']
            scroll_step = scroll_height / max_scrolls if scroll_height > 0 else 0
            
            for scroll_num in range(max_scrolls):
                current_y = scroll_num * scroll_step
                page.evaluate(f"window.scrollTo(0, {current_y})")
                time.sleep(0.3)
                
                # Get visible card names
                card_names = page.evaluate("""() => {
                    const names = new Set();
                    const elements = document.querySelectorAll('div');
                    for (let el of elements) {
                        if ((el.textContent.includes('Express') || el.textContent.includes('Visa') || el.textContent.includes('Mastercard')) 
                            && el.offsetParent !== null) {
                            // Extract card name
                            const firstChild = el.querySelector('div');
                            if (firstChild && firstChild.textContent.length < 100) {
                                names.add(firstChild.textContent.trim());
                            }
                        }
                    }
                    return Array.from(names);
                }""")
                
                for name in card_names:
                    unique_cards.add(name)
            
            print(f"  • Unique cards found while scrolling: {len(unique_cards)}")
            for i, card_name in enumerate(sorted(list(unique_cards))[:5]):
                print(f"    {i+1}. {card_name[:50]}")
            
            # Responsive grid verification
            print(f"\n[Responsive Grid Check]")
            
            if width >= 1024:
                expected_cols = 3
                print(f"  ✓ Desktop (≥1024px): Expect {expected_cols} columns")
            elif width >= 640:
                expected_cols = 2
                print(f"  ✓ Tablet (≥640px): Expect {expected_cols} columns")
            else:
                expected_cols = 1
                print(f"  ✓ Mobile (<640px): Expect {expected_cols} column")
            
            actual_cols = measurements['grid'].get('columnCount', 0)
            if actual_cols > 0:
                matches = actual_cols == expected_cols
                status = "✓" if matches else "✗"
                print(f"  {status} Actual columns: {actual_cols}")
            
            # Final assessment
            print(f"\n[ASSESSMENT]")
            
            width_ok = measurements['tabsContent']['width'] > 200
            has_w_full = measurements['tabsContent']['hasWFull']
            page_height_ok = measurements['pageHeight'] < 3000  # Should not be 2982px (old bug)
            
            all_good = width_ok and has_w_full and page_height_ok
            
            status_icon = "✅" if all_good else "⚠️"
            print(f"{status_icon} TabsContent width good: {width_ok} ({measurements['tabsContent']['width']:.0f}px)")
            print(f"{status_icon} Has w-full class: {has_w_full}")
            print(f"{status_icon} Page height optimal: {page_height_ok} ({measurements['pageHeight']}px)")
            
            time.sleep(0.5)
        
        browser.close()

if __name__ == "__main__":
    enhanced_verification()
