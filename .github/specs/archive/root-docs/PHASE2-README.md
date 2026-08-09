# Phase 2: Advanced Benefits Features - Complete Implementation Guide

## 📋 Overview

Phase 2 introduces **6 interconnected advanced benefits features** that transform Card-Benefits into an intelligent, personalized benefits management platform.

### The 6 Features

1. **Period-Specific Benefit Tracking** - Record and track individual benefit usage events with timestamps
2. **Progress Indicators** - Visual progress bars showing usage relative to benefit limits
3. **Advanced Filtering** - Multi-criteria filtering (status, cadence, value, categories)
4. **Benefit Recommendations** - AI-powered personalized recommendations based on spending patterns
5. **Onboarding Flow** - Interactive 6-step guided tour for new users
6. **Mobile Optimization** - Mobile-first responsive design with offline capability

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥18.0.0
- PostgreSQL database
- React 19.0.0+
- TypeScript 5.3+
- Prisma 5.8+

### Installation

```bash
# 1. Install dependencies (if not already installed)
npm install

# 2. Set up environment variables
cp .env.example .env.local

# 3. Run database migrations
npm run prisma:migrate

# 4. Start development server
npm run dev

# 5. Validate Phase 2 setup
bash PHASE2-VALIDATION.sh
```

### Quick Test

```bash
# Run Phase 2 tests
npm run test:coverage

# Check TypeScript compilation
npm run type-check

# Check code quality
npm run lint
```

---

## 📁 Project Structure

```
src/features/benefits/                 # Phase 2 features
├── types/
│   └── benefits.ts                    # All TypeScript types & interfaces
├── lib/
│   ├── periodUtils.ts                 # Period boundary calculations
│   ├── benefitUsageUtils.ts          # Usage calculations & formatting
│   ├── filterUtils.ts                 # Advanced filtering logic
│   ├── recommendationAlgorithm.ts    # Recommendation scoring
│   └── offlineQueue.ts               # Offline sync queue management
├── hooks/
│   ├── useBenefitUsage.ts            # Usage history hook
│   ├── useBenefitProgress.ts         # Progress tracking hook
│   ├── useBenefitFilters.ts          # Filter state management hook
│   ├── useRecommendations.ts         # Recommendations hook
│   ├── useOnboarding.ts              # Onboarding state hook
│   └── useOfflineStatus.ts           # Offline status hook
├── components/
│   ├── usage/                        # Feature 1 components
│   ├── progress/                     # Feature 2 components
│   ├── filters/                      # Feature 3 components
│   ├── recommendations/              # Feature 4 components
│   ├── onboarding/                   # Feature 5 components
│   └── mobile/                       # Feature 6 components
└── __tests__/
    └── *.test.ts                     # Unit & integration tests

src/app/api/benefits/                 # Phase 2 API routes
├── usage/
│   ├── record/route.ts               # POST /api/benefits/usage/record
│   └── [benefitId]/route.ts
├── [benefitId]/
│   ├── usage/route.ts                # GET /api/benefits/[id]/usage
│   └── progress/route.ts             # GET /api/benefits/[id]/progress
├── progress/
│   └── all/route.ts                  # GET /api/benefits/progress/all
├── filtered/route.ts                 # GET /api/benefits/filtered
├── recommendations/
│   ├── route.ts                      # GET /api/recommendations
│   ├── generate/route.ts             # POST /api/recommendations/generate
│   └── [id]/route.ts                 # PATCH /api/recommendations/[id]/dismiss
└── onboarding/
    ├── start/route.ts                # POST /api/onboarding/start
    ├── state/route.ts                # GET /api/onboarding/state
    ├── step/[step]/route.ts          # PATCH /api/onboarding/step/[step]
    └── reset/route.ts                # DELETE /api/onboarding/reset

prisma/
├── schema.prisma                      # Updated with 4 new models
├── migrations/
│   └── */                             # Database migration files
└── seed.ts                            # Database seeding

public/
└── service-worker.js                  # Progressive Web App support
```

---

## 🎯 Core Concepts

### Benefit Periods

Benefit periods reset on different cadences:
- **Monthly** - Calendar month (1st-last day)
- **Quarterly** - Calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
- **Annual** - Calendar year or card anniversary
- **OneTime** - Never resets

Period calculations handle edge cases:
- Cardmember year (card anniversary) for annual benefits
- Partial month tracking
- Multi-period summaries

### Usage Tracking

Users can record benefit usage with:
- **Amount** - In cents for monetary, count for non-monetary
- **Description** - Required, max 500 characters
- **Category** - Optional tag (e.g., "airline fee", "dining")
- **Usage Date** - When the benefit was actually used

Duplicate detection prevents multiple entries for same benefit/amount/date.

### Progress Indicators

Progress is displayed with:
- **Percentage Bar** - Color-coded by utilization (green → yellow → orange → red)
- **Text Summary** - "Used $150 of $300 (50%)"
- **Status** - ACTIVE, USED, EXPIRING, or EXPIRED
- **Days Remaining** - Until period reset

### Advanced Filtering

Filter combinations (AND logic):
- Status: Active, Expiring, Used, Expired
- Cadence: Monthly, Quarterly, Annual, OneTime
- Value Range: Min-max slider
- Categories: Multi-select from usage history
- Search: Text search in benefit names

### Recommendations

Smart recommendations based on:
- User's spending patterns by category
- Available benefits matching spending
- Potential value calculation (limit - used)
- Urgency based on days remaining
- Dismissal tracking (don't re-show)

### Onboarding

6-step interactive flow:
0. **Welcome** - Introduction to benefits tracking
1. **Benefits Discovery** - Explain benefit types & value
2. **Your Card Benefits** - Show user's specific benefits
3. **Prioritization** - User selects top 3 benefits
4. **Usage Tracking** - How to record usage
5. **Notifications** - Email reminder signup

Tracks completion time, skipped steps, sample benefit usage.

### Offline Support

Service Worker provides:
- Offline access to cached benefits data
- Offline usage recording (queued for sync)
- Automatic sync when online
- IndexedDB persistence
- Sync status indicator

---

## 🔌 API Endpoints Summary

### Usage Recording
```
POST   /api/benefits/usage/record         Create usage record
GET    /api/benefits/[id]/usage           Get usage history
PATCH  /api/benefits/[id]/usage/[rid]    Update usage record
DELETE /api/benefits/[id]/usage/[rid]    Delete usage record
```

### Progress Tracking
```
GET    /api/benefits/[id]/progress        Get single benefit progress
GET    /api/benefits/progress/all         Get all benefits progress
```

### Filtering
```
GET    /api/benefits/filtered             Get filtered benefits
```

### Recommendations
```
POST   /api/recommendations/generate      Generate recommendations
GET    /api/recommendations               Get active recommendations
PATCH  /api/recommendations/[id]/dismiss  Dismiss recommendation
```

### Onboarding
```
POST   /api/onboarding/start              Start onboarding
GET    /api/onboarding/state              Get current state
PATCH  /api/onboarding/step/[n]/complete Mark step complete
DELETE /api/onboarding/reset              Reset onboarding
PATCH  /api/onboarding/reminders/setup    Set up email reminders
```

---

## 🎨 Component Usage Examples

### Feature 1: Usage Tracking

```tsx
import { useBenefitUsage } from '@/features/benefits/hooks/useBenefitUsage';
import { MarkUsageModal } from '@/features/benefits/components/usage/MarkUsageModal';
import { UsageEventList } from '@/features/benefits/components/usage/UsageEventList';

export function BenefitUsageSection({ benefitId }: { benefitId: string }) {
  const { records, addRecord, isLoading } = useBenefitUsage(benefitId);

  return (
    <div>
      <MarkUsageModal benefitId={benefitId} onSubmit={addRecord} />
      <UsageEventList records={records} isLoading={isLoading} />
    </div>
  );
}
```

### Feature 2: Progress Indicators

```tsx
import { useBenefitProgress } from '@/features/benefits/hooks/useBenefitProgress';
import { ProgressBar } from '@/features/benefits/components/progress/ProgressBar';
import { ProgressSummary } from '@/features/benefits/components/progress/ProgressSummary';

export function BenefitProgressSection({ benefitId }: { benefitId: string }) {
  const { progress, isLoading } = useBenefitProgress(benefitId);

  if (isLoading) return <div>Loading progress...</div>;

  return (
    <div>
      <ProgressBar benefitId={benefitId} />
      {progress && <ProgressSummary progress={progress} />}
    </div>
  );
}
```

### Feature 3: Advanced Filtering

```tsx
import { useBenefitFilters } from '@/features/benefits/hooks/useBenefitFilters';
import { AdvancedFilterBar } from '@/features/benefits/components/filters/AdvancedFilterBar';
import { BenefitsList } from '@/features/benefits/components/BenefitsList';

export function FilteredBenefits() {
  const { criteria, results, applyFilters } = useBenefitFilters();

  return (
    <div>
      <AdvancedFilterBar criteria={criteria} onApply={applyFilters} />
      {results && <BenefitsList benefits={results.benefits} />}
    </div>
  );
}
```

### Feature 4: Recommendations

```tsx
import { useRecommendations } from '@/features/benefits/hooks/useRecommendations';
import { RecommendationsList } from '@/features/benefits/components/recommendations/RecommendationsList';

export function RecommendationsSection() {
  const { recommendations, dismiss } = useRecommendations();

  return (
    <RecommendationsList 
      recommendations={recommendations} 
      onDismiss={dismiss}
    />
  );
}
```

### Feature 5: Onboarding

```tsx
import { useOnboarding } from '@/features/benefits/hooks/useOnboarding';
import { OnboardingWrapper } from '@/features/benefits/components/onboarding/OnboardingWrapper';

export function OnboardingFlow() {
  const { state, progress, nextStep, skipStep } = useOnboarding();

  if (!state || state.completedAt) return null;

  return (
    <OnboardingWrapper 
      state={state} 
      progress={progress}
      onNext={nextStep}
      onSkip={skipStep}
    />
  );
}
```

### Feature 6: Offline Status

```tsx
import { useOfflineStatus } from '@/features/benefits/hooks/useOfflineStatus';
import { SyncStatusIndicator } from '@/features/benefits/components/mobile/SyncStatusIndicator';

export function OfflineIndicator() {
  const { isOnline, syncInProgress, pendingItems } = useOfflineStatus();

  if (isOnline && !syncInProgress) return null;

  return (
    <SyncStatusIndicator 
      isOnline={isOnline}
      pendingItems={pendingItems}
      syncing={syncInProgress}
    />
  );
}
```

---

## 🧪 Testing

### Run All Tests
```bash
npm run test:coverage
```

### Run Specific Test
```bash
npm run test -- periodUtils.test.ts
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### E2E Tests
```bash
npm run test:e2e
```

### Type Checking
```bash
npm run type-check
```

---

## 📊 Database Models

### BenefitUsageRecord
Tracks individual benefit usage events.
```
- id: string (primary key)
- benefitId: string (references UserBenefit)
- periodId: string (foreign key → BenefitPeriod)
- playerId: string (foreign key → Player)
- userCardId: string (foreign key → UserCard)
- amount: number (cents or count)
- description: string (max 500 chars)
- category: string (optional tag)
- usageDate: Date (when used)
- isDeleted: boolean (soft delete)
- Indexes: benefitId, periodId, playerId, usageDate
```

### BenefitPeriod
Aggregated usage summary per benefit per period.
```
- id: string (primary key)
- benefitId: string
- playerId: string (foreign key)
- startDate: Date
- endDate: Date
- resetCadence: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONETIME'
- totalAmount: number (cached)
- totalCount: number (usage events)
- lastUsedAt: Date
- periodNumber: number
- isArchived: boolean
- Indexes: benefitId, playerId, startDate, resetCadence
```

### BenefitRecommendation
Personalized recommendations for users.
```
- id: string (primary key)
- benefitId: string
- playerId: string (foreign key)
- title: string
- description: string
- potentialValue: number (limit - used)
- urgency: 'HIGH' | 'MEDIUM' | 'LOW'
- priority: number (for sorting)
- isDismissed: boolean
- viewCount: number (engagement tracking)
- expiresAt: Date (when to stop showing)
- Indexes: benefitId, playerId, isDismissed, priority
```

### UserOnboardingState
Tracks onboarding progress for each player.
```
- id: string (primary key)
- playerId: string (foreign key, unique)
- userId: string (foreign key)
- step: number (0-5)
- completedSteps: string (CSV: "0,2,4")
- setupReminders: boolean
- reminderEmail: string
- reminderFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
- startedAt: Date
- completedAt: Date (null if in progress)
- totalTimeSpent: number (seconds)
- Indexes: userId, completedAt
```

---

## 🔐 Security & Authorization

All API routes enforce:
- **Authentication** - User must be logged in (checked with `getAuthContext()`)
- **Authorization** - User can only access their own data (checked by playerId)
- **Validation** - Input validated against schema before processing
- **Audit Logging** - All mutations logged for compliance

---

## ♿ Accessibility (WCAG 2.1 AA)

All components include:
- **Semantic HTML** - `<button>`, `<nav>`, `<main>`, etc.
- **ARIA Labels** - For interactive elements
- **Keyboard Navigation** - All features keyboard accessible
- **Color Contrast** - 4.5:1 ratio (light & dark modes)
- **Screen Reader Support** - Proper role & label attributes
- **Focus Management** - Clear focus indicators

---

## �� Responsive Design

### Breakpoints
- **375px** (Mobile) - Single column, full-width modals
- **768px** (Tablet) - Two columns, responsive grids
- **1440px** (Desktop) - Three columns, side navigation

### Mobile Features
- Touch targets ≥44px × 44px
- Offline access to features
- Automatic sync when online
- Optimized for slow connections

---

## 🚀 Deployment

### Feature Flags
All Phase 2 features are behind feature flags:
```typescript
const FEATURE_PHASE2 = process.env.FEATURE_PHASE2 === 'true';
```

### Gradual Rollout
```
Day 1: 5% of users
Day 2: 25% of users
Day 3: 50% of users
Day 4: 100% of users
```

### Rollback
If issues occur, simply set `FEATURE_PHASE2=false` to disable all Phase 2 features.

---

## 🐛 Debugging

### Enable Detailed Logging
```typescript
// In your .env
DEBUG=benefits:*
```

### Check Database State
```bash
npm run prisma:studio
```

### Inspect Service Worker
```
Chrome DevTools → Application → Service Workers
```

### Test Offline Mode
```
Chrome DevTools → Network → Offline
```

---

## 📚 Documentation

- **[PHASE2-SPEC.md](./.github/specs/PHASE2-SPEC.md)** - Full technical specification
- **[PHASE2-IMPLEMENTATION-GUIDE.md](./PHASE2-IMPLEMENTATION-GUIDE.md)** - Developer handbook
- **[Types](./src/features/benefits/types/benefits.ts)** - TypeScript definitions
- **[Utilities](./src/features/benefits/lib/)** - Utility functions

---

## 🤝 Contributing

When implementing Phase 2 features:

1. **Follow the Spec** - Match PHASE2-SPEC.md requirements exactly
2. **Type Everything** - No `any` types; use strict TypeScript
3. **Test Thoroughly** - Aim for ≥85% coverage
4. **Document Clearly** - Add comments & JSDoc
5. **Consider Accessibility** - Include ARIA labels & semantic HTML
6. **Make It Responsive** - Test at 375px, 768px, 1440px
7. **Error Handling** - Provide user-friendly error messages

---

## 🎯 Success Metrics

- **Test Coverage** ≥85%
- **WCAG Compliance** Level AA
- **API Response Time** <200ms (p95)
- **Mobile LCP** <800ms
- **TypeScript Errors** 0
- **ESLint Errors** 0
- **Acceptance Criteria** 97/97 passing

---

## ❓ FAQ

**Q: Can I use Phase 2 without Phase 1?**  
A: No, Phase 2 builds on Phase 1 features. Both are required.

**Q: Is Phase 1 data affected by Phase 2?**  
A: No, Phase 2 is fully backward compatible. Phase 1 data remains unchanged.

**Q: Can users opt out of Phase 2 features?**  
A: Via feature flags, yes. You can disable Phase 2 for specific users.

**Q: How long does onboarding take?**  
A: Target is <10 minutes including all 6 steps.

**Q: Is offline support mandatory?**  
A: No, but recommended for mobile users. Users can still use app online without it.

---

## 📞 Support

For questions or issues:
1. Check [PHASE2-SPEC.md](./.github/specs/PHASE2-SPEC.md) for feature details
2. Review [PHASE2-IMPLEMENTATION-GUIDE.md](./PHASE2-IMPLEMENTATION-GUIDE.md) for patterns
3. Check existing component implementations
4. Review test files for usage examples
5. Contact the engineering team

---

**Status:** 🟡 **IN DEVELOPMENT**  
**Last Updated:** April 2026  
**Total Coverage:** Database ✅ | Types ✅ | Utilities ✅ | APIs ⏳ | Components ⏳ | Tests ⏳  

Good luck! 🚀
