# Dashboard Benefits Enhancement - Phase 1: Quick Wins
## Technical Specification & Implementation Blueprint

**Version:** 1.0  
**Date:** April 7, 2026  
**Status:** Ready for Implementation  
**Owner:** Technical Architecture Team  
**Scope:** UI Components, Filters, Reset Indicators  

---

## Table of Contents

1. [Executive Summary & Goals](#1-executive-summary--goals)
2. [Current State Assessment](#2-current-state-assessment)
3. [Phase 1 Scope & Requirements](#3-phase-1-scope--requirements)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Technical Architecture & Design](#6-technical-architecture--design)
7. [Data Schema & Type System](#7-data-schema--type-system)
8. [Component Specifications](#8-component-specifications)
9. [User Experience & Visual Design](#9-user-experience--visual-design)
10. [User Flows & Workflows](#10-user-flows--workflows)
11. [Edge Cases & Error Handling](#11-edge-cases--error-handling)
12. [API & Integration Points](#12-api--integration-points)
13. [Testing Strategy](#13-testing-strategy)
14. [Accessibility & Compliance](#14-accessibility--compliance)
15. [Performance & Scalability](#15-performance--scalability)
16. [Deployment & Rollout](#16-deployment--rollout)
17. [Implementation Tasks](#17-implementation-tasks)
18. [Definition of Done](#18-definition-of-done)

---

## 1. Executive Summary & Goals

### 1.1 Overview

The Card-Benefits application provides users with a comprehensive dashboard to track and manage credit card benefits across multiple cards. Currently, the benefits display lacks critical visual indicators that help users understand:

- **When benefits reset** (countdown timers)
- **Which benefits are urgent** (expiring soon visual cues)
- **What status each benefit is in** (active, expiring, expired, claimed)
- **Filtered views** (filtering by status is not visible in the UI)

This Phase 1 focuses on implementing four complementary UI enhancements that together provide users with the visual clarity and information architecture needed to maximize their benefit usage. These are "quick wins"—components that work with the existing data model without requiring database schema changes.

### 1.2 Business Value & Impact

**User-Facing Benefits:**
- ✅ Users can immediately see which benefits are about to expire (reduce unused benefit waste)
- ✅ Clear visual hierarchy shows urgent benefits with countdown timers
- ✅ Status badges (Active/Expiring/Expired/Claimed) eliminate ambiguity
- ✅ Filter capabilities allow users to focus on specific benefit types
- ✅ Alignment with industry standards (Chase, Amex, Citi)

**Operational Benefits:**
- ✅ Increases user engagement with the dashboard
- ✅ Reduces support inquiries about "when do my benefits reset?"
- ✅ Foundation for future features (Part 2: period-specific tracking, progress bars)
- ✅ Demonstrates product progress and attention to UX detail

**Technical Benefits:**
- ✅ Modular component architecture supports parallel development
- ✅ No database changes required (works with existing UserBenefit model)
- ✅ Establishes reusable patterns for benefit-related components
- ✅ Sets foundation for TypeScript strict mode compliance

### 1.3 Success Metrics

| Metric | Target | Method |
|--------|--------|--------|
| **Component Coverage** | All 4 new components working (ResetIndicator, StatusBadge, FilterBar + integration updates) | QA Checklist |
| **Performance** | Render 100+ benefits in < 500ms | Chrome DevTools / Lighthouse |
| **Accessibility** | WCAG 2.1 AA compliant (4.5:1 contrast, keyboard navigation) | axe DevTools + manual testing |
| **Mobile Responsiveness** | Full functionality at 375px, 768px, 1440px breakpoints | Responsive testing |
| **Code Quality** | 0 ESLint errors, 0 TypeScript `any` types | `npm run lint` + strict tsconfig |
| **Test Coverage** | Unit tests for helpers, component tests for new components | Jest/Vitest |
| **Visual Regression** | Light/dark mode visual consistency | Visual regression tests |

---

## 2. Current State Assessment

### 2.1 Existing Benefits Architecture

**Data Model Location:** `prisma/schema.prisma` (Lines 169-199)

The `UserBenefit` model supports benefits with periodic resets:

```prisma
model UserBenefit {
  id                String    @id @default(cuid())
  userCardId        String
  playerId          String
  name              String
  type              String                        // 'StatementCredit', 'UsagePerk'
  stickerValue      Int                           // Cents (e.g., 50000 = $500)
  resetCadence      String                        // 'Monthly', 'CalendarYear', 'CardmemberYear', 'OneTime'
  userDeclaredValue Int?                          // User override
  isUsed            Boolean   @default(false)     // Current period toggle
  timesUsed         Int       @default(0)         // Lifetime counter
  expirationDate    DateTime?                     // Period end deadline
  status            String    @default("ACTIVE")
  importedFrom      String?
  importedAt        DateTime?
  claimedAt         DateTime?                     // When marked used
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([userCardId, name])
  @@index([userCardId])
  @@index([playerId])
}
```

**Key Fields for Phase 1:**

| Field | Current Use | Phase 1 Requirement |
|-------|------------|-------------------|
| `expirationDate` | Set by `calcExpirationDate(resetCadence)` | Display in ResetIndicator (countdown) |
| `isUsed` | Boolean toggle (no period tracking) | Display in StatusBadge (claimed vs. unclaimed) |
| `resetCadence` | Enum: Monthly, CalendarYear, CardmemberYear, OneTime | Use in ResetIndicator label |
| `claimedAt` | Single timestamp, cleared on reset | Could display in StatusBadge |
| `status` | Currently 'ACTIVE' only | Foundation for StatusBadge logic |

### 2.2 Current Display Components

**Location:** `/src/features/benefits/components/`

**BenefitsGrid.tsx** - 3-column responsive grid (Desktop: 3 cols, Tablet: 2 cols, Mobile: 1 col)
- Displays benefit name, value, type icon, status badge
- Has edit/delete/mark-as-used buttons
- ❌ Missing: Reset countdown, clear status visual
- ❌ Missing: Urgency indicators (green/orange/red)

**BenefitsList.tsx** - Vertical card list (full width cards)
- Shows same fields as grid with different layout
- ❌ Missing: Reset countdown, clear status visual
- ❌ Missing: Urgency indicators

**BenefitTable.tsx** - Semantic table view (semantic HTML with thead/tbody)
- ❌ Missing: Reset countdown column
- ❌ Missing: Clear status indicators

**Card Detail Page** - `/src/app/(dashboard)/card/[id]/page.tsx`
- Has filter state defined: `const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expiring' | 'expired'>('all')`
- ❌ **Filter UI not rendered** (buttons not visible to users)
- ❌ Uses filter internally but no visual buttons to change it

### 2.3 Reset Logic & Calculation Functions

**Location:** `/src/features/benefits/lib/benefitDates.ts`

**Key Functions:**

1. **`calcExpirationDate(resetCadence, renewalDate, now?)`**
   - Sets initial expiration for a benefit when created
   - Returns: Date (last moment of current period) or null (OneTime)
   - ✅ Works correctly for Monthly, CalendarYear, CardmemberYear, OneTime

2. **`getNextExpirationDate(resetCadence, renewalDate, now?)`**
   - Advances expiration to next period when benefit resets
   - Called by cron job daily
   - ✅ Works correctly for all cadences

**Critical Observations:**
- All calculations use UTC (timezone-agnostic)
- Dates stored in DB are UTC
- Comparisons for reset checks are UTC
- **Phase 1 can safely use `expirationDate` directly for countdown display**

### 2.4 Current Filter Implementation Status

**Card Detail Page** (Implemented but not visible):
- Filter state exists: `filterStatus: 'all' | 'active' | 'expiring' | 'expired'`
- Filter logic works: `getBenefitStatus(benefit)` determines which filter category
- ❌ **UI controls not rendered** (no buttons visible to toggle filters)

**Current Limitation:**
Users cannot control the filter through the UI. The dashboard always shows "all" benefits.

**Task for Phase 1:** Make filters visible and functional through new **BenefitsFilterBar** component.

### 2.5 Existing Type Definitions & Utilities

**Benefits Types:** `/src/features/benefits/types/index.ts`

Current benefit-related interfaces exist but may need extension for Phase 1.

**Existing UI Components** (reusable for Phase 1):
- `Button` - Available in `/src/shared/components/ui/button`
- `Badge` - Available in `/src/shared/components/ui/Badge`
- Icons - Lucide React (`Plane`, `Tag`, `Utensils`, `DollarSign`, `Zap`, etc.)

---

## 3. Phase 1 Scope & Requirements

### 3.1 Phase 1 Goals

Phase 1 focuses on **four complementary UI/UX enhancements** that work with the existing data model:

1. **ResetIndicator Component** - Show when benefit resets with countdown
2. **BenefitStatusBadge Component** - Show benefit status (Active/Expiring/Expired/Claimed)
3. **BenefitsFilterBar Component** - Allow filtering by status
4. **Component Integration Updates** - Wire new components into existing BenefitsGrid, BenefitsList, Card Detail

**Explicit Non-Goals for Phase 1:**
- ❌ Period-specific usage tracking (Phase 2)
- ❌ Progress bars (Phase 2)
- ❌ Partial usage amounts (Phase 3)
- ❌ Database schema changes (Phase 2+)
- ❌ Analytics or historical tracking (Phase 3+)
- ❌ New API endpoints (work with existing data)

### 3.2 Why This Ordering?

**Phase 1 (Quick Wins):**
- Works with existing data (no schema changes)
- Immediate user value (filters + visual indicators)
- Prepares foundation for Phase 2
- Can be shipped independently

**Future Phases:**
- **Phase 2:** Period-specific tracking (new DB table) + progress bars
- **Phase 3:** Advanced features (partial usage, analytics)

---

## 4. Functional Requirements

### 4.1 ResetIndicator Component

**Purpose:** Display when a benefit's current period ends and how many days until reset.

**Requirement Details:**

| Requirement | Specification |
|------------|---|
| **Display Format** | "Resets [Month Day] ([X] days left)" e.g., "Resets Mar 1 (3 days left)" |
| **Countdown Logic** | Calculate days remaining: `Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24))` |
| **Urgency Coloring** | • Green (text): ≥7 days • Orange: 3-7 days • Red + Bold: <3 days |
| **OneTime Handling** | OneTime benefits: Show nothing or "No reset" (no countdown) |
| **Expired Handling** | If benefit already expired: Show "Expired - [was date]" in gray |
| **Date Format** | Use `date-fns` library: `format(expirationDate, 'MMM d')` |
| **Mobile Responsive** | Truncate gracefully on small screens: "Resets Mar 1..." with tooltip |
| **Dark Mode** | Text colors adapt to dark/light theme (use Tailwind dark: prefix) |
| **Timezone** | Display in user's local timezone (expirationDate is UTC in DB) |
| **Accessibility** | Include aria-label: "Benefit resets on [full date]" |

**Component Props:**

```typescript
interface ResetIndicatorProps {
  expirationDate: Date | null | undefined;
  resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
  isUsed?: boolean;  // For optional "Already claimed" variant
  isExpired?: boolean;  // For optional "Expired" variant
  className?: string;  // For custom styling
}
```

**Visual Examples:**

```
Normal (7+ days):     ⏰ Resets Mar 15 (10 days left)     [gray text]
Warning (3-7 days):   ⏰ Resets Mar 8 (2 days left)        [orange text]
Urgent (<3 days):     ⚠️ RESETS SOON: Mar 5 (1 day left)   [red bold text]
OneTime Claimed:      ✓ Benefit Claimed                     [blue checkmark]
OneTime Not Used:     (nothing shown, part of badge)
Expired:              ⏰ Expired - Was Feb 28              [gray strikethrough]
```

**Behavior Requirements:**
- ✅ Recalculate countdown every render (or use timer hook for real-time)
- ✅ Update when props change
- ✅ Handle null/undefined expirationDate gracefully (show placeholder)
- ✅ Respect user's local timezone for display
- ✅ No layout shift when countdown changes (fixed width or wrapping)

---

### 4.2 BenefitStatusBadge Component

**Purpose:** Show the current status of a benefit with color coding and icon.

**Status Definition:**

| Status | Condition | Display |
|--------|-----------|---------|
| **Active** | `resetCadence !== 'OneTime' AND !isUsed AND expirationDate > now AND expirationDate - now >= 3 days` | 🟢 Active (green badge) |
| **Expiring Soon** | `resetCadence !== 'OneTime' AND !isUsed AND expirationDate > now AND expirationDate - now < 3 days` | 🟠 Expiring Soon (orange badge) |
| **Expired** | `expirationDate <= now` | 🔴 Expired (red badge) |
| **Claimed** | `isUsed === true` (any cadence) | ✓ Claimed (blue badge) |
| **Unclaimed OneTime** | `resetCadence === 'OneTime' AND !isUsed` | ⭕ Available (green badge) |

**Component Props:**

```typescript
interface BenefitStatusBadgeProps {
  status: 'active' | 'expiring' | 'expired' | 'claimed' | 'unclaimed-onetime';
  isUsed: boolean;
  resetCadence: string;
  expirationDate: Date | null;
  showIcon?: boolean;  // Default: true
  showText?: boolean;  // Default: true
  size?: 'sm' | 'md' | 'lg';  // Default: 'md'
  className?: string;
}
```

**Visual Examples:**

```
┌─────────────────┐
│ 🟢 Active       │  Green background, white text
└─────────────────┘

┌─────────────────┐
│ 🟠 Expiring...  │  Orange background, white text
└─────────────────┘

┌─────────────────┐
│ 🔴 Expired      │  Red background, white text
└─────────────────┘

┌─────────────────┐
│ ✓ Claimed       │  Blue background, white text
└─────────────────┘
```

**Behavior Requirements:**
- ✅ Display with icon AND text (can be toggled)
- ✅ Semantic HTML: use `<span role="status">` or `<div role="status">`
- ✅ Color contrast ≥4.5:1 for accessibility
- ✅ Support dark mode (colors visible in both light/dark)
- ✅ Responsive: shrink text on mobile if needed
- ✅ Include ARIA labels: `aria-label="Benefit status: Active"`

---

### 4.3 BenefitsFilterBar Component

**Purpose:** Allow users to filter benefits by status and see count of benefits in each category.

**Filter Options:**

| Filter | Display | Count | Behavior |
|--------|---------|-------|----------|
| **All** | [All] | Total | Shows all benefits (removes all filters) |
| **Active** | [Active] | Count of active | Filters to only active benefits |
| **Expiring Soon** | [Expiring (N)] | Count of expiring | Filters to only expiring benefits |
| **Expired** | [Expired] | Count of expired | Filters to only expired benefits |
| **Claimed** | [Claimed] | Count of claimed | Filters to only claimed benefits |

**Component Props:**

```typescript
interface BenefitsFilterBarProps {
  benefits: UserBenefit[];  // Full list to calculate counts
  selectedFilter: 'all' | 'active' | 'expiring' | 'expired' | 'claimed';
  onFilterChange: (filter: string) => void;
  className?: string;
}
```

**Visual Examples:**

**Desktop Layout (1440px):**
```
┌─────────────────────────────────────────────────────────────┐
│ Filter by Status:                                           │
│ [All] [Active] [Expiring (3)] [Expired] [Claimed (5)]       │
│                              [Clear All]                     │
└─────────────────────────────────────────────────────────────┘
```

**Tablet Layout (768px):**
```
┌──────────────────────────────────────┐
│ [All] [Active] [Expiring (3)]         │
│ [Expired] [Claimed (5)] [Clear All]   │
└──────────────────────────────────────┘
```

**Mobile Layout (375px):**
```
┌────────────────────────────┐
│ Status Filter:             │
│ [All ▼]                    │
│ (Showing N of M benefits)  │
└────────────────────────────┘
```

**Behavior Requirements:**
- ✅ Display all filter options with pill-style buttons
- ✅ Show count of benefits in each category (e.g., "Expiring (3)")
- ✅ Highlight currently selected filter (background color change)
- ✅ Multi-select option: Can filter by multiple statuses (or single-select, design choice)
- ✅ "Clear All" button to remove all filters
- ✅ Responsive: Collapse to dropdown on mobile (<600px)
- ✅ Update counts dynamically as benefits list changes
- ✅ Persist filter selection (URL params or session state)
- ✅ Dark mode support
- ✅ Keyboard accessible (Tab/Enter navigation)
- ✅ Show "No benefits match filters" when empty

**Design Decision Note:**
- **Option A:** Single-select filters (user picks one status at a time)
- **Option B:** Multi-select filters (user can combine e.g., "Active + Expiring")
- **Recommendation:** Single-select for Phase 1 (simpler, matches Card Detail page current implementation)

---

### 4.4 Component Integration Updates

**Where to integrate:**

1. **BenefitsGrid.tsx**
   - Add ResetIndicator below benefit value
   - Add BenefitStatusBadge in top-right corner of card

2. **BenefitsList.tsx**
   - Add ResetIndicator below benefit description
   - Add BenefitStatusBadge next to benefit name

3. **BenefitTable.tsx**
   - Add ResetIndicator column (or expand existing "Expires" column)
   - Add StatusBadge column before/after status

4. **Card Detail Page** (`/src/app/(dashboard)/card/[id]/page.tsx`)
   - **Replace placeholder filter state with BenefitsFilterBar component**
   - Wire filter change handler to update displayed benefits
   - Show filter counts
   - Ensure filters work with all three view modes (grid, list, table)

5. **Dashboard** (`/src/app/dashboard/page.tsx`)
   - Add ResetIndicator to BenefitsGrid on main dashboard
   - Add BenefitStatusBadge to BenefitsGrid
   - Consider adding FilterBar if space allows (optional for Phase 1)

---

## 5. Non-Functional Requirements

### 5.1 Performance Requirements

| Requirement | Target | Method |
|------------|--------|--------|
| **Component Render Time** | <50ms per component | React DevTools Profiler |
| **Full Benefits List** | 100+ benefits render in <500ms | Chrome DevTools / Lighthouse |
| **Filter Application** | Filter change applies in <100ms | Measure state update |
| **Re-render Optimization** | No unnecessary re-renders (React.memo, useCallback) | React DevTools Profiler |
| **Bundle Size** | New components add <50KB (gzipped) | `npm run build` + size analysis |
| **Dark Mode Switch** | Instant (no re-render flicker) | Manual testing |

### 5.2 Accessibility Requirements (WCAG 2.1 AA)

| Requirement | Specification |
|------------|---|
| **Color Contrast** | ≥4.5:1 for text on background colors |
| **Focus Indicators** | Visible focus rings on all interactive elements (≥3px) |
| **Keyboard Navigation** | Full functionality with Tab, Shift+Tab, Enter, Space |
| **Screen Reader Support** | Semantic HTML, ARIA labels for status indicators |
| **Motion** | Respect `prefers-reduced-motion` (no flashing, auto-scroll) |
| **Touch Targets** | Minimum 44x44px for mobile buttons |
| **Alt Text** | Icons have aria-label or title attributes |
| **Form Labels** | Filter buttons have accessible labels |

**Testing Tools:**
- ✅ axe DevTools Chrome Extension
- ✅ WAVE Web Accessibility Evaluation Tool
- ✅ Keyboard-only navigation testing
- ✅ Screen reader testing (NVDA on Windows, VoiceOver on Mac)

### 5.3 Browser & Device Support

| Browser | Version | Support |
|---------|---------|---------|
| Chrome | Latest 2 versions | ✅ Full |
| Firefox | Latest 2 versions | ✅ Full |
| Safari | Latest 2 versions | ✅ Full |
| Edge | Latest 2 versions | ✅ Full |
| Mobile Safari | iOS 13+ | ✅ Full |
| Chrome Mobile | Latest | ✅ Full |

| Device | Screen Size | Support |
|--------|-------------|---------|
| Mobile | 375px - 568px | ✅ Full functionality |
| Tablet | 768px - 1024px | ✅ Full functionality |
| Desktop | 1440px+ | ✅ Full functionality |
| Desktop Extra Wide | 2560px+ | ✅ Full functionality |

### 5.4 Code Quality & Standards

| Requirement | Specification |
|------------|---|
| **TypeScript** | Strict mode enabled (`strict: true` in tsconfig.json), no `any` types |
| **ESLint** | 0 errors, 0 warnings (standard Next.js/React rules) |
| **Prettier** | Code formatted with project Prettier config |
| **Component Structure** | Functional components with hooks, no class components |
| **Props Validation** | TypeScript interfaces for all props |
| **Comments** | JSDoc comments on public functions/components |
| **Testing** | Unit tests for helpers, component tests for UI components |

### 5.5 Dark Mode Support

**Requirement:** All new components must support dark mode using Tailwind CSS.

**Implementation Pattern:**
```typescript
<div className="dark:bg-gray-800 dark:text-white bg-white text-black">
  Dark mode content
</div>
```

**Testing:**
- Toggle system dark mode (OS settings)
- Test in both light and dark modes
- Verify color contrast in both modes

---

## 6. Technical Architecture & Design

### 6.1 System Architecture Overview

```
User Dashboard
    ↓
Card Detail Page (/card/[id])
    ├── CardSwitcher (select which card to view)
    ├── BenefitsFilterBar (NEW - filter by status)
    │   └── Emits onFilterChange
    ├── ViewModeSelector (grid, list, table)
    │
    ├── BenefitsGrid (UPDATED with new components)
    │   └── BenefitCard (for each benefit)
    │       ├── BenefitHeader
    │       │   ├── BenefitIcon
    │       │   ├── BenefitName
    │       │   └── BenefitStatusBadge (NEW)
    │       ├── BenefitBody
    │       │   ├── BenefitValue
    │       │   └── ResetIndicator (NEW)
    │       └── BenefitFooter (actions)
    │
    ├── BenefitsList (UPDATED with new components)
    │   └── BenefitCard (same structure as grid)
    │
    └── BenefitTable (UPDATED with new components)
        └── Table rows with ResetIndicator + StatusBadge columns
```

### 6.2 Data Flow for Filters

```
1. User clicks filter button in BenefitsFilterBar
   ↓
2. onFilterChange(selectedFilter) callback fired
   ↓
3. Card Detail page state updates: setFilterStatus(selectedFilter)
   ↓
4. filteredBenefits = applyFilters(allBenefits, selectedFilter)
   ↓
5. Re-render passes filteredBenefits to BenefitsGrid/List/Table
   ↓
6. Each BenefitCard re-renders with updated data
   ↓
7. ResetIndicator + StatusBadge calculate & display current status
```

### 6.3 Helper Functions Architecture

**Location:** `/src/features/benefits/lib/`

**New Files to Create:**

1. **`periodCalculations.ts`** - Date/countdown calculations

```typescript
/**
 * Calculate days remaining until benefit resets
 * @param expirationDate - The date when benefit period ends (UTC)
 * @returns Number of days remaining (negative if already expired)
 */
export function getDaysUntilReset(expirationDate: Date | null | undefined): number {
  if (!expirationDate) return 0;
  const now = new Date();
  const daysMs = expirationDate.getTime() - now.getTime();
  return Math.ceil(daysMs / (1000 * 60 * 60 * 24));
}

/**
 * Determine if benefit is in urgent state (< 3 days)
 */
export function isUrgent(daysLeft: number): boolean {
  return daysLeft < 3 && daysLeft > 0;
}

/**
 * Determine if benefit is in warning state (< 7 days but not urgent)
 */
export function isWarning(daysLeft: number): boolean {
  return daysLeft >= 3 && daysLeft < 7;
}

/**
 * Determine if benefit has expired
 */
export function isExpiredBenefit(expirationDate: Date | null): boolean {
  if (!expirationDate) return false;
  return expirationDate.getTime() < new Date().getTime();
}

/**
 * Format reset date for display (e.g., "Mar 15")
 */
export function formatResetDate(date: Date | null, format?: string): string {
  if (!date) return '';
  return format(date, 'MMM d');  // Using date-fns
}

/**
 * Get human-readable label for reset cadence
 */
export function getPeriodLabel(resetCadence: string): string {
  const labels: Record<string, string> = {
    'Monthly': 'Monthly',
    'CalendarYear': 'Yearly',
    'CardmemberYear': 'Annually',
    'OneTime': 'One-Time'
  };
  return labels[resetCadence] || resetCadence;
}
```

2. **`benefitFilters.ts`** - Filter logic and status determination

```typescript
/**
 * Determine the current status of a benefit
 */
export function getBenefitStatus(
  benefit: UserBenefit,
  now: Date = new Date()
): 'active' | 'expiring' | 'expired' | 'claimed' {
  // If claimed, return 'claimed' regardless of other factors
  if (benefit.isUsed) {
    return 'claimed';
  }

  // OneTime benefits with no expiration
  if (benefit.resetCadence === 'OneTime' || !benefit.expirationDate) {
    return 'active';  // Available/active state
  }

  // Check if expired
  if (benefit.expirationDate.getTime() < now.getTime()) {
    return 'expired';
  }

  // Check if expiring soon (< 3 days)
  const daysLeft = getDaysUntilReset(benefit.expirationDate);
  if (daysLeft < 3) {
    return 'expiring';
  }

  return 'active';
}

/**
 * Filter benefits by status
 */
export function filterByStatus(
  benefits: UserBenefit[],
  status: string
): UserBenefit[] {
  if (status === 'all') return benefits;

  return benefits.filter(benefit => {
    const benefitStatus = getBenefitStatus(benefit);
    return benefitStatus === status;
  });
}

/**
 * Apply all filters to a benefits list
 */
export interface BenefitFilters {
  status?: 'all' | 'active' | 'expiring' | 'expired' | 'claimed';
  search?: string;
}

export function applyFilters(
  benefits: UserBenefit[],
  filters: BenefitFilters
): UserBenefit[] {
  let filtered = benefits;

  // Apply status filter
  if (filters.status && filters.status !== 'all') {
    filtered = filterByStatus(filtered, filters.status);
  }

  // Apply search filter (optional, for future)
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter(b =>
      b.name.toLowerCase().includes(searchLower) ||
      b.type.toLowerCase().includes(searchLower)
    );
  }

  return filtered;
}

/**
 * Count benefits by status for display in filter UI
 */
export function countByStatus(
  benefits: UserBenefit[]
): Record<string, number> {
  const counts = {
    all: benefits.length,
    active: 0,
    expiring: 0,
    expired: 0,
    claimed: 0,
  };

  benefits.forEach(benefit => {
    const status = getBenefitStatus(benefit);
    if (counts[status] !== undefined) {
      counts[status]++;
    }
  });

  return counts;
}
```

### 6.4 Type System & Interfaces

**Location:** `/src/features/benefits/types/index.ts`

**Extend existing types:**

```typescript
/**
 * Union type for all possible benefit statuses in Phase 1
 */
export type BenefitStatusType = 'active' | 'expiring' | 'expired' | 'claimed';

/**
 * Filter options for benefits display
 */
export interface BenefitFilters {
  status?: BenefitStatusType | 'all';
  search?: string;
}

/**
 * Extended benefit props for components (includes calculated fields)
 */
export interface BenefitDisplayProps extends UserBenefit {
  calculatedStatus?: BenefitStatusType;
  daysUntilReset?: number;
  isExpired?: boolean;
}

/**
 * Component-specific props (separate from data model)
 */
export interface ResetIndicatorProps {
  expirationDate: Date | null | undefined;
  resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
  isUsed?: boolean;
  isExpired?: boolean;
  className?: string;
}

export interface BenefitStatusBadgeProps {
  status: BenefitStatusType;
  isUsed: boolean;
  resetCadence: string;
  expirationDate: Date | null;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface BenefitsFilterBarProps {
  benefits: UserBenefit[];
  selectedFilter: BenefitStatusType | 'all';
  onFilterChange: (filter: string) => void;
  className?: string;
}
```

---

## 7. Data Schema & Type System

### 7.1 No Schema Changes Required for Phase 1

Phase 1 uses the existing `UserBenefit` model without modifications:

```prisma
model UserBenefit {
  id                String    @id @default(cuid())
  userCardId        String
  playerId          String
  name              String
  type              String                        // No change
  stickerValue      Int                           // No change
  resetCadence      String                        // ✅ Use for ResetIndicator
  userDeclaredValue Int?                          // No change
  isUsed            Boolean   @default(false)     // ✅ Use for StatusBadge
  timesUsed         Int       @default(0)         // No change
  expirationDate    DateTime?                     // ✅ Use for countdown
  status            String    @default("ACTIVE")  // ✅ Foundation for StatusBadge
  importedFrom      String?                       // No change
  importedAt        DateTime?                     // No change
  claimedAt         DateTime?                     // ✅ Could use for "claimed at" display
  createdAt         DateTime  @default(now())     // No change
  updatedAt         DateTime  @updatedAt          // No change
  
  player            Player    @relation(...)       // No change
  userCard          UserCard  @relation(...)       // No change
  
  @@unique([userCardId, name])
  @@index([userCardId])
  @@index([playerId])
}
```

### 7.2 Fields Used by Phase 1 Components

| Field | Component | Usage | Example |
|-------|-----------|-------|---------|
| `expirationDate` | ResetIndicator | Display countdown "X days left" | "2025-03-15T23:59:59Z" → "Mar 15 (3 days)" |
| `resetCadence` | ResetIndicator, StatusBadge | Determine period type | 'Monthly' → "Resets next month" |
| `isUsed` | StatusBadge | Show "Claimed" if true | true → "✓ Claimed" |
| `resetCadence` | StatusBadge | Determine if OneTime (no reset) | 'OneTime' → "Available" |
| `name` | FilterBar counts | Display benefit name in filter | Used in filtered list |
| All fields | FilterBar | Calculate counts for display | Count of active/expiring/etc. |

### 7.3 Data Flow from API to Components

```
API Response (GET /api/cards/[id])
    ↓
Card Detail Page receives: { benefits: UserBenefit[] }
    ↓
Calculate status for each benefit:
    useEffect(() => {
      const benefitsWithStatus = benefits.map(b => ({
        ...b,
        calculatedStatus: getBenefitStatus(b),
        daysUntilReset: getDaysUntilReset(b.expirationDate)
      }));
    })
    ↓
Filter based on selectedFilter:
    const filtered = applyFilters(benefitsWithStatus, { status: selectedFilter })
    ↓
Pass to display component:
    <BenefitsGrid benefits={filtered} />
    ↓
BenefitCard renders for each benefit:
    <ResetIndicator expirationDate={benefit.expirationDate} ... />
    <BenefitStatusBadge status={benefit.calculatedStatus} ... />
```

---

## 8. Component Specifications

### 8.1 ResetIndicator Component

**File:** `/src/features/benefits/components/indicators/ResetIndicator.tsx`

**Purpose:** Display countdown timer and reset date for periodic benefits.

**Props Interface:**
```typescript
interface ResetIndicatorProps {
  expirationDate: Date | null | undefined;
  resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
  isUsed?: boolean;
  isExpired?: boolean;
  className?: string;
}
```

**Component Behavior:**

1. **Input Validation**
   - Handle null/undefined expirationDate gracefully
   - Return empty fragment or placeholder if data missing

2. **OneTime Benefits**
   - If `resetCadence === 'OneTime'`, return nothing
   - Status badge handles the "Available" vs "Claimed" display

3. **Countdown Calculation**
   - Calculate days remaining: `Math.ceil((expirationDate - now) / ms_per_day)`
   - Update on render (or use timer for real-time)
   - Handle timezone conversion (UTC to user's local timezone)

4. **Urgency Styling**
   ```
   daysLeft >= 7  → Gray text
   3 <= daysLeft < 7 → Orange text
   daysLeft < 3  → Red text + BOLD + Warning icon
   daysLeft < 0  → Gray strikethrough "Expired"
   ```

5. **Responsive Layout**
   - Desktop: "⏰ Resets Mar 15 (10 days left)"
   - Mobile: "⏰ Resets Mar 15..." (truncated with tooltip on hover)

**Example Render:**

```typescript
const ResetIndicator: React.FC<ResetIndicatorProps> = ({
  expirationDate,
  resetCadence,
  isUsed = false,
  isExpired = false,
  className = ''
}) => {
  // OneTime benefits don't have reset indicators
  if (resetCadence === 'OneTime') {
    return null;
  }

  if (!expirationDate) {
    return <span className={`text-gray-400 text-sm ${className}`}>No reset date</span>;
  }

  const daysLeft = getDaysUntilReset(expirationDate);
  const isUrgentState = isUrgent(daysLeft);
  const isWarningState = isWarning(daysLeft);
  const isExpiredState = isExpiredBenefit(expirationDate);

  const resetDate = formatResetDate(expirationDate);
  
  // Color classes based on urgency
  const colorClass = isExpiredState 
    ? 'text-gray-400 line-through'
    : isUrgentState 
    ? 'text-red-600 dark:text-red-400 font-bold'
    : isWarningState 
    ? 'text-orange-600 dark:text-orange-400'
    : 'text-gray-600 dark:text-gray-400';

  const icon = isUrgentState ? '⚠️' : '⏰';

  return (
    <div 
      className={`flex items-center gap-1 text-sm ${colorClass} ${className}`}
      aria-label={`Benefit resets on ${expirationDate.toLocaleDateString()}`}
    >
      <span>{icon}</span>
      <span>
        {isExpiredState 
          ? `Expired - Was ${resetDate}`
          : `Resets ${resetDate} (${daysLeft} days left)`
        }
      </span>
    </div>
  );
};

export default ResetIndicator;
```

**Testing Requirements:**
- ✅ Renders correctly for Monthly benefits
- ✅ Renders correctly for CalendarYear benefits
- ✅ Renders correctly for CardmemberYear benefits
- ✅ Returns null for OneTime benefits
- ✅ Color changes as expiration approaches
- ✅ Handles expired benefits correctly
- ✅ Responsive on mobile (truncates text)
- ✅ Dark mode colors visible
- ✅ ARIA labels present

---

### 8.2 BenefitStatusBadge Component

**File:** `/src/features/benefits/components/indicators/BenefitStatusBadge.tsx`

**Purpose:** Display a color-coded status badge for a benefit.

**Props Interface:**
```typescript
interface BenefitStatusBadgeProps {
  status: 'active' | 'expiring' | 'expired' | 'claimed';
  isUsed: boolean;
  resetCadence: string;
  expirationDate: Date | null;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

**Status Mapping:**

```typescript
const statusConfig = {
  active: {
    label: 'Active',
    icon: '🟢',
    bgClass: 'bg-green-100 dark:bg-green-900',
    textClass: 'text-green-800 dark:text-green-100',
    borderClass: 'border-green-300 dark:border-green-700'
  },
  expiring: {
    label: 'Expiring Soon',
    icon: '🟠',
    bgClass: 'bg-orange-100 dark:bg-orange-900',
    textClass: 'text-orange-800 dark:text-orange-100',
    borderClass: 'border-orange-300 dark:border-orange-700'
  },
  expired: {
    label: 'Expired',
    icon: '🔴',
    bgClass: 'bg-red-100 dark:bg-red-900',
    textClass: 'text-red-800 dark:text-red-100',
    borderClass: 'border-red-300 dark:border-red-700'
  },
  claimed: {
    label: 'Claimed',
    icon: '✓',
    bgClass: 'bg-blue-100 dark:bg-blue-900',
    textClass: 'text-blue-800 dark:text-blue-100',
    borderClass: 'border-blue-300 dark:border-blue-700'
  }
};
```

**Component Behavior:**

1. **Determine Status**
   - Use `getBenefitStatus(benefit)` helper function
   - Pass calculated status to component

2. **Size Variants**
   - `sm`: Small badge (text-xs padding-1)
   - `md`: Medium badge (text-sm padding-2) - DEFAULT
   - `lg`: Large badge (text-base padding-3)

3. **Display Options**
   - `showIcon = true`: Display emoji/icon before text
   - `showText = true`: Display status label text
   - Can combine or show just icon on mobile

4. **Accessibility**
   - Include `role="status"`
   - Add aria-label with full status description
   - Use semantic span/div

**Example Render:**

```typescript
const BenefitStatusBadge: React.FC<BenefitStatusBadgeProps> = ({
  status,
  showIcon = true,
  showText = true,
  size = 'md',
  className = ''
}) => {
  const config = statusConfig[status];
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-full border
        font-medium transition-colors
        ${config.bgClass}
        ${config.textClass}
        ${config.borderClass}
        ${sizeClasses[size]}
        ${className}
      `}
      role="status"
      aria-label={`Benefit status: ${config.label}`}
    >
      {showIcon && <span className="flex-shrink-0">{config.icon}</span>}
      {showText && <span>{config.label}</span>}
    </span>
  );
};

export default BenefitStatusBadge;
```

**Testing Requirements:**
- ✅ Renders correct status for each state
- ✅ Colors visible in light mode (≥4.5:1 contrast)
- ✅ Colors visible in dark mode (≥4.5:1 contrast)
- ✅ Size variants display correctly
- ✅ Icon/text can be hidden independently
- ✅ Responsive (shrinks on mobile if needed)
- ✅ ARIA labels present and accurate

---

### 8.3 BenefitsFilterBar Component

**File:** `/src/features/benefits/components/filters/BenefitsFilterBar.tsx`

**Purpose:** Display filter buttons and allow users to filter benefits by status.

**Props Interface:**
```typescript
interface BenefitsFilterBarProps {
  benefits: UserBenefit[];
  selectedFilter: 'all' | 'active' | 'expiring' | 'expired' | 'claimed';
  onFilterChange: (filter: string) => void;
  className?: string;
}
```

**Component Behavior:**

1. **Calculate Counts**
   - Use `countByStatus()` helper to count benefits in each category
   - Re-calculate when benefits list changes

2. **Display Filter Options**
   - Show 5 filter buttons: All, Active, Expiring, Expired, Claimed
   - Display count for each filter (except "All")
   - Highlight currently selected filter

3. **Responsive Layout**
   - Desktop (>600px): Row of pills with text
   - Mobile (<600px): Dropdown select or horizontal scroll

4. **Interactions**
   - Click button: `onFilterChange('active')` etc.
   - Highlight selected button with background color
   - Show count of matching benefits
   - "Clear All" button to reset to 'all'

5. **Empty State**
   - When no benefits match filter, show message

**Example Render:**

```typescript
const BenefitsFilterBar: React.FC<BenefitsFilterBarProps> = ({
  benefits,
  selectedFilter,
  onFilterChange,
  className = ''
}) => {
  const counts = countByStatus(benefits);
  
  const filters = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'active', label: 'Active', count: counts.active },
    { id: 'expiring', label: 'Expiring Soon', count: counts.expiring },
    { id: 'expired', label: 'Expired', count: counts.expired },
    { id: 'claimed', label: 'Claimed', count: counts.claimed },
  ];

  const isDesktop = true; // Use useMediaQuery hook for actual responsive

  if (isDesktop) {
    return (
      <div className={`flex flex-wrap gap-2 items-center ${className}`}>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Filter by Status:
        </span>
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={`
                px-4 py-2 rounded-full text-sm font-medium
                transition-colors whitespace-nowrap
                ${selectedFilter === filter.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                }
              `}
              aria-pressed={selectedFilter === filter.id}
              aria-label={`Filter by ${filter.label}, ${filter.count} results`}
            >
              {filter.label}
              {filter.id !== 'all' && <span className="ml-1 text-xs">({filter.count})</span>}
            </button>
          ))}
        </div>
        {selectedFilter !== 'all' && (
          <button
            onClick={() => onFilterChange('all')}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  } else {
    // Mobile: Dropdown select
    return (
      <select
        value={selectedFilter}
        onChange={(e) => onFilterChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg text-sm"
      >
        {filters.map(filter => (
          <option key={filter.id} value={filter.id}>
            {filter.label} ({filter.count})
          </option>
        ))}
      </select>
    );
  }
};

export default BenefitsFilterBar;
```

**Testing Requirements:**
- ✅ Displays all 5 filter options
- ✅ Shows correct count for each filter
- ✅ Highlights currently selected filter
- ✅ Calls onFilterChange when button clicked
- ✅ "Clear All" button works
- ✅ Responsive layout on mobile/desktop
- ✅ Dark mode colors correct
- ✅ ARIA labels and role attributes

---

### 8.4 Index File for Indicators & Filters

**File:** `/src/features/benefits/components/indicators/index.ts`

```typescript
export { default as ResetIndicator } from './ResetIndicator';
export { default as BenefitStatusBadge } from './BenefitStatusBadge';
export type { ResetIndicatorProps } from './ResetIndicator';
export type { BenefitStatusBadgeProps } from './BenefitStatusBadge';
```

**File:** `/src/features/benefits/components/filters/index.ts`

```typescript
export { default as BenefitsFilterBar } from './BenefitsFilterBar';
export type { BenefitsFilterBarProps } from './BenefitsFilterBar';
```

**File:** `/src/features/benefits/components/index.ts` (UPDATED)

```typescript
// ... existing exports ...
export { ResetIndicator, BenefitStatusBadge } from './indicators';
export { BenefitsFilterBar } from './filters';
export type { ResetIndicatorProps, BenefitStatusBadgeProps } from './indicators';
export type { BenefitsFilterBarProps } from './filters';
```

---

## 9. User Experience & Visual Design

### 9.1 Visual Hierarchy on Benefit Cards

**BenefitsGrid Layout** (existing):

```
┌─────────────────────────────────────┐
│ [Icon] Dining Credit    [✓ Active] ← STATUS BADGE (NEW)
├─────────────────────────────────────┤
│ $200/month                          │
│                                     │
│ ⏰ Resets Mar 1 (3 days left)      ← RESET INDICATOR (NEW)
├─────────────────────────────────────┤
│ [Mark Used] [Edit] [Delete]         │
└─────────────────────────────────────┘
```

**BenefitsList Layout** (existing):

```
┌──────────────────────────────────────┐
│ [Icon] Dining Credit   [✓ Active]   │ ← STATUS BADGE (NEW)
│ $200/month                           │
│ Used for dining purchases at         │
│ eligible restaurants                 │
│ ⏰ Resets Mar 1 (3 days left)       │ ← RESET INDICATOR (NEW)
│ [Mark Used] [Edit] [Delete]          │
└──────────────────────────────────────┘
```

### 9.2 Color Scheme Reference

**Green (Active):**
- Light mode: `bg-green-100` `text-green-800`
- Dark mode: `bg-green-900` `text-green-100`

**Orange (Expiring):**
- Light mode: `bg-orange-100` `text-orange-800`
- Dark mode: `bg-orange-900` `text-orange-100`

**Red (Expired):**
- Light mode: `bg-red-100` `text-red-800`
- Dark mode: `bg-red-900` `text-red-100`

**Blue (Claimed):**
- Light mode: `bg-blue-100` `text-blue-800`
- Dark mode: `bg-blue-900` `text-blue-100`

**Gray (Neutral):**
- Light mode: `text-gray-600`
- Dark mode: `text-gray-400`

### 9.3 Filter Bar Placement & Styling

**Desktop View:**
```
┌────────────────────────────────────────────────────┐
│ Card Name: [Amex Platinum]                         │
├────────────────────────────────────────────────────┤
│ Filter by Status:                                  │
│ [All] [Active] [Expiring (3)] [Expired] [Claimed]  │
│                                [Clear Filters]     │
├────────────────────────────────────────────────────┤
│ View: [Grid] [List] [Table]                        │
├────────────────────────────────────────────────────┤
│ [Benefits Grid/List/Table Here]                    │
└────────────────────────────────────────────────────┘
```

**Mobile View:**
```
┌──────────────────────────────────┐
│ Card: [Amex ▼]                   │
├──────────────────────────────────┤
│ Filter: [All ▼]                  │
│ Showing 5 of 12 benefits         │
├──────────────────────────────────┤
│ [Benefits Grid/List Here]        │
└──────────────────────────────────┘
```

### 9.4 Urgency Indicator Visual Cues

**7+ Days Remaining (Normal):**
- Text: Gray
- Icon: ⏰
- Font: Regular weight
- Message: "Resets Mar 15 (10 days left)"

**3-7 Days Remaining (Warning):**
- Text: Orange
- Icon: ⏰
- Font: Regular weight (or semibold)
- Message: "Resets Mar 8 (3 days left)"

**< 3 Days Remaining (Urgent):**
- Text: Red + BOLD
- Icon: ⚠️
- Font: Bold (700+)
- Message: "⚠️ RESETS SOON: Mar 5 (1 day left)"
- Background: Optional light red background

**Expired (Past Period):**
- Text: Gray + Strikethrough
- Icon: ⏰
- Font: Regular
- Message: "Expired - Was Feb 28"

### 9.5 Dark Mode Considerations

**Contrast Requirements:**
- All text must maintain ≥4.5:1 contrast ratio
- Verify with dark mode enabled:
  - Orange on dark background must be visible
  - Text in badges must be readable
  - Icons must be visible

**Implementation:**
```tailwind
/* Light mode (default) */
<span class="text-orange-600 bg-white">Warning</span>

/* Dark mode (with dark: prefix) */
<span class="text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800">Warning</span>
```

### 9.6 Responsive Behavior & Breakpoints

**375px (Mobile):**
- Filter bar: Dropdown select (not pill buttons)
- Reset indicator: Truncate with ellipsis
- Status badge: Icon only (hide text) or text only
- Buttons: Stack vertically or hide secondary actions

**768px (Tablet):**
- Filter bar: Wrap to 2-3 rows
- Reset indicator: Full text visible
- Status badge: Icon + text
- Buttons: Inline

**1440px (Desktop):**
- Filter bar: Single row
- Reset indicator: Full text
- Status badge: Icon + text
- Buttons: Inline with spacing

---

## 10. User Flows & Workflows

### 10.1 Primary Flow: User Views Benefits and Applies Filters

```
START: User navigates to Card Detail Page
  ↓
1. Page loads: All benefits displayed (BenefitsGrid)
   - Each benefit shows: Name, Value, ResetIndicator, StatusBadge
   - BenefitsFilterBar shows all available filters with counts
   ↓
2. User sees benefit "Dining Credit" with:
   - 🟠 StatusBadge = "Expiring Soon"
   - ⏰ ResetIndicator = "Resets Mar 1 (3 days left)"
   ↓
3. User wants to focus on expiring benefits:
   - Clicks [Expiring (3)] filter button
   - BenefitsFilterBar highlights "Expiring Soon" button
   ↓
4. Page filters to show only 3 expiring benefits
   - Benefits list updates immediately
   - Other benefits temporarily hidden
   - "Clear Filters" button appears
   ↓
5. User marks one benefit as used:
   - Clicks "Mark Used" button on "Dining Credit"
   - StatusBadge changes to "✓ Claimed" (blue)
   - Benefit is now filtered out of "Expiring Soon" view
   ↓
6. User clicks [Clear Filters] or [All]
   - All benefits displayed again
   - See full list with all statuses
   ↓
END: User has full visibility and can take action

```

### 10.2 Alternative Flow: Expired Benefit Reminder

```
START: User views dashboard
  ↓
1. User sees benefit with:
   - 🔴 StatusBadge = "Expired"
   - ⏰ ResetIndicator = "Expired - Was Feb 28"
   ↓
2. User realizes benefit window closed but hasn't reset yet
   - Checks if it resets automatically (yes, on next cron run)
   - Or manually clicks to acknowledge
   ↓
3. Next day:
   - Cron job runs and resets the expired benefit
   - Status changes back to "Active"
   - New reset date shows "Resets Mar 31"
   ↓
END: Benefit is now available again

```

### 10.3 Mobile-Specific Flow

```
START: User on mobile (375px)
  ↓
1. Page loads with dropdown filter instead of pills
   - Filter selector: [All ▼]
   - Shows: "Showing 5 of 12 benefits"
   ↓
2. User taps [All ▼] dropdown
   - Shows: All (12), Active (8), Expiring (3), Expired (0), Claimed (1)
   ↓
3. User selects "Expiring Soon"
   - Dropdown closes
   - List updates to show 3 benefits
   - Heading shows: "Showing 3 of 12 benefits"
   ↓
4. User scrolls and taps "Mark Used" on a benefit
   - Confirmation toast appears
   - Benefit moves to "Claimed" status
   ↓
5. User taps dropdown again to switch to "Claimed" filter
   - Now sees: "Showing 1 of 12 benefits"
   ↓
END: Mobile user successfully filtered and took action

```

### 10.4 State Transitions

**Benefit Status State Machine:**

```
                    ┌─────────────┐
                    │   OneTime   │
                    └─────────────┘
                           │
                    ┌──────┴──────┐
                    ↓             ↓
              Not Claimed      Claimed
                    │             │
                    ↓             ↓
              "Active"         "Claimed" ✓
                    │
         ┌──────────┴──────────┐
         ↓                     ↓
    ≥7 days left        <3 days left
         │                     │
         ↓                     ↓
    "Active"             "Expiring Soon"
    (green)              (orange)
         │                     │
         └──────────┬──────────┘
                    ↓
            Expiration reached
                    ↓
              "Expired" 🔴
         (until reset by cron)
                    ↓
            Cron reset job
                    ↓
           Back to "Active"
            (new expiration date)
```

**User Actions:**
- Click "Mark Used" → Change status to "Claimed"
- Expiration time passes → Change status to "Expired"
- Cron reset job runs → Reset to "Active" with new expiration

---

## 11. Edge Cases & Error Handling

### 11.1 Edge Case: OneTime Benefits

**Scenario:** Benefit with `resetCadence = 'OneTime'` has no automatic reset.

**Expected Behavior:**
- ✅ ResetIndicator: Shows nothing (return null)
- ✅ StatusBadge: Shows "Active" (green) if not used, "✓ Claimed" if used
- ✅ FilterBar: Can be filtered by "Active" or "Claimed" status
- ✅ No countdown timer shown

**Test Case:**
```typescript
const oneTimeBenefit: UserBenefit = {
  ...benefitDefaults,
  resetCadence: 'OneTime',
  expirationDate: null
};

// ResetIndicator should return null
expect(ResetIndicator({ expirationDate: null, resetCadence: 'OneTime' })).toBeNull();

// StatusBadge should show "Active" if not used
expect(getBenefitStatus(oneTimeBenefit)).toBe('active');
```

### 11.2 Edge Case: Null or Missing Expiration Date

**Scenario:** Benefit has no expiration date (data inconsistency).

**Expected Behavior:**
- ✅ ResetIndicator: Show "No reset date" placeholder or empty
- ✅ StatusBadge: Still determine status based on `isUsed` and cadence
- ✅ No crashes or console errors

**Test Case:**
```typescript
const noExpirationBenefit: UserBenefit = {
  ...benefitDefaults,
  resetCadence: 'Monthly',
  expirationDate: null,
  isUsed: false
};

// ResetIndicator should show placeholder
expect(ResetIndicator({ expirationDate: null, resetCadence: 'Monthly' }))
  .toContain('No reset date');

// StatusBadge should still work
expect(getBenefitStatus(noExpirationBenefit)).toBe('active');
```

### 11.3 Edge Case: Benefit Just Expired (at reset boundary)

**Scenario:** Current time is exactly at expirationDate (e.g., 2025-03-31T23:59:59Z).

**Expected Behavior:**
- ✅ ResetIndicator: Shows "0 days left" or "< 1 day left"
- ✅ StatusBadge: Shows "Expired" (red) OR "Expiring Soon" depending on exact comparison
- ✅ Next cron run: Benefit resets to new period

**Test Case:**
```typescript
const now = new Date('2025-03-31T23:59:59Z');
const benefit = {
  ...benefitDefaults,
  expirationDate: now,
  isUsed: false
};

// Days left should be ~0
expect(getDaysUntilReset(benefit.expirationDate)).toBe(0);

// Status should be "expiring" or "expired" depending on logic
const status = getBenefitStatus(benefit, now);
expect(['expiring', 'expired']).toContain(status);
```

### 11.4 Edge Case: Benefit Marked Used Multiple Times

**Scenario:** User clicks "Mark Used" button twice (race condition).

**Expected Behavior:**
- ✅ First click: API call, `isUsed` becomes true, status → "Claimed"
- ✅ Second click: API call ignored (already true) or returns error gracefully
- ✅ StatusBadge: Still shows "Claimed"
- ✅ Button: Disabled after first click (or hidden)

**Test Case:**
```typescript
// Simulate rapid clicks
fireEvent.click(markUsedButton);
fireEvent.click(markUsedButton); // Should not make 2nd API call

// Only one API call should be made
expect(mockApiCall).toHaveBeenCalledTimes(1);

// Status should be claimed
expect(statusBadge).toHaveTextContent('Claimed');
```

### 11.5 Edge Case: Empty Benefit List / No Benefits Match Filter

**Scenario:** User applies filter to status with 0 matching benefits.

**Expected Behavior:**
- ✅ Grid/List shows empty state message
- ✅ Message: "No benefits found. Try adjusting filters."
- ✅ Quick link to clear filters or go back
- ✅ FilterBar still visible (can change filter)

**Test Case:**
```typescript
const noExpiring = benefits.filter(b => getBenefitStatus(b) !== 'expiring');

// When filtering for 'expiring' with 0 results
const filtered = filterByStatus(noExpiring, 'expiring');
expect(filtered).toHaveLength(0);

// UI should show empty state
expect(screen.getByText(/No benefits found/)).toBeInTheDocument();
```

### 11.6 Edge Case: Filter Count Changes During Session

**Scenario:** User marks a benefit as used while "Expiring" filter is active.

**Expected Behavior:**
- ✅ Benefit moves from "Expiring" to "Claimed" status
- ✅ Filter counts in BenefitsFilterBar update automatically
- ✅ Benefit removed from current view (was filtered to "Expiring")
- ✅ Count badge changes from "3" to "2"

**Test Case:**
```typescript
let benefits = [
  { ...benefit1, resetCadence: 'Monthly', expirationDate: twoDaysAway, isUsed: false }, // Expiring
  { ...benefit2, resetCadence: 'Monthly', expirationDate: twoDaysAway, isUsed: false }, // Expiring
  { ...benefit3, resetCadence: 'Monthly', expirationDate: tenDaysAway, isUsed: false }  // Active
];

// Initial count: 2 expiring
expect(countByStatus(benefits).expiring).toBe(2);

// User marks benefit1 as used
benefits[0].isUsed = true;

// Count should update
expect(countByStatus(benefits).expiring).toBe(1);
expect(countByStatus(benefits).claimed).toBe(1);

// Benefit1 should not appear in "expiring" filter
const filtered = filterByStatus(benefits, 'expiring');
expect(filtered).not.toContainEqual(benefits[0]);
```

### 11.7 Edge Case: Timezone Conversion Issues

**Scenario:** User in Pacific timezone, benefit expires 2025-03-31 in UTC.

**Expected Behavior:**
- ✅ expirationDate stored in UTC (2025-03-31T23:59:59Z)
- ✅ Displayed in user's local timezone
- ✅ Countdown calculated correctly regardless of timezone
- ✅ No DST (daylight saving time) issues

**Note:** All calculations use UTC. Conversion to user's local timezone happens in display layer only.

### 11.8 Edge Case: Rapid Filter Switching

**Scenario:** User rapidly clicks multiple filter buttons.

**Expected Behavior:**
- ✅ Last clicked filter wins (state resolves correctly)
- ✅ No UI jank or layout shift
- ✅ Each click debounced/throttled if needed
- ✅ No lost updates

**Test Case:**
```typescript
// Rapid clicks: Active → Expiring → All
fireEvent.click(activeFilter);
fireEvent.click(expiringFilter);
fireEvent.click(allFilter);

// Should end up with "all" filter
expect(selectedFilter).toBe('all');

// Each change should trigger onFilterChange
expect(mockOnFilterChange).toHaveBeenCalledTimes(3);
```

### 11.9 Edge Case: Browser Back Button After Filtering

**Scenario:** User applies filter, then clicks browser back button.

**Expected Behavior:**
- ✅ If filter state in URL: Returns to previous filter state
- ✅ If filter state in component state only: Returns to previous page
- ✅ No error messages
- ✅ UI matches URL state

**Implementation Note:** Requires filter state in URL params (`?filter=expiring`) or browser history API.

### 11.10 Edge Case: Deleted Benefit

**Scenario:** User sees benefit in list, but it gets deleted from DB.

**Expected Behavior:**
- ✅ Benefit disappears from grid/list on next refresh
- ✅ Filter counts update automatically
- ✅ No console errors
- ✅ No broken references

### 11.11 Edge Case: Very Large Benefit Count (100+)

**Scenario:** Card with 100+ benefits (unlikely but possible).

**Expected Behavior:**
- ✅ All benefits render in <500ms
- ✅ Filter applies in <100ms
- ✅ No memory leaks or performance degradation
- ✅ Pagination optional (Phase 2)

**Test Case:**
```typescript
const largeBenefitSet = Array.from({ length: 100 }, (_, i) => ({
  ...benefitDefaults,
  id: `benefit-${i}`,
  name: `Benefit ${i}`,
  resetCadence: ['Monthly', 'CalendarYear', 'OneTime'][i % 3]
}));

// Render with performance measurement
const startTime = performance.now();
render(<BenefitsGrid benefits={largeBenefitSet} />);
const renderTime = performance.now() - startTime;

expect(renderTime).toBeLessThan(500); // <500ms
```

### 11.12 Edge Case: Benefit with Future Expiration Date

**Scenario:** Due to data import error, benefit has expiration date 5 years in future.

**Expected Behavior:**
- ✅ ResetIndicator shows "Resets [Year] ([~1800] days left)"
- ✅ StatusBadge shows "Active" (not expiring soon)
- ✅ No error or crash
- ✅ Counts correctly in "active" filter

---

## 12. API & Integration Points

### 12.1 Existing API: GET /api/cards/my-cards

**Purpose:** Fetch all cards and benefits for a user.

**No Changes Required** for Phase 1. The API already returns complete UserBenefit data.

**Response Structure (Relevant Fields):**
```json
{
  "success": true,
  "cards": [
    {
      "id": "card-123",
      "issuer": "American Express",
      "cardName": "Platinum Card",
      "customName": "My Amex Plat",
      "benefits": [
        {
          "id": "benefit-456",
          "name": "Airline Fee Credit",
          "type": "StatementCredit",
          "stickerValue": 25000,
          "resetCadence": "CalendarYear",
          "expirationDate": "2025-12-31T23:59:59Z",
          "isUsed": false,
          "claimedAt": null,
          "status": "ACTIVE"
        }
      ]
    }
  ]
}
```

### 12.2 Existing API: PATCH /api/benefits/[id]/toggle-used

**Purpose:** Mark a benefit as used or unclaimed.

**No Changes Required** for Phase 1.

**Request:**
```
PATCH /api/benefits/{benefitId}/toggle-used
Content-Type: application/json

{
  "isUsed": true
}
```

**Response:**
```json
{
  "success": true,
  "benefit": {
    "id": "benefit-456",
    "isUsed": true,
    "timesUsed": 1,
    "claimedAt": "2025-03-25T14:30:00Z"
  }
}
```

### 12.3 No New API Endpoints Required

Phase 1 works entirely with existing API endpoints. Future phases may add:
- Period-specific usage tracking endpoint
- Progress bar data endpoint
- Analytics endpoint

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Location:** `/src/features/benefits/__tests__/`

**Test Files to Create:**

1. **`periodCalculations.test.ts`**
   - Test `getDaysUntilReset()` with various dates
   - Test `isUrgent()`, `isWarning()` thresholds
   - Test `isExpiredBenefit()`
   - Test `formatResetDate()`
   - Test `getPeriodLabel()`

```typescript
describe('periodCalculations', () => {
  it('should calculate days until reset correctly', () => {
    const now = new Date('2025-03-25T00:00:00Z');
    const expirationDate = new Date('2025-03-31T23:59:59Z');
    expect(getDaysUntilReset(expirationDate)).toBe(6);
  });

  it('should identify urgent benefits (< 3 days)', () => {
    expect(isUrgent(2)).toBe(true);
    expect(isUrgent(3)).toBe(false);
  });

  it('should handle null expiration date', () => {
    expect(getDaysUntilReset(null)).toBe(0);
  });
});
```

2. **`benefitFilters.test.ts`**
   - Test `getBenefitStatus()` for all status combinations
   - Test `filterByStatus()`
   - Test `applyFilters()`
   - Test `countByStatus()`

```typescript
describe('benefitFilters', () => {
  it('should correctly determine benefit status', () => {
    const activeBenefit = {
      ...benefitDefaults,
      expirationDate: tenDaysFromNow,
      isUsed: false
    };
    expect(getBenefitStatus(activeBenefit)).toBe('active');
  });

  it('should count benefits by status', () => {
    const benefits = [
      { ...benefitDefaults, isUsed: false, expirationDate: tenDaysFromNow }, // active
      { ...benefitDefaults, isUsed: true },  // claimed
      { ...benefitDefaults, isUsed: false, expirationDate: twoDaysFromNow }  // expiring
    ];
    const counts = countByStatus(benefits);
    expect(counts.active).toBe(1);
    expect(counts.claimed).toBe(1);
    expect(counts.expiring).toBe(1);
  });
});
```

### 13.2 Component Tests

**Framework:** Vitest + React Testing Library

**Test Files to Create:**

1. **`ResetIndicator.test.tsx`**
   - Renders countdown correctly
   - Color changes with urgency
   - Handles OneTime benefits
   - Handles null dates
   - Responsive on mobile
   - Dark mode support

```typescript
describe('<ResetIndicator />', () => {
  it('should display countdown with correct urgency color', () => {
    const expirationDate = addDays(new Date(), 3);
    const { getByText } = render(
      <ResetIndicator
        expirationDate={expirationDate}
        resetCadence="Monthly"
      />
    );
    expect(getByText(/Resets/)).toHaveClass('text-orange-600');
  });

  it('should return null for OneTime benefits', () => {
    const { container } = render(
      <ResetIndicator
        expirationDate={null}
        resetCadence="OneTime"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
```

2. **`BenefitStatusBadge.test.tsx`**
   - Renders correct status for each state
   - Colors are correct
   - Icon and text can be toggled
   - Size variants work
   - Dark mode support
   - ARIA labels present

```typescript
describe('<BenefitStatusBadge />', () => {
  it('should render "Active" status with green color', () => {
    const { getByText } = render(
      <BenefitStatusBadge
        status="active"
        isUsed={false}
        resetCadence="Monthly"
        expirationDate={addDays(new Date(), 7)}
      />
    );
    expect(getByText('Active')).toHaveClass('bg-green-100');
  });

  it('should have proper ARIA label', () => {
    const { getByRole } = render(
      <BenefitStatusBadge
        status="expiring"
        isUsed={false}
        resetCadence="Monthly"
        expirationDate={addDays(new Date(), 2)}
      />
    );
    expect(getByRole('status')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Expiring')
    );
  });
});
```

3. **`BenefitsFilterBar.test.tsx`**
   - All filter options render
   - Counts display correctly
   - Selected filter is highlighted
   - onFilterChange called correctly
   - Clear All button works
   - Responsive layout

```typescript
describe('<BenefitsFilterBar />', () => {
  it('should display correct count for each filter', () => {
    const benefits = [
      { ...benefit1, isUsed: false, expirationDate: tenDaysFromNow }, // active
      { ...benefit2, isUsed: true },  // claimed
    ];
    const { getByText } = render(
      <BenefitsFilterBar
        benefits={benefits}
        selectedFilter="all"
        onFilterChange={() => {}}
      />
    );
    expect(getByText(/Claimed \(1\)/)).toBeInTheDocument();
  });

  it('should call onFilterChange when filter clicked', () => {
    const mockOnFilterChange = jest.fn();
    const { getByText } = render(
      <BenefitsFilterBar
        benefits={[]}
        selectedFilter="all"
        onFilterChange={mockOnFilterChange}
      />
    );
    fireEvent.click(getByText('Active'));
    expect(mockOnFilterChange).toHaveBeenCalledWith('active');
  });
});
```

### 13.3 Integration Tests

**Test File:** `/src/features/benefits/__tests__/integration.test.tsx`

```typescript
describe('Benefits Filter Integration', () => {
  it('should filter benefits and update display', async () => {
    const { getByText, queryByText } = render(
      <BenefitsPage benefits={mockBenefits} />
    );

    // Initially shows all benefits
    expect(getByText('Dining Credit')).toBeInTheDocument();
    expect(getByText('Travel Insurance')).toBeInTheDocument();

    // Click "Expiring Soon" filter
    fireEvent.click(getByText('Expiring Soon'));

    // Should now only show expiring benefits
    expect(getByText('Dining Credit')).toBeInTheDocument();
    expect(queryByText('Travel Insurance')).not.toBeInTheDocument();
  });
});
```

### 13.4 Visual Regression Tests

**Tool:** Percy or similar

- Light mode screenshots of all components
- Dark mode screenshots of all components
- Mobile (375px) layout
- Tablet (768px) layout
- Desktop (1440px) layout

---

## 14. Accessibility & Compliance

### 14.1 WCAG 2.1 AA Checklist

| Criterion | Status | Implementation |
|-----------|--------|-----------------|
| 1.4.3 Contrast (Minimum) | ✅ | Text color ≥4.5:1 ratio to background |
| 2.1.1 Keyboard | ✅ | All interactive elements keyboard accessible (Tab/Enter) |
| 2.4.3 Focus Order | ✅ | Tab order is logical and visible |
| 2.4.7 Focus Visible | ✅ | Focus indicators visible on all buttons |
| 3.2.1 On Focus | ✅ | No unexpected context changes on focus |
| 4.1.2 Name, Role, Value | ✅ | Semantic HTML, ARIA labels |
| 4.1.3 Status Messages | ✅ | `role="status"` on status indicators |

### 14.2 Component Accessibility Features

**ResetIndicator:**
- ✅ `aria-label="Benefit resets on [date]"`
- ✅ Semantic text (not just color coding)
- ✅ Icon has `aria-hidden="true"`

**BenefitStatusBadge:**
- ✅ `role="status"`
- ✅ `aria-label="Benefit status: [status]"`
- ✅ Color + icon + text (not color alone)
- ✅ Semantic `<span>` element

**BenefitsFilterBar:**
- ✅ Buttons are semantic `<button>` elements
- ✅ `aria-pressed` indicates selected state
- ✅ `aria-label` describes each filter option
- ✅ Keyboard Tab/Enter navigation works
- ✅ On mobile: `<select>` dropdown is native HTML

### 14.3 Dark Mode Accessibility

**Color Contrast Testing:**
- Use axe DevTools to verify ≥4.5:1 in both light and dark modes
- Orange text on dark gray background: Check ratio
- Test with Chrome DevTools color picker

**Implementation:**
```css
/* Ensures visibility in both light and dark modes */
.reset-indicator {
  @apply text-orange-600 dark:text-orange-400;
  /* Verify contrast: orange-400 on dark-gray background ≥4.5:1 */
}
```

---

## 15. Performance & Scalability

### 15.1 Performance Targets

| Operation | Target | Measurement |
|-----------|--------|------------|
| Render 100 benefits | <500ms | React DevTools Profiler |
| Apply filter | <100ms | Stopwatch / timing |
| Component mount | <50ms each | React DevTools Profiler |
| Re-render on filter change | <200ms | React DevTools Profiler |
| Bundle size increase | <50KB gzipped | `npm run build` + bundlesize analyzer |

### 15.2 Optimization Strategies

**Code-Splitting:**
- LazyLoad BenefitsFilterBar if not immediately visible
- Dynamically import indicator components if needed

**Memoization:**
- Wrap components with `React.memo()` to prevent unnecessary re-renders
- Use `useCallback()` for onFilterChange handler
- Use `useMemo()` for expensive calculations (countByStatus)

```typescript
// Memoize helper function results
const counts = useMemo(
  () => countByStatus(benefits),
  [benefits]
);

// Memoize filter handler
const handleFilterChange = useCallback(
  (filter: string) => {
    setSelectedFilter(filter);
  },
  []
);

// Memoize component
export default React.memo(BenefitsFilterBar);
```

**Rendering Optimization:**
- Use `virtualScroll` for lists 100+ items (future phase)
- Avoid re-renders of entire list on single benefit change
- Use key={benefit.id} for list items

### 15.3 Scalability Considerations

**For 100+ Benefits:**
- ✅ Helper functions (calculateStatus, countByStatus) are O(n) - acceptable
- ✅ Filter logic is O(n) - acceptable
- ✅ Re-renders can be optimized with React.memo
- ✅ Consider pagination for 500+ benefits (Phase 2)

**Database Query Optimization:**
- ✅ No new queries required (uses existing /api/cards/my-cards)
- ✅ Index on userCardId already exists
- ✅ Phase 2 may add new indexes for period-specific data

---

## 16. Deployment & Rollout

### 16.1 Feature Flag Strategy

**Environment Variable:**
```bash
# .env.local
NEXT_PUBLIC_FEATURE_PHASE1_BENEFITS=true
```

**Code Implementation:**
```typescript
// Conditional rendering
if (process.env.NEXT_PUBLIC_FEATURE_PHASE1_BENEFITS === 'true') {
  return <BenefitsFilterBar {...props} />;
} else {
  return <OldFilterImplementation {...props} />;
}
```

**Deployment:**
1. Deploy code with feature flag **OFF** (default false)
2. Verify build succeeds
3. Deploy to staging
4. Run QA tests with flag ON
5. Enable flag in production (can be toggled live)
6. Monitor error rates
7. Disable flag if critical issues found (instant rollback)

### 16.2 Rollout Phases

**Phase A: Internal Testing**
- Deploy with flag OFF
- QA enables flag and runs full test suite
- Developers verify code quality
- Duration: 2-3 days

**Phase B: Staging**
- Deploy to staging environment with flag ON
- User acceptance testing (if applicable)
- Performance testing (Lighthouse audit)
- Duration: 2-3 days

**Phase C: Production Gradual Rollout**
- Deploy to production with flag OFF
- Monitor build size, error rates, performance
- Enable flag for 10% of users
- Monitor for 24 hours
- Expand to 50% of users
- Monitor for 24 hours
- Expand to 100% of users

**Phase D: Post-Deployment**
- Monitor error rates for 1 week
- Track user engagement metrics
- Gather feedback
- Plan Phase 2 based on learnings

### 16.3 Monitoring & Alerts

**Metrics to Track:**
- Component render performance (React DevTools)
- Error rate increase (Sentry)
- Bundle size (Vercel)
- User engagement (Analytics: clicks on filters, etc.)
- Accessibility violations (axe-core automated)

**Alerts:**
- Alert if error rate increases >5%
- Alert if performance metric >500ms
- Alert if bundle size increases >100KB

### 16.4 Rollback Plan

**If Critical Issues Found:**
1. Disable feature flag: `NEXT_PUBLIC_FEATURE_PHASE1_BENEFITS=false`
2. No code revert required (feature hidden)
3. Investigate issue in staging
4. Fix code
5. Re-enable flag

**If Must Revert Code:**
1. `git revert` the phase 1 commit
2. Deploy reverted code
3. No database changes to migrate back (safe)

---

## 17. Implementation Tasks

### 17.1 Task Breakdown

**Phase 1: Setup & Preparation**

| Task ID | Title | Description | Complexity | Est. Hours |
|---------|-------|-------------|-----------|-----------|
| T1-1 | Create directory structure | Create `/src/features/benefits/components/indicators/`, `/filters/` directories | Small | 0.5 |
| T1-2 | Create type definitions | Define ResetIndicatorProps, BenefitStatusBadgeProps, BenefitsFilterBarProps interfaces | Small | 1 |
| T1-3 | Create helper functions | Implement periodCalculations.ts (getDaysUntilReset, isUrgent, etc.) | Medium | 2 |
| T1-4 | Create filter logic | Implement benefitFilters.ts (getBenefitStatus, filterByStatus, countByStatus) | Medium | 2 |

**Phase 1: Component Development**

| Task ID | Title | Description | Complexity | Est. Hours |
|---------|-------|-------------|-----------|-----------|
| T1-5 | ResetIndicator component | Build ResetIndicator.tsx with countdown logic and urgency coloring | Medium | 3 |
| T1-6 | BenefitStatusBadge component | Build BenefitStatusBadge.tsx with status logic and color coding | Medium | 2 |
| T1-7 | BenefitsFilterBar component | Build BenefitsFilterBar.tsx with responsive layout (desktop/mobile) | Medium | 3 |
| T1-8 | Component exports | Create index.ts files for proper module exports | Small | 0.5 |

**Phase 1: Component Integration**

| Task ID | Title | Description | Complexity | Est. Hours |
|---------|-------|-------------|-----------|-----------|
| T1-9 | Update BenefitsGrid | Add ResetIndicator and BenefitStatusBadge to grid cards | Medium | 2 |
| T1-10 | Update BenefitsList | Add ResetIndicator and BenefitStatusBadge to list cards | Medium | 2 |
| T1-11 | Update BenefitTable | Add ResetIndicator column and StatusBadge column | Medium | 2 |
| T1-12 | Update Card Detail page | Add BenefitsFilterBar and wire filter state to components | Medium | 3 |
| T1-13 | Update Dashboard | Add indicators to main dashboard BenefitsGrid (optional) | Small | 1 |

**Phase 1: Testing & QA**

| Task ID | Title | Description | Complexity | Est. Hours |
|---------|-------|-------------|-----------|-----------|
| T1-14 | Unit tests for helpers | Test periodCalculations.ts and benefitFilters.ts | Medium | 3 |
| T1-15 | Component tests | Test ResetIndicator, BenefitStatusBadge, BenefitsFilterBar | Medium | 4 |
| T1-16 | Integration tests | Test filter application across components | Medium | 3 |
| T1-17 | Responsive testing | Test at 375px, 768px, 1440px breakpoints | Small | 2 |
| T1-18 | Accessibility audit | Run axe DevTools, verify WCAG 2.1 AA compliance | Medium | 2 |
| T1-19 | Dark mode testing | Verify colors and contrast in dark mode | Small | 1 |
| T1-20 | Performance testing | Measure render time, bundle size, filter speed | Small | 1 |

**Phase 1: Documentation & Final**

| Task ID | Title | Description | Complexity | Est. Hours |
|---------|-------|-------------|-----------|-----------|
| T1-21 | Component documentation | Write README/JSDoc for each component | Small | 2 |
| T1-22 | Usage guide | Document how to integrate indicators/filters into new components | Small | 1 |
| T1-23 | Code review | Address PR feedback and make final adjustments | Medium | 2 |
| T1-24 | Deployment preparation | Set up feature flag, finalize deployment checklist | Small | 1 |

**Total Estimated Hours: 45-50 hours (1-1.5 weeks for 1 developer)**

### 17.2 Task Dependencies

```
T1-1 (Dir structure)
  ↓
T1-2 (Types) ─→ T1-3 (Helpers) ─→ T1-4 (Filters)
  ↓
  ├─ T1-5 (ResetIndicator)
  ├─ T1-6 (StatusBadge)  ─→ T1-8 (Exports)
  ├─ T1-7 (FilterBar)
  ↓
  ├─ T1-9 (Update Grid)
  ├─ T1-10 (Update List)  ─→ T1-12 (Wire Card Detail)
  ├─ T1-11 (Update Table)
  ↓
  ├─ T1-14, T1-15, T1-16 (Testing - parallel)
  ├─ T1-17, T1-18, T1-19, T1-20 (QA - parallel)
  ↓
  ├─ T1-21, T1-22, T1-23, T1-24 (Final - sequential)
```

---

## 18. Definition of Done

### 18.1 Development Complete

- [ ] All 4 new components implemented (ResetIndicator, StatusBadge, FilterBar, Index files)
- [ ] All helper functions implemented (periodCalculations.ts, benefitFilters.ts)
- [ ] All type definitions created and exported
- [ ] Components integrated into BenefitsGrid, BenefitsList, BenefitTable
- [ ] Card Detail page filter bar implemented and wired
- [ ] Code compiles without errors (TypeScript strict mode)
- [ ] No ESLint warnings or errors
- [ ] Code formatted with Prettier

### 18.2 Testing Complete

- [ ] Unit tests for all helper functions (>80% coverage)
- [ ] Component tests for ResetIndicator (>80% coverage)
- [ ] Component tests for BenefitStatusBadge (>80% coverage)
- [ ] Component tests for BenefitsFilterBar (>80% coverage)
- [ ] Integration tests for filter application (>80% coverage)
- [ ] All tests passing (0 failures)
- [ ] Visual regression tests for light/dark mode passing

### 18.3 Quality Assurance

- [ ] Responsive design verified at 375px, 768px, 1440px
- [ ] Dark mode colors visible and readable (≥4.5:1 contrast)
- [ ] Accessibility audit passed (axe DevTools 0 violations)
- [ ] Keyboard navigation works (Tab/Enter/Shift+Tab)
- [ ] Touch targets ≥44x44px on mobile
- [ ] No console errors or warnings in Chrome DevTools
- [ ] Performance: 100 benefits render in <500ms
- [ ] Performance: Filter application <100ms
- [ ] Bundle size increase <50KB (gzipped)

### 18.4 Documentation Complete

- [ ] Component README files with props documentation
- [ ] Usage examples for each component
- [ ] Type definitions documented (JSDoc comments)
- [ ] Edge cases documented in code comments
- [ ] Accessibility features documented
- [ ] Dark mode implementation guide
- [ ] Integration guide for using components

### 18.5 Code Review Complete

- [ ] PR created with all changes
- [ ] At least 1 senior developer approved
- [ ] All review comments addressed
- [ ] No outstanding TODOs or FIXMEs

### 18.6 Deployment Ready

- [ ] Feature flag implemented and set to OFF by default
- [ ] Deployment checklist completed
- [ ] Staging environment tested with flag ON
- [ ] Monitoring/alerts configured
- [ ] Rollback plan documented and tested
- [ ] Team trained on flag activation

### 18.7 Post-Deployment Verification

- [ ] Feature flag successfully enabled in production
- [ ] Error rate monitoring shows no spike
- [ ] Performance metrics within expected range
- [ ] User feedback collected and reviewed
- [ ] No critical issues reported

---

## Appendix A: File Structure Reference

```
src/
├── features/
│   └── benefits/
│       ├── components/
│       │   ├── indicators/                    [NEW]
│       │   │   ├── ResetIndicator.tsx
│       │   │   ├── BenefitStatusBadge.tsx
│       │   │   └── index.ts
│       │   ├── filters/                       [NEW]
│       │   │   ├── BenefitsFilterBar.tsx
│       │   │   └── index.ts
│       │   ├── grids/
│       │   │   ├── BenefitsGrid.tsx           [UPDATED]
│       │   │   └── BenefitsList.tsx           [UPDATED]
│       │   ├── BenefitTable.tsx               [UPDATED]
│       │   ├── modals/
│       │   └── index.ts                       [UPDATED]
│       ├── lib/
│       │   ├── benefitDates.ts                [EXISTING]
│       │   ├── periodCalculations.ts          [NEW]
│       │   ├── benefitFilters.ts              [NEW]
│       │   └── index.ts
│       ├── types/
│       │   └── index.ts                       [UPDATED]
│       ├── __tests__/                         [NEW]
│       │   ├── periodCalculations.test.ts
│       │   ├── benefitFilters.test.ts
│       │   ├── ResetIndicator.test.tsx
│       │   ├── BenefitStatusBadge.test.tsx
│       │   ├── BenefitsFilterBar.test.tsx
│       │   └── integration.test.tsx
│       └── actions/
└── app/
    ├── dashboard/
    │   └── page.tsx                           [OPTIONAL UPDATE]
    └── (dashboard)/
        └── card/
            └── [id]/
                └── page.tsx                   [UPDATED]
```

---

## Appendix B: Git Workflow

**Branch Name:** `feature/phase1-dashboard-benefits-ui`

**Commit Messages:**
```
feat: Add ResetIndicator component with countdown logic
feat: Add BenefitStatusBadge component with status coloring
feat: Add BenefitsFilterBar component with responsive design
feat: Integrate ResetIndicator and StatusBadge into BenefitsGrid
feat: Integrate ResetIndicator and StatusBadge into BenefitsList
feat: Integrate ResetIndicator and StatusBadge into BenefitTable
feat: Add filter UI to Card Detail page
feat: Add helper functions for period calculations and filtering
test: Add unit tests for helper functions
test: Add component tests for indicator and filter components
test: Add integration tests for filter application
refactor: Update benefits types and interfaces
docs: Add component documentation and usage guide
```

**PR Description Template:**
```
## Phase 1: Dashboard Benefits Enhancement UI

### Overview
Implements ResetIndicator, BenefitStatusBadge, and BenefitsFilterBar components to provide users with clear visual hierarchy and filter capabilities for managing credit card benefits.

### Changes
- [x] ResetIndicator component (countdown timer)
- [x] BenefitStatusBadge component (status coloring)
- [x] BenefitsFilterBar component (filter UI)
- [x] Integration into BenefitsGrid, BenefitsList, BenefitTable
- [x] Card Detail page filter bar
- [x] Helper functions for calculations and filtering
- [x] Full test coverage
- [x] Documentation

### Testing
- [x] Unit tests: 24/24 passing
- [x] Component tests: 18/18 passing
- [x] Integration tests: 5/5 passing
- [x] Responsive testing: 375px, 768px, 1440px ✓
- [x] Accessibility: WCAG 2.1 AA ✓
- [x] Dark mode: Verified ✓
- [x] Performance: <500ms for 100 benefits ✓

### Checklist
- [x] Code compiles without errors
- [x] No ESLint violations
- [x] Tests passing
- [x] Documentation complete
- [x] Ready for review
```

---

## Appendix C: Quick Reference for Developers

### Helper Function Quick Reference

**periodCalculations.ts**
- `getDaysUntilReset(expirationDate)` → number
- `isUrgent(daysLeft)` → boolean (< 3 days)
- `isWarning(daysLeft)` → boolean (3-7 days)
- `isExpiredBenefit(expirationDate)` → boolean
- `formatResetDate(date)` → string (e.g., "Mar 15")
- `getPeriodLabel(resetCadence)` → string (e.g., "Monthly")

**benefitFilters.ts**
- `getBenefitStatus(benefit)` → 'active' | 'expiring' | 'expired' | 'claimed'
- `filterByStatus(benefits, status)` → UserBenefit[]
- `applyFilters(benefits, filters)` → UserBenefit[]
- `countByStatus(benefits)` → { active, expiring, expired, claimed, all }

### Component Props Quick Reference

**ResetIndicator**
```tsx
<ResetIndicator
  expirationDate={benefit.expirationDate}
  resetCadence={benefit.resetCadence}
  isUsed={benefit.isUsed}
  isExpired={isExpiredBenefit(benefit.expirationDate)}
/>
```

**BenefitStatusBadge**
```tsx
<BenefitStatusBadge
  status={getBenefitStatus(benefit)}
  isUsed={benefit.isUsed}
  resetCadence={benefit.resetCadence}
  expirationDate={benefit.expirationDate}
  showIcon={true}
  showText={true}
  size="md"
/>
```

**BenefitsFilterBar**
```tsx
<BenefitsFilterBar
  benefits={allBenefits}
  selectedFilter={filterStatus}
  onFilterChange={setFilterStatus}
/>
```

### Status Color Reference

| Status | Color | Light Mode | Dark Mode |
|--------|-------|-----------|-----------|
| Active | Green | `bg-green-100 text-green-800` | `bg-green-900 text-green-100` |
| Expiring | Orange | `bg-orange-100 text-orange-800` | `bg-orange-900 text-orange-100` |
| Expired | Red | `bg-red-100 text-red-800` | `bg-red-900 text-red-100` |
| Claimed | Blue | `bg-blue-100 text-blue-800` | `bg-blue-900 text-blue-100` |

---

## Appendix D: Known Limitations & Future Improvements

### Phase 1 Limitations

1. **No Period-Specific Tracking** - Uses current isUsed/timesUsed (resets on period boundary)
2. **No Progress Bars** - Can't show "Used $50 of $200 this month" (requires amount tracking)
3. **No Usage History** - Can't see past claims or breakdown by month
4. **Single Filter Selection** - Can only filter by one status at a time
5. **No Partial Usage** - Benefit is either "used" or "not used" (no partial credit)

### Planned for Phase 2

1. Period-specific usage table
2. Progress bars with usage tracking
3. Multi-select filtering
4. Usage history display
5. Reset countdown badges/pins on dashboard

### Planned for Phase 3

1. Advanced analytics
2. Benefit recommendations
3. Partial usage tracking
4. Export/reporting features
5. Calendar view of resets

---

## Appendix E: Troubleshooting Guide

### "ResetIndicator shows wrong countdown"

**Problem:** Days calculated incorrectly

**Solution:**
- Verify expirationDate is in UTC (should be "2025-03-31T23:59:59Z")
- Check getDaysUntilReset calculation: `Math.ceil((expirationDate - now) / ms_per_day)`
- Ensure timezone conversion happening correctly (UTC in DB, displayed in local)

### "BenefitStatusBadge color not visible in dark mode"

**Problem:** Color contrast < 4.5:1

**Solution:**
- Verify dark: prefix is applied (e.g., `dark:text-orange-400`)
- Run axe DevTools to confirm contrast ratio
- Adjust color values if needed (use lighter shades in dark mode)

### "Filters not applying correctly"

**Problem:** Benefits not being filtered

**Solution:**
- Verify `getBenefitStatus()` is returning correct status for each benefit
- Check countByStatus counts match actual filtered results
- Verify filterByStatus is receiving correct status string ('active' not 'Active')
- Log benefit status values to console for debugging

### "Performance degrades with 100+ benefits"

**Problem:** Slow rendering or filtering

**Solution:**
- Verify components are wrapped with React.memo()
- Use useCallback() for filter handler
- Verify no unnecessary re-renders in React DevTools Profiler
- Consider implementing virtual scroll for future phase

---

## Appendix F: References & Resources

### Date Handling
- date-fns: https://date-fns.org/
- MDN Date: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
- UTC Best Practices: https://en.wikipedia.org/wiki/Coordinated_Universal_Time

### Accessibility
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- axe DevTools: https://www.deque.com/axe/devtools/
- ARIA Practices: https://www.w3.org/WAI/ARIA/apg/

### React & TypeScript
- React Hooks: https://react.dev/reference/react/hooks
- TypeScript Handbook: https://www.typescriptlang.org/docs/
- Testing Library: https://testing-library.com/

### Tailwind CSS
- Dark Mode: https://tailwindcss.com/docs/dark-mode
- Responsive Design: https://tailwindcss.com/docs/responsive-design
- Color Palettes: https://tailwindcss.com/docs/customizing-colors

---

## Summary

This technical specification provides a complete blueprint for implementing Phase 1 of the Dashboard Benefits Enhancement initiative. The specification covers:

✅ Four complementary UI components (ResetIndicator, StatusBadge, FilterBar)
✅ Integration into existing BenefitsGrid, BenefitsList, BenefitTable components
✅ Comprehensive helper functions for calculations and filtering
✅ Complete type system and interfaces
✅ User experience and visual design standards
✅ 12+ edge cases with handling strategies
✅ Full testing strategy (unit, component, integration, E2E)
✅ Accessibility compliance (WCAG 2.1 AA)
✅ Performance optimization targets
✅ Deployment and rollout plan
✅ 24 implementation tasks with time estimates
✅ Definition of done with comprehensive checklist

**The specification is implementation-ready and provides sufficient detail for a full-stack engineer to build Phase 1 without ambiguity.**

For questions or clarifications, refer to the relevant section or appendix. Phase 2 will build upon this foundation with period-specific tracking and progress bars.

---

**End of Technical Specification**

*Version 1.0 - April 7, 2026*
