#!/usr/bin/env python3
"""Quick test to debug login"""

from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    try:
        print("🔐 Testing Login Flow...")
        page.goto("http://localhost:3000/login", wait_until="load", timeout=20000)
        page.wait_for_timeout(2000)
        
        print(f"1️⃣ URL: {page.url}")
        
        # Find inputs
        email_input = page.locator('input[type="email"]').first
        password_input = page.locator('input[type="password"]').first
        
        print(f"2️⃣ Found email input: {email_input.count() > 0}")
        print(f"3️⃣ Found password input: {password_input.count() > 0}")
        
        # Fill form
        if email_input.count() > 0:
            email_input.fill("demo@example.com")
            print(f"4️⃣ Filled email")
        
        if password_input.count() > 0:
            password_input.fill("password123")
            print(f"5️⃣ Filled password")
        
        # Find and click button
        sign_in_btn = page.locator('button').filter(has_text="Sign In")
        print(f"6️⃣ Found Sign In button: {sign_in_btn.count() > 0}")
        
        if sign_in_btn.count() > 0:
            sign_in_btn.first.click()
            print(f"7️⃣ Clicked Sign In")
            
            # Wait for response
            page.wait_for_timeout(4000)
            
            print(f"8️⃣ URL after submit: {page.url}")
            print(f"9️⃣ Content length: {len(page.content())}")
            
            # Check for errors
            error_msg = page.locator('text=/error|failed|incorrect|invalid/i').first.text_content() if page.locator('text=/error|failed|incorrect|invalid/i').count() > 0 else "None"
            print(f"🔟 Error message: {error_msg}")
            
            # Check for success
            if "/dashboard" in page.url:
                print("\n✅ LOGIN SUCCESS!")
            else:
                print("\n❌ LOGIN FAILED")
                # Print page content for debugging
                content = page.content()
                # Find body content
                body_start = content.find('<body')
                if body_start != -1:
                    body_content = content[body_start:body_start+1500]
                    print(f"\nBody content:\n{body_content}")
        
        page.screenshot(path="/tmp/login-test.png", full_page=True)
        print("\n📸 Screenshot saved to /tmp/login-test.png")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        
    finally:
        browser.close()
