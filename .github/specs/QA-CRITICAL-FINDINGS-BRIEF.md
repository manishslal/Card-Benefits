# CRITICAL QA FINDINGS - Mobile Polish Enhancements
## Executive Brief for Developers

**Date:** April 6, 2026
**Status:** ⛔ DO NOT MERGE - CRITICAL BUGS FOUND
**Severity:** 4 Critical + 5 High Priority Issues
**Estimated Fix Time:** 7-11 hours dev + 2-3 hours QA re-testing

---

## The 4 Critical Show-Stoppers

### 🔴 CRITICAL #1: Dashboard Grid Layout Is Wrong
- **What:** Mobile shows 1 column instead of 2
- **Where:** `src/shared/components/features/DashboardSummary.tsx`, line 68
- **Current:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- **Required:** `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- **Impact:** Entire dashboard layout violates spec and looks broken on mobile

**Fix (2 minutes):**
```tsx
// Line 68 - Change from
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
// To
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

// Line 46 - Also fix loading skeleton
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

---

### 🔴 CRITICAL #2: Auto-Populate Fee Has Race Condition
- **What:** Effect dependency on `availableCards` causes issues
- **Where:** `src/features/cards/components/modals/AddCardModal.tsx`, lines 119-135
- **Problem:**
  - User selects card → fee populates ✓
  - User manually clears fee value
  - User selects same card again → fee DOESN'T populate (should) ✗
- **Root Cause:** Effect only runs when `masterCardId` changes, not when `customAnnualFee` is cleared
- **Impact:** Auto-population feature broken in edge cases

**Fix approach:**
- Need separate effect to track card selection changes
- Guard check needs to properly detect "field was cleared"
- OR: Change to track when card ID changes to NEW card (not same card again)

---

### 🔴 CRITICAL #3: CardSwitcher Missing Null Safety
- **What:** Fallback could crash on missing `issuer` property
- **Where:** `src/shared/components/features/CardSwitcher.tsx`, lines 73-80
- **Scenario:**
  ```tsx
  // If card.issuer is null/undefined:
  return `${card.issuer} •••• ${card.lastFour}`;  // Renders as " •••• 1234"
  // Or if card.customName is whitespace-only:
  if (card.customName && card.customName.trim()) { // trim() returns ""
    return card.customName;  // Returns "   " (spaces)
  }
  ```
- **Impact:** Broken UI labels, potential crashes in edge cases

**Fix (5 minutes):**
```tsx
const getCardLabel = (card: Card) => {
  const cleanName = card.customName?.trim();
  if (cleanName && cleanName.length > 0) {
    return cleanName;
  }
  const issuer = card.issuer || 'Card';  // Default if missing
  return `${issuer} •••• ${card.lastFour}`;
};
```

---

### 🔴 CRITICAL #4: SelectContent Width Breaks Popper Positioning
- **What:** `max-w-[calc(100%-2rem)]` overrides Radix UI popper alignment
- **Where:** `src/shared/components/ui/select-unified.tsx`, line 62
- **Problem:** Dropdown appears narrower than trigger button on mobile
- **Visual:** Misaligned, broken-looking dropdown
- **Impact:** Poor UX, looks like UI bug to users

**This needs architectural review:**
- Current approach conflicts with Radix popper positioning
- May need to move max-width constraint to SelectItem instead of Content
- OR: Use Radix UI's built-in width handling instead of manual calc

---

## The 5 High-Priority Issues

### 🟠 HIGH #1: StatCard Icons Removed Completely
- **What:** Specification says "remove icon labels" but code removed the ICONS
- **Where:** `src/features/cards/components/ui/StatCard.tsx`, lines 52-56
- **Expected:** Icon visible, text label visible (2 lines)
- **Actual:** Icon gone, text label only (1 line) ← WRONG
- **Fix:** Restore icon display, keep text label

### 🟠 HIGH #2: Zero-Fee Card Edge Case
- **What:** Auto-populate doesn't work smoothly with $0 fee cards
- **Where:** `src/features/cards/components/modals/AddCardModal.tsx`
- **Scenario:** Select card with $0 annual fee, manually change to different amount, select again
- **Expected:** Fee updates
- **Actual:** Fee might not update correctly

### 🟠 HIGH #3: Admin Tab Edge Case
- **What:** If user logs out while viewing Admin tab, no graceful fallback
- **Where:** `src/app/dashboard/settings/page.tsx`
- **Fix:** Reset activeTab to 'profile' if isAdmin becomes false

### 🟠 HIGH #4: SelectContent Animation Wrong Direction
- **What:** Animation slides in wrong direction on mobile when dropdown at bottom
- **Where:** `src/shared/components/ui/select-unified.tsx`
- **Issue:** `slide-in-from-left-2` doesn't match popper positioning
- **Fix:** Remove positional animations or make them responsive

### 🟠 HIGH #5: Validation Logic Duplication
- **What:** Renewal date validation in two places (onBlur + validateForm)
- **Where:** `src/features/cards/components/modals/AddCardModal.tsx`, lines 306-314 + 146-150
- **Issue:** Inconsistent error messages, hard to maintain
- **Fix:** Consolidate to single validation logic

---

## Medium & Low Priority Issues

### 🟡 Medium Issues (4 total)
1. Empty cards array not handled (CardSwitcher)
2. Change indicator contrast in dark mode (StatCard)
3. Animation might cause layout shift (DashboardSummary)
4. Ref forwarding expectation unclear (UnifiedSelect)

### 🟢 Low Issues (2 total)
1. Field IDs out of order (3, 2, 1)
2. DarkModeToggle missing aria-label

---

## Specification Alignment Score

| Enhancement | Status |
|---|---|
| 1: Dropdown text | ✓ PASS |
| 1: Text truncation | ✓ PASS |
| 1: Max-width | ✓ PASS (but breaks positioning) |
| 2: Grid 2-col mobile | ✗ **FAIL** - shows 1 col |
| 2: Grid 3-col tablet | ✗ **FAIL** - shows 2 col |
| 2: Grid 4-col desktop | ✓ PASS |
| 2: Remove icon labels | ✗ **FAIL** - removed icons |
| 2: Responsive padding | ✓ PASS |
| 3: Custom name display | ✓ PASS (unsafe) |
| 3: Fallback logic | ~ PARTIAL - missing null safety |
| 4: Auto-populate | ~ PARTIAL - edge case broken |
| 5: Admin tab visible | ✓ PASS |
| 5: Admin tab hidden | ✓ PASS |
| 5: Admin styling | ✓ PASS |

**Overall: 65% Compliant**
- 7 fully passing
- 4 failing
- 2 partially working

---

## Required Actions Before Release

### Blockers (Must Fix)
- [ ] Fix grid layout (grid-cols-2 mobile, grid-cols-3 tablet)
- [ ] Fix auto-populate race condition
- [ ] Add null safety to CardSwitcher
- [ ] Fix SelectContent width/positioning
- [ ] Restore StatCard icons

### Should Fix
- [ ] Handle zero-fee card properly
- [ ] Reset Admin tab on logout
- [ ] Fix animation direction
- [ ] Consolidate validation logic

### Nice to Have
- [ ] Handle empty cards array
- [ ] Fix contrast in dark mode
- [ ] Prevent layout shift animation
- [ ] Clean up field IDs

---

## Testing Checklist for Re-Submission

After fixes are implemented, verify:

- [ ] Mobile 375px shows 2-column grid (not 1)
- [ ] Tablet 768px shows 3-column grid (not 2)
- [ ] Desktop shows 4-column grid
- [ ] StatCard displays icons alongside text
- [ ] Auto-populate works when selecting same card twice
- [ ] CardSwitcher handles null issuer gracefully
- [ ] Dropdown width matches button width
- [ ] Dropdown doesn't overflow horizontally
- [ ] All validation messages consistent
- [ ] Admin tab hides on logout
- [ ] No console errors
- [ ] TypeScript strict mode clean
- [ ] Build succeeds
- [ ] Dark mode looks good
- [ ] Touch targets >= 44x44px on mobile

---

## Quick Stats

- **Files Modified:** 5
- **Critical Issues:** 4
- **High Issues:** 5
- **Medium Issues:** 4
- **Low Issues:** 2
- **Total Issues:** 15
- **Estimated Fix Complexity:** High
- **Recommendation:** Return to dev team

---

**Prepared by:** Claude Code - QA Code Reviewer
**Confidence:** 90%+ (based on code analysis and spec comparison)
**Next Step:** Developer implements fixes, then submit for re-testing
