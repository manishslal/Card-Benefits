# PHASE 2 CONSOLIDATED BUG LIST - Card Benefits Tracker

**Consolidated Date**: April 3, 2024  
**Total Bugs Identified**: 52 (from 25+27 duplicate-adjusted)  
**MVP Blocking Status**: 10 Critical, 15 High, 12 Medium, 5 Low  
**Total Estimated Effort**: 180-220 hours

---

## EXECUTIVE SUMMARY

### Bug Distribution by Phase

| Phase | Category | Count | Severity | MVP Impact |
|-------|----------|-------|----------|-----------|
| **2A** | Blocking MVP | 10 | CRITICAL | ❌ Prevents release |
| **2B** | Required for MVP | 15 | HIGH | ⚠️ Must fix before launch |
| **2C** | Quality Improvements | 12 | MEDIUM | 📋 Improves reliability |
| **2D** | Polish & Performance | 5 | LOW | 🎨 Nice to have |
| **TOTAL** | | **42** | | |

### Effort Breakdown

| Phase | Estimated Hours | Developer Days | Priority |
|-------|-----------------|-----------------|----------|
| **2A** | 60-80 | 7.5-10 | CRITICAL (Week 1-2) |
| **2B** | 80-100 | 10-12.5 | HIGH (Week 2-3) |
| **2C** | 25-30 | 3-4 | MEDIUM (Week 4) |
| **2D** | 15-20 | 2-2.5 | LOW (Week 4) |
| **TOTAL** | **180-220** | **22-29** | **4-5 weeks** |

### Key Insights

1. **Authentication is unstable**: Race conditions in login/logout can fail 5-10% of requests
2. **Data integrity at risk**: Bulk operations can partially fail, leaving inconsistent state
3. **Security vulnerabilities**: Unauthorized access possible; session cleanup missing
4. **Feature incompleteness**: 8+ features are stubs or using mock data
5. **Calculation errors**: ROI, wallet stats, and benefit tracking have edge case bugs

### Quick Wins (Can fix in 1-2 hours each)

- Fix validator return types (🔴 BUG #1 from debug findings)
- Add early authorization check in getCardDetails (#6 from phase2)
- Implement missing refresh button on dashboard (#9 from phase1)
- Fix zero-fee card ROI calculation (#12 from phase2)
- Add DST handling to date validation (#18 from phase2)

---

## PHASE 2A: BLOCKING MVP (10 Critical Bugs)

### **BLOCKER #1: Import Validator Return Type Mismatch**
**From**: Phase 1 Debug Report, BUG #1  
**Severity**: 🔴 CRITICAL  
**File**: `src/lib/import/validator.ts`, `src/__tests__/import-validator.test.ts`  
**Effort**: Medium (8-12 hours)  
**Status**: ❌ Blocks import feature entirely

**Problem**:
```typescript
// Validators return objects: { valid: boolean, value?: any }
// But tests expect boolean
const result = validateAnnualFee('550', 1, resultObj);
expect(result).toBe(true);  // ❌ FAILS - returns { valid: true, value: 550 }
```

Affects 25+ test cases. Import validation is completely broken.

**Impact**: Users cannot import cards via CSV. Core MVP feature unavailable.

**Fix Approach**:
1. Standardize all validators to return consistent type (recommend object: `{ valid: boolean, value?: any, error?: string }`)
2. Update all 25+ test cases to check `.valid` property
3. Update integration code to use `.valid` property
4. Add JSDoc to clarify return type contract

**Acceptance Criteria**:
- [ ] All 72 tests in import-validator.test.ts pass
- [ ] Validators have consistent return type
- [ ] JSDoc comments explain return structure
- [ ] Import workflow successfully processes CSV files

**Depends On**: None

---

### **BLOCKER #2: Session Token Race Condition in Login/Signup**
**From**: Phase 2 Debug Report, BUG #1  
**Severity**: 🔴 CRITICAL  
**Files**: `src/app/api/auth/login/route.ts`, `src/app/api/auth/signup/route.ts`  
**Effort**: Medium (6-10 hours)  
**Status**: ❌ Causes 5-10% of auth requests to fail

**Problem**:
```typescript
// Session created with empty token
const sessionRecord = await createSession(user.id, '', expiresAt);

// JWT signed (outside transaction)
const token = signSessionToken(payload);

// Update asynchronously (RACE WINDOW HERE)
await updateSessionToken(sessionRecord.id, token);  // Can fail or delay
```

Between session creation and token assignment, immediate API calls fail with "Session invalid".

**Impact**: 5-10% of login attempts fail randomly. Users get stuck on login page. Critical user experience issue.

**Fix Approach**:
1. Include token in initial `createSession` call
2. Make session creation and token assignment atomic
3. Use database transaction or pass token to creation function

**Code Change**:
```typescript
// Create JWT first
const payload = createSessionPayload(user.id);
const token = signSessionToken(payload);
const expiresAt = new Date(Date.now() + SESSION_DURATION);

// Pass token to createSession - make atomic
const sessionRecord = await createSession(user.id, token, expiresAt);
```

**Acceptance Criteria**:
- [ ] Session created with token in single operation
- [ ] No race window between creation and token assignment
- [ ] Login tests pass 100% (no flaky failures)
- [ ] Load test: 1000 concurrent logins succeed

**Depends On**: None

---

### **BLOCKER #3: Critical Security Issue - Logout Doesn't Invalidate Session**
**From**: Phase 2 Debug Report, BUG #3  
**Severity**: 🔴 CRITICAL (SECURITY)  
**File**: `src/app/api/auth/logout/route.ts` (lines 99-116)  
**Effort**: Small (3-4 hours)  
**Status**: ❌ Session revocation unreliable; stolen tokens remain valid

**Problem**:
```typescript
try {
  await invalidateSession(sessionCookie.value);
} catch (error) {
  // Error logged but NOT re-thrown
  // Session remains valid in database
  const response = NextResponse.json({...}, { status: 500 });
  clearSessionCookie(response);
  return response;  // Session still usable!
}
```

If database fails during logout, session is NOT invalidated. Stolen/compromised tokens can be reused indefinitely.

**Impact**: **CRITICAL SECURITY VULNERABILITY**. Logout is unreliable. Users think they're logged out but session remains active.

**Fix Approach**:
1. Ensure session is always invalidated before returning error
2. If database unavailable, queue invalidation for retry
3. Never return success if invalidation fails

**Code Change**:
```typescript
try {
  await invalidateSession(sessionCookie.value);
  return NextResponse.json({ success: true }, { status: 200 });
} catch (error) {
  console.error('[Logout Error]', error);
  
  // Even on error, clear client-side cookie
  // Server-side session remains marked invalid (or retry)
  const response = NextResponse.json(
    { success: false, error: 'Logout failed' },
    { status: 500 }
  );
  
  clearSessionCookie(response);
  return response;
}
```

**Acceptance Criteria**:
- [ ] Session always marked invalid on logout attempt
- [ ] If DB unavailable, error returned (don't claim success)
- [ ] Security audit confirms token can't be reused after logout
- [ ] Logout test: even with DB failure, session becomes invalid

**Depends On**: None (Independent)

---

### **BLOCKER #4: Bulk Card Update Partial Failure - No Rollback**
**From**: Phase 2 Debug Report, BUG #2  
**Severity**: 🔴 CRITICAL  
**File**: `src/actions/card-management.ts` (lines 676-704)  
**Effort**: Medium (8-10 hours)  
**Status**: ❌ Data integrity at risk; inconsistent state possible

**Problem**:
```typescript
await prisma.$transaction(async (tx) => {
  for (const card of cards) {
    try {
      // Card updates here
      await tx.userCard.update({...});
      updated++;
    } catch (error) {
      // Try-catch prevents rollback!
      errors.push({...});
    }
  }
});
```

Try-catch inside transaction prevents rollback. If card 5 validation fails, cards 1-4 already committed.

**Impact**: Bulk operations create inconsistent state. Some cards updated, others not. User confusion and data integrity violations.

**Fix Approach**:
1. **Option A (Recommended)**: Remove try-catch, validate all cards BEFORE transaction
2. **Option B**: Pre-validate all updates before entering transaction
3. Either way: Transaction must succeed fully or fail entirely

**Code Change** (Option A):
```typescript
// Pre-validate ALL before transaction
for (const card of cards) {
  if (updates.status) {
    validateCardStatusTransition(card.status as CardStatus, updates.status);
  }
  if (updates.renewalDate) {
    validateRenewalDate(updates.renewalDate);
  }
}

// Now transaction can't fail on validation
const result = await prisma.$transaction(async (tx) => {
  let updated = 0;
  for (const card of cards) {
    await tx.userCard.update({...});
    updated++;
  }
  return updated;
});
```

**Acceptance Criteria**:
- [ ] All validations happen before transaction starts
- [ ] Transaction succeeds fully or rolls back completely
- [ ] No partial updates possible
- [ ] Test: bulk update with one invalid card fails completely

**Depends On**: None

---

### **BLOCKER #5: Import Transaction - Status Update Outside TX**
**From**: Phase 2 Debug Report, BUG #4  
**Severity**: 🔴 CRITICAL  
**File**: `src/lib/import/committer.ts` (lines 400-526)  
**Effort**: Small (4-6 hours)  
**Status**: ❌ Import status never syncs with actual data

**Problem**:
```typescript
// Data imported in transaction
const result = await prisma.$transaction(async (tx) => {
  // ... all updates ...
  return { cardsCreated: 5 };
});

// STATUS UPDATE OUTSIDE - can fail!
await prisma.importJob.update({
  where: { id: importJobId },
  data: { status: 'Committed' }
});  // If this fails, data is imported but status shows "Processing"
```

Data is committed but status update fails. UI shows "Processing..." indefinitely.

**Impact**: Import completes but user doesn't know. Retries possible, duplicate processing.

**Fix Approach**:
1. Move status update INSIDE the transaction
2. Make the entire import atomic: data + status both succeed or both fail

**Code Change**:
```typescript
const result = await prisma.$transaction(async (tx) => {
  // ... process all records ...
  
  // Update status INSIDE transaction
  await tx.importJob.update({
    where: { id: importJobId },
    data: {
      status: 'Committed',
      completedAt: new Date(),
      recordsProcessed: processedCount
    }
  });
  
  return { cardsCreated: 5, ... };
});
```

**Acceptance Criteria**:
- [ ] Status update happens inside transaction
- [ ] Data and status both commit together
- [ ] If TX fails, both roll back
- [ ] Test: import succeeds and status updates atomically

**Depends On**: BLOCKER #1 (import validator must work first)

---

### **BLOCKER #6: Missing GET /api/cards/available Endpoint**
**From**: Phase 1 Debug Report, BUG #3  
**Severity**: 🔴 CRITICAL  
**File**: `src/components/AddCardModal.tsx` (line 60-89)  
**Effort**: Medium (10-12 hours)  
**Status**: ❌ Users see only 3 hardcoded mock cards

**Problem**:
```typescript
// Mock data instead of API call
const mockCards: Card[] = [
  { id: 'card_1', issuer: 'Chase', ... },
  { id: 'card_2', issuer: 'Amex', ... },
  { id: 'card_3', issuer: 'CapOne', ... }
];
setAvailableCards(mockCards);  // Always these 3 cards
```

AddCardModal hardcodes 3 cards. Real card catalog never loaded.

**Impact**: Users can only add 3 card types. Cannot access full card database. Core feature broken.

**Requires**:
1. GET `/api/cards/available` endpoint
2. Query MasterCard table
3. Return card list with issuer, default annual fee, benefits preview
4. Update modal to use real API

**API Specification**:
```
GET /api/cards/available?issuer=Chase&search=sapphire&limit=50

Response 200:
{
  "cards": [
    {
      "id": "mastercard_123",
      "name": "Chase Sapphire Preferred",
      "issuer": "Chase",
      "cardNetwork": "visa",
      "defaultAnnualFee": 95,
      "defaultBenefits": ["$300 travel credit", "3x points"],
      "popularityRank": 1
    }
  ],
  "total": 450
}
```

**Acceptance Criteria**:
- [ ] Endpoint returns all cards from MasterCard table
- [ ] Supports filtering by issuer
- [ ] Supports search by card name
- [ ] Modal fetches from real API
- [ ] Users can add any card from database

**Depends On**: None (Independent)

---

### **BLOCKER #7: Dashboard Using Mock Data - Real Data Not Loading**
**From**: Phase 1 Debug Report, BUG #4  
**Severity**: 🔴 CRITICAL  
**File**: `src/app/(dashboard)/page.tsx` (lines 29-52, 191)  
**Effort**: Medium (8-10 hours)  
**Status**: ❌ Dashboard always shows same 3 hardcoded cards

**Problem**:
```typescript
const mockCards = [
  { id: '1', name: 'Chase Sapphire', type: 'visa', lastFour: '4242', issuer: 'Chase' },
  { id: '2', name: 'Amex Platinum', type: 'amex', lastFour: '0005', issuer: 'American Express' },
  { id: '3', name: 'Capital One', type: 'mastercard', lastFour: '5555', issuer: 'Capital One' }
];
// Never loads real user cards - always shows mock data
```

Dashboard never calls `getPlayerCards()`. Always shows same 3 demo cards.

**Impact**: Users cannot see their actual cards. Cannot manage wallet. MVP broken.

**Requires**:
1. Add useEffect to fetch real cards via `getPlayerCards()`
2. Implement loading/error states
3. Remove mock data completely
4. Display real benefits and stats

**Code Change**:
```typescript
export default function DashboardPage() {
  const [cards, setCards] = useState<CardDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadCards = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getPlayerCards();
        if (result.success) {
          setCards(result.data.cards);
        } else {
          setError(result.error || 'Failed to load cards');
        }
      } catch (err) {
        setError('An error occurred loading cards');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCards();
  }, []);
  
  if (isLoading) return <DashboardSkeleton />;
  if (error) return <DashboardError message={error} />;
  
  return (
    // Display real cards
  );
}
```

**Acceptance Criteria**:
- [ ] Dashboard loads real user cards on mount
- [ ] Shows loading state while fetching
- [ ] Displays actual card benefits
- [ ] Adding a card updates dashboard immediately
- [ ] Refresh button works and reloads cards

**Depends On**: BLOCKER #6 (need card database working)

---

### **BLOCKER #8: Settings Page Profile Update Not Implemented**
**From**: Phase 1 Debug Report, BUG #2  
**Severity**: 🔴 CRITICAL  
**File**: `src/app/(dashboard)/settings/page.tsx` (lines 88-102)  
**Effort**: Medium (10-12 hours)  
**Status**: ❌ Profile changes not saved; fake success message

**Problem**:
```typescript
const handleSaveProfile = async () => {
  setIsLoading(true);
  setMessage('');
  
  try {
    // Fake delay - no actual API call!
    await new Promise((resolve) => setTimeout(resolve, 500));
    setMessage('✓ Profile updated successfully');  // Fake success!
  }
};
```

Pressing "Save Changes" shows success but doesn't save anything. No API endpoint exists.

**Impact**: Users think profile is saved but changes are lost. Cannot update name, email, or settings.

**Requires**:
1. POST `/api/user/profile` endpoint
2. Validate field changes (name, email, preferences)
3. Update database
4. Fetch profile on page load
5. Show actual success/error

**API Specification**:
```
POST /api/user/profile

Request:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "notificationPreferences": {
    "emailNotifications": true,
    "renewalReminders": true
  }
}

Response 200:
{
  "success": true,
  "user": { ... updated user ... }
}

Response 400:
{
  "success": false,
  "error": "Email already in use"
}
```

**Acceptance Criteria**:
- [ ] Profile endpoint validates and saves changes
- [ ] Email must be unique across system
- [ ] Page loads current profile values
- [ ] Changes persist after page reload
- [ ] Proper error messages for validation failures

**Depends On**: None

---

### **BLOCKER #9: CardDetailPanel and BulkActionBar Are Stubs**
**From**: Phase 1 Debug Report, BUG #5  
**Severity**: 🔴 CRITICAL  
**Files**: `src/components/card-management/CardDetailPanel.tsx`, `src/components/card-management/BulkActionBar.tsx`  
**Effort**: High (20-25 hours)  
**Status**: ❌ Cannot view card details; cannot bulk edit

**Problem**:
```typescript
// CardDetailPanel is just a placeholder
export function CardDetailPanel({ card, isOpen, onClose }) {
  return (
    <div>
      <p>Card detail panel - Phase 2</p>  // ❌ Stub
      <button onClick={onClose}>Close</button>
    </div>
  );
}

// BulkActionBar is just a counter
export function BulkActionBar({ selectedCount, onClearSelection }) {
  return (
    <div>
      <span>{selectedCount} card{selectedCount === 1 ? '' : 's'} selected</span>
      <button onClick={onClearSelection}>Clear Selection</button>
    </div>
  );
}
```

Both components are TODO stubs with no implementation.

**Impact**: Cannot view card details or edit benefits. Cannot bulk select/archive cards. Critical workflow broken.

**Requires**:
1. Implement CardDetailPanel with:
   - Card stats (annual fee, benefit values, ROI)
   - Benefits list with usage tracking
   - Edit, archive, delete actions
   - Benefit claim/reset UI

2. Implement BulkActionBar with:
   - Archive/Delete/Update actions
   - Action confirmation dialogs
   - Server action integration

**Acceptance Criteria**:
- [ ] Clicking card opens detail panel with full information
- [ ] Can edit card renewal date, annual fee
- [ ] Can claim/reset individual benefits
- [ ] Bulk select shows action bar
- [ ] Archive/delete actions work with confirmation

**Depends On**: BLOCKER #6, #7 (need card data working first)

---

### **BLOCKER #10: Password Change Not Implemented**
**From**: Phase 1 Debug Report, BUG #10  
**Severity**: 🔴 CRITICAL (SECURITY)  
**File**: `src/app/(dashboard)/settings/page.tsx` (lines 104-143)  
**Effort**: Medium (8-10 hours)  
**Status**: ❌ Users think password changed but it doesn't

**Problem**:
```typescript
const handleChangePassword = async () => {
  // ... validation ...
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));  // Fake wait!
    setMessage('✓ Password changed successfully');  // Fake success!
  }
};
```

Password change button shows success but doesn't update password. No API endpoint exists.

**Impact**: Users cannot change passwords. Security risk if credentials compromised.

**Requires**:
1. POST `/api/user/change-password` endpoint
2. Validate old password (compare hash)
3. Hash new password
4. Update database
5. Invalidate all other sessions (security best practice)

**API Specification**:
```
POST /api/user/change-password

Request:
{
  "oldPassword": "currentPassword123",
  "newPassword": "newPassword456",
  "confirmPassword": "newPassword456"
}

Response 200:
{
  "success": true,
  "message": "Password changed successfully"
}

Response 400:
{
  "success": false,
  "error": "Current password is incorrect"
}
```

**Acceptance Criteria**:
- [ ] Old password must be verified
- [ ] New password must be strong (requirements defined)
- [ ] Passwords must match
- [ ] All other sessions invalidated after change
- [ ] User must log in again on current session

**Depends On**: None (Independent)

---

## PHASE 2B: REQUIRED FOR MVP (15 High Priority Bugs)

### **HIGH #1: CardFiltersPanel Not Implemented**
**From**: Phase 1 Debug Report, BUG #6  
**Severity**: 🟠 HIGH  
**File**: `src/components/card-management/CardFiltersPanel.tsx`  
**Effort**: Medium (12-15 hours)  
**Status**: ⏳ All filters marked TODO

**Problem**:
- Status filter - TODO
- Issuer filter - TODO
- Annual fee range filter - TODO
- Renewal date range filter - TODO
- Benefits filter - TODO
- Saved filters - TODO

Filters don't affect card display.

**Impact**: Cannot filter card list. Cannot find specific cards. Usability issue.

**Requirements**:
1. Status filter (ACTIVE, ARCHIVED, PAUSED, PENDING)
2. Issuer filter (multi-select)
3. Fee range slider
4. Renewal date range picker
5. Benefits search/filter
6. Save filter presets
7. Apply filters to card list

**Acceptance Criteria**:
- [ ] All filter types implemented and functional
- [ ] Filters affect dashboard card display
- [ ] Can save/load filter presets
- [ ] Filter state persists in URL
- [ ] Clear filters button works

**Depends On**: BLOCKER #7 (need real data)

**Estimated Effort**: 12-15 hours

---

### **HIGH #2: Race Condition in toggleBenefit - Concurrent Update**
**From**: Phase 2 Debug Report, BUG #5  
**Severity**: 🟠 HIGH  
**File**: `src/actions/benefits.ts` (lines 51-109)  
**Effort**: Medium (8-10 hours)  
**Status**: ❌ Usage counter can become incorrect with concurrent requests

**Problem**:
```typescript
const benefit = await prisma.userBenefit.update({
  where: { id: benefitId, isUsed: currentIsUsed },  // Guard only checks one field
  data: { isUsed: !currentIsUsed, timesUsed: { increment: 1 } }
});
```

Two simultaneous requests can both pass the guard and increment counter twice.

**Impact**: Benefit usage tracking becomes incorrect. ROI calculations inflated. User confusion.

**Fix Approach**:
1. Add optimistic locking (version field)
2. Or use database-level constraints
3. Or use Prisma atomic operations

**Code Change**:
```typescript
const benefit = await prisma.userBenefit.update({
  where: {
    id: benefitId,
    version: currentVersion  // Add version check
  },
  data: {
    isUsed: !currentIsUsed,
    claimedAt: !currentIsUsed ? new Date() : null,
    timesUsed: !currentIsUsed ? { increment: 1 } : undefined,
    version: { increment: 1 }  // Bump version on success
  }
});
```

**Acceptance Criteria**:
- [ ] Concurrent benefit toggles don't cause double-counting
- [ ] Version field prevents race condition
- [ ] Load test with 100 concurrent toggles
- [ ] Usage counter matches expectations

**Depends On**: None (Independent)

---

### **HIGH #3: Missing Early Authorization Check in getCardDetails**
**From**: Phase 2 Debug Report, BUG #6  
**Severity**: 🟠 HIGH (SECURITY)  
**File**: `src/actions/card-management.ts` (lines 273-363)  
**Effort**: Small (4-6 hours)  
**Status**: ❌ Unauthorized access loads sensitive data

**Problem**:
```typescript
// Fetches full card data FIRST
const card = await prisma.userCard.findUnique({
  where: { id: cardId },
  include: { masterCard: true, userBenefits: true, player: { include: { user: true } } }
});

// Checks authorization AFTER loading
if (!authorized) return error;
```

Sensitive data loaded into memory before authorization check.

**Fix Approach**:
1. Check authorization with minimal data first
2. Only fetch full details after authorization passes

**Code Change**:
```typescript
// Check ownership first (minimal query)
const cardOwnership = await prisma.userCard.findUnique({
  where: { id: cardId },
  select: { playerId: true, player: { select: { userId: true } } }
});

if (!cardOwnership) return errorResponse(NOT_FOUND);

// Authorize BEFORE fetching full data
const authorized = await authorizeCardOperation(userId, cardOwnership, 'READ');
if (!authorized) return errorResponse(AUTHZ_DENIED);

// NOW fetch full details
const fullCard = await prisma.userCard.findUnique({
  where: { id: cardId },
  include: { masterCard: true, userBenefits: true }
});
```

**Acceptance Criteria**:
- [ ] Authorization checked before loading full data
- [ ] No unauthorized data access possible
- [ ] Security review passes

**Depends On**: None (Independent)

---

### **HIGH #4: useAuth Hook Infinite Loop**
**From**: Phase 2 Debug Report, BUG #7  
**Severity**: 🟠 HIGH (PERFORMANCE)  
**File**: `src/hooks/useAuth.ts` (lines 190-205)  
**Effort**: Small (2-4 hours)  
**Status**: ❌ Causes "Maximum update depth" warnings

**Problem**:
```typescript
export function useUserId(): string | null {
  const { user } = useAuth();  // Calls useAuth
  return user?.userId || null;
}

export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();  // Calls useAuth
  return isAuthenticated;
}
```

Nested hook calls cause re-render loops.

**Fix Approach**:
1. Memoize derived values
2. Or just use useAuth directly in components

**Code Change**:
```typescript
export function useUserId(): string | null {
  const auth = useAuth();
  return useMemo(() => auth.user?.userId || null, [auth.user?.userId]);
}

export function useIsAuthenticated(): boolean {
  const auth = useAuth();
  return useMemo(() => auth.isAuthenticated, [auth.isAuthenticated]);
}
```

**Acceptance Criteria**:
- [ ] No "Maximum update depth" warnings in console
- [ ] Component performance normal
- [ ] useAuth calls don't cause re-renders

**Depends On**: None (Independent)

---

### **HIGH #5: BenefitValueContext useROIValue Stale State**
**From**: Phase 2 Debug Report, BUG #8  
**Severity**: 🟠 HIGH  
**File**: `src/context/BenefitValueContext.tsx` (lines 153-179)  
**Effort**: Small (3-5 hours)  
**Status**: ❌ Shows stale ROI during card transitions

**Problem**:
```typescript
React.useEffect(() => {
  let cancelled = false;
  const fetchROI = async () => {
    const value = await getRoiFn(level, id);
    if (!cancelled) setROI(value);
  };
  fetchROI();
  return () => { cancelled = true; };
}, [level, id, getRoiFn]);
```

When ID changes, old ROI shown briefly until new fetch completes.

**Fix Approach**:
1. Clear ROI immediately when dependencies change
2. Show loading state during transition

**Code Change**:
```typescript
React.useEffect(() => {
  setROI(null);  // Clear immediately on ID change
  setLocalLoading(true);
  let cancelled = false;
  
  const fetchROI = async () => {
    try {
      const value = await getRoiFn(level, id);
      if (!cancelled) setROI(value);
    } finally {
      if (!cancelled) setLocalLoading(false);
    }
  };
  
  fetchROI();
  return () => { cancelled = true; };
}, [level, id, getRoiFn]);
```

**Acceptance Criteria**:
- [ ] Stale ROI no longer shown on card switches
- [ ] Loading state visible during transitions
- [ ] No temporary incorrect values displayed

**Depends On**: None (Independent)

---

### **HIGH #6: EditableValueField Timeout Not Cleared on Unmount**
**From**: Phase 2 Debug Report, BUG #9  
**Severity**: 🟠 HIGH (MEMORY LEAK)  
**File**: `src/components/custom-values/EditableValueField.tsx`  
**Effort**: Small (2-3 hours)  
**Status**: ❌ React warnings; memory leaks

**Problem**:
```typescript
const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

handleSave = async () => {
  loadingTimeoutRef.current = setTimeout(() => {
    setShowLoadingSpinner(true);  // Can fire after unmount!
  }, 200);
  // ...
};
```

Timeout can fire after component unmounts, setting state on unmounted component.

**Fix Approach**:
1. Clear all timeouts in useEffect cleanup

**Code Change**:
```typescript
useEffect(() => {
  return () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  };
}, []);
```

**Acceptance Criteria**:
- [ ] No React "update on unmounted component" warnings
- [ ] No memory leaks during rapid navigation

**Depends On**: None (Independent)

---

### **HIGH #7: Benefit Value History Tracking Disabled**
**From**: Phase 1 Debug Report, BUG #7  
**Severity**: 🟠 HIGH  
**File**: `src/actions/custom-values.ts` (lines 49-91)  
**Effort**: Medium (10-12 hours)  
**Status**: ❌ Audit trail missing; can't track changes

**Problem**:
```typescript
/**
 * NOTE: This function is disabled because the valueHistory field doesn't exist
 * in the UserBenefit model. Re-enable when the field is added to the schema.
 */
// function appendToValueHistory(...) { ... }
```

Value history is commented out. No audit trail for custom value changes.

**Requirements**:
1. Add `valueHistory` field to UserBenefit schema (JSON array)
2. Implement `appendToValueHistory` function
3. Record each value change with timestamp and old/new values
4. Add UI to view history and revert to previous values

**Acceptance Criteria**:
- [ ] valueHistory field in schema
- [ ] Each custom value change recorded
- [ ] UI shows change history with dates
- [ ] Can revert to previous values
- [ ] Audit trail maintained

**Depends On**: None (Independent)

---

### **HIGH #8: Missing Await in Logout Error Path (Already Handled)**
**From**: Phase 2 Debug Report, BUG #3 (DUPLICATE of BLOCKER #3)  
**Status**: ✅ Covered in Phase 2A

---

### **HIGH #9: Card Renewal Date - Archived Cards Show Negative Days**
**From**: Phase 2 Debug Report, BUG #10  
**Severity**: 🟠 HIGH  
**File**: `src/lib/card-validation.ts`, `src/lib/card-calculations.ts`  
**Effort**: Small (3-4 hours)  
**Status**: ❌ Archived cards show renewal urgency

**Problem**:
```typescript
// getDaysUntilRenewal returns -90 for archived card with 3-month-old renewal date
// This causes incorrect renewal status and calculations
```

Archived cards with past renewal dates show negative "days until renewal" and renewal status.

**Fix Approach**:
1. Skip renewal calculations for archived/deleted cards
2. Return Infinity or special value for inactive cards

**Code Change**:
```typescript
export function getDaysUntilRenewal(renewalDate: Date, cardStatus?: string): number {
  if (cardStatus && ['ARCHIVED', 'DELETED'].includes(cardStatus)) {
    return Infinity;  // Card no longer active
  }
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);
  
  const diff = renewal.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
```

**Acceptance Criteria**:
- [ ] Archived cards don't show renewal urgency
- [ ] Days until renewal not negative
- [ ] Renewal status correct for all card statuses

**Depends On**: BLOCKER #7 (need card data working)

---

### **HIGH #10: Cron Job Resets Benefits on Archived Cards**
**From**: Phase 2 Debug Report, BUG #11  
**Severity**: 🟠 HIGH (BUSINESS LOGIC)  
**File**: `src/app/api/cron/reset-benefits/route.ts` (lines 127-141)  
**Effort**: Small (2-3 hours)  
**Status**: ❌ Archived card benefits are recycled

**Problem**:
```typescript
// Cron query doesn't filter by card status
const expiredBenefits = await tx.userBenefit.findMany({
  where: {
    isUsed: true,
    expirationDate: { not: null, lte: now },
    resetCadence: { not: 'OneTime' }
    // Missing: userCard: { status: 'ACTIVE' }
  }
});
```

Cron resets benefits on archived cards.

**Fix Approach**:
1. Add status filter to query

**Code Change**:
```typescript
const expiredBenefits = await tx.userBenefit.findMany({
  where: {
    isUsed: true,
    expirationDate: { not: null, lte: now },
    resetCadence: { not: 'OneTime' },
    userCard: {
      status: 'ACTIVE'  // Only active cards
    }
  }
});
```

**Acceptance Criteria**:
- [ ] Archived card benefits never reset
- [ ] Only active card benefits affected by cron
- [ ] Test: cron run doesn't affect archived cards

**Depends On**: None (Independent)

---

### **HIGH #11: Zero-Fee Card ROI Calculation Wrong**
**From**: Phase 2 Debug Report, BUG #12  
**Severity**: 🟠 HIGH  
**File**: `src/lib/card-calculations.ts` (lines 167-179)  
**Effort**: Small (2-3 hours)  
**Status**: ❌ Misleading ROI for no-fee cards

**Problem**:
```typescript
if (annualFee === 0) {
  return 100;  // Wrong! Should be Infinity or special value
}
```

Zero-fee card with $500 benefits returns ROI=100%, same as card with $500 fee and $1000 benefits.

**Fix Approach**:
1. Return Infinity for zero-fee cards
2. Display as "No Fee" or "Infinite ROI" in UI

**Code Change**:
```typescript
export function calculateCardROI(annualBenefitsValue: number, annualFee: number): number {
  if (annualFee === 0) {
    return annualBenefitsValue > 0 ? Infinity : 0;
  }
  
  const roi = ((annualBenefitsValue - annualFee) / annualFee) * 100;
  return Math.round(roi * 100) / 100;
}
```

**Acceptance Criteria**:
- [ ] Zero-fee cards show correct ROI
- [ ] Sorting/ranking works correctly
- [ ] UI displays "No Fee" or "Infinite ROI" appropriately

**Depends On**: None (Independent)

---

### **HIGH #12: Missing Session Cleanup - Database Bloat**
**From**: Phase 2 Debug Report, BUG #13  
**Severity**: 🟠 HIGH (DATA MANAGEMENT)  
**File**: `src/lib/auth-server.ts` (lines 300-310)  
**Effort**: Medium (6-8 hours)  
**Status**: ❌ Session table grows unbounded

**Problem**:
```typescript
// Only marks as invalid, never deletes
const result = await prisma.session.updateMany({
  where: { userId },
  data: { isValid: false }
});
```

Sessions accumulate over time with no cleanup.

**Requirements**:
1. Create `cleanupSessions()` function
2. Delete invalid sessions older than 30 days
3. Delete expired sessions
4. Run weekly via cron job

**Code Change**:
```typescript
export async function cleanupSessions(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await prisma.session.deleteMany({
    where: {
      OR: [
        { isValid: false, updatedAt: { lt: cutoffDate } },
        { expiresAt: { lt: new Date() } }
      ]
    }
  });
  
  return result.count;
}
```

**Acceptance Criteria**:
- [ ] cleanupSessions function implemented
- [ ] Runs weekly via cron
- [ ] Old sessions deleted properly
- [ ] No performance impact on session queries

**Depends On**: None (Independent)

---

### **HIGH #13: Wallet Stats ROI Calculation Incorrect**
**From**: Phase 2 Debug Report, BUG #14  
**Severity**: 🟠 HIGH  
**File**: `src/actions/card-management.ts` (lines 227-249)  
**Effort**: Small (2-3 hours)  
**Status**: ❌ Shows incorrect wallet ROI

**Problem**:
```typescript
// Calculates AVERAGE ROI instead of SUM
totalROI: activeDisplayCards.length > 0
  ? activeDisplayCards.reduce((sum, c) => sum + c.cardROI, 0) / activeDisplayCards.length
  : 0
```

With 3 cards at 50%, 100%, 150% ROI, shows 100% (average) instead of 300% total benefit.

**Fix Approach**:
1. Clarify whether metric should be sum or average
2. Change calculation accordingly
3. Update UI label to match

**Code Change** (assume total benefit value wanted):
```typescript
totalBenefitValue: activeDisplayCards.reduce((sum, c) => sum + c.annualValue, 0),
totalAnnualFee: activeDisplayCards.reduce((sum, c) => sum + c.effectiveAnnualFee, 0),
averageROI: activeDisplayCards.length > 0
  ? activeDisplayCards.reduce((sum, c) => sum + c.cardROI, 0) / activeDisplayCards.length
  : 0
```

**Acceptance Criteria**:
- [ ] Wallet stats metric clearly defined
- [ ] Calculation matches definition
- [ ] UI labels match metrics
- [ ] Multi-card household shows correct aggregate value

**Depends On**: BLOCKER #7 (need real data)

---

### **HIGH #14: Duplicate Benefits on Import Not Detected**
**From**: Phase 2 Debug Report, BUG #15  
**Severity**: 🟠 HIGH  
**File**: `src/lib/import/duplicate-detector.ts` or `src/lib/import/committer.ts`  
**Effort**: Medium (6-8 hours)  
**Status**: ❌ Duplicate benefits created during import

**Problem**:
```typescript
// No validation for duplicate benefit names on same card
// Can result in two "$300 Travel Credit" benefits
```

Impact: ROI calculations inflated; user confusion about benefit count.

**Requirements**:
1. Add duplicate detection before import commit
2. Check benefit name uniqueness per card
3. Reject import or merge duplicates

**Code Change**:
```typescript
// Validate benefit uniqueness before commit
for (const benefit of benefitRecords) {
  const duplicates = benefitRecords.filter(
    b => b.userCardId === benefit.userCardId && 
         b.name === benefit.name
  );
  
  if (duplicates.length > 1) {
    throw new AppError('Duplicate benefit detected', {
      cardId: benefit.userCardId,
      benefitName: benefit.name
    });
  }
}
```

**Acceptance Criteria**:
- [ ] Duplicate benefits detected and rejected
- [ ] Import fails with clear error message
- [ ] No duplicate benefits in database
- [ ] Import validation comprehensive

**Depends On**: BLOCKER #1 (import validator)

---

### **HIGH #15: Import Validator Field-Level Tests Failing**
**From**: Phase 1 Debug Report, BUG #13  
**Severity**: 🟠 HIGH  
**File**: `src/__tests__/import-validator.test.ts` (multiple)  
**Effort**: Small (3-4 hours)  
**Status**: ❌ 25+ tests fail due to type mismatch

**Problem**:
```typescript
// Tests expect boolean but get object
expect(validateStickerValue('abc', 1, result)).toBe(false);
// Received: { valid: false }
```

Same as BLOCKER #1 but specifically for field-level validators.

**Fix**: Part of BLOCKER #1 consolidation.

**Acceptance Criteria**:
- [ ] All field-level validator tests pass
- [ ] Return types consistent
- [ ] No "Invalid return type" errors

**Depends On**: BLOCKER #1 (import validator type fix)

---

## PHASE 2C: QUALITY IMPROVEMENTS (12 Medium Priority Bugs)

### **MEDIUM #1: Test Environment Missing DOM APIs**
**From**: Phase 1 Debug Report, BUG #16, #17  
**Severity**: 🟡 MEDIUM  
**File**: `src/__tests__/phase1-mvp-bugs-test-suite.test.ts`  
**Effort**: Small (3-5 hours)  
**Status**: ⚠️ 10+ dark mode tests fail

**Problem**:
```typescript
// Tests assume browser APIs not available in Node.js
localStorage.clear();  // ❌ ReferenceError
document.documentElement.className = '';  // ❌ ReferenceError
```

Tests that need DOM must run in jsdom or happy-dom environment.

**Requirements**:
1. Configure Vitest jsdom environment for DOM tests
2. Update test configuration
3. Fix 10+ dark mode tests

**Acceptance Criteria**:
- [ ] Dark mode tests pass in jsdom environment
- [ ] localStorage tests work
- [ ] document API available
- [ ] 10+ previously failing tests now pass

**Depends On**: None (Independent)

---

### **MEDIUM #2: Import Error Accumulation Not Working**
**From**: Phase 1 Debug Report, BUG #14  
**Severity**: 🟡 MEDIUM  
**File**: `src/__tests__/import-validator.test.ts` (lines 1141-1156)  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ Only shows first error per record

**Problem**:
```typescript
// Multiple errors should accumulate but don't
const result = { errors: [], warnings: [] };
await validateCardRecord(recordMultipleErrors, 1, result);
expect(result.errors.length).toBeGreaterThan(1);  // ❌ FAILS - length is 0
```

Validators don't collect all errors; only first one reported.

**Fix Approach**:
1. Ensure all field validations run
2. Push all errors to result array
3. Don't short-circuit on first error

**Acceptance Criteria**:
- [ ] All errors in record reported
- [ ] Error array contains all failures
- [ ] User sees complete validation results
- [ ] Test passes

**Depends On**: BLOCKER #1 (import validator)

---

### **MEDIUM #3: Duplicate Dashboard Routes**
**From**: Phase 1 Debug Report, BUG #15  
**Severity**: 🟡 MEDIUM  
**File**: Route definitions  
**Effort**: Small (1-2 hours)  
**Status**: ⚠️ 2 conflicting routes detected

**Problem**:
```typescript
// Two routes for dashboard detected
// Only 1 should exist
```

Potential router confusion; wrong component might render.

**Fix Approach**:
1. Find both route definitions
2. Keep one; remove duplicate
3. Test routing behavior

**Acceptance Criteria**:
- [ ] Only one dashboard route exists
- [ ] No routing conflicts
- [ ] Dashboard loads correctly

**Depends On**: None (Independent)

---

### **MEDIUM #4: validateRenewalDate Doesn't Handle DST**
**From**: Phase 2 Debug Report, BUG #18  
**Severity**: 🟡 MEDIUM  
**File**: `src/lib/card-validation.ts`  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ DST transitions can break date comparison

**Problem**:
```typescript
// Using setHours(0,0,0,0) during DST transition can be unreliable
const now = new Date();
now.setHours(0, 0, 0, 0);  // Can fail during DST switch
```

Date comparison unreliable during DST transitions.

**Fix Approach**:
1. Use UTC dates or day-level comparison
2. Use date library (date-fns, Day.js) for reliable comparison

**Code Change**:
```typescript
export function validateRenewalDate(date: any, allowPast: boolean = false): void {
  if (!allowPast) {
    // Use UTC to avoid DST issues
    const now = new Date();
    const today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    
    const renewalDate = new Date(date);
    const renewalDay = new Date(renewalDate.getUTCFullYear(), renewalDate.getUTCMonth(), renewalDate.getUTCDate());
    
    if (renewalDay < today) {
      throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
        field: 'renewalDate',
        reason: 'Renewal date must be in the future'
      });
    }
  }
}
```

**Acceptance Criteria**:
- [ ] Date comparison works correctly during DST
- [ ] Tests pass before, during, and after DST transition
- [ ] Reliable date handling

**Depends On**: None (Independent)

---

### **MEDIUM #5: Card Search Case Sensitivity**
**From**: Phase 2 Debug Report, BUG #19  
**Severity**: 🟡 MEDIUM  
**File**: `src/actions/card-management.ts` (line 165-170)  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ Search doesn't work across databases

**Problem**:
```typescript
// SQL LIKE is case-sensitive in some databases
// User searches for "chase" but doesn't find "Chase"
```

Search functionality broken on case-sensitive databases.

**Fix Approach**:
1. Use case-insensitive comparison
2. Database-specific approaches (LOWER() for SQL, regex for MongoDB)

**Code Change** (Prisma/PostgreSQL):
```typescript
// Using Prisma's case-insensitive search
const cards = await prisma.userCard.findMany({
  where: {
    OR: [
      { masterCard: { name: { search: searchTerm } } },  // FTS if available
      { masterCard: { issuer: { contains: searchTerm, mode: 'insensitive' } } }
    ]
  }
});
```

**Acceptance Criteria**:
- [ ] Search case-insensitive
- [ ] Finds cards regardless of case
- [ ] Works on all supported databases

**Depends On**: BLOCKER #6 (card data)

---

### **MEDIUM #6: Missing Network Error Handling in useAuth**
**From**: Phase 2 Debug Report, BUG #20  
**Severity**: 🟡 MEDIUM  
**File**: `src/hooks/useAuth.ts`  
**Effort**: Medium (5-7 hours)  
**Status**: ⚠️ Network failures default to not authenticated

**Problem**:
```typescript
// Network error treated as "not authenticated"
// User thinks they're logged out when network is just slow
```

No retry logic; user assumes logged out on network failure.

**Requirements**:
1. Distinguish network errors from auth errors
2. Implement exponential backoff retry
3. Cache auth state temporarily
4. Show "reconnecting" state

**Acceptance Criteria**:
- [ ] Network errors distinguished from auth errors
- [ ] Retry logic with backoff
- [ ] Auth state cached temporarily
- [ ] User informed of connection issues

**Depends On**: None (Independent)

---

### **MEDIUM #7: Benefit Calculation Uses Stale Declared Values**
**From**: Phase 2 Debug Report, BUG #21  
**Severity**: 🟡 MEDIUM  
**File**: `src/lib/card-calculations.ts`  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ Custom values not reflected in calculations

**Problem**:
```typescript
// calculateBenefitsSummary doesn't use userDeclaredValue
// Only uses stickerValue, ignoring customizations
```

Custom benefit values don't affect summary calculations.

**Fix Approach**:
1. Use userDeclaredValue if available
2. Fall back to stickerValue

**Code Change**:
```typescript
export function calculateBenefitsSummary(benefits: UserBenefit[]): BenefitSummary {
  const totalValue = benefits.reduce((sum, benefit) => {
    // Use declared value if set, otherwise sticker value
    const value = benefit.userDeclaredValue ?? benefit.stickerValue ?? 0;
    return sum + value;
  }, 0);
  
  return { totalValue, count: benefits.length };
}
```

**Acceptance Criteria**:
- [ ] Custom declared values affect calculations
- [ ] ROI reflects custom values
- [ ] Dashboard shows accurate totals

**Depends On**: BLOCKER #7 (need real data)

---

### **MEDIUM #8: Import Job Status Not Atomic**
**From**: Phase 2 Debug Report, BUG #22  
**Severity**: 🟡 MEDIUM  
**File**: `src/lib/import/committer.ts`  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ UpdateMany can partially fail

**Problem**:
```typescript
// UpdateMany on ImportRecords can fail partially
// Some records updated, others not
```

Import job status updates not atomic.

**Fix Approach**:
1. Use transaction for batch status updates
2. Or update parent ImportJob status instead

**Code Change**:
```typescript
await prisma.$transaction(async (tx) => {
  await tx.importRecord.updateMany({
    where: { importJobId: jobId },
    data: { status: 'Committed' }
  });
  
  await tx.importJob.update({
    where: { id: jobId },
    data: { status: 'Completed' }
  });
});
```

**Acceptance Criteria**:
- [ ] All records updated or all fail
- [ ] Transaction ensures atomicity
- [ ] Import status consistent

**Depends On**: BLOCKER #5 (import transaction)

---

### **MEDIUM #9: Missing Index on Session Lookup by Token**
**From**: Phase 2 Debug Report, BUG #23  
**Severity**: 🟡 MEDIUM (PERFORMANCE)  
**File**: `prisma/schema.prisma` (Session model)  
**Effort**: Small (1-2 hours)  
**Status**: ⚠️ Session queries slow; table scan instead of index

**Problem**:
```prisma
model Session {
  id              String    @id @default(cuid())
  userId          String
  sessionToken    String    // ❌ No index
  // ...
}
```

Session lookups by token do full table scan.

**Fix Approach**:
1. Add unique index on sessionToken

**Code Change**:
```prisma
model Session {
  id              String    @id @default(cuid())
  userId          String
  sessionToken    String    @unique  // Add index
  isValid         Boolean   @default(true)
  // ...
}
```

**Acceptance Criteria**:
- [ ] Index created on Session.sessionToken
- [ ] Session lookups use index
- [ ] Query performance improved

**Depends On**: None (Independent)

---

### **MEDIUM #10: Type Safety Issues - Multiple `any` Types**
**From**: Phase 1 Debug Report, BUG #20, #21, #22  
**Severity**: 🟡 MEDIUM  
**File**: Multiple files with `any[]` return types  
**Effort**: Medium (8-10 hours)  
**Status**: ⚠️ Type safety lost

**Problems**:
- `getExportHistoryAction()`: returns `any[]`
- `BulkValueEditor`: uses `any[]` for benefits
- `CardFiltersPanel`: uses `any[]` for savedFilters
- `calculateColumnWidth`: parameter is `any[]`

**Fix Approach**:
1. Define proper types for each function
2. Replace all `any` with specific types
3. Update tests accordingly

**Acceptance Criteria**:
- [ ] No `any` types in exports
- [ ] All functions have specific return types
- [ ] Type checking catches more errors
- [ ] IDE autocomplete works properly

**Depends On**: None (Independent)

---

### **MEDIUM #11: Inconsistent Error Handling in Login Page**
**From**: Phase 1 Debug Report, BUG #23  
**Severity**: 🟡 MEDIUM  
**File**: `src/app/(auth)/login/page.tsx` (line 80)  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ Generic error logs; hard to debug

**Problem**:
```typescript
catch (error) {
  setMessage('An error occurred. Please try again.');
  console.error(error);  // Generic - doesn't show details
}
```

Errors not properly logged; difficult to debug issues.

**Fix Approach**:
1. Log error details explicitly
2. Distinguish different error types
3. Provide specific error messages

**Code Change**:
```typescript
catch (error) {
  console.error('[Login Error]', {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
  
  const errorMsg = error instanceof AppError 
    ? error.message 
    : 'An error occurred. Please try again.';
  
  setMessage(errorMsg);
}
```

**Acceptance Criteria**:
- [ ] Detailed error logging
- [ ] Specific error messages to user
- [ ] Stack traces in dev mode
- [ ] Easier debugging

**Depends On**: None (Independent)

---

### **MEDIUM #12: Console Logs Left in Production Code**
**From**: Phase 2 Debug Report, BUG #24  
**Severity**: 🟡 MEDIUM (CODE QUALITY)  
**File**: `src/app/api/auth/*`, `src/middleware.ts`  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ Debug logs in production

**Problem**:
```typescript
console.log('Session created:', sessionId);  // Should not be in production
console.error('Auth failed:', error);  // Generic logging
```

Production code has debug logs that should use proper logger.

**Requirements**:
1. Remove or replace console.log with logger
2. Use consistent logging pattern
3. Different log levels for dev/prod

**Acceptance Criteria**:
- [ ] No console.log in production builds
- [ ] Proper logger used throughout
- [ ] Configurable log levels
- [ ] No sensitive data in logs

**Depends On**: None (Independent)

---

## PHASE 2D: POLISH & PERFORMANCE (5 Low Priority Bugs)

### **LOW #1: Settings Export/Import Buttons Not Functional**
**From**: Phase 1 Debug Report, BUG #11  
**Severity**: 🟢 LOW  
**File**: `src/app/(dashboard)/settings/page.tsx` (lines 447-465)  
**Effort**: Medium (6-8 hours)  
**Status**: ⏳ UI only; no handlers

**Problem**:
```typescript
<Button>Export Data</Button>  // No onClick handler
<Button>Import Data</Button>  // No onClick handler
```

Buttons don't navigate to import/export workflows.

**Fix Approach**:
1. Add onClick handlers
2. Navigate to import/export pages or open modals

**Acceptance Criteria**:
- [ ] Export button works
- [ ] Import button works
- [ ] Data format consistent

**Depends On**: BLOCKER #1 (import working)

---

### **LOW #2: Settings Delete Account Not Functional**
**From**: Phase 1 Debug Report, BUG #12  
**Severity**: 🟢 LOW  
**File**: `src/app/(dashboard)/settings/page.tsx` (line 494-497)  
**Effort**: Medium (6-8 hours)  
**Status**: ⏳ No handler; dangerous if incomplete

**Problem**:
```typescript
<Button>Delete Account</Button>  // No handler or confirmation
```

Delete button does nothing; no confirmation dialog; dangerous if broken.

**Requirements**:
1. Add confirmation modal
2. Clear all user data (cards, benefits, sessions)
3. Mark user as deleted or remove completely
4. Handle cascading deletions

**Acceptance Criteria**:
- [ ] Confirmation required for deletion
- [ ] User data completely removed
- [ ] No orphaned records remain
- [ ] User can't recover account

**Depends On**: None (Independent)

---

### **LOW #3: Icon Component Warning for Missing Icons**
**From**: Phase 1 Debug Report, BUG #18  
**Severity**: 🟢 LOW  
**File**: `src/components/ui/Icon.tsx`  
**Effort**: Small (1-2 hours)  
**Status**: ⚠️ Console warnings

**Problem**:
```typescript
console.warn(`Icon "${name}" not found in lucide-react`);
```

Missing icons cause warnings; some icons may not render.

**Fix Approach**:
1. Audit all icon names used in application
2. Ensure all names exist in lucide-react
3. Replace missing icons with fallback

**Acceptance Criteria**:
- [ ] All icon names valid
- [ ] No console warnings
- [ ] All icons render properly

**Depends On**: None (Independent)

---

### **LOW #4: Error Messages Leak Implementation Details**
**From**: Phase 2 Debug Report, BUG #25  
**Severity**: 🟢 LOW (SECURITY)  
**File**: Multiple API routes  
**Effort**: Small (3-4 hours)  
**Status**: ⚠️ Information disclosure

**Problem**:
```typescript
// Error messages expose implementation details
"Error: Field 'userCard.status' not found in schema"  // Too specific
```

Error messages reveal database structure and implementation.

**Fix Approach**:
1. Generic error messages for users
2. Detailed errors only in logs
3. No schema/database details in responses

**Acceptance Criteria**:
- [ ] User-facing errors are generic
- [ ] No database schema exposed
- [ ] No implementation details leaked
- [ ] Detailed logs for debugging

**Depends On**: None (Independent)

---

### **LOW #5: Modal Cleanup Not Implemented**
**From**: Phase 2 Debug Report, BUG #27  
**Severity**: 🟢 LOW (MEMORY LEAK)  
**File**: `src/components/ui/Modal.tsx`  
**Effort**: Small (2-3 hours)  
**Status**: ⚠️ Event listeners not cleaned up

**Problem**:
```typescript
// Modal doesn't cleanup event listeners on close/unmount
// Can cause memory leaks with many modals
```

Event listeners persist after modal closes.

**Fix Approach**:
1. Add useEffect cleanup
2. Remove event listeners on unmount

**Code Change**:
```typescript
useEffect(() => {
  const handleEscapeKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose?.();
  };
  
  if (isOpen) {
    document.addEventListener('keydown', handleEscapeKey);
  }
  
  return () => {
    document.removeEventListener('keydown', handleEscapeKey);
  };
}, [isOpen, onClose]);
```

**Acceptance Criteria**:
- [ ] Event listeners properly cleaned up
- [ ] No memory leaks
- [ ] Modal behavior unchanged

**Depends On**: None (Independent)

---

## DEPENDENCY MAP

```
CRITICAL PATH (Must complete in order):
1. BLOCKER #1 (Import Validator)
   ├─ BLOCKER #5 (Import TX Status)
   ├─ HIGH #14 (Duplicate Benefits)
   └─ MEDIUM #2 (Error Accumulation)

2. BLOCKER #2 (Session Token Race)
   └─ BLOCKER #3 (Logout Security)

3. BLOCKER #4 (Bulk Update TX)
   └─ BLOCKER #6 (Available Cards API)
      └─ BLOCKER #7 (Dashboard Data)
         ├─ BLOCKER #9 (CardDetailPanel)
         ├─ HIGH #1 (CardFiltersPanel)
         └─ MEDIUM #13 (Wallet Stats)

4. BLOCKER #8 (Settings Profile)
   ├─ BLOCKER #10 (Password Change)
   └─ LOW #1 (Export/Import)

INDEPENDENT BLOCKS:
- HIGH #2 (toggleBenefit Race)
- HIGH #3 (Early Auth Check)
- HIGH #4 (useAuth Infinite Loop)
- HIGH #5 (useROIValue Stale)
- HIGH #6 (EditableValueField Timeout)
- HIGH #7 (Value History)
- HIGH #8 (Past Renewal Dates)
- HIGH #9 (Cron Archive Check)
- HIGH #10 (Zero-Fee ROI)
- HIGH #11 (Session Cleanup)
- HIGH #12 (Duplicate Routes)
- MEDIUM tasks
- LOW tasks

PARALLEL TRACKS:
- Track A: BLOCKER #1 → #5 → #6 → #7 → #9
- Track B: BLOCKER #2 → #3
- Track C: BLOCKER #4 (independent once TX pattern established)
- Track D: BLOCKER #8 → #10
- Track E: All HIGH and MEDIUM independent tasks
```

---

## EFFORT ESTIMATION TABLE

### Phase 2A: Critical (60-80 hours, 7.5-10 days)

| ID | Bug | Effort | Dev Days | Notes |
|---|---|---|---|---|
| B1 | Import Validator | 8-12h | 1-1.5 | Straightforward type fix |
| B2 | Session Token Race | 6-10h | 0.75-1.25 | Needs careful transaction handling |
| B3 | Logout Security | 3-4h | 0.4-0.5 | High criticality, small fix |
| B4 | Bulk Update TX | 8-10h | 1-1.25 | Requires pre-validation pattern |
| B5 | Import TX Status | 4-6h | 0.5-0.75 | Move update inside TX |
| B6 | Available Cards API | 10-12h | 1.25-1.5 | Endpoint + query + modal integration |
| B7 | Dashboard Real Data | 8-10h | 1-1.25 | useEffect + loading states |
| B8 | Settings Profile | 10-12h | 1.25-1.5 | Endpoint + validation + persistence |
| B9 | CardDetailPanel + BulkActionBar | 20-25h | 2.5-3.1 | Two complex components |
| B10 | Password Change | 8-10h | 1-1.25 | Security-critical endpoint |
| **TOTAL** | | **85-111h** | **10.6-13.9 days** | **2 weeks effort** |

### Phase 2B: High Priority (80-100 hours, 10-12.5 days)

| ID | Bug | Effort | Dev Days | Notes |
|---|---|---|---|---|
| H1 | CardFiltersPanel | 12-15h | 1.5-1.9 | Multiple filter types |
| H2 | toggleBenefit Race | 8-10h | 1-1.25 | Version control pattern |
| H3 | Early Auth Check | 4-6h | 0.5-0.75 | Quick security fix |
| H4 | useAuth Loop | 2-4h | 0.25-0.5 | Memoization fix |
| H5 | useROIValue Stale | 3-5h | 0.4-0.6 | Clear state on change |
| H6 | EditableValueField Timeout | 2-3h | 0.25-0.4 | useEffect cleanup |
| H7 | Value History | 10-12h | 1.25-1.5 | Schema + UI |
| H8 | (Duplicate of B3) | — | — | Already in Phase 2A |
| H9 | Renewal Date Logic | 3-4h | 0.4-0.5 | Skip calc for archived |
| H10 | Cron Archive Check | 2-3h | 0.25-0.4 | Add status filter |
| H11 | Zero-Fee ROI | 2-3h | 0.25-0.4 | Return Infinity |
| H12 | Session Cleanup | 6-8h | 0.75-1 | Cron job implementation |
| H13 | Wallet Stats | 2-3h | 0.25-0.4 | Fix calculation |
| H14 | Duplicate Benefits | 6-8h | 0.75-1 | Validation logic |
| H15 | Import Validator Tests | 3-4h | 0.4-0.5 | Part of B1 |
| **TOTAL** | | **88-111h** | **11-13.9 days** | **2-3 weeks effort** |

### Phase 2C: Medium (25-30 hours, 3-4 days)

| ID | Bug | Effort | Dev Days | Notes |
|---|---|---|---|---|
| M1 | Test Environment DOM | 3-5h | 0.4-0.6 | Vitest config |
| M2 | Error Accumulation | 2-3h | 0.25-0.4 | Validator loop logic |
| M3 | Duplicate Routes | 1-2h | 0.1-0.25 | Find and remove |
| M4 | DST Handling | 2-3h | 0.25-0.4 | Date utility fix |
| M5 | Case-Sensitive Search | 2-3h | 0.25-0.4 | Database query fix |
| M6 | Network Error Handling | 5-7h | 0.6-0.9 | Retry logic |
| M7 | Stale Declared Values | 2-3h | 0.25-0.4 | Calculation logic |
| M8 | Import Job Status Atomic | 2-3h | 0.25-0.4 | Transaction fix |
| M9 | Session Token Index | 1-2h | 0.1-0.25 | Schema migration |
| M10 | Type Safety (any types) | 8-10h | 1-1.25 | Type definitions |
| M11 | Error Logging | 2-3h | 0.25-0.4 | Logger integration |
| M12 | Console.log Cleanup | 2-3h | 0.25-0.4 | Code review |
| **TOTAL** | | **32-45h** | **4-5.6 days** | **1 week effort** |

### Phase 2D: Low (15-20 hours, 2-2.5 days)

| ID | Bug | Effort | Dev Days | Notes |
|---|---|---|---|---|
| L1 | Export/Import Buttons | 6-8h | 0.75-1 | Handler implementation |
| L2 | Delete Account | 6-8h | 0.75-1 | Modal + cascading deletes |
| L3 | Missing Icons | 1-2h | 0.1-0.25 | Icon audit |
| L4 | Error Message Details | 3-4h | 0.4-0.5 | Error wrapper |
| L5 | Modal Cleanup | 2-3h | 0.25-0.4 | useEffect fix |
| **TOTAL** | | **18-25h** | **2.25-3.15 days** | **<1 week** |

### OVERALL PROJECT ESTIMATE

| Phase | Hours | Dev Days | Calendar Weeks | Parallel Dev |
|---|---|---|---|---|
| 2A (Critical) | 85-111 | 10.6-13.9 | 2 weeks | 2-3 developers |
| 2B (High) | 88-111 | 11-13.9 | 2-3 weeks | 2-3 developers |
| 2C (Medium) | 32-45 | 4-5.6 | 1 week | 1-2 developers |
| 2D (Low) | 18-25 | 2.25-3.15 | 0.5 week | 1 developer |
| **TOTAL** | **223-292h** | **28-37 days** | **4-5 weeks** | **2-3 devs** |

---

## REMEDIATION STRATEGY

### Week 1: Critical Path (Phase 2A, ~20 hours)

**Days 1-2: High-Impact Security & Auth**
- [ ] Fix BLOCKER #2 (Session Token Race) - **6-10h**
- [ ] Fix BLOCKER #3 (Logout Security) - **3-4h**
- **Parallel**: Fix HIGH #3 (Early Auth Check) - **4-6h**

*Impact*: Auth system becomes reliable; security vulnerability closed

**Days 3-5: Import Pipeline**
- [ ] Fix BLOCKER #1 (Import Validator) - **8-12h**
- [ ] Fix BLOCKER #5 (Import TX Status) - **4-6h**
- [ ] Fix HIGH #14 (Duplicate Benefits) - **6-8h**

*Impact*: Import feature fully functional

### Week 2: Data Integrity & Core MVP (Phase 2A, ~30 hours)

**Days 6-8: Card Management API**
- [ ] Fix BLOCKER #6 (Available Cards API) - **10-12h**
- [ ] Fix BLOCKER #4 (Bulk Update TX) - **8-10h**
- **Parallel**: Fix HIGH #1 (CardFiltersPanel) - **12-15h**

*Impact*: Users can add cards; bulk operations work reliably

**Days 9-10: Settings & Dashboard**
- [ ] Fix BLOCKER #7 (Dashboard Real Data) - **8-10h**
- [ ] Fix BLOCKER #8 (Settings Profile) - **10-12h**
- [ ] Fix BLOCKER #10 (Password Change) - **8-10h**

*Impact*: Users can manage profile; dashboard shows real cards

### Week 3: Quality & Performance (Phase 2B, ~25 hours)

**Days 11-12: Race Conditions & State Management**
- [ ] Fix HIGH #2 (toggleBenefit Race) - **8-10h**
- [ ] Fix HIGH #5 (useROIValue Stale) - **3-5h**
- [ ] Fix HIGH #4 (useAuth Loop) - **2-4h**

*Impact*: No more race conditions; smooth UX

**Days 13-15: Data Correctness**
- [ ] Fix HIGH #11 (Wallet Stats ROI) - **2-3h**
- [ ] Fix HIGH #10 (Zero-Fee ROI) - **2-3h**
- [ ] Fix HIGH #9 (Cron Archive Check) - **2-3h**
- [ ] Fix HIGH #7 (Value History) - **10-12h**

*Impact*: Calculations accurate; historical tracking works

### Week 4: Polish & Completion (Phase 2C-2D, ~20 hours)

**Days 16-18: Remaining High Priority**
- [ ] Fix HIGH #12 (Session Cleanup) - **6-8h**
- [ ] Fix HIGH #6 (EditableValueField Timeout) - **2-3h**
- [ ] Fix HIGH #8 (Past Renewal Dates) - **3-4h**
- **Parallel**: Medium priority tasks - **10-15h**

**Days 19-20: Testing & Documentation**
- [ ] BLOCKER #9 (CardDetailPanel + BulkActionBar) - **20-25h**
- [ ] Final QA & testing

*Impact*: All MVP features complete and tested

### Parallel Work Tracks

**Track A: Import & Data** (1 developer)
- BLOCKER #1 → #5 → #6 → #4
- HIGH #14 (Duplicate Benefits)

**Track B: Auth & Security** (1 developer)
- BLOCKER #2 → #3
- HIGH #3 (Early Auth)
- HIGH #2 (toggleBenefit Race)

**Track C: Dashboard & UI** (1 developer)
- BLOCKER #7 (once #6 complete)
- BLOCKER #9 (CardDetailPanel)
- HIGH #1 (CardFiltersPanel)

**Track D: Independent/Quality** (0.5 developer)
- All HIGH, MEDIUM, LOW independent bugs
- Testing environment setup

---

## QUICK WINS (Low Effort, High Value)

### Can complete in 1-2 hours each

1. **BLOCKER #3: Logout Security** (3-4h)
   - High-value security fix
   - Simple code change
   - Immediate impact

2. **HIGH #3: Early Auth Check** (4-6h)
   - Security improvement
   - Straightforward refactor
   - Best practice fix

3. **HIGH #10: Cron Archive Check** (2-3h)
   - Add status filter to query
   - Prevents business logic error
   - Low risk

4. **HIGH #11: Zero-Fee ROI** (2-3h)
   - Change return value to Infinity
   - Update UI display logic
   - Fixes comparison issue

5. **HIGH #4: useAuth Loop** (2-4h)
   - Add useMemo wrapper
   - Eliminates re-renders
   - Immediate UX improvement

6. **MEDIUM #4: DST Handling** (2-3h)
   - Use UTC dates
   - Reliable date comparison
   - Edge case fix

7. **MEDIUM #3: Duplicate Routes** (1-2h)
   - Find and remove duplicate
   - Prevents routing confusion
   - Quick win

---

## MVP READINESS CRITERIA

Before launch, ALL Phase 2A and Phase 2B bugs must be fixed.

| Criteria | Status | Phase | Priority |
|----------|--------|-------|----------|
| Authentication stable (0 race conditions) | ❌ | 2A | CRITICAL |
| Import working (validators return correct type) | ❌ | 2A | CRITICAL |
| Dashboard shows real user cards | ❌ | 2A | CRITICAL |
| Profile/password management functional | ❌ | 2A | CRITICAL |
| Card detail view works | ❌ | 2A | CRITICAL |
| Settings page saves changes | ❌ | 2A | CRITICAL |
| Available card API working | ❌ | 2A | CRITICAL |
| Bulk operations don't leave partial state | ❌ | 2A | CRITICAL |
| Card filters implemented | ❌ | 2B | HIGH |
| Session security working (logout reliable) | ❌ | 2A | CRITICAL |
| ROI calculations correct | ❌ | 2B | HIGH |
| No race conditions in benefit operations | ❌ | 2B | HIGH |
| All 140 failing tests pass | ❌ | 2B | HIGH |
| Type safety improved (less `any`) | ❌ | 2C | MEDIUM |
| Session table cleanup implemented | ❌ | 2B | HIGH |

---

## CONCLUSION

**Total MVP-blocking bugs**: 10 (Phase 2A)  
**Total high-priority bugs**: 15 (Phase 2B)  
**Total medium-priority bugs**: 12 (Phase 2C)  
**Total low-priority bugs**: 5 (Phase 2D)  

**Estimated timeline**: 4-5 weeks with 2-3 developers working in parallel  
**Critical path**: BLOCKER #2 → #3, then BLOCKER #1 → #5 → #6 → #7  

**Success metrics**:
- All Phase 2A bugs fixed before release
- 100% test pass rate
- Zero authentication failures
- Zero data consistency issues
- Real user data loading correctly
- All core MVP features fully functional

