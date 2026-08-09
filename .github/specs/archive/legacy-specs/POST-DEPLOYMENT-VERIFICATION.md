# 🧪 POST-DEPLOYMENT VERIFICATION TESTS

## Railway Deployment Status

**Deployment Initiated**: ✅ Pushed to main branch
**Expected Deploy Time**: 5-10 minutes
**Health Check**: `/api/health` endpoint
**Dashboard Link**: https://railway.app/project

### Monitoring the Deployment
1. Go to Railway.app dashboard
2. Select the Card Benefits project
3. Watch for green ✅ checkmark on deployment
4. Monitor the logs for any errors

---

## Critical Test Flows (6 Tests)

### 🧪 TEST 1: AUTHENTICATION FLOW

**Purpose**: Verify Wave 1 auth fixes are working (no 401 regressions)

**Test Steps**:
```
1. Navigate to https://card-benefits-production.up.railway.app/login
2. Enter test credentials (create account if needed)
3. Click Login
   → Expected: Redirect to dashboard (no 401 error)
   → Expected: Session cookie set in browser
4. Navigate to https://card-benefits-production.up.railway.app/dashboard
   → Expected: Dashboard loads
   → Expected: User name displays (not "User" or null)
5. Open browser DevTools → Console
   → Expected: No 401 errors in logs
   → Expected: No auth-related errors
6. Click Logout
   → Expected: Redirect to login page
   → Expected: Session cleared
7. Try to access /dashboard directly (without login)
   → Expected: Redirect to /login
   → Expected: 401 on any API calls without session
```

**Pass Criteria**: ✅ Authentication works end-to-end, no 401 regressions

---

### 🧪 TEST 2: CRUD OPERATIONS (Wave 1 & 2 Validation)

**Purpose**: Verify button wiring and data persistence

**Part A: Add Card**
```
1. On dashboard, click "Add Card" button
2. Fill in card details:
   - Name: "Test Visa"
   - Annual Fee: 100
   - Earn Rate: 2x
3. Click Submit
   → Expected: POST to /api/cards/add
   → Expected: Response 200 OK (NOT 401)
   → Expected: Card appears in list immediately
   → Expected: Card data saved to database
```

**Part B: Add Benefit**
```
1. On card detail page, click "Add Benefit" button
2. Fill in benefit details:
   - Description: "5% dining"
   - Value: 100
   - Expiry: 12 months
3. Click Submit
   → Expected: POST to /api/benefits/add
   → Expected: Response 200 OK (NOT 401)
   → Expected: Benefit appears in list immediately
   → Expected: Include timesUsed field (0)
```

**Part C: Mark Used (Wave 2 Button Fix)**
```
1. On card detail page, find a benefit
2. Click "Mark Used" button
   → Expected: Instant toggle (no modal popup)
   → Expected: Button state changes immediately
   → Expected: POST to /api/benefits/[id]/toggle-used
   → Expected: Response 200 OK
   → Expected: timesUsed increments (0 → 1)
3. Click "Mark Used" again
   → Expected: Toggle back to unused
   → Expected: timesUsed decrements
```

**Part D: Edit Benefit**
```
1. On card detail page, click benefit row
2. Click "Edit" button
   → Expected: Modal appears
   → Expected: Current data pre-filled
3. Change value to $250
4. Click Save
   → Expected: PATCH to /api/benefits/[id]
   → Expected: Response 200 OK
   → Expected: Modal closes
   → Expected: New value displays ($250.00)
```

**Part E: Delete Benefit**
```
1. On card detail page, click benefit row
2. Click "Delete" button
3. Confirm deletion
   → Expected: DELETE to /api/benefits/[id]
   → Expected: Response 204 No Content
   → Expected: Empty response body
   → Expected: Benefit removed from list
   → Expected: List updates without page reload
```

**Part F: Delete Card**
```
1. On card detail page, scroll to bottom
2. Click "Delete Card" button
3. Confirm deletion
   → Expected: DELETE to /api/cards/[id]
   → Expected: Response 204 No Content
   → Expected: Redirect to dashboard
   → Expected: Card removed from list
```

**Pass Criteria**: ✅ All CRUD operations work without 401 errors, data persists

---

### 🧪 TEST 3: DATA DISPLAY (Wave 2 Validation)

**Purpose**: Verify real data displays correctly with proper formatting

**Test Steps**:
```
1. On dashboard, select a card with benefits
2. Verify card data:
   → Name displays correctly
   → Annual fee shows as number
   → Earn rate displays
3. Verify benefit data:
   → Description text displays
   → stickerValue format: "$XXX.XX" (e.g., "$150.00")
      → NOT: "150" (no dollar sign)
      → NOT: "$150" (missing cents)
      → NOT: "150.0" (missing dollar sign and full cents)
   → timesUsed displays as integer (0, 1, 2, etc.)
      → NOT: null or undefined
      → NOT: floating point (0.5)
4. Add a new benefit with value $45.50
   → Expected: Displays as "$45.50"
5. Edit that benefit to $120.00
   → Expected: Displays as "$120.00"
```

**Pass Criteria**: ✅ All data displays correctly, currency formatted as "$XXX.XX"

---

### 🧪 TEST 4: VISUAL DESIGN (Wave 3 Validation)

**Purpose**: Verify theming, contrast, and responsive design

**Part A: Light Mode**
```
1. Ensure light mode is active (check theme toggle)
2. Check page elements:
   → Background: White or light gray
   → Text: Dark gray or black
   → Buttons: Proper color contrast
   → Links: Visible and distinct
   → Error messages: Red text on light background
      → Use DevTools to verify contrast ratio ≥ 4.5:1
3. Look for any visual glitches:
   → No overlapping elements
   → No cutoff text
   → Proper padding/margins
```

**Part B: Dark Mode**
```
1. Click theme toggle to activate dark mode
2. Check page elements:
   → Background: Dark gray or black
   → Text: White or light gray
   → Buttons: Proper color contrast
   → Links: Visible and distinct
   → Error messages: Yellow/red on dark background
      → Use DevTools to verify contrast ratio ≥ 4.5:1
3. Look for any visual glitches:
   → No overlapping elements
   → All text readable
   → Proper padding/margins
```

**Part C: Responsive Design**
```
1. Mobile (375px width):
   - Open DevTools → Toggle device toolbar → iPhone SE
   - Check all pages load correctly:
     ✓ Login page
     ✓ Dashboard
     ✓ Card detail page
     ✓ Settings page
   - Verify:
     → Error messages fit on screen (no horizontal scroll)
     → Modals fit on screen (max-height applied)
     → Buttons are clickable (min 44px height)
     → Text is readable (no overflow)

2. Tablet (768px width):
   - Open DevTools → iPad
   - Check layout:
     → Two-column layout works
     → Cards display in grid
     → Modals centered and sized appropriately

3. Desktop (1440px width):
   - Check layout:
     → Full layout displays
     → Multiple columns work
     → Spacing is balanced
```

**Part D: Error Message Styling**
```
1. Trigger an error (try to add benefit with empty description):
   → Error message appears
   → In Light Mode: Red text on light background
   → In Dark Mode: Yellow/red text on dark background
   → Use DevTools to verify contrast ratio:
     * Right-click element → Inspect
     * Look for "Contrast" metric
     * Should show ≥ 4.5:1 for normal text
```

**Pass Criteria**: ✅ Light & dark modes look good, responsive on all viewports, readable error messages

---

### 🧪 TEST 5: ERROR HANDLING (All Waves)

**Purpose**: Verify error handling works correctly

**Part A: Invalid Data Error**
```
1. On dashboard, try to add a card with:
   - Name: (leave blank)
   - Annual Fee: "abc" (not a number)
2. Click Submit
   → Expected: 400 Bad Request error
   → Expected: Error message displays (e.g., "Name is required")
   → Expected: Error text is readable (good contrast)
   → Expected: Modal stays open (allows retry)
3. Fix the data and submit again
   → Expected: Success
```

**Part B: Non-existent Resource Error**
```
1. Manually edit URL to: /card/nonexistent-id
   → Expected: Page loads or shows error
   → Expected: 404 error message displays
   → Expected: Error text is readable
   → Expected: Ability to navigate back
2. Try to access /api/cards/nonexistent-id directly:
   → Expected: API returns 404
   → Expected: JSON error response with readable message
```

**Part C: Unauthorized Access Error**
```
1. Log out of the application
2. Open browser DevTools → Network tab
3. Try to make API calls:
   → Try accessing /api/cards/my-cards without session
   → Expected: 401 Unauthorized
4. Log back in
   → Expected: API calls succeed
   → Expected: 200 OK responses
```

**Part D: Server Error Recovery**
```
1. Monitor health check: GET /api/health
   → Expected: 200 OK response
   → Expected: Quick response time
2. Check application logs for errors:
   → Expected: Zero errors in logs
   → Expected: Only info/debug messages
   → Expected: No stack traces
```

**Pass Criteria**: ✅ Error handling works, messages are readable, no unhandled errors

---

### 🧪 TEST 6: PERFORMANCE & MONITORING

**Purpose**: Verify performance and system health

**Part A: API Response Times**
```
1. Open browser DevTools → Network tab
2. Perform CRUD operations:
   - Add Card → Check request time
   - Add Benefit → Check request time
   - Mark Used → Check request time
   - Get Card Details → Check request time
   → Expected: All responses < 200ms
   → Expected: No timeouts (5s threshold)
3. Check individual requests:
   - POST /api/cards/add: < 200ms
   - POST /api/benefits/add: < 200ms
   - POST /api/benefits/[id]/toggle-used: < 200ms
   - GET /api/cards/[id]: < 200ms
```

**Part B: Build Output Verification**
```
1. Go to Railway dashboard → Deployment logs
2. Check build output for:
   → "Compiled successfully" message
   → All 20 routes listed
   → No errors in output
   → No warnings in output
```

**Part C: Health Check Monitoring**
```
1. In browser, navigate to: /api/health
   → Expected: 200 OK response
   → Expected: JSON response body
   → Expected: Response time < 100ms
2. Monitor Railway health check:
   → Expected: Green status (healthy)
   → Expected: All checks passing
```

**Part D: Log Monitoring**
```
1. Go to Railway dashboard → Logs tab
2. Look for:
   → NO 401 errors (auth regression check)
   → NO 500 errors (server crashes)
   → NO database connection errors
   → Only normal request logs
3. Search logs for "error":
   → Expected: Zero results (or only expected errors)
```

**Pass Criteria**: ✅ Fast responses (< 200ms), healthy deployment, no errors in logs

---

## Final Sign-Off

### ✅ All Tests Pass?

```
[ ] Test 1: Authentication - PASS
[ ] Test 2: CRUD Operations - PASS
[ ] Test 3: Data Display - PASS
[ ] Test 4: Visual Design - PASS
[ ] Test 5: Error Handling - PASS
[ ] Test 6: Performance - PASS
```

### 🚀 DEPLOYMENT SUCCESSFUL

Once all 6 tests pass:

```
✅ Card Benefits Tracker MVP is LIVE and PRODUCTION-READY
✅ All critical fixes implemented and verified
✅ Zero blockers remaining
✅ Ready for users
```

---

## Troubleshooting

### If API calls return 401 (Wave 1 Regression)

**Check**:
1. Verify session cookie is set in browser
2. Check middleware.ts has PROTECTED_API_PREFIXES configured
3. Verify /api/user/profile endpoint responds 200 OK
4. Check Railway logs for auth-related errors

**Fix**:
```bash
# Check middleware configuration
grep -n "PROTECTED_API_PREFIXES" src/middleware.ts

# Check auth routes exist
ls -la src/app/api/auth/

# Check session is created
grep -n "session" src/lib/auth.ts
```

---

### If "Mark Used" button doesn't work (Wave 2 Regression)

**Check**:
1. Click button triggers API call to /api/benefits/[id]/toggle-used
2. Response includes timesUsed field
3. UI updates immediately without modal

**Fix**:
```bash
# Verify handleMarkUsed is wired
grep -n "handleMarkUsed" src/app/(dashboard)/card/[id]/page.tsx

# Check toggle endpoint exists
cat src/app/api/benefits/[id]/toggle-used/route.ts
```

---

### If styling looks wrong (Wave 3 Regression)

**Check**:
1. Dark mode variables are defined
2. CSS color contrast meets WCAG AA
3. Responsive breakpoints work
4. Error messages are readable

**Fix**:
```bash
# Check dark mode variants
grep -n "dark:" src/app/globals.css

# Check color definitions
grep -n "color" tailwind.config.js

# Check responsive design
grep -n "@media" src/app/globals.css
```

---

## Contact & Support

**For Deployment Issues**:
- Check Railway Dashboard: https://railway.app
- Review Deployment Logs
- Check Application Error Logs
- Verify Environment Variables

**For Code Issues**:
- Check `.github/specs/FINAL-DEPLOYMENT-REPORT.md`
- Review `.github/specs/WAVE*-QA-REPORT.md`
- Check implementation files for fixes

**Rollback Procedure** (if critical issues):
```bash
git revert <problematic-commit>
git push origin main
# Railway auto-redeploys (~3-5 minutes)
```

---

**Status**: ✅ READY FOR POST-DEPLOYMENT TESTING

Execute these tests immediately after Railway reports "Deployment Successful".
