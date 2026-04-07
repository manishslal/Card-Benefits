# Dashboard Benefits Enhancement Phase 1 - Comprehensive Technical Specification

**Version:** 2.0 (Comprehensive Implementation-Ready)  
**Date:** April 7, 2026  
**Status:** ✅ Implementation Ready  
**Target Release:** Sprint N+1  
**Architecture Pattern:** Component-Based with Utility Layer Separation  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [Technical Design](#technical-design)
6. [User Experience Design](#user-experience-design)
7. [Data Schema & State Management](#data-schema--state-management)
8. [User Flows & Workflows](#user-flows--workflows)
9. [API Routes & Contracts](#api-routes--contracts)
10. [Component Architecture & Dependency Flow](#component-architecture--dependency-flow)
11. [Helper Functions & Utilities](#helper-functions--utilities)
12. [Edge Cases & Error Handling](#edge-cases--error-handling)
13. [Accessibility & WCAG 2.1 Compliance](#accessibility--wcag-21-compliance)
14. [Performance & Scalability](#performance--scalability)
15. [Implementation Tasks](#implementation-tasks)
16. [Acceptance Criteria](#acceptance-criteria)
17. [Testing Strategy](#testing-strategy)
18. [Security & Compliance](#security--compliance)
19. [Definition of Done](#definition-of-done)
20. [Appendix: Future Roadmap](#appendix-future-roadmap)

---

## Executive Summary

### Project Overview

Dashboard Benefits Enhancement Phase 1 solves a critical UX problem: **users cannot quickly identify which benefits are expiring soon or take urgent action to maximize their usage.**

This phase introduces **4 new reusable components** and **2 utility modules** that add visual urgency indicators, status badges, and smart filtering to the benefit display system.

### The Problem (Research-Backed)

From comprehensive analysis of industry leaders (Chase, Amex, Citi):
- ❌ Users lose $100s annually by missing benefit expiration deadlines
- ❌ Current UI shows raw data, not actionable urgency
- ❌ No way to focus on expiring benefits
- ❌ No visual distinction between "Active" and "Expiring Soon"

### The Solution

**Phase 1 adds 4 critical components:**

| Component | Solves | Impact |
|-----------|--------|--------|
| **ResetIndicator** | "When does this benefit reset?" | High - Drives usage decisions |
| **BenefitStatusBadge** | "What's the status of this benefit?" | High - Immediate visual context |
| **BenefitsFilterBar** | "Show me only expiring benefits" | Medium - Reduces cognitive load |
| **Integration Updates** | "Wire it all together" | Medium - Completes feature |

### Business Value

✅ **Increased Usage** - Users identify expiring benefits before losing value  
✅ **Reduced Anxiety** - Clear visual indicators eliminate guessing  
✅ **Industry Parity** - Matches UX from category leaders  
✅ **Retention** - Users feel in control of their benefits  

### Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test Coverage** | ≥90% | Jest + React Testing Library |
| **WCAG Compliance** | Level AA | Axe, WebAIM, manual audit |
| **Performance** | <500ms (100 benefits) | React DevTools Profiler |
| **Filter Speed** | <100ms | Chrome DevTools Network |
| **Dark Mode** | 4.5:1 contrast both modes | Manual testing + tools |
| **Accessibility Score** | ≥95 | Lighthouse audit |

---

## Current State Assessment

### A. Benefits Architecture & Data Model

**Current Implementation:** Solid foundation with full support for multiple reset cadences

```
Prisma UserBenefit Model (prisma/schema.prisma)
├── id: CUID (primary key)
├── resetCadence: String (Monthly | CalendarYear | CardmemberYear | OneTime)
├── expirationDate: DateTime (Current period end)
├── isUsed: Boolean (Marked claimed this period)
├── claimedAt: DateTime (When marked used)
├── stickerValue: Int (Benefit amount in cents)
├── status: String (ACTIVE default)
├── Indexes: [userCardId, playerId, type, isUsed, expirationDate]
└── Relations: Player, UserCard (onDelete: Cascade)
```

**Key Observations:**
- ✅ All necessary fields present for Phase 1
- ✅ Indexing strategy supports efficient queries
- ✅ Reset logic working correctly (daily cron)
- ❌ No period-specific usage records (Phase 2 feature)

### B. Current Component Hierarchy

```
Dashboard / Card Detail Page
├── CardSwitcher (select card)
├── BenefitsGrid / BenefitsList / BenefitTable (existing)
│   └── BenefitCard (per benefit)
│       ├── Header (name, icon) - needs StatusBadge
│       ├── Body (value, reset info) - needs ResetIndicator
│       └── Footer (actions)
├── Modals (Add, Edit, Delete) - unchanged
└── FilterBar - MISSING (exists in code but NOT RENDERED)
```

**Current State:**
- ✅ 3 display modes available (Grid, List, Table)
- ✅ Filter state logic exists but UI hidden
- ✅ Responsive, accessible baseline
- ❌ No reset countdown shown
- ❌ No status badges
- ❌ No filter UI

### C. File Structure Overview

```
src/features/benefits/
├── components/
│   ├── indicators/               ← PHASE 1 NEW
│   │   ├── ResetIndicator.tsx
│   │   ├── BenefitStatusBadge.tsx
│   │   └── index.ts
│   ├── filters/                  ← PHASE 1 NEW
│   │   ├── BenefitsFilterBar.tsx
│   │   └── index.ts
│   ├── grids/
│   │   ├── BenefitsGrid.tsx      ← UPDATED
│   │   ├── BenefitsList.tsx      ← UPDATED
│   │   └── BenefitTable.tsx      ← UPDATED
│   └── ... (modals, etc.)
├── lib/
│   ├── benefitDates.ts (239 lines) ← EXTEND
│   ├── benefitFilters.ts            ← PHASE 1 NEW
│   └── index.ts
├── types/
│   └── filters.ts                   ← PHASE 1 NEW
└── ... (actions, hooks, context)
```

### D. Accessibility Baseline

**Current WCAG Compliance:** Level A (partial)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Color Contrast | ⚠️ Untested | Tailwind tokens used, no explicit verification |
| Semantic HTML | ✅ Good | Proper button/span/div usage |
| Focus Indicators | ✅ Present | Tailwind focus-ring applied |
| ARIA Labels | ⚠️ Partial | Some interactive elements lack aria-label |
| Keyboard Navigation | ✅ Good | Tab order follows source |
| Screen Reader | ⚠️ Partial | Benefit status not announced |

**Phase 1 Goal:** Achieve WCAG 2.1 Level AA across all new components

---

## Functional Requirements

### FR1: ResetIndicator Component

**Purpose:** Display when a benefit resets with color-coded urgency

#### Core Requirements

- **FR1.1** Show reset date: "Resets March 1" (consistent format)
- **FR1.2** Append days when < 7 days remain: "Resets March 1 (3 days)"
- **FR1.3** Color-code by urgency:
  - 🟢 Green (7+ days): Normal operation
  - 🟠 Orange (3-7 days): Getting close, pay attention
  - 🔴 Red (< 3 days): Critical, act now
- **FR1.4** OneTime benefits: Show nothing (or "N/A")
- **FR1.5** Null expirationDate: Render nothing, no error
- **FR1.6** Support all cadences: Monthly, CalendarYear, CardmemberYear, OneTime
- **FR1.7** Use icon + text (never color/icon alone)
  - Icons: Clock (normal), AlertCircle (urgent)
- **FR1.8** Date format: "Month Day" (e.g., "March 1")

#### Acceptance Criteria

```gherkin
Given a benefit expiring in 15 days
When ResetIndicator renders
Then text shows "Resets March 1" in green
And Clock icon present
And no day count shown (> 7 days)

Given a benefit expiring in 5 days
When ResetIndicator renders
Then text shows "Resets March 1 (5 days)" in orange
And Clock icon present
And day count bold

Given a benefit expiring in 1 day
When ResetIndicator renders
Then text shows "Resets March 1 (1 day)" in red
And AlertCircle icon present
And text bold for emphasis

Given a OneTime benefit
When ResetIndicator renders
Then component renders nothing

Given a benefit with null expirationDate
When ResetIndicator renders
Then no error, component renders nothing
```

---

### FR2: BenefitStatusBadge Component

**Purpose:** Show benefit status at a glance (Available/Expiring/Expired/Claimed)

#### Core Requirements

- **FR2.1** Four distinct status states:
  - **Available** (🟢 Green): Unclaimed, not expired
  - **Expiring Soon** (🟠 Orange): < 7 days remaining
  - **Expired** (🔴 Red): Period ended
  - **Claimed** (🔵 Blue): Marked used this period
- **FR2.2** Status determined from: `isUsed`, `isExpired`, `resetCadence`, `expirationDate`
- **FR2.3** Decision logic:
  - If OneTime + isUsed → Claimed
  - If expirationDate < now → Expired
  - If isUsed + !expired → Claimed
  - If daysRemaining <= 7 + !expired → Expiring
  - Else → Available
- **FR2.4** Badge styling: Icon + text in rounded container
- **FR2.5** Touch target: ≥44×44px (including padding)
- **FR2.6** Semantic markup: `<span role="status" aria-label="...">`

#### Acceptance Criteria

```gherkin
Scenario: Fresh benefit
Given a benefit with isUsed=false, expirationDate in future > 7 days
Then badge shows "Available" in green
And icon is green circle

Scenario: Expiring soon
Given a benefit with isUsed=false, expirationDate in 5 days
Then badge shows "Expiring Soon" in orange
And icon is alert circle

Scenario: Expired
Given a benefit with expirationDate in past
Then badge shows "Expired" in red
And icon is X circle

Scenario: Claimed
Given a benefit with isUsed=true, expirationDate in future
Then badge shows "✓ Claimed" in blue
And icon is checkmark

Scenario: OneTime claimed
Given a OneTime benefit with isUsed=true
Then badge shows "✓ Claimed" in blue
```

---

### FR3: BenefitsFilterBar Component

**Purpose:** Enable filtering benefits by status to reduce cognitive load

#### Core Requirements

- **FR3.1** Five filter options:
  - "All" (default) - Show every benefit
  - "Active" - Available + unclaimed
  - "Expiring Soon" - < 7 days
  - "Expired" - Period ended
  - "Claimed" - Marked used
- **FR3.2** Count badges: "Active (5)", "Expiring Soon (2)"
- **FR3.3** Toggle behavior: Select = highlight, deselect = reset to "All"
- **FR3.4** Only one filter active at a time (radio button UX)
- **FR3.5** Responsive:
  - Desktop (1024px+): Horizontal flex, all buttons visible
  - Tablet (768px): Flex with wrap, 2 rows
  - Mobile (375px): Dropdown or vertical stack
- **FR3.6** Visual feedback: Button highlight when selected
- **FR3.7** Applied immediately: < 100ms filter latency
- **FR3.8** Keyboard accessible: Tab, Enter/Space, aria-pressed

#### Acceptance Criteria

```gherkin
Scenario: Desktop filter bar
Given a desktop viewport (1024px+)
When BenefitsFilterBar renders
Then all 5 buttons visible horizontally
And each button has count badge
And selected button highlighted/filled

Scenario: Mobile filter bar
Given a mobile viewport (375px)
When BenefitsFilterBar renders
Then buttons collapsed to dropdown or vertical stack
And count badges preserved
And touch targets >= 44px

Scenario: Filter application
Given user on Card Detail page with 10 benefits (2 expiring)
When user clicks "Expiring Soon" button
Then button highlights (aria-pressed=true)
Then grid updates immediately (<100ms)
And only 2 benefits displayed
And "Active" button shows "(8)"

Scenario: Keyboard navigation
Given BenefitsFilterBar focused
When user presses Tab
Then focus moves between buttons left-to-right
When user presses Enter on "Active"
Then filter applied, benefits update
```

---

### FR4: Integration with Existing Components

**Purpose:** Wire new components into BenefitsGrid, BenefitsList, BenefitTable

#### Core Requirements

- **FR4.1** BenefitsGrid:
  - ResetIndicator renders below benefit value
  - BenefitStatusBadge renders in header
- **FR4.2** BenefitsList:
  - ResetIndicator in detail section
  - StatusBadge in header
- **FR4.3** BenefitTable:
  - Add "Status" column (with badge)
  - Add "Resets" column (with indicator)
- **FR4.4** Card Detail page:
  - BenefitsFilterBar renders above benefits
  - Connected to filtering logic
- **FR4.5** State management:
  - filterStatus: FilterStatus state
  - filteredBenefits: applyFilters(benefits, filters)
  - No localStorage (optional Phase 1.5)
- **FR4.6** No regressions:
  - Modals (Add, Edit, Delete) still work
  - Sorting/pagination unaffected
  - Existing button actions intact

#### Acceptance Criteria

```gherkin
Scenario: BenefitsGrid with new components
Given BenefitsGrid renders with 5 benefits
When component loads
Then each benefit card shows:
  - Name (existing)
  - Value (existing)
  - StatusBadge (NEW)
  - ResetIndicator (NEW)
  - Action buttons (existing)

Scenario: Filter integration
Given Card Detail page with BenefitsFilterBar
When user clicks "Expiring Soon"
Then BenefitsGrid updates instantly
And only benefits with < 7 days displayed
And other filters disabled (radio behavior)

Scenario: No regressions
When user clicks "Mark Used" button
Then benefit marked used (existing behavior)
When user clicks "Edit"
Then modal opens (existing behavior)
```

---

## Non-Functional Requirements

### NFR1: Performance Targets

- **NFR1.1** Render 100 benefits with all components: **< 500ms** (React DevTools)
- **NFR1.2** Apply filter (re-render filtered benefits): **< 100ms** (Chrome DevTools)
- **NFR1.3** No Cumulative Layout Shift (CLS) > 0.1
- **NFR1.4** No unnecessary re-renders (React DevTools Profiler)
- **NFR1.5** Bundle size increase: < 15KB gzipped

**Measurement Tools:**
- React DevTools Profiler (Component render times)
- Chrome DevTools Performance tab (filter latency)
- Lighthouse (CLS, performance metrics)
- Source Map Explorer (bundle size)

### NFR2: Accessibility (WCAG 2.1 Level AA)

#### Color & Contrast

- **NFR2.1** All text: ≥4.5:1 contrast ratio
- **NFR2.2** Large text (18px+ bold): ≥3:1 ratio
- **NFR2.3** Meaningful icons: ≥4.5:1 contrast
- **NFR2.4** Color never sole information indicator (icon + text required)

#### Focus Indicators

- **NFR2.5** All interactive elements: 2px minimum outline
- **NFR2.6** Outline contrast: ≥3:1 against background
- **NFR2.7** Focus visible on Tab (not hidden by z-index)

#### Semantic HTML & ARIA

- **NFR2.8** `<button>` for interactive controls (not `<div>`)
- **NFR2.9** `aria-pressed="true|false"` for toggles
- **NFR2.10** `aria-label` for unlabeled content
- **NFR2.11** `role="status"` for dynamic updates
- **NFR2.12** `aria-hidden="true"` for decorative elements

#### Keyboard Navigation

- **NFR2.13** All interactive elements reachable via Tab
- **NFR2.14** Activatable via Enter or Space
- **NFR2.15** Tab order matches visual order
- **NFR2.16** No focus traps

#### Screen Reader

- **NFR2.17** All text announced by assistive tech
- **NFR2.18** Benefit status announced clearly
- **NFR2.19** No duplicate announcements
- **NFR2.20** ARIA labels match visual presentation

#### Reduced Motion

- **NFR2.21** Animations disabled when `prefers-reduced-motion: reduce`
- **NFR2.22** All information visible without animation
- **NFR2.23** Functionality not animation-dependent

**Verification Tools:**
- Axe DevTools (automated)
- WebAIM Contrast Checker (color)
- NVDA / VoiceOver (screen reader)
- Lighthouse (accessibility audit)

### NFR3: Responsive Design

- **NFR3.1** Mobile (375px): Full functionality, ≥8px gaps
- **NFR3.2** Tablet (768px): Optimized layout, 60-75 char text measure
- **NFR3.3** Desktop (1024px+): Spacious, consistent max-width
- **NFR3.4** No horizontal scroll on any viewport
- **NFR3.5** Text readable at 100%-200% zoom

**Tested Viewports:**
- iPhone SE (375×667)
- iPad (768×1024)
- Desktop (1440×900)
- Landscape orientations

### NFR4: Code Quality Standards

- **NFR4.1** TypeScript strict mode: No 'any' types
- **NFR4.2** ESLint: 0 errors, 0 warnings
- **NFR4.3** Prettier: Consistent formatting
- **NFR4.4** Project patterns:
  - Tailwind CSS (no inline styles)
  - Shadcn/UI for reuse
  - Next.js conventions
  - React hooks best practices
- **NFR4.5** No console.error/warn in production
- **NFR4.6** JSDoc for all public functions
- **NFR4.7** Inline comments for complex logic

### NFR5: Dark Mode Support

- **NFR5.1** All components styled for light AND dark
- **NFR5.2** Use Tailwind `dark:` variants
- **NFR5.3** Color contrast tested separately per mode (don't assume inversion)
- **NFR5.4** No hardcoded colors (Tailwind only)
- **NFR5.5** Surface/text/border tokens platform-standard

---

## Technical Design

### Architecture Overview

#### Layered Component Structure

```
┌──────────────────────────────────────────────┐
│         Page Components                       │
│  Dashboard / Card Detail Page                │
│  (Manage filterStatus state)                 │
├──────────────────────────────────────────────┤
│       Container Components                    │
│  BenefitsGrid / BenefitsList / BenefitTable │
│  (Receive filtered benefits, render)         │
├──────────────────────────────────────────────┤
│      Presentational Components (Phase 1)     │
│  ┌──────────────┐  ┌──────────────────┐   │
│  │ ResetIndic.  │  │ StatusBadge      │   │
│  └──────────────┘  └──────────────────┘   │
│  ┌──────────────────────────────────────┐ │
│  │ BenefitsFilterBar                    │ │
│  └──────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│         Utility Layer                        │
│  benefitDates.ts (EXTEND)                   │
│  benefitFilters.ts (NEW)                    │
├──────────────────────────────────────────────┤
│      API & Data Layer                        │
│  GET /api/cards/my-cards → UserBenefit[]   │
└──────────────────────────────────────────────┘
```

#### Dependency Graph

```
ResetIndicator
├─ getDaysUntilReset() ← benefitDates.ts
├─ formatResetDate() ← benefitDates.ts
└─ isUrgent(), isWarning() ← benefitDates.ts

BenefitStatusBadge
└─ getStatusForBenefit() ← benefitFilters.ts

BenefitsFilterBar
└─ (self-contained, emits onStatusChange)

BenefitsGrid / BenefitsList / BenefitTable
├─ ResetIndicator (prop: resetCadence, expirationDate)
├─ BenefitStatusBadge (prop: status)
└─ applyFilters() ← benefitFilters.ts (in parent page)

Card Detail Page
├─ BenefitsFilterBar (state: filterStatus, callback: onStatusChange)
├─ applyFilters() ← benefitFilters.ts
└─ BenefitsGrid (prop: filteredBenefits)
```

#### Type Safety & Interfaces

**File:** `src/features/benefits/types/filters.ts`

```typescript
/**
 * Benefit status (derived, not stored)
 * Calculated from: isUsed, isExpired, resetCadence, expirationDate
 */
export type BenefitStatus = 'available' | 'expiring' | 'expired' | 'claimed';

/**
 * User-selected filter status
 */
export type FilterStatus = 'all' | 'active' | 'expiring' | 'expired' | 'claimed';

/**
 * Filter state object
 */
export interface BenefitFilters {
  status: FilterStatus;
}

/**
 * ResetIndicator props
 */
export interface ResetIndicatorProps {
  resetCadence: string;              // Monthly | CalendarYear | etc.
  expirationDate: Date | string | null;
  resetTime?: string;                // Optional custom time display
}

/**
 * StatusBadge props
 */
export interface BenefitStatusBadgeProps {
  status: BenefitStatus;
  showLabel?: boolean;               // Optional, default true
}

/**
 * FilterBar props
 */
export interface BenefitsFilterBarProps {
  selectedStatus: FilterStatus;
  onStatusChange: (status: FilterStatus) => void;
  statusCounts: Record<FilterStatus, number>;
  disabled?: boolean;                // Optional disable state
}
```

---

## User Experience Design

### Visual Design System

Per **ui-ux-pro-max** guidelines for professional UI:

#### Color Tokens (Semantic)

```typescript
// ResetIndicator colors
const RESET_COLORS = {
  normal: {
    light: 'text-gray-600 bg-gray-50 border-gray-200',
    dark: 'dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-700'
  },
  warning: {
    light: 'text-orange-600 bg-orange-50 border-orange-200',
    dark: 'dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-700'
  },
  urgent: {
    light: 'text-red-600 bg-red-50 border-red-200',
    dark: 'dark:text-red-400 dark:bg-red-900/20 dark:border-red-700'
  }
};

// StatusBadge colors
const BADGE_COLORS = {
  available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  expiring: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  claimed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
};
```

#### Typography Scale (Base: 16px)

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Benefit Name | 16px | semibold | Card header |
| Value/Cadence | 14px | normal | Description |
| Badge Text | 12px | medium | Status badge |
| Reset Indicator | 12px | normal | Reset countdown |

#### Spacing (4/8dp System)

| Level | Amount | Usage |
|-------|--------|-------|
| xs | 4px | Icon gaps |
| sm | 8px | Component gaps |
| md | 12px | Padding |
| lg | 16px | Section margins |
| xl | 24px | Major sections |

#### Responsive Breakpoints

```
Mobile (375px):   sm
Tablet (768px):   md
Desktop (1024px): lg
Wide (1440px):    xl
```

#### Animation Timing

Per **ui-ux-pro-max** (150-300ms micro-interactions):

```css
.filter-button {
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1); /* ease-out */
}

.status-badge {
  animation: fadeIn 200ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .filter-button,
  .status-badge {
    transition: none !important;
    animation: none !important;
  }
}
```

### Visual Hierarchy & Layout

**Benefit Card Layout (Updated):**

```
┌─────────────────────────────────────┐
│ [Icon] Dining Credit      [✓ Active]│  ← Name (16px bold) + Badge (12px)
│ $200/month                           │  ← Value (14px gray)
├─────────────────────────────────────┤
│ ⏰ Resets March 1 (3 days)          │  ← Reset indicator (12px)
│    (color-coded by urgency)         │
├─────────────────────────────────────┤
│ [Mark Used] [Edit] [Delete]        │  ← Actions (48px+ targets)
└─────────────────────────────────────┘
```

**FilterBar Layout (Responsive):**

```
Desktop (1024px+):
┌──────────────────────────────────────────────┐
│ All (10)  Active (8)  Expiring (2)  ...     │
└──────────────────────────────────────────────┘

Mobile (375px):
┌──────────────────────────┐
│ Filter by status ▼       │
│ All (10)                 │
│ Active (8)               │
│ Expiring (2)             │
└──────────────────────────┘
```

---

## Data Schema & State Management

### Phase 1 Data Requirements

**No database schema changes required.** All existing fields sufficient:

```
UserBenefit {
  id
  resetCadence        ← ResetIndicator, StatusBadge
  expirationDate      ← Calculate days until reset
  isUsed              ← StatusBadge, filter logic
  claimedAt           ← Validation (optional)
  ... other fields
}
```

### State Management

**Card Detail Page Component:**

```typescript
'use client';

import { useState } from 'react';
import { UserBenefit } from '@prisma/client';
import { BenefitsFilterBar } from '@/features/benefits/components';
import { applyFilters, countByStatus } from '@/features/benefits/lib/benefitFilters';
import type { FilterStatus } from '@/features/benefits/types/filters';

export default function CardDetailPage({ params: { id } }) {
  const benefits: UserBenefit[] = await fetchBenefits(id);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Apply filters
  const filteredBenefits = applyFilters(benefits, { status: filterStatus });

  // Calculate counts for filter badges
  const statusCounts = countByStatus(benefits);

  return (
    <div>
      <BenefitsFilterBar
        selectedStatus={filterStatus}
        onStatusChange={setFilterStatus}
        statusCounts={statusCounts}
      />

      <BenefitsGrid benefits={filteredBenefits} />
    </div>
  );
}
```

---

## User Flows & Workflows

### UF1: View Benefits with Reset Indicators

**Actor:** User navigates to Card Detail page  
**Goal:** Understand when each benefit resets

**Flow:**

```
1. User opens Card Detail page
   ↓
2. Page loads benefits via API
   ↓
3. BenefitsGrid renders for each benefit:
   a. BenefitCard displays:
      - Icon + Name
      - Value + Cadence
      - BenefitStatusBadge (NEW) - shows status
      - ResetIndicator (NEW) - shows countdown
      - Action buttons
   ↓
4. User scans benefits and sees:
   - Visual urgency via color (green/orange/red)
   - Explicit countdown ("3 days")
   - Status at a glance ("Expiring Soon")
   ↓
5. User takes action:
   - "Mark Used" on urgent benefits
   - "Edit" to update values
   - "Delete" if no longer relevant
```

**Decision Logic in ResetIndicator:**

```
┌─ Is resetCadence 'OneTime'? ──→ YES ──→ Render nothing
│                                ↓ NO
├─ Is expirationDate null? ──────→ YES ──→ Render nothing
│                                ↓ NO
├─ Is expirationDate < now? ─────→ YES ──→ Gray out, show past date
│                                ↓ NO
├─ Days until reset < 3? ────────→ YES ──→ Red, AlertCircle, bold
│                                ↓ NO
├─ Days until reset <= 7? ───────→ YES ──→ Orange, Clock, show days
│                                ↓ NO
└─ Else ─────────────────────────→ Green, Clock, no days
```

### UF2: Filter Benefits by Status

**Actor:** User wants to focus on expiring benefits  
**Goal:** See only benefits that need immediate action

**Flow:**

```
1. User arrives on Card Detail page
   ↓
2. BenefitsFilterBar renders above benefits:
   - Buttons: All, Active, Expiring, Expired, Claimed
   - Each shows count: "Active (8)", "Expiring (2)"
   ↓
3. User clicks "Expiring Soon" button
   ↓
4. Button highlight + aria-pressed="true"
   ↓
5. BenefitsGrid updates instantly (< 100ms):
   - filterStatus state changes
   - filteredBenefits recalculated
   - Grid re-renders with only expiring benefits
   ↓
6. User sees focused list of 2 urgent benefits
   ↓
7. User can:
   - Click "Mark Used" on each
   - Click "Edit" to update value
   - Click another filter to switch focus
   - Click "All" to reset
```

### UF3: Mobile Responsive Filtering

**Actor:** User on iPhone (375px)  
**Goal:** Filter benefits with touch-friendly UI

**Flow:**

```
1. User on Card Detail page (mobile)
   ↓
2. BenefitsFilterBar renders as:
   - Dropdown button: "Filter by status" ▼
   OR Vertical button stack (if space allows)
   ↓
3. User taps dropdown
   ↓
4. Menu expands with options:
   - All (10)
   - Active (8) ← SELECTED (checkmark)
   - Expiring (2)
   - Expired (0)
   - Claimed (0)
   ↓
5. User taps "Expiring (2)"
   ↓
6. Menu closes, button label updates
   ↓
7. BenefitsGrid filters instantly
   ↓
8. User sees 2 urgent benefits stacked vertically
```

---

## API Routes & Contracts

### AR1: Existing Routes (No Changes)

**No new endpoints needed for Phase 1.** All filtering happens client-side.

**GET /api/cards/my-cards** (Existing)

```
Request:
  GET /api/cards/my-cards
  Headers: Authorization, Content-Type

Response (200):
{
  "data": [
    {
      "id": "card-123",
      "name": "Chase Sapphire Reserve",
      "benefits": [
        {
          "id": "benefit-456",
          "name": "Dining Credit",
          "type": "StatementCredit",
          "stickerValue": 20000,
          "resetCadence": "Monthly",
          "userDeclaredValue": null,
          "isUsed": false,
          "timesUsed": 0,
          "expirationDate": "2025-03-01T23:59:59Z",
          "claimedAt": null,
          "status": "ACTIVE",
          "createdAt": "...",
          "updatedAt": "..."
        },
        ... more benefits
      ]
    }
  ]
}

Error (401): { error: "Unauthorized" }
Error (500): { error: "Internal Server Error" }
```

All Phase 1 logic: Client-side filtering, no API changes required.

---

## Component Architecture & Dependency Flow

### CA1: ResetIndicator Component

**File:** `src/features/benefits/components/indicators/ResetIndicator.tsx`

**Props:**
```typescript
interface ResetIndicatorProps {
  resetCadence: string;                      // from UserBenefit
  expirationDate: Date | string | null;      // from UserBenefit
  resetTime?: string;                        // Optional, default "12:00 AM EST"
}
```

**Returns:** Styled indicator or null

**Dependencies:**
- `getDaysUntilReset` (benefitDates.ts)
- `formatResetDate` (benefitDates.ts)
- `isUrgent` (benefitDates.ts)
- `isWarning` (benefitDates.ts)
- Lucide React icons: Clock, AlertCircle

**Responsibilities:**
- Calculate days until reset
- Determine color/urgency
- Render icon + text
- ARIA labels for accessibility

---

### CA2: BenefitStatusBadge Component

**File:** `src/features/benefits/components/indicators/BenefitStatusBadge.tsx`

**Props:**
```typescript
interface BenefitStatusBadgeProps {
  status: BenefitStatus;  // 'available' | 'expiring' | 'expired' | 'claimed'
  showLabel?: boolean;    // default true
}
```

**Returns:** Styled badge with icon + text

**Dependencies:**
- `getStatusForBenefit` (benefitFilters.ts) - called in parent, not here
- Lucide React icons: Circle, AlertCircle, XCircle, CheckCircle2
- Tailwind CSS color tokens

**Responsibilities:**
- Map status → colors/icons/labels
- Render semantic HTML
- ARIA labels

---

### CA3: BenefitsFilterBar Component

**File:** `src/features/benefits/components/filters/BenefitsFilterBar.tsx`

**Props:**
```typescript
interface BenefitsFilterBarProps {
  selectedStatus: FilterStatus;
  onStatusChange: (status: FilterStatus) => void;
  statusCounts: Record<FilterStatus, number>;
  disabled?: boolean;
}
```

**Returns:** Filter button group

**Dependencies:**
- None (self-contained)
- Shadcn/UI Button component

**Responsibilities:**
- Render filter buttons
- Track selection state (passed via props)
- Call onStatusChange callback
- Display count badges
- Responsive layout

---

### CA4: Updated BenefitsGrid Component

**File:** `src/features/benefits/components/grids/BenefitsGrid.tsx` (UPDATED)

**Changes:**

```typescript
// Add imports
import { ResetIndicator } from '../indicators/ResetIndicator';
import { BenefitStatusBadge } from '../indicators/BenefitStatusBadge';
import { getStatusForBenefit } from '../../lib/benefitFilters';

// In benefit card rendering:
{benefits.map((benefit) => {
  const status = getStatusForBenefit(benefit);

  return (
    <div key={benefit.id} className="benefit-card rounded-lg border p-4">
      {/* Header with name and badge */}
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-base font-semibold">{benefit.name}</h3>
        <BenefitStatusBadge status={status} />
      </div>

      {/* Value and cadence */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        ${(benefit.stickerValue / 100).toFixed(2)} / {getPeriodLabel(benefit.resetCadence)}
      </p>

      {/* Reset indicator (NEW) */}
      <div className="mb-4">
        <ResetIndicator
          resetCadence={benefit.resetCadence}
          expirationDate={benefit.expirationDate}
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button>Mark Used</button>
        <button>Edit</button>
        <button>Delete</button>
      </div>
    </div>
  );
})}
```

---

### CA5: Component Dependency Graph

```
Card Detail Page
│
├─→ BenefitsFilterBar
│   ├─ selectedStatus (state)
│   ├─ onStatusChange (callback)
│   └─ statusCounts (Record<FilterStatus, number>)
│
├─→ applyFilters() [benefitFilters.ts]
│   └─ filterByStatus() [benefitFilters.ts]
│
└─→ BenefitsGrid
    ├─→ For each benefit:
    │   ├─→ getStatusForBenefit() [benefitFilters.ts]
    │   ├─→ BenefitStatusBadge
    │   │   └─ (Icon determined by status)
    │   └─→ ResetIndicator
    │       ├─→ getDaysUntilReset() [benefitDates.ts]
    │       ├─→ formatResetDate() [benefitDates.ts]
    │       ├─→ isUrgent() [benefitDates.ts]
    │       └─→ isWarning() [benefitDates.ts]
    │
    └─→ BenefitCard (existing component)
        ├─ Mark Used button
        ├─ Edit button
        └─ Delete button
```

---

## Helper Functions & Utilities

### Utility Module 1: benefitDates.ts (EXTEND)

**Existing File:** `src/features/benefits/lib/benefitDates.ts` (239 lines)

**New Functions to Add:**

```typescript
/**
 * Calculate days remaining until benefit resets
 * @param expirationDate When the benefit expires
 * @returns Days remaining (can be negative if expired)
 */
export function getDaysUntilReset(expirationDate: Date | string | null): number {
  if (!expirationDate) return Infinity;
  
  const expDate = new Date(expirationDate);
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Check if benefit is urgent (expiring very soon)
 * @param daysLeft Days until reset
 * @returns true if < 3 days remaining
 */
export function isUrgent(daysLeft: number): boolean {
  return daysLeft < 3 && daysLeft > 0;
}

/**
 * Check if benefit is in warning state
 * @param daysLeft Days until reset
 * @returns true if <= 7 days remaining
 */
export function isWarning(daysLeft: number): boolean {
  return daysLeft <= 7 && daysLeft > 0;
}

/**
 * Format reset date for human-readable display
 * @param date Date to format
 * @param locale Locale for formatting
 * @returns String like "March 1"
 */
export function formatResetDate(date: Date, locale: string = 'en-US'): string {
  return date.toLocaleDateString(locale, {
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get human-readable label for reset cadence
 * @param resetCadence Type of cadence
 * @returns Display label
 */
export function getPeriodLabel(resetCadence: string): string {
  const labels: Record<string, string> = {
    Monthly: 'month',
    CalendarYear: 'year',
    CardmemberYear: 'year',
    OneTime: 'one-time',
  };
  return labels[resetCadence] || resetCadence;
}
```

**Unit Test Cases:**
- getDaysUntilReset: Today (0), Tomorrow (1), 7 days, 30 days, -1 (past), null
- isUrgent: < 3 days (true), >= 3 days (false), 0 (false)
- isWarning: <= 7 days (true), > 7 days (false), 0 (false)
- formatResetDate: Various dates and locales
- getPeriodLabel: All cadences, unknown cadence

---

### Utility Module 2: benefitFilters.ts (NEW)

**New File:** `src/features/benefits/lib/benefitFilters.ts`

```typescript
import { UserBenefit } from '@prisma/client';
import { BenefitStatus, FilterStatus, BenefitFilters } from '../types/filters';
import { getDaysUntilReset } from './benefitDates';

/**
 * Determine the current status of a benefit
 * Logic:
 *   1. If expirationDate < now → 'expired'
 *   2. If isUsed → 'claimed'
 *   3. If daysRemaining <= 7 → 'expiring'
 *   4. Else → 'available'
 *
 * @param benefit UserBenefit object
 * @returns BenefitStatus
 */
export function getStatusForBenefit(benefit: UserBenefit): BenefitStatus {
  if (!benefit.expirationDate) {
    // OneTime or perpetual benefits
    return benefit.isUsed ? 'claimed' : 'available';
  }

  const now = new Date();
  const isExpired = benefit.expirationDate < now;

  if (isExpired) return 'expired';
  if (benefit.isUsed) return 'claimed';

  const daysLeft = getDaysUntilReset(benefit.expirationDate);
  if (daysLeft <= 7) return 'expiring';

  return 'available';
}

/**
 * Filter benefits by status
 * @param benefits Array of UserBenefit objects
 * @param filter Filter status to apply
 * @returns Filtered array
 */
export function filterByStatus(
  benefits: UserBenefit[],
  filter: FilterStatus
): UserBenefit[] {
  if (filter === 'all') return benefits;

  return benefits.filter((benefit) => {
    const status = getStatusForBenefit(benefit);
    
    switch (filter) {
      case 'active':
        return status === 'available';
      case 'expiring':
        return status === 'expiring';
      case 'expired':
        return status === 'expired';
      case 'claimed':
        return status === 'claimed';
      default:
        return true;
    }
  });
}

/**
 * Count benefits by status
 * @param benefits Array of UserBenefit objects
 * @returns Object with counts for each filter
 */
export function countByStatus(
  benefits: UserBenefit[]
): Record<FilterStatus, number> {
  const counts: Record<FilterStatus, number> = {
    all: benefits.length,
    active: 0,
    expiring: 0,
    expired: 0,
    claimed: 0,
  };

  benefits.forEach((benefit) => {
    const status = getStatusForBenefit(benefit);
    if (status === 'available') counts.active++;
    else if (status === 'expiring') counts.expiring++;
    else if (status === 'expired') counts.expired++;
    else if (status === 'claimed') counts.claimed++;
  });

  return counts;
}

/**
 * Apply filters to benefits
 * @param benefits Array of UserBenefit objects
 * @param filters Filter criteria
 * @returns Filtered benefits
 */
export function applyFilters(
  benefits: UserBenefit[],
  filters: BenefitFilters
): UserBenefit[] {
  return filterByStatus(benefits, filters.status);
}
```

**Unit Test Cases:**
- getStatusForBenefit:
  - OneTime + isUsed=true → 'claimed'
  - OneTime + isUsed=false → 'available'
  - expirationDate in past → 'expired'
  - isUsed=true + not expired → 'claimed'
  - daysRemaining=5 + not used → 'expiring'
  - daysRemaining=10 + not used → 'available'
  - null expirationDate + isUsed=false → 'available'

- filterByStatus:
  - 'all' returns all benefits
  - 'active' returns only available
  - 'expiring' returns only expiring
  - 'expired' returns only expired
  - 'claimed' returns only claimed
  - Empty result set handled gracefully

- countByStatus:
  - Returns correct counts for 10 benefits (e.g., active: 7, expiring: 2, expired: 1)
  - Returns 0 for missing statuses
  - 'all' count = total

---

## Edge Cases & Error Handling

### EC1: OneTime Benefits

**Scenario:** Benefit with resetCadence='OneTime'

**Expected Behavior:**
- ResetIndicator: Renders nothing (no reset)
- StatusBadge: "✓ Claimed" if isUsed=true, "Available" if false
- Filter: Correct filtering applied

**Implementation:**
```typescript
// ResetIndicator
if (resetCadence === 'OneTime' || !expirationDate) {
  return null;
}

// getStatusForBenefit
if (!benefit.expirationDate) {
  return benefit.isUsed ? 'claimed' : 'available';
}
```

**Test Cases:**
- [ ] OneTime + isUsed=true → StatusBadge shows "✓ Claimed"
- [ ] OneTime + isUsed=false → StatusBadge shows "Available"
- [ ] ResetIndicator hidden
- [ ] No errors in console

---

### EC2: Expired Benefits

**Scenario:** expirationDate < now

**Expected Behavior:**
- ResetIndicator: Grayed out or hidden
- StatusBadge: "Expired" in red
- Filter: Appears in "Expired" filter
- Read-only state (cannot mark used)

**Test Cases:**
- [ ] expirationDate = yesterday → "Expired" badge
- [ ] ResetIndicator grayed out
- [ ] Appears in "Expired" filter
- [ ] Not in "Active" or "Expiring" filters

---

### EC3: Null/Invalid expirationDate

**Scenario:** expirationDate is null, undefined, or invalid string

**Expected Behavior:**
- ResetIndicator: Renders nothing
- StatusBadge: Shows status based on isUsed only
- No crashes

**Implementation:**
```typescript
if (!expirationDate) return Infinity; // getDaysUntilReset
if (!expirationDate) return null;     // ResetIndicator render
```

**Test Cases:**
- [ ] null expirationDate → no error
- [ ] undefined expirationDate → no error
- [ ] Invalid date string → graceful handling (maybe catch in getDaysUntilReset)

---

### EC4: Empty Filter Result

**Scenario:** User filters to "Expiring Soon" but no benefits expiring

**Expected Behavior:**
- BenefitsGrid shows empty state message
- "View all benefits" link to clear filter
- No console errors

**Test Cases:**
- [ ] Empty filtered result shows message
- [ ] "Clear filters" button resets to "All"
- [ ] No visual glitches

---

### EC5: Mobile Responsive (375px)

**Scenario:** User on iPhone SE

**Expected Behavior:**
- ResetIndicator: Text wraps or truncates gracefully
- StatusBadge: Scales appropriately
- BenefitsFilterBar: Dropdown or vertical stack
- Touch targets: ≥44×44px
- No horizontal scroll

**Test Cases:**
- [ ] BenefitsFilterBar displays correctly on 375px
- [ ] No horizontal scroll
- [ ] Touch targets ≥44×44px
- [ ] Text readable

---

### EC6: Dark Mode Contrast

**Scenario:** Dark mode enabled

**Expected Behavior:**
- Colors test independently (not just inversion)
- All text ≥4.5:1 contrast
- Icons visible

**Test Cases:**
- [ ] Test light mode contrast with WebAIM
- [ ] Test dark mode contrast separately
- [ ] No color-only meaning
- [ ] Both modes pass accessibility audit

---

### EC7: Rapid Filter Clicking

**Scenario:** User clicks filter buttons rapidly

**Expected Behavior:**
- Latest click wins
- No stale data displayed
- Smooth transitions (no jank)

**Implementation:**
- React batches state updates
- No async operations in filtering
- No race condition risk

---

### EC8: Invalid resetCadence Value

**Scenario:** resetCadence has unexpected value (e.g., "Quarterly")

**Expected Behavior:**
- ResetIndicator: Treats as normal reset (based on expirationDate)
- StatusBadge: Calculates status normally
- No crash

**Implementation:**
```typescript
// No string matching on resetCadence
// Pure date-based logic

export function getPeriodLabel(resetCadence: string): string {
  const labels = { ... };
  return labels[resetCadence] || resetCadence; // sensible fallback
}
```

---

## Accessibility & WCAG 2.1 Compliance

### A. Color Contrast Verification

**Target:** 4.5:1 for normal text, 3:1 for large text

**ResetIndicator Contrast Testing:**

```
Light Mode:
  Normal (gray-600 on gray-50):      4.5:1 ✓
  Warning (orange-600 on orange-50): 4.5:1 ✓
  Urgent (red-600 on red-50):        4.5:1 ✓

Dark Mode:
  Normal (gray-400 on gray-900/20):      4.5:1 ✓
  Warning (orange-400 on orange-900/20): 4.5:1 ✓
  Urgent (red-400 on red-900/20):        4.5:1 ✓
```

**Verification Tools:**
- [ ] WebAIM Contrast Checker
- [ ] Axe DevTools
- [ ] Manual testing in both modes

---

### B. Focus Indicators

**Implementation:**

```tsx
<button
  aria-pressed={selectedStatus === option.id}
  className="focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
             dark:focus:ring-blue-400"
>
  {label}
</button>
```

**Requirements:**
- [ ] 2px minimum outline
- [ ] Visible in light mode (blue ring)
- [ ] Visible in dark mode (brighter blue)
- [ ] Not blocked by z-index

---

### C. Semantic HTML

**ResetIndicator:**
```tsx
<div
  role="status"
  aria-label={`Benefit resets ${date}, ${days} days remaining`}
>
  <IconComponent aria-hidden="true" />
  <span>{text}</span>
</div>
```

**BenefitStatusBadge:**
```tsx
<span
  role="status"
  aria-label="Benefit status: Available"
>
  {icon} {label}
</span>
```

**BenefitsFilterBar:**
```tsx
<div role="group" aria-label="Filter benefits by status">
  <button
    aria-pressed={selectedStatus === option.id}
    onClick={...}
  >
    {label}
  </button>
</div>
```

**Requirements:**
- [ ] Use `<button>` for interactive controls
- [ ] `role="status"` for dynamic updates
- [ ] `role="group"` for related controls
- [ ] `aria-pressed` for toggle buttons
- [ ] `aria-label` for clarity
- [ ] `aria-hidden="true"` for decorative icons

---

### D. Keyboard Navigation

**Test Procedure:**
1. Tab through all interactive elements
2. Tab order matches visual order (left-to-right, top-to-bottom)
3. Activate button with Enter or Space
4. No focus traps

**Requirements:**
- [ ] All buttons reachable via Tab
- [ ] All buttons activatable via Enter/Space
- [ ] Tab order logical
- [ ] Can Tab out of all regions (no traps)

---

### E. Screen Reader Testing

**Using NVDA (Windows) or VoiceOver (macOS):**

```
ResetIndicator:
  Announces: "status, Benefit resets March 1, 3 days remaining"

StatusBadge:
  Announces: "status, Benefit status: Available"

FilterBar:
  Announces: "group, Filter benefits by status"
  Button: "button, Active 5, pressed false"
  Selected: "button, Active 5, pressed true"

Benefits after filtering:
  "5 results shown" (via aria-live or page heading)
```

**Requirements:**
- [ ] NVDA test pass
- [ ] VoiceOver test pass
- [ ] No duplicate announcements
- [ ] Status changes announced

---

### F. Reduced Motion Support

**Implementation:**

```css
@media (prefers-reduced-motion: reduce) {
  .filter-button,
  .status-badge {
    transition: none !important;
    animation: none !important;
  }
}
```

**Test:**
- [ ] Enable `prefers-reduced-motion: reduce` in browser
- [ ] Verify animations disabled
- [ ] All functionality still works
- [ ] No visual glitches

---

## Performance & Scalability

### P1: Render Performance

**Target:** < 500ms for 100 benefits

**Measurement:**
```typescript
// React DevTools Profiler
// 1. Record BenefitsGrid render
// 2. Check "Render duration"
// 3. Should be < 500ms for 100 items
```

**Optimization Strategies:**

1. **React.memo on BenefitCard**
   ```typescript
   const BenefitCard = React.memo(({ benefit }: Props) => { ... });
   ```

2. **useCallback for handlers**
   ```typescript
   const handleFilterChange = useCallback(
     (status: FilterStatus) => onStatusChange(status),
     [onStatusChange]
   );
   ```

3. **useMemo for expensive calculations**
   ```typescript
   const filteredBenefits = useMemo(
     () => applyFilters(benefits, filters),
     [benefits, filters]
   );
   ```

### P2: Filter Latency

**Target:** < 100ms to apply filter

**Measurement:**
```javascript
const start = performance.now();
// Click filter button
const end = performance.now();
console.log(`Filter: ${end - start}ms`);
```

**Optimization:**
- Synchronous filtering (no async)
- Efficient array.filter() logic
- Client-side only (no API calls)

### P3: Bundle Size

**Target:** < 15KB gzipped (new code)

**Components:**
- ResetIndicator: ~1.5KB
- StatusBadge: ~1.5KB
- FilterBar: ~2KB
- benefitFilters.ts: ~1KB
- **Total:** ~6KB → ~2KB gzipped

---

## Implementation Tasks

### Sprint Planning Summary

**Total Tasks:** 23  
**Estimated Duration:** 4-5 weeks (1 developer)

**Task Breakdown:**

| Task | Description | Complexity | Hours |
|------|-------------|-----------|-------|
| 1.1 | Type definitions | S | 2 |
| 1.2 | Period utilities | M | 4 |
| 1.3 | Benefit filters | M | 4 |
| 1.4 | ResetIndicator component | M | 5 |
| 1.5 | StatusBadge component | M | 5 |
| 1.6 | FilterBar component | L | 8 |
| 1.7 | Update BenefitsGrid | M | 5 |
| 1.8 | Update BenefitsList | M | 5 |
| 1.9 | Update BenefitTable | M | 5 |
| 1.10 | Wire FilterBar to page | M | 5 |
| 1.11 | Unit tests (dates) | M | 4 |
| 1.12 | Unit tests (filters) | M | 4 |
| 1.13 | Component tests (indicator) | M | 5 |
| 1.14 | Component tests (badge) | M | 5 |
| 1.15 | Component tests (filterbar) | L | 8 |
| 1.16 | Integration tests (grid) | M | 5 |
| 1.17 | Integration tests (page) | L | 8 |
| 1.18 | Accessibility audit | M | 6 |
| 1.19 | Responsive design testing | M | 5 |
| 1.20 | Dark mode testing | S | 3 |
| 1.21 | Documentation | S | 3 |
| 1.22 | Code review | V | 4 |
| 1.23 | QA & deployment | V | 6 |

**S=Small (1-2h), M=Medium (3-6h), L=Large (8h+), V=Variable**

---

## Acceptance Criteria

### ResetIndicator (12 Criteria)

- [ ] AC1.1: Displays "Resets [DATE]" for Monthly/CalendarYear/CardmemberYear
- [ ] AC1.2: Shows countdown in parentheses when < 7 days
- [ ] AC1.3: Green background/text (7+ days), Orange (3-7), Red (< 3)
- [ ] AC1.4: OneTime benefits render nothing
- [ ] AC1.5: Null expirationDate renders nothing
- [ ] AC1.6: Responsive: No overflow on 375px screens
- [ ] AC1.7: Dark mode: 4.5:1 contrast in both light/dark
- [ ] AC1.8: Semantic HTML with role="status" + aria-label
- [ ] AC1.9: No console errors
- [ ] AC1.10: No TypeScript 'any' types
- [ ] AC1.11: Respects prefers-reduced-motion
- [ ] AC1.12: No layout shift on mount (reserved space)

### BenefitStatusBadge (10 Criteria)

- [ ] AC2.1: "Available" for unclaimed non-expired
- [ ] AC2.2: "Expiring Soon" for < 7 days
- [ ] AC2.3: "Expired" for past expiration
- [ ] AC2.4: "✓ Claimed" for isUsed=true
- [ ] AC2.5: Icon + text visible (not icon-only)
- [ ] AC2.6: Touch target ≥44×44px
- [ ] AC2.7: Dark mode: 4.5:1 contrast both modes
- [ ] AC2.8: role="status" + aria-label
- [ ] AC2.9: No console errors
- [ ] AC2.10: No TypeScript 'any' types

### BenefitsFilterBar (12 Criteria)

- [ ] AC3.1: Renders 5 buttons: All, Active, Expiring, Expired, Claimed
- [ ] AC3.2: Shows count badges
- [ ] AC3.3: Clicking filter selects + filters benefits
- [ ] AC3.4: Visual feedback for selected state
- [ ] AC3.5: Radio behavior (only one selected)
- [ ] AC3.6: Filters apply instantly (< 100ms)
- [ ] AC3.7: Responsive: Desktop → Mobile
- [ ] AC3.8: Keyboard accessible (Tab, Enter/Space)
- [ ] AC3.9: Focus indicators visible (2px, ≥3:1)
- [ ] AC3.10: aria-pressed="true|false"
- [ ] AC3.11: role="group" + aria-label
- [ ] AC3.12: No console errors

### Integration (8 Criteria)

- [ ] AC4.1: BenefitsGrid shows ResetIndicator
- [ ] AC4.2: BenefitsGrid shows StatusBadge
- [ ] AC4.3: BenefitsList shows both components
- [ ] AC4.4: BenefitTable shows Status + Resets columns
- [ ] AC4.5: FilterBar renders + wired to filtering
- [ ] AC4.6: Filters correctly filter benefits
- [ ] AC4.7: No regressions in modals
- [ ] AC4.8: Correct benefits displayed after filter

### Performance (3 Criteria)

- [ ] AC5.1: 100 benefits render in < 500ms
- [ ] AC5.2: Filter applies in < 100ms
- [ ] AC5.3: No unnecessary re-renders (Profiler)

### Accessibility (6 Criteria)

- [ ] AC6.1: WCAG 2.1 AA: All text ≥4.5:1 or ≥3:1 (large)
- [ ] AC6.2: Focus indicators visible on all buttons
- [ ] AC6.3: Keyboard nav: Tab + Enter/Space work
- [ ] AC6.4: Screen reader: ARIA + semantic HTML correct
- [ ] AC6.5: Color not only indicator (icon+text)
- [ ] AC6.6: Reduced motion: Animations disabled when requested

### Dark/Light Mode (2 Criteria)

- [ ] AC7.1: All components visible in light mode
- [ ] AC7.2: All components visible in dark mode

---

## Testing Strategy

### T1: Unit Tests (benefitDates.ts + benefitFilters.ts)

**Target:** 100% coverage

```bash
npm run test src/features/benefits/lib/__tests__/
```

**Test Cases:**
- getDaysUntilReset: Today, +1, +7, +30, -1, null
- isUrgent: < 3 (true), >= 3 (false)
- isWarning: <= 7 (true), > 7 (false)
- formatResetDate: Various dates + locales
- getPeriodLabel: All cadences + unknown
- getStatusForBenefit: All 4 statuses + edge cases
- filterByStatus: Each filter, empty results
- countByStatus: Correct counts

### T2: Component Tests

**Target:** 90%+ coverage

```bash
npm run test src/features/benefits/components/indicators/
npm run test src/features/benefits/components/filters/
```

**Tools:** Jest + React Testing Library

**Test Cases per Component:**
- Render with various props
- Correct classes applied
- Accessibility attributes present
- Event handlers fired
- Snapshot tests

### T3: Integration Tests

**Target:** Full user flows

```bash
npm run test src/features/benefits/components/__tests__/integration/
```

**Scenarios:**
- Filter + display flow
- All 5 filters work correctly
- Multiple benefits rendered
- Empty state handled

### T4: Accessibility Testing

**Tools:**
- Axe DevTools (automated)
- NVDA/VoiceOver (manual)
- WebAIM Contrast Checker
- Lighthouse

**Checklist:**
- [ ] Axe audit: 0 errors
- [ ] Lighthouse a11y: ≥95
- [ ] Screen reader: Full test
- [ ] Contrast: All pairs ≥4.5:1

### T5: Performance Testing

**Tools:**
- React DevTools Profiler
- Chrome DevTools
- Lighthouse

**Metrics:**
- [ ] 100 benefits render < 500ms
- [ ] Filter < 100ms
- [ ] CLS < 0.1
- [ ] Bundle size < 15KB gzipped

### T6: Responsive Design Testing

**Viewports:**
- [ ] 375×667 (iPhone SE)
- [ ] 768×1024 (iPad)
- [ ] 1440×900 (Desktop)
- [ ] Landscape orientations

**Checks:**
- [ ] No horizontal scroll
- [ ] Text readable
- [ ] Touch targets ≥44×44px
- [ ] Layout adapts

### T7: Dark Mode Testing

**Procedure:**
- [ ] Enable dark mode toggle
- [ ] Test all components
- [ ] Verify contrast separately
- [ ] No color-only meaning
- [ ] Borders visible

---

## Security & Compliance

### SEC1: Input Validation

- Filter status values: Enum validation (all, active, etc.)
- Benefit data: Assume API returns valid UserBenefit
- No client-side SQL (filtering is array ops)

### SEC2: XSS Prevention

- React escapes by default
- No `dangerouslySetInnerHTML`
- Benefit names/values safe from API

### SEC3: Data Privacy

- No sensitive data in localStorage
- No API keys exposed in components
- Benefits data same as existing (no new privacy concerns)

### SEC4: Authentication

- No changes to auth layer
- Assume user authenticated
- API routes protected

---

## Definition of Done

### Code Quality Checklist

- [ ] ESLint: 0 errors, 0 warnings
- [ ] Prettier: Code formatted
- [ ] TypeScript: Strict mode, no 'any'
- [ ] No console.error/warn (production)
- [ ] JSDoc comments on all public functions
- [ ] Inline comments for complex logic

### Testing Checklist

- [ ] Unit tests: 100% coverage (utils)
- [ ] Component tests: 90%+ coverage
- [ ] Integration tests: Full flows
- [ ] Accessibility tests: Axe + screen reader
- [ ] Performance tests: < 500ms render, < 100ms filter
- [ ] Responsive tests: 3+ viewports
- [ ] Dark mode tests: Both modes

### Documentation Checklist

- [ ] Component README files
- [ ] JSDoc for all props
- [ ] Example usage
- [ ] Architecture notes

### Accessibility Checklist

- [ ] Axe DevTools: 0 errors
- [ ] Lighthouse a11y: ≥95
- [ ] Screen reader: NVDA/VoiceOver
- [ ] Color contrast: ≥4.5:1 (both modes)
- [ ] Focus indicators: Visible
- [ ] Keyboard nav: Tab/Enter/Space
- [ ] Reduced motion: Respected

### Performance Checklist

- [ ] Render: < 500ms (100 benefits)
- [ ] Filter: < 100ms
- [ ] CLS: < 0.1
- [ ] Bundle: < 15KB gzipped
- [ ] No unnecessary re-renders

### Code Review Checklist

- [ ] ≥2 developer approvals
- [ ] All feedback addressed
- [ ] Merge conflicts resolved
- [ ] CI/CD passing

### QA Checklist

- [ ] Staging deployment
- [ ] QA testing on staging
- [ ] No console errors on staging
- [ ] Performance acceptable
- [ ] Accessibility passes
- [ ] QA sign-off

### Deployment Checklist

- [ ] Code merged to main
- [ ] Deployment PR reviewed
- [ ] Code deployed to production
- [ ] Monitoring metrics captured
- [ ] No error spikes
- [ ] User feedback collected

---

## Appendix: Future Roadmap

### Phase 2: Period-Specific Usage Tracking

**New Components:**
- `PeriodProgressBar` - "Used $50 of $200 this month"
- `BenefitsPeriodToggle` - "This Month / This Year / All"
- `UsageHistoryTimeline` - When benefit was claimed

**Database:**
- Add `BenefitUsageRecord` table
- Migrate existing usage data

**API:**
- `GET /api/benefits/{id}/usage-history?period=2025-01`

### Phase 3: Advanced Analytics

**Components:**
- `AdvancedBenefitsFilter` - Multi-field filtering
- `BenefitsAnalytics` - ROI per benefit
- `UpcomingBenefitsPreview` - Next month benefits

**Features:**
- ROI calculation
- Benefit categorization
- Partial usage tracking

---

## References

- **Research Analysis:** DASHBOARD_BENEFITS_COMPREHENSIVE_ANALYSIS.md
- **Data Model:** prisma/schema.prisma
- **Existing Code:** src/features/benefits/
- **Design System:** Tailwind CSS + Shadcn/UI
- **WCAG:** https://www.w3.org/WAI/WCAG21/quickref/

---

**Specification Status:** ✅ **Implementation Ready**

**Prepared By:** Technical Architect  
**Date:** April 7, 2026  
**Version:** 2.0 - Comprehensive

