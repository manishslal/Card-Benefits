#!/usr/bin/env python3
"""
Test modal rendering after fresh build and check browser console for Radix UI errors.
This will:
1. Login to the app
2. Navigate to dashboard
3. Click "Add Card" button
4. Wait for modal to appear
5. Capture console logs to check for the 3 persistent errors
"""

from playwright.sync_api import sync_playwright
import json
import time

def test_modal_console_errors():
    with sync_playwright() as p:
        # Launch browser with console capture
        browser = p.chromium.launch(headless=False)  # Set to False to see browser
        page = browser.new_page()
        
        # Capture all console messages
        console_messages = []
        def log_console(msg):
            console_messages.append({
                'type': msg.type,
                'text': msg.text,
                'args': msg.args
            })
            print(f"[CONSOLE {msg.type.upper()}] {msg.text}")
        
        page.on('console', log_console)
        
        print("=" * 70)
        print("MODAL ACCESSIBILITY ERROR TEST")
        print("=" * 70)
        
        # 1. Navigate to login
        print("\n1️⃣ Navigating to login page...")
        page.goto('http://localhost:3000/login')
        page.wait_for_load_state('networkidle')
        print("✅ Login page loaded")
        
        # 2. Login with demo credentials
        print("\n2️⃣ Logging in...")
        page.fill('input[id="login-email"]', 'demo@example.com')
        page.fill('input[id="login-password"]', 'password123')
        page.click('button:has-text("Sign In")')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        print("✅ Login successful")
        
        # 3. Navigate to dashboard
        print("\n3️⃣ Navigating to dashboard...")
        page.goto('http://localhost:3000/dashboard')
        page.wait_for_load_state('networkidle')
        time.sleep(2)
        print("✅ Dashboard loaded")
        
        # 4. Take screenshot of dashboard
        page.screenshot(path='/tmp/dashboard-before-modal.png', full_page=True)
        print("📸 Dashboard screenshot saved to /tmp/dashboard-before-modal.png")
        
        # 5. Click "Add Card" button
        print("\n4️⃣ Clicking 'Add Card' button...")
        try:
            page.click('button:has-text("Add Card")')
            page.wait_for_timeout(1000)  # Wait 1 second for modal to appear
            print("✅ Button clicked")
        except Exception as e:
            print(f"❌ Error clicking button: {e}")
        
        # 6. Take screenshot with modal
        page.screenshot(path='/tmp/modal-open.png', full_page=True)
        print("📸 Modal screenshot saved to /tmp/modal-open.png")
        
        # 7. Check if DialogContent is in DOM
        print("\n5️⃣ Checking modal in DOM...")
        dialog_content = page.query_selector('[role="dialog"]')
        if dialog_content:
            print("✅ Modal dialog found in DOM")
            
            # Check for Title and Description as direct children
            title = dialog_content.query_selector(':scope > [id*="title"]')
            description = dialog_content.query_selector(':scope > [id*="description"]')
            
            if title:
                print(f"✅ DialogTitle found as direct child: {title.get_attribute('id')}")
            else:
                print("❌ DialogTitle NOT found as direct child")
                
            if description:
                print(f"✅ DialogDescription found as direct child: {description.get_attribute('id')}")
            else:
                print("❌ DialogDescription NOT found as direct child")
        else:
            print("❌ Modal dialog NOT found in DOM")
        
        # 8. Get all content for inspection
        html = page.content()
        if '[role="dialog"]' in html:
            print("✅ Dialog role present in HTML")
        else:
            print("❌ Dialog role NOT in HTML")
        
        # 9. Wait a bit more to collect all console messages
        print("\n6️⃣ Waiting for console messages...")
        page.wait_for_timeout(3000)
        
        # 10. Summary of console messages
        print("\n" + "=" * 70)
        print("CONSOLE MESSAGES SUMMARY")
        print("=" * 70)
        
        errors = [m for m in console_messages if m['type'] == 'error']
        warnings = [m for m in console_messages if m['type'] == 'warning' or m['type'] == 'log']
        
        print(f"\n📊 Total messages: {len(console_messages)}")
        print(f"🔴 Errors: {len(errors)}")
        print(f"🟡 Warnings/Logs: {len(warnings)}")
        
        # 11. Check for the THREE specific errors
        print("\n" + "=" * 70)
        print("CHECKING FOR THE 3 KNOWN ERRORS")
        print("=" * 70)
        
        error_patterns = [
            ("DialogTitle", "`DialogContent` requires a `DialogTitle`"),
            ("Description", "Missing `Description` or `aria-describedby`"),
            ("aria-hidden", "Blocked aria-hidden on an element because its descendant retained focus")
        ]
        
        for error_name, pattern in error_patterns:
            found = any(pattern.lower() in m['text'].lower() for m in console_messages)
            status = "❌ FOUND" if found else "✅ NOT FOUND"
            print(f"{status}: {error_name}")
            
            # Show actual message if found
            for m in console_messages:
                if pattern.lower() in m['text'].lower():
                    print(f"   → {m['text'][:120]}")
        
        # 12. Save all console messages to file
        print("\n" + "=" * 70)
        print("SAVING CONSOLE LOGS")
        print("=" * 70)
        
        with open('/tmp/console-logs.json', 'w') as f:
            json.dump(console_messages, f, indent=2)
        print("✅ All console messages saved to /tmp/console-logs.json")
        
        # Close browser
        browser.close()
        
        print("\n" + "=" * 70)
        print("TEST COMPLETE")
        print("=" * 70)
        
        return console_messages

if __name__ == '__main__':
    test_modal_console_errors()
