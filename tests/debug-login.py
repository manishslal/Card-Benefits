#!/usr/bin/env python3
"""Debug login page structure"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    try:
        page.goto("http://localhost:3000/login", wait_until="networkidle")
        page.wait_for_timeout(2000)
        
        print("📍 URL:", page.url)
        print("\n🔎 Element Search:")
        print(f"   - input elements: {page.locator('input').count()}")
        print(f"   - text inputs: {page.locator('input[type=\"text\"]').count()}")
        print(f"   - email inputs: {page.locator('input[type=\"email\"]').count()}")
        print(f"   - password inputs: {page.locator('input[type=\"password\"]').count()}")
        print(f"   - buttons: {page.locator('button').count()}")
        print(f"   - form elements: {page.locator('form').count()}")
        
        # Print button texts
        buttons = page.locator('button').all()
        print(f"\n📌 Button Texts:")
        for btn in buttons[:10]:
            text = btn.text_content()
            print(f"   - {text}")
        
        # Print a snippet of HTML
        content = page.content()
        print(f"\n📄 HTML Length: {len(content)}")
        print(f"\n📋 HTML Snippet (0-2000):")
        print(content[:2000])
        
        page.screenshot(path="/tmp/login-debug.png", full_page=True)
        print("\n📸 Screenshot saved")
        
    finally:
        browser.close()
