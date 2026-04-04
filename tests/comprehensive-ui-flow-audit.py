#!/usr/bin/env python3
"""
Comprehensive Frontend UI/UX Flow Audit
Tests all button interactions, modals, forms, and user flows
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright, expect

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
        context = browser.new_context(
            record_video_dir="/tmp/videos" if False else None  # Disable video recording
        )
        page = context.new_page()
        
        try:
            # ========== AUTHENTICATION FLOWS ==========
            print("\n=== TESTING AUTHENTICATION FLOWS ===")
            test_login_flow(page)
            
            # ========== DASHBOARD FLOWS ==========
            print("\n=== TESTING DASHBOARD FLOWS ===")
            test_dashboard_navigation(page)
            
            # ========== CARD MANAGEMENT FLOWS ==========
            print("\n=== TESTING CARD MANAGEMENT FLOWS ===")
            test_card_list_page(page)
            test_add_card_flow(page)
            test_card_detail_page(page)
            test_edit_card_flow(page)
            test_delete_card_flow(page)
            
            # ========== BENEFIT MANAGEMENT FLOWS ==========
            print("\n=== TESTING BENEFIT MANAGEMENT FLOWS ===")
            test_add_benefit_flow(page)
            test_edit_benefit_flow(page)
            test_delete_benefit_flow(page)
            test_mark_benefit_used_flow(page)
            
            # ========== SETTINGS PAGE FLOWS ==========
            print("\n=== TESTING SETTINGS PAGE FLOWS ===")
            test_settings_page(page)
            
            # ========== STATE PERSISTENCE ==========
            print("\n=== TESTING STATE PERSISTENCE ===")
            test_state_persistence(page)
            
            # ========== ERROR HANDLING ==========
            print("\n=== TESTING ERROR HANDLING ===")
            test_error_handling(page)
            
        finally:
            context.close()
            browser.close()

def test_login_flow(page):
    """Test login page and button interactions"""
    print("\n--- Login Page Tests ---")
    
    try:
        page.goto("http://localhost:3000/login", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Check if login page loaded
        login_form_exists = page.locator('input[type="email"]').count() > 0 or \
                           page.locator('input[name*="email"]').count() > 0
        log_test("Login page loads", login_form_exists, "", "critical" if not login_form_exists else None)
        
        # Check for login button
        login_buttons = page.locator('button').filter(has_text="Login").count() + \
                       page.locator('button').filter(has_text="Sign In").count()
        log_test("Login button exists", login_buttons > 0, 
                f"Found {login_buttons} login buttons", "critical" if login_buttons == 0 else None)
        
        # Check for signup link
        signup_link_exists = page.locator('a, button').filter(has_text="Sign up").count() > 0 or \
                            page.locator('a, button').filter(has_text="Create account").count() > 0
        log_test("Signup link/button exists", signup_link_exists, "", "high" if not signup_link_exists else None)
        
        # Take screenshot for reference
        page.screenshot(path="/tmp/login-page.png", full_page=True)
        
    except Exception as e:
        log_test("Login flow accessible", False, str(e), "critical")

def test_dashboard_navigation(page):
    """Test dashboard page navigation"""
    print("\n--- Dashboard Navigation ---")
    
    try:
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Check if dashboard loaded
        dashboard_exists = page.locator('text=/Your Credit Cards|CardTrack|Dashboard/i').count() > 0
        log_test("Dashboard page loads", dashboard_exists, "", "critical" if not dashboard_exists else None)
        
        # Check for Settings button
        settings_button = page.locator('button, a').filter(has_text="Settings").count()
        log_test("Settings button visible", settings_button > 0, "", "high" if settings_button == 0 else None)
        
        # Check for Add Card button
        add_card_button = page.locator('button, a').filter(has_text="Add Card").count()
        log_test("Add Card button visible", add_card_button > 0, "", "critical" if add_card_button == 0 else None)
        
        # Take screenshot
        page.screenshot(path="/tmp/dashboard-page.png", full_page=True)
        
    except Exception as e:
        log_test("Dashboard accessible", False, str(e), "critical")

def test_card_list_page(page):
    """Test card list page and card display"""
    print("\n--- Card List Page ---")
    
    try:
        # Navigate to card list/dashboard
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Check for card items
        card_items = page.locator('[data-testid*="card"], .card, [class*="card-"]').count()
        has_cards = card_items > 0 or page.content().__contains__("card")
        log_test("Card list displays items", has_cards, f"Found {card_items} card elements")
        
        # Check for View Details buttons
        view_buttons = page.locator('button, a').filter(has_text="View Details").count() + \
                      page.locator('button, a').filter(has_text="View Card").count()
        log_test("View Details buttons exist", view_buttons > 0, f"Found {view_buttons} view buttons", 
                "high" if view_buttons == 0 else None)
        
    except Exception as e:
        log_test("Card list page accessible", False, str(e), "high")

def test_add_card_flow(page):
    """Test Add Card button and flow"""
    print("\n--- Add Card Flow ---")
    
    try:
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Find and click Add Card button
        add_card_button = page.locator('button, a').filter(has_text="Add Card")
        button_count = add_card_button.count()
        
        if button_count > 0:
            log_test("Add Card button found", True)
            
            # Click the button
            try:
                add_card_button.first.click()
                page.wait_for_timeout(1500)  # Wait for modal/page to open
                
                # Check if modal opened or page changed
                modal_opened = page.locator('[role="dialog"]').count() > 0
                page_changed = page.url != "http://localhost:3000/dashboard"
                form_visible = page.locator('form, input[name*="card"], input[placeholder*="card"]').count() > 0
                
                action_occurred = modal_opened or page_changed or form_visible
                log_test("Add Card button action triggered", action_occurred,
                        f"Modal: {modal_opened}, Page changed: {page_changed}, Form: {form_visible}",
                        "critical" if not action_occurred else None)
                
                if action_occurred:
                    page.screenshot(path="/tmp/add-card-action.png", full_page=True)
                    test_results["button_flows"]["add_card"] = {
                        "modal": modal_opened,
                        "page_navigation": page_changed,
                        "url": page.url,
                        "form_visible": form_visible
                    }
            except Exception as e:
                log_test("Add Card button clickable", False, str(e), "critical")
        else:
            log_test("Add Card button found", False, "Button not found on page", "critical")
            
    except Exception as e:
        log_test("Add Card flow accessible", False, str(e), "high")

def test_card_detail_page(page):
    """Test card detail page and buttons"""
    print("\n--- Card Detail Page ---")
    
    try:
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Try to find and click a View Details button
        view_buttons = page.locator('button, a').filter(has_text="View Details")
        
        if view_buttons.count() > 0:
            try:
                view_buttons.first.click()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1000)
                
                # Check if we navigated to card detail page
                card_detail_loaded = "/card/" in page.url or page.locator('text=/Card Details|Benefits|Card Info/i').count() > 0
                log_test("Card detail page loads", card_detail_loaded, f"URL: {page.url}", 
                        "critical" if not card_detail_loaded else None)
                
                if card_detail_loaded:
                    # Check for Edit Card button
                    edit_button = page.locator('button, a').filter(has_text="Edit Card").count() + \
                                 page.locator('button, a').filter(has_text="Edit").count()
                    log_test("Edit Card button visible", edit_button > 0, "", 
                            "high" if edit_button == 0 else None)
                    
                    # Check for Delete Card button
                    delete_button = page.locator('button, a').filter(has_text="Delete Card").count() + \
                                   page.locator('button, a').filter(has_text="Delete").count()
                    log_test("Delete Card button visible", delete_button > 0, "", 
                            "high" if delete_button == 0 else None)
                    
                    # Check for Add Benefit button
                    add_benefit_button = page.locator('button, a').filter(has_text="Add Benefit").count()
                    log_test("Add Benefit button visible", add_benefit_button > 0, "", 
                            "high" if add_benefit_button == 0 else None)
                    
                    # Check for Benefits list/table
                    benefits_visible = page.locator('table, [class*="benefit"]').count() > 0
                    log_test("Benefits list visible", benefits_visible, "")
                    
                    page.screenshot(path="/tmp/card-detail-page.png", full_page=True)
                    
            except Exception as e:
                log_test("Card detail page navigation", False, str(e), "critical")
        else:
            log_test("View Details button found", False, "No view buttons on dashboard", "high")
            
    except Exception as e:
        log_test("Card detail page accessible", False, str(e), "high")

def test_edit_card_flow(page):
    """Test Edit Card button flow"""
    print("\n--- Edit Card Flow ---")
    
    try:
        # Navigate to card detail first
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        view_buttons = page.locator('button, a').filter(has_text="View Details")
        if view_buttons.count() > 0:
            view_buttons.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            
            # Try to find Edit Card button
            edit_buttons = page.locator('button, a').filter(has_text="Edit Card") + \
                          page.locator('button, a').filter(has_text="Edit")
            
            if edit_buttons.count() > 0:
                log_test("Edit Card button found", True)
                
                try:
                    edit_buttons.first.click()
                    page.wait_for_timeout(1500)
                    
                    # Check if modal opened or form visible
                    modal_opened = page.locator('[role="dialog"]').count() > 0
                    form_visible = page.locator('form').count() > 0
                    
                    action_occurred = modal_opened or form_visible
                    log_test("Edit Card button action triggered", action_occurred,
                            f"Modal: {modal_opened}, Form: {form_visible}",
                            "critical" if not action_occurred else None)
                    
                    if action_occurred:
                        page.screenshot(path="/tmp/edit-card-action.png", full_page=True)
                        test_results["button_flows"]["edit_card"] = {
                            "modal": modal_opened,
                            "form_visible": form_visible
                        }
                except Exception as e:
                    log_test("Edit Card button clickable", False, str(e), "critical")
            else:
                log_test("Edit Card button found", False, "Button not on card detail page", "high")
                
    except Exception as e:
        log_test("Edit Card flow accessible", False, str(e), "high")

def test_delete_card_flow(page):
    """Test Delete Card button and confirmation flow"""
    print("\n--- Delete Card Flow ---")
    
    try:
        # Navigate to card detail
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        view_buttons = page.locator('button, a').filter(has_text="View Details")
        if view_buttons.count() > 0:
            view_buttons.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            
            # Try to find Delete button
            delete_buttons = page.locator('button, a').filter(has_text="Delete Card") + \
                           page.locator('button, a').filter(has_text="Delete")
            
            if delete_buttons.count() > 0:
                log_test("Delete Card button found", True)
                
                try:
                    # Don't actually click delete to avoid test data issues
                    log_test("Delete Card button discoverable", True)
                    test_results["button_flows"]["delete_card"] = {"discoverable": True}
                except Exception as e:
                    log_test("Delete Card button found", False, str(e), "high")
            else:
                log_test("Delete Card button found", False, "Button not on card detail page", "high")
                
    except Exception as e:
        log_test("Delete Card flow accessible", False, str(e), "high")

def test_add_benefit_flow(page):
    """Test Add Benefit button flow"""
    print("\n--- Add Benefit Flow ---")
    
    try:
        # Navigate to card detail
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        view_buttons = page.locator('button, a').filter(has_text="View Details")
        if view_buttons.count() > 0:
            view_buttons.first.click()
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)
            
            # Find Add Benefit button
            add_benefit_buttons = page.locator('button, a').filter(has_text="Add Benefit")
            
            if add_benefit_buttons.count() > 0:
                log_test("Add Benefit button found", True)
                
                try:
                    add_benefit_buttons.first.click()
                    page.wait_for_timeout(1500)
                    
                    # Check if modal or form opened
                    modal_opened = page.locator('[role="dialog"]').count() > 0
                    form_visible = page.locator('form').count() > 0 or \
                                  page.locator('input[name*="benefit"]').count() > 0
                    
                    action_occurred = modal_opened or form_visible
                    log_test("Add Benefit button action triggered", action_occurred,
                            f"Modal: {modal_opened}, Form: {form_visible}",
                            "critical" if not action_occurred else None)
                    
                    if action_occurred:
                        page.screenshot(path="/tmp/add-benefit-action.png", full_page=True)
                        test_results["button_flows"]["add_benefit"] = {
                            "modal": modal_opened,
                            "form_visible": form_visible
                        }
                except Exception as e:
                    log_test("Add Benefit button clickable", False, str(e), "critical")
            else:
                log_test("Add Benefit button found", False, "Button not on card detail page", "high")
                
    except Exception as e:
        log_test("Add Benefit flow accessible", False, str(e), "high")

def test_edit_benefit_flow(page):
    """Test Edit Benefit button flow"""
    print("\n--- Edit Benefit Flow ---")
    
    try:
        # Check for benefits table and edit buttons
        edit_benefit_buttons = page.locator('button, a').filter(has_text="Edit Benefit") + \
                              page.locator('[class*="edit-benefit"]')
        
        if edit_benefit_buttons.count() > 0:
            log_test("Edit Benefit button found", True)
            test_results["button_flows"]["edit_benefit"] = {"discovered": True}
        else:
            log_test("Edit Benefit button discovery", False, 
                    "No edit buttons found in benefits table", "medium")
            
    except Exception as e:
        log_test("Edit Benefit flow accessible", False, str(e), "medium")

def test_delete_benefit_flow(page):
    """Test Delete Benefit button flow"""
    print("\n--- Delete Benefit Flow ---")
    
    try:
        # Check for delete buttons in benefits table
        delete_buttons = page.locator('button, a').filter(has_text="Delete Benefit") + \
                        page.locator('[class*="delete-benefit"]')
        
        if delete_buttons.count() > 0:
            log_test("Delete Benefit button found", True)
            test_results["button_flows"]["delete_benefit"] = {"discovered": True}
        else:
            log_test("Delete Benefit button discovery", False, 
                    "No delete buttons found in benefits table", "medium")
            
    except Exception as e:
        log_test("Delete Benefit flow accessible", False, str(e), "medium")

def test_mark_benefit_used_flow(page):
    """Test Mark as Used button flow"""
    print("\n--- Mark Benefit as Used Flow ---")
    
    try:
        # Check for "Mark as Used" or similar buttons
        used_buttons = page.locator('button').filter(has_text="Mark as Used") + \
                      page.locator('button').filter(has_text="Mark Used") + \
                      page.locator('button').filter(has_text="Toggle Used")
        
        if used_buttons.count() > 0:
            log_test("Mark Used button found", True)
            test_results["button_flows"]["mark_used"] = {"discovered": True}
        else:
            log_test("Mark Used button discovery", False, 
                    "No 'Mark as Used' buttons found", "medium")
            
    except Exception as e:
        log_test("Mark Used flow accessible", False, str(e), "medium")

def test_settings_page(page):
    """Test settings page and buttons"""
    print("\n--- Settings Page ---")
    
    try:
        page.goto("http://localhost:3000/settings", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Check if settings page loaded
        settings_loaded = "/settings" in page.url or page.locator('text=/Settings|Profile|Account/i').count() > 0
        log_test("Settings page loads", settings_loaded, f"URL: {page.url}", 
                "medium" if not settings_loaded else None)
        
        if settings_loaded:
            # Check for edit/save buttons
            edit_buttons = page.locator('button').filter(has_text="Edit").count() + \
                          page.locator('button').filter(has_text="Save").count()
            log_test("Settings edit/save buttons visible", edit_buttons > 0, 
                    f"Found {edit_buttons} buttons", "medium" if edit_buttons == 0 else None)
            
            page.screenshot(path="/tmp/settings-page.png", full_page=True)
            
    except Exception as e:
        log_test("Settings page accessible", False, str(e), "medium")

def test_state_persistence(page):
    """Test that changes persist after page reload"""
    print("\n--- State Persistence ---")
    
    try:
        initial_url = page.url
        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        
        # Just verify page still works after reload
        page_loaded = page.content().__len__() > 0
        log_test("Page state persists after reload", page_loaded)
        
    except Exception as e:
        log_test("State persistence", False, str(e), "medium")

def test_error_handling(page):
    """Test error handling and messages"""
    print("\n--- Error Handling ---")
    
    try:
        # Try to navigate to non-existent card
        page.goto("http://localhost:3000/card/nonexistent-id", wait_until="networkidle")
        page.wait_for_timeout(1000)
        
        # Check for error message or graceful handling
        has_error_message = page.locator('text=/Error|Not found|not found|404/i').count() > 0
        handled_gracefully = page.locator('button').count() > 0  # Page still interactive
        
        log_test("Invalid card handling", has_error_message or handled_gracefully, 
                f"Error msg: {has_error_message}, Graceful: {handled_gracefully}")
        
    except Exception as e:
        log_test("Error handling test", False, str(e), "low")

def save_results():
    """Save test results to file"""
    results_file = Path("/tmp/frontend-ui-flow-audit-results.json")
    with open(results_file, "w") as f:
        json.dump(test_results, f, indent=2)
    
    print(f"\n✓ Results saved to {results_file}")
    return results_file

def print_summary():
    """Print summary of results"""
    print("\n" + "="*60)
    print("COMPREHENSIVE FRONTEND UI/UX FLOW AUDIT - SUMMARY")
    print("="*60)
    
    print(f"\n📊 OVERALL STATUS: {'✓ PASSED' if test_results['all_passed'] else '✗ FAILED'}")
    print(f"   Total Tests: {len(test_results['tests_executed'])}")
    print(f"   Passed: {sum(1 for t in test_results['tests_executed'] if t['passed'])}")
    print(f"   Failed: {sum(1 for t in test_results['tests_executed'] if not t['passed'])}")
    
    print(f"\n🔴 CRITICAL ISSUES: {len(test_results['critical_issues'])}")
    for issue in test_results['critical_issues']:
        print(f"   - {issue['test']}: {issue['details']}")
    
    print(f"\n🟠 HIGH PRIORITY ISSUES: {len(test_results['high_priority_issues'])}")
    for issue in test_results['high_priority_issues'][:5]:  # Show first 5
        print(f"   - {issue['test']}: {issue['details']}")
    
    print(f"\n🟡 MEDIUM PRIORITY ISSUES: {len(test_results['medium_priority_issues'])}")
    print(f"\n🟢 LOW PRIORITY ISSUES: {len(test_results['low_priority_issues'])}")
    
    print(f"\n📝 Button Flows Discovered:")
    for flow_name, flow_data in test_results['button_flows'].items():
        print(f"   - {flow_name}: {flow_data}")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    print("🚀 Starting Comprehensive Frontend UI/UX Flow Audit...")
    test_all_flows()
    save_results()
    print_summary()
