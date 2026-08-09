# Card-Benefits Implementation Roadmap
## April 2026 - Complete Development Timeline

---

## Overall Project Timeline

```
APRIL 2026
├─ ✅ Phase 1: Security      (Apr 1-3, deployed Apr 4-6)
├─ ✅ Phase 2A: Bugfixes     (Apr 7-8, deployed Apr 8)
├─ 🔄 Phase 2B: Features     (Apr 8-18, 30% complete)
├─ 📋 Phase 6C: Spec Ready   (Apr 9, ready for implementation)
├─ 🔜 Phase 3: Testing       (Apr 19-22)
├─ 🔜 Phase 4: Payment Mgt   (Apr 23-30)
│
MAY 2026
├─ 🔜 Phase 5: Analytics     (May 1-10)
├─ 🔜 Phase 6: UI Polish     (May 11-15)
├─ 🔜 Phase 7: Documentation (May 16-20)
└─ 🔜 Phase 8: Full Deploy   (May 21+)

TIMELINE: 5-8 weeks to MVP completion
```

---

## Phase 2B: Feature Implementation (Current - 30% Done)

### Status Overview
```
Phase 2B: Usage Tracking & Recommendations
├─ Database Models        ✅ DONE (100%)
├─ TypeScript Types       ✅ DONE (100%)
├─ Custom Hooks           ✅ DONE (100%)
├─ API Routes (12)        🔄 IN PROGRESS (15%)
├─ React Components (30)  🔄 IN PROGRESS (7%)
├─ Integration Tests      🔜 TODO (0%)
├─ E2E Tests             🔜 TODO (0%)
└─ Deployment            🔜 TODO (0%)

Time Remaining: 7-10 business days
Completion Target: April 15-18, 2026
```

### What's Done (30%)

#### 1. Database Models ✅
**File**: `/prisma/schema.prisma` (complete)

**Models Added**:
1. `BenefitUsageRecord` (line 409-433)
   - Tracks individual usage events
   - Fields: userId, benefitId, usageAmount, usageDate, category
   - Unique constraint: benefitId + userId + usageDate

2. `BenefitPeriod` (line 439-469)
   - Tracks usage within specific timeframes
   - Fields: periodStart, periodEnd, periodType, totalUsed, usageStatus
   - Relations to BenefitUsageRecord

3. `BenefitRecommendation` (line 475-497)
   - Personalized benefit recommendations
   - Fields: score (0.0-1.0), reason, matchedCriteria, dismissedAt

4. `OnboardingSession` + `OnboardingStep` (line 503-554)
   - First-time user setup guide
   - 6-step onboarding process
   - Session + step-level tracking

#### 2. TypeScript Types ✅
**File**: `/src/features/benefits/types/benefits.ts`

**Types Defined**:
```typescript
// Usage tracking
interface BenefitUsageRecord { /* 8 fields */ }
interface BenefitPeriod { /* 9 fields */ }
interface UsageFilter { /* date ranges, status */ }

// Recommendations
interface BenefitRecommendation { /* scoring */ }
interface RecommendationFilter { /* dismissal status */ }

// Onboarding
interface OnboardingSession { /* 6 steps */ }
interface OnboardingStep { /* step tracking */ }
interface OnboardingState { /* UI state */ }

// API responses
interface UsageResponse { /* paged results */ }
interface RecommendationResponse { /* recommendations */ }
```

#### 3. Custom Hooks ✅
**Location**: `/src/features/benefits/hooks/`

**Hooks Implemented** (6 total):
1. `useBenefitUsage()` - Fetch & manage usage records
2. `useBenefitProgress()` - Calculate period progress (0-100%)
3. `useBenefitFilters()` - Filter & sort usage
4. `useRecommendations()` - Smart benefit alerts
5. `useOnboarding()` - Track onboarding progress
6. `useOfflineSync()` - Sync when offline (Service Worker ready)

**Example Usage**:
```typescript
const { records, isLoading, addUsage } = useBenefitUsage(benefitId)
const { progress, remainingDays, urgency } = useBenefitProgress(benefit)
const { recommendations, dismiss } = useRecommendations(userId)
```

#### 4. API Routes (2 Done, 11 Remaining)

**Done** ✅:
- `GET /api/benefits/usage` - Fetch usage records
- `POST /api/benefits/usage` - Log new usage event

**Remaining** 🔄 (11 routes, 1-2 days):
```
Analytics:
  ├─ GET /api/benefits/analytics/summary
  ├─ GET /api/benefits/analytics/trends
  └─ GET /api/benefits/analytics/categories

Recommendations:
  ├─ GET /api/recommendations
  ├─ POST /api/recommendations/[id]/dismiss
  └─ GET /api/recommendations/[id]/details

Onboarding:
  ├─ GET /api/onboarding/[playerId]
  ├─ POST /api/onboarding/[playerId]/step
  ├─ PUT /api/onboarding/[playerId]/complete
  └─ POST /api/onboarding/[playerId]/reset

Historical:
  └─ GET /api/benefits/history/missed
```

**Work Estimate**: 1-2 days (8-10 hours)
- Each route: 30 min (validation + database query + response)
- Testing: 10 min per route

#### 5. React Components (2 Done, 28 Remaining)

**Done** ✅:
- `ProgressCard.tsx` - Visual progress indicator (0-100%)
- `MarkUsageModal.tsx` - Log usage dialog

**Remaining** 🔄 (28 components, 3-4 days):

```
Dashboard Sections (5):
  ├─ UsageOverview.tsx         - Monthly/quarterly summary
  ├─ RecommendationsList.tsx   - Smart alerts ("Claim by tomorrow!")
  ├─ CategoryBreakdown.tsx     - Usage by category (dining, travel)
  ├─ HistoryTimeline.tsx       - Month-by-month view
  └─ MetricsCards.tsx          - Key stats (total claimed, ROI, etc)

Benefit Details (6):
  ├─ BenefitDetailModal.tsx     - Full benefit information
  ├─ UsageHistory.tsx           - Past claims for this benefit
  ├─ PeriodSelector.tsx         - Pick which period to view
  ├─ MissedBenefitAlert.tsx     - "You missed X in March"
  ├─ UpcomingBenefitCard.tsx    - "Coming up in 2 days"
  └─ BenefitRecommendation.tsx  - Suggestion card

Onboarding Flow (6):
  ├─ OnboardingLayout.tsx       - Wrapper for all steps
  ├─ Step1Welcome.tsx           - Introduction
  ├─ Step2ImportData.tsx        - Import historical data
  ├─ Step3SelectCards.tsx       - Pick which cards to track
  ├─ Step4SetPreferences.tsx    - Email alerts, categories
  ├─ Step5ConfirmSetup.tsx      - Review + confirm
  └─ Step6AllSet.tsx            - Celebration screen

Filters & Controls (5):
  ├─ UsageFilterBar.tsx         - Date range, status, category
  ├─ PeriodToggle.tsx           - Monthly/Quarterly/Annual view
  ├─ SortMenu.tsx               - Sort options (date, amount, urgency)
  ├─ ExportMenu.tsx             - Download as CSV/PDF
  └─ SettingsPanel.tsx          - Notification preferences

Integration Points (6):
  ├─ BenefitTabContent.tsx      - Main benefits tab content
  ├─ CardDetailPanel.tsx        - Usage within card view
  ├─ DashboardWidget.tsx        - Dashboard summary widget
  ├─ SidebarSection.tsx         - Sidebar navigation
  ├─ ErrorBoundary.tsx          - Error handling wrapper
  └─ LoadingSkeletons.tsx       - Loading states
```

**Component Complexity**:
- Simple (5-10 lines): 8 components (1 hour each)
- Medium (20-50 lines): 12 components (2 hours each)
- Complex (50-150 lines): 8 components (3 hours each)

**Work Estimate**: 3-4 days (24-32 hours)

---

## Phase 6C: Claiming Cadence Feature (Spec Complete - Ready to Build)

### What This Feature Does
Prevents users from missing benefit windows by:
- Showing "Claim by [date]" alerts
- Color-coded urgency (red = 0-7 days, yellow = 8-14 days, etc.)
- Tracking claiming history ("You missed $15 in March")
- Enforcing limits (can't claim twice in same period)

### Why It Matters
- **Problem**: Users miss ~40% of credit card benefits
- **Impact**: Loses $2,000-3,000/year per user
- **Solution**: Visual alerts + history = 95% claim rate

### Example Scenarios

#### Scenario 1: Amex Monthly $15 Uber
```
This Benefit:
  - Name: "$15 Digital Entertainment Credit"
  - Cadence: MONTHLY
  - Amount: $1,500 (cents) = $15
  - Window: 1st-last day of month
  - Special: None (standard monthly)

User's Experience:
  Apr 1:   "Claim your $15 entertainment credit"      [GREEN]
  Apr 20:  "Only 11 days left! $15 remaining"         [YELLOW]
  Apr 28:  "URGENT: 3 days left to use $15"           [RED]
  Apr 29:  "Final day! Claim $15 now"                 [CRITICAL]
  May 1:   "❌ You missed $15 from April"

API prevents double-claim:
  POST /api/benefits/[id]/claim
  Request: { amount: 1500 }
  Response: { success: true } OR
           { error: "Already claimed $15 this month" }
```

#### Scenario 2: Amex Sept 18 Split Quarterly
```
This Benefit:
  - Name: "$200 Airline Incidental Credit"
  - Cadence: QUARTERLY (but special!)
  - Amount: $20,000 = $200
  - Window: Split on Sept 18
  - Special: claimingWindowEnd: "0918" (Sept 18 split)

Claiming Windows:
  Q1 (Jan-Mar): Normal quarter (claim anytime Jan-Mar)
  Q2 (Apr-Jun): Normal quarter
  Q3 (Jul-Sep): SPLIT!
    - First window:  Jul 1 - Sep 18
    - Second window: Sep 19 - Sep 30
  Q4 (Oct-Dec): Normal quarter

User's Experience (Sept):
  Sep 10:  "Q3 Part 1: Claim by Sept 18 ($200)"       [YELLOW]
  Sep 18:  "Last day of Q3 Part 1! Claim now"         [CRITICAL]
  Sep 19:  "✅ Claimed Q3 Part 1. Q3 Part 2 starts!"   [GREEN for part 2]
  Sep 25:  "Q3 Part 2: Only 5 days left ($200)"       [RED]
  Oct 1:   "❌ You missed $200 from Sep 19-30"
```

#### Scenario 3: Chase One-Time Bonus
```
This Benefit:
  - Name: "Welcome Bonus: 50,000 points"
  - Cadence: ONE_TIME (only claim once ever)
  - Amount: 50000 (points, not dollars)
  - Window: First 30 days of card membership

User's Experience:
  Day 1:   "New card! Bonus available for 30 days"    [GREEN]
  Day 20:  "10 days to claim 50,000 point bonus"      [YELLOW]
  Day 30:  "Last day! Claim 50,000 points now"        [CRITICAL]
  Day 31:  "❌ Bonus expired - lost 50,000 points"
  Future:  "Already claimed" (greyed out, disabled)
```

### Implementation Phases (5-6 days total)

#### Phase 1: Database (0.5 day)
**File**: `prisma/schema.prisma` (3 new fields on MasterBenefit)

```prisma
model MasterBenefit {
  // NEW fields:
  claimingCadence   String?        // "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "FLEXIBLE_ANNUAL" | "ONE_TIME"
  claimingAmount    Int?           // In cents (e.g., 1500 = $15)
  claimingWindowEnd String?        // For custom windows like "0918" (Sept 18 split)

  // Existing fields remain unchanged (backward compatible)
}
```

**Migration Required**:
```sql
-- Add 3 nullable columns (backward compatible)
ALTER TABLE MasterBenefit
ADD COLUMN claimingCadence VARCHAR(50),
ADD COLUMN claimingAmount INTEGER,
ADD COLUMN claimingWindowEnd VARCHAR(10);

-- Index for queries
CREATE INDEX idx_claiming_cadence ON MasterBenefit(claimingCadence);
```

**Rollback**:
```sql
ALTER TABLE MasterBenefit
DROP COLUMN claimingWindowEnd,
DROP COLUMN claimingAmount,
DROP COLUMN claimingCadence;
```

#### Phase 2: Utilities (0.5 day)
**File**: `src/lib/claiming-validation.ts` (7 functions)

```typescript
// 1. Calculate claiming window boundaries
getClaimingWindowBoundaries(
  benefit: MasterBenefit,
  currentDate: Date
): { start: Date; end: Date }

// 2. Get amount user can claim this period
getClaimingLimitForPeriod(
  benefit: MasterBenefit,
  periodStart: Date,
  periodEnd: Date
): number  // in cents

// 3. Check if claiming window is open
isClaimingWindowOpen(
  benefit: MasterBenefit,
  currentDate: Date
): boolean

// 4. Calculate days until expiration
daysUntilExpiration(
  benefit: MasterBenefit,
  currentDate: Date
): number

// 5. Get urgency level
getUrgencyLevel(
  benefit: MasterBenefit,
  currentDate: Date
): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

// 6. Validate claiming amount
validateClaimingAmount(
  benefit: MasterBenefit,
  amount: number,
  currentDate: Date
): { valid: boolean; reason?: string }

// 7. Calculate amount per period
calculateAmountPerPeriod(
  benefit: MasterBenefit,
  period: "MONTHLY" | "QUARTERLY" | "ANNUAL"
): number  // in cents
```

**Test Coverage**: 90%+ (edge cases for Amex Sept 18, leap years, etc.)

#### Phase 3: Seeding (0.5 day)
**File**: `prisma/seed.ts` (update) + `scripts/seed-premium-cards.js` (new)

**What Needs Seeding**:
- Update existing 87 benefits with claiming data
- Add claiming cadence (MONTHLY, QUARTERLY, etc.)
- Add claiming amounts (in cents)
- Add claimingWindowEnd for special cases (e.g., "0918" for Amex)

**Example**:
```typescript
// Before
{
  name: "$15 Uber Credit",
  stickerValue: 1500,
  resetCadence: "MONTHLY"
}

// After
{
  name: "$15 Uber Credit",
  stickerValue: 1500,
  resetCadence: "MONTHLY",
  claimingCadence: "MONTHLY",        // NEW
  claimingAmount: 1500,              // NEW
  claimingWindowEnd: null            // NEW (standard, no special date)
}
```

**Special Cases** (5-6 benefits):
- Amex Sept 18 split: `claimingWindowEnd: "0918"`
- Amex Feb variable: `claimingAmount` changes by month
- Chase variable dining: Same approach
- One-time bonuses: `claimingCadence: "ONE_TIME"`

#### Phase 4: UI Components (1.5 days)
**Files**: 5 new components + 2 updated components

**New Components**:
1. `CadenceIndicator.tsx` - Badge showing cadence + urgency
2. `ClaimingLimitInfo.tsx` - Modal with claiming details
3. `PeriodClaimingHistory.tsx` - "You claimed $X on [date]"
4. `ClaimingCountdown.tsx` - "Only 3 days left!"
5. `MissedBenefitAlert.tsx` - "You missed $X in March"

**Updated Components**:
1. `MarkBenefitUsedModal.tsx` - Add validation (prevent double-claim)
2. `BenefitUsageProgress.tsx` - Show claiming window

**Work Estimate**: 1.5 days (12 hours)
- New components: 2-3 hours each
- Updates: 1 hour each

#### Phase 5: API Endpoints (1.5 days)
**Files**: 3 new routes

1. `GET /api/benefits/claiming-limits`
   - Get claiming windows for user's benefits
   - Response: Array of { benefitId, window, daysRemaining, urgency, canClaim }

2. `POST /api/benefits/[id]/claim`
   - Claim a benefit
   - Validation: Is window open? Already claimed? Amount correct?
   - Creates BenefitUsageRecord

3. `GET /api/benefits/[id]/claiming-history`
   - Show past claims + missed periods
   - Response: Array of { period, amount, status: "CLAIMED" | "MISSED" }

**Work Estimate**: 1.5 days (12 hours)
- Route logic: 1-2 hours each
- Error handling: 2-3 hours
- Testing: 3-4 hours

#### Phase 6: Testing & Polish (1 day)
**12 Edge Cases to Test**:
1. ✅ Standard monthly (claim anytime, only once)
2. ✅ Standard quarterly (claim anytime in 3-month window)
3. ✅ Amex Sept 18 split (split logic works)
4. ✅ Leap year (Feb 29 handling)
5. ✅ Month boundaries (claim on last day)
6. ✅ One-time bonus (single claim, then disabled)
7. ✅ Expired window (can't claim)
8. ✅ Variable amounts (different by month)
9. ✅ Server-side validation (enforces limits)
10. ✅ Concurrent claims (prevents double-claim)
11. ✅ DST transitions (timezone handling)
12. ✅ Timezone edge cases (user in different zone)

**Work Estimate**: 1 day (8 hours)

### Total Phase 6C Effort
```
Phase 1 (Database):        4-6 hours
Phase 2 (Utilities):       4-6 hours
Phase 3 (Seeding):         3-4 hours
Phase 4 (UI):              10-12 hours
Phase 5 (API):             10-12 hours
Phase 6 (Testing):         6-8 hours
─────────────────────────────────────
TOTAL:                     37-48 hours = 5-6 business days
```

### Success Criteria
- ✅ All 87 benefits have claiming cadence populated
- ✅ Amex Sept 18 split works correctly
- ✅ Users see "Claim by [date]" alerts
- ✅ API prevents double-claiming
- ✅ Historical view shows missed periods
- ✅ 12 edge cases pass automated tests
- ✅ No regressions in existing features

---

## Full Project Timeline (Remaining Work)

### Week 1 (Apr 8-12): Phase 2B APIs & Components
```
Monday (Apr 8):   Phase 2B started, 30% of database/types done
Tuesday (Apr 9):  Phase 6C spec completed, Phase 2B continues
Wednesday (Apr 10): ~4 API routes done, 5 components done
Thursday (Apr 11): ~8 API routes done, 15 components done
Friday (Apr 12):   All API routes done, 20+ components done
Target: Phase 2B 60-70% complete by Friday
```

### Week 2 (Apr 15-19): Phase 2B Completion + Testing
```
Monday (Apr 15):  Finish remaining components (10+)
Tuesday (Apr 16): Begin integration testing, fix bugs
Wednesday (Apr 17): Complete testing, code review
Thursday (Apr 18): Final bugfixes, merge to main
Friday (Apr 19):   Deploy Phase 2B to production
Target: Phase 2B 100% complete, in production
```

### Week 3 (Apr 22-26): Phase 6C Implementation
```
Monday (Apr 22):  Phase 6C Phase 1-2 (DB + utilities)
Tuesday (Apr 23): Phase 6C Phase 3-4 (seeding + UI)
Wednesday (Apr 24): Phase 6C Phase 5 (API routes)
Thursday (Apr 25): Phase 6C Phase 6 (testing)
Friday (Apr 26):  Code review & deployment prep
Target: Phase 6C ready for production deployment
```

### Week 4+ (Apr 29+): Additional Phases
```
Phase 3: Full test suite (integration + E2E)
Phase 4: Payment management (fee tracking)
Phase 5: Analytics (ROI, trends, recommendations)
Phase 6: UI Polish & accessibility
Phase 7: Documentation & training
Phase 8: Final deployment & monitoring

Estimated Total: 5-8 weeks to MVP completion
```

---

## Work Streams (Parallel Execution)

### If Multiple Developers Were Available

**Work Stream 1: Phase 2B APIs** (2 days)
- Developer A: Build 12 API routes
- Can work independently while others build components
- Deliverable: All API routes with tests passing

**Work Stream 2: Phase 2B Components** (3-4 days)
- Developer B: Build 28 React components
- Can mock API responses initially
- Connect to real API when Stream 1 complete

**Work Stream 3: Phase 2B Testing** (2-3 days)
- Developer C: Write integration tests
- Can start after Stream 1 & 2 begin
- Comprehensive coverage for all new features

**Work Stream 4: Phase 6C Database** (0.5 day)
- DBA: Migrate schema, add indexes
- Can start parallel to Phase 2B
- No blocking dependencies

**Work Stream 5: Phase 6C Utilities** (0.5 day)
- Developer D: Build 7 utility functions
- Can test independently
- Used by both UI and API

**Parallelization Benefit**: 7-10 days → 3-4 days (if all available)

---

## Deployment Checkpoints

### Before Phase 2B Deployment
- [ ] All 12 API routes tested
- [ ] All 28 components built & working
- [ ] Integration tests passing
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] Database schema stable
- [ ] User data migration script tested
- [ ] Rollback plan documented

### Before Phase 6C Deployment
- [ ] All 3 new database fields migrated
- [ ] All 7 utility functions tested
- [ ] All 87 benefits have claiming data
- [ ] All 5 UI components working
- [ ] All 3 API endpoints tested
- [ ] 12 edge cases verified
- [ ] Server-side validation enforced
- [ ] Concurrent claims prevented

### Before MVP Release
- [ ] All 6 phases passing QA
- [ ] 80%+ test coverage
- [ ] Zero critical security issues
- [ ] Load testing (100+ concurrent users)
- [ ] Database backup verified
- [ ] Monitoring alerts configured
- [ ] Rollback procedure tested
- [ ] User documentation complete

---

## Risk Mitigation

### Risk 1: Phase 2B Scope Creep
**Mitigation**:
- Fixed feature list (28 components, 12 API routes)
- No new features mid-phase
- Use feature flags for experimental work

### Risk 2: Database Migration Issues
**Mitigation**:
- Test migrations on copy of production DB
- Have rollback script ready
- Gradual rollout (10% → 50% → 100%)

### Risk 3: Timezone/DST Bugs in Phase 6C
**Mitigation**:
- All dates in UTC in database
- Convert to user timezone only in UI
- Test with multiple timezone changes
- Include DST transitions in test cases

### Risk 4: Performance Issues
**Mitigation**:
- Monitor database query performance
- Add indexes for claiming window queries
- Cache claiming window calculations
- Load test with 1000+ users

### Risk 5: Data Inconsistency
**Mitigation**:
- Database transactions for all writes
- Audit logging for all changes
- Validation at API layer
- Background jobs to detect & fix inconsistencies

---

## Success Metrics

### Phase 2B Success
- ✅ All features implemented (28 components + 12 routes)
- ✅ User usage analytics visible
- ✅ Recommendations showing in dashboard
- ✅ Onboarding guiding new users
- ✅ Zero regressions in Phase 1 features

### Phase 6C Success
- ✅ Users see claiming alerts
- ✅ All 87 benefits have correct cadence
- ✅ Zero double-claims (server-side enforced)
- ✅ Historical view working
- ✅ 95%+ claim rate on Amex monthly benefits

### MVP Success (Overall)
- ✅ 50+ active features working
- ✅ 100+ registered users
- ✅ 80%+ test coverage
- ✅ Zero critical security issues
- ✅ Sub-500ms API response time (p99)
- ✅ <1% error rate in production

---

## Current Blockers & Unblocking Path

### No Current Blockers ✅
- Phase 2B has all dependencies ready
- Database schema stable
- API patterns established
- Testing infrastructure working

### Potential Future Blockers & Solutions
1. **Database Performance**: Add read replicas if >500 users
2. **Email Delivery**: Switch to SendGrid if Mock provider used
3. **Storage Limits**: Archive old usage records if >1GB
4. **Scaling**: Move to Kubernetes if >5000 users

---

## Key Dates

```
Apr 8:   Phase 2B starts
Apr 12:  Phase 2B 70% target
Apr 15:  Phase 2B testing begins
Apr 18:  Phase 2B complete, deploy to prod
Apr 22:  Phase 6C implementation begins
Apr 26:  Phase 6C ready for deployment
May 3:   MVP feature complete
May 15:  UI polish complete
May 20:  Documentation complete
May 30:  Full release ready
```

---

**Document Version**: 1.0
**Last Updated**: April 10, 2026
**Maintained By**: Manish S.
**Next Review**: April 15, 2026
