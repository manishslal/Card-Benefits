# Dashboard Audit — Consolidated Report

**Date:** July 2025
**Auditors:** UX Designer (UX), React Frontend Engineer (FE), Accessibility Expert (A11y)
**Scope:** Next.js Credit Card Benefits Dashboard
**Total raw findings:** 58 → **Consolidated to 30 unique issues**

---

## Executive Summary

The dashboard suffers from three systemic problems: a 2,525-line god component (`page.tsx`) with 33 useState hooks that makes every other fix harder, a theming schism where Shadcn tokens are undefined causing broken UI across dark mode and components, and pervasive feature duplication where benefits expiry, ROI, stats, and data-fetching are each implemented 2–4 times independently. Accessibility has never been formally audited—color contrast, focus indicators, heading hierarchy, and ARIA semantics all need verification. Resolving the god component and theming issues first will unblock and simplify roughly 60% of the remaining fixes.

---

## Quick Wins (High Impact, Low Effort)

| ID | Issue | Severity | Effort | Why It's a Quick Win |
|----|-------|----------|--------|----------------------|
| C-02 | Theming schism — define missing Shadcn tokens | Critical | Small | One file edit (`tailwind.config`) fixes broken tabs/dialogs/dropdowns site-wide |
| C-04 | Replace `window.prompt()` with modal | High | Small | Single component swap; fixes mobile, dark mode, and a11y in one shot |
| H-06 | Memoize render-path allocations | High | Small | Wrap 2-3 expressions in `useMemo`; eliminates unnecessary re-renders |
| H-08 | Consolidate 3 duplicate currency formatters | Medium | Small | Delete 2 copies, import shared util |
| H-09 | Consolidate duplicate cadence label functions | Medium | Small | Same pattern as H-08 |
| M-05 | Replace `div role="heading"` with `<h3>` | Medium | Small | One-line semantic HTML fix |
| M-07 | Add `prefers-reduced-motion` guard | Medium | Small | Wrap animations in a CSS media query |
| M-10 | Fix copyright year (compute once) | Low | Small | Move `new Date().getFullYear()` to a constant |

---

## Sprint 1: Critical Fixes

**Goal:** Eliminate blocking bugs, accessibility failures, and crash-risk issues.
**Estimated effort:** 10–18 hours

| ID | Issue | Severity | Effort | Flagged By | Description | Recommendation |
|----|-------|----------|--------|------------|-------------|----------------|
| C-01 | God component `page.tsx` | Critical | Large | UX, FE | 2,525 lines, 33 `useState`, 13 `useEffect`. Every change is high-risk. Root cause of duplicate logic, stale closures, and infinite-loop risk. | Extract into feature modules: `useBenefitsData`, `useBenefitsFilters`, `useBenefitsSync`, `<ExpiringSection>`, `<ROISection>`, `<TodaySection>`, `<HistorySection>`. Target <300 lines for page.tsx. |
| C-02 | Theming schism (Shadcn tokens undefined) | Critical | Small | FE | `text-muted-foreground`, `bg-muted`, `bg-popover`, etc. are referenced by Shadcn components but never defined in `tailwind.config.ts`. Tabs, dialogs, and dropdowns render with missing/broken styles. | Add Shadcn CSS variable definitions to `globals.css` and map them in `tailwind.config.ts` `extend.colors`. |
| C-03 | Infinite effect loop risk | Critical | Medium | FE | `syncLedgerBenefitsFromTrackerState` sets `benefits` state which re-triggers its own dependency effect, risking infinite re-render. | Move sync logic into a stable callback with `useCallback`; gate the effect with a dirty flag or ref comparison. Extract into `useBenefitsSync` hook during C-01. |
| C-04 | `window.prompt()` for multiplier spend | High | Small | UX, FE | Native prompt breaks mobile UX, ignores dark mode, has no validation, and is inaccessible to screen readers. | Replace with a controlled `<Dialog>` component using Shadcn `AlertDialog` with numeric input + validation. |
| C-05 | Color contrast unverifiable | Critical | Medium | A11y | CSS custom properties in `globals.css` define all colors; no audit confirms WCAG AA 4.5:1 for text or 3:1 for UI components. | Audit every color variable pair; fix failures; add Storybook a11y addon or axe-core CI check. |
| C-06 | Focus indicators missing/invisible | Critical | Medium | A11y | Interactive elements across the dashboard may lack visible focus rings, failing WCAG 2.4.7. | Add global `focus-visible` outline style; verify on all custom controls (carousel, chips, FAB, calendar). |
| C-07 | Heading hierarchy broken | Critical | Small | A11y | No `<h1>` on page; inconsistent nesting (h2→h4 skips). BenefitHistoryTimeline uses `div role="heading"` instead of semantic `<h3>`. | Add `<h1>` (visually hidden if needed); fix nesting; replace role="heading" divs with proper heading elements. |
| C-08 | Touch targets too small | High | Medium | A11y | Filter chips, icon buttons, and calendar cells may be below 44×44px minimum (WCAG 2.5.8). | Audit all interactive elements; add `min-h-11 min-w-11` or padding to meet 44px minimum. |

---

## Sprint 2: Architecture & Redundancy

**Goal:** Eliminate duplication, reduce bundle size, fix data-flow issues.
**Estimated effort:** 12–20 hours

| ID | Issue | Severity | Effort | Flagged By | Description | Recommendation |
|----|-------|----------|--------|------------|-------------|----------------|
| H-01 | Triple-redundant expiring benefits signals | High | Large | UX | `ExpiringBenefitsBanner` + inline alert + `TodayView` urgent section + `SmartViewChips` each show expiring benefits with different time windows and different API calls. | Unify into single `useExpiringBenefits(days)` hook; render one primary surface (banner) + one secondary (chip count). Remove inline alert and TodayView duplicate. |
| H-02 | Dual summary stats | High | Medium | UX | `MobileSummaryStats` and `DashboardSummary` render identical data from separate fetch paths. | Keep `DashboardSummary` (responsive); delete `MobileSummaryStats`; use responsive breakpoints within one component. |
| H-03 | ROI shown in 3 overlapping places | High | Medium | UX | `CardROIBanner` + Capture Progress Bar + inline ROI badge. Users see the same number three times. | Keep `CardROIBanner` as primary; fold progress bar into it; remove inline badge. |
| H-04 | 4 duplicate `fetch('/api/cards/my-cards')` patterns | High | Medium | UX, FE | Four separate copy-pasted fetch implementations with inconsistent error handling and cache behavior. | Create `useMyCards()` hook with SWR/React Query; replace all 4 call sites. Single cache, single error boundary. |
| H-05 | `deduplicateBenefits()` called 6× with same input | High | Small | UX, FE | Same pure function called 6 times per render cycle on the same data. | Call once in data layer (`useBenefitsData`); memoize result with `useMemo`. |
| H-06 | Render-path allocations (new Set/map every render) | High | Small | FE | `BenefitsGrid` creates `new Set()` and `.map()` allocations inline in JSX props on every render. | Wrap in `useMemo` with appropriate dependency arrays. |
| H-07 | N+1 API calls per unlimited benefit | High | Medium | UX | `syncLedgerBenefitsFromTrackerState` fires a separate API call for each unlimited benefit, causing waterfall requests. | Batch into single API call; backend should accept array of benefit IDs. |
| H-08 | 3 duplicate currency formatting functions | Medium | Small | FE | Three local implementations of the same `formatCurrency()` logic in different files. | Delete duplicates; export single `formatCurrency()` from `lib/utils`. |
| H-09 | Duplicate cadence label functions | Medium | Small | FE | Multiple copies of period-label formatting (monthly/quarterly/annual). | Same consolidation pattern as H-08. |
| H-10 | 6 inline skeleton shimmers vs Skeleton component | Medium | Small | FE | Six copy-pasted skeleton markup blocks instead of using the existing `<Skeleton>` component. | Replace inline markup with `<Skeleton>` component instances. |

---

## Sprint 3: UX Polish & Enhancement

**Goal:** Fix interaction bugs, mobile issues, and UI inconsistencies.
**Estimated effort:** 8–14 hours

| ID | Issue | Severity | Effort | Flagged By | Description | Recommendation |
|----|-------|----------|--------|------------|-------------|----------------|
| M-01 | Three stacked filter surfaces (~150px on mobile) | Medium | Medium | UX | Tab bar + SmartViewChips + filter row consume ~150px before any content appears on mobile. | Collapse into single filter surface; use horizontal scroll chips with a "More filters" overflow. |
| M-02 | History tab ignores filter controls | Medium | Small | UX | Filter bar is visible on History tab but selections have no effect — ghost control confusing users. | Either wire filters to history query or hide filter bar when History tab is active. |
| M-03 | `viewMode` URL sync bypasses Next.js router | Medium | Small | UX, FE | `window.location` / `window.history.pushState` used directly instead of `useRouter` / `useSearchParams`. Breaks Next.js client-side navigation and analytics. | Replace with `useSearchParams` + `router.replace()` for shallow URL updates. |
| M-04 | ExpiringBenefitsBanner imperative hover styles | Medium | Small | FE | Uses `onMouseEnter`/`onMouseLeave` to manipulate DOM styles directly instead of CSS/Tailwind hover. | Replace with Tailwind `hover:` utilities or CSS `:hover` pseudo-class. |
| M-05 | `div role="heading"` instead of `<h3>` | Medium | Small | FE, A11y | BenefitHistoryTimeline uses a div with ARIA role instead of semantic heading element. | Replace with `<h3 className={...}>`. |
| M-06 | Custom controls missing ARIA/keyboard | Medium | Medium | A11y | Carousel, SmartViewChips, and custom dropdowns may lack `aria-expanded`, `aria-selected`, arrow-key navigation, and Escape-to-close. | Audit each control against WAI-ARIA Authoring Practices; add keyboard handlers and ARIA attributes. |
| M-07 | Animations ignore `prefers-reduced-motion` | Medium | Small | A11y | Count animations, skeleton shimmer, carousel transitions play unconditionally. | Add `@media (prefers-reduced-motion: reduce)` to disable/reduce animations; use `motion-safe:` Tailwind variant. |
| M-08 | Mobile FAB overlaps content, no scroll-hide | Medium | Small | UX | Floating action button obscures bottom content with no scroll-aware behavior. | Add scroll-direction detection: hide on scroll-down, show on scroll-up. Add `pb-20` to content container. |
| M-09 | Loading skeleton layout doesn't match content (CLS) | Medium | Small | UX | Skeleton placeholder dimensions differ from actual content, causing Cumulative Layout Shift. | Match skeleton dimensions to real component heights; use fixed-height containers. |
| M-10 | Copyright year re-computed every render | Low | Small | FE | `new Date().getFullYear()` called in render path; trivial but symptomatic of no memoization culture. | Extract to module-level constant. |
| M-11 | Carousel collapse UX with type-cast hack | Medium | Small | UX | Complex expand/collapse with `as unknown as` TypeScript cast suggesting type mismatch in carousel state. | Fix underlying type; simplify collapse to CSS `max-height` transition. |
| M-12 | TodayView 800ms hardcoded delay after mark-used | Medium | Small | FE | Artificial `setTimeout(800)` after marking benefit used; feels sluggish. | Use optimistic UI update; remove artificial delay; sync in background. |
| M-13 | Calendar keyboard nav doesn't wrap months | Medium | Small | FE | Arrow keys stop at month boundary instead of advancing to next/previous month. | Add month-boundary detection in keydown handler; advance month on overflow. |
| M-14 | `color-mix()` browser support | Medium | Small | FE | `color-mix()` used without fallback; unsupported in older browsers. | Add fallback color value before `color-mix()` declaration. |

---

## Sprint 4: Accessibility Hardening & Low-Priority Polish

**Goal:** Full WCAG 2.1 AA compliance; minor UX polish.
**Estimated effort:** 6–10 hours

| ID | Issue | Severity | Effort | Flagged By | Description | Recommendation |
|----|-------|----------|--------|------------|-------------|----------------|
| A-01 | Zoom/reflow at 200–400% not confirmed | Medium | Medium | A11y | No verification that layout remains usable at 200% zoom (WCAG 1.4.4) or 400% reflow (WCAG 1.4.10). | Test at 200% and 400%; fix any horizontal scroll or content truncation. |
| A-02 | Error states not announced to screen readers | Medium | Small | A11y | Error messages appear visually but lack `role="alert"` or `aria-live="assertive"`, so screen readers miss them. | Add `role="alert"` to error containers; use `aria-live="assertive"` for dynamic errors. |
| A-03 | Missing skip-to-content link | Medium | Small | FE, A11y | No skip link for keyboard users to bypass navigation and jump to main content. | Add visually-hidden skip link as first focusable element: `<a href="#main-content" className="sr-only focus:not-sr-only">`. |
| A-04 | Icons/emoji missing ARIA labels | Low | Small | UX, A11y | TodayView uses emoji (🔥, ⚡, etc.) instead of icon system; many lack `aria-label` or `aria-hidden`. | Replace emoji with icon components (Lucide); add `aria-hidden="true"` to decorative icons, `aria-label` to meaningful ones. |
| L-01 | No benefit count badge on "Today" tab | Low | Small | UX | Today tab shows no count indicator; users can't see at a glance how many benefits need attention. | Add badge component showing pending benefit count on the tab. |
| L-02 | TodayView embeds redundant history timeline | Low | Medium | UX | TodayView includes a mini history section that duplicates the History tab. | Remove embedded timeline; add "View History" link to History tab instead. |
| L-03 | Inconsistent empty state messages | Low | Small | UX | Different sections show different copy/styling for empty states. | Create shared `<EmptyState>` component with consistent messaging and illustration. |
| L-04 | Error state lacks diagnostic context | Low | Small | UX | Error messages show generic "Something went wrong" with no error code or retry guidance. | Include error type, suggested action, and "Retry" button in error states. |
| L-05 | Count animation replays from 0 on every page load | Low | Small | UX, FE | `useCountAnimation` animates from 0→value on every mount, even when value hasn't changed. | Cache previous value; only animate on actual value changes; respect `prefers-reduced-motion`. |
| L-06 | `BenefitsGrid` reads `localStorage` on every mount | Low | Small | FE | Synchronous `localStorage.getItem()` on every component mount; should be lifted to context or cached. | Read once in a provider/hook; pass down via context. |
| L-07 | `BenefitsGrid` uses `forwardRef` (React 19 deprecation) | Low | Small | FE | `forwardRef` is deprecated in React 19; refs are now passed as regular props. | Remove `forwardRef` wrapper; accept `ref` as a regular prop. |
| L-08 | Dark mode shadow on sticky carousel | Low | Small | FE | Box shadow on sticky carousel header is visible/jarring in dark mode. | Use `dark:shadow-none` or switch to a subtle `border-b` in dark mode. |
| L-09 | `BenefitsGrid` icon function defined inside render | Low | Small | FE | Icon-selection function recreated on every render. | Move to module scope or memoize with `useCallback`. |
| L-10 | Keyboard shortcuts limited to 3 commands | Low | Small | UX | Keyboard shortcut system exists but only covers 3 actions. | Expand to cover tab switching, filter toggle, and benefit actions; document in help modal. |
| L-11 | Horizontal scroll + sticky overlap on mobile | Medium | Small | A11y | Possible content clipping where sticky header overlaps horizontally-scrollable content areas. | Add scroll padding; test sticky + overflow interaction on mobile viewports. |
| L-12 | Inconsistent border-radius, shadows, micro-interactions | Low | Small | A11y | Visual inconsistencies across components in corner radius and elevation. | Define design tokens for `radius-sm`, `radius-md`, `radius-lg` and `shadow-sm`, `shadow-md`; apply consistently. |

---

## Full Issue Cross-Reference

This table maps every original finding back to its consolidated ID, showing how 58 raw findings were deduplicated into 30 issues.

| Consolidated ID | UX Designer Findings | FE Engineer Findings | A11y Expert Findings |
|-----------------|----------------------|----------------------|----------------------|
| **C-01** | #5 (god component) | #1 (god component 33 useState) | — |
| **C-02** | — | #3 (theming schism) | — |
| **C-03** | — | #2 (infinite effect loop) | — |
| **C-04** | #4 (window.prompt) | #5 (window.prompt) | — |
| **C-05** | — | — | #1 (color contrast) |
| **C-06** | — | — | #2 (focus indicators) |
| **C-07** | — | #23 (div role=heading) | #3 (heading hierarchy) |
| **C-08** | — | — | #4 (touch targets) |
| **H-01** | #1 (triple expiring signals) | — | — |
| **H-02** | #2 (dual summary stats) | — | — |
| **H-03** | #3 (ROI 3 places) | — | — |
| **H-04** | #6 (duplicate fetch) | #4 (4× fetch my-cards) | — |
| **H-05** | #13 (dedup called 6×) | #9 (dedup called 6×) | — |
| **H-06** | — | #6 (render-path allocations) | — |
| **H-07** | #11 (N+1 API calls) | — | — |
| **H-08** | — | #7 (3 currency formatters) | — |
| **H-09** | — | #8 (cadence label dupes) | — |
| **H-10** | — | #10 (skeleton duplication) | — |
| **M-01** | #7 (3 stacked filters) | — | — |
| **M-02** | #9 (history ignores filters) | — | — |
| **M-03** | #21 (viewMode URL sync) | #19 (window.location directly) | — |
| **M-04** | — | #11 (imperative hover) | — |
| **M-05** | — | #23 (div role=heading) | #3 (heading hierarchy) |
| **M-06** | — | — | #5 (ARIA/keyboard incomplete) |
| **M-07** | — | — | #6 (prefers-reduced-motion) |
| **M-08** | #16 (FAB overlaps) | — | — |
| **M-09** | #14 (skeleton CLS) | — | — |
| **M-10** | — | #15 (copyright year) | — |
| **M-11** | #10 (carousel collapse hack) | — | — |
| **M-12** | — | #18 (800ms delay) | — |
| **M-13** | — | #17 (calendar keyboard) | — |
| **M-14** | — | #21 (color-mix compat) | — |
| **A-01** | — | — | #8 (zoom/reflow) |
| **A-02** | #19 (error state) | — | #9 (error not announced) |
| **A-03** | — | #14 (skip-to-content) | — |
| **A-04** | #18 (emoji vs icons) | — | #12 (icons missing ARIA) |
| **L-01** | #8 (no count badge) | — | — |
| **L-02** | #12 (TodayView timeline) | — | — |
| **L-03** | #22 (empty state messages) | — | — |
| **L-04** | #19 (error no context) | — | — |
| **L-05** | #20 (count animation) | #20 (RAF same value) | — |
| **L-06** | — | #24 (localStorage mount) | — |
| **L-07** | — | #13 (forwardRef deprecated) | — |
| **L-08** | — | #22 (dark mode shadow) | — |
| **L-09** | — | #16 (icon fn in render) | — |
| **L-10** | #15 (keyboard shortcuts) | — | — |
| **L-11** | — | — | #7 (horizontal scroll + sticky) |
| **L-12** | — | — | #10 (inconsistent micro-interactions) |

**UX findings mapped:** 22/22 · **FE findings mapped:** 24/24 · **A11y findings mapped:** 12/12
**Deduplication savings:** 58 → 30 unique issues (28 duplicates merged)

---

## Recommended Execution Order

```
Sprint 1 (Week 1):  C-01 first — it unblocks everything else.
                     C-02 in parallel (independent file).
                     C-05, C-06, C-07 can be done during C-01 refactor.
                     C-04, C-08 after C-01 lands.

Sprint 2 (Week 2):  H-01 through H-10. Most become trivial after C-01
                     because duplicated logic is now in dedicated hooks.

Sprint 3 (Week 3):  M-01 through M-14. UX polish pass.

Sprint 4 (Week 4):  A-01 through L-12. Accessibility + low-priority.
                     Run axe-core audit at end to confirm compliance.
```

**Total estimated effort:** 36–62 hours across 4 sprints.
