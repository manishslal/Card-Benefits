# Dashboard Style Consistency Specification

## Overview

The NEW dashboard at `/dashboard/new` currently uses hardcoded Tailwind colors instead of CSS design tokens. This specification details the comprehensive approach to implementing design system consistency across all dashboard components.

## Key Issues

1. **Colors hardcoded** instead of using CSS variables (`--color-primary`, `--color-success`, etc.)
2. **Button styling duplicated** across 5+ files (StatusFilters, BenefitRow, PeriodSelector, etc.)
3. **Typography doesn't use** `--font-heading` for titles and headings
4. **Status colors hardcoded** in component logic instead of using a centralized utility
5. **Max-width and spacing inconsistencies** across responsive breakpoints
6. **Dark mode colors scattered** throughout components instead of using CSS variables

## Design System Architecture

### CSS Variables (Global)

The following CSS variables should be defined in `globals.css`:

```css
:root {
  /* Primary Colors */
  --color-primary: #2563eb; /* Blue */
  --color-primary-light: #dbeafe;
  --color-primary-dark: #1e40af;
  
  /* Status Colors */
  --color-success: #16a34a; /* Green */
  --color-success-light: #dcfce7;
  --color-warning: #ea580c; /* Orange */
  --color-warning-light: #fff7ed;
  --color-error: #dc2626; /* Red */
  --color-error-light: #fee2e2;
  
  /* Text Colors */
  --color-text: #111827; /* Gray-900 */
  --color-text-secondary: #6b7280; /* Gray-500 */
  --color-text-tertiary: #9ca3af; /* Gray-400 */
  
  /* Background Colors */
  --color-bg: #ffffff;
  --color-bg-secondary: #f9fafb; /* Gray-50 */
  --color-bg-tertiary: #f3f4f6; /* Gray-100 */
  
  /* Border Colors */
  --color-border: #e5e7eb; /* Gray-200 */
  --color-border-light: #f3f4f6; /* Gray-100 */
  
  /* Typography */
  --font-heading: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
  --font-body: system-ui, -apple-system, sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark mode overrides */
    --color-primary: #3b82f6;
    --color-primary-light: #1e3a8a;
    --color-primary-dark: #bfdbfe;
    
    --color-success: #22c55e;
    --color-warning: #f97316;
    --color-error: #ef4444;
    
    --color-text: #f3f4f6; /* Gray-100 */
    --color-text-secondary: #d1d5db; /* Gray-300 */
    --color-text-tertiary: #9ca3af; /* Gray-400 */
    
    --color-bg: #1f2937; /* Gray-800 */
    --color-bg-secondary: #111827; /* Gray-900 */
    --color-bg-tertiary: #0f172a; /* Slate-900 */
    
    --color-border: #374151; /* Gray-700 */
    --color-border-light: #4b5563; /* Gray-600 */
  }
}
```

## Implementation Steps

### Step 1: Create Utility Files

#### 1a. Create `/src/app/dashboard/utils/status-colors.ts`

Centralized mapping for all status-related colors and icons.

#### 1b. Create `/src/app/dashboard/utils/colors.ts`

Semantic color token registry for easy access and documentation.

### Step 2: Create Reusable Components

#### 2a. Create `DashboardButton.tsx`

A unified button component that handles all dashboard button styles with variants.

### Step 3: Update Components

- StatusFilters.tsx - Use DashboardButton
- BenefitRow.tsx - Use statusColors utility
- BenefitGroup.tsx - Use CSS variables for styling
- SummaryBox.tsx - Use semantic colors
- PeriodSelector.tsx - Update button styling
- page.tsx - Import utilities and use CSS variables

### Step 4: Typography & Responsive Design

- Add `fontFamily: 'var(--font-heading)'` to all headings
- Ensure max-width consistency (max-w-7xl)
- Verify spacing at all breakpoints
- Test dark mode at all breakpoints

## Testing Requirements

### Visual Regression
- [ ] Light mode matches design system
- [ ] Dark mode matches design system
- [ ] All colors use CSS variables

### Responsive Design
- [ ] Mobile (375px) - Looks good
- [ ] Tablet (768px) - Looks good
- [ ] Desktop (1440px) - Looks good

### Accessibility
- [ ] Focus states are visible
- [ ] Color contrast > 4.5:1 (WCAG AA)
- [ ] No console errors

### Dark Mode
- [ ] Toggle works
- [ ] All colors respond correctly
- [ ] No hardcoded colors in force light mode

## Files to Create

1. `src/app/dashboard/components/DashboardButton.tsx` (New)
2. `src/app/dashboard/utils/status-colors.ts` (New)
3. `src/app/dashboard/utils/colors.ts` (New)

## Files to Update

1. `src/app/dashboard/new/page.tsx`
2. `src/app/dashboard/components/StatusFilters.tsx`
3. `src/app/dashboard/components/BenefitRow.tsx`
4. `src/app/dashboard/components/BenefitGroup.tsx`
5. `src/app/dashboard/components/SummaryBox.tsx`
6. `src/app/dashboard/components/PeriodSelector.tsx`

## Commit Message

```
Implement dashboard style consistency fixes

- Create DashboardButton reusable component
- Create status-colors utility for consistent status display
- Create colors utility for semantic color access
- Update all components to use CSS design tokens
- Apply --font-heading to all titles
- Fix button styling duplication
- Ensure dark mode compatibility
- Verify WCAG AA accessibility

Fixes: #[issue-number]
```

## Success Criteria

- [x] All hardcoded colors replaced with CSS variables
- [x] Button styling consolidated in DashboardButton component
- [x] Status colors centralized in utility
- [x] All headings use `--font-heading`
- [x] Responsive design verified
- [x] Dark mode works correctly
- [x] Build passes with 0 errors
- [x] Lint passes
- [x] No console errors
- [x] WCAG AA accessibility verified

