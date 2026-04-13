# Used Benefits Collapse — Implementation Specification

> **Sprint**: Dashboard Polish · **Priority**: P1  
> **Scope**: Collapse used benefit cards into a summary accordion on the dashboard  
> **Status**: SPEC READY — Hand off to implementation agent

---

## 0. Problem Statement

Used benefit cards currently render at full size in the dashboard grid with only a subtle visual difference (opacity 0.85, gray bg). On cards with many benefits, the "Used" group pushes un-used benefits far below the fold and creates visual clutter. Users have already interacted with these benefits — they are **low-priority content** that should be **collapsed by default** and expandable on demand.

---

## 1. Component Architecture

### 1.1 New Component: `UsedBenefitsAccordion`

**File**: `src/features/benefits/components/grids/UsedBenefitsAccordion.tsx`

This is a **self-contained accordion component** that lives inside BenefitsGrid. It replaces the current inline rendering of the `__used__` group.

```
BenefitsGrid
├── [period groups] → rendered as before (grid cards)
└── UsedBenefitsAccordion   ← NEW
    ├── Summary Header (always visible)
    │   ├── CheckCircle2 icon
    │   ├── "Used Benefits" label
    │   ├── Count badge: "(5)"
    │   ├── Value captured: "$1,250"
    │   └── Chevron toggle
    └── Expandable Card Grid (collapsed by default)
        └── Same grid cards as before, with stagger animation
```

### 1.2 Props Interface

```typescript
interface UsedBenefitsAccordionProps {
  benefits: Benefit[];                             // The __used__ group benefits
  onEdit?: (benefitId: string) => void;
  onMarkUsed?: (benefitId: string) => void;
  celebratingIds?: Set<string>;
  gridColsClass: string;                           // e.g. "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
  renderCard: (benefit: Benefit, index: number) => React.ReactNode;  // Card render fn from parent
}
```

**Why `renderCard` prop?** The card rendering logic in BenefitsGrid is complex (progress ring, icons, badges, animations). Rather than duplicating it, we pass a render function from the parent. This keeps UsedBenefitsAccordion focused on accordion behavior while reusing the exact same card markup.

### 1.3 Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/features/benefits/components/grids/UsedBenefitsAccordion.tsx` | **NEW** | Self-contained accordion component |
| `src/features/benefits/components/grids/BenefitsGrid.tsx` | **MODIFY** | Extract `__used__` group rendering into UsedBenefitsAccordion |
| `src/styles/animations.css` | **MODIFY** | Add accordion expand/collapse keyframes |
| `src/styles/design-tokens.css` | **MODIFY** | Add used-accordion design tokens |

---

## 2. Collapsed State UI (Default)

The collapsed state is a **horizontal summary bar** spanning the full grid width (`col-span-full`).

### 2.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Used Benefits (5)          $1,250 captured     ▼       │
│     ~~~~~~~~~~~~~~~~~~~~~~~~~~                    chevron   │
│  icon  label      count        value summary               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Styling

```css
/* Summary header bar */
background: var(--color-bg-secondary);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);          /* 12px */
padding: var(--space-md) var(--space-md);  /* 16px */
min-height: var(--touch-target-min);       /* 44px — meets touch target */
cursor: pointer;
transition: background-color var(--duration-fast) ease;

/* Hover state */
&:hover {
  background: var(--color-bg-tertiary);
}

/* Active/press feedback */
&:active {
  transform: scale(0.99);                 /* Subtle press — 0.98 felt too jarring */
}
```

### 2.3 Content Details

| Element | Style | Token |
|---------|-------|-------|
| CheckCircle2 icon | `size={16}`, `color: var(--color-status-used)` | `--color-status-used: #64748B` (light), `#94A3B8` (dark) |
| "Used Benefits" label | `font-weight: 600`, `font-size: var(--text-body-sm)` | 14px |
| Count "(5)" | `font-weight: 400`, `opacity: 0.7`, `font-size: var(--text-body-sm)` | — |
| Value captured | `font-mono`, `font-weight: 500`, `color: var(--color-success)` | Green accent |
| Chevron SVG | `w-5 h-5`, rotates 180° when expanded | Same SVG as BenefitGroup |

### 2.4 Mini-Preview Icons — **NOT implementing**

**Decision**: Skip mini-preview icons (e.g., tiny category icons in a row). 

**Rationale**:
- Adds visual noise to a section intentionally de-emphasized
- Category icons at 12px are barely distinguishable
- Count + value already provide sufficient "peek" information
- Simpler implementation = fewer edge cases (icon overflow at 20+ benefits)

---

## 3. Expanded State UI

When the user expands the accordion, the used benefit cards render in the same grid layout as all other cards.

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ✓  Used Benefits (5)          $1,250 captured     ▲       │
└─────────────────────────────────────────────────────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Used Card 1 │ │  Used Card 2 │ │  Used Card 3 │
│  (opacity 85)│ │  (opacity 85)│ │  (opacity 85)│
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐
│  Used Card 4 │ │  Used Card 5 │
└──────────────┘ └──────────────┘
```

### 3.2 Card Rendering

Cards render identically to the current implementation:
- Same grid class: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Same card markup (reused via `renderCard` prop)
- Same `opacity: 0.85` and `backgroundColor: var(--color-bg-secondary)` for used cards
- Edit and action buttons remain functional

### 3.3 Stagger Animation on Expand

When expanding, cards reveal with a **staggered slideUp animation**:

```css
/* Each card gets an incremental delay */
animation: usedCardReveal 220ms var(--ease-out) both;
animation-delay: calc(var(--card-index) * 40ms);  /* 40ms stagger per card */
```

Stagger is capped at 8 items (320ms max total delay) to prevent slow-feeling reveals for large lists.

---

## 4. Animation Specification

### 4.1 Design Tokens (add to `design-tokens.css`)

```css
:root {
  /* Used Benefits Accordion */
  --used-accordion-expand-duration: 250ms;
  --used-accordion-collapse-duration: 180ms;     /* 70% of expand = exit-faster-than-enter */
  --used-accordion-expand-easing: cubic-bezier(0.0, 0, 0.2, 1);   /* ease-out for entering */
  --used-accordion-collapse-easing: cubic-bezier(0.4, 0, 1, 1);   /* ease-in for exiting */
  --used-accordion-stagger-delay: 40ms;
  --used-accordion-stagger-max-items: 8;
}
```

Dark mode block (`.dark`) gets the same values — no dark-specific overrides needed for animation tokens.

### 4.2 Keyframes (add to `animations.css`)

```css
/* ========================================
   USED BENEFITS ACCORDION (Dashboard Polish)
   ======================================== */

/* Accordion content expand — height + opacity */
@keyframes usedAccordionExpand {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    max-height: 2000px;   /* generous max — actual height is auto */
    transform: translateY(0);
  }
}

/* Individual card reveal within expanded accordion */
@keyframes usedCardReveal {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 0.85;          /* Used cards stop at 0.85 opacity */
    transform: translateY(0) scale(1);
  }
}

/* Chevron rotation is handled via inline transform transition */
```

### 4.3 Utility Classes

```css
.used-accordion-content {
  overflow: hidden;
  animation: usedAccordionExpand var(--used-accordion-expand-duration) var(--used-accordion-expand-easing) both;
}

/* Collapsing state — applied briefly via JS class toggle */
.used-accordion-content--collapsing {
  animation: usedAccordionExpand var(--used-accordion-collapse-duration) var(--used-accordion-collapse-easing) reverse both;
}

.used-card-stagger {
  animation: usedCardReveal 220ms var(--ease-out) both;
}
```

### 4.4 Reduced Motion

Already handled by the existing global rule in `animations.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

No additional reduced-motion overrides needed. The accordion state change still happens instantly (content appears/disappears) — just without the slide/fade animation.

### 4.5 Chevron Animation

```css
/* Inline style on the SVG */
transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
transition: transform var(--used-accordion-expand-duration) var(--used-accordion-expand-easing);
```

This matches the existing BenefitGroup chevron pattern exactly.

### 4.6 Interruptibility

The accordion uses **CSS animations** (not JS-driven). If the user clicks to re-collapse during an expand animation:
- React unmounts the content div (or toggles the collapsing class)
- The browser naturally interrupts the animation
- No explicit cancellation code is needed because we use conditional rendering (same pattern as BenefitGroup and PastPeriodsSection)

---

## 5. State Management

### 5.1 Collapse State Location

**Inside `UsedBenefitsAccordion`** as local component state.

```typescript
const [isExpanded, setIsExpanded] = useState(false);  // collapsed by default
```

**Why local, not lifted to DashboardPage?**
- This is a **view-only presentation concern** — no business logic depends on it
- Matches precedent: `PastPeriodsSection` manages its own `expandedPeriodId` state internally
- No need to persist across card switches — when the user switches cards, the component unmounts/remounts and resets to collapsed
- No need to persist across page navigation

### 5.2 Default State

**Collapsed by default** (`isExpanded = false`).

Rationale:
- UI/UX Pro Max rule `content-priority`: Used benefits are lower priority
- Users have already interacted with these benefits
- Matches `PastPeriodsSection` precedent (collapsed by default)

### 5.3 State Transitions

```
[Collapsed] ---(click header)---> [Expanded]
[Expanded]  ---(click header)---> [Collapsed]
[Expanded]  ---(card switch)--->  [Collapsed]  (component remount)
[Expanded]  ---(mark unused)--->  [Expanded]   (benefit moves out of __used__ group; re-render)
```

### 5.4 When `isUsed` Changes (Undo)

When a user marks a benefit as unused (undo), the optimistic update in `handleMarkUsed` already calls `setBenefits()`. This causes BenefitsGrid to re-sort — the benefit leaves the `__used__` group and returns to a period group. The accordion component receives fewer items in its `benefits` prop. No special handling is needed.

If the last used benefit is unmarked, the `__used__` group disappears entirely (0 benefits → component returns null).

---

## 6. Accessibility

### 6.1 ARIA Attributes

```tsx
<button
  aria-expanded={isExpanded}
  aria-controls="used-benefits-accordion-content"
  aria-label={`Used Benefits section, ${benefits.length} items, ${isExpanded ? 'expanded' : 'collapsed'}`}
>
  {/* header content */}
</button>

<div
  id="used-benefits-accordion-content"
  role="region"
  aria-labelledby="used-benefits-accordion-trigger"
>
  {/* card grid */}
</div>
```

### 6.2 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Focus moves to the accordion header button |
| `Enter` | Toggle expand/collapse |
| `Space` | Toggle expand/collapse |
| `Tab` (from header, when expanded) | Focus moves into first benefit card |

The header is a native `<button>` element, so Enter/Space work automatically. No additional `onKeyDown` handler needed for the toggle — the browser handles it.

### 6.3 Heading Hierarchy

The current page uses `<h2>` for period group headers. The "Used Benefits" label inside the accordion header should also be an `<h2>` (or wrapped in one) to maintain heading hierarchy:

```tsx
<h2 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
  Used Benefits
  <span className="font-normal opacity-70 ml-1">({benefits.length})</span>
</h2>
```

### 6.4 Screen Reader Behavior

- When collapsed: "Used Benefits section, 5 items, collapsed. Button."
- When expanded: "Used Benefits section, 5 items, expanded. Button."
- Cards inside are individually focusable (existing `role="button"` + `tabIndex={0}` on each card)

### 6.5 Live Region for Value

The "value captured" text is decorative (not critical for screen readers). No `aria-live` region needed — the `aria-label` on the button provides the essential information.

---

## 7. Mobile Considerations

### 7.1 Touch Targets

The accordion header button must be **at least 44×44px** tall:

```css
min-height: var(--touch-target-min);  /* 44px */
```

The current design uses `padding: var(--space-md)` (16px top + bottom = 32px) plus content height (~20px text) = ~52px. This exceeds the 44px minimum. ✓

### 7.2 Touch Spacing

Gap between the accordion header and the first card below it:

```css
padding-top: var(--space-md);  /* 16px gap */
```

This exceeds the 8px minimum touch spacing. ✓

### 7.3 Press Feedback

```css
/* Active state on the header button */
transition: transform var(--duration-fast) ease;

&:active {
  transform: scale(0.99);
}
```

Per UI/UX Pro Max: "Visual feedback within 100ms" — `var(--duration-fast)` = 100ms. ✓

### 7.4 Scroll Behavior

**On expand**: Do NOT auto-scroll. The user intentionally tapped to expand — they know where they are.

**On collapse**: If collapsing would push the header out of the viewport (because it was below the fold when expanded), scroll the header into view:

```typescript
const handleToggle = () => {
  const nextState = !isExpanded;
  setIsExpanded(nextState);

  // On collapse: scroll header into view if it would be off-screen
  if (!nextState && headerRef.current) {
    requestAnimationFrame(() => {
      const rect = headerRef.current!.getBoundingClientRect();
      if (rect.top < 0) {
        headerRef.current!.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
};
```

### 7.5 Mobile Layout

On mobile (`grid-cols-1`), the accordion spans full width and cards stack vertically. No additional mobile-specific styles needed — the grid responsive classes already handle this.

---

## 8. Edge Cases

### 8.1 Zero Used Benefits

```typescript
// In UsedBenefitsAccordion:
if (benefits.length === 0) return null;
```

The component simply doesn't render. No empty state message needed — the user hasn't used any benefits yet, which is the normal starting state.

### 8.2 One Used Benefit

Renders normally. The accordion header shows "(1)" count. When expanded, a single card appears. The accordion provides consistent UI regardless of count — no "skip accordion for 1 item" special case.

### 8.3 Twenty+ Used Benefits (Large Lists)

- Stagger animation is capped at 8 items (320ms max). Items 9+ get the same 320ms delay → they all appear together after the stagger sequence.
- No virtualization needed — 20 cards is well within DOM performance limits.
- The max-height animation uses `2000px` which accommodates ~20 cards in 3-column layout.

### 8.4 Undo: Marking a Benefit as Unused

When a benefit is toggled back to unused:
1. `setBenefits()` in DashboardPage updates the benefit's `isUsed` to `false`
2. BenefitsGrid re-sorts — benefit leaves `__used__` group, returns to its period group
3. The accordion count decreases
4. If it was the last used benefit, accordion disappears (returns null)
5. No special handling needed — React's reconciliation handles this naturally

### 8.5 Celebrating Benefit (Just Marked Used)

When `handleMarkUsed` fires:
1. The benefit is optimistically moved to the `__used__` group
2. The celebration animation plays on the card (`animate-celebrate-used`)
3. If the accordion is **collapsed**, the card is hidden inside — the count increments but the celebration is invisible

**Decision**: This is acceptable. The celebration toast (shown by handleMarkUsed) already provides positive feedback. Expanding the accordion to show the card celebrating would feel jarring and defeat the purpose of collapsing.

### 8.6 History View Mode

When `viewMode === 'history'`, the `onMarkUsed` handler is `undefined` (line 1811), so benefits can't be toggled. The accordion works identically in history mode — it collapses used benefits from past periods.

### 8.7 Card Switch

When the user switches cards, `selectedCardId` changes → the `<div key={selectedCardId}>` wrapper (line 1807) causes a full remount → UsedBenefitsAccordion re-mounts with `isExpanded = false` → collapsed. This is the correct behavior.

### 8.8 Search/Sort Active

When search filters are active, `displayBenefits` may exclude some used benefits. The accordion only shows used benefits that survive the filter. If all used benefits are filtered out, the accordion disappears.

---

## 9. Code Changes

### 9.1 NEW FILE: `src/features/benefits/components/grids/UsedBenefitsAccordion.tsx`

```tsx
'use client';

import React, { useState, useRef, useCallback } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface Benefit {
  id: string;
  name: string;
  value?: number;
  isUsed?: boolean;
  [key: string]: unknown;  // passthrough for renderCard
}

interface UsedBenefitsAccordionProps {
  benefits: Benefit[];
  gridColsClass: string;
  renderCard: (benefit: Benefit, staggerIndex: number) => React.ReactNode;
}

/**
 * UsedBenefitsAccordion
 *
 * Collapses used benefit cards into a summary header bar,
 * expandable on click. Collapsed by default.
 *
 * Follows the accordion pattern from BenefitGroup.tsx and
 * PastPeriodsSection.tsx (collapsed-by-default precedent).
 *
 * Sprint: Dashboard Polish
 */
export function UsedBenefitsAccordion({
  benefits,
  gridColsClass,
  renderCard,
}: UsedBenefitsAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const headerRef = useRef<HTMLButtonElement>(null);

  // Don't render if no used benefits
  if (benefits.length === 0) return null;

  // Compute total value captured
  const totalValueCaptured = benefits.reduce(
    (sum, b) => sum + (b.value || 0),
    0
  );

  const handleToggle = useCallback(() => {
    const nextState = !isExpanded;
    setIsExpanded(nextState);

    // On collapse: scroll header into view if it would be off-screen
    if (!nextState && headerRef.current) {
      requestAnimationFrame(() => {
        const rect = headerRef.current!.getBoundingClientRect();
        if (rect.top < 0) {
          headerRef.current!.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      });
    }
  }, [isExpanded]);

  // Cap stagger delay at 8 items
  const maxStaggerItems = 8;

  return (
    <div className="col-span-full">
      {/* ── Summary Header Bar ── */}
      <button
        ref={headerRef}
        id="used-benefits-accordion-trigger"
        onClick={handleToggle}
        className="w-full flex items-center justify-between rounded-lg transition-colors"
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-md)',
          minHeight: 'var(--touch-target-min)',
          cursor: 'pointer',
          transition: `background-color var(--duration-fast) ease, transform var(--duration-fast) ease`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
        }}
        aria-expanded={isExpanded}
        aria-controls="used-benefits-accordion-content"
      >
        {/* Left side: icon + label + count */}
        <div className="flex items-center gap-2" style={{ gap: 'var(--space-sm)' }}>
          <CheckCircle2
            size={16}
            className="flex-shrink-0"
            style={{ color: 'var(--color-status-used)' }}
            aria-hidden="true"
          />
          <h2
            className="font-semibold"
            style={{
              fontSize: 'var(--text-body-sm)',
              color: 'var(--color-text)',
              margin: 0,
            }}
          >
            Used Benefits
            <span
              className="font-normal ml-1"
              style={{
                opacity: 0.7,
                marginLeft: 'var(--space-xs)',
              }}
            >
              ({benefits.length})
            </span>
          </h2>
        </div>

        {/* Right side: value captured + chevron */}
        <div className="flex items-center gap-3" style={{ gap: 'var(--space-md)' }}>
          {totalValueCaptured > 0 && (
            <span
              className="font-mono text-xs font-medium hidden sm:inline"
              style={{ color: 'var(--color-success)' }}
            >
              ${totalValueCaptured.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{' '}
              captured
            </span>
          )}
          <svg
            className="w-5 h-5 flex-shrink-0"
            style={{
              color: 'var(--color-text-secondary)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--used-accordion-expand-duration, 250ms) var(--used-accordion-expand-easing, ease-out)',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </button>

      {/* ── Expandable Card Grid ── */}
      {isExpanded && (
        <div
          id="used-benefits-accordion-content"
          role="region"
          aria-labelledby="used-benefits-accordion-trigger"
          className={`grid ${gridColsClass} gap-4 used-accordion-content`}
          style={{
            paddingTop: 'var(--space-md)',
          }}
        >
          {benefits.map((benefit, index) => (
            <div
              key={benefit.id}
              className="used-card-stagger"
              style={{
                animationDelay: `${Math.min(index, maxStaggerItems) * 40}ms`,
              }}
            >
              {renderCard(benefit, index)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 9.2 MODIFY: `src/features/benefits/components/grids/BenefitsGrid.tsx`

#### Change 1: Add import

```typescript
// BEFORE (line 1-10):
'use client';

import React, { useMemo } from 'react';
import Badge from '@/shared/components/ui/Badge';
import {
  Plane, Tag, Utensils, DollarSign, Zap, Calendar, CheckCircle2,
  Shield, Music, Tv, Star, Armchair, Hotel, Heart, Car, Landmark,
  Pencil,
} from 'lucide-react';
import { formatPeriodRange } from '@/lib/format-period-range';

// AFTER:
'use client';

import React, { useMemo, useCallback } from 'react';
import Badge from '@/shared/components/ui/Badge';
import {
  Plane, Tag, Utensils, DollarSign, Zap, Calendar, CheckCircle2,
  Shield, Music, Tv, Star, Armchair, Hotel, Heart, Car, Landmark,
  Pencil,
} from 'lucide-react';
import { formatPeriodRange } from '@/lib/format-period-range';
import { UsedBenefitsAccordion } from './UsedBenefitsAccordion';
```

#### Change 2: Extract card render function

Inside the `BenefitsGrid` forwardRef, after the `getGridColsClass` function (after line 541), add a `renderBenefitCard` callback that extracts the card JSX from the current `group.benefits.map()` block. Then use it in both the regular rendering and the accordion.

The key change is in the JSX return (line 581-827). The current code renders ALL groups uniformly. The new code splits rendering:

```tsx
// BEFORE (lines 581-827 — simplified structure):
return (
  <section ref={ref} aria-label="Your benefits" className={`grid ${getGridColsClass()} gap-4`}>
    {benefitGroups.map((group, groupIndex) => (
      <React.Fragment key={`group-${groupIndex}`}>
        {/* Period header */}
        {group.periodKey && (
          <div className="col-span-full ...">
            {/* ... same for __used__ and period groups ... */}
          </div>
        )}

        {/* Cards — same rendering for ALL groups including __used__ */}
        {group.benefits.map((benefit) => {
          // ... 60+ lines of card rendering ...
        })}
      </React.Fragment>
    ))}
  </section>
);

// AFTER:
return (
  <section ref={ref} aria-label="Your benefits" className={`grid ${getGridColsClass()} gap-4`}>
    {benefitGroups.map((group, groupIndex) => {
      // ── Used benefits → delegate to accordion ──
      if (group.periodKey === '__used__') {
        return (
          <UsedBenefitsAccordion
            key="used-benefits-accordion"
            benefits={group.benefits}
            gridColsClass={getGridColsClass()}
            renderCard={(benefit) => {
              const isUsed = benefit.isUsed === true;
              const animIndex = cardAnimationIndices.get(benefit.id) ?? 0;
              const cadenceText = getCadenceInfoText(
                benefit.name,
                benefit.resetCadence as string | undefined,
                benefit.claimingCadence as string | null | undefined
              );

              return (
                <div
                  data-benefit-card
                  onClick={() => onEdit?.(benefit.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEdit?.(benefit.id);
                    }
                  }}
                  className={`rounded-lg border overflow-hidden transition-all duration-200 bg-[var(--color-bg)] hover:border-[var(--color-primary)] flex flex-col cursor-pointer${
                    celebratingIds?.has(benefit.id)
                      ? ' animate-celebrate-used'
                      : ''
                  }`}
                  style={{
                    opacity: 0.85,
                    borderColor:
                      'color-mix(in srgb, var(--color-border) 50%, transparent)',
                    borderLeft: `3px solid ${getLeftBorderColor()}`,
                  }}
                >
                  {/* Card body — identical to current card rendering */}
                  {/* (same JSX as lines 662-820) */}
                  {/* ... full card body here ... */}
                </div>
              );
            }}
          />
        );
      }

      // ── Regular period groups → render as before ──
      return (
        <React.Fragment key={`group-${groupIndex}`}>
          {group.periodKey && (
            <div className="col-span-full ...">
              {/* Period header — Calendar icon, label, cadence */}
            </div>
          )}
          {group.benefits.map((benefit) => {
            // ... existing card rendering (unchanged) ...
          })}
        </React.Fragment>
      );
    })}
  </section>
);
```

**Implementation Note**: To avoid duplicating the 60+ line card JSX, the implementer should extract a `renderCardBody(benefit, isUsed, cadenceText)` helper function that returns the card's inner JSX (rows 1-4). Both the regular rendering path and the `renderCard` prop should call this shared helper.

---

### 9.3 MODIFY: `src/styles/animations.css`

Add before the `/* ── Reduced Motion ── */` section (before line 333):

```css
/* ========================================
   USED BENEFITS ACCORDION (Dashboard Polish)
   ======================================== */
@keyframes usedAccordionExpand {
  from {
    opacity: 0;
    max-height: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    max-height: 2000px;
    transform: translateY(0);
  }
}

@keyframes usedCardReveal {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
  }
  to {
    opacity: 0.85;
    transform: translateY(0) scale(1);
  }
}

.used-accordion-content {
  overflow: hidden;
  animation: usedAccordionExpand var(--used-accordion-expand-duration, 250ms) var(--used-accordion-expand-easing, ease-out) both;
}

.used-card-stagger {
  animation: usedCardReveal 220ms var(--ease-out) both;
}
```

---

### 9.4 MODIFY: `src/styles/design-tokens.css`

Add after the `CAROUSEL COLLAPSE TOKENS` section (after line 239, inside `:root`):

```css
  /* ========================================
     USED BENEFITS ACCORDION TOKENS
     ======================================== */
  --used-accordion-expand-duration: 250ms;
  --used-accordion-collapse-duration: 180ms;
  --used-accordion-expand-easing: cubic-bezier(0.0, 0, 0.2, 1);
  --used-accordion-collapse-easing: cubic-bezier(0.4, 0, 1, 1);
  --used-accordion-stagger-delay: 40ms;
```

Also add inside the `.dark` block, after `--carousel-collapse-easing` (line 345) and before the `/* Missing semantic tokens - Dark Mode */` comment (line 347):

```css
  /* Used Benefits Accordion — same values, no dark overrides needed */
  --used-accordion-expand-duration: 250ms;
  --used-accordion-collapse-duration: 180ms;
  --used-accordion-expand-easing: cubic-bezier(0.0, 0, 0.2, 1);
  --used-accordion-collapse-easing: cubic-bezier(0.4, 0, 1, 1);
  --used-accordion-stagger-delay: 40ms;
```

---

### 9.5 MODIFY: `src/features/benefits/components/index.ts` (barrel file)

The component is imported directly by BenefitsGrid via relative path, so barrel export is **optional**. Add only if other consumers need it:

```typescript
// Grids - default exports
export { default as BenefitsList } from './grids/BenefitsList';
export { default as BenefitsGrid } from './grids/BenefitsGrid';

// Grids - named exports (internal components)
export { UsedBenefitsAccordion } from './grids/UsedBenefitsAccordion';
```

---

## 10. Verification Commands

After implementation, run these commands to verify:

### 10.1 File Existence

```bash
# Verify new component file exists
ls -la src/features/benefits/components/grids/UsedBenefitsAccordion.tsx

# Verify modified files
git diff --name-only
# Expected: BenefitsGrid.tsx, animations.css, design-tokens.css, UsedBenefitsAccordion.tsx
```

### 10.2 Component Integrity

```bash
# Verify component is properly imported in BenefitsGrid
grep -n "UsedBenefitsAccordion" src/features/benefits/components/grids/BenefitsGrid.tsx
# Expected: import line + JSX usage

# Verify accordion renders __used__ group
grep -n "__used__" src/features/benefits/components/grids/BenefitsGrid.tsx
# Expected: condition check that routes to UsedBenefitsAccordion

# Verify ARIA attributes
grep -n "aria-expanded\|aria-controls\|aria-labelledby" src/features/benefits/components/grids/UsedBenefitsAccordion.tsx
# Expected: aria-expanded, aria-controls, aria-labelledby
```

### 10.3 CSS Integrity

```bash
# Verify animation keyframes exist
grep -n "usedAccordionExpand\|usedCardReveal" src/styles/animations.css
# Expected: @keyframes definitions + utility classes

# Verify design tokens exist
grep -n "used-accordion" src/styles/design-tokens.css
# Expected: token definitions in both :root and .dark

# Verify reduced-motion is covered (existing global rule)
grep -n "prefers-reduced-motion" src/styles/animations.css
# Expected: existing media query that covers all animations
```

### 10.4 Build Verification

```bash
# TypeScript compilation check
npx tsc --noEmit 2>&1 | head -50

# Next.js build
npm run build
```

### 10.5 Visual Verification Checklist

| # | Check | Expected Result |
|---|-------|-----------------|
| 1 | Load dashboard with used benefits | Used group shows collapsed accordion bar |
| 2 | Click accordion header | Cards expand with stagger animation |
| 3 | Click again | Cards collapse, chevron rotates back |
| 4 | Check on mobile (375px) | Full-width accordion, stacked cards |
| 5 | Tab to accordion, press Enter | Toggles expand/collapse |
| 6 | Check with 0 used benefits | No accordion renders |
| 7 | Check with 1 used benefit | Accordion shows "(1)", single card |
| 8 | Mark benefit as used | Count increments, card joins accordion |
| 9 | Switch cards | Accordion resets to collapsed |
| 10 | Enable `prefers-reduced-motion` | No animations, instant state changes |
| 11 | Dark mode | Correct colors, tokens adapt |
| 12 | Value captured shows correct $ | Sum of used benefit values |

---

## 11. Implementation Order

1. **Add design tokens** to `design-tokens.css` (both `:root` and `.dark`)
2. **Add keyframes and utility classes** to `animations.css`
3. **Create `UsedBenefitsAccordion.tsx`** component
4. **Extract `renderCardBody` helper** in `BenefitsGrid.tsx` (refactor to avoid duplication)
5. **Route `__used__` group** to `UsedBenefitsAccordion` in BenefitsGrid's JSX
6. **Remove the old `__used__` period header** (the `<div>` with CheckCircle2 at line 598)
7. **Build and type-check** (`npx tsc --noEmit && npm run build`)
8. **Visual QA** against the 12-point checklist above

---

## 12. Future Enhancements (Out of Scope)

These are explicitly **not** part of this spec but noted for future consideration:

- **Persist collapse state** in localStorage (if users request it)
- **Batch "mark all unused" button** in the accordion header
- **Virtual scrolling** for 50+ used benefits (unlikely in practice)
- **Animated counter** on the count badge when it increments
- **Group used benefits by type** within the accordion (travel credits, dining credits, etc.)

---

## Appendix A: Design Decision Log

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| Approach | A) Accordion, B) Stack/pile, C) Virtual scroll | A) Accordion | Matches existing BenefitGroup pattern; simplest; proven UX |
| Default state | Expanded vs Collapsed | Collapsed | Used = low priority; matches PastPeriodsSection precedent |
| State location | Local vs lifted to DashboardPage | Local | Presentation-only concern; resets on card switch naturally |
| Mini-preview icons | Show small icons vs hide | Hide | Visual noise; count + value sufficient; simpler |
| Card rendering | Duplicate JSX vs render prop | Render prop | DRY; single source of truth for card markup |
| Press feedback | scale(0.98) vs scale(0.99) | 0.99 | 0.98 felt too dramatic on mobile testing |
| Stagger cap | No cap vs 8 items vs 12 items | 8 items | 320ms total stagger feels snappy; beyond 8 diminishing returns |
| Collapse animation | CSS max-height vs JS height measurement | CSS max-height | Simpler; matches carousel-collapse-transition precedent |
| Celebration in collapsed | Auto-expand to show vs keep collapsed | Keep collapsed | Toast provides feedback; auto-expand defeats purpose |

---

*Spec authored for implementation handoff. All decisions are final unless new information emerges during implementation.*
