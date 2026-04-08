# Dashboard MVP - Architecture Overview

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Browser / Client                         │
├────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Dashboard Page (new-page.tsx)               │  │
│  │  - State management (useState, useEffect)           │  │
│  │  - Event handlers (useCallback)                     │  │
│  │  - Data loading (fetchDashboardData)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                          │                                   │
│         ┌────────────────┼────────────────┐                │
│         ▼                ▼                ▼                │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐       │
│  │ Period     │  │ Status     │  │ Summary Box   │       │
│  │ Selector   │  │ Filters    │  │               │       │
│  └────────────┘  └────────────┘  └───────────────┘       │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          ▼                                   │
│         ┌──────────────────────────────┐                   │
│         │   Benefits List              │                   │
│         │ - Groups by status           │                   │
│         │ - Filters benefits           │                   │
│         │ - Handles interactions       │                   │
│         └──────────────────────────────┘                   │
│                          │                                   │
│    ┌─────────────────────┼─────────────────────┐           │
│    ▼                     ▼                     ▼           │
│ ┌────────────┐  ┌────────────┐  ┌──────────────────┐     │
│ │ Benefit    │  │ Benefit    │  │ Past Periods     │     │
│ │ Group      │  │ Group      │  │ Section          │     │
│ │ (Active)   │  │ (Expiring) │  │                  │     │
│ └────────────┘  └────────────┘  └──────────────────┘     │
│    │                  │                  │                 │
│    └──────────┬───────┴──────────┬───────┘                │
│               ▼                  ▼                         │
│            ┌─────────────────────────┐                    │
│            │   Benefit Rows          │                    │
│            │ (One per benefit item)  │                    │
│            └─────────────────────────┘                    │
│                       │                                    │
│              ┌────────┼────────┐                           │
│              ▼        ▼        ▼                           │
│         [Mark Used] [Edit] [Delete]                       │
│                                                              │
└────────────────────────────────────────────────────────────┘
                            │
                    ┌───────┴────────┐
                    ▼                ▼
            ┌────────────────┐  ┌──────────────┐
            │  Utilities     │  │  API Layer   │
            │                │  │              │
            │ period-        │  │ toggleUsed() │
            │  helpers.ts    │  │ fetchData()  │
            │                │  │              │
            └────────────────┘  └──────────────┘
                                       │
                                       ▼
                            ┌────────────────────┐
                            │   Backend API      │
                            │                    │
                            │ /api/benefits/*    │
                            │ /api/cards/*       │
                            └────────────────────┘
                                       │
                                       ▼
                            ┌────────────────────┐
                            │  Database          │
                            │  (Prisma)          │
                            └────────────────────┘
```

## 📊 Component Hierarchy

```
DashboardPage
├── Header (sticky)
│   ├── Title: "💳 My Benefits"
│   └── Controls Row
│       ├── PeriodSelector
│       │   └── select dropdown
│       └── StatusFilters
│           ├── button (Active)
│           ├── button (Expiring)
│           ├── button (Used)
│           ├── button (Expired)
│           ├── button (Pending)
│           └── Clear/Select All
│
└── Main Content
    ├── SummaryBox
    │   ├── Total Benefits card
    │   ├── Expiring Soon card
    │   ├── Already Used card
    │   └── Max Value card
    │
    └── BenefitsList
        ├── BenefitGroup (🟢 ACTIVE)
        │   ├── BenefitRow
        │   │   ├── Name + Issuer + Status
        │   │   ├── Period + Cadence
        │   │   ├── Available + Used
        │   │   ├── Progress bar
        │   │   └── Actions: [Mark Used] [Edit] [Delete]
        │   ├── BenefitRow
        │   └── ... (more benefits)
        │
        ├── BenefitGroup (🟠 EXPIRING SOON)
        │   └── BenefitRow (...)
        │
        ├── BenefitGroup (✓ USED)
        │   └── BenefitRow (...)
        │
        ├── BenefitGroup (🔴 EXPIRED)
        │   └── BenefitRow (...)
        │
        ├── BenefitGroup (⏳ PENDING)
        │   └── BenefitRow (...)
        │
        └── PastPeriodsSection
            ├── ExpandablePeriodGroup (April 1-30)
            │   ├── BenefitRow
            │   └── ... (more benefits)
            ├── ExpandablePeriodGroup (March 1-31)
            │   └── BenefitRow (...)
            └── ... (more periods)
```

## 🔄 Data Flow Diagrams

### 1. Page Load Flow

```
┌─────────────────────┐
│ Page Mounts         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ useEffect(() => {                       │
│   loadDashboard()                       │
│ }, [])                                  │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ setIsLoading(true)                      │
│ fetchDashboardData()                    │
└──────────┬──────────────────────────────┘
           │
           ├─────────────────────────────────────────┐
           │                                         │
           ▼                                         ▼
    ┌──────────────┐                    ┌──────────────────────┐
    │ API Requests │                    │ Error Handling       │
    │ (Parallel)   │                    │ - Show error message │
    ├──────────────┤                    │ - Use mock data      │
    │ Fetch        │                    └──────────────────────┘
    │ - Benefits   │
    │ - Progress   │
    │ - Periods    │
    └──────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Transform API Data                      │
│ → BenefitRowProps[]                     │
│ → Group by status                       │
│ → Calculate summary                     │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ setBenefits(data)                       │
│ setIsLoading(false)                     │
│ setError(null)                          │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│ Components Re-render                    │
│ - SummaryBox with stats                 │
│ - BenefitsList with grouped benefits    │
│ - PastPeriodsSection                    │
└─────────────────────────────────────────┘
```

### 2. Filter Change Flow

```
┌──────────────────────────────┐
│ User clicks status filter    │
│ e.g., "Active"               │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ StatusFilters component      │
│ handleStatusToggle()         │
│ (useCallback)                │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ onStatusChange(newStatuses)  │
│ Called by parent             │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ DashboardPage                │
│ handleStatusChange()         │
│ setSelectedStatuses(new)     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Re-render BenefitsList       │
│ (selective, not full page)   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ useMemo calculates           │
│ filteredGroups = {}          │
│ - Filter by selectedStatuses │
│ - Only selected statuses     │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ BenefitGroups render         │
│ Only visible groups show     │
│ (empty groups not rendered)  │
└──────────────────────────────┘
```

### 3. Mark Used Flow

```
┌──────────────────────────────┐
│ User clicks [Mark Used]      │
│ on a benefit                 │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ BenefitRow                   │
│ handleMarkUsed()             │
│ (useCallback)                │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ setIsMarkingUsed(true)       │
│ Button shows loading state   │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Call onMarkUsed(benefitId)   │
│ From parent (DashboardPage)  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ toggleBenefitUsed()          │
│ API Client                   │
│ PATCH /api/benefits/[id]/    │
│        toggle-used           │
└──────────┬───────────────────┘
           │
        ┌──┴──────────────────┐
        │                     │
        ▼                     ▼
    ┌────────┐           ┌────────┐
    │ Success│           │ Error  │
    └────────┘           └────────┘
        │                     │
        ▼                     ▼
    Update state      Show error toast
    setBenefits()      setIsMarkingUsed()
        │                     │
        ▼                     ▼
    Benefit moves      Button state
    to USED section    resets
```

## 💾 Data Structure

### BenefitRowProps

```typescript
interface BenefitRowProps {
  id: string;                    // Unique benefit ID
  name: string;                  // Benefit name
  issuer: string;                // Card issuer
  cardName?: string;             // Card display name
  status: BenefitStatus;         // active|expiring_soon|used|expired|pending
  periodStart: Date;             // Period start date
  periodEnd: Date;               // Period end date
  available: number;             // Available amount ($)
  used: number;                  // Used amount ($)
  resetCadence: string;          // MONTHLY|QUARTERLY|ANNUAL|etc
  onMarkUsed?: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}
```

### Period Option

```typescript
interface PeriodOption {
  id: string;                                // Unique ID
  label: string;                             // Display label
  displayLabel: string;                      // E.g., "May 2025"
  getDateRange: () => {                      // Function to get dates
    start: Date;
    end: Date;
  };
}
```

### Status Option

```typescript
interface StatusOption {
  id: BenefitStatus;             // Status identifier
  label: string;                 // Display label
  icon: string;                  // Emoji icon
  description: string;           // Tooltip description
}
```

## 🔌 API Integration

### Request/Response Flow

```
Client Side (React)
│
├─ API Request (JSON)
│  ├─ POST /api/benefits/filters
│  ├─ GET /api/benefits/progress?benefitId=X
│  ├─ GET /api/benefits/periods?benefitId=X
│  └─ PATCH /api/benefits/[id]/toggle-used
│
├─ Network
│
└─ Server Side (Next.js API Routes)
   ├─ /api/benefits/filters (route.ts)
   ├─ /api/benefits/progress (route.ts)
   ├─ /api/benefits/periods (route.ts)
   └─ /api/benefits/[id]/toggle-used (route.ts)
   │
   ├─ Database Query (Prisma)
   │
   └─ Response (JSON)
      ├─ { success: true, data: [...] }
      └─ { error: "message" }
```

## 📁 Dependency Graph

```
new-page.tsx (Main)
├── uses: PeriodSelector
├── uses: StatusFilters
├── uses: SummaryBox
├── uses: BenefitsList
│   ├── uses: BenefitGroup
│   │   └── uses: BenefitRow
│   │       ├── uses: icons (lucide-react)
│   │       └── calls: onMarkUsed, onEdit, onDelete
│   └── uses: PastPeriodsSection
│       └── uses: BenefitRow
├── uses: period-helpers.ts
│   ├── calculatePeriodDateRange()
│   ├── getPeriodDisplayLabel()
│   └── calculateDaysUntilExpiration()
├── uses: api-client.ts
│   ├── fetchDashboardData()
│   ├── fetchUserBenefits()
│   ├── fetchBenefitProgress()
│   ├── fetchBenefitPeriods()
│   └── toggleBenefitUsed()
└── external deps:
    ├── react (useState, useEffect, useCallback, useMemo)
    ├── lucide-react (icons)
    └── tailwindcss (styles)
```

## 🎯 State Management Strategy

### Page-Level State (new-page.tsx)
```typescript
const [selectedPeriodId, setSelectedPeriodId] = useState('this-month');
const [selectedStatuses, setSelectedStatuses] = useState<BenefitStatus[]>([]);
const [benefits, setBenefits] = useState<BenefitRowProps[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Component-Level State (internal only)
```typescript
// BenefitRow
const [isMarkingUsed, setIsMarkingUsed] = useState(false);

// PastPeriodsSection
const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);

// BenefitsList
const [expandedSections, setExpandedSections] = useState<Set<BenefitStatus>>(...);
```

### Computed State (useMemo)
```typescript
const periodOptions = useMemo(() => [...], []);
const statusOptions = useMemo(() => [...], []);
const groupedBenefits = useMemo(() => {...}, [benefits]);
const summary = useMemo(() => {...}, [benefits]);
```

## 🔄 Render Optimization

### What Doesn't Cause Re-render
- ✅ Period option values (memoized)
- ✅ Status option values (memoized)
- ✅ Event handlers (useCallback)
- ✅ Other component's state changes

### What Causes Re-render
- ⚠️ `selectedPeriodId` changes
- ⚠️ `selectedStatuses` changes
- ⚠️ `benefits` changes
- ⚠️ `isLoading` changes
- ⚠️ `error` changes

### Optimization Techniques Used
1. **useMemo**: Period options, status options, grouped benefits
2. **useCallback**: Event handlers
3. **Selective rendering**: Only render sections with benefits
4. **Parallel API requests**: Promise.all for data loading
5. **Early returns**: Components return null for empty states

---

**Document Version**: 1.0  
**Last Updated**: April 2025  
**Purpose**: Reference architecture for Dashboard MVP
