from playwright.sync_api import sync_playwright

def inspect():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1440, 'height': 900})
        
        page.goto('http://localhost:3000', wait_until='networkidle')
        
        # Get detailed info about the tabPanel element
        info = page.evaluate('''() => {
            const tabPanel = document.querySelector('[role="tabpanel"]');
            if (!tabPanel) return { error: "tabPanel not found" };
            
            // Get all computed styles
            const computed = window.getComputedStyle(tabPanel);
            
            // Get parent info
            const parent = tabPanel.parentElement;
            const parentComputed = parent ? window.getComputedStyle(parent) : null;
            
            // Get outer HTML to see classes
            return {
                element: {
                    tagName: tabPanel.tagName,
                    className: tabPanel.className,
                    id: tabPanel.id,
                    attributes: Array.from(tabPanel.attributes).map(a => `${a.name}="${a.value}"`).join(', ')
                },
                computed: {
                    width: computed.width,
                    height: computed.height,
                    display: computed.display,
                    flexGrow: computed.flexGrow,
                    flexBasis: computed.flexBasis,
                    flexShrink: computed.flexShrink,
                    minWidth: computed.minWidth,
                    maxWidth: computed.maxWidth,
                    overflow: computed.overflow,
                    visibility: computed.visibility,
                    float: computed.float,
                },
                parent: parentComputed ? {
                    tagName: parent.tagName,
                    className: parent.className,
                    display: parentComputed.display,
                    flexDirection: parentComputed.flexDirection,
                    width: parentComputed.width,
                } : null,
                outerHTML: tabPanel.outerHTML.substring(0, 500)
            };
        }''')
        
        print("TabPanel Inspection:")
        print(f"Element: {info['element']}")
        print(f"\nComputed Styles: {info['computed']}")
        print(f"\nParent: {info['parent']}")
        print(f"\nOuter HTML: {info['outerHTML']}")
        
        browser.close()

inspect()
