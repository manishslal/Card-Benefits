# Period-Based Benefit Enhancement — QA Report

**Date:** 2025-07-24
**Reviewer:** QA Code Review Agent
**Scope:** Period-based UI enhancements to BenefitsGrid + dashboard data flow
**Files Reviewed:**
- `src/features/benefits/components/grids/BenefitsGrid.tsx`
- `src/app/dashboard/page.tsx`
- `src/lib/format-period-range.ts` (dependency)
- `src/styles/design-tokens.css` (CSS variables)
- `src/app/api/cards/my-cards/route.ts` (API data source)
- `src/app/api/benefits/[id]/toggle-used/route.ts` (mark-used endpoint)
- `src/shared/components/ui/button.tsx` (Button component API)

**Overall Assessment:** ✅ PASS (with 1 fix applied)

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| HIGH     | 1 | ✅ FIXED |
| MEDIUM   | 3 | Documented |
| LOW      | 3 | Documented |

The period-based benefit enhancement is well-implemented. TypeScript compilation
passes cleanly for both target files. The production build succeeds. Data flows
correctly from API → dashboard → BenefitsGrid. One HIGH-severity stale closure
bug was found and fixed in `handleMarkUsed`.

---

## Build Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` (target files) | ✅ 0 errors |
| `npm run build` (production) | ✅ Succeeds |
| Dashboard page output size | 8.97 kB (190 kB First Load JS) |

---

## Issues Found

### HIGH-1: Stale Closure in `handleMarkUsed` — ✅ FIXED

**File:** `src/app/dashboard/page.tsx`, lines 716–776
**Severity:** HIGH
**Impact:** When a user rapidly clicks "Mark Used" on two different benefits, the
second `setBenefits` call overwrites the first because both closures reference the
same stale `benefits` array from the render cycle when `handleMarkUsed` was defined.

**Root Cause:** All 4 `setBenefits()` calls inside `handleMarkUsed` used
`benefits.map(...)` — referencing the outer-scope `benefits` captured at function
definition time — instead of the functional updater form `prev => prev.map(...)`.

**Before (stale closure):**
```tsx
setBenefits(
  benefits.map((b) =>
    b.id === benefitId ? { ...b, isUsed: true } : b
  )
);
```

**After (functional updater — safe):**
```tsx
setBenefits(prev =>
  prev.map((b) =>
    b.id === benefitId ? { ...b, isUsed: true } : b
  )
);
```

**Fix Applied:** All 4 occurrences updated to use functional updater:
1. Line 717 — optimistic update (`isUsed: true`)
2. Line 735 — HTTP error revert (`isUsed: false`)
3. Line 753 — success update (`isUsed: data.benefit.isUsed`)
4. Line 770 — catch revert (`isUsed: false`)

**Verification:** TypeScript compilation passes. Production build succeeds.

---

### MEDIUM-1: `color-mix()` CSS Unsupported in Some Browserslist Targets

**File:** `src/features/benefits/components/grids/BenefitsGrid.tsx`, lines 68, 74
**Severity:** MEDIUM
**Impact:** The `getLeftBorderColor()` function uses `color-mix(in srgb, ...)` for
the `isUsed` and `EXPIRED` states. The project's browserslist includes `op_mini all`
and `kaios 2.5`, neither of which supports `color-mix()`.

**Affected Code:**
```tsx
// isUsed state (line 68)
return 'color-mix(in srgb, var(--color-text-secondary) 30%, transparent)';

// EXPIRED state (line 74)
return 'color-mix(in srgb, var(--color-text-secondary) 40%, transparent)';
```

**Practical Impact:** Low in practice — Opera Mini is a proxy browser with minimal
CSS support, and KaiOS 2.5 is a feature phone OS. All mainstream browsers (Chrome
109+, Safari 16.2+, Firefox 111+) support `color-mix()`. The targeted `ios_saf 18.5+`
and `safari 18.5+` fully support it.

**Recommendation:** If KaiOS/Opera Mini support is truly required, replace with
pre-computed `rgba()` values:
```tsx
// Instead of color-mix
return 'rgba(107, 114, 128, 0.3)'; // --color-text-secondary at 30%
```

---

### MEDIUM-2: No UI Path to Un-Mark a Used Benefit

**File:** `src/features/benefits/components/grids/BenefitsGrid.tsx`, lines 457–474
**Severity:** MEDIUM
**Impact:** Once a benefit is marked as used, the button becomes a permanently
disabled "Used" state. The API (`/api/benefits/[id]/toggle-used`) supports
toggling back (`isUsed: false`), but the UI provides no way to do this.

**Affected Code:**
```tsx
<Button variant="secondary" size="xs" disabled aria-disabled="true" ...>
  Used
</Button>
```

**User Scenario:** If a user accidentally marks a benefit as used, they cannot undo
it through the dashboard. They would need to use browser dev tools or an admin panel.

**Recommendation:** Either:
- Add a "Mark Unused" button (or make the "Used" button clickable to toggle), or
- Add a confirmation dialog before marking as used, or
- Document that this is intentional one-way behavior.

---

### MEDIUM-3: Non-Null Assertions on `periodStart`

**File:** `src/features/benefits/components/grids/BenefitsGrid.tsx`, lines 325, 335
**Severity:** MEDIUM (code smell — runtime-safe)
**Impact:** The code uses `benefit.periodStart!` (non-null assertion) inside the
period banner JSX. While this is guarded by `hasPeriodData && bannerStyles` which
ensures `periodStart` is truthy, the `!` assertion hides this from the type system.

**Affected Code:**
```tsx
aria-label={`Benefit period: ${formatPeriodRange(
  benefit.periodStart!,  // <-- assertion
  benefit.periodEnd
)}`}
```

**Recommendation:** Replace with a local variable to avoid the assertion:
```tsx
const periodStart = benefit.periodStart!; // or use a type guard
```

---

### LOW-1: `alert()` Used for User Feedback in `handleMarkUsed`

**File:** `src/app/dashboard/page.tsx`, lines 745, 765, 777
**Severity:** LOW
**Impact:** Uses browser `alert()` for success/error messages. This blocks the
UI thread and provides a poor user experience. The rest of the app likely uses
toast notifications.

**Lines:**
- `alert(`Error: ${errorData.error || ...}`)` — line 745
- `alert('Benefit marked as used!')` — line 765
- `alert('Failed to mark benefit as used. Please try again.')` — line 777

**Recommendation:** Replace with a toast/notification component consistent with
the rest of the design system.

---

### LOW-2: `ANNUAL` Cadence Shows No Progress Indicator

**File:** `src/features/benefits/components/grids/BenefitsGrid.tsx`, line 152
**Severity:** LOW
**Impact:** `getPeriodProgress()` returns `''` for `ANNUAL` cadence. This means
annual benefits show no "Period X of Y" indicator. This is likely intentional
("Period 1 of 1" is redundant), but could confuse users who expect to see it.

**Affected Code:**
```tsx
switch (cadence) {
  case 'MONTHLY':  return `Period ${month} of 12`;
  case 'QUARTERLY': ...
  case 'SEMI_ANNUAL': ...
  default: return '';  // ANNUAL and ONE_TIME fall through here
}
```

---

### LOW-3: Accessibility — `role="status"` on Period Banner

**File:** `src/features/benefits/components/grids/BenefitsGrid.tsx`, line 321
**Severity:** LOW
**Impact:** The period banner has `role="status"` which creates an ARIA live region.
Since all benefit cards render their banners simultaneously on page load, screen
readers may announce all period banners — creating a noisy experience.

**Recommendation:** Consider using `role="note"` instead, or remove the role
and rely on the `aria-label` attribute alone.

---

## Logic Review

### `getCadenceLabel()` — ✅ Correct
Handles all known cadences: MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, ONE_TIME.
Returns `''` for unknown/empty values. Uses `claimingCadence` over `resetCadence`
(correct priority).

### `getLeftBorderColor()` — ✅ Correct Priority
Priority chain: `isUsed` → `periodStatus` → default. This ensures used benefits
always show the muted border regardless of period status.

### `getPeriodBannerStyles()` — ✅ Correct
All CSS variables (`--color-success-light`, `--color-success-dark`, `--color-info-light`,
`--color-info`, `--color-bg-secondary`, `--color-text-secondary`) are verified present
in `design-tokens.css` for both light and dark modes.

### `getPeriodProgress()` — ✅ Correct
- MONTHLY: `Period ${1..12} of 12` — correct
- QUARTERLY: `Q${1..4} of 4` — correct (uses `Math.ceil(month / 3)`)
- SEMI_ANNUAL: `H${1|2} of 2` — correct (uses `month <= 6 ? 1 : 2`)
- ANNUAL/ONE_TIME/unknown: returns `''` — correct (no progress for single-period)
- Uses `getUTCMonth()` — correct (avoids timezone shift)

### Used Benefits Sorting — ✅ Correct
`useMemo` sorts with stable comparison: used→bottom, unused→top. Original order
preserved within each group (stable sort via `return 0`).

### Legacy Benefits (no period data) — ✅ Correct
- `hasPeriodData = Boolean(benefit.periodStart)` → `false` when `null/undefined`
- No period banner rendered (guarded by `hasPeriodData && bannerStyles`)
- Default border: `var(--color-border)` (from `getLeftBorderColor` default case)
- Generic button: `'Mark Used'` (from `periodMonth ? ... : 'Mark Used'`)

---

## Data Flow Review

### API → Dashboard → Grid: ✅ Complete Chain

```
API /api/cards/my-cards
  └─ Prisma selects: resetCadence, isUsed, periodStart, periodEnd,
     periodStatus, masterBenefitId, masterBenefit.claimingCadence
  └─ Maps to BenefitDisplay type (claimingCadence from nested join)
     ↓
Dashboard page.tsx
  └─ Stores in BenefitData state (all period fields present)
  └─ transformBenefitForGrid() passes all fields to grid
     ↓
BenefitsGrid.tsx
  └─ Benefit interface accepts all period fields as optional
  └─ Helper functions consume them for banner/stripe/progress/button
```

**Verified:**
- `claimingCadence` correctly sourced from `masterBenefit.claimingCadence` (JOIN)
- API conditionally spreads period fields (only when non-null)
- Dashboard uses `?? null` / `?? false` defaults for safety
- Grid interface marks all period fields as optional — safe for legacy data

### Mark-Used Flow: ✅ Correct

```
BenefitsGrid: onMarkUsed(benefit.id)
  → dashboard: handleMarkUsed(benefitId)
  → optimistic: setBenefits(prev => prev.map(...isUsed: true))
  → API: PATCH /api/benefits/[id]/toggle-used { isUsed: true }
  → success: update from response data
  → error: revert to isUsed: false
```

API guards: ✓ Auth, ✓ Ownership, ✓ Deleted card, ✓ Period status (EXPIRED/UPCOMING blocked)

---

## CSS Variable Audit

| Variable Used | Defined in Light | Defined in Dark |
|---------------|:---:|:---:|
| `--color-success` | ✅ | ✅ |
| `--color-success-light` | ✅ | ✅ |
| `--color-success-dark` | ✅ | ✅ |
| `--color-info` | ✅ | ✅ |
| `--color-info-light` | ✅ | ✅ |
| `--color-bg-secondary` | ✅ | ✅ |
| `--color-text-secondary` | ✅ | ✅ |
| `--color-border` | ✅ | ✅ |
| `--color-text` | ✅ | ✅ |
| `--color-primary` | ✅ | ✅ |
| `--color-error` | ✅ | ✅ |
| `--color-warning` | ✅ | ✅ |
| `--text-body-sm` | ✅ | ✅ |

All CSS variables used by the new code are defined in both light and dark modes. ✅

---

## Edge Case Verification

| Scenario | Expected Behavior | Verified |
|----------|-------------------|:---:|
| Benefit with NO period data (periodStart=null) | No banner, `var(--color-border)` left border, "Mark Used" generic button | ✅ |
| Benefit with isUsed=true AND periodStatus='ACTIVE' | Used state wins: muted border, disabled "Used" button, dimmed background | ✅ |
| ONE_TIME cadence | No progress indicator (getPeriodProgress returns '') | ✅ |
| Empty benefits array | Shows `emptyMessage` ("No benefits found") in centered panel | ✅ |
| Unknown cadence string (e.g., 'BIWEEKLY') | getCadenceLabel returns '', getPeriodProgress returns '' | ✅ |
| Cross-year period (Jan 2026 – Jun 2027) | formatPeriodRange includes both years | ✅ |
| periodEnd=null (ONE_TIME) | formatPeriodRange returns "From Apr 1" | ✅ |

---

## Accessibility Review

| Feature | Status |
|---------|--------|
| `aria-label` on Mark Used button (includes benefit name + month) | ✅ |
| `aria-label` on Used disabled button | ✅ |
| `aria-hidden="true"` on decorative icons | ✅ |
| `aria-disabled="true"` on disabled Used button | ✅ |
| `prefers-reduced-motion` support | ✅ |
| `role="status"` on period banner | ⚠️ See LOW-3 |

---

## Fixes Applied Summary

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| HIGH-1 | Stale closure in `handleMarkUsed` | HIGH | Changed 4 `setBenefits(benefits.map(...))` calls to `setBenefits(prev => prev.map(...))` |

---

## Recommendation

**Ship with confidence.** The enhancement is well-structured with proper null guards,
type safety, accessibility attributes, and correct business logic. The one HIGH-severity
stale closure bug has been fixed. The MEDIUM items are worth tracking but are not
blockers for production deployment.
