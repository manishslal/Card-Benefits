# Phase 3 Dashboard MVP - Bug Report

**Total Bugs Found**: 9 (1 CRITICAL, 3 HIGH, 5 MEDIUM)  
**Status**: 🔴 Blocks Deployment  
**Date**: Phase 3 QA Review  

---

## Critical Bugs (🔴 Blocks Deployment)

### BUG-001: Build Failure - Unused Variable

**Severity**: 🔴 CRITICAL  
**Status**: OPEN - BLOCKING  
**Component**: `BenefitRow.tsx`  
**File Path**: `src/app/dashboard/components/BenefitRow.tsx:94`

**Symptom**: Build fails with TypeScript error

**Error Message**:
```
Type error: 'remaining' is declared but its value is never read.

  92 |   const statusDisplay = getStatusDisplay(status);
  93 |   const dateRange = formatDateRange(periodStart, periodEnd);
> 94 |   const remaining = available - used;
     |         ^
  95 |   const percentage = available > 0 ? (used / available) * 100 : 0;
```

**Steps to Reproduce**:
1. Clone repository
2. Run `npm run build`
3. Observe TypeScript compilation error

**Expected Behavior**:
- Build completes successfully without errors
- `npm run build` exits with code 0

**Actual Behavior**:
- Build fails with compilation error
- Deployment blocked
- Development blocked

**Root Cause**:
- Variable `remaining` is declared but never used in the component
- Likely leftover from refactoring or future feature planning

**Affected Functionality**:
- ❌ Cannot build project
- ❌ Cannot deploy
- ❌ Cannot run production build
- ❌ CI/CD pipeline fails

**Fix Priority**: 1️⃣ Do immediately

**Proposed Fix Options**:

**Option A (Remove)**: If variable not needed
```typescript
// Delete line 94
// const remaining = available - used;
```

**Option B (Use variable)**: If remaining should be displayed
```typescript
// Use in the display
<div>
  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Remaining</span>
  <p className="text-green-600 dark:text-green-400 font-semibold">${remaining}</p>
</div>
```

**Option C (Prefix with underscore)**: If intentionally unused
```typescript
const _remaining = available - used;  // Intentionally unused variable for future feature
```

**Verification After Fix**:
```bash
npm run build  # Should complete without errors
npm run type-check  # Should pass
```

**Time to Fix**: 5 minutes

---

### BUG-002: Incorrect Currency Conversion - Data Loss Risk

**Severity**: 🔴 CRITICAL  
**Status**: OPEN - BLOCKING  
**Component**: `api-client.ts`  
**File Path**: `src/app/dashboard/utils/api-client.ts:238-239`  
**Type**: Data Transformation / Data Loss

**Symptom**: Benefits display with incorrect dollar amounts (often $0)

**Code**:
```typescript
available: Math.floor(available / 100),  // Convert from cents
used: Math.floor(used / 100),
```

**Problem**:
- Code assumes API returns values in **cents** but this is not documented or verified
- If API actually returns **dollars**, this divides by 100 and converts $50 → $0
- This is a **critical data loss bug**
- No test to verify the assumption

**Steps to Reproduce**:
1. Load dashboard
2. Check if benefits show correct dollar amounts
3. If benefits show $0 when they should show $50, this is the bug

**Expected Behavior**:
- Active benefits display with correct dollar values (e.g., "Uber $15", "Dining $50")
- Summary box shows correct total value
- Progress bars reflect correct usage

**Actual Behavior**:
- Benefits might show $0 or incorrect amounts
- Calculations are off by factor of 100
- User sees wrong financial data

**Root Cause**:
- API contract not clearly specified
- `progress?.data?.limit` is typed as `number | null` with no unit documentation
- Code makes unverified assumption about data units

**Affected Functionality**:
- ❌ All dollar amounts displayed incorrectly
- ❌ Summary statistics wrong
- ❌ Progress bars might be wrong
- ❌ Data integrity compromised
- ❌ User makes financial decisions based on incorrect data

**Fix Priority**: 2️⃣ Do before any user testing

**Required Investigation**:
1. Check API documentation for `/api/benefits/progress`
2. Make a test request to see actual data format
3. Log response to console: `console.log('API response:', response)`
4. Determine if `used` and `limit` are in cents or dollars

**Proposed Fix**:

**After Investigation**, one of these:

If API returns **cents** (current assumption, needs verification):
```typescript
// Keep as-is but document it
const used = progress?.data?.used || 0;           // In cents (confirmed from API)
const available = progress?.data?.limit || benefit.stickerValue; // In cents (confirmed)

return {
  available: Math.floor(available / 100),  // Convert cents to dollars for display
  used: Math.floor(used / 100),            // Convert cents to dollars for display
};
```

If API returns **dollars**:
```typescript
const used = progress?.data?.used || 0;           // In dollars (from API)
const available = progress?.data?.limit || benefit.stickerValue; // In dollars

return {
  available: available || benefit.stickerValue,  // Already in dollars
  used: used || 0,                               // Already in dollars
};
```

**Verification After Fix**:
1. Log actual values: `console.log('available:', available, 'used:', used)`
2. Verify displayed amounts make sense
3. Add unit test to verify conversion

```typescript
test('transforms currency correctly', () => {
  const result = transformBenefitsToRows([
    { ...mockBenefit, stickerValue: 5000 }  // $50 in cents
  ], 
  new Map([['1', { success: true, data: { used: 2500, limit: 5000 } }]]),
  periodsMap);
  
  expect(result[0].available).toBe(50);   // Should be $50, not $0
  expect(result[0].used).toBe(25);        // Should be $25, not $0
});
```

**Time to Fix**: 30 minutes (after investigation)

---

### BUG-003: Silent Fallback to Mock Data in Error

**Severity**: 🔴 CRITICAL  
**Status**: OPEN - BLOCKING  
**Component**: `new-page.tsx` (EnhancedDashboardPage)  
**File Path**: `src/app/dashboard/new-page.tsx:121-143`  
**Type**: Error Handling / Data Integrity

**Symptom**: Dashboard loads with mock data when API fails, but user doesn't realize it's fake data

**Code**:
```typescript
try {
  setIsLoading(true);
  setError(null);
  const data = await fetchDashboardData();
  setBenefits(data.benefits);
} catch (err) {
  console.error('Error loading dashboard:', err);
  setError('Failed to load dashboard. Please try again.');
  
  // ⚠️ PROBLEM: Falls back to mock data without explicit consent
  setBenefits(generateMockBenefits());
} finally {
  setIsLoading(false);
}
```

**Problems**:
1. **Silent fallback**: On API error, silently loads mock data
2. **No distinction**: User cannot tell if they're seeing real or fake data
3. **Error message misleading**: Says "Failed to load" but then shows data anyway
4. **No retry**: User cannot recover from network errors
5. **Production risk**: Shows test benefits to real users in production
6. **Data confusion**: User might act on fake benefits

**Steps to Reproduce**:
1. Go to dashboard
2. Block network in DevTools (Network tab → offline)
3. Refresh page
4. Observe: Dashboard shows mock benefits, not error

**Expected Behavior**:
- Show error message, no data
- Optionally show retry button
- In development: could show mock data with warning
- In production: show error, no mock data

**Actual Behavior**:
- Error message shown but mock data also shown
- User sees "Uber $15", "Lululemon $75" even though API failed
- User has no idea this is test data

**Root Cause**:
- Overly defensive code prioritizes showing something over showing accurate state
- Lacks distinction between development and production environments
- No consent from user to use mock data

**Affected Functionality**:
- 🔴 User sees wrong data
- 🔴 User makes decisions based on fake benefits
- 🔴 Trust is broken when they discover it's fake
- 🔴 In production, this is a serious issue

**Real-World Impact**:
- User sees "Chase Sapphire Dining $100" in dashboard
- User thinks this is their real benefit
- User plans a dinner expecting $100 credit
- It's actually test data
- User is confused and disappointed

**Fix Priority**: 3️⃣ Do before user testing

**Proposed Fix**:

```typescript
useEffect(() => {
  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchDashboardData();
      setBenefits(data.benefits);
    } catch (err) {
      const errorMessage = 
        err instanceof Error 
          ? err.message 
          : 'Failed to load dashboard data';
      
      console.error('Dashboard load error:', err);
      
      // Only use mock data in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  Using mock data (development only)');
        setBenefits(generateMockBenefits());
        setError(`${errorMessage} - Showing mock data for development`);
      } else {
        // Production: Show error, no mock fallback
        setError(`${errorMessage} - Please refresh the page or contact support.`);
        setBenefits([]);  // Empty state, not mock data
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  loadDashboard();
}, []);
```

**Optional Enhancement - Add Retry Button**:
```typescript
const [retryCount, setRetryCount] = useState(0);
const maxRetries = 3;

const handleRetry = useCallback(() => {
  if (retryCount < maxRetries) {
    setRetryCount(r => r + 1);
    loadDashboard();  // Retry
  } else {
    // After max retries, show contact support message
  }
}, [retryCount]);

// In error display:
{error && (
  <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
    <p className="text-red-800 dark:text-red-200">{error}</p>
    {retryCount < maxRetries && (
      <button onClick={handleRetry} className="mt-2 px-3 py-1 bg-red-600 text-white rounded">
        Retry ({retryCount}/{maxRetries})
      </button>
    )}
  </div>
)}
```

**Verification After Fix**:
1. Test with network offline - should show error, not mock benefits
2. Test in development - should show mock with warning
3. Test in production - should show error only
4. User cannot see fake data without knowing it's fake

**Test Case**:
```typescript
test('shows error without mock data in production', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  
  global.fetch = jest.fn().mockRejectedValue(new Error('API error'));
  
  render(<EnhancedDashboardPage />);
  
  waitFor(() => {
    expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
    expect(screen.queryByText('Uber $15')).not.toBeInTheDocument();  // No mock data
  });
  
  process.env.NODE_ENV = originalEnv;
});
```

**Time to Fix**: 20 minutes

---

## High Priority Bugs (🟠 Should Fix)

### BUG-004: Error Handling Silent Failure in BenefitRow

**Severity**: 🟠 HIGH  
**Status**: OPEN  
**Component**: `BenefitRow.tsx`  
**File Path**: `src/app/dashboard/components/BenefitRow.tsx:97-105`  
**Type**: Error Handling / UX

**Symptom**: Button shows "Marking..." forever after clicking "Mark Used" if API fails

**Code**:
```typescript
const handleMarkUsed = useCallback(async () => {
  if (!onMarkUsed) return;
  setIsMarkingUsed(true);
  try {
    await onMarkUsed(id);
  } finally {
    setIsMarkingUsed(false);
  }
}, [id, onMarkUsed]);
// ⚠️ No catch block - error is silently swallowed
```

**Problems**:
1. **No error handling**: Error is caught by JavaScript but not handled
2. **No error display**: User doesn't see what went wrong
3. **Parent handles it**: Parent shows alert, but component should handle its own errors
4. **Poor UX**: Button looks stuck or broken
5. **No error state**: Component can't display error to user

**Steps to Reproduce**:
1. Click "Mark Used" button
2. Mock API to fail with error
3. Button shows "Marking..." and then resets, but no error shown to user

**Expected Behavior**:
- Button shows error message: "Failed to mark as used"
- User knows what happened
- User can retry or contact support

**Actual Behavior**:
- Button shows "Marking..." then goes back to "Mark Used"
- No error message shown
- Silent failure
- Parent component shows alert (but that's not ideal)

**Proposed Fix**:
```typescript
const [markingError, setMarkingError] = useState<string | null>(null);

const handleMarkUsed = useCallback(async () => {
  if (!onMarkUsed) return;
  setIsMarkingUsed(true);
  setMarkingError(null);  // Clear previous errors
  
  try {
    await onMarkUsed(id);
  } catch (error) {
    const message = error instanceof Error 
      ? error.message 
      : 'Failed to mark as used';
    setMarkingError(message);
    console.error('Mark used error:', error);
  } finally {
    setIsMarkingUsed(false);
  }
}, [id, onMarkUsed]);

// In JSX, after buttons:
{markingError && (
  <p className="text-sm text-red-600 dark:text-red-400 mt-2">
    Error: {markingError}
  </p>
)}
```

**Time to Fix**: 20 minutes

---

### BUG-005: Stale Closure Risk with useCallback Dependencies

**Severity**: 🟠 HIGH  
**Status**: OPEN  
**Component**: `new-page.tsx`  
**File Path**: `src/app/dashboard/new-page.tsx:176-194`  
**Type**: React Pattern Violation

**Symptom**: Subtle bugs could occur if callback references change unexpectedly

**Code**:
```typescript
const handleMarkUsed = useCallback(
  async (benefitId: string) => {
    try {
      const result = await toggleBenefitUsed(benefitId);
      if (result.success) {
        setBenefits((prev) =>
          prev.map((b) =>
            b.id === benefitId ? { ...b, status: 'used' as const } : b
          )
        );
      }
    } catch (err) {
      console.error('Error marking benefit as used:', err);
      alert('Failed to mark benefit as used');
    }
  },
  [] // ⚠️ Empty dependency array
);
```

**Problems**:
1. **Empty dependency array**: `[]` means callback never updates
2. **Uses external functions**: `toggleBenefitUsed` is not in dependencies
3. **Callback memoization**: While this works now, it's poor practice
4. **Future maintenance risk**: Could cause bugs if code changes
5. **ESLint warning**: Should trigger exhaustive-deps warning

**Impact**: 
- Currently low (code works)
- Future high (if patterns change)

**Proposed Fix**:
```typescript
// Option 1: Explicitly document why no deps
const handleMarkUsed = useCallback(
  async (benefitId: string) => {
    try {
      const result = await toggleBenefitUsed(benefitId);
      if (result.success) {
        setBenefits((prev) =>
          prev.map((b) =>
            b.id === benefitId ? { ...b, status: 'used' as const } : b
          )
        );
      }
    } catch (err) {
      console.error('Error marking benefit as used:', err);
      alert('Failed to mark benefit as used');
    }
  },
  // Intentionally no deps: setState is stable, toggleBenefitUsed is external API
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []
);

// Option 2: Include stable dependencies
const handleMarkUsed = useCallback(
  async (benefitId: string) => {
    try {
      const result = await toggleBenefitUsed(benefitId);
      if (result.success) {
        setBenefits((prev) =>
          prev.map((b) =>
            b.id === benefitId ? { ...b, status: 'used' as const } : b
          )
        );
      }
    } catch (err) {
      console.error('Error marking benefit as used:', err);
      alert('Failed to mark benefit as used');
    }
  },
  [setBenefits]  // Include setter (though it's usually stable)
);
```

**Time to Fix**: 15 minutes

---

### BUG-006: No Validation of API Response Data Types

**Severity**: 🟠 HIGH  
**Status**: OPEN  
**Component**: `api-client.ts`  
**File Path**: `src/app/dashboard/utils/api-client.ts:51-78`  
**Type**: Data Validation / Type Safety

**Symptom**: Runtime errors if API response structure changes

**Code**:
```typescript
export async function fetchUserBenefits(): Promise<BenefitApiResponse[]> {
  try {
    const response = await fetch('/api/benefits/filters', { /* ... */ });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch benefits: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to parse benefits response');
    }

    return data.data;  // ⚠️ No validation of shape
  } catch (error) {
    console.error('Error fetching benefits:', error);
    throw error;
  }
}
```

**Problems**:
1. **No schema validation**: Doesn't verify `data.data` structure
2. **Type mismatch possible**: API could return wrong data type
3. **Runtime errors**: Errors only appear after deployment
4. **No early error catching**: Invalid data might propagate downstream

**Proposed Fix**:
```typescript
function validateBenefitResponse(data: unknown): BenefitApiResponse[] {
  if (!Array.isArray(data)) {
    throw new Error('Expected array of benefits');
  }
  
  return data.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`Benefit at index ${index} is not an object`);
    }
    
    const obj = item as Record<string, unknown>;
    
    if (!obj.id || !obj.name) {
      throw new Error(`Benefit at index ${index} missing required fields: id, name`);
    }
    
    if (typeof obj.stickerValue !== 'number') {
      throw new Error(`Benefit at index ${index} stickerValue is not a number`);
    }
    
    return {
      id: String(obj.id),
      name: String(obj.name),
      type: String(obj.type || ''),
      stickerValue: Number(obj.stickerValue),
      userDeclaredValue: obj.userDeclaredValue ? Number(obj.userDeclaredValue) : null,
      resetCadence: String(obj.resetCadence || 'MONTHLY'),
      expirationDate: obj.expirationDate ? String(obj.expirationDate) : undefined,
      status: obj.status ? String(obj.status) : undefined,
      isUsed: Boolean(obj.isUsed),
      description: obj.description ? String(obj.description) : undefined,
    } as BenefitApiResponse;
  });
}

export async function fetchUserBenefits(): Promise<BenefitApiResponse[]> {
  try {
    const response = await fetch('/api/benefits/filters', { /* ... */ });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch benefits: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'API returned error');
    }
    
    // Validate before returning
    return validateBenefitResponse(data.data);
  } catch (error) {
    console.error('Error fetching benefits:', error);
    throw error;
  }
}
```

**Time to Fix**: 30 minutes

---

## Medium Priority Bugs (🟡 Nice to Fix)

### BUG-007: Missing Card Issuer Information

**Severity**: 🟡 MEDIUM  
**Status**: OPEN  
**Component**: `api-client.ts`  
**File Path**: `src/app/dashboard/utils/api-client.ts:232-234`  
**Type**: Data Mapping Incomplete

**Symptom**: Benefits display with blank issuer field

**Code**:
```typescript
return {
  id: benefit.id,
  name: benefit.name,
  issuer: '',  // ⚠️ EMPTY - Will be populated from card data if available
  cardName: undefined,
  status,
```

**Problem**:
- Issuer hardcoded as empty string
- Card name not provided
- Mock benefits have issuer ("Amex Platinum", "Chase Sapphire") but real data doesn't
- Users can't tell which card benefits belong to

**Proposed Fix**:

**Option 1**: Extend API to include issuer
```typescript
interface BenefitApiResponse {
  id: string;
  name: string;
  issuer?: string;     // ADD THIS
  cardId?: string;     // ADD THIS
  type: string;
  // ...
}

// Then in transformation:
issuer: benefit.issuer || 'Unknown Card',
cardName: benefit.cardName,
```

**Option 2**: Fetch card data and join
```typescript
const cards = await fetchCards();
const cardMap = new Map(cards.map(c => [c.id, c]));

// In transformation:
const card = cardMap.get(benefit.cardId);
issuer: card?.issuer || 'Unknown Card',
cardName: card?.name,
```

**Time to Fix**: 30 minutes (depends on API changes)

---

### BUG-008: Period Display Label Becomes Stale After Date Change

**Severity**: 🟡 MEDIUM  
**Status**: OPEN  
**Component**: `PeriodSelector.tsx`  
**File Path**: `src/app/dashboard/components/PeriodSelector.tsx:42-45`  
**Type**: UX Edge Case

**Symptom**: Period label doesn't update if user keeps dashboard open past midnight

**Scenario**:
- User opens dashboard at 11:45 PM, sees "May 2025"
- User keeps it open until 12:05 AM (next day)
- Label still shows "May 2025" (should show "June 2025")
- Confusing until they close and reopen

**Proposed Fix**:
```typescript
// Make label dynamic instead of pre-computed
const periodDisplay = useMemo(() => {
  const selected = periods.find((p) => p.id === selectedPeriodId);
  if (!selected) return 'Loading...';
  
  // Recalculate label dynamically
  return getPeriodDisplayLabel(selected.id as PeriodType);
}, [selectedPeriodId, periods, selectedPeriodId]);
```

**Time to Fix**: 15 minutes

---

### BUG-009: Accessibility - Button Disabled Reason Not Explained

**Severity**: 🟡 MEDIUM  
**Status**: OPEN  
**Component**: `BenefitRow.tsx`  
**File Path**: `src/app/dashboard/components/BenefitRow.tsx:185-188`  
**Type**: WCAG 2.1 AA Accessibility

**Symptom**: Screen reader users don't know why "Mark Used" button is disabled for pending benefits

**Code**:
```typescript
{status !== 'used' && status !== 'expired' && onMarkUsed && (
  <button
    onClick={handleMarkUsed}
    disabled={isMarkingUsed || status === 'pending'}
    className="... disabled:opacity-50 disabled:cursor-not-allowed..."
    // ⚠️ No aria-label explaining why disabled
  >
```

**Problem**:
- Button is disabled for 'pending' status
- Sighted users see the disabled state (gray appearance)
- Screen reader users don't hear why it's disabled
- WCAG violation

**Proposed Fix**:
```typescript
{status !== 'used' && status !== 'expired' && onMarkUsed && (
  <button
    onClick={handleMarkUsed}
    disabled={isMarkingUsed || status === 'pending'}
    aria-disabled={isMarkingUsed || status === 'pending'}
    aria-busy={isMarkingUsed}
    title={status === 'pending' ? 'Cannot mark pending benefits as used' : 'Mark this benefit as used'}
    aria-label={
      status === 'pending'
        ? 'Cannot mark pending benefit as used - benefit becomes active in the future'
        : 'Mark this benefit as used'
    }
    className="... disabled:opacity-50 disabled:cursor-not-allowed..."
  >
    <CheckCircle2 size={16} aria-hidden="true" />
    {isMarkingUsed ? 'Marking...' : 'Mark Used'}
  </button>
)}
```

**Time to Fix**: 10 minutes

---

## Summary Table

| Bug ID | Component | Severity | Status | Time | Category |
|--------|-----------|----------|--------|------|----------|
| BUG-001 | BenefitRow.tsx | 🔴 CRITICAL | Blocking build | 5 min | TypeScript |
| BUG-002 | api-client.ts | 🔴 CRITICAL | Data loss risk | 30 min | Data transformation |
| BUG-003 | new-page.tsx | 🔴 CRITICAL | Error handling | 20 min | UX/Error handling |
| BUG-004 | BenefitRow.tsx | 🟠 HIGH | Silent failure | 20 min | Error handling |
| BUG-005 | new-page.tsx | 🟠 HIGH | Stale closure | 15 min | React pattern |
| BUG-006 | api-client.ts | 🟠 HIGH | No validation | 30 min | Data validation |
| BUG-007 | api-client.ts | 🟡 MEDIUM | Missing data | 30 min | Feature |
| BUG-008 | PeriodSelector.tsx | 🟡 MEDIUM | Stale label | 15 min | UX |
| BUG-009 | BenefitRow.tsx | 🟡 MEDIUM | A11y issue | 10 min | Accessibility |

**Total Estimated Fix Time**: ~3 hours

---

## Fix Priority Matrix

### Priority 1: Critical - Do Before Merge (1 hour)
- [ ] BUG-001: Build failure (5 min)
- [ ] BUG-002: Currency conversion (30 min - investigation)
- [ ] BUG-003: Error handling (20 min)

### Priority 2: High - Do Before QA Testing (1.5 hours)
- [ ] BUG-004: Error handling in BenefitRow (20 min)
- [ ] BUG-005: Stale callbacks (15 min)
- [ ] BUG-006: Data validation (30 min)

### Priority 3: Medium - Do for v1.0 (1 hour)
- [ ] BUG-007: Issuer data (30 min - depends on API)
- [ ] BUG-008: Period label (15 min)
- [ ] BUG-009: Accessibility (10 min)

---

## Next Steps

1. **Immediate** (Before merge):
   - Fix BUG-001 (5 min) - Remove unused variable
   - Investigate BUG-002 (10 min) - Check API response format
   - Fix BUG-003 (20 min) - Improve error handling
   - Run `npm run build` to verify fixes

2. **Before Testing** (Next 2 hours):
   - Fix remaining HIGH priority bugs
   - Run test suite
   - Manual smoke test

3. **Before Release** (Before Phase 4):
   - Fix all MEDIUM bugs
   - Complete test coverage
   - Performance testing

---

## Questions for Development Team

1. Does `/api/benefits/progress` return cents or dollars? (Critical for BUG-002)
2. Should API be extended to include card issuer info? (For BUG-007)
3. Should we implement retry logic for failed API calls? (Related to BUG-003)
4. What's acceptable performance for benefit list rendering? (For optimization)

---

*Bug Report prepared by: QA Automation Engineer*  
*Date: Phase 3 QA Review*  
*Status: 🔴 9 Bugs - Blocks Deployment Until Critical Bugs Fixed*
