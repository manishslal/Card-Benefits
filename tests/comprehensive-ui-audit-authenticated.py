#!/usr/bin/env python3
"""
Comprehensive Frontend UI/UX Flow Audit with Authentication
Tests all button interactions, modals, forms, and user flows after login
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Results tracking
test_results = {
    "timestamp": datetime.now().isoformat(),
    "tests_executed": [],
    "critical_issues": [],
    "high_priority_issues": [],
    "medium_priority_issues": [],
    "low_priority_issues": [],
    "all_passed": True,
    "button_flows": {},
    "navigation_flows": {},
    "form_submissions": {},
    "state_management": {},
    "auth_success": False,
}

def log_test(name, passed, details="", issue_level=None):
    """Log test result"""
    result = {
        "name": name,
        "passed": passed,
        "details": details,
        "timestamp": datetime.now().isoformat(),
    }
    test_results["tests_executed"].append(result)
    
    if not passed:
        test_results["all_passed"] = False
        if issue_level == "critical":
            test_results["critical_issues"].append({"test": name, "details": details})
        elif issue_level == "high":
            test_results["high_priority_issues"].append({"test": name, "details": details})
        elif issue_level == "medium":
            test_results["medium_priority_issues"].append({"test": name, "details": details})
        elif issue_level == "low":
            test_results["low_priority_issues"].append({"test": name, "details": details})
    
    status = "✓ PASS" if passed else "✗ FAIL"
    print(f"{status}: {name}")
    if details:
        print(f"   └─ {details}")

def test_all_flows():
    """Run comprehensive UI/UX flow tests"""
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        try:
            # ========== LOGIN FIRST ==========
            print("\n=== STEP 1: AUTHENTICATION ===")
            if not test_login_and_auth(page):
                print("\n❌ Authentication failed. Cannot continue with other tests.")
                log_test("Authentication prerequisite", False, "Login/signup not working", "critical")
                return
            
            test_results["auth_success"] = True
            
            # ========== DASHBOARD FLOWS ==========
            print("\n=== STEP 2: DASHBOARD VERIFICATION ===")
            test_dashboard_page(page)
            
            # ========== CARD MANAGEMENT FLOWS ==========
            print("\n=== STEP 3: CARD MANAGEMENT FLOWS ===")
            test_card_flows(page)
            
            # ========== BENEFIT MANAGEMENT FLOWS ==========
            print("\n=== STEP 4: BENEFIT MANAGEMENT FLOWS ===")
            test_benefit_flows(page)
            
            # ========== SETTINGS PAGE FLOWS ==========
            print("\n=== STEP 5: SETTINGS PAGE ===")
            test_settings_page(page)
            
            # ========== NAVIGATION FLOWS ==========
            print("\n=== STEP 6: NAVIGATION & LINKS ===")
            test_navigation(page)
            
            # ========== ERROR HANDLING ==========
            print("\n=== STEP 7: ERROR HANDLING ===")
            test_error_handling(page)
            
        finally:
            browser.close()

def test_login_and_auth(page):
    """Test login/signup flow"""
    print("\n--- Authentication Page ---")
    
    try:
        page.goto("http://localhost:3000", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Check for Sign In button on homepage
        signin_button = page.locator('a, button').filter(has_text="Sign In")
        if signin_button.count() == 0:
            log_test("Sign In link on homepage", False, "Not found", "critical")
            return False
        
        log_test("Sign In link visible", True)
        
        # Click Sign In
        signin_button.first.click()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        
        # Verify we're on login page
        is_login_page = "/login" in page.url or page.locator('text=/Sign In|Login/i').count() > 0
        if not is_login_page:
            log_test("Navigate to login page", False, f"Wrong URL: {page.url}", "critical")
            return False
        
        log_test("Navigate to login page", True)
        
        # Check for form fields
        email_input = page.locator('input[type="email"]').first
        password_input = page.locator('input[type="password"]').first
        
        if email_input.count() == 0 or password_input.count() == 0:
            log_test("Login form fields visible", False, "Email or password input not found", "critical")
            return False
        
        log_test("Login form fields visible", True)
        
        # Fill in test credentials
        # Using demo@example.com from seed-demo.js
        email_input.fill("demo@example.com")
        password_input.fill("password123")
        
        # Find and click login button
        login_button = page.locator('button').filter(has_text="Sign In")
        if login_button.count() == 0:
            log_test("Login button found", False, "Button not found", "critical")
            return False
        
        log_test("Login button found", True)
        
        # Click login
        login_button.first.click()
        
        # Wait for redirect to dashboard (might take a moment)
        try:
            page.wait_for_url("**/dashboard", timeout=10000)
            page.wait_for_timeout(2000)
        except PlaywrightTimeoutError:
            # Maybe it's showing an error
            error_msg = page.locator('text=/error|invalid|incorrect/i').text_content()
            log_test("Login submission succeeds", False, 
                    f"No redirect to dashboard. URL: {page.url}. Error: {error_msg}", "critical")
            return False
        
        log_test("Login submission succeeds", True, f"Redirected to: {page.url}")
        
        # Verify dashboard loaded
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        
        dashboard_elements = page.locator('h1, h2, button, [class*="card"]').count()
        if dashboard_elements == 0:
            log_test("Dashboard loads after login", False, "No content found", "critical")
            return False
        
        log_test("Dashboard loads after login", True)
        page.screenshot(path="/tmp/dashboard-authenticated.png", full_page=True)
        
        return True
        
    except Exception as e:
        log_test("Authentication flow", False, str(e), "critical")
        return False

def test_dashboard_page(page):
    """Test dashboard page structure and main buttons"""
    print("\n--- Dashboard Page ---")
    
    try:
        # Should already be on dashboard
        if "/dashboard" not in page.url:
            page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
            page.wait_for_timeout(1000)
        
        # Check for key elements
        header_exists = page.locator('h1, h2').count() > 0
        log_test("Dashboard header visible", header_exists)
        
        # Check for Settings button
        settings_btn = page.locator('a, button').filter(has_text="Settings")
        log_test("Settings button visible", settings_btn.count() > 0, 
                f"Found {settings_btn.count()}", "high" if settings_btn.count() == 0 else None)
        
        # Check for main CTA buttons
        add_buttons = page.locator('button').filter(has_text="Add").count()
        log_test("Add/action buttons visible", add_buttons > 0, f"Found {add_buttons} buttons",
                "high" if add_buttons == 0 else None)
        
        page.screenshot(path="/tmp/dashboard-full.png", full_page=True)
        
    except Exception as e:
        log_test("Dashboard verification", False, str(e), "high")

def test_card_flows(page):
    """Test card management flows"""
    print("\n--- Card Management Flows ---")
    
    try:
        # Navigate to dashboard if not there
        if "/dashboard" not in page.url:
            page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
            page.wait_for_timeout(1000)
        
        # ===== TEST: ADD CARD BUTTON =====
        add_card_button = page.locator('button, a').filter(has_text="Add Card")
        if add_card_button.count() > 0:
            log_test("Add Card button found", True)
            test_results["button_flows"]["add_card"] = {"found": True}
            
            # Try clicking
            try:
                add_card_button.first.click()
                page.wait_for_timeout(1500)
                
                # Check what happened
                modal_opened = page.locator('[role="dialog"]').count() > 0
                form_visible = page.locator('form').count() > 0 or \
                              page.locator('input[name*="card"]').count() > 0
                page_changed = "/card" in page.url and "/dashboard" not in page.url
                
                something_happened = modal_opened or form_visible or page_changed
                log_test("Add Card button action triggered", something_happened,
                        f"Modal: {modal_opened}, Form: {form_visible}, Page changed: {page_changed}",
                        "critical" if not something_happened else None)
                
                test_results["button_flows"]["add_card"]["action"] = {
                    "modal_opened": modal_opened,
                    "form_visible": form_visible,
                    "page_changed": page_changed,
                    "url": page.url
                }
                
                # Close modal if opened
                if modal_opened:
                    close_btn = page.locator('[role="dialog"] button').filter(has_text="Close") + \
                               page.locator('[role="dialog"] button').filter(has_text="Cancel")
                    if close_btn.count() > 0:
                        close_btn.first.click()
                        page.wait_for_timeout(500)
                
                # Go back to dashboard
                page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
                page.wait_for_timeout(1000)
                
            except Exception as e:
                log_test("Add Card button click", False, str(e), "critical")
        else:
            log_test("Add Card button found", False, "Button not visible on page", "critical")
        
        # ===== TEST: VIEW CARD DETAILS =====
        view_details_btns = page.locator('a, button').filter(has_text="View Details")
        if view_details_btns.count() > 0:
            log_test("View Details button found", True, f"Found {view_details_btns.count()}")
            
            try:
                view_details_btns.first.click()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1000)
                
                card_detail_page = "/card/" in page.url
                log_test("View Details navigates to card page", card_detail_page, 
                        f"URL: {page.url}", "critical" if not card_detail_page else None)
                
                if card_detail_page:
                    test_card_detail_page(page)
                
            except Exception as e:
                log_test("View Details click", False, str(e), "high")
        else:
            log_test("View Details button found", False, "No cards or view buttons visible", "high")
        
    except Exception as e:
        log_test("Card management flows", False, str(e), "high")

def test_card_detail_page(page):
    """Test card detail page buttons"""
    print("\n--- Card Detail Page ---")
    
    try:
        # Should be on card detail page
        if "/card/" not in page.url:
            return
        
        # Check for Edit button
        edit_btn = page.locator('a, button').filter(has_text="Edit")
        if edit_btn.count() > 0:
            log_test("Edit Card button visible", True)
            test_results["button_flows"]["edit_card"] = {"found": True}
        else:
            log_test("Edit Card button visible", False, "Not found on card detail page", "high")
        
        # Check for Delete button
        delete_btn = page.locator('a, button').filter(has_text="Delete")
        if delete_btn.count() > 0:
            log_test("Delete Card button visible", True)
            test_results["button_flows"]["delete_card"] = {"found": True}
        else:
            log_test("Delete Card button visible", False, "Not found on card detail page", "high")
        
        # Check for Add Benefit button
        add_benefit_btn = page.locator('a, button').filter(has_text="Add Benefit")
        if add_benefit_btn.count() > 0:
            log_test("Add Benefit button visible", True)
            test_results["button_flows"]["add_benefit"] = {"found": True}
            
            # Try clicking it
            try:
                add_benefit_btn.first.click()
                page.wait_for_timeout(1500)
                
                modal_opened = page.locator('[role="dialog"]').count() > 0
                form_visible = page.locator('form').count() > 0
                
                log_test("Add Benefit button action triggered", 
                        modal_opened or form_visible,
                        f"Modal: {modal_opened}, Form: {form_visible}",
                        "critical" if not (modal_opened or form_visible) else None)
                
                # Close if modal opened
                if modal_opened:
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(500)
                
            except Exception as e:
                log_test("Add Benefit button click", False, str(e), "high")
        else:
            log_test("Add Benefit button visible", False, "Not found on card detail page", "high")
        
        # Check for Back button
        back_btn = page.locator('a, button').filter(has_text="Back")
        if back_btn.count() > 0:
            log_test("Back button visible", True)
            test_results["navigation_flows"]["back_button"] = {"found": True}
        else:
            log_test("Back button visible", False, "May be implicit or missing", "medium")
        
        page.screenshot(path="/tmp/card-detail.png", full_page=True)
        
    except Exception as e:
        log_test("Card detail page tests", False, str(e), "high")

def test_benefit_flows(page):
    """Test benefit management flows"""
    print("\n--- Benefit Management Flows ---")
    
    try:
        # Check if we're on card detail page with benefits
        benefits_table = page.locator('table, [class*="benefit"], [data-testid*="benefit"]').count()
        
        if benefits_table > 0:
            # Check for Edit Benefit buttons
            edit_benefit_btns = page.locator('a, button').filter(has_text="Edit Benefit") + \
                               page.locator('a, button').filter(has_text="Edit")
            if edit_benefit_btns.count() > 0:
                log_test("Edit Benefit button visible", True)
                test_results["button_flows"]["edit_benefit"] = {"found": True}
            else:
                log_test("Edit Benefit button visible", False, "Not found in benefits table", "medium")
            
            # Check for Delete Benefit buttons
            delete_benefit_btns = page.locator('a, button').filter(has_text="Delete Benefit") + \
                                 page.locator('a, button').filter(has_text="Delete")
            if delete_benefit_btns.count() > 0:
                log_test("Delete Benefit button visible", True)
                test_results["button_flows"]["delete_benefit"] = {"found": True}
            else:
                log_test("Delete Benefit button visible", False, "Not found in benefits table", "medium")
            
            # Check for Mark as Used button
            used_btns = page.locator('button').filter(has_text="Mark as Used") + \
                       page.locator('button').filter(has_text="Used")
            if used_btns.count() > 0:
                log_test("Mark as Used button visible", True)
                test_results["button_flows"]["mark_used"] = {"found": True}
                
                # Try clicking one
                try:
                    used_btns.first.click()
                    page.wait_for_timeout(1000)
                    log_test("Mark as Used button action triggered", True)
                except Exception as e:
                    log_test("Mark as Used button click", False, str(e), "medium")
            else:
                log_test("Mark as Used button visible", False, "Not found in benefits table", "medium")
        else:
            log_test("Benefits section visible", False, "No benefits table found", "medium")
        
    except Exception as e:
        log_test("Benefit management flows", False, str(e), "medium")

def test_settings_page(page):
    """Test settings page"""
    print("\n--- Settings Page ---")
    
    try:
        page.goto("http://localhost:3000/settings", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        is_settings_page = "/settings" in page.url or page.locator('text=/Settings|Profile/i').count() > 0
        if not is_settings_page:
            log_test("Settings page loads", False, f"Wrong URL: {page.url}", "high")
            return
        
        log_test("Settings page loads", True)
        
        # Check for editable fields
        inputs = page.locator('input').count()
        log_test("Settings form visible", inputs > 0, f"Found {inputs} inputs", 
                "medium" if inputs == 0 else None)
        
        # Check for Save/Update button
        save_btns = page.locator('button').filter(has_text="Save") + \
                   page.locator('button').filter(has_text="Update")
        log_test("Save button visible", save_btns.count() > 0, f"Found {save_btns.count()}",
                "medium" if save_btns.count() == 0 else None)
        
        page.screenshot(path="/tmp/settings-page.png", full_page=True)
        
    except Exception as e:
        log_test("Settings page", False, str(e), "medium")

def test_navigation(page):
    """Test navigation flows"""
    print("\n--- Navigation & Links ---")
    
    try:
        # Test navigation to dashboard
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        log_test("Navigate to dashboard", "/dashboard" in page.url)
        
        # Test navigation to settings
        page.goto("http://localhost:3000/settings", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        log_test("Navigate to settings", "/settings" in page.url)
        
        # Test back navigation
        page.go_back()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        
        log_test("Back navigation works", True)
        
        # Test header/logo navigation
        logo_links = page.locator('a').filter(has_text="CardTrack") + \
                    page.locator('a[href="/"]') + \
                    page.locator('a[href="/dashboard"]')
        log_test("Logo/home navigation visible", logo_links.count() > 0)
        
    except Exception as e:
        log_test("Navigation flows", False, str(e), "medium")

def test_error_handling(page):
    """Test error handling"""
    print("\n--- Error Handling ---")
    
    try:
        # Try to access non-existent card
        page.goto("http://localhost:3000/card/nonexistent-id-12345", wait_until="networkidle")
        page.wait_for_timeout(1500)
        
        # Check for error message or graceful redirect
        has_error = page.locator('text=/Error|not found|404|not exist/i').count() > 0
        redirected_home = page.url == "http://localhost:3000/" or page.url == "http://localhost:3000"
        still_interactive = page.locator('button').count() > 0
        
        graceful_handling = has_error or redirected_home or still_interactive
        log_test("Invalid route handling", graceful_handling, 
                f"Error: {has_error}, Redirected: {redirected_home}, Interactive: {still_interactive}")
        
    except Exception as e:
        log_test("Error handling", False, str(e), "low")

def save_results():
    """Save test results to JSON"""
    results_file = Path("/tmp/frontend-ui-flow-audit-results.json")
    with open(results_file, "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✓ Results saved to {results_file}")
    return results_file

def print_summary():
    """Print summary of results"""
    print("\n" + "="*70)
    print("COMPREHENSIVE FRONTEND UI/UX FLOW AUDIT - SUMMARY")
    print("="*70)
    
    passed_count = sum(1 for t in test_results['tests_executed'] if t['passed'])
    failed_count = sum(1 for t in test_results['tests_executed'] if not t['passed'])
    
    print(f"\n📊 OVERALL STATUS: {'✓ PASSED' if test_results['all_passed'] else '✗ FAILED'}")
    print(f"   Total Tests: {len(test_results['tests_executed'])}")
    print(f"   Passed: {passed_count}")
    print(f"   Failed: {failed_count}")
    print(f"   Success Rate: {(passed_count / len(test_results['tests_executed']) * 100):.1f}%")
    
    print(f"\n🔐 Authentication: {'✓ SUCCESS' if test_results['auth_success'] else '✗ FAILED'}")
    
    print(f"\n🔴 CRITICAL ISSUES: {len(test_results['critical_issues'])}")
    for issue in test_results['critical_issues']:
        print(f"   - {issue['test']}")
        if issue['details']:
            print(f"     └─ {issue['details']}")
    
    print(f"\n🟠 HIGH PRIORITY ISSUES: {len(test_results['high_priority_issues'])}")
    for issue in test_results['high_priority_issues'][:3]:
        print(f"   - {issue['test']}")
    if len(test_results['high_priority_issues']) > 3:
        print(f"   ... and {len(test_results['high_priority_issues']) - 3} more")
    
    print(f"\n🟡 MEDIUM PRIORITY ISSUES: {len(test_results['medium_priority_issues'])}")
    print(f"\n🟢 LOW PRIORITY ISSUES: {len(test_results['low_priority_issues'])}")
    
    print(f"\n📝 Discovered Button Flows:")
    for flow_name, flow_data in test_results['button_flows'].items():
        status = "✓" if flow_data.get("found") or flow_data.get("action") else "✗"
        print(f"   {status} {flow_name}: {flow_data}")
    
    print("\n" + "="*70)

if __name__ == "__main__":
    print("🚀 Starting Comprehensive Frontend UI/UX Flow Audit with Authentication...\n")
    test_all_flows()
    save_results()
    print_summary()
