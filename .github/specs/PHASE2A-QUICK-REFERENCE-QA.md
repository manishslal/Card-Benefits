# Phase 2A - QA Findings Quick Reference

**For**: Development Team  
**Purpose**: Quick lookup of issues and fixes  
**Use When**: Implementing Phase 2A rework  

---

## Critical Issues (Fix First)

### ❌ ISSUE #1: TypeScript Build Error (5 minutes)

**File**: `src/features/benefits/lib/filterUtils.ts:160`

**Error Message**:
```
Type error: 'benefits' is declared but its value is never read.
```

**Current Code** (Wrong):
```typescript
export function getFilterSummary(
  benefits: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[],
  filtered: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[]
) {
  // 'benefits' parameter is NEVER USED in function body
  filtered.forEach(benefit => {
    // ... only uses 'filtered'
  });
}
```

**Fix**:
```typescript
// Remove unused parameter
export function getFilterSummary(
  filtered: (UserBenefit & { currentUsage?: number; daysRemaining?: number })[]
) {
  // Same implementation
  filtered.forEach(benefit => {
    // ... unchanged
  });
}

// Update all call sites:
// OLD: getFilterSummary(allBenefits, filteredBenefits)
// NEW: getFilterSummary(filteredBenefits)
```

**Verify**: `npm run build` → should succeed

---

### ❌ ISSUE #2: Missing Database Migration (30 minutes)

**Problem**: Prisma schema has 4 new models, but no migration files created.

**Models Needing Migration**:
1. `BenefitUsageRecord`
2. `BenefitPeriod`
3. `BenefitRecommendation`
4. `UserOnboardingState`

**Fix Commands**:
```bash
# Step 1: Generate migration from schema
npx prisma migrate dev --name add_phase2a_benefit_tracking

# Step 2: Verify migration created
ls prisma/migrations/ | grep add_phase2a

# Step 3: Review generated SQL
cat prisma/migrations/20260407*_add_phase2a/migration.sql

# Step 4: Test migration
npm run db:reset

# Step 5: Verify schema applied
npx prisma db push

# Step 6: Commit
git add prisma/migrations/
git commit -m "feat: Add Phase 2A database migrations"
```

**Expected Migration File Contents**:
```sql
-- Should create tables for all 4 models
CREATE TABLE "BenefitUsageRecord" (...)
CREATE TABLE "BenefitPeriod" (...)
CREATE TABLE "BenefitRecommendation" (...)
CREATE TABLE "UserOnboardingState" (...)

-- Should create all indexes
CREATE INDEX "BenefitUsageRecord_benefitId_idx" ON ...
CREATE INDEX "BenefitUsageRecord_playerId_idx" ON ...
-- ... etc for all indexes in schema.prisma
```

---

## High Priority Issues (Add These)

### ⚠️ ISSUE #3: Missing Utility Functions (4-6 hours)

**File**: `src/features/benefits/lib/periodUtils.ts`

**Missing Function #1: `getResetDate()`**
```typescript
/**
 * Calculate when a benefit will reset/renew
 * @param benefitId - Benefit to check
 * @param currentDate - Reference date (default: today)
 * @returns Date when benefit resets
 */
export function getResetDate(
  benefitId: string,
  currentDate: Date = new Date()
): Date {
  // TODO: Implement
  // 1. Get benefit from database
  // 2. Get its resetCadence (MONTHLY, QUARTERLY, ANNUAL, ONETIME)
  // 3. Get card's renewal date if available
  // 4. Calculate reset date based on cadence
  // 5. Return Date
  
  // Example:
  // For MONTHLY benefit on Mar 15 → return Mar 1 (month start)
  // For ANNUAL benefit with Jul 15 reset → return Jul 15 (anniversary)
}
```

**Missing Function #2: `getNextPeriodStart()`**
```typescript
/**
 * Get the start date of the next benefit period
 * @param benefitId - Benefit to check
 * @returns Date when next period starts
 */
export function getNextPeriodStart(benefitId: string): Date {
  // TODO: Implement
  // Example:
  // Current: Jan 15
  // Cadence: MONTHLY
  // Return: Feb 1 (next month)
}
```

**Missing Function #3: `roundToResetCadence()`**
```typescript
/**
 * Round a date to the nearest period start based on cadence
 * @param date - Date to round
 * @param cadence - Reset cadence (MONTHLY, QUARTERLY, ANNUAL, ONETIME)
 * @returns Date rounded to period start
 */
export function roundToResetCadence(
  date: Date,
  cadence: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONETIME'
): Date {
  // TODO: Implement
  // Example:
  // Input: Jan 15, cadence: MONTHLY
  // Return: Jan 1
}
```

**Missing Function #4: `validatePeriodDates()`**
```typescript
/**
 * Validate that period dates are correct for the given cadence
 * @param startDate - Period start
 * @param endDate - Period end
 * @param cadence - Expected cadence
 * @throws Error if dates don't match cadence rules
 */
export function validatePeriodDates(
  startDate: Date,
  endDate: Date,
  cadence: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONETIME'
): void {
  // TODO: Implement
  // Should throw if:
  // - MONTHLY: not exactly 1 month apart
  // - QUARTERLY: not exactly 3 months apart
  // - ANNUAL: not exactly 12 months apart
  // - ONETIME: endDate is reasonable future date
}
```

**File**: `src/features/benefits/lib/benefitUsageUtils.ts`

**Missing Function #5: `detectDuplicateUsage()`**
```typescript
/**
 * Check if a usage record is a duplicate of recent records
 * Uses 5-minute window for detection
 * @param benefitId - Benefit used
 * @param amount - Usage amount
 * @param usageDate - When used
 * @returns true if duplicate detected
 */
export async function detectDuplicateUsage(
  benefitId: string,
  amount: number,
  usageDate: Date
): Promise<boolean> {
  // TODO: Implement
  // Query recent records (last 5 minutes)
  // Check if same (benefitId, amount, usageDate) exists
  // Return boolean
  
  const fiveMinutesAgo = new Date(usageDate.getTime() - 5 * 60 * 1000);
  const recent = await db.benefitUsageRecord.findFirst({
    where: {
      benefitId,
      amount,
      usageDate: {
        gte: fiveMinutesAgo,
        lte: usageDate,
      },
    },
  });
  return !!recent;
}
```

**Missing Function #6: `getUsageByBenefit()`**
```typescript
/**
 * Get aggregated usage stats grouped by benefit
 * @param userId - User ID
 * @returns Usage grouped by benefit
 */
export async function getUsageByBenefit(userId: string): Promise<
  Array<{
    benefitId: string;
    totalUsed: number;
    recordCount: number;
    lastUsedAt: Date | null;
  }>
> {
  // TODO: Implement
  // Group records by benefitId
  // Sum amounts, count records
  // Find max usageDate
  // Return array
}
```

**Missing Function #7: `getMostUsedBenefits()`**
```typescript
/**
 * Get top N most-used benefits
 * @param userId - User ID
 * @param limit - How many to return (default: 5)
 * @returns Top benefits sorted by usage
 */
export async function getMostUsedBenefits(
  userId: string,
  limit: number = 5
): Promise<Array<BenefitWithUsage>> {
  // TODO: Implement
  // Get usage by benefit (use function above)
  // Sort by totalUsed descending
  // Limit to N results
  // Join with benefit details
  // Return
}
```

**File**: `src/features/benefits/lib/filterUtils.ts`

**Missing Function #8: `applySorting()`**
```typescript
/**
 * Sort benefits by specified criteria
 * @param benefits - Benefits to sort
 * @param sortBy - What to sort by (name, value, resetDate, usage)
 * @param direction - ASC or DESC (default: ASC)
 * @returns Sorted benefits
 */
export function applySorting(
  benefits: UserBenefit[],
  sortBy: 'name' | 'value' | 'resetDate' | 'usage',
  direction: 'ASC' | 'DESC' = 'ASC'
): UserBenefit[] {
  // TODO: Implement
  // Example:
  // sortBy: 'value' → sort by stickerValue
  // sortBy: 'resetDate' → sort by next reset date
  // direction: 'DESC' → reverse order
}
```

**Missing Function #9: `buildAdvancedFilter()`**
```typescript
/**
 * Build complex filter combining multiple criteria
 * @param benefits - Benefits to filter
 * @param criteria - Multiple filter conditions
 * @returns Filtered benefits
 */
export function buildAdvancedFilter(
  benefits: UserBenefit[],
  criteria: {
    status?: 'ACTIVE' | 'USED' | 'EXPIRING' | 'EXPIRED';
    cadences?: string[];
    minValue?: number;
    maxValue?: number;
    categories?: string[];
  }
): UserBenefit[] {
  // TODO: Implement
  // Apply all criteria that are specified
  // Use AND logic (all must match)
  // Return filtered results
}
```

---

### ⚠️ ISSUE #4: Missing Type Definitions (2-3 hours)

**File**: `src/features/benefits/types/benefits.ts`

**Add These 13 Missing Interfaces**:

```typescript
// API Request/Response Types

export interface CreateUsageRecordRequest {
  benefitId: string;
  amount: number;
  description: string;
  category?: string;
  usageDate: Date;
}

export interface UsageRecordResponse {
  id: string;
  benefitId: string;
  amount: number;
  description: string;
  category?: string;
  usageDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRecommendationRequest {
  benefitId: string;
  title: string;
  description: string;
  potentialValue: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning?: string;
}

export interface RecommendationResponse {
  id: string;
  benefitId: string;
  title: string;
  description: string;
  potentialValue: number;
  urgency: string;
  isDismissed: boolean;
  viewCount: number;
  clickCount: number;
}

export interface RecommendationsListResponse {
  recommendations: RecommendationResponse[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Onboarding Types

export interface OnboardingStepData {
  stepId: number;
  title: string;
  description: string;
  actionText: string;
  completed: boolean;
  completedAt?: Date;
}

export interface OnboardingStateRequest {
  step: number;
  completedSteps: number[];
  setupReminders: boolean;
  reminderEmail?: string;
  reminderFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

// Filtering Types

export interface FilterCriteria {
  status?: 'ACTIVE' | 'USED' | 'EXPIRING' | 'EXPIRED';
  cadences?: string[];
  minValue?: number;
  maxValue?: number;
  categories?: string[];
  searchTerm?: string;
}

export interface SortCriteria {
  field: 'name' | 'value' | 'resetDate' | 'usage' | 'created';
  direction: 'ASC' | 'DESC';
}

// API Error Response

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Usage Category Enum

export enum UsageCategory {
  AIRLINE = 'airline',
  DINING = 'dining',
  TRAVEL = 'travel',
  SHOPPING = 'shopping',
  OTHER = 'other',
}

// Period Aggregation

export interface PeriodAggregation {
  periodId: string;
  totalUsed: number;
  totalAllowed: number;
  percentageUsed: number;
  recordCount: number;
  lastUsedAt: Date | null;
  daysRemaining: number;
}
```

---

### ⚠️ ISSUE #5: Unit Tests Missing (6-8 hours)

**Create File**: `src/features/benefits/lib/__tests__/periodUtils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculatePeriodBoundaries,
  getPeriodBoundaries,
  getResetDate,
  getNextPeriodStart,
} from '../periodUtils';

describe('periodUtils', () => {
  describe('calculatePeriodBoundaries', () => {
    it('should calculate monthly boundaries correctly', () => {
      const result = calculatePeriodBoundaries('MONTHLY', new Date('2026-03-15'));
      expect(result.startDate).toEqual(new Date('2026-03-01'));
      expect(result.endDate.getDate()).toBeLessThanOrEqual(31);
      expect(result.daysRemaining).toBeGreaterThan(0);
    });

    it('should handle leap year February', () => {
      // Test both leap and non-leap years
      const leapYear = calculatePeriodBoundaries('MONTHLY', new Date('2024-02-15'));
      expect(leapYear.endDate.getDate()).toBe(29);

      const nonLeapYear = calculatePeriodBoundaries('MONTHLY', new Date('2025-02-15'));
      expect(nonLeapYear.endDate.getDate()).toBe(28);
    });

    it('should calculate quarterly boundaries', () => {
      const q1 = calculatePeriodBoundaries('QUARTERLY', new Date('2026-01-15'));
      expect(q1.startDate.getMonth()).toBe(0); // January

      const q2 = calculatePeriodBoundaries('QUARTERLY', new Date('2026-04-15'));
      expect(q2.startDate.getMonth()).toBe(3); // April

      const q3 = calculatePeriodBoundaries('QUARTERLY', new Date('2026-07-15'));
      expect(q3.startDate.getMonth()).toBe(6); // July

      const q4 = calculatePeriodBoundaries('QUARTERLY', new Date('2026-10-15'));
      expect(q4.startDate.getMonth()).toBe(9); // October
    });

    it('should handle cardmember year anniversary', () => {
      const cardAnniversary = new Date('2025-07-15');
      const result = calculatePeriodBoundaries(
        'ANNUAL',
        new Date('2026-08-01'),
        cardAnniversary
      );
      expect(result.startDate.getMonth()).toBe(6); // July
      expect(result.startDate.getDate()).toBe(15);
    });

    it('should handle ONETIME benefits', () => {
      const result = calculatePeriodBoundaries('ONETIME', new Date('2026-01-15'));
      expect(result.endDate.getFullYear()).toBe(2099);
      expect(result.daysRemaining).toBeGreaterThan(25000); // Many years
    });
  });

  describe('getResetDate', () => {
    it('should return month start for monthly benefits', () => {
      // Placeholder - implement based on actual benefit data
      // const date = await getResetDate(benefitId, new Date('2026-03-15'));
      // expect(date).toEqual(new Date('2026-03-01'));
    });
  });

  // Add more test cases...
});
```

**Create File**: `src/features/benefits/lib/__tests__/benefitUsageUtils.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectDuplicateUsage,
  getUsageByBenefit,
  getMostUsedBenefits,
} from '../benefitUsageUtils';

describe('benefitUsageUtils', () => {
  describe('detectDuplicateUsage', () => {
    it('should detect exact duplicates', async () => {
      // Mock database
      // const isDuplicate = await detectDuplicateUsage(
      //   'benefit123',
      //   50000,
      //   new Date()
      // );
      // expect(isDuplicate).toBe(true);
    });

    it('should allow legitimate usage on same day', async () => {
      // Different amounts or times should not be flagged
      // const isDuplicate = await detectDuplicateUsage(
      //   'benefit123',
      //   75000,  // Different amount
      //   new Date()
      // );
      // expect(isDuplicate).toBe(false);
    });

    it('should use 5-minute window for detection', async () => {
      // Usage more than 5 minutes apart should not be duplicate
      // const now = new Date();
      // const sixMinutesAgo = new Date(now.getTime() - 6 * 60 * 1000);
      // const isDuplicate = await detectDuplicateUsage(
      //   'benefit123',
      //   50000,
      //   sixMinutesAgo
      // );
      // expect(isDuplicate).toBe(false);
    });
  });

  // Add more tests...
});
```

**Create File**: `src/features/benefits/lib/__tests__/filterUtils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { filterByStatus, filterByResetCadence, applySorting } from '../filterUtils';

describe('filterUtils', () => {
  describe('filterByStatus', () => {
    it('should filter ACTIVE benefits correctly', () => {
      // Create mock benefits
      // const benefits = [
      //   { id: '1', isUsed: false, expirationDate: futureDate },
      //   { id: '2', isUsed: true, expirationDate: futureDate },
      // ];
      // const active = filterByStatus(benefits, 'ACTIVE');
      // expect(active).toHaveLength(1);
      // expect(active[0].id).toBe('1');
    });

    it('should filter EXPIRED benefits correctly', () => {
      // const benefits = [
      //   { id: '1', isUsed: false, expirationDate: pastDate },
      //   { id: '2', isUsed: false, expirationDate: futureDate },
      // ];
      // const expired = filterByStatus(benefits, 'EXPIRED');
      // expect(expired).toHaveLength(1);
      // expect(expired[0].id).toBe('1');
    });
  });

  describe('applySorting', () => {
    it('should sort by value ascending', () => {
      // const benefits = [
      //   { id: '1', stickerValue: 300 },
      //   { id: '2', stickerValue: 100 },
      //   { id: '3', stickerValue: 200 },
      // ];
      // const sorted = applySorting(benefits, 'value', 'ASC');
      // expect(sorted[0].stickerValue).toBe(100);
      // expect(sorted[2].stickerValue).toBe(300);
    });

    it('should sort by name descending', () => {
      // const benefits = [
      //   { id: '1', name: 'Airline' },
      //   { id: '2', name: 'Dining' },
      //   { id: '3', name: 'Cashback' },
      // ];
      // const sorted = applySorting(benefits, 'name', 'DESC');
      // expect(sorted[0].name).toBe('Dining');
      // expect(sorted[2].name).toBe('Airline');
    });
  });
});
```

---

## Quality Gates Before Proceeding

### ✅ Build Check
```bash
npm run build
# Expected: ✓ Compiled successfully
# If fails: Fix TypeScript errors before continuing
```

### ✅ Type Check
```bash
npx tsc --noEmit
# Expected: No errors
# If fails: Fix type errors before continuing
```

### ✅ Lint Check
```bash
npm run lint
# Expected: No errors
# If fails: Fix linting before continuing
```

### ✅ Test Coverage
```bash
npm run test
# Expected: Tests pass, coverage ≥85%
# If fails: Debug and fix tests before continuing
```

---

## Checklist for Each Fix

### For Each Missing Utility Function:
- [ ] Function signature matches specification
- [ ] Function body implemented correctly
- [ ] Input validation added (null checks, type checks)
- [ ] Error handling added (try-catch where needed)
- [ ] JSDoc comments written
- [ ] Unit tests written (happy path + edge cases)
- [ ] Tests pass: `npm run test`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Code review approved

### For Each New Type:
- [ ] Interface defined with all required fields
- [ ] All fields properly typed (no `any`)
- [ ] Optional fields marked with `?`
- [ ] JSDoc comment explains purpose
- [ ] Exported in index.ts
- [ ] Used in at least one function
- [ ] No TypeScript errors

### For Each Test File:
- [ ] Happy path test case included
- [ ] Edge case test cases included
- [ ] Error case test cases included
- [ ] Tests are isolated (no dependencies)
- [ ] Tests are deterministic (no flaky tests)
- [ ] Coverage goal: ≥85%

---

## Timing Estimate

| Task | Est. Time | Priority |
|------|-----------|----------|
| Fix TypeScript error | 5 min | CRITICAL |
| Create migration | 30 min | CRITICAL |
| Implement utility functions | 4-6 hours | HIGH |
| Add type definitions | 2-3 hours | HIGH |
| Write unit tests | 6-8 hours | HIGH |
| Verify backward compat | 1-2 hours | MEDIUM |
| Code review & fixes | 2-3 hours | MEDIUM |
| **Total** | **16-23 hours** | **1-2 weeks** |

---

## Useful Commands

```bash
# Build and verify
npm run build
npx tsc --noEmit

# Run tests
npm run test
npm run test -- --coverage
npm run test -- --watch

# Database
npx prisma migrate dev
npx prisma studio

# Check code quality
npm run lint
npm run lint -- --fix

# Format code
npx prettier --write src/features/benefits/lib/

# Git workflow
git status
git diff
git add -A
git commit -m "feat: [specific work]"
```

---

## Questions? Ask:

1. **What function should do?** → Check PHASE2-SPEC.md + type definition
2. **How to test?** → Look at existing test patterns in codebase
3. **Type unclear?** → Review existing types in benefits.ts
4. **Database question?** → Check prisma/schema.prisma for field types
5. **Test failing?** → Run with `--reporter=verbose` for details

---

**Good luck with Phase 2A rework! 💪**

