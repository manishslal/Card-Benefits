#!/usr/bin/env python3
"""
Debug dashboard page to understand what's being rendered
"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    try:
        # Navigate to dashboard
        print("🔍 Navigating to /dashboard...")
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle", timeout=30000)
        page.wait_for_timeout(2000)
        
        # Get page URL
        print(f"📍 Current URL: {page.url}")
        
        # Check page content
        content = page.content()
        print(f"\n📄 Page Content Length: {len(content)} characters")
        
        # Check for specific elements
        print("\n🔎 Element Discovery:")
        print(f"   - Headings (h1-h6): {page.locator('h1, h2, h3, h4, h5, h6').count()}")
        print(f"   - Buttons: {page.locator('button').count()}")
        print(f"   - Links: {page.locator('a').count()}")
        print(f"   - Forms: {page.locator('form').count()}")
        print(f"   - Images: {page.locator('img').count()}")
        print(f"   - Divs: {page.locator('div').count()}")
        
        # Check for text patterns
        has_welcome = "Welcome" in content or "welcome" in content
        has_cards = "Card" in content or "card" in content
        has_settings = "Settings" in content or "settings" in content
        has_add = "Add" in content or "add" in content
        
        print(f"\n📝 Text Content Checks:")
        print(f"   - Has 'Welcome': {has_welcome}")
        print(f"   - Has 'Card': {has_cards}")
        print(f"   - Has 'Settings': {has_settings}")
        print(f"   - Has 'Add': {has_add}")
        
        # Try to find any interactive elements
        print(f"\n⚙️ Interactive Elements:")
        buttons = page.locator('button').all()
        print(f"   - Total buttons: {len(buttons)}")
        for i, btn in enumerate(buttons[:5]):
            text = btn.text_content()
            print(f"     {i+1}. Button: {text}")
        
        links = page.locator('a').all()
        print(f"   - Total links: {len(links)}")
        for i, link in enumerate(links[:5]):
            text = link.text_content()
            href = link.get_attribute('href')
            print(f"     {i+1}. Link: {text} -> {href}")
        
        # Take screenshot
        page.screenshot(path="/tmp/dashboard-debug.png", full_page=True)
        print(f"\n📸 Screenshot saved to /tmp/dashboard-debug.png")
        
        # Print first 3000 chars of HTML
        print("\n📋 First 3000 characters of HTML:")
        print(content[:3000])
        print("\n... (truncated)")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        browser.close()
