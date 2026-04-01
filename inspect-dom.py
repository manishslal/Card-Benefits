#!/usr/bin/env python3
"""
Detailed DOM inspection to find card selectors and measure layout metrics.
"""

from playwright.sync_api import sync_playwright
import time

def inspect_and_measure():
    print("\n" + "="*60)
    print("DOM STRUCTURE INSPECTION & MEASUREMENT")
    print("="*60)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Desktop viewport
        page.set_viewport_size({"width": 1440, "height": 900})
        page.goto('http://localhost:3000', wait_until='networkidle')
        time.sleep(1)
        
        print("\n[DESKTOP 1440px]")
        
        # Get full HTML of cards container
        print("\n1. Looking for grid/card containers...")
        
        # Find all elements with 'group' class (common for cards)
        group_elements = page.locator('.group').all()
        print(f"   • Found .group elements: {len(group_elements)}")
        
        # Find grid containers
        grids = page.locator('[class*="grid"]').all()
        print(f"   • Found [class*='grid'] elements: {len(grids)}")
        
        # Get specific container info
        print("\n2. TabsContent measurements:")
        tabs_content = page.locator('[role="tabpanel"]').first
        
        if tabs_content.is_visible():
            box = tabs_content.bounding_box()
            print(f"   • Width: {box['width']}px")
            print(f"   • Height: {box['height']}px")
            print(f"   • X: {box['x']}, Y: {box['y']}")
            
            classes = tabs_content.get_attribute("class")
            print(f"   • Classes: {classes}")
        
        print("\n3. Card container structure:")
        # Try to find the actual card grid
        card_containers = page.locator('div[class*="grid-cols"]').all()
        print(f"   • Found grid-cols elements: {len(card_containers)}")
        
        for idx, container in enumerate(card_containers):
            try:
                classes = container.get_attribute("class")
                children_count = len(page.locator(f'div').filter(has_child=container).all()) if container else 0
                print(f"   • Container {idx}: {classes}")
            except:
                pass
        
        print("\n4. Searching for card elements by various selectors:")
        
        selectors_to_try = [
            '.group',
            '[class*="card"]',
            '[class*="benefit"]',
            'div > div > div',  # Generic nested divs
        ]
        
        for selector in selectors_to_try:
            try:
                elements = page.locator(selector).all()
                if len(elements) > 3:
                    print(f"   • {selector}: {len(elements)} found")
            except:
                pass
        
        print("\n5. Page structure (DOM depth inspection):")
        
        # Get the main content div
        main_content = page.locator('main').first
        if main_content.is_visible():
            html = main_content.evaluate("el => el.outerHTML.substring(0, 500)")
            print(f"   • Main content tag found")
            
            # Count direct children
            direct_children = page.locator('main > *').all()
            print(f"   • Direct children of main: {len(direct_children)}")
        
        # Look for data
        print("\n6. Checking if cards are conditionally rendered...")
        
        # Get any visible text about benefits
        page_content = page.content()
        
        # Count how many times we see "Player" (indicating player tabs)
        player_count = page_content.count("Player")
        print(f"   • 'Player' text appears: {player_count} times")
        
        # Try to find all divs with specific patterns
        all_divs_html = page.evaluate("""() => {
            const divs = document.querySelectorAll('div');
            let cards = [];
            divs.forEach(div => {
                const classes = div.className || '';
                // Look for divs that might be cards
                if (classes.includes('group') || 
                    classes.includes('rounded') || 
                    classes.includes('border') ||
                    classes.includes('shadow')) {
                    cards.push({
                        classes: classes,
                        children: div.children.length,
                        text: div.textContent ? div.textContent.substring(0, 30) : ''
                    });
                }
            });
            return cards.slice(0, 15); // Return first 15
        }""")
        
        print(f"\n7. Potential card elements found:")
        for idx, card in enumerate(all_divs_html):
            print(f"   [{idx}] Classes: {card['classes'][:50]}")
            print(f"        Text: {card['text']}")
        
        print("\n8. Full viewport content check:")
        
        # Check if there's overflow (scrollable content)
        measurements = page.evaluate("""() => {
            return {
                scrollHeight: document.documentElement.scrollHeight,
                clientHeight: document.documentElement.clientHeight,
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                bodyHTML: document.body.innerHTML.length
            };
        }""")
        
        print(f"   • Scroll height: {measurements['scrollHeight']}px")
        print(f"   • Client height: {measurements['clientHeight']}px")
        print(f"   • Scroll width: {measurements['scrollWidth']}px")
        print(f"   • Client width: {measurements['clientWidth']}px")
        print(f"   • HTML size: {measurements['bodyHTML']} bytes")
        
        # Try to inspect the actual grid
        print("\n9. Detailed grid inspection:")
        grid_info = page.evaluate("""() => {
            // Find the main grid container
            const grids = document.querySelectorAll('[class*="grid-cols"]');
            if (grids.length === 0) return { error: "No grid found" };
            
            const grid = grids[0];
            return {
                gridClasses: grid.className,
                childCount: grid.children.length,
                gridTemplateColumns: window.getComputedStyle(grid).gridTemplateColumns,
                columnGap: window.getComputedStyle(grid).columnGap,
                rowGap: window.getComputedStyle(grid).rowGap,
                width: grid.offsetWidth,
                height: grid.offsetHeight
            };
        }""")
        
        print(f"   Grid info: {grid_info}")
        
        # Screenshot the page for visual inspection
        page.screenshot(path='/tmp/desktop-detailed.png', full_page=True)
        print("\n✓ Screenshot saved to /tmp/desktop-detailed.png")
        
        browser.close()

if __name__ == "__main__":
    inspect_and_measure()
