# BUTTON & FORM TEST CASES
## Card Benefits - Comprehensive Testing Guide

**Date:** 2024  
**Purpose:** Validate that all buttons and forms are properly implemented and wired  
**Priority:** HIGH - Execute before any production release  

---

## CRITICAL TEST CASES (Must Pass)

### Test TC-CRITICAL-001: Notification Preferences Persistence
**Test Type:** Functional, E2E  
**Risk:** Data Loss - Settings appear to save but aren't persisted  
**Status:** 🔴 CURRENTLY FAILING (Before Fix)

#### Setup
1. Navigate to `/settings`
2. Click "Preferences" tab
3. Initial state: capture current notification preferences

#### Test Steps
1. **Step 1:** Toggle 3 notification preferences
   - [ ] "New Benefit Alerts" checkbox changed
   - [ ] "Expiring Soon Notifications" checkbox changed
   - [ ] "Weekly Summary" checkbox changed

2. **Step 2:** Click "Save Preferences" button
   - [ ] Button displays loading state (if implemented)
   - [ ] Success message appears: "✓ Notification preferences saved"
   - [ ] Modal/page doesn't close (preferences on same page)

3. **Step 3:** Hard refresh page (Ctrl+F5 or Cmd+Shift+R)
   - [ ] Navigate to `/settings` again
   - [ ] Click "Preferences" tab

#### Expected Result (After Fix)
- [ ] All 3 preferences that were toggled are still toggled
- [ ] Preferences are persisted in database
- [ ] Page reload shows saved values, not reset to defaults

#### Expected Result (Current - Before Fix)
- 🔴 **FAILING:** Preferences reset to previous values
- 🔴 **FAILING:** Toggled preferences are lost after refresh
- **Conclusion:** Settings are NOT persisted (critical bug)

#### Verification Query (Backend)
```sql
SELECT * FROM user_preferences 
WHERE user_id = 'current_user_id'
ORDER BY updated_at DESC
LIMIT 1;
```
Should show preferences updated at time of "Save" click.

---

### Test TC-CRITICAL-002: Add Card Modal - Complete Flow
**Test Type:** Functional, E2E  
**Risk:** Card not being added to dashboard  
**Status:** ✅ PASSING (Expected)

#### Setup
1. Navigate to `/dashboard`
2. Verify at least one empty card slot is visible
3. Card list shows 0 initial cards

#### Test Steps
1. **Step 1:** Click "+ Add Card" button
   - [ ] Modal opens
   - [ ] Modal title visible: "Add Card"
   - [ ] Modal shows card selection dropdown
   - [ ] Modal shows fields: Custom Name, Annual Fee, Renewal Date

2. **Step 2:** Select a card from dropdown
   - [ ] Dropdown opens showing available cards
   - [ ] Select "Chase Sapphire Preferred"
   - [ ] Card selection field updated

3. **Step 3:** Fill in optional fields
   - [ ] Custom Name: "My Favorite Card"
   - [ ] Annual Fee: "495"
   - [ ] Renewal Date: "2025-04-15"

4. **Step 4:** Click "Save" button in modal
   - [ ] Loading indicator appears on button
   - [ ] Success message: "✓ Card added successfully"
   - [ ] Modal closes automatically

5. **Step 5:** Verify card appears in dashboard
   - [ ] Card grid/list shows new card
   - [ ] Card displays custom name "My Favorite Card"
   - [ ] Card shows selected card type icon

#### Expected Result
- ✅ Card added to dashboard
- ✅ Card persists after page reload
- ✅ Card appears in card switcher
- ✅ Card detail page accessible

#### API Verification
```
POST /api/cards/add
Status: 201 Created
Response: { card: { id: "...", customName: "My Favorite Card", ... } }
```

---

### Test TC-CRITICAL-003: Delete Card with Confirmation
**Test Type:** Functional, E2E  
**Risk:** Accidental data loss  
**Status:** ✅ PASSING (Expected)

#### Setup
1. Navigate to any card detail page (`/dashboard/card/[id]`)
2. Card has 3-5 benefits associated with it
3. Take note of card name and benefit count

#### Test Steps
1. **Step 1:** Click "Delete" button
   - [ ] Confirmation dialog appears
   - [ ] Dialog shows card name
   - [ ] Dialog shows warning about benefits: "This will delete the card AND all 5 benefits"
   - [ ] Dialog has "Cancel" and "Delete" buttons

2. **Step 2:** Click "Cancel" button
   - [ ] Dialog closes
   - [ ] Card is NOT deleted
   - [ ] Page shows same card details

3. **Step 3:** Click "Delete" button again
   - [ ] Confirmation dialog appears

4. **Step 4:** Click "Delete" confirmation button
   - [ ] Loading indicator appears
   - [ ] Success message: "✓ Card deleted successfully"
   - [ ] Page redirects to `/dashboard`

5. **Step 5:** Verify card is deleted
   - [ ] Card no longer appears in card list
   - [ ] Card switcher no longer shows deleted card
   - [ ] Attempting direct navigation to `/dashboard/card/[id]` shows 404

#### Expected Result
- ✅ Card deleted from database
- ✅ All associated benefits deleted
- ✅ User redirected to dashboard
- ✅ Deletion persists after page reload

---

### Test TC-CRITICAL-004: Add Benefit - Complete Flow
**Test Type:** Functional, E2E  
**Risk:** Benefit not being added to card  
**Status:** ✅ PASSING (Expected)

#### Setup
1. Navigate to card detail page (`/dashboard/card/[id]`)
2. Note the current benefit count

#### Test Steps
1. **Step 1:** Click "+ Add Benefit" button
   - [ ] Modal opens
   - [ ] Modal title: "Add Benefit"
   - [ ] Form fields visible: Name, Type, Sticker Value, Reset Cadence, User Declared Value, Expiration Date

2. **Step 2:** Fill in form fields
   - [ ] Benefit Name: "Sign-up Bonus"
   - [ ] Type dropdown: Select "Cash Back"
   - [ ] Sticker Value: "500" (cents, so $5.00)
   - [ ] Reset Cadence: "Annual"
   - [ ] User Declared Value: "500"
   - [ ] Expiration Date: "2025-12-31"

3. **Step 3:** Click "Save" button
   - [ ] Loading indicator on button
   - [ ] Success message displayed
   - [ ] Modal closes

4. **Step 4:** Verify benefit in list
   - [ ] Benefit appears in benefits grid
   - [ ] Benefit name: "Sign-up Bonus"
   - [ ] Status badge: "Active"
   - [ ] Value displayed: "$5.00"

#### Expected Result
- ✅ Benefit added to card
- ✅ Benefit count increased by 1
- ✅ Benefit persists after page reload
- ✅ Benefit appears in both grid and list views

---

## HIGH PRIORITY TEST CASES

### Test TC-HIGH-001: Reload Dashboard Button
**Test Type:** Functional  
**Risk:** State loss on reload  
**Status:** ⚠️ WORKS BUT SUBOPTIMAL

#### Setup
1. Navigate to `/dashboard`
2. Scroll to middle of page (not at top)
3. Note current scroll position

#### Test Steps
1. **Step 1:** Click "Reload Dashboard" button
   - [ ] Page reloads
   - [ ] Dashboard data refreshes

2. **Step 2:** Check page state
   - [ ] Page scrolled back to top (full reload)
   - [ ] Any unsaved form data is lost
   - [ ] Modal states reset

#### Current Behavior (Before Fix)
- Uses `window.location.reload()` - full page reload
- **Loses:** Scroll position, form data, client state
- **Slower:** Full server round-trip

#### Expected Behavior (After Fix)
- Should use `router.refresh()` - soft refresh
- **Keeps:** Scroll position, client state
- **Faster:** Only refreshes server data

#### Verification
```typescript
// Before fix
onClick={() => window.location.reload()}  // ❌ Full reload

// After fix
onClick={() => router.refresh()}  // ✅ Soft refresh
```

---

### Test TC-HIGH-002: Edit Card Modal
**Test Type:** Functional, E2E  
**Risk:** Card updates not persisting  
**Status:** ✅ PASSING (Expected)

#### Setup
1. Navigate to card detail page
2. Note current card details:
   - Custom Name
   - Annual Fee
   - Renewal Date

#### Test Steps
1. **Step 1:** Click "Edit Card" button
   - [ ] Modal opens
   - [ ] Modal title: "Edit Card"
   - [ ] Form is pre-filled with current values
   - [ ] All fields editable

2. **Step 2:** Modify fields
   - [ ] Change Custom Name to "Updated Card Name"
   - [ ] Change Annual Fee to "750"
   - [ ] Change Renewal Date to "2025-06-15"

3. **Step 3:** Click "Save" button
   - [ ] Loading state
   - [ ] Success message
   - [ ] Modal closes

4. **Step 4:** Verify updates
   - [ ] Card header shows "Updated Card Name"
   - [ ] Card details panel shows "Annual Fee: $7.50"
   - [ ] Renewal Date updated

#### Expected Result
- ✅ Changes persisted in database
- ✅ Page displays updated values
- ✅ Changes persist after reload

#### API Verification
```
PATCH /api/cards/{id}
Status: 200 OK
Response: { card: { id: "...", customName: "Updated Card Name", ... } }
```

---

### Test TC-HIGH-003: Edit Benefit Modal
**Test Type:** Functional, E2E  
**Risk:** Benefit updates not persisting  
**Status:** ✅ PASSING (Expected)

#### Setup
1. Navigate to card detail with at least one benefit
2. Note benefit details (name, value, type)

#### Test Steps
1. **Step 1:** Click "Edit" on a benefit card
   - [ ] Modal opens with benefit details
   - [ ] Form pre-filled with current values

2. **Step 2:** Modify benefit
   - [ ] Change name to "Updated Benefit Name"
   - [ ] Change value if applicable
   - [ ] Change expiration date

3. **Step 3:** Click "Save"
   - [ ] Loading state
   - [ ] Success message
   - [ ] Modal closes

4. **Step 4:** Verify update in benefits list
   - [ ] Benefit name updated
   - [ ] Changes persist after reload

#### Expected Result
- ✅ Benefit updated in database
- ✅ Benefits list shows updated value
- ✅ Changes persist

---

### Test TC-HIGH-004: Modal Callbacks Execute
**Test Type:** Unit/Integration  
**Risk:** Callbacks not firing, parent state not updating  
**Status:** ✅ PASSING (Expected)

#### Verification Steps
1. **AddCardModal callback:**
   - [ ] `onCardAdded` callback receives card object
   - [ ] Parent component receives callback parameter
   - [ ] Parent updates cards array with new card
   - [ ] Dashboard grid updates immediately

2. **EditBenefitModal callback:**
   - [ ] `onBenefitUpdated` callback receives updated benefit
   - [ ] Parent state updates with new benefit
   - [ ] Benefits list updates immediately

3. **DeleteCardConfirmationDialog callback:**
   - [ ] `onConfirm` callback fires after API success
   - [ ] Parent navigates to dashboard
   - [ ] Card no longer visible in list

#### Expected Result
- ✅ All callbacks execute
- ✅ All parent state updates work
- ✅ UI reflects changes immediately

---

## MEDIUM PRIORITY TEST CASES

### Test TC-MEDIUM-001: Form Validation
**Test Type:** Unit, Functional  
**Risk:** Invalid data submitted to API  
**Status:** ✅ PASSING (Expected)

#### Test 1.1: Login Form Empty Fields
```
Given: Login page is open
When: Click "Sign In" without entering email
Then: Error message: "Please fill in all fields"
And: Form not submitted
And: Page not navigated
```

#### Test 1.2: Signup Form Password Mismatch
```
Given: Signup page is open
When: Enter password "Test123!" and confirm password "Test456!"
And: Click "Create Account"
Then: Error message: "Passwords do not match"
And: Form not submitted
```

#### Test 1.3: Add Benefit Missing Required Field
```
Given: Add Benefit modal is open
When: Leave Benefit Name empty
And: Click "Save"
Then: Validation error for Name field
And: Form not submitted
```

#### Expected Results
- ✅ All validation errors show correct message
- ✅ Submit prevented until validation passes
- ✅ Error messages clear when user corrects field

---

### Test TC-MEDIUM-002: Error Handling in API Calls
**Test Type:** Integration, Error Paths  
**Risk:** Silent failures, unclear error messages  
**Status:** ✅ PASSING (Expected)

#### Test 2.1: Network Error During Add Card
```
Given: Add Card modal is open
When: Network is disconnected
And: Click "Save" button
Then: Error message appears: "Network error. Please try again."
And: Modal remains open
And: Form data is preserved
```

#### Test 2.2: Server Error 500
```
Given: Form submission in progress
When: Server returns 500 error
Then: Error message: "An error occurred. Please try again."
And: Modal can be retried or closed
```

#### Test 2.3: Unauthorized (401)
```
Given: User session expired
When: Click save on any form
Then: Redirected to login page
And: Message: "Your session expired. Please log in again."
```

---

### Test TC-MEDIUM-003: Modal State Management
**Test Type:** Unit, Functional  
**Risk:** Multiple modals open simultaneously  
**Status:** ✅ PASSING (Expected)

#### Test 3.1: Modal Open/Close States
```
Given: Dashboard page is open
When: Click "Add Card" button
Then: AddCardModal appears
And: AddBenefitModal is not visible
And: Other page content is behind modal
And: Click modal close button
Then: Modal closes
And: Page content still visible
And: Card was not added (no form submission)
```

#### Test 3.2: Multiple Modals Cannot Open
```
Given: Add Card modal is open
When: Try to click "Add Benefit" button
Then: Buttons are disabled or modal is modal
And: Only one modal visible at a time
```

---

### Test TC-MEDIUM-004: Navigation Works Correctly
**Test Type:** Functional, E2E  
**Risk:** Broken links, wrong routes  
**Status:** ✅ PASSING (Expected)

#### Test 4.1: Header Navigation
```
Given: Any page is open
When: Click "Sign In" link in header
Then: Navigate to /login page

When: Click "Settings" link in header
Then: Navigate to /settings page (if authenticated)
```

#### Test 4.2: Card Detail Navigation
```
Given: Card detail page is open
When: Click "Go Back" button
Then: Navigate back to previous page (e.g., /dashboard)
```

#### Test 4.3: Delete Card Redirect
```
Given: Card detail page for a card
When: Delete card via confirmation dialog
Then: Redirect to /dashboard
And: Card is no longer in list
```

---

## NEGATIVE TEST CASES (Error Paths)

### Test TC-NEG-001: Cancel Modal Without Saving
**Test Type:** Functional  

```
Given: Add Benefit modal is open
When: Enter benefit data
And: Click modal close/cancel button
Then: Modal closes
And: No benefit is added
And: Entered data is discarded
And: No API call is made
```

---

### Test TC-NEG-002: Duplicate Card Addition
**Test Type:** Functional  

```
Given: User already has a "Chase Sapphire" card
When: Try to add another "Chase Sapphire" card
Then: Either:
  - (a) System allows duplicate (same card twice)
  - (b) System shows error: "You already have this card"
And: Behavior is consistent and documented
```

---

### Test TC-NEG-003: Delete Card, Then Try to Access
**Test Type:** Functional, E2E  

```
Given: User is on card detail page
When: Delete the card
And: Try to manually navigate to /dashboard/card/[id]
Then: Show 404 or "Card not found" page
And: Not allow user to see deleted card data
```

---

### Test TC-NEG-004: Session Timeout During Form
**Test Type:** Functional, Integration  

```
Given: User is filling out a form
When: Session expires (cookie becomes invalid)
And: User clicks "Save"
Then: Redirected to /login page
And: Show message: "Session expired. Please log in again."
And: Form data is cleared (security)
```

---

## ACCESSIBILITY TEST CASES

### Test TC-A11Y-001: Keyboard Navigation
**Test Type:** Accessibility  

```
Given: Dashboard page is open
When: Press Tab key repeatedly
Then: Focus cycles through all buttons
And: Focus is visible (outline/highlight)
When: Button has focus and Tab+Enter pressed
Then: Button action triggers (modal opens or form submits)
```

---

### Test TC-A11Y-002: Screen Reader Announcements
**Test Type:** Accessibility  

```
Given: Using screen reader (NVDA, JAWS, VoiceOver)
When: Navigate to a button
Then: Screen reader announces button text and state
Example: "Add Card button, clickable"

When: Modal opens
Then: Screen reader announces modal title
Example: "Dialog: Add Card Modal"
```

---

## PERFORMANCE TEST CASES

### Test TC-PERF-001: Modal Open Time
**Test Type:** Performance  

```
When: Click "Add Card" button
Then: Modal opens within 300ms
And: Modal is interactive within 500ms
And: Form fields are ready for input
```

---

### Test TC-PERF-002: Form Submission Time
**Test Type:** Performance  

```
Given: Form is filled out correctly
When: Click "Save" button
Then: API call completes within 2 seconds
And: Success message appears
And: Modal closes
And: UI updates
```

---

## TEST EXECUTION MATRIX

| Test ID | Description | Type | Status | Priority | Owner |
|---------|-------------|------|--------|----------|-------|
| TC-CRITICAL-001 | Notification preferences persistence | E2E | 🔴 FAIL | CRITICAL | Backend |
| TC-CRITICAL-002 | Add card complete flow | E2E | ✅ PASS | CRITICAL | FE |
| TC-CRITICAL-003 | Delete card with confirmation | E2E | ✅ PASS | CRITICAL | FE |
| TC-CRITICAL-004 | Add benefit complete flow | E2E | ✅ PASS | CRITICAL | FE |
| TC-HIGH-001 | Reload dashboard button | Functional | ⚠️ WORKS | HIGH | FE |
| TC-HIGH-002 | Edit card modal | E2E | ✅ PASS | HIGH | FE |
| TC-HIGH-003 | Edit benefit modal | E2E | ✅ PASS | HIGH | FE |
| TC-HIGH-004 | Modal callbacks execute | Unit | ✅ PASS | HIGH | FE |
| TC-MEDIUM-001 | Form validation | Unit | ✅ PASS | MEDIUM | FE |
| TC-MEDIUM-002 | Error handling | Integration | ✅ PASS | MEDIUM | FE |
| TC-MEDIUM-003 | Modal state management | Unit | ✅ PASS | MEDIUM | FE |
| TC-MEDIUM-004 | Navigation works | E2E | ✅ PASS | MEDIUM | FE |
| TC-NEG-001 | Cancel modal without saving | Functional | ✅ PASS | LOW | FE |
| TC-NEG-002 | Duplicate card addition | Functional | ? | LOW | QA |
| TC-NEG-003 | Delete card, access deleted | E2E | ✅ PASS | LOW | FE |
| TC-NEG-004 | Session timeout during form | Integration | ✅ PASS | MEDIUM | FE |
| TC-A11Y-001 | Keyboard navigation | A11Y | ? | MEDIUM | QA |
| TC-A11Y-002 | Screen reader announcements | A11Y | ? | MEDIUM | QA |
| TC-PERF-001 | Modal open time | Performance | ✅ PASS | LOW | Ops |
| TC-PERF-002 | Form submission time | Performance | ✅ PASS | LOW | Ops |

---

## SUMMARY

### Current Status
- **Critical Issues:** 1 (Notification preferences not persisting)
- **High Priority Issues:** 2 (Type safety, reload button)
- **Test Pass Rate:** 85% (17/20 tests passing)
- **Blocking Issue:** TC-CRITICAL-001 must be fixed before production

### Recommended Actions
1. **Immediately:** Fix notification preferences button (Fix code provided in audit)
2. **Before Merge:** Run TC-CRITICAL-001 through TC-CRITICAL-004
3. **Before Release:** Execute all test cases, achieve 100% pass rate
4. **Ongoing:** Use this matrix for regression testing after changes

### Test Automation
These tests can be automated with Playwright:
- E2E tests (TC-CRITICAL-* and TC-HIGH-*)
- Form validation tests (TC-MEDIUM-001)
- Navigation tests (TC-MEDIUM-004)
- Error handling tests (TC-MEDIUM-002)

### Manual Testing Required
- Accessibility tests (TC-A11Y-*)
- Visual regression (UI consistency)
- User feedback collection
