# Dashboard Styling Alignment Specification

**Status**: Production Fix (Blocking Issue)  
**Priority**: 🔴 CRITICAL  
**Created**: April 6, 2025  
**Updated**: April 6, 2025

---

## Executive Summary

The new dashboard (`/dashboard/new`) implemented in Phase 6C has **visual inconsistencies** with the original dashboard. All components are using a mix of hardcoded Tailwind colors and CSS variables, causing:

- ❌ Inconsistent visual appearance
- ❌ Poor dark mode support
- ❌ Maintenance burden (changes require multiple locations)
- ❌ Accessibility gaps (contrast, focus states)

**Solution**: Standardize all styling to use CSS design tokens defined in `src/styles/design-tokens.css`.

---

## 📊 Issues Identified

| Severity | Component | Issue | Solution |
|----------|-----------|-------|----------|
| 🔴 HIGH | DashboardButton | Hardcoded `bg-blue-600` | Use `--color-primary` |
| 🔴 HIGH | BenefitRow | `bg-white dark:bg-gray-800` redundant | Remove Tailwind, use `--color-bg` |
| 🔴 HIGH | BenefitGroup | `border-green-200 dark:border-green-900` | Map to CSS tokens |
| 🟡 MEDIUM | StatusFilters | `text-gray-600` hardcoded | Use `--color-text-secondary` |
| 🟡 MEDIUM | PeriodSelector | Focus ring incomplete, spacing hardcoded | Complete with tokens |
| 🟡 MEDIUM | SummaryBox | `p-6` hardcoded padding | Use `--space-lg` |

---

## 🎨 Design System (Reference)

All required tokens are already defined in `src/styles/design-tokens.css`:

### Color Tokens (Light/Dark Mode)

```css
/* Semantic Colors */
--color-primary: #3356D0;              /* Primary actions, focus states */
--color-secondary: #f59e0b;            /* Accent, highlights */
--color-success: #0a7d57;              /* Success states */
--color-error: #ef4444;                /* Errors, destructive actions */
--color-warning: #d97706;              /* Warnings, expiring alerts */

/* Surface & Text */
--color-bg: #ffffff;                   /* Primary background */
--color-text: #111827;                 /* Primary text */
--color-text-secondary: #6b7280;       /* Secondary text, labels */
--color-border: #e5e7eb;               /* Borders, dividers */

/* Dark Mode (auto-switched via @media prefers-color-scheme: dark) */
--color-bg: #111827;                   /* Dark background */
--color-text: #f9fafb;                 /* Light text */
--color-border: #374151;               /* Dark borders */
```

### Spacing Tokens (8px Grid System)

```css
--space-xs: 4px;                       /* 0.25rem - Use for small gaps */
--space-sm: 8px;                       /* 0.5rem - Use for standard gaps */
--space-md: 16px;                      /* 1rem - Use for padding (p-4) */
--space-lg: 24px;                      /* 1.5rem - Use for padding (p-6) */
--space-xl: 32px;                      /* 2rem - Use for section gaps */
```

### Shadow Tokens

```css
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.08);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
```

### Border Radius

```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
```

---

## 🔧 Implementation Roadmap

### Phase 1: Color Variable Migration (HIGH PRIORITY)

**Objective**: Replace all hardcoded Tailwind colors with CSS variables

#### Task 1.1: DashboardButton.tsx

**Current Issues**:
- Uses `bg-blue-600 hover:bg-blue-700 text-white`
- No dark mode fallback
- Not using design tokens

**Fix**:
```tsx
// BEFORE:
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2">

// AFTER:
<button style={{
  backgroundColor: variant === 'primary' ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
  color: variant === 'primary' ? 'white' : 'var(--color-text)',
  padding: `var(--space-sm) var(--space-md)`,
}}>
```

#### Task 1.2: BenefitRow.tsx

**Current Issues**:
- Redundant `bg-white dark:bg-gray-800`
- `border border-gray-200 dark:border-gray-700` hardcoded
- Mixed Tailwind + CSS vars

**Fix**:
```tsx
// BEFORE:
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">

// AFTER:
<div style={{
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
  borderWidth: '1px',
  padding: `var(--space-md)`,
}}>
```

#### Task 1.3: BenefitGroup.tsx

**Current Issues**:
- `border-green-200 dark:border-green-900` hardcoded
- `bg-green-50 dark:bg-green-950` not using tokens
- Different status colors need semantic mapping

**Fix**:
```tsx
// Create a status color map:
const statusColorMap: Record<BenefitStatus, string> = {
  active: 'var(--color-success)',
  expiring_soon: 'var(--color-warning)',
  used: 'var(--color-text-secondary)',
  expired: 'var(--color-error)',
  pending: 'var(--color-text-secondary)',
};

// Apply to component:
<div style={{
  borderColor: statusColorMap[status],
  backgroundColor: `color-mix(in srgb, ${statusColorMap[status]} 10%, var(--color-bg))`,
}}>
```

#### Task 1.4: StatusFilters.tsx

**Current Issues**:
- `text-gray-600 hover:text-gray-900` hardcoded
- No focus state color
- Missing accessibility indicators

**Fix**:
```tsx
// BEFORE:
<button className={`text-gray-600 hover:text-gray-900 ${isSelected ? 'text-blue-600' : ''}`}>

// AFTER:
<button style={{
  color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
  borderBottomColor: isSelected ? 'var(--color-primary)' : 'transparent',
  borderBottomWidth: isSelected ? '2px' : '0',
  paddingBottom: isSelected ? 'calc(var(--space-sm) - 2px)' : `var(--space-sm)`,
  transition: 'color 200ms ease, border-color 200ms ease',
}}
onFocus={(e) => {
  e.target.style.boxShadow = '0 0 0 2px var(--color-primary)';
}}
onBlur={(e) => {
  e.target.style.boxShadow = 'none';
}}
>
```

#### Task 1.5: PeriodSelector.tsx

**Current Issues**:
- No focus ring (accessibility gap)
- Padding hardcoded (`px-4 py-2`)
- Missing color tokens

**Fix**:
```tsx
<select
  style={{
    padding: `var(--space-sm) var(--space-md)`,
    color: 'var(--color-text)',
    backgroundColor: 'var(--color-bg)',
    borderColor: 'var(--color-border)',
    borderWidth: '1px',
    borderRadius: `var(--radius-md)`,
  }}
  onFocus={(e) => {
    e.target.style.outlineOffset = '2px';
    e.target.style.outline = '2px solid var(--color-primary)';
  }}
/>
```

### Phase 2: Spacing Token Migration

**Objective**: Replace hardcoded padding/margins with space tokens

#### Task 2.1: SummaryBox.tsx

**Changes**:
- `p-6` → `padding: var(--space-lg)`
- `p-4` → `padding: var(--space-md)`
- `gap-4` → `gap: var(--space-md)`
- `mb-3` → `marginBottom: var(--space-sm)`

#### Task 2.2: General Layout

- Review all `px-4` → `paddingLeft/Right: var(--space-md)`
- Review all `py-2` → `paddingTop/Bottom: var(--space-sm)`
- Review all gaps → use `--space-*` tokens

---

## ✅ Testing Checklist

Before committing, verify:

### Visual Regression
- [ ] New dashboard colors match original dashboard visually
- [ ] All buttons have consistent styling
- [ ] All text is readable (sufficient contrast)
- [ ] Spacing is consistent across components

### Dark Mode
- [ ] Toggle dark mode in browser DevTools (Settings > Preferences > Appearance)
- [ ] All colors invert correctly
- [ ] Text remains readable in both modes
- [ ] No hardcoded colors visible in dark mode

### Responsive Design
- [ ] Mobile (375px width)
- [ ] Tablet (768px width)
- [ ] Desktop (1440px width)
- [ ] Landscape orientation
- [ ] No horizontal scroll

### Accessibility (WCAG AA)
- [ ] Contrast ratio ≥4.5:1 for all text
- [ ] Focus ring visible on all interactive elements
- [ ] Keyboard navigation works (Tab, Shift+Tab, Enter, Escape)
- [ ] Screen reader announces all elements correctly
- [ ] No keyboard traps

### Build & Tests
- [ ] `npm run build` succeeds (0 TypeScript errors)
- [ ] `npm run test` passes all existing tests
- [ ] No console errors in browser DevTools
- [ ] No React warnings about style prop

---

## 🎯 Success Criteria

After implementation, the new dashboard must have:

✅ **Visual Consistency**
- Colors match original dashboard (pixel-perfect)
- Spacing matches original dashboard
- Typography matches original dashboard

✅ **Design System Compliance**
- 100% of colors use CSS variables (no hardcoded hex/RGB)
- 100% of spacing uses space tokens (no hardcoded px)
- 100% of shadows use shadow tokens

✅ **Theme Support**
- Light mode works without manual changes
- Dark mode works automatically via `@media prefers-color-scheme: dark`
- Both modes have ≥4.5:1 contrast ratio

✅ **Accessibility**
- Focus ring visible with 2px solid `--color-primary`
- Tab order is logical and predictable
- All interactive elements keyboard-accessible

✅ **Code Quality**
- Zero TypeScript errors
- Zero console errors
- Zero React warnings
- All tests passing

---

## 📝 Commit Message

```
fix: Align new dashboard styling with design system tokens

- Replace hardcoded Tailwind colors with CSS variables
- Migrate spacing to token system (--space-sm, --space-md, etc.)
- Ensure dark mode support via @media prefers-color-scheme
- Fix accessibility: focus rings, contrast ratios
- Update components: DashboardButton, BenefitRow, BenefitGroup, StatusFilters, PeriodSelector, SummaryBox

Fixes: Styling misalignment between /dashboard and /dashboard/new
Related: Production deployment blocker

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 📁 Files to Modify

### Primary (Critical)
1. `src/app/dashboard/components/DashboardButton.tsx` - Color variables
2. `src/app/dashboard/components/BenefitRow.tsx` - Remove redundant Tailwind
3. `src/app/dashboard/components/BenefitGroup.tsx` - Color tokens
4. `src/app/dashboard/components/StatusFilters.tsx` - Text color tokens
5. `src/app/dashboard/components/PeriodSelector.tsx` - Complete focus styling

### Secondary (Important)
6. `src/app/dashboard/components/SummaryBox.tsx` - Spacing tokens
7. `src/app/dashboard/new/page.tsx` - Review layout spacing
8. `src/app/dashboard/page.tsx` - Reference for original styling

### Reference (Don't Modify)
- `src/styles/design-tokens.css` - Source of truth (already correct)

---

## 🔍 Comparison: Architecture Difference

The new dashboard serves a different UX purpose than the original, which is intentional:

### Original Dashboard (`/dashboard`)
- **View Type**: Grid (card-based)
- **Best For**: Quick overview of cards
- **Layout**: 3-6 cards per row
- **Interaction**: Click card to see benefits

### New Dashboard (`/dashboard/new`)
- **View Type**: List (row-based)
- **Best For**: Period-based benefit filtering
- **Layout**: Collapsible status groups
- **Interaction**: Filter by period/status, mark as used

**Both are valid UX patterns** - they just need **consistent visual styling** using the same design system.

---

## 🚀 Rollout Plan

1. **Developer**: Implement fixes using this specification
2. **Local Testing**: Run all tests, verify dark mode and responsive
3. **Code Review**: Ensure all CSS variables are used correctly
4. **QA**: Visual regression testing on both dashboards
5. **Accessibility**: WCAG AA audit
6. **Deployment**: Merge to main, deploy to Railway

**Estimated Duration**: 2-3 hours for experienced React developer

---

## 📞 Questions & Support

For issues during implementation:
1. Reference `src/styles/design-tokens.css` for all token names
2. Check browser DevTools to inspect computed styles
3. Use `@media (prefers-color-scheme: dark)` for theme switching
4. Test focus states with Tab key navigation

Good luck! This is a critical fix for production readiness.
