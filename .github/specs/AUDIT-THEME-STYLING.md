# AUDIT: Theme, Styling, Color Consistency & Error Message Display

**Date:** 2025-07-17
**Auditor:** QA Code Review Agent
**App:** Card Benefits Tracker (Next.js 15, Tailwind CSS 3.4, shadcn/ui)
**Scope:** Every page, component, error state, and styling pattern

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 4 | Unreadable error text, broken dark mode on major components |
| 🟠 High | 9 | Undefined CSS variables, hardcoded colors breaking themes |
| 🟡 Medium | 12 | Inconsistent spacing, typography, and visual patterns |
| 🟢 Low | 6 | Minor style unification opportunities |
| **Total** | **31** | |

**Verdict:** NOT ready for production. 4 critical issues make parts of the UI unreadable or broken in dark mode. The `bg-opacity-10` Tailwind bug silently fails for CSS variable backgrounds. Multiple components reference CSS variables (`--color-danger-*`, `--color-alert-*`, `--color-bg-primary`, `--color-bg-tertiary`, `--color-primary-500`) that are **never defined** in design-tokens.css.

---

## CRITICAL ISSUES (Must Fix Before Production)

### C1. `bg-opacity-10` DOES NOT WORK with CSS variable backgrounds — Error text invisible

**Files affected (8 components):**
- `src/components/FormError.tsx:22`
- `src/components/AddBenefitModal.tsx:229-230`
- `src/components/AddCardModal.tsx:267-268`
- `src/components/EditCardModal.tsx:206-207`
- `src/components/EditBenefitModal.tsx:247-248`
- `src/components/DeleteBenefitConfirmationDialog.tsx:114,119`
- `src/components/DeleteCardConfirmationDialog.tsx:116,121`
- `src/app/(dashboard)/settings/page.tsx:279-280`

**Root Cause:**
In Tailwind CSS 3.x, `bg-opacity-*` works by setting `--tw-bg-opacity` which is then used inside Tailwind's own `bg-*` color utilities (e.g., `bg-red-500`). However, when you use an arbitrary value like `bg-[var(--color-error)]`, Tailwind sets the background to the **raw CSS variable value** — `--tw-bg-opacity` is **completely ignored**.

So this class combination:
```
bg-[var(--color-error)] bg-opacity-10
```
renders as:
```css
background-color: var(--color-error);  /* = #ef4444 at full opacity */
--tw-bg-opacity: 0.1;                 /* UNUSED — no effect */
```

The background is **solid #ef4444** (red), and the text is `text-[var(--color-error)]` which is also **#ef4444**. This means **red text on a solid red background = completely unreadable**.

**What it looks like:** A solid red box with no visible text inside. The error message is there but impossible to read.

**Impact:** Users cannot read ANY form error messages in modals, delete confirmations, settings page, or anywhere FormError is used. This is the single worst user-facing bug in the app.

**How to fix:**
Replace `bg-[var(--color-error)] bg-opacity-10` with one of:
```tsx
// Option A: Use the -light token (recommended)
className="bg-[var(--color-error-light)] text-[var(--color-error)]"

// Option B: Inline style with opacity
style={{ backgroundColor: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}

// Option C: Tailwind arbitrary with alpha
className="bg-[var(--color-error)]/10 text-[var(--color-error)]"
// Note: / syntax requires Tailwind 3.1+ and the value must resolve at build time.
// Since CSS vars resolve at runtime, this may also fail — test carefully.

// Option D (safest): Use rgba directly
className="bg-[rgba(239,68,68,0.1)] text-[var(--color-error)]"
```

The same bug exists for success messages using `bg-[var(--color-success)] bg-opacity-10`.

**Priority:** 🔴 CRITICAL — error messages are the #1 user feedback mechanism

---

### C2. Undefined CSS Variables Referenced Throughout App

**Root Cause:** `design-tokens.css` defines only these color tokens:
```
--color-primary, --color-primary-light
--color-secondary, --color-secondary-light
--color-success, --color-success-light
--color-error, --color-error-light
--color-warning, --color-warning-light
--color-info, --color-info-light
--color-gray-{50,100,200,300,400,500,600,700,900}
--color-bg, --color-bg-secondary
--color-text, --color-text-secondary
--color-border
```

But components reference ALL of these **undefined** variables:

| Undefined Variable | Files Using It |
|---|---|
| `--color-danger-50` | BenefitTable.tsx:144, AlertSection.tsx:131 |
| `--color-danger-500` | BenefitTable.tsx:410, AlertSection.tsx:132,134, Card.tsx:109,162,170 |
| `--color-danger-600` | BenefitTable.tsx:97,114,373,409, AlertSection.tsx (implicit) |
| `--color-alert-50` | BenefitTable.tsx:149, AlertSection.tsx:139 |
| `--color-alert-500` | AlertSection.tsx:140,142 |
| `--color-alert-600` | BenefitTable.tsx:375, Card.tsx:222 |
| `--color-success-50` | BenefitTable.tsx:98, AlertSection.tsx:187 |
| `--color-success-500` | AlertSection.tsx:189, Card.tsx:108,161,168, SummaryStats.tsx:111 |
| `--color-success-600` | BenefitTable.tsx:97, AlertSection.tsx:188 |
| `--color-primary-500` | BenefitTable.tsx:233,336, Card.tsx:75, PlayerTabs.tsx:106,109,134,138, AlertSection.tsx:150 |
| `--color-bg-primary` | BenefitTable.tsx:132,136,152, Card.tsx:54, PlayerTabs.tsx:78 |
| `--color-bg-tertiary` | BenefitTable.tsx:106,122,208, AlertSection.tsx:147 |
| `--color-text-secondary` (in AlertSection) | AlertSection.tsx:148 — this one IS defined ✅ |

**What happens:** When a CSS variable is undefined, `var(--color-danger-50)` resolves to nothing (empty string), which means the `background-color` or `color` property gets no value and falls back to the inherited/default value. For background, this typically means transparent. For text color, it inherits from the parent.

**Impact:**
- **BenefitTable:** Row backgrounds for expiring/danger states are **transparent** instead of light red/orange — expiring benefits don't visually stand out
- **AlertSection:** Alert backgrounds, borders, and some text colors may be invisible or wrong
- **Card.tsx:** ROI trend indicators (up/down arrows) have no color
- **PlayerTabs.tsx:** Active tab indicator has no color
- **SummaryStats.tsx:** ROI color indicators are invisible

**How to fix:** Add the missing variables to `design-tokens.css` in both `:root` and dark mode blocks:

```css
/* Add to :root (light mode) */
--color-danger-50: #fef2f2;
--color-danger-500: #ef4444;
--color-danger-600: #dc2626;
--color-alert-50: #fff7ed;
--color-alert-500: #f97316;
--color-alert-600: #ea580c;
--color-success-50: #f0fdf4;
--color-success-500: #22c55e;
--color-success-600: #16a34a;
--color-primary-500: #3356D0;
--color-bg-primary: #ffffff;
--color-bg-tertiary: #f3f4f6;

/* Add to dark mode block */
--color-danger-50: #450a0a;
--color-danger-500: #f87171;
--color-danger-600: #fca5a5;
--color-alert-50: #431407;
--color-alert-500: #fb923c;
--color-alert-600: #fdba74;
--color-success-50: #052e16;
--color-success-500: #4ade80;
--color-success-600: #86efac;
--color-primary-500: #4F94FF;
--color-bg-primary: #0f172a;
--color-bg-tertiary: #1e293b;
```

**Priority:** 🔴 CRITICAL — dozens of UI elements silently render with no color

---

### C3. Login/Signup Error Message: White Text on Light Red Background

**Files:**
- `src/app/(auth)/login/page.tsx:145-152`
- `src/app/(auth)/signup/page.tsx` (same pattern)

**Code:**
```tsx
<div
  className="p-3 rounded-lg mb-6 text-sm text-white"
  style={{ backgroundColor: 'var(--color-error)' }}
>
  {message}
</div>
```

**Root Cause:** `--color-error` is `#ef4444` in light mode. White text (`#ffffff`) on `#ef4444` background gives a contrast ratio of **3.9:1** — fails WCAG AA (requires 4.5:1 for normal text).

In dark mode, `--color-error` changes to `#f87171` (even lighter red). White on `#f87171` is **2.5:1** — badly fails.

**What it looks like:** In light mode, barely readable white text on a medium-red box. In dark mode, white text on a pinkish-red background that's very hard to read.

**How to fix:**
```tsx
// Use dark text on light background (like other error patterns in the app)
<div
  className="p-3 rounded-lg mb-6 text-sm"
  style={{
    backgroundColor: 'var(--color-error-light)',
    color: 'var(--color-error)',
    border: '1px solid var(--color-error)',
  }}
>
  {message}
</div>
```

This matches the pattern already used in FormError, modal errors, and delete dialogs.

**Priority:** 🔴 CRITICAL — auth error messages are first thing users see when login fails

---

### C4. Error Boundary (error.tsx) Completely Ignores Theme System

**File:** `src/app/error.tsx:37-108`

**Root Cause:** The entire error page uses hardcoded Tailwind colors with zero CSS variable usage:
```tsx
<div className="bg-gradient-to-br from-slate-50 to-slate-100">     // ❌ Hardcoded
  <div className="bg-white rounded-lg shadow-xl">                   // ❌ Hardcoded
    <div className="bg-red-100">                                     // ❌ Hardcoded
      <svg className="text-red-600">                                 // ❌ Hardcoded
    <h1 className="text-gray-900">                                   // ❌ Hardcoded
    <p className="text-gray-600">                                    // ❌ Hardcoded
    <button className="bg-blue-600 text-white">                     // ❌ Not using Button component
    <a className="bg-gray-200 text-gray-900">                       // ❌ Not using Button component
```

**Impact:** In dark mode, this page renders with a white background, white card, and dark text — it completely breaks the dark theme. The "Try Again" button uses `bg-blue-600` which doesn't match the app's primary color (`--color-primary: #3356D0`).

**How to fix:** Rewrite using CSS variables and the Button component. Note: error.tsx wraps its own `<html><body>` which may not have the theme class, so CSS variables should be used with `prefers-color-scheme` fallback.

**Priority:** 🔴 CRITICAL — error page is jarring and broken in dark mode

---

## HIGH PRIORITY ISSUES (Should Fix)

### H1. CardTrackerPanel Uses Only Hardcoded Colors — No Dark Mode Support

**File:** `src/components/CardTrackerPanel.tsx`

**Lines and specific classes:**
| Line | Class | Issue |
|------|-------|-------|
| 88 | `hover:bg-gray-50` | Hardcoded — invisible hover in dark mode |
| 91 | `bg-white opacity-60` | White bg in dark mode |
| 99 | `bg-red-100` | Light red doesn't adapt to dark |
| 102 | `bg-orange-50` | Light orange doesn't adapt |
| 106 | `bg-white` | White bg in dark mode |
| 146 | `bg-green-100 text-green-800` | ROI badge hardcoded |
| 148 | `bg-red-100 text-red-800` | ROI badge hardcoded |
| 149 | `bg-gray-100 text-gray-700` | ROI badge hardcoded |
| 213 | `border-gray-200 bg-white` | Container hardcoded |
| 215 | `border-gray-100` | Section border hardcoded |
| 219 | `text-gray-900` | Heading color hardcoded |
| 222 | `text-gray-500` | Subtitle hardcoded |
| 245 | `bg-gray-50 text-gray-500` | Table header hardcoded |
| 258 | `divide-gray-100` | Row divider hardcoded |
| 360 | `bg-red-50 border-red-200 text-red-600` | Error hardcoded |
| 370 | `border-gray-100 text-gray-600` | Footer hardcoded |

**Impact:** CardTrackerPanel is one of the most important components (it's the main benefit tracking view), and it will look completely wrong in dark mode — white boxes on dark background, invisible text, wrong colors everywhere.

**How to fix:** Replace all hardcoded Tailwind colors with CSS variables:
- `bg-white` → `bg-[var(--color-bg)]`
- `text-gray-900` → `text-[var(--color-text)]`
- `text-gray-500` → `text-[var(--color-text-secondary)]`
- `border-gray-200` → `border-[var(--color-border)]`
- `bg-gray-50` → `bg-[var(--color-bg-secondary)]`
- `bg-red-100` → Use defined danger variable or inline dark: variant

**Priority:** 🟠 HIGH

---

### H2. card-calculations.ts Returns Hardcoded Tailwind Color Strings

**File:** `src/lib/card-calculations.ts:95-132`

**Code:**
```typescript
// getRenewalBadgeColor()
case 'DueNow':  return 'bg-red-100 text-red-800';
case 'DueSoon': return 'bg-yellow-100 text-yellow-800';
case 'Coming':  return 'bg-blue-100 text-blue-800';
case 'Safe':    return 'bg-green-100 text-green-800';
case 'Overdue': return 'bg-red-200 text-red-900';

// getStatusBadgeColor()
case 'ACTIVE':   return 'bg-green-100 text-green-800';
case 'PENDING':  return 'bg-blue-100 text-blue-800';
case 'PAUSED':   return 'bg-yellow-100 text-yellow-800';
case 'ARCHIVED': return 'bg-gray-100 text-gray-800';
case 'DELETED':  return 'bg-red-100 text-red-800';
```

**Root Cause:** These utility functions embed light-mode-only Tailwind classes. In dark mode, `bg-red-100` stays light red and `text-red-800` stays dark red — both designed for light backgrounds. No `dark:` variants.

**How to fix:** Either add `dark:` variants to each return value, or return semantic tokens/CSS variable references instead.

**Priority:** 🟠 HIGH — badges appear on every card view

---

### H3. Popover Component Uses Hardcoded Colors

**File:** `src/components/ui/popover.tsx:26`

**Code:**
```
border-gray-200 bg-white text-gray-950 ... dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50
```

**Root Cause:** Uses `gray-*` Tailwind colors with explicit `dark:` variants instead of CSS variables. This creates a separate color system from the rest of the app. `dark:bg-gray-950` is `#030712` which is much darker than the app's `--color-bg: #0f172a` in dark mode.

**Impact:** Popovers will appear noticeably darker than surrounding UI in dark mode, creating a visual mismatch.

**How to fix:** Replace with CSS variables:
```tsx
'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]'
```

**Priority:** 🟠 HIGH

---

### H4. Custom Values Components Use Separate Color System

**Files:**
- `src/components/custom-values/ValueHistoryPopover.tsx:20`
- `src/components/custom-values/EditableValueField.tsx:305`
- `src/components/card-management/CardFiltersPanel.tsx:63,68`
- `src/components/card-management/CardCompactView.tsx:63`
- `src/components/card-management/CardDetailPanel.tsx:20`
- `src/components/card-management/CardTile.tsx:88,237`
- `src/components/card-management/CardRow.tsx:73`
- `src/components/card-management/BulkActionBar.tsx:19`

**Pattern:** These all use `dark:bg-gray-900`, `dark:bg-gray-800`, `dark:border-gray-700` etc — explicit Tailwind dark variants. The rest of the app uses CSS variables that auto-switch.

**Root Cause:** Two different developers/approaches created two parallel color systems:
1. **CSS Variable approach** (auth pages, modals, dashboard pages): `bg-[var(--color-bg)]`
2. **Tailwind dark variant approach** (card-management, custom-values): `bg-white dark:bg-gray-900`

These produce different dark mode values:
- CSS var: `--color-bg` → `#0f172a` (slate-900)
- Tailwind: `dark:bg-gray-900` → `#111827` (gray-900)

**Impact:** Subtle but noticeable color mismatch between different sections of the app in dark mode.

**How to fix:** Migrate all `bg-white dark:bg-gray-*` patterns to use CSS variables consistently.

**Priority:** 🟠 HIGH

---

### H5. Button Primary Gradient Hardcodes Dark Color

**File:** `src/components/ui/button.tsx:54`

**Code:**
```tsx
primary: `bg-gradient-to-br from-[var(--color-primary)] to-[#2844a0] text-white shadow-md`
```

**Root Cause:** The gradient end color `#2844a0` is hardcoded. In dark mode, `--color-primary` changes to `#4F94FF` but the gradient still goes to `#2844a0` (a very dark blue). This creates a gradient from bright blue to dark blue that looks wrong in dark mode.

**How to fix:** Define a `--color-primary-dark` token for the gradient end point that switches in dark mode.

**Priority:** 🟠 HIGH — buttons appear on every page

---

### H6. Dashboard Page Has Hardcoded rgba Error Background

**File:** `src/app/(dashboard)/page.tsx:474`

**Code:**
```tsx
backgroundColor: 'rgba(255, 59, 48, 0.1)',
```

**Root Cause:** Uses Apple's system red (`rgb(255,59,48)`) at 10% opacity instead of the design system's error color. Every other component uses `var(--color-error)`.

**How to fix:** Replace with `var(--color-error-light)` or appropriate token.

**Priority:** 🟠 HIGH

---

### H7. Settings Page Has Hardcoded rgba Delete Zone Background

**File:** `src/app/(dashboard)/settings/page.tsx:555`

**Code:**
```tsx
backgroundColor: 'rgba(239, 68, 68, 0.05)',
```

Same pattern as H6 — using raw rgba instead of design tokens.

**Priority:** 🟠 HIGH

---

### H8. AlertSection Uses Hardcoded Hex Text Colors

**File:** `src/components/AlertSection.tsx:133,141`

**Code:**
```tsx
text: '#7F1D1D',  // Critical alert text
text: '#78350F',  // Warning alert text
```

**Root Cause:** These hex colors are Tailwind's `red-900` and `amber-900` hardcoded. They don't adapt to dark mode.

**Impact:** In dark mode, very dark text on a potentially dark background = unreadable.

**How to fix:** Use CSS variables: `var(--color-danger-600)` and `var(--color-alert-600)` (after defining them per C2).

**Priority:** 🟠 HIGH

---

### H9. Toast Notifications Use Hardcoded Tailwind Colors

**File:** `src/components/ui/use-toast.tsx:108-137`

**Code:**
```tsx
toast.variant === 'success' ? 'bg-green-500'
  : toast.variant === 'error' ? 'bg-red-500'
  : 'bg-blue-500'
```

**Root Cause:** Toast backgrounds use `bg-green-500` (#22c55e), `bg-red-500` (#ef4444), `bg-blue-500` (#3b82f6) instead of `var(--color-success)`, `var(--color-error)`, `var(--color-info)`.

**Impact:** Toast colors don't match the rest of the app's semantic colors. Green-500 ≠ `--color-success` (#0a7d57). Blue-500 ≠ `--color-primary` (#3356D0).

**How to fix:**
```tsx
toast.variant === 'success'
  ? 'bg-[var(--color-success)]'
  : toast.variant === 'error'
    ? 'bg-[var(--color-error)]'
    : 'bg-[var(--color-primary)]'
```

**Priority:** 🟠 HIGH

---

## MEDIUM PRIORITY ISSUES

### M1. Three Different Error Display Patterns Used Across App

The app uses 3 distinct visual patterns for error messages, making the UI feel inconsistent:

| Pattern | Used In | Background | Text | Border |
|---------|---------|-----------|------|--------|
| A. CSS var + bg-opacity (broken) | FormError, Modals, Delete dialogs, Settings | `bg-[var(--color-error)] bg-opacity-10` | `text-[var(--color-error)]` | None or var-based |
| B. White on solid color | Login, Signup | `var(--color-error)` solid | `text-white` | None |
| C. Tailwind color classes | CardTrackerPanel, Settings (alt) | `bg-red-50` / `bg-red-100` | `text-red-600` / `text-red-700` | `border-red-200` / `border-red-300` |

**How to fix:** Consolidate all error display to a single pattern using `FormError` or a standardized alert component.

**Priority:** 🟡 MEDIUM

---

### M2. Mixed Border Radius System

| Radius | Used In |
|--------|---------|
| `rounded-2xl` | Modal.tsx:72 |
| `rounded-xl` | CardTrackerPanel.tsx:213 |
| `rounded-lg` | Most cards, inputs, error boxes |
| `rounded-md` | Delete dialogs, popovers, some badges |
| `rounded-full` | ROI badges, toggle buttons |

The design tokens define `--radius-sm` (4px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-xl` (16px) but these aren't used — components use Tailwind's `rounded-*` classes directly.

**Impact:** Visual inconsistency — modals use 16px radius, cards use 12px, error boxes use 8px with no clear hierarchy.

**How to fix:** Standardize: containers → `rounded-xl`, cards → `rounded-lg`, inputs/badges → `rounded-md`.

**Priority:** 🟡 MEDIUM

---

### M3. Mixed Spacing Systems

Components inconsistently use two spacing approaches:

| System | Example | Files |
|--------|---------|-------|
| CSS Variable | `p-lg`, `gap-md`, `p-md`, `mt-md` | Card.tsx, SummaryStats.tsx, BenefitTable.tsx |
| Tailwind | `p-4`, `gap-4`, `p-3`, `mt-4` | BenefitsGrid.tsx, BenefitsList.tsx, all modals |

`p-lg` resolves to `var(--space-lg)` = 24px. `p-6` = 24px. They're the same value but expressed differently, making the codebase confusing to maintain.

**How to fix:** Pick one system. Since Tailwind classes are more widely used and easier to read, migrate CSS variable spacing to Tailwind equivalents:
- `p-lg` → `p-6`
- `p-md` → `p-4`
- `p-sm` → `p-2`
- `gap-md` → `gap-4`
- `gap-lg` → `gap-6`

**Priority:** 🟡 MEDIUM

---

### M4. Mixed Typography Approaches

| Approach | Example | Files |
|----------|---------|-------|
| CSS Variable | `fontSize: 'var(--text-h3)'` (inline style) | Card.tsx, dashboard pages |
| Tailwind | `text-2xl`, `text-lg`, `text-sm` | Modals, most components |
| Hardcoded | `fontSize: '12px'` (inline style) | SummaryStats.tsx |

The design system defines `text-h1` through `text-h6` in globals.css but they're rarely used. Most components use Tailwind's text-* scale.

**How to fix:** Use Tailwind classes exclusively. Map: h1→`text-4xl`, h2→`text-3xl`, h3→`text-2xl`, h4→`text-xl`.

**Priority:** 🟡 MEDIUM

---

### M5. Shadow Inconsistency Across Cards

| Element | Shadow | File |
|---------|--------|------|
| CardTrackerPanel | `shadow-sm` | CardTrackerPanel.tsx:213 |
| Modal | `shadow-xl` | Modal.tsx:72 |
| SummaryStats cards | `shadow-md` (inline) + hover:`shadow-lg` | SummaryStats.tsx:120 |
| StatCard | `shadow-sm` + hover:`shadow-md` | StatCard.tsx:36 |
| ValueHistoryPopover | `shadow-lg` | ValueHistoryPopover.tsx:20 |
| EditableValueField dialog | `shadow-lg` | EditableValueField.tsx:305 |
| Toast | `shadow-lg` | use-toast.tsx:124 |

No consistent elevation hierarchy. The design tokens define `--shadow-xs` through `--shadow-xl` but Tailwind's shadow-* classes are used instead.

**How to fix:** Define elevation levels: Level 0 (cards) = `shadow-sm`, Level 1 (hover) = `shadow-md`, Level 2 (popovers/dropdowns) = `shadow-lg`, Level 3 (modals) = `shadow-xl`.

**Priority:** 🟡 MEDIUM

---

### M6. Inconsistent Card Container Borders

| Element | Border Style | File |
|---------|-------------|------|
| CardTrackerPanel | `border border-gray-200` | CardTrackerPanel.tsx:213 |
| Card.tsx | `border-[var(--color-border)]` | Card.tsx:52 |
| BenefitsGrid items | `border` (default) | BenefitsGrid.tsx:151 |
| CardTile | `border-2` | CardTile.tsx:87 |
| CardFiltersPanel | `border border-gray-200 dark:border-gray-700` | CardFiltersPanel.tsx:63 |
| Delete dialog warnings | `border border-[var(--color-error)] border-opacity-20` | Various |

Three different border systems: CSS variable, hardcoded Tailwind, and `border-2` (thicker border on tiles).

**How to fix:** Standardize all card borders to `border border-[var(--color-border)]`.

**Priority:** 🟡 MEDIUM

---

### M7. Header Not Responsive on Very Small Screens

**Files:** All page layouts (login, signup, dashboard, settings, card detail)

**Pattern:**
```tsx
<div className="max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between">
  <Link>CardTrack Logo</Link>
  <SafeDarkModeToggle />
</div>
```

The header uses `justify-between` with no `flex-wrap`. On screens < 320px, the logo and toggle button could overflow.

**How to fix:** Add `flex-wrap gap-2` and ensure min-width constraints.

**Priority:** 🟡 MEDIUM

---

### M8. Table Overflow Without Visual Indicator

**File:** `src/components/CardTrackerPanel.tsx:242`

```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
```

`tableLayout: 'fixed'` with `min-w-[150px]` columns means on mobile the table WILL overflow. `overflow-x-auto` enables scrolling but there's no visual indicator (gradient fade, scroll bar styling, or "scroll right" hint).

**Priority:** 🟡 MEDIUM

---

### M9. SummaryStats Inline Shadow Conflicts with Class Shadow

**File:** `src/components/SummaryStats.tsx:120` (approximate)

Uses both inline `boxShadow: 'var(--shadow-md)'` AND Tailwind class `shadow-lg` on the same element. The Tailwind class wins (later in cascade), making the inline style dead code.

**Priority:** 🟡 MEDIUM

---

### M10. Inconsistent Loading/Disabled State Styling

**Button component (button.tsx:48):**
```tsx
disabled || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
```

**Input component (Input.tsx):** Uses `disabled:opacity-50 disabled:cursor-not-allowed` (Tailwind modifier).

Both use `opacity-50` which is consistent, but there's no shared constant or token. If someone changes the button to `opacity-40`, inputs would still be at `opacity-50`.

**Priority:** 🟡 MEDIUM

---

### M11. Dark Mode Uses `prefers-color-scheme` But App Uses Class-Based Toggle

**File:** `src/styles/design-tokens.css:155`

```css
@media (prefers-color-scheme: dark) {
  :root { ... }
}
```

**File:** `src/components/providers/ThemeProvider.tsx`

The ThemeProvider sets `document.documentElement.style.colorScheme = 'dark'` and presumably a class. But design-tokens.css uses `@media (prefers-color-scheme: dark)` which responds to the **OS setting**, not the class toggle.

**Impact:** If a user's OS is set to light mode but they toggle dark mode in the app, the CSS variables may NOT switch because the media query still evaluates as `light`. This depends on whether `style.colorScheme` affects media queries (it does in some browsers but not all reliably).

**How to fix:** Add a `.dark` class-based selector in design-tokens.css alongside the media query:
```css
@media (prefers-color-scheme: dark) {
  :root { ... dark vars ... }
}
.dark {
  ... same dark vars ...
}
```

**Priority:** 🟡 MEDIUM — affects users who manually toggle theme

---

### M12. Modal Content Padding is Very Large on Mobile

**File:** `src/components/ui/Modal.tsx:81,108`

```tsx
<div className="p-8">  {/* Header padding */}
<div className="p-8">  {/* Content padding */}
```

`p-8` = 32px padding on all sides. On a 375px mobile screen, that's 64px of horizontal padding, leaving only 311px for content (minus border, modal margin). With `max-w-lg` (512px), the modal is already constrained, but `p-8` is excessive on mobile.

**How to fix:** `p-4 md:p-8` for responsive padding.

**Priority:** 🟡 MEDIUM

---

## LOW PRIORITY ISSUES

### L1. Font Families Not Loaded

**File:** `design-tokens.css:57-59`

Defines `--font-heading: 'Plus Jakarta Sans'` and `--font-mono: 'JetBrains Mono'` but these fonts aren't loaded via `@font-face` or Google Fonts import in any CSS file or the root layout. They'll fall back to system fonts.

**Priority:** 🟢 LOW

---

### L2. Inconsistent Icon Button Sizing

Icon buttons in CardRow use `h-8 w-8 p-0` overriding the Button component's size, while other icon buttons use the `icon-sm` or `icon` size prop.

**Files:** `CardRow.tsx:164-166`, various other components.

**Priority:** 🟢 LOW

---

### L3. Duplicate Dark Mode Toggle in Settings

Settings page has a toggle in the header AND in the Preferences tab. Users see two toggles for the same function.

**Files:** `settings/page.tsx` header area + preferences section

**Priority:** 🟢 LOW

---

### L4. StatCard Uses Inline fontFamily Instead of Tailwind Class

**File:** `src/components/ui/StatCard.tsx:63` (approximate)

```tsx
style={{ fontFamily: 'var(--font-mono)' }}
```

Should use `className="font-mono"` (which maps to the same variable via tailwind.config.js).

**Priority:** 🟢 LOW

---

### L5. Accessibility: Focus Ring in design-tokens.css Uses `button:focus` Instead of `:focus-visible`

**File:** `src/styles/design-tokens.css:276-286`

```css
button:focus,
input:focus,
a:focus { ... }
```

Using `:focus` instead of `:focus-visible` means focus rings appear on mouse clicks too, which is a UX issue. The file does have `:focus-visible` elsewhere (line 264) but the second block overrides with `:focus`.

**Priority:** 🟢 LOW

---

### L6. `border-opacity-20` Has Same Bug as `bg-opacity-10` on CSS Variables

**File:** `DeleteBenefitConfirmationDialog.tsx:114`, `DeleteCardConfirmationDialog.tsx:116`

```tsx
border border-[var(--color-error)] border-opacity-20
```

Same Tailwind v3 issue as C1: `border-opacity-20` doesn't work with arbitrary CSS variable values. The border will be full-opacity `var(--color-error)` instead of 20% opacity.

**Priority:** 🟢 LOW — full opacity border is still readable, just thicker-looking than intended

---

## Specification Alignment Analysis

### Design Token Coverage

| Token Category | Defined | Actually Used in Components |
|---|---|---|
| Primary colors (2) | ✅ | ✅ via CSS vars |
| Semantic status colors (10) | ✅ | ⚠️ Mixed — some CSS vars, some Tailwind |
| Grays (9) | ✅ | ❌ Most components use Tailwind gray-* directly |
| Background semantics (2) | ✅ | ⚠️ Used in pages, ignored in card-management/ |
| Typography sizes (14) | ✅ | ❌ Rarely used — Tailwind text-* preferred |
| Spacing (8) | ✅ | ⚠️ Partially used, mixed with Tailwind |
| Radius (5) | ✅ | ❌ Not used — Tailwind rounded-* used |
| Shadows (5+5 dark) | ✅ | ❌ Not used — Tailwind shadow-* used |
| **Missing tokens (12+)** | ❌ | ⚠️ Referenced but undefined (see C2) |

### Architecture Inconsistency

The app has two competing styling philosophies:

1. **Phase 1 components** (Card.tsx, SummaryStats, BenefitTable, AlertSection): Use CSS custom property inline styles heavily
2. **Phase 2 components** (card-management/*, custom-values/*): Use Tailwind classes with explicit `dark:` variants
3. **Auth/Dashboard pages**: Use CSS variable inline styles
4. **UI primitives** (popover, dialog): Use Tailwind with `dark:` variants (shadcn pattern)

This creates a maintenance nightmare where changing a color requires updates in 3-4 different places depending on which system a component uses.

---

## Test Coverage Recommendations

### Priority 1: Error Visibility Tests
1. Test FormError renders with visible text (contrast ratio > 4.5:1)
2. Test login/signup error messages are readable
3. Test modal error messages have different text/bg colors
4. Test toast notifications in all variants

### Priority 2: Dark Mode Consistency Tests
1. Test all components render correctly when `prefers-color-scheme: dark`
2. Test theme toggle switches all components (not just CSS-var-based ones)
3. Test CardTrackerPanel in dark mode
4. Test error.tsx in dark mode

### Priority 3: CSS Variable Resolution Tests
1. Test that all `var(--color-danger-*)` variables resolve to actual values
2. Test that all `var(--color-alert-*)` variables resolve
3. Test that `var(--color-bg-primary)` and `var(--color-bg-tertiary)` resolve

---

## Summary: Fix Priority Order

1. **C1** — Fix `bg-opacity-10` on CSS variable backgrounds (8 files) → Makes error messages readable
2. **C2** — Add missing CSS variables to design-tokens.css → Makes dozens of UI elements visible
3. **C3** — Fix login/signup error contrast → Makes auth error messages readable
4. **C4** — Fix error.tsx to use theme system → Makes error page work in dark mode
5. **H1** — Migrate CardTrackerPanel to CSS variables → Main feature works in dark mode
6. **H2** — Fix card-calculations.ts badge colors → Badges work in dark mode
7. **H4** — Migrate card-management components → Consistent dark mode
8. **H5** — Fix button gradient hardcoded color → Buttons look right in dark mode
9. **M11** — Add class-based dark mode selector → Theme toggle works reliably
10. **Everything else** — Incremental consistency improvements
