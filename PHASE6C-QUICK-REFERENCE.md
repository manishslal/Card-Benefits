# PHASE 6C: Quick Reference Guide

**Status**: ✅ FINAL TECHNICAL SPECIFICATION COMPLETE  
**File**: `PHASE6C-FINAL-TECHNICAL-SPECIFICATION.md` (965 lines)  
**Date**: April 2026  
**Target**: Production deployment immediately after Phase 6B

---

## The 5 Claiming Cadences (At a Glance)

| Cadence | Examples | Pattern | Urgency | Loss Risk |
|---------|----------|---------|---------|-----------|
| **MONTHLY** | Uber $15/mo, Entertainment $20-25/mo | Resets 1st, expires month-end | CRITICAL (<7d) | 🔴 HIGH |
| **QUARTERLY** | Dining $100/q, Lululemon $75/q | Resets quarterly, Amex Sept 18 split | HIGH (7-14d) | 🟠 MED |
| **SEMI_ANNUAL** | Hotel H1=$200, H2=$300 | Resets 2× year, Sept 18 split for Amex | MEDIUM (14-30d) | 🟡 MED |
| **FLEXIBLE_ANNUAL** | Airline $200, Equinox $300 | Full year available anytime | LOW (>30d) | 🟢 LOW |
| **ONE_TIME** | Global Entry $100, Cell Phone Ins. | Single claim, never renews | MEDIUM | 🟡 LOW |

---

## Key Implementation Tasks (Quick Checklist)

### Phase 1: Database (1 dev, ~3 hours)
- [ ] Add 3 fields to MasterBenefit: `claimingCadence`, `claimingAmount`, `claimingWindowEnd`
- [ ] Create migration SQL with rollback
- [ ] Export TypeScript types

### Phase 2: Utilities (1 dev, ~8 hours)
- [ ] Refactor `calculateAmountPerPeriod()` to use stored amount
- [ ] Build `getClaimingWindowBoundaries()` (handles Amex Sept 18 split)
- [ ] Build `getClaimingLimitForPeriod()` (remaining amount calc)
- [ ] Build `validateClaimingAmount()` (claim validation)
- [ ] Build `isClaimingWindowOpen()` (window status)
- [ ] Build `daysUntilExpiration()` (urgency calc)
- [ ] Write comprehensive unit tests (95%+ coverage)

### Phase 3: Data Seeding (1 dev, ~3 hours)
- [ ] Update `prisma/seed.ts` (19 master benefits)
- [ ] Update `scripts/seed-premium-cards.js` (68 premium benefits)
- [ ] Create validation script to verify all 87 have cadence

### Phase 4: Frontend (1 dev, ~6 hours)
- [ ] Update `BenefitUsageProgress` component
- [ ] Create `CadenceIndicator` component (badge)
- [ ] Create `PeriodClaimingHistory` component (historical view)
- [ ] Create `ClaimingLimitInfo` component (modal details)
- [ ] Update `MarkBenefitUsedModal` with limit enforcement
- [ ] Responsive styling & accessibility

### Phase 5: API (1 dev, ~5 hours)
- [ ] Update `POST /api/benefits/usage` with validation
- [ ] Enhance `GET /api/benefits/usage` with metadata
- [ ] Create `GET /api/benefits/claiming-limits` endpoint
- [ ] Write integration tests

### Phase 6: Testing (1 QA, ~6 hours)
- [ ] End-to-end feature tests (all 5 cadences)
- [ ] Edge case tests (leap years, boundaries, etc.)
- [ ] Performance tests (< 100ms endpoints)
- [ ] Manual QA & accessibility check
- [ ] Production readiness verification

---

## Special Case: Amex Platinum Sept 18 Split

**Why it matters**: Amex Platinum uses Sept 18 as the mid-year boundary, NOT Sept 1 or Oct 1.

**Impact on Quarters**:
```
Q1 (Amex):  Sept 18 - Sept 30  (~12 days, TIGHT!)
Q2 (Amex):  Oct 1 - Dec 31     (~92 days)
Q3 (Amex):  Jan 1 - Mar 31     (~90 days)
Q4 (Amex):  Apr 1 - Sept 17    (~169 days, LONG)
```

**Impact on Semi-Annuals**:
```
H1 (Amex):  Jan 1 - Sept 17 (Hotel = $200)
H2 (Amex):  Sept 18 - Dec 31 (Hotel = $300, 50% MORE!)
```

**Implementation**: Set `claimingWindowEnd: "0918"` for these benefits

---

## Database Changes (3 New Fields)

```sql
ALTER TABLE "MasterBenefit" 
ADD COLUMN "claimingCadence" VARCHAR(50),      -- MONTHLY | QUARTERLY | ...
ADD COLUMN "claimingAmount" INTEGER,           -- In cents (e.g., 1500 = $15)
ADD COLUMN "claimingWindowEnd" VARCHAR(10);    -- "0918" for Amex split

CREATE INDEX idx_masterbenefit_claimingcadence ON "MasterBenefit"("claimingCadence");
```

**Backward Compat**: All columns nullable, existing benefits unaffected

---

## API Error Codes (Easy Reference)

| Error Code | HTTP | Meaning | Example |
|-----------|------|---------|---------|
| CLAIMING_LIMIT_EXCEEDED | 400 | User tried to claim more than allowed | Claiming $2,000 when max is $1,500/month |
| ALREADY_CLAIMED | 400 | ONE_TIME benefit already used | Global Entry claimed before |
| INVALID_CLAIM_AMOUNT | 400 | Amount invalid (negative, fractional, etc.) | claimAmount = -500 or 15.50 |
| BENEFIT_NOT_FOUND | 404 | Benefit doesn't exist | Invalid benefitId |
| BENEFIT_NOT_CONFIGURED | 403 | Benefit missing cadence setup | Legacy benefit without claimingCadence |
| NOT_AUTHORIZED | 403 | User doesn't own this benefit's card | Trying to claim someone else's benefit |

---

## Component Props at a Glance

**BenefitUsageProgress**:
```typescript
{
  benefit: MasterBenefit & { claimingCadence, claimingAmount, claimingWindowEnd };
  usageRecords: BenefitUsageRecord[];
  onClaimClick?: () => void;
}
```

**MarkBenefitUsedModal**:
```typescript
{
  benefit: MasterBenefit;
  onSubmit: (amount: number) => Promise<void>;
  onCancel: () => void;
}
// Uses ClaimingLimitInfo subcomponent for limit display
```

---

## 12 Critical Edge Cases (Test These!)

1. **Month-end expiration** - March 30 (1 day left) should show CRITICAL
2. **Leap year February** - Feb 29 should be included in period
3. **Amex Sept 18 quarter split** - Sept 25 should be in Q1 (Sept 18-30), not Q2
4. **Period boundary at midnight** - March 31 @ 23:59:59 ✓ vs April 1 @ 00:00:00 ✗
5. **Timezone mismatch** - Backend UTC, display user's timezone
6. **ONE_TIME already claimed** - Second attempt should fail
7. **Partial monthly claim** - $8 of $15 claimed, $7 remaining
8. **Concurrent claims** - Two claims same second → first ✓, second ✗
9. **Backdated claim** - > 90 days old should fail
10. **Fractional cents** - 15.50 should fail (must be integer cents)
11. **Benefit without cadence** - Legacy benefit missing claimingCadence
12. **Usage across period boundary** - Claim dated April 1 should count as April, not March

---

## Utility Functions Signatures (Copy-Paste Ready)

```typescript
// 1. Calculate amount available for a period
function calculateAmountPerPeriod(
  benefit: MasterBenefit,
  referenceDate: Date = new Date()
): number

// 2. Get period boundaries (Amex Sept 18 split handled automatically)
function getClaimingWindowBoundaries(
  benefit: MasterBenefit,
  referenceDate: Date = new Date()
): {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;  // "March 2026", "Q1 2026", "H1 2026", etc.
}

// 3. Calculate remaining claimable for period
function getClaimingLimitForPeriod(
  benefit: MasterBenefit,
  usageRecords: BenefitUsageRecord[],
  referenceDate: Date = new Date()
): number

// 4. Validate a requested claim
function validateClaimingAmount(
  benefit: MasterBenefit,
  claimAmount: number,
  usageRecords: BenefitUsageRecord[],
  referenceDate: Date = new Date()
): {
  valid: boolean;
  error?: string;
  errorCode?: string;
  remainingAmount: number;
  maxClaimable: number;
  alreadyClaimed: number;
}

// 5. Check if window is open
function isClaimingWindowOpen(
  benefit: MasterBenefit,
  referenceDate: Date = new Date()
): boolean

// 6. Calculate days until expiration
function daysUntilExpiration(
  benefit: MasterBenefit,
  referenceDate: Date = new Date()
): number

// 7. Determine urgency level
function getUrgencyLevel(
  benefit: MasterBenefit,
  referenceDate: Date = new Date()
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
```

---

## Testing Checklist (QA Copy-Paste)

**MONTHLY Benefits**:
- [ ] Dashboard shows "⏰ $15 available THIS MONTH"
- [ ] < 7 days left shows CRITICAL (red)
- [ ] Can claim full amount
- [ ] Second claim same month fails
- [ ] Next month resets to $15

**QUARTERLY Benefits (Amex Sept 18)**:
- [ ] Sept 18-30 shows only 12-day window
- [ ] Oct 1-Dec 31 shows ~92 days
- [ ] Amount correct per quarter

**FLEXIBLE_ANNUAL**:
- [ ] Full $300 available any day
- [ ] No countdown urgency
- [ ] Can claim in batches

**ONE_TIME**:
- [ ] First claim ✓
- [ ] Second claim ✗ (ALREADY_CLAIMED)

**Historical**:
- [ ] Last 12 months show for MONTHLY
- [ ] Missed periods highlighted
- [ ] Loss calculation accurate

---

## Parallel Work Streams

```
┌─────────────────────────────────────────────────────────────┐
│ Developer 1: Database (Phase 1)                             │
│ • Schema update, migration, types                           │
│ • Duration: ~3 hrs                                          │
├─────────────────────────────────────────────────────────────┤
│ Developer 2: Utilities (Phase 2)                            │
│ • 7 functions, unit tests                                   │
│ • Duration: ~8 hrs                                          │
├─────────────────────────────────────────────────────────────┤
│ Developer 3: Data Seeding (Phase 3)                         │
│ • Seed scripts, 87 benefits mapped                          │
│ • Duration: ~3 hrs                                          │
├─────────────────────────────────────────────────────────────┤
│ Developer 4: Frontend (Phase 4)                             │
│ • 5 components, responsive UI                               │
│ • Duration: ~6 hrs                                          │
├─────────────────────────────────────────────────────────────┤
│ Developer 2 (continues): API (Phase 5)                      │
│ • 3 endpoints, integration tests                            │
│ • Duration: ~5 hrs                                          │
├─────────────────────────────────────────────────────────────┤
│ QA Engineer: Testing (Phase 6)                              │
│ • Feature tests, edge cases, performance                    │
│ • Duration: ~6 hrs                                          │
└─────────────────────────────────────────────────────────────┘
```

**Total Effort**: ~31 developer hours = 1 week (2 devs working in parallel)

---

## Success Metrics (Post-Launch)

**Week 1**:
- ✅ Zero critical bugs
- ✅ API error rate < 0.1%
- ✅ Response times stable < 100ms

**Month 1**:
- ✅ 50%+ users viewing claiming limits
- ✅ 100+ claims/day
- ✅ User engagement increase measurable

**Year 1 Impact**:
- ✅ Users reclaim ~$2,000-3,000 annually per user
- ✅ 95% of Amex Platinum monthly benefits no longer missed
- ✅ Support tickets for "lost benefits" → near zero

---

## Key Dates & Milestones

| Date | Milestone |
|------|-----------|
| Day 0 | Specification complete (THIS DOCUMENT) |
| Day 1-2 | Phase 1: Database (migration ready) |
| Day 2-3 | Phase 2: Utilities (tested, ready) |
| Day 2-3 | Phase 3: Seeding (data populated) |
| Day 3-4 | Phase 4: Frontend (components done) |
| Day 4 | Phase 5: API (routes complete) |
| Day 5 | Phase 6: QA (feature tested) |
| Day 6 | Code review + final verification |
| Day 7 | Production deployment |

---

## File Locations (Ready-to-Code)

**Database**:
- Schema: `prisma/schema.prisma`
- Migration: `prisma/migrations/[timestamp]_add_claiming_cadence_fields/migration.sql`

**Utilities**:
- Constants: `src/lib/claiming-cadence-constants.ts` (new)
- Validation: `src/lib/claiming-validation.ts` (new)
- Tests: `src/lib/__tests__/claiming-validation.test.ts` (new)

**Frontend**:
- `src/components/benefits/BenefitUsageProgress.tsx` (update)
- `src/components/benefits/CadenceIndicator.tsx` (new)
- `src/components/benefits/PeriodClaimingHistory.tsx` (new)
- `src/components/benefits/ClaimingLimitInfo.tsx` (new)
- `src/components/benefits/MarkBenefitUsedModal.tsx` (update)

**API**:
- Routes: `src/app/api/benefits/usage/route.ts` (update)
- New: `src/app/api/benefits/claiming-limits/route.ts`
- Tests: `src/app/api/benefits/usage/__tests__/validation.test.ts` (new)

**Data**:
- Seed: `prisma/seed.ts` (update)
- Premium: `scripts/seed-premium-cards.js` (update)
- Validate: `scripts/validate-claiming-cadences.js` (new)

---

## Deployment Command Sequence

```bash
# 1. Run migration
npx prisma migrate deploy

# 2. Seed data
npx prisma db seed

# 3. Run tests
npm run test

# 4. Deploy backend
git push origin phase-6c

# 5. Deploy frontend
# (auto-deploys on merge)

# 6. Monitor
# Watch dashboard for errors, response times, usage metrics
```

---

## Questions? Check These Sections

**"How do I calculate remaining amount?"**
→ Use `getClaimingLimitForPeriod(benefit, usageRecords, date)`

**"How do I handle Amex Sept 18?"**
→ Set `claimingWindowEnd: "0918"` on benefit, logic handles it automatically

**"When is user blocked from claiming?"**
→ When `validateClaimingAmount().valid === false`

**"How do I show urgency badges?"**
→ Call `getUrgencyLevel(benefit)` → CRITICAL/HIGH/MEDIUM/LOW

**"What if user claims past the period?"**
→ API returns 400 CLAIMING_LIMIT_EXCEEDED with details

**"How do I track losses?"**
→ Show historical periods in dashboard, mark missed as "MISSED"

---

**Ready to build? 🚀 See PHASE6C-FINAL-TECHNICAL-SPECIFICATION.md for full details.**

