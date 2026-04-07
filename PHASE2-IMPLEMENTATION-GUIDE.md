# Phase 2 Implementation Guide - Complete Developer Handbook

**Status:** Ready for Implementation
**Last Updated:** April 2026
**Total Tasks:** 52 development tasks across 7 phases

---

## ⚡ Quick Start - What You Need to Know

### Phase 2 At a Glance
```
6 Features | 40+ API Routes | 35+ React Components | 97 Acceptance Criteria
```

### What Was Just Created
✅ **Database Schema (Phase 2A)** - All tables, relationships, indexes created in Prisma
✅ **Type Definitions** - `src/features/benefits/types/benefits.ts` with all TypeScript types  
✅ **Core Utilities** - Period calculations, usage formatting, duplicate detection

### What Needs to Be Built Next

#### Immediate (Today)
- [ ] Phase 2B: API Routes (15 core endpoints)
- [ ] Phase 2C: Core React Hooks (6 custom hooks)
- [ ] Phase 2C-D: Components (35+ total)

#### This Week
- [ ] Phase 2E: Integration & Context
- [ ] Phase 2F: Service Worker & Offline
- [ ] Phase 2G: Testing Suite

---

## 📋 API Routes Summary (Phase 2B)

### Group 1: Usage Recording & History

```typescript
// POST /api/benefits/usage/record
// Create a new benefit usage record
Request: {
  benefitId: string;
  amount: number;           // In cents
  description: string;      // Max 500 chars
  category?: string;
  usageDate: Date;          // When it was used
}
Response: { record: BenefitUsageRecord }

// GET /api/benefits/[benefitId]/usage
// Get usage history for a specific benefit (paginated)
Query: { page?: number; pageSize?: number; }
Response: { 
  records: BenefitUsageRecord[];
  total: number;
  page: number;
  hasMore: boolean;
}

// PATCH /api/benefits/[benefitId]/usage/[recordId]
// Update a usage record
Request: Partial<{ amount, description, category, usageDate }>
Response: { record: BenefitUsageRecord }

// DELETE /api/benefits/[benefitId]/usage/[recordId]
// Soft delete a usage record
Response: { success: boolean }
```

### Group 2: Progress Tracking

```typescript
// GET /api/benefits/[benefitId]/progress
// Get progress toward limit for current period
Response: {
  benefitId: string;
  currentPeriodId: string;
  used: number;
  limit?: number;
  percentageUsed: number;
  daysUntilReset: number;
  status: 'ACTIVE' | 'USED' | 'EXPIRING' | 'EXPIRED';
  color: 'green' | 'yellow' | 'orange' | 'red';
}

// GET /api/user/benefits/progress/all
// Get progress for all user's benefits
Response: {
  benefits: ProgressIndicator[];
  summary: {
    activeCount: number;
    expiringCount: number;
    totalPotentialValue: number;
  };
}
```

### Group 3: Filtering

```typescript
// GET /api/user/benefits/filtered
// Get benefits with advanced filtering
Query: {
  status?: 'ACTIVE,EXPIRING,USED,EXPIRED';  // CSV
  cadence?: 'MONTHLY,QUARTERLY,ANNUAL';     // CSV
  minValue?: number;
  maxValue?: number;
  categories?: 'dining,travel,shopping';    // CSV
  searchText?: string;
  page?: number;
  pageSize?: number;
}
Response: FilteredBenefitsResponse

// Sorting: &sort=value,-createdAt (- = desc)
```

### Group 4: Recommendations

```typescript
// POST /api/recommendations/generate
// Trigger recommendation generation for user
Response: { recommendations: BenefitRecommendation[] }

// GET /api/recommendations
// Get active (non-dismissed) recommendations
Query: { limit?: number; }
Response: {
  recommendations: BenefitRecommendation[];
  total: number;
  summary: { totalPotentialValue: number; byUrgency: {...} };
}

// PATCH /api/recommendations/[id]/dismiss
// Dismiss a recommendation
Request: { reason?: string; }
Response: { success: boolean }
```

### Group 5: Onboarding

```typescript
// POST /api/onboarding/start
// Begin onboarding for a player
Request: { playerId: string; }
Response: { state: UserOnboardingState }

// PATCH /api/onboarding/step/[step]/complete
// Mark a step as completed
Request: { timeSpent?: number; usedSampleBenefit?: boolean; }
Response: { state: UserOnboardingState; progress: OnboardingProgress }

// GET /api/onboarding/state
// Get current onboarding state
Response: { state: UserOnboardingState; progress: OnboardingProgress }

// DELETE /api/onboarding/reset
// Reset onboarding (allow user to redo)
Response: { success: boolean }

// PATCH /api/onboarding/reminders/setup
// Set up email reminders
Request: { email: string; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; }
Response: { success: boolean }
```

### Error Responses (All Routes)
```typescript
// 400 Bad Request
{ error: { code: 'INVALID_INPUT', message: '...', details: {...} } }

// 401 Unauthorized
{ error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } }

// 403 Forbidden
{ error: { code: 'FORBIDDEN', message: 'User cannot access this resource' } }

// 404 Not Found
{ error: { code: 'NOT_FOUND', message: 'Resource not found' } }

// 409 Conflict
{ error: { code: 'DUPLICATE', message: 'Record already exists' } }

// 500 Internal Server Error
{ error: { code: 'INTERNAL_ERROR', message: '...' } }
```

---

## 🎣 Custom Hooks (Phase 2C-D)

### 6 Core Hooks to Implement

```typescript
// 1. useBenefitUsage(benefitId)
// Fetch & cache usage history for a benefit
const {
  records,        // BenefitUsageRecord[]
  total,
  page,
  isLoading,
  error,
  loadMore,       // () => Promise<void>
  addRecord,      // (input: CreateUsageRecordInput) => Promise<void>
  updateRecord,   // (recordId: string, input: UpdateUsageRecordInput) => Promise<void>
  deleteRecord,   // (recordId: string) => Promise<void>
} = useBenefitUsage(benefitId);

// 2. useBenefitProgress(benefitId)
// Calculate progress toward limit with real-time updates
const {
  progress,       // ProgressIndicator
  isLoading,
  error,
  daysRemaining,
  percentageUsed,
  color,
  refresh,        // () => Promise<void>
} = useBenefitProgress(benefitId);

// 3. useBenefitFilters()
// Manage filter state with URL persistence
const {
  criteria,       // BenefitFilterCriteria
  results,        // FilteredBenefitsResponse
  isLoading,
  error,
  setCriteria,    // (criteria: Partial<BenefitFilterCriteria>) => void
  clearFilters,   // () => void
  applyFilters,   // () => Promise<void>
} = useBenefitFilters();

// 4. useRecommendations()
// Fetch & manage personalized recommendations
const {
  recommendations,  // BenefitRecommendation[]
  isLoading,
  error,
  dismiss,          // (id: string) => Promise<void>
  refresh,          // () => Promise<void>
} = useRecommendations();

// 5. useOnboarding()
// Track onboarding progress & navigation
const {
  state,            // UserOnboardingState
  progress,         // OnboardingProgress
  isLoading,
  error,
  nextStep,         // () => Promise<void>
  previousStep,     // () => Promise<void>
  skipStep,         // () => Promise<void>
  completeStep,     // (input: CompleteOnboardingStepInput) => Promise<void>
  reset,            // () => Promise<void>
} = useOnboarding();

// 6. useOfflineStatus()
// Monitor online/offline status & sync queue
const {
  isOnline,         // boolean
  syncInProgress,   // boolean
  pendingItems,     // number
  syncError,        // string | null
  sync,             // () => Promise<void>
  clearQueue,       // () => Promise<void>
} = useOfflineStatus();
```

---

## 🧩 Component Architecture (Phase 2C-E)

### Feature 1: Period-Specific Benefit Tracking
```
src/features/benefits/components/usage/
├── BenefitUsageCard.tsx       // Display usage with dates
├── UsageEventList.tsx          // Paginated list
├── MarkUsageModal.tsx          // Form to record usage
├── UsageHistoryChart.tsx       // Timeline/chart
├── UsageDetail.tsx             // View/edit single record
└── UsageExport.tsx             // Export functionality
```

### Feature 2: Progress Indicators
```
src/features/benefits/components/progress/
├── ProgressBar.tsx            // Visual progress (green→yellow→red)
├── ProgressSummary.tsx        // Text summary ("$150 of $300")
├── ProgressTimeline.tsx       // Historical progress across periods
├── ResetCadenceIndicator.tsx  // When next reset occurs
└── ProgressChart.tsx          // Graph over time
```

### Feature 3: Advanced Filtering
```
src/features/benefits/components/filters/
├── AdvancedFilterBar.tsx      // Main filter controls
├── FilterByStatus.tsx         // Status dropdown
├── FilterByCadence.tsx        // Cadence checkboxes
├── FilterByValue.tsx          // Range slider
├── FilterByCategory.tsx       // Multi-select
└── FilterSummary.tsx          // Show active filters
```

### Feature 4: Benefit Recommendations
```
src/features/benefits/components/recommendations/
├── RecommendationCard.tsx     // Single recommendation
├── RecommendationsList.tsx    // Grid of recommendations
├── RecommendationReasoning.tsx // Why recommended
└── DismissRecommendation.tsx  // Dismiss/snooze button
```

### Feature 5: Onboarding Flow
```
src/features/benefits/components/onboarding/
├── OnboardingWrapper.tsx       // Flow container
├── OnboardingStep.tsx          // Individual step
├── BenefitsDiscoveryStep.tsx   // Explain concepts
├── CardBenefitsStep.tsx        // Show user's cards
├── PrioritizationStep.tsx      // Choose top benefits
├── SetupNotificationsStep.tsx  // Enable notifications
├── OnboardingComplete.tsx      // Completion screen
└── OnboardingProgress.tsx      // Progress indicator
```

### Feature 6: Mobile Optimization
```
src/features/benefits/components/mobile/
├── MobileUsageTracker.tsx      // Mobile entry interface
├── MobileProgressView.tsx      // Compact progress
├── OfflineBenefitsList.tsx    // Cached benefits
├── SyncStatusIndicator.tsx     // Sync queue status
└── ResponsiveFilterBar.tsx     // Adaptive filters
```

---

## 🔧 Implementation Checklist

### Phase 2A: Database ✅ DONE
- [x] Prisma schema updated with 4 new models
- [x] Relationships configured
- [x] Indexes created
- [x] Database migrated and synced

### Phase 2B: API Routes (15 endpoints)
- [ ] Usage Recording (POST, GET, PATCH, DELETE)
- [ ] Progress Tracking (GET single, GET all)
- [ ] Filtering (GET with advanced filters)
- [ ] Recommendations (POST generate, GET, PATCH dismiss)
- [ ] Onboarding (POST start, PATCH step, GET state, DELETE reset)
- [ ] Error handling & validation for all routes
- [ ] Rate limiting (optional, configured via env)
- [ ] Request/response logging for debugging

### Phase 2C: Custom Hooks (6 hooks)
- [ ] `useBenefitUsage.ts` with caching & pagination
- [ ] `useBenefitProgress.ts` with real-time updates
- [ ] `useBenefitFilters.ts` with URL state persistence
- [ ] `useRecommendations.ts` with dismissal handling
- [ ] `useOnboarding.ts` with navigation
- [ ] `useOfflineStatus.ts` with queue management

### Phase 2D: Components (35+ total)
- [ ] Usage tracking components (6)
- [ ] Progress indicator components (5)
- [ ] Filter components (6)
- [ ] Recommendation components (4)
- [ ] Onboarding components (8)
- [ ] Mobile components (5)
- [ ] All components responsive & accessible
- [ ] All components with loading/error states

### Phase 2E: Integration & Context
- [ ] BenefitFiltersContext with provider
- [ ] RecommendationsContext with provider
- [ ] OnboardingContext with provider
- [ ] Update existing dashboard page with Phase 2 features
- [ ] Route integration for benefits pages

### Phase 2F: Service Worker & Offline
- [ ] Create `public/service-worker.js`
- [ ] IndexedDB caching for benefits data
- [ ] Sync queue persistence
- [ ] Offline detection & UI feedback
- [ ] Network event handlers

### Phase 2G: Testing Suite
- [ ] Unit tests: utilities (periodUtils, benefitUsageUtils, etc.)
- [ ] Unit tests: custom hooks
- [ ] Unit tests: components (snapshots & interactions)
- [ ] Integration tests: full user flows
- [ ] E2E tests: Playwright scenarios
- [ ] Performance tests: filter speed, progress calc
- [ ] Accessibility tests: WCAG 2.1 AA
- [ ] Coverage reports (≥85% target)

---

## 📝 Code Pattern Examples

### API Route Pattern
```typescript
// src/app/api/benefits/usage/record/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/features/auth/lib/server';
import { validateInput } from '@/lib/validation';
import { prisma } from '@/lib/prisma';
import type { CreateUsageRecordInput } from '@/features/benefits/types/benefits';

const SCHEMA = {
  benefitId: { type: 'string', required: true },
  amount: { type: 'number', required: true, min: 0, max: 99999900 },
  description: { type: 'string', required: true, maxLength: 500 },
  category: { type: 'string', required: false, maxLength: 100 },
  usageDate: { type: 'date', required: true },
};

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const { user, player } = await getAuthContext();
    if (!user || !player) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } },
        { status: 401 }
      );
    }

    // 2. Parse & validate request
    const body = await request.json();
    const errors = validateInput(body, SCHEMA);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Validation failed', details: { errors } } },
        { status: 400 }
      );
    }

    const input = body as CreateUsageRecordInput;

    // 3. Check benefit ownership
    const benefit = await prisma.userBenefit.findFirst({
      where: { id: input.benefitId, playerId: player.id },
      include: { userCard: true },
    });

    if (!benefit) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Benefit not found' } },
        { status: 404 }
      );
    }

    // 4. Check for duplicates
    const existingRecords = await prisma.benefitUsageRecord.findMany({
      where: { benefitId: input.benefitId, playerId: player.id },
      orderBy: { usageDate: 'desc' },
      take: 10,
    });

    // 5. Create period if needed
    const period = await getOrCreatePeriod(input.benefitId, player.id, input.usageDate);

    // 6. Create record
    const record = await prisma.benefitUsageRecord.create({
      data: {
        benefitId: input.benefitId,
        playerId: player.id,
        userCardId: benefit.userCardId,
        periodId: period.id,
        amount: input.amount,
        description: input.description,
        category: input.category,
        usageDate: input.usageDate,
      },
    });

    // 7. Update period summary
    await updatePeriodSummary(period.id);

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/benefits/usage/record]', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to record usage' } },
      { status: 500 }
    );
  }
}

// Helper functions
async function getOrCreatePeriod(benefitId: string, playerId: string, usageDate: Date) {
  const benefit = await prisma.userBenefit.findUnique({ where: { id: benefitId } });
  // ... period logic
}

async function updatePeriodSummary(periodId: string) {
  const records = await prisma.benefitUsageRecord.findMany({
    where: { periodId, isDeleted: false },
  });
  
  const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
  
  return prisma.benefitPeriod.update({
    where: { id: periodId },
    data: { totalAmount, totalCount: records.length },
  });
}
```

### Custom Hook Pattern
```typescript
// src/features/benefits/hooks/useBenefitUsage.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import type { BenefitUsageRecord, CreateUsageRecordInput } from '../types/benefits';

interface UseBenefitUsageReturn {
  records: BenefitUsageRecord[];
  total: number;
  page: number;
  isLoading: boolean;
  error: Error | null;
  loadMore: () => Promise<void>;
  addRecord: (input: CreateUsageRecordInput) => Promise<void>;
  updateRecord: (recordId: string, input: Partial<CreateUsageRecordInput>) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
}

export function useBenefitUsage(benefitId: string): UseBenefitUsageReturn {
  const [page, setPage] = useState(1);
  
  // Fetch with SWR for caching
  const { data, error, isLoading, mutate } = useSWR(
    benefitId ? `/api/benefits/${benefitId}/usage?page=${page}&pageSize=20` : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch usage');
      return res.json();
    }
  );

  const loadMore = useCallback(async () => {
    setPage(p => p + 1);
  }, []);

  const addRecord = useCallback(async (input: CreateUsageRecordInput) => {
    const res = await fetch('/api/benefits/usage/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to add record');
    await mutate(); // Revalidate cache
  }, [mutate]);

  const updateRecord = useCallback(async (recordId: string, input: Partial<CreateUsageRecordInput>) => {
    const res = await fetch(`/api/benefits/${benefitId}/usage/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error('Failed to update record');
    await mutate();
  }, [benefitId, mutate]);

  const deleteRecord = useCallback(async (recordId: string) => {
    const res = await fetch(`/api/benefits/${benefitId}/usage/${recordId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete record');
    await mutate();
  }, [benefitId, mutate]);

  return {
    records: data?.records || [],
    total: data?.total || 0,
    page,
    isLoading,
    error: error instanceof Error ? error : null,
    loadMore,
    addRecord,
    updateRecord,
    deleteRecord,
  };
}
```

### Component Pattern
```typescript
// src/features/benefits/components/progress/ProgressBar.tsx
'use client';

import { useMemo } from 'react';
import { useBenefitProgress } from '../../hooks/useBenefitProgress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  benefitId: string;
  className?: string;
}

export function ProgressBar({ benefitId, className }: ProgressBarProps) {
  const { progress, isLoading, error } = useBenefitProgress(benefitId);

  const colorClass = useMemo(() => {
    const colorMap = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-500',
      red: 'bg-red-500',
    };
    return colorMap[progress?.color || 'green'];
  }, [progress?.color]);

  if (isLoading) {
    return <div className={cn('h-2 bg-gray-200 rounded animate-pulse', className)} />;
  }

  if (error || !progress) {
    return (
      <div className={cn('h-2 bg-red-100 rounded', className)} title="Error loading progress" />
    );
  }

  const percentage = Math.min(progress.percentageUsed, 100);

  return (
    <div
      className={cn('w-full bg-gray-200 rounded-full overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${progress.displayText}`}
    >
      <div
        className={cn('h-2 transition-all duration-300', colorClass)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
```

---

## 🚀 Getting Started (Next Steps)

### Today
1. Read this entire document
2. Review the Phase 2 specification (`.github/specs/PHASE2-SPEC.md`)
3. Start Phase 2B: API Routes
   - Begin with usage recording route
   - Implement progress tracking route
   - Add filtering route

### This Week
1. Complete Phase 2B: All 15 API routes
2. Implement Phase 2C: 6 custom hooks
3. Build core Phase 2D components

### Next Week
1. Complete remaining Phase 2D/E components
2. Implement Phase 2E: Integration & context
3. Start Phase 2F: Service Worker & offline

### Week 3
1. Phase 2F: Complete offline support
2. Phase 2G: Testing suite
3. Code review & refinement
4. Prepare for deployment

---

## 📚 Key Files & Directories

```
src/features/benefits/
├── types/
│   └── benefits.ts                    ✅ Created
├── lib/
│   ├── periodUtils.ts                 ✅ Created
│   ├── benefitUsageUtils.ts          ✅ Created
│   ├── recommendationAlgorithm.ts    (Next)
│   ├── filterUtils.ts                (Next)
│   └── offlineQueue.ts               (Next)
├── hooks/
│   ├── useBenefitUsage.ts            (Next)
│   ├── useBenefitProgress.ts         (Next)
│   ├── useBenefitFilters.ts          (Next)
│   ├── useRecommendations.ts         (Next)
│   ├── useOnboarding.ts              (Next)
│   └── useOfflineStatus.ts           (Next)
├── components/
│   ├── usage/                        (6 components)
│   ├── progress/                     (5 components)
│   ├── filters/                      (6 components)
│   ├── recommendations/              (4 components)
│   ├── onboarding/                   (8 components)
│   └── mobile/                       (5 components)
└── __tests__/
    ├── benefitUsageUtils.test.ts
    ├── periodUtils.test.ts
    ├── useBenefitUsage.test.ts
    └── (More tests...)

src/app/api/benefits/
├── usage/
│   ├── record/route.ts
│   └── [benefitId]/route.ts
├── progress/
│   ├── [benefitId]/route.ts
│   └── all/route.ts
├── filtered/route.ts
├── recommendations/
│   ├── route.ts
│   ├── generate/route.ts
│   └── [id]/route.ts
└── onboarding/
    ├── start/route.ts
    ├── state/route.ts
    ├── step/[step]/route.ts
    └── reset/route.ts

public/
└── service-worker.js                 (Next)

prisma/
└── schema.prisma                      ✅ Updated
```

---

## 💡 Pro Tips for Implementation

### 1. API Routes Best Practices
- Always validate input with schema validation
- Check auth & ownership before queries
- Use `getAuthContext()` from `@/features/auth/lib/server`
- Implement proper error handling with specific error codes
- Add request/response logging for debugging
- Use transactions for multi-step operations

### 2. Custom Hooks Best Practices
- Use SWR for data fetching & caching
- Provide loading/error states always
- Implement optimistic updates where possible
- Clear errors after 5 seconds
- Debounce rapid API calls
- Cancel requests on unmount

### 3. Component Best Practices
- Make components responsive first (mobile-first)
- Always include loading & error states
- Use semantic HTML for accessibility
- Test components with different viewport sizes
- Implement proper ARIA labels
- Use Tailwind classes (no CSS modules)

### 4. Testing Best Practices
- Test happy path + error paths
- Test edge cases (empty data, null values)
- Test accessibility features
- Test responsive design at 375px, 768px, 1440px
- Use React Testing Library best practices
- Aim for 85%+ test coverage

---

## ✅ Success Metrics

- **Code Coverage:** ≥85% (unit tests)
- **WCAG Compliance:** Level AA
- **API Response Time:** <200ms (p95)
- **TypeScript Errors:** 0
- **ESLint Errors:** 0
- **Acceptance Criteria:** 97/97 passing
- **Performance:** Mobile LCP <800ms

---

## 📞 Questions or Issues?

Refer back to:
- `.github/specs/PHASE2-SPEC.md` - Complete specification
- This document - Implementation details
- Existing code patterns in `src/` - Code style examples

**Good luck! 🚀**
