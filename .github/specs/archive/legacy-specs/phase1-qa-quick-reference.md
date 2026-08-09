# Phase 1 MVP Bug Fixes - QA Review Quick Reference

**Purpose:** This is a focused checklist for QA review of the 5 MVP bug fixes  
**Status:** Ready for implementation review  
**Date:** April 3, 2026

---

## 🎯 Quick Review Summary

### The 5 MVP Bugs to Check

| # | Bug | Type | Blocker | Fix Time | Check |
|---|-----|------|---------|----------|-------|
| 1 | Import Validator Type Mismatch | CRITICAL | YES | 2-3h | ✅ 124 tests pass |
| 2 | AddCardModal/CardFiltersPanel Incomplete | HIGH | YES | 4-6h | ✅ Form works + validates |
| 3 | Duplicate Dashboard Routes | MEDIUM | NO | 1h | ✅ Only 1 route |
| 4 | TypeScript Component Test Errors | MEDIUM | NO | 2-3h | ✅ 89 errors fixed |
| 5 | Dark Mode Not Persisting | MEDIUM | NO | 2-3h | ✅ localStorage + CSS |

---

## 🔍 What to Look For After Implementation

### Bug #1: Import Validator Return Type Mismatch

```typescript
// ❌ WRONG - Still returning boolean
const result = validateAnnualFee('550', 1, []);
expect(result).toBe(true); // ← FAIL

// ✅ CORRECT - Now returns object with valid/value
const result = validateAnnualFee('550', 1, []);
expect(result.valid).toBe(true);
expect(result.value).toBe(550);
```

**Check these:**
- [ ] All 124 import validator tests pass
- [ ] No tests checking `expect(result).toBe(true/false)`
- [ ] All tests use `result.valid` or `result.errors`
- [ ] Error array properly accumulated in error parameter
- [ ] Type definitions match implementation

---

### Bug #2: AddCardModal Implementation

**Check these:**
- [ ] Component is NOT just a placeholder
- [ ] Has form with: Card Name, Issuer, Annual Fee, Renewal Date
- [ ] Submit button disabled until form complete
- [ ] Form validates required fields
- [ ] Submits correct data structure
- [ ] Closes modal after successful add
- [ ] No console errors when opening/closing
- [ ] All tests pass (45+ test cases)

**Test it manually:**
```bash
# Should NOT see placeholder text
npm run dev
# Visit /dashboard
# Click "Add Card" button
# Should see real form, not "Add card modal - Phase 2"
```

---

### Bug #3: CardFiltersPanel Implementation

**Check these:**
- [ ] Has all filter sections: Status, Issuer, Fee, Date, Benefits
- [ ] Status filter with Active/Inactive options
- [ ] Issuer dropdown populated with Chase, Amex, Citi, Discover
- [ ] Annual Fee range slider (min/max)
- [ ] Renewal date range picker
- [ ] Benefits checkboxes for each benefit type
- [ ] "Clear Filters" button resets all
- [ ] "Save Filters" saves filter combinations
- [ ] All tests pass (40+ test cases)

**Test it manually:**
```bash
npm run dev
# Click filter icon on dashboard
# Should see all filter controls
# Each filter should update results
# Clear should reset everything
```

---

### Bug #4: Dashboard Route Deduplication

**Check these:**
- [ ] Only ONE dashboard page exists
  - [ ] Remove `src/app/dashboard/page.tsx` OR
  - [ ] Keep it and remove `src/app/(dashboard)/page.tsx`
  - [ ] Recommend: Keep route group `/(dashboard)`
- [ ] No conflicting route definitions
- [ ] Middleware still protects dashboard
- [ ] All navigation links work
- [ ] No 404 errors on `/dashboard`
- [ ] All tests pass (15 test cases)

**File check:**
```bash
# Should NOT have both of these
ls -la src/app/dashboard/page.tsx       # DELETE this
ls -la src/app/(dashboard)/page.tsx     # KEEP this

# After fix: Only one should exist
```

---

### Bug #5: Dark Mode Persistence

**Check these:**
- [ ] Theme preference saves to localStorage
- [ ] Theme persists on page reload
- [ ] CSS variables update on toggle
- [ ] Works in light and dark modes
- [ ] No SSR hydration mismatches
- [ ] Works across: Chrome, Firefox, Safari, Edge
- [ ] Works on mobile (iOS/Android)
- [ ] No console errors about theme
- [ ] All tests pass (100+ test cases)

**Test it manually:**
```bash
npm run dev
# Click dark mode toggle (top right)
# Reload page (Cmd+R)
# Dark mode should still be active
# CSS variables should update (colors change)
# Check localStorage: should have "theme: dark"
```

**Check localStorage:**
```javascript
// Open DevTools console and run:
localStorage.getItem('theme') // Should return 'dark' or 'light'
```

---

## ✅ Test Execution Checklist

Run these tests in order:

```bash
# 1. Run all MVP tests
npm test -- phase1-mvp-bugs-test-suite.test.ts

# 2. Run import validator tests (Bug #1)
npm test -- import-validator.test.ts

# 3. Run component tests (Bug #2, #3, #5)
npm test -- components/

# 4. Run TypeScript compilation (Bug #4)
npx tsc --noEmit

# 5. Run full test suite
npm test

# Expected results:
# - 124 import validator tests: PASS ✅
# - 45+ AddCardModal tests: PASS ✅
# - 40+ CardFiltersPanel tests: PASS ✅
# - 15 dashboard route tests: PASS ✅
# - 100+ dark mode tests: PASS ✅
# - Total: 450+ tests PASSING ✅
# - TypeScript errors: 0 ❌ (89 previously)
```

---

## 🌐 Browser Testing Checklist

Test these in each browser:

| Feature | Chrome | Firefox | Safari | Edge | Mobile |
|---------|--------|---------|--------|------|--------|
| Add Card works | ☐ | ☐ | ☐ | ☐ | ☐ |
| Filters work | ☐ | ☐ | ☐ | ☐ | ☐ |
| Dark mode toggle | ☐ | ☐ | ☐ | ☐ | ☐ |
| Dark mode persists | ☐ | ☐ | ☐ | ☐ | ☐ |
| No console errors | ☐ | ☐ | ☐ | ☐ | ☐ |
| Responsive layout | ☐ | ☐ | ☐ | ☐ | ☐ |
| Form validation | ☐ | ☐ | ☐ | ☐ | ☐ |

**Critical:** Chrome console should have 0 errors

---

## 🔒 Security Checklist

- [ ] Only authenticated users can add cards
- [ ] Only users see their own cards
- [ ] Filter doesn't leak other users' data
- [ ] Card names sanitized (no XSS)
- [ ] Form inputs validated on server
- [ ] Theme preference not a XSS vector
- [ ] localStorage used safely (no eval, etc.)

---

## 📊 Issue Documentation Format

If you find issues, document them like this:

```markdown
### Issue #[N]: [Title]

**File:** src/components/AddCardModal.tsx (Line 45)  
**Severity:** [CRITICAL|HIGH|MEDIUM|LOW]  
**Type:** [Bug|TypeScript Error|Security|Performance]

**Problem:**
[What is wrong]

**Evidence:**
[Exact error message or code snippet]

**Impact:**
[What breaks or security risk]

**Expected:**
[How it should work]

**Fix:**
[Specific steps to fix]

**Status:** NOT STARTED
```

---

## 🎯 Sign-Off Criteria

Review is COMPLETE when:

- [ ] All 5 bugs fixed and tested
- [ ] All 450+ tests passing
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] All browsers tested
- [ ] Security review passed
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] Code ready for staging

---

## 📞 Questions During Review?

**For Bug #1 (Import Validator):**
- Q: Should validators return boolean or object?
- A: Object with `{valid: boolean, value?: any}` to preserve parsed values

**For Bug #2 (Add Card Modal):**
- Q: What fields are required?
- A: Card Name, Issuer, Annual Fee, Renewal Date - all required

**For Bug #3 (Dashboard Routes):**
- Q: Which route should be canonical?
- A: Keep `/(dashboard)` route group, remove standalone `/dashboard`

**For Bug #4 (TypeScript Errors):**
- Q: Do I need to install anything?
- A: Yes: `npm install --save-dev @testing-library/react @testing-library/jest-dom`

**For Bug #5 (Dark Mode):**
- Q: How should theme be stored?
- A: localStorage key 'theme' with value 'light' or 'dark'

---

## 🚀 Next Steps

After sign-off:
1. Tag code for staging: `git tag -a stage/mvp-v1.0 -m "MVP fixes complete"`
2. Deploy to staging environment
3. Run full QA suite on staging
4. Get stakeholder sign-off
5. Deploy to production

---

**Quick Reference Version:** 1.0  
**For full details, see:** `.github/specs/phase1-qa-report.md`  
**Test suite location:** `src/__tests__/phase1-mvp-bugs-test-suite.test.ts`

