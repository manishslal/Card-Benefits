---

# Period-Based Benefit Tracking — UX/UI Enhancement Specification

> **Version**: 1.0  
> **Date**: 2025-07-11  
> **Status**: Ready for Implementation  
> **Scope**: `BenefitsGrid.tsx` enhancement + new components + dashboard integration  
> **Design System**: CSS variables, Tailwind CSS, Lucide React icons

---

## 1. Executive Summary

### The Problem

Users who add an Amex Platinum card see benefits "as a whole for the full year" and can only mark them used once. The period badge (calendar icon + date range) at **BenefitsGrid.tsx lines 192–206** is a tiny `Calendar size={12}` icon with `text-xs` text in a `var(--color-bg-secondary)` background — visually identical to a metadata footnote. Most users never notice it.

**Five root causes identified from the code:**

| # | Root Cause | Code Location |
|---|-----------|---------------|
| 1 | Period range is a 12px-icon, `text-xs`, `bg-secondary` badge buried below description | `BenefitsGrid.tsx:192–206` |
| 2 | No cadence label (Monthly, Quarterly) anywhere on the card | `BenefitsGrid.tsx` — `resetCadence` not passed through `transformBenefitForGrid()` |
| 3 | "Used" button says just "Used" with no period context | `BenefitsGrid.tsx:262–267` — `<Button>Used</Button>` |
| 4 | `deduplicateBenefits()` drops ALL EXPIRED/UPCOMING rows | `benefit-utils.ts:58–66` — only `periodStatus === 'ACTIVE'` kept |
| 5 | Summary stats are period-unaware ("Total Benefits: 8") | `page.tsx:814–841` — no period-specific counting |

### The Solution

Elevate period information from a subtle annotation to a **structural element** of every benefit card. Make the period the organizing principle of the UI.

### Key Design Principles

1. **Period as Primary Context** — The period date range is the card's header banner, not a footnote
2. **Status at a Glance** — Color-coded left border + banner = instant scanability
3. **Explicit Period Actions** — "Mark Apr 2026 Used" not just "Used"
4. **Progressive Disclosure** — Show current period by default, past/future on demand
5. **Zero Ambiguity** — Cadence label + period progress = users always know what resets when

---

## 2. Jobs-to-be-Done Analysis

### Primary Job

> **When** I open my credit card dashboard each month,  
> **I want to** see which benefits I haven't used yet *this period*,  
> **so I can** claim them before they expire and not leave money on the table.

### Secondary Jobs

> **When** I'm unsure if I already used my Uber credit this month,  
> **I want to** see a clear per-period used/unused indicator,  
> **so I can** avoid double-checking my Uber app or bank statement.

> **When** the month ends and I forgot to use a benefit,  
> **I want to** see what I missed in past periods,  
> **so I can** build better habits and not miss it next month.

> **When** I add a new card with many benefits,  
> **I want to** understand which benefits reset monthly vs quarterly vs annually,  
> **so I can** plan my spending and set reminders appropriately.

### Pain Points vs Current Code

| Pain | Current Code | Impact |
|------|-------------|--------|
| Period dates invisible | `Calendar size={12}` + `text-xs` in `bg-secondary` (line 201) | Users think $15 Uber = yearly |
| No cadence info | `resetCadence` not in `transformBenefitForGrid()` (line 116–143) | Can't distinguish monthly from annual |
| Generic "Used" button | `<Button size="xs">Used</Button>` (line 266) | Users afraid it's permanent/yearly |
| Can't see past periods | `deduplicateBenefits()` keeps only ACTIVE (line 58) | No visibility into missed benefits |
| No period progress | Nothing shows "month 4 of 12" | No lifecycle awareness |

### Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Users who notice period dates | ~15% (est.) | >90% |
| Benefits marked used per period | ~30% | >70% |
| Time to understand "resets monthly" | >30s | <5s |

---

## 3. User Journey Map

### Persona: Sarah — Amex Platinum Cardholder
- **Role**: Professional, 2 premium credit cards
- **Goal**: Never miss a monthly/quarterly credit
- **Context**: Checks dashboard 2–3× per month, mostly mobile
- **Skill**: Comfortable with apps, doesn't read fine print

### Stage 1: Dashboard Landing

**Does**: Opens dashboard, sees Amex Platinum selected  
**Thinks**: "What do I need to use this month?"  
**Feels**: 😐 Neutral, task-oriented  
**Current pain**: Cards show "Uber Credit — $15 — Active" but the period "Apr 1 – Apr 30" is in tiny gray text. Sarah thinks $15 is yearly.  
**Enhanced**: Each card has a prominent green header: **"Apr 1 – Apr 30 · Monthly"** with **"$15.00"**. Immediately clear this is monthly.

### Stage 2: Scanning Benefits

**Does**: Scans grid for unused benefits  
**Thinks**: "Which ones haven't I used yet?"  
**Feels**: 😰 Anxious — hard to tell at a glance  
**Current pain**: All active cards look identical. The `size="xs"` "Used" button has same visual weight as "Edit".  
**Enhanced**: Used benefits are muted (0.7 opacity) with "✓ Used Apr 2026" overlay. Unused benefits have vibrant green left border. Scannable in <2 seconds.

### Stage 3: Marking Used

**Does**: Clicks "Used" on Uber credit  
**Thinks**: "Is this for this month or forever?"  
**Feels**: 😕 Uncertain  
**Current pain**: Button says "Used". No period. No confirmation. (BenefitsGrid.tsx line 266)  
**Enhanced**: Button says **"Mark Apr 2026 Used"**. Card transitions to used state with "✓ Claimed · Apr 2026" and success animation.

### Stage 4: Reviewing Past Periods

**Does**: Wants to see if March Uber credit was missed  
**Thinks**: "Did I use my credit last month?"  
**Feels**: 😟 Worried about missed money  
**Current pain**: `deduplicateBenefits()` drops ALL EXPIRED rows (benefit-utils.ts line 64). The "Previous Periods" view exists but shows a flat list.  
**Enhanced**: Period nav shows "← Mar 2026 | **Apr 2026** | May 2026 →". March benefits show "✓ Used" or "✗ Missed — $15" in red.

---

## 4. Component Architecture

### Component Hierarchy

```
DashboardPage (src/app/dashboard/page.tsx)
├── AppHeader
├── WelcomeSection
├── CardSwitcher
├── PeriodNavigationBar  ← NEW (benefit-engine mode only)
│   ├── PeriodArrowButton (◀)
│   ├── PeriodLabel ("April 2026")
│   ├── PeriodArrowButton (▶)
│   └── PeriodJumpMenu (dropdown for non-adjacent months)
├── StatusFilters (existing — no changes)
├── PeriodSummaryStats  ← ENHANCED (period-aware)
│   ├── StatCard ("5 of 8 used this period")
│   ├── StatCard ("$75 claimed / $120 available")
│   ├── StatCard ("Period 4 of 12")
│   └── StatCard ("$30 missed last period")
├── BenefitsGrid  ← ENHANCED
│   └── BenefitCard  ← REDESIGNED
│       ├── PeriodBanner  ← NEW (top banner)
│       ├── PeriodStatusStripe  ← NEW (left border)
│       ├── BenefitCardBody (name, desc, value — existing)
│       ├── PeriodProgressIndicator  ← NEW ("Period 4 of 12")
│       └── PeriodAwareActions  ← ENHANCED ("Mark Apr 2026 Used")
└── Modals (existing — unchanged)
```

### ASCII Wireframe — Desktop (1024px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Welcome, Sarah! 👋                                    [+ Add Card] │
│  You have 2 cards and 8 benefits tracked                            │
├──────────────────────────────────────────────────────────────────────┤
│  Cards: [Amex Platinum ✓] [Chase Sapphire]                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ◀  March 2026  │  ██ APRIL 2026 ██  │  May 2026  ▶    [Jump to ▾] │
│                                                                      │
│  Status: [✓ Active] [⚠ Expiring] [✓ Used]                          │
│                                                                      │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐          │
│  │ 5/8 Used    │ $75/$120    │ Period 4/12 │ 7 Days Left │          │
│  │ this period │ claimed     │ (monthly)   │ in period   │          │
│  └─────────────┴─────────────┴─────────────┴─────────────┘          │
│                                                                      │
│  Benefits on Amex Platinum (5 active)                    [+ Add]    │
│                                                                      │
│  ┌─────────────────────┐ ┌─────────────────────┐ ┌────────────────┐ │
│  │▌APR 1 – APR 30      │ │▌APR 1 – APR 30      │ │▌2026           │ │
│  │▌Monthly              │ │▌Monthly              │ │▌Annual         │ │
│  │                      │ │                      │ │                │ │
│  │ 🚗 Uber Credit      │ │ 🍽 Dining Credit     │ │ ✈ Airline Fee │ │
│  │ $15.00              │ │ $25.00               │ │ $200.00        │ │
│  │                      │ │                      │ │                │ │
│  │ Period 4 of 12      │ │ Period 4 of 12       │ │ Period 1 of 1  │ │
│  │ ████████░░░░ 33%    │ │ ████████░░░░ 33%     │ │ ████████ 100%  │ │
│  │                      │ │                      │ │                │ │
│  │ [Mark Apr 2026 Used] │ │ [Mark Apr 2026 Used] │ │ [✓ Used 2026] │ │
│  │ [Edit]       [×]    │ │ [Edit]        [×]    │ │ [Edit]   [×]  │ │
│  └─────────────────────┘ └─────────────────────┘ └────────────────┘ │
│                                                                      │
│  ┌─────────────────────┐ ┌─────────────────────┐                    │
│  │ ░░ ✓ USED APR 2026 ░│ │▌APR 1 – JUN 30      │                   │
│  │                      │ │▌Quarterly            │                   │
│  │ 🏷 Shopping Credit  │ │ 💰 Entertainment     │                   │
│  │ $10.00 ✓            │ │ $25.00               │                   │
│  │ Period 4 of 12      │ │ Period 2 of 4        │                   │
│  │ ████████████ 100%   │ │ ████████░░░░ 50%     │                   │
│  │ [✓ Claimed Apr 2026]│ │ [Mark Q2 2026 Used]  │                   │
│  │ [Edit]       [×]    │ │ [Edit]        [×]    │                   │
│  └─────────────────────┘ └─────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────┘
```

### ASCII Wireframe — Mobile (320–767px)

```
┌────────────────────────┐
│ Welcome, Sarah! 👋     │
│ 2 cards, 8 benefits    │
│                [+ Add] │
├────────────────────────┤
│ ◀◀ [Amex Plat ✓] ▶▶   │
├────────────────────────┤
│  ◀ Mar │ APR 2026 │ ▶  │
│                        │
│ [✓Active] [⚠Exp] [✓U] │
│                        │
│ ┌──────┐┌──────┐       │
│ │5/8   ││$75/  │       │
│ │used  ││$120  │       │
│ └──────┘└──────┘       │
│ ┌──────┐┌──────┐       │
│ │Per.  ││7 days│       │
│ │4/12  ││left  │       │
│ └──────┘└──────┘       │
│                        │
│ Benefits (5 active)    │
│                        │
│ ┌──────────────────┐   │
│ │▌APR 1–30 Monthly │   │
│ │ 🚗 Uber Credit   │   │
│ │ $15.00           │   │
│ │ Period 4/12      │   │
│ │ ████████░░ 33%   │   │
│ │[Mark Apr Used   ]│   │
│ │[Edit]       [×]  │   │
│ └──────────────────┘   │
│                        │
│ ┌──────────────────┐   │
│ │░ ✓ USED APR 2026 │   │
│ │ 🏷 Shopping      │   │
│ │ $10.00 ✓         │   │
│ │ Period 4/12      │   │
│ │ ████████████100% │   │
│ │[✓ Claimed Apr]   │   │
│ │[Edit]       [×]  │   │
│ └──────────────────┘   │
└────────────────────────┘
```

---

## 5. Detailed Component Specifications

### 5.1 PeriodBanner (NEW)

**Purpose**: Prominent header banner replacing the subtle badge at BenefitsGrid.tsx lines 192–206.

**File**: `src/features/benefits/components/grids/PeriodBanner.tsx`

#### Props

```typescript
interface PeriodBannerProps {
  periodStart: string | null;     // ISO: "2026-04-01"
  periodEnd: string | null;       // ISO: "2026-04-30"
  periodStatus: 'ACTIVE' | 'EXPIRED' | 'UPCOMING' | string | null;
  cadence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ONE_TIME' | string | null;
}
```

#### Visual Treatment by Status

| Status | Background | Text | Left Border | Icon |
|--------|-----------|------|-------------|------|
| ACTIVE | `var(--color-success)` @ 10% | `var(--color-success)` | 4px solid `var(--color-success)` | `Calendar` (Lucide) |
| EXPIRED | `var(--color-bg-secondary)` | `var(--color-text-secondary)` | 4px solid `var(--color-border)` | `CalendarX2` (Lucide) |
| UPCOMING | `var(--color-info)` @ 10% | `var(--color-info)` | 4px solid `var(--color-info)` | `CalendarClock` (Lucide) |
| null | Not rendered | — | — | — |

#### Cadence Display Labels

| Value | Label | Date Format |
|-------|-------|-------------|
| MONTHLY | "Monthly" | "Apr 1 – Apr 30" |
| QUARTERLY | "Quarterly" | "Apr 1 – Jun 30" |
| SEMI_ANNUAL | "Semi-Annual" | "Jan 1 – Jun 30" |
| ANNUAL | "Annual" | "2026" (year only) |
| ONE_TIME | "One-Time" | "From Apr 1" |

#### Design Tokens

```css
.period-banner {
  padding: var(--space-xs) var(--space-sm);           /* 4px 8px */
  border-radius: var(--radius-md) var(--radius-md) 0 0; /* top corners */
  font-size: var(--text-caption);                      /* ~12px */
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

#### Accessibility

- `role="status"` with `aria-label="Benefit period: April 1 to April 30, Monthly, Active"`
- Calendar icon: `aria-hidden="true"`

---

### 5.2 PeriodStatusStripe (left border on card)

**Not a separate component** — applied as a conditional `borderLeft` style on the card container at BenefitsGrid.tsx line 156.

```typescript
const getStatusBorderStyle = (periodStatus: string | null): React.CSSProperties => {
  switch (periodStatus) {
    case 'ACTIVE':
      return { borderLeft: '4px solid var(--color-success)' };
    case 'EXPIRED':
      return { borderLeft: '4px solid var(--color-border)' };
    case 'UPCOMING':
      return { borderLeft: '4px solid var(--color-info)' };
    default:
      return {}; // Legacy — no stripe
  }
};
```

#### Used-State Card Treatment

When `isUsed === true`:
- Card opacity: 0.7
- "✓ USED · APR 2026" overlay banner with `var(--color-success)` bg at 15% opacity
- `aria-label` includes "Used in April 2026"

---

### 5.3 PeriodProgressIndicator (NEW)

**File**: `src/features/benefits/components/grids/PeriodProgressIndicator.tsx`

#### Props

```typescript
interface PeriodProgressIndicatorProps {
  periodStart: string;
  cadence: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'ONE_TIME' | string;
  yearStartDate?: string; // defaults to Jan 1 of periodStart's year
}
```

#### Calculation

```typescript
function calculatePeriodProgress(periodStart: string, cadence: string) {
  const totalPeriods: Record<string, number> = {
    MONTHLY: 12, QUARTERLY: 4, SEMI_ANNUAL: 2, ANNUAL: 1, ONE_TIME: 1,
  };
  const monthsPerPeriod: Record<string, number> = {
    MONTHLY: 1, QUARTERLY: 3, SEMI_ANNUAL: 6, ANNUAL: 12, ONE_TIME: 12,
  };

  const start = new Date(periodStart);
  const total = totalPeriods[cadence] || 1;
  const mpp = monthsPerPeriod[cadence] || 1;
  const current = Math.floor(start.getMonth() / mpp) + 1;

  return { current: Math.min(current, total), total, percentage: Math.round((current / total) * 100) };
}
```

#### Visual

- Text: `var(--text-caption)`, `var(--color-text-secondary)` — "Period 4 of 12"
- Bar: 4px height, `var(--color-bg-secondary)` track, `var(--color-primary)` fill
- ONE_TIME: "One-Time Benefit" text, no bar
- ANNUAL: "Annual · 2026" text, no bar

#### Accessibility

- `role="progressbar"`, `aria-valuenow={current}`, `aria-valuemin={1}`, `aria-valuemax={total}`
- `aria-label="Period 4 of 12, 33 percent through benefit year"`

---

### 5.4 PeriodAwareActions (ENHANCED)

**Location**: Replaces BenefitsGrid.tsx lines 258–289.

#### Button Label Logic

```typescript
function getMarkUsedLabel(
  periodStart: string | null,
  cadence: string | null,
  isUsed: boolean
): { label: string; ariaLabel: string } {
  if (!periodStart) {
    return { label: isUsed ? '✓ Used' : 'Mark Used', ariaLabel: '...' };
  }

  const start = new Date(periodStart);
  let periodLabel: string;

  switch (cadence) {
    case 'MONTHLY':
      periodLabel = start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      break; // → "Apr 2026"
    case 'QUARTERLY':
      periodLabel = `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`;
      break; // → "Q2 2026"
    case 'SEMI_ANNUAL':
      periodLabel = `${start.getMonth() < 6 ? 'H1' : 'H2'} ${start.getFullYear()}`;
      break;
    case 'ANNUAL':
      periodLabel = `${start.getFullYear()}`;
      break;
    default:
      periodLabel = formatPeriodRange(periodStart, null);
  }

  if (isUsed) {
    return { label: `✓ Claimed ${periodLabel}`, ariaLabel: `Already claimed for ${periodLabel}` };
  }
  return { label: `Mark ${periodLabel} Used`, ariaLabel: `Mark as used for ${periodLabel}` };
}
```

#### Button States

| State | Appearance | Interaction |
|-------|-----------|-------------|
| Unclaimed, ACTIVE | Primary button, period label | Click → mark used |
| Claimed | Success outline, ✓ icon, period label | Disabled |
| Expired, Unclaimed | Error outline, "✗ Missed {period}" | Disabled + tooltip |
| Expired, Claimed | Muted success, "✓ Claimed {period}" | Disabled |
| Upcoming | Info outline, "Available {period}" | Disabled + tooltip |

---

### 5.5 PeriodNavigationBar (NEW)

**File**: `src/features/benefits/components/PeriodNavigationBar.tsx`

**Shown**: Only when `benefitEngineEnabled === true`. Falls back to existing `PeriodSelector` when off.

```
◀  March 2026  │  ██ APRIL 2026 ██  │  May 2026  ▶    [Jump to ▾]
```

#### Props

```typescript
interface PeriodNavigationBarProps {
  currentPeriod: string;           // "2026-04"
  onPeriodChange: (period: string) => void;
  availablePeriods: string[];      // ["2026-01", "2026-02", ...]
  periodBenefitCounts?: Record<string, number>;
}
```

#### Interaction

- Arrow buttons: Move one period forward/backward
- Period label click: Opens dropdown with scrollable month list
- Keyboard: Left/Right arrows navigate, Enter opens dropdown
- Boundary: ◀ disabled on earliest, ▶ disabled on latest

#### Data Flow Impact — Recommended Approach

**Option A (recommended for v1) — Client-side filter:**
- Stop dropping EXPIRED/UPCOMING in `deduplicateBenefits()`
- Pass ALL period rows to dashboard
- Filter client-side by `selectedMonth`
- Payload increase is minimal: ~12 rows/benefit × ~10 benefits = ~120 rows ≈ 15KB

New utility to replace `deduplicateBenefits()` for period navigation:

```typescript
export function filterBenefitsByPeriod<T extends DeduplicatableBenefit & {
  periodStart?: string | null;
  periodEnd?: string | null;
}>(benefits: T[], selectedPeriod: string | null, engineEnabled: boolean): T[] {
  if (!engineEnabled || !selectedPeriod) {
    return deduplicateBenefits(benefits, engineEnabled);
  }

  const [year, month] = selectedPeriod.split('-').map(Number);
  const pStart = new Date(year, month - 1, 1);
  const pEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const seen = new Set<string>();
  const result: T[] = [];

  for (const b of benefits) {
    if (!b.periodStart) { result.push(b); continue; } // legacy

    const bStart = new Date(b.periodStart);
    const bEnd = b.periodEnd ? new Date(b.periodEnd) : bStart;

    if (bEnd >= pStart && bStart <= pEnd) {
      const key = b.masterBenefitId
        ? `${b.userCardId ?? ''}:${b.masterBenefitId}`
        : b.id;
      if (!seen.has(key)) { seen.add(key); result.push(b); }
    }
  }
  return result;
}
```

---

### 5.6 PeriodSummaryStats (ENHANCED)

**Location**: Replaces `summaryStats` at page.tsx lines 814–841.

```typescript
const periodAwareSummaryStats = useMemo(() => {
  const usedCount = displayBenefits.filter(b => b.isUsed).length;
  const totalCount = displayBenefits.length;
  const claimedValue = displayBenefits.filter(b => b.isUsed).reduce((s, b) => s + (b.value || 0), 0);
  const totalValue = displayBenefits.reduce((s, b) => s + (b.value || 0), 0);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();

  return [
    { label: 'Used This Period', value: `${usedCount}/${totalCount}`,
      icon: 'CheckCircle', subtitle: usedCount === totalCount ? 'All claimed! 🎉' : `${totalCount - usedCount} remaining` },
    { label: 'Value Claimed', value: `$${claimedValue}`,
      icon: 'DollarSign', subtitle: `of $${totalValue} available` },
    { label: 'Days Remaining', value: daysRemaining,
      icon: 'Clock', variant: daysRemaining <= 3 ? 'warning' : 'default',
      subtitle: daysRemaining <= 3 ? '⚠️ Claim soon!' : 'in this period' },
    { label: 'Active Cards', value: cards.length, icon: 'CreditCard' },
  ];
}, [displayBenefits, cards]);
```

---

### 5.7 Enhanced BenefitCard — Card Restructure

**Current structure (BenefitsGrid.tsx lines 153–289):**

```
┌───────────────────────┐
│ [Icon] Name    [Badge]│ ← Header
│ Description...        │ ← Description
│ 📅 Apr 1 – Apr 30    │ ← Period (TINY — the problem)
│ $15.00    Exp: Apr 30 │ ← Value
│ ████████░░ 80%        │ ← Usage
│ [Used] [Edit] [×]     │ ← Actions
└───────────────────────┘
```

**Proposed structure:**

```
┌───────────────────────────────┐
│▌📅 Apr 1 – Apr 30    Monthly │ ← PeriodBanner (NEW — top)
├───────────────────────────────┤
│ [Icon] Uber Credit    [Badge]│ ← Name + status
│ Monthly ride credit           │ ← Description
│ $15.00                        │ ← Value (larger)
│ Period 4 of 12                │ ← PeriodProgress (NEW)
│ ████████░░░░░░░░ 33%         │
│ [Mark Apr 2026 Used]          │ ← Period-aware action
│ [Edit]              [×]       │ ← Secondary actions
└───────────────────────────────┘
```

#### Extended Benefit Interface

```typescript
interface Benefit {
  // Existing fields
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  expirationDate?: Date | string;
  value?: number;
  usage?: number;
  type?: string;
  isUsed?: boolean;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: 'ACTIVE' | 'EXPIRED' | 'UPCOMING' | string | null;

  // NEW: fields to pass through from API
  resetCadence?: string | null;     // MONTHLY, QUARTERLY, etc.
  claimingCadence?: string | null;  // fallback cadence
  masterBenefitId?: string | null;  // dedup key
}
```

#### Extended BenefitsGridProps

```typescript
interface BenefitsGridProps {
  // Existing
  benefits: Benefit[];
  onEdit?: (benefitId: string) => void;
  onDelete?: (benefitId: string) => void;
  onMarkUsed?: (benefitId: string) => void;
  loading?: boolean;
  emptyMessage?: string;
  gridColumns?: 'auto' | 2 | 3 | 4;

  // NEW
  benefitEngineEnabled?: boolean;
  currentPeriodLabel?: string;
}
```

---

## 6. Interaction Patterns

### Mark Used Flow

```
Click "Mark Apr 2026 Used"
  → Button shows spinner (0.3s)
  → Optimistic UI: card → used state immediately
    → Button → "✓ Claimed Apr 2026" (disabled)
    → Card opacity → 0.75
    → Used overlay fades in (0.3s ease-out)
    → Summary: "4/8 → 5/8 Used"
  → API: PATCH /api/benefits/{id}/toggle-used
    → Success: toast "Uber Credit claimed for Apr 2026!"
    → Failure: revert all, error toast
  → Screen reader: "Uber Credit marked as used for April 2026"
```

### Period Navigation Flow

```
Click ▶ (next period)
  → Label: "April 2026" → "May 2026"
  → Grid shows skeleton shimmer (0.15s)
  → Client filter applies for May 2026
    → UPCOMING cards show blue banner, disabled actions
    → Banner: "Benefits available starting May 1"
  → Click ◀ back to current month:
    → "Current Period" indicator badge appears
```

### Hover Effects

| Element | Effect | Timing |
|---------|--------|--------|
| Benefit card | -2px translateY + shadow | 200ms ease |
| Period banner | brightness(1.05) | 150ms |
| Mark Used button | bg darken, scale(1.02) | 150ms |
| Cadence badge | Tooltip: "Resets every month" | 300ms delay |

### Keyboard

| Key | Action |
|-----|--------|
| Tab | Move between interactive elements (buttons in cards) |
| Enter / Space | Activate focused button |
| Arrow Left/Right | Navigate period (when nav focused) |
| Escape | Close tooltip/dropdown |

---

## 7. Visual Design Tokens

### New Tokens

```css
:root {
  --color-period-active-bg: color-mix(in srgb, var(--color-success) 10%, transparent);
  --color-period-expired-bg: var(--color-bg-secondary);
  --color-period-upcoming-bg: color-mix(in srgb, var(--color-info) 10%, transparent);
  --period-banner-height: 32px;
  --period-stripe-width: 4px;
  --period-progress-height: 4px;
  --card-used-opacity: 0.7;
  --duration-claim: 300ms;
}
```

### Existing Tokens to Reuse

```
--color-primary, --color-success, --color-warning, --color-error, --color-info
--color-bg, --color-bg-secondary, --color-text, --color-text-secondary, --color-border
--text-body-sm, --text-caption, --font-heading
--space-xs (4px), --space-sm (8px), --space-md (16px), --space-lg (24px)
```

---

## 8. Responsive Breakpoints

### Mobile (320–767px)

| Element | Treatment |
|---------|-----------|
| Grid | 1 column, 100% width |
| Period banner | Single line: "Apr 1–30 · Monthly" |
| Value | 18px, left-aligned |
| Mark Used | Full width, **44px min height** |
| Period nav | Compact: "◀ APR 2026 ▶" (no adjacent labels) |
| Summary | 2×2 grid |
| No hover effects | Use active/pressed states |

### Tablet (768–1023px)

| Element | Treatment |
|---------|-----------|
| Grid | 2 columns |
| Period banner | Full text, single line |
| Mark Used | Auto width, 36px min height |
| Period nav | Shows adjacent: "Mar \| APR \| May" |
| Summary | 4×1 row |

### Desktop (1024px+)

| Element | Treatment |
|---------|-----------|
| Grid | 3 columns (default) |
| Period banner | Full with icon + date + cadence |
| Mark Used | Auto width, min 120px |
| Period nav | Full: "◀ March \| ██ APRIL ██ \| May ▶ [Jump ▾]" |
| Summary | 4×1 row with subtitles |

---

## 9. Dark Mode Considerations

| Element | Light | Dark |
|---------|-------|------|
| ACTIVE banner bg | `rgba(34,197,94,0.10)` | `rgba(34,197,94,0.15)` (more opaque) |
| UPCOMING banner bg | `rgba(59,130,246,0.10)` | `rgba(59,130,246,0.15)` |
| Used card overlay | success @ 5% + `--color-bg` | success @ 8% + `--color-bg` |
| Used card opacity | 0.7 | 0.65 (slightly lower for readability) |
| Progress bar track | `var(--color-bg-secondary)` | auto (CSS var) |
| Progress bar fill | `var(--color-primary)` | auto (CSS var) |

All text must meet WCAG AA 4.5:1 contrast. CSS variables handle most adaptation automatically; the semi-transparent banner backgrounds need manual tuning.

---

## 10. Accessibility Requirements

### ARIA Roles & Labels

```html
<!-- Benefit Card -->
<article aria-label="Uber Credit, $15, Monthly, April 1–30, Active, Not claimed">
  <div role="status" aria-label="Period: April 1 to April 30, Monthly">...</div>
  <div role="progressbar" aria-valuenow="4" aria-valuemin="1" aria-valuemax="12"
       aria-label="Period 4 of 12">...</div>
  <button aria-label="Mark Uber Credit as used for April 2026">
    Mark Apr 2026 Used
  </button>
</article>

<!-- Period Navigation -->
<nav aria-label="Benefit period navigation">
  <button aria-label="Previous: March 2026">◀</button>
  <span aria-current="true">April 2026</span>
  <button aria-label="Next: May 2026">▶</button>
</nav>

<!-- Live region for mark-used announcements -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  Uber Credit marked as used for April 2026. 5 of 8 benefits claimed.
</div>
```

### Focus Management

- Period nav change → focus moves to first benefit card
- Mark Used complete → focus stays on (now disabled) button
- Benefit deleted → focus moves to next card
- Focus ring: 2px solid `var(--color-primary)`, offset 2px

### Touch Targets (44px minimum)

| Element | Current Size | Required |
|---------|-------------|----------|
| Mark Used button | ~32px (`size="xs"`) | **44px** → change to `size="sm"` |
| Edit button | ~32px | **44px** → add padding |
| Delete "×" button | ~24px | **44px** → add padding |
| Period nav arrows | 32px | **44px** |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .benefit-card,
  .period-progress-fill,
  .claim-success-animation {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## 11. Edge Cases

| Case | Behavior |
|------|----------|
| **No period data** (`periodStart === null`) | PeriodBanner, Stripe, Progress all hidden. Card looks exactly like current. Backward compatible. |
| **ONE_TIME** cadence | Banner: "From Apr 1 · One-Time". No progress bar. Button: "Mark Used" (no period suffix). |
| **All EXPIRED** (expired card) | All cards gray. "0/0 used — all expired". Show "Next benefits activate [date]" if UPCOMING exists. |
| **All UPCOMING** (new card) | All cards blue/info. "Benefits starting [date]". Buttons disabled: "Available starting [date]". |
| **Mixed cadences** (monthly + quarterly + annual on same card) | Period nav operates monthly. Each card shows its own cadence banner independently. |
| **Zero-value benefits** (lounge access) | Show "Included" instead of "$0.00". Still count in "X of Y used" but not dollar totals. |
| **Network error on Mark Used** | Optimistic revert after error. Button re-enabled. Error toast. `aria-live` announces error. |
| **Engine disabled** (`benefitEngineEnabled === false`) | ALL period UI hidden. Exact current behavior. Zero regression. |
| **Long benefit names** | Name truncates with `line-clamp-2` (existing). Period banner unaffected. Button truncates label on mobile. |

---

## 12. Data Flow Changes

### transformBenefitForGrid() — Add Missing Fields

Currently at page.tsx line 116, `transformBenefitForGrid()` does NOT pass `resetCadence`, `claimingCadence`, or `isUsed`. These must be added:

```typescript
function transformBenefitForGrid(benefit: BenefitData) {
  return {
    // ...existing fields...
    periodStart: benefit.periodStart,
    periodEnd: benefit.periodEnd,
    periodStatus: benefit.periodStatus,
    // NEW: pass through for period UI
    resetCadence: benefit.resetCadence ?? benefit.claimingCadence ?? null,
    claimingCadence: benefit.claimingCadence ?? null,
    isUsed: benefit.isUsed ?? false,
    masterBenefitId: benefit.masterBenefitId ?? null,
  };
}
```

### Dashboard State — New State Variables

```typescript
// NEW: for PeriodNavigationBar
const [selectedMonth, setSelectedMonth] = useState<string>(() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}); // "2026-04"

// NEW: all period rows (unfiltered) — replaces the ACTIVE-only filtered set
const [allPeriodBenefits, setAllPeriodBenefits] = useState<BenefitData[]>([]);
```

---

## 13. Implementation Priorities

### Phase 1 — CRITICAL (Ship first, ~3h)

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Create `PeriodBanner` component | New file | 1h |
| 2 | Add left border stripe (PeriodStatusStripe) | BenefitsGrid.tsx | 30m |
| 3 | Pass `resetCadence`, `isUsed` through transform | page.tsx | 15m |
| 4 | Enhance Mark Used label ("Mark Apr 2026 Used") | BenefitsGrid.tsx | 30m |
| 5 | Add used-state card overlay | BenefitsGrid.tsx | 45m |

### Phase 2 — HIGH (Period progress + stats, ~3.5h)

| # | Task | File | Effort |
|---|------|------|--------|
| 6 | Create `PeriodProgressIndicator` | New file | 1.5h |
| 7 | Enhance summary stats (period-aware) | page.tsx | 1h |
| 8 | Add `aria-live` announcements | BenefitsGrid.tsx | 30m |
| 9 | Fix touch targets to 44px min | BenefitsGrid.tsx | 30m |

### Phase 3 — MEDIUM (Period navigation, ~6h)

| # | Task | File | Effort |
|---|------|------|--------|
| 10 | Create `filterBenefitsByPeriod()` | benefit-utils.ts | 1h |
| 11 | Build `PeriodNavigationBar` | New file | 2h |
| 12 | Wire navigation to dashboard | page.tsx | 1.5h |
| 13 | Update dedup to retain all periods | benefit-utils.ts | 1h |
| 14 | UPCOMING/no-active empty states | BenefitsGrid.tsx | 30m |

### Phase 4 — POLISH (~5.5h)

| # | Task | File | Effort |
|---|------|------|--------|
| 15 | Claim success animation | BenefitsGrid.tsx | 1h |
| 16 | Dark mode banner tuning | Global CSS | 45m |
| 17 | `prefers-reduced-motion` | Global CSS | 30m |
| 18 | Mobile swipe for period nav | PeriodNavigationBar | 1.5h |
| 19 | E2E tests | tests/ | 2h |

---

## Appendix: Files Summary

### Files to Modify

| File | Changes |
|------|---------|
| `src/features/benefits/components/grids/BenefitsGrid.tsx` | Add PeriodBanner, stripe, progress, enhanced actions |
| `src/app/dashboard/page.tsx` | Pass new props, add selectedMonth, wire PeriodNavigationBar |
| `src/lib/benefit-utils.ts` | Add `filterBenefitsByPeriod()` |
| `src/lib/format-period-range.ts` | Add `formatCadenceLabel()` helper |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/features/benefits/components/grids/PeriodBanner.tsx` | Period header banner |
| `src/features/benefits/components/grids/PeriodProgressIndicator.tsx` | Period X of Y progress |
| `src/features/benefits/components/PeriodNavigationBar.tsx` | Month stepper nav |

### Reference Components (Good Patterns to Follow)

- `BenefitRow.tsx` lines 155–165: Period display as labeled field (good structure, needs elevation)
- `PeriodSelector.tsx`: Horizontal scroll with arrows (reuse scroll pattern)
- `StatusFilters.tsx`: Toggle buttons with ARIA (reuse pattern for period nav)
- `Badge.tsx`: Status variants with icons (reuse for cadence badges)