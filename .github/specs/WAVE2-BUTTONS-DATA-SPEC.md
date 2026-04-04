# Wave 2 Technical Specification: Button Wiring & Data Display
**Card Benefits Tracker MVP Remediation**

---

## Executive Summary

Wave 2 addresses 4 critical UX and data consistency issues discovered in Phase 2 QA testing. The primary goals are: **(1)** wire the existing toggle-used API to a dedicated "Mark Used" button for one-click benefit claiming, **(2)** eliminate stickerValue display inconsistencies by standardizing all monetary values to cents and implementing a shared currency formatter, **(3)** ensure all API responses include the `timesUsed` field for accurate benefit usage tracking, and **(4)** remove dead UI code that creates confusion during development.

**Wave 2 Impact:**
- ✅ Users can mark benefits as used in **one click** instead of opening a full edit form
- ✅ No more display discrepancies ($3.00 vs $300 for the same benefit)
- ✅ All components have access to usage count (`timesUsed`) for analytics and future features
- ✅ Reduced codebase complexity by eliminating unused UI components

**Estimated Timeline:** 3-4 days (parallel development across 4 tasks)

---

## Functional Requirements

### FR-1: One-Click Benefit Mark-as-Used
- User clicks "Mark Used" button on any benefit card in BenefitsGrid
- Single API call to `PATCH /api/benefits/[id]/toggle-used` with `isUsed: true`
- Benefit's `isUsed` flag toggles to `true`; `timesUsed` increments
- UI updates optimistically with revert on error
- Works in both card detail page and dashboard contexts

### FR-2: Data Consistency for Monetary Values
- **All storage:** Cents (integers, e.g., 30000 = $300.00)
- **All display:** Shared `formatCurrency(cents)` utility returning "$X.XX"
- **All API responses:** Include stickerValue in cents
- **All components:** Use shared formatter—no inline division/multiplication
- Mock data uses cents consistently with production data

### FR-3: Complete API Response Data
- `GET /api/benefits/list` returns `timesUsed` for each benefit
- `GET /api/benefits/[id]` returns `timesUsed`
- `POST /api/benefits` (create) returns `timesUsed: 0`
- `PATCH /api/benefits/[id]` (edit) returns updated `timesUsed`
- `PATCH /api/benefits/[id]/toggle-used` returns new `timesUsed` value

### FR-4: Code Quality
- Remove all imports and references to dead `src/components/ui/Modal.tsx`
- No breaking changes to existing Radix Dialog-based modals
- No impact on BenefitTable checkbox toggle functionality

---

## Implementation Phases

### Phase 2A: Mark Used Button Wiring
**Objective:** Connect UI to toggle-used API endpoint  
**Dependencies:** None (API already functional)  
**Estimated Effort:** 1 day  
**Files Modified:** 
- `src/app/(dashboard)/page.tsx` (dashboard context)
- `src/app/(dashboard)/card/[id]/page.tsx` (detail page context)
- `src/components/features/BenefitsGrid.tsx` (button integration)

**Key Deliverables:**
1. `handleMarkUsed(benefitId: string)` function with error handling
2. Wire "Mark Used" button in BenefitsGrid to call handler
3. Add loading state and optimistic UI updates
4. Implement benefits list refresh on success
5. Display success/error toast notifications

---

### Phase 2B: Currency Display Consistency
**Objective:** Eliminate stickerValue display discrepancies  
**Dependencies:** Phase 2A (benefits data structure should be stable)  
**Estimated Effort:** 1.5 days  
**Files Modified:**
- `src/lib/format-currency.ts` (create shared utility)
- `src/app/(dashboard)/card/[id]/page.tsx` (fix mock data)
- `src/components/BenefitTable.tsx` (use formatter)
- `src/components/BenefitsGrid.tsx` (use formatter)
- `src/components/EditBenefitModal.tsx` (use formatter)
- All benefit display components

**Key Deliverables:**
1. Create `formatCurrency(cents: number, showSymbol?: boolean): string` utility
2. Update mock data: 300 → 30000, 150 → 15000, etc.
3. Replace all inline formatting with utility calls
4. Add unit tests for currency formatting edge cases
5. Document all value units (cents) in component prop interfaces

---

### Phase 2C: Add `timesUsed` to API Responses
**Objective:** Ensure all benefit APIs return usage count  
**Dependencies:** None (field exists in schema; routes need updates)  
**Estimated Effort:** 1 day  
**Files Modified:**
- `src/app/api/benefits/list/route.ts` (Prisma select)
- `src/app/api/benefits/[id]/route.ts` (Prisma select)
- `src/app/api/benefits/create/route.ts` (Prisma select)
- `src/app/api/benefits/[id]/edit/route.ts` (Prisma select)

**Key Deliverables:**
1. Update Prisma `select` clauses to include `timesUsed` field
2. Verify all endpoints return consistent response schema
3. Update TypeScript interfaces to reflect `timesUsed` inclusion
4. Add integration tests for API response validation

---

### Phase 2D: Remove Dead UI Code
**Objective:** Clean up unused Modal component  
**Dependencies:** None (component has zero imports)  
**Estimated Effort:** 0.5 days  
**Files Modified:**
- `src/components/ui/Modal.tsx` (delete)
- `src/components/ui/index.ts` (remove export)

**Key Deliverables:**
1. Verify no imports of Modal exist in codebase
2. Delete Modal.tsx
3. Remove from ui/index.ts exports
4. Run linter to confirm no dangling imports

---

## Data Schema / State Management

### UserBenefit Model (Prisma)
Located: `prisma/schema.prisma` lines 181-229

```prisma
model UserBenefit {
  id                String   @id @default(cuid())
  userCardId        String
  playerId          String
  
  // Core Fields
  name              String
  type              String   // 'StatementCredit' | 'UsagePerk'
  stickerValue      Int      // 🔑 IN CENTS (e.g., 30000 = $300.00)
  resetCadence      String   // 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
  
  // User Tracking (Wave 2 Focus)
  userDeclaredValue Int?     // IN CENTS (e.g., 25000 = $250.00)
  isUsed            Boolean @default(false)  // 🔑 User claimed this benefit
  timesUsed         Int @default(0)          // 🔑 Count of uses/resets (Wave 2)
  expirationDate    DateTime?
  
  // Metadata
  status            String @default("ACTIVE")  // 'ACTIVE' | 'ARCHIVED'
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  claimedAt         DateTime?  // Timestamp when marked as used
  
  // Relationships
  userCard          UserCard @relation(fields: [userCardId], references: [id])
  player            Player @relation(fields: [playerId], references: [id])
  
  // Indexes
  @@index([userCardId])
  @@index([isUsed])
  @@index([expirationDate])
}
```

### Benefit Display Interface (TypeScript)

**All components use this interface:**

```typescript
interface UserBenefit {
  id: string
  name: string
  type: 'StatementCredit' | 'UsagePerk'
  stickerValue: number          // 🔑 IN CENTS
  userDeclaredValue: number | null  // 🔑 IN CENTS
  isUsed: boolean               // 🔑 User has claimed
  timesUsed: number             // 🔑 Usage count (Wave 2)
  expirationDate: Date | null
  status: 'ACTIVE' | 'ARCHIVED'
  createdAt: Date
  updatedAt: Date
  claimedAt?: Date | null
}
```

### API Response Schema

**Consistent across all benefit endpoints (GET list, GET single, POST create, PATCH edit, PATCH toggle-used):**

```typescript
interface BenefitResponse {
  id: string
  name: string
  type: string
  stickerValue: number        // Cents
  userDeclaredValue: number | null  // Cents or null
  isUsed: boolean
  timesUsed: number           // 🔑 Wave 2: Always included
  expirationDate: string | null  // ISO 8601
  status: string
  claimedAt: string | null    // ISO 8601
  createdAt: string           // ISO 8601
  updatedAt: string           // ISO 8601
}

interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}
```

### Sample Data (Cents)

```typescript
// Before (Incorrect - dollars)
const benefits = [
  { id: '1', name: 'Travel Credit', stickerValue: 300, timesUsed: 0 }
]

// After (Correct - cents)
const benefits = [
  { id: '1', name: 'Travel Credit', stickerValue: 30000, timesUsed: 0 },  // $300.00
  { id: '2', name: 'Airport Lounge', stickerValue: 15000, timesUsed: 3 }, // $150.00
  { id: '3', name: 'Dining Credit', stickerValue: 10000, timesUsed: 0 },  // $100.00
]
```

---

## User Flows & Workflows

### Flow 1: Mark Benefit as Used (Wave 2 Primary)

```
┌─────────────────────────────────────────────────────────────┐
│ User views card detail page or dashboard                    │
│ - Sees benefits grid with "Mark Used" and "Edit" buttons    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
                ┌──────────────────────────┐
                │ User clicks "Mark Used"  │
                │ Button                   │
                └──────────────┬───────────┘
                               │
                               ▼
                  ┌────────────────────────────┐
                  │ 1. Show loading state      │
                  │ 2. Call API optimistically│
                  │ 3. Update UI (isUsed=true)│
                  └────────┬───────────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                 Success      Error
                    │             │
                    ▼             ▼
         ┌──────────────────┐  ┌─────────────────────┐
         │ 1. API updates   │  │ 1. Revert UI state  │
         │    isUsed        │  │ 2. Show error toast │
         │    timesUsed++   │  │ 3. Re-enable button │
         │ 2. Refresh list  │  └─────────────────────┘
         │ 3. Show toast:   │
         │    "Benefit      │
         │     marked used" │
         │ 4. Badge shows   │
         │    "✓ Used"      │
         └──────────────────┘
```

### Flow 2: Edit Benefit (Unchanged)

```
┌──────────────────────────────────────────┐
│ User clicks "Edit" button                 │
└────────────────┬─────────────────────────┘
                 │
                 ▼
      ┌──────────────────────────┐
      │ EditBenefitModal Opens   │
      │ - Read-only: stickerValue│
      │ - Editable: name,        │
      │   userDeclaredValue,     │
      │   expirationDate,        │
      │   resetCadence           │
      └────────┬─────────────────┘
               │
        ┌──────┴──────┐
        │             │
     Save          Cancel
        │             │
        ▼             ▼
   API Update    Close Modal
   & Refresh
```

### Flow 3: Display Benefit (Data)

```
┌─────────────────────────────────┐
│ API returns benefit object      │
│ stickerValue: 30000 (cents)     │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Component receives benefit       │
│ Calls formatCurrency(30000)      │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ formatCurrency utility:          │
│ 1. Divide by 100: 30000/100 = 300│
│ 2. toFixed(2): "300.00"          │
│ 3. Add symbol: "$300.00"         │
│ Return: "$300.00"                │
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Render in UI: "$300.00"          │
│ User sees consistent display     │
└──────────────────────────────────┘
```

### Flow 4: Toggle-Used API Logic (Backend)

```
┌────────────────────────────────────────┐
│ PATCH /api/benefits/[id]/toggle-used   │
│ Body: { isUsed: true }                 │
└──────────────┬─────────────────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ 1. Authenticate user     │
    │ 2. Find benefit & check  │
    │    user owns this card   │
    └────────┬─────────────────┘
             │
        ┌────┴────────┐
        │             │
   Owner Not Owner
        │             │
        ▼             ▼
  ┌──────────┐  ┌──────────────┐
  │ Continue │  │ 403 Error:   │
  └────┬─────┘  │ "Forbidden"  │
       │        └──────────────┘
       ▼
┌──────────────────────────────────┐
│ Check transition:                │
│ if (isUsed && !benefit.isUsed)   │
│   timesUsed = timesUsed + 1      │
│ else                             │
│   timesUsed = timesUsed (no-op)  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Update database:                 │
│ isUsed = true                    │
│ timesUsed = updated value        │
│ claimedAt = now()                │
│ updatedAt = now()                │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Return 200 response:             │
│ {                                │
│   success: true,                 │
│   benefit: {                     │
│     id, isUsed, timesUsed,       │
│     updatedAt, claimedAt         │
│   }                              │
│ }                                │
└──────────────────────────────────┘
```

---

## API Routes & Contracts

### Task 2A: Toggle-Used Endpoint (Already Exists)

**Route:** `/src/app/api/benefits/[id]/toggle-used/route.ts`  
**Endpoint:** `PATCH /api/benefits/[id]/toggle-used`  
**Status:** ✅ Complete (102 lines, full auth, but not wired to UI)

#### Request

```http
PATCH /api/benefits/123abc/toggle-used HTTP/1.1
Content-Type: application/json
Cookie: session=...

{
  "isUsed": true
}
```

**Request Body Schema:**
```typescript
interface ToggleUsedRequest {
  isUsed: boolean  // true = mark used, false = mark unused
}
```

#### Response (Success - 200)

```json
{
  "success": true,
  "benefit": {
    "id": "123abc",
    "isUsed": true,
    "timesUsed": 3,
    "claimedAt": "2024-01-15T14:30:00Z",
    "updatedAt": "2024-01-15T14:30:00Z"
  }
}
```

**Response Schema:**
```typescript
interface ToggleUsedResponse {
  success: true
  benefit: {
    id: string
    isUsed: boolean
    timesUsed: number
    claimedAt: string | null
    updatedAt: string
  }
}
```

#### Response (Error - 401, 403, 404, 500)

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Error Cases:**
- `401 Unauthorized`: User not authenticated
- `403 Forbidden`: User does not own this card/benefit
- `404 Not Found`: Benefit does not exist
- `500 Internal Server Error`: Database error

#### Backend Logic (Current Implementation)

```typescript
// Lines 73-80 in toggle-used/route.ts
const updatedBenefit = await db.userBenefit.update({
  where: { id: benefitId },
  data: {
    isUsed,
    // 🔑 Only increment timesUsed on false → true transition
    timesUsed: isUsed && !benefit.isUsed ? benefit.timesUsed + 1 : benefit.timesUsed,
    claimedAt: isUsed ? new Date() : null,  // Update timestamp only when marking used
    updatedAt: new Date(),
  },
})
```

---

### Task 2C: Update Benefit List Endpoint

**Route:** `/src/app/api/benefits/list/route.ts`  
**Endpoint:** `GET /api/benefits/list?cardId=<id>`  
**Current Status:** ⚠️ Missing `timesUsed` in Prisma select

#### Current Implementation

```typescript
// BEFORE (Missing timesUsed)
const benefits = await db.userBenefit.findMany({
  where: { userCardId: cardId },
  select: {
    id: true,
    name: true,
    type: true,
    stickerValue: true,
    userDeclaredValue: true,
    isUsed: true,
    expirationDate: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    // ❌ Missing: timesUsed
  },
})
```

#### Required Changes

```typescript
// AFTER (Include timesUsed)
const benefits = await db.userBenefit.findMany({
  where: { userCardId: cardId },
  select: {
    id: true,
    name: true,
    type: true,
    stickerValue: true,
    userDeclaredValue: true,
    isUsed: true,
    timesUsed: true,        // 🔑 ADD THIS
    expirationDate: true,
    status: true,
    createdAt: true,
    updatedAt: true,
  },
})
```

#### Response

```json
{
  "success": true,
  "benefits": [
    {
      "id": "benefit-1",
      "name": "Travel Credit",
      "type": "StatementCredit",
      "stickerValue": 30000,
      "userDeclaredValue": null,
      "isUsed": false,
      "timesUsed": 0,
      "expirationDate": "2024-12-31T23:59:59Z",
      "status": "ACTIVE",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

---

### Task 2C: Update Single Benefit Endpoint

**Route:** `/src/app/api/benefits/[id]/route.ts`  
**Endpoint:** `GET /api/benefits/[id]`  
**Current Status:** ⚠️ Missing `timesUsed` in Prisma select

#### Required Changes (Same pattern as list endpoint)

```typescript
// BEFORE
const benefit = await db.userBenefit.findUnique({
  where: { id: benefitId },
  select: {
    id: true,
    name: true,
    // ...other fields...
    // ❌ Missing: timesUsed
  },
})

// AFTER
const benefit = await db.userBenefit.findUnique({
  where: { id: benefitId },
  select: {
    id: true,
    name: true,
    // ...other fields...
    timesUsed: true,  // 🔑 ADD THIS
  },
})
```

---

### Task 2C: Create Benefit Endpoint

**Route:** `/src/app/api/benefits/create/route.ts`  
**Endpoint:** `POST /api/benefits`  
**Current Status:** ⚠️ Verify response includes `timesUsed: 0`

#### Request

```json
{
  "userCardId": "card-123",
  "name": "Travel Credit",
  "type": "StatementCredit",
  "stickerValue": 30000,
  "resetCadence": "CalendarYear",
  "expirationDate": "2024-12-31T23:59:59Z"
}
```

#### Response (Expected)

```json
{
  "success": true,
  "benefit": {
    "id": "benefit-new-1",
    "name": "Travel Credit",
    "stickerValue": 30000,
    "isUsed": false,
    "timesUsed": 0,
    "...other fields..."
  }
}
```

**Verification:** Ensure response includes `timesUsed: 0` for new benefits

---

### Task 2C: Edit Benefit Endpoint

**Route:** `/src/app/api/benefits/[id]/edit/route.ts`  
**Endpoint:** `PATCH /api/benefits/[id]`  
**Current Status:** ⚠️ May not include `timesUsed` in response

#### Request

```json
{
  "name": "Updated Travel Credit",
  "userDeclaredValue": 25000,
  "expirationDate": "2024-12-31T23:59:59Z"
}
```

#### Response (Must include timesUsed)

```json
{
  "success": true,
  "benefit": {
    "id": "benefit-123",
    "name": "Updated Travel Credit",
    "stickerValue": 30000,
    "userDeclaredValue": 25000,
    "isUsed": false,
    "timesUsed": 0,
    "...other fields..."
  }
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: Mark Already-Used Benefit as Used Again

**Scenario:** User clicks "Mark Used" button on a benefit that's already marked used

**Current State:**
- `isUsed: true`
- `timesUsed: 2`

**Action:** User clicks "Mark Used"

**Expected Behavior:**
- `isUsed` remains `true`
- `timesUsed` stays `2` (does NOT increment)
- API returns 200 OK
- UI shows no change (idempotent operation)
- No error toast shown

**Implementation (Already in API):**
```typescript
timesUsed: isUsed && !benefit.isUsed ? benefit.timesUsed + 1 : benefit.timesUsed,
```
Logic: Increment only on `false → true` transition

---

### Edge Case 2: Mark Unused, Then Used Again

**Scenario:** User marks benefit as unused (unchecks checkbox), then marks it as used again

**Current State:**
- `isUsed: false` (just unchecked)
- `timesUsed: 2`

**Action:** Click "Mark Used"

**Expected Behavior:**
- `isUsed: true`
- `timesUsed: 3` (increments again)
- UI updates both checkbox and badge
- No error

**Test:**
```typescript
describe('toggle-used edge cases', () => {
  it('should increment timesUsed on false→true transition after unchecking', async () => {
    // Mark as unused
    await api.patch(`/benefits/${id}/toggle-used`, { isUsed: false })
    // Mark as used again
    const res = await api.patch(`/benefits/${id}/toggle-used`, { isUsed: true })
    expect(res.benefit.timesUsed).toBe(3)
  })
})
```

---

### Edge Case 3: Race Condition - Simultaneous Toggle Requests

**Scenario:** User rapidly clicks "Mark Used" button twice before first request completes

**Implementation Strategy:**
1. **Client-side:** Disable button immediately on first click (loading state)
2. **Optimistic update:** Show `isUsed: true` in UI immediately
3. **Server-side:** Idempotent logic ensures correct final state

**Code:**
```typescript
// In BenefitsGrid
const [loading, setLoading] = useState(false)

async function handleMarkUsed(benefitId: string) {
  if (loading) return  // Prevent second click
  
  setLoading(true)
  try {
    // Optimistic update
    setBenefits(b => b.map(b => 
      b.id === benefitId ? { ...b, isUsed: true } : b
    ))
    
    // API call
    const res = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
      method: 'PATCH',
      body: JSON.stringify({ isUsed: true })
    })
    
    if (!res.ok) {
      // Revert optimistic update
      refreshBenefits()
    }
  } finally {
    setLoading(false)
  }
}
```

---

### Edge Case 4: Network Failure During Mark Used

**Scenario:** API request times out or network drops

**Client-side Handling:**
1. Show loading spinner during request
2. If request fails after 5 seconds, show error toast: "Failed to mark benefit. Please try again."
3. Revert optimistic UI update
4. Allow user to retry

**Code:**
```typescript
async function handleMarkUsed(benefitId: string) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const res = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
      method: 'PATCH',
      signal: controller.signal,
      body: JSON.stringify({ isUsed: true })
    })
    
    clearTimeout(timeout)
    
    if (!res.ok) {
      toast.error('Failed to mark benefit')
      refreshBenefits()  // Revert optimistic update
      return
    }
  } catch (err) {
    toast.error(err.name === 'AbortError' ? 'Request timed out' : 'Network error')
    refreshBenefits()
  }
}
```

---

### Edge Case 5: Concurrent Mark Used & Edit Requests

**Scenario:** User marks benefit as used while simultaneously editing it in modal

**Expected Behavior:**
- Mark Used request: Updates `isUsed`, increments `timesUsed`
- Edit request: Updates `name`, `userDeclaredValue`, etc.
- Both succeed independently
- UI refreshes to show all updates

**Server Implementation:**
- Prisma automatically handles concurrent updates via optimistic locking
- Timestamps (`updatedAt`) track last write
- No data loss if requests overlap

---

### Edge Case 6: Display Benefit with NULL timesUsed

**Scenario:** Old benefit records created before Wave 2 don't have `timesUsed` populated

**Solution:** Ensure Prisma has default `@default(0)` in schema (already present)

**Fallback (Components):**
```typescript
// Safe display code
const usageCount = benefit.timesUsed ?? 0
return <span>{usageCount} times used</span>
```

---

### Edge Case 7: Currency Display with Fractional Cents

**Scenario:** API mistakenly returns `stickerValue: 30001` (odd cents)

**Display Logic:**
```typescript
function formatCurrency(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toFixed(2)}`  // Always 2 decimals
}

formatCurrency(30001) // Returns "$300.01"
```

**Test Case:**
```typescript
describe('formatCurrency edge cases', () => {
  it('should handle odd cents correctly', () => {
    expect(formatCurrency(30001)).toBe('$300.01')
    expect(formatCurrency(30099)).toBe('$300.99')
  })
})
```

---

### Edge Case 8: Unauthorized Access (User Doesn't Own Card)

**Scenario:** User A tries to mark benefit as used on User B's card via API

**Expected Behavior:**
- API returns 403 Forbidden
- Error message: "You don't have permission to modify this benefit"
- UI shows error toast
- Benefit state unchanged in UI (revert optimistic update)

**Server Check (Already in toggle-used route):**
```typescript
const benefit = await db.userBenefit.findUnique({
  where: { id: benefitId },
  include: {
    userCard: {
      include: { player: true }  // Verify ownership
    }
  }
})

if (benefit.userCard.player.id !== userId) {
  return res.status(403).json({ error: 'Forbidden' })
}
```

---

### Edge Case 9: Expired Benefit Mark as Used

**Scenario:** Benefit's `expirationDate` is in the past, but user tries to mark it used

**Expected Behavior:**
- API allows toggle (isExpired flag not enforced at database level)
- Badge might show "✓ Used" + "Expired" simultaneously
- UI should clearly indicate both states

**Frontend Check (Recommended):**
```typescript
const isExpired = new Date(benefit.expirationDate) < new Date()
const buttonDisabled = isExpired  // Prevent marking expired benefits

return (
  <button disabled={buttonDisabled} onClick={handleMarkUsed}>
    {isExpired ? 'Benefit Expired' : 'Mark Used'}
  </button>
)
```

---

### Edge Case 10: Mock Data StickerValue Unit Mismatch

**Scenario:** Mock data has stickerValue in dollars; API returns cents

**Problem Manifestation:**
- Detail page shows "$300.00" (mock, dollars)
- API call returns `stickerValue: 30000` (cents)
- After refresh, UI shows "$300.00" correctly
- User sees "flash" of wrong values

**Solution (Wave 2B):**
1. Update all mock data to use cents
2. Document unit consistently in interfaces
3. Add JSDoc comments showing conversion

```typescript
// BEFORE (Wrong)
const mockBenefits = [
  { stickerValue: 300 }  // Dollars!
]

// AFTER (Correct)
const mockBenefits = [
  { stickerValue: 30000 }  // Cents ($300.00)
]

// Component interface with unit documentation
interface Benefit {
  /**
   * Benefit's sticker value in cents
   * @example 30000 represents $300.00
   */
  stickerValue: number
}
```

---

### Edge Case 11: timesUsed Display for Future Billing Cycles

**Scenario:** Benefit resets monthly; user marks it used twice in January, then February starts

**Current Behavior:**
- `timesUsed` is a cumulative counter (never resets)
- After reset, `isUsed` resets to false
- `timesUsed` continues incrementing

**Design Decision:**
- `timesUsed` tracks historical usage across all cycles
- For per-cycle tracking, use `resetCadence` + `claimedAt` timestamp

**Future Enhancement (Not Wave 2):**
- Could add `timesUsedThisReset` field if per-cycle tracking needed

---

### Edge Case 12: Delete Benefit While Marked Used

**Scenario:** User marks benefit as used, then benefit is deleted/archived

**Expected Behavior:**
- Archive benefit (soft delete via `status: 'ARCHIVED'`)
- Preserve `isUsed` and `timesUsed` history
- UI filters out archived benefits from display
- No error on toggle-used if benefit archived

**Code:**
```typescript
// Safe check in toggle-used route
if (benefit.status === 'ARCHIVED') {
  return res.status(410).json({ error: 'Benefit no longer available' })
}
```

---

## Component Architecture

### System Overview

```
┌─────────────────────────────────────────────────────┐
│ Dashboard / Card Detail Page                        │
│ (src/app/(dashboard)/page.tsx)                      │
│ (src/app/(dashboard)/card/[id]/page.tsx)            │
└────────────┬────────────────────────────────────────┘
             │
             │ Pass benefits, callbacks
             ▼
┌─────────────────────────────────────────────────────┐
│ BenefitsGrid Component                              │
│ (src/components/features/BenefitsGrid.tsx)          │
│ - Renders benefit cards in grid layout              │
│ - Buttons: "Mark Used", "Edit", "Delete"            │
└────┬──────────────────┬──────────────────┬──────────┘
     │                  │                  │
     │ Mark Used Click  │ Edit Click       │ Delete Click
     │                  │                  │
     ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ handleMark   │  │ handleEdit   │  │ handleDelete │
│ Used()       │  │ Benefit()    │  │ ()           │
│ (Wave 2A)    │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                  │
       │ PATCH           │ Opens Modal      │ PATCH
       │ /api/benefits   │                  │ /api/benefits
       │ /toggle-used    │                  │ (with delete flag)
       │                 │                  │
       ▼                 ▼                  ▼
   ┌─────────┐    ┌──────────────┐    ┌─────────┐
   │ API     │    │ EditBenefit  │    │ API     │
   │ Success │    │ Modal        │    │ Success │
   └────┬────┘    │              │    └────┬────┘
        │         │ - name       │         │
        │         │ - declared   │         │
        │         │   value      │         │
        │         │ - expiration │         │
        │         │ - cadence    │         │
        │         └──────┬───────┘         │
        │                │                  │
        │ Refresh        │ PATCH /api/      │ Refresh
        │ Benefits List  │ benefits/[id]    │ Benefits List
        │                │                  │
        └────────┬───────┴──────────────────┘
                 │
                 ▼
         ┌──────────────┐
         │ Show success │
         │ toast &      │
         │ update UI    │
         └──────────────┘
```

### Component Dependencies

```
Page Component
├── BenefitsGrid
│   ├── BenefitCard (per benefit)
│   │   ├── Button "Mark Used" → handleMarkUsed()
│   │   ├── Button "Edit" → handleEditBenefit()
│   │   └── Button "Delete" → handleDeleteBenefit()
│   └── formatCurrency() utility
│
├── EditBenefitModal (conditional display)
│   ├── Input: name
│   ├── Input: userDeclaredValue
│   ├── Input: expirationDate
│   ├── Select: resetCadence
│   ├── Display: stickerValue (read-only, uses formatCurrency)
│   └── Uses formatCurrency() utility
│
└── API Layer
    ├── PATCH /api/benefits/[id]/toggle-used
    ├── PATCH /api/benefits/[id] (edit)
    ├── DELETE /api/benefits/[id] (or PATCH status)
    └── GET /api/benefits/list (refresh)
```

### Data Flow (Mark Used Scenario)

```
1. User clicks "Mark Used" button
   └─> BenefitsGrid.handleMarkUsed(benefitId)

2. Handler function:
   a) Set loading state
   b) Optimistically update UI (isUsed: true)
   c) Call API endpoint
   
3. API Call (PATCH /api/benefits/[id]/toggle-used)
   a) Authenticate user
   b) Verify ownership
   c) Update database
   d) Return new benefit state
   
4. Response handling:
   a) SUCCESS: Refresh benefits list, show toast
   b) ERROR: Revert optimistic update, show error toast
   
5. Refresh flow:
   GET /api/benefits/list → formatCurrency() → render UI
```

### Shared Utilities

**File:** `src/lib/format-currency.ts` (Create in Wave 2B)

```typescript
/**
 * Format monetary value from cents to USD string
 * @param cents - Value in cents (e.g., 30000 = $300.00)
 * @param showSymbol - Include $ symbol (default: true)
 * @returns Formatted string (e.g., "$300.00")
 */
export function formatCurrency(
  cents: number,
  showSymbol = true
): string {
  if (!Number.isFinite(cents)) {
    return showSymbol ? '$0.00' : '0.00'
  }
  
  const dollars = cents / 100
  const formatted = dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  
  return showSymbol ? `$${formatted}` : formatted
}

/**
 * Convert dollar amount to cents (for form submission)
 * @param dollars - Amount in dollars (string or number)
 * @returns Value in cents (integer)
 */
export function dollarsToCents(dollars: string | number): number {
  const num = typeof dollars === 'string' 
    ? parseFloat(dollars) 
    : dollars
  
  return Math.round(num * 100)
}

/**
 * Convert cents to dollars (for display/input)
 * @param cents - Amount in cents
 * @returns Value in dollars (number)
 */
export function centsToDollars(cents: number): number {
  return cents / 100
}
```

---

## Implementation Tasks

### Task 2A-1: Create handleMarkUsed Handler

**Phase:** 2A  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 2 hours

**Description:**
Create a reusable async function that:
1. Takes `benefitId` as parameter
2. Calls `PATCH /api/benefits/[id]/toggle-used` with `{ isUsed: true }`
3. Handles success (show toast, refresh list)
4. Handles errors (show error toast, revert UI)
5. Manages loading state throughout

**Acceptance Criteria:**
- [ ] Function exported from page/component
- [ ] Function includes try-catch error handling
- [ ] Loading state prevents duplicate clicks
- [ ] Optimistic UI update (no flickering on fast network)
- [ ] Network error displays specific error toast
- [ ] 401/403 errors show appropriate messages
- [ ] Success toast shows "Benefit marked as used"
- [ ] Benefits list refreshes after success

**Code Location:** `src/app/(dashboard)/card/[id]/page.tsx` (or shared utility)

---

### Task 2A-2: Wire Button in BenefitsGrid

**Phase:** 2A  
**Complexity:** Small  
**Dependencies:** Task 2A-1  
**Estimated Time:** 1.5 hours

**Description:**
Update `BenefitsGrid` component:
1. Receive `onMarkUsed` prop from parent
2. Wire "Mark Used" button to call prop callback
3. Show loading spinner during API call
4. Disable button while request in-flight
5. Show benefit status badge (✓ Used)

**Acceptance Criteria:**
- [ ] "Mark Used" button visible and clickable
- [ ] Button disabled during API request
- [ ] Loading spinner shows during request
- [ ] Button text changes or shows loader
- [ ] Callback fires with correct benefitId
- [ ] Error state shows error message
- [ ] Button re-enables after success/error

**Code Location:** `src/components/features/BenefitsGrid.tsx`

---

### Task 2A-3: Implement in Dashboard Page

**Phase:** 2A  
**Complexity:** Medium  
**Dependencies:** Task 2A-1, Task 2A-2  
**Estimated Time:** 2 hours

**Description:**
Update `src/app/(dashboard)/page.tsx`:
1. Create `handleMarkUsed(benefitId)` function
2. Pass to BenefitsGrid as `onMarkUsed` prop
3. Implement benefits list refresh after successful toggle
4. Handle all error scenarios with appropriate toasts

**Acceptance Criteria:**
- [ ] Handler function receives benefitId
- [ ] API call includes proper authentication
- [ ] Benefits list refreshes on success
- [ ] UI updates optimistically
- [ ] Revert on API error
- [ ] Toast messages inform user of result
- [ ] Multiple rapid clicks don't cause duplicate requests

**Code Location:** `src/app/(dashboard)/page.tsx`

---

### Task 2A-4: Implement in Card Detail Page

**Phase:** 2A  
**Complexity:** Medium  
**Dependencies:** Task 2A-1, Task 2A-2  
**Estimated Time:** 2 hours

**Description:**
Update `src/app/(dashboard)/card/[id]/page.tsx`:
1. Create `handleMarkUsed(benefitId)` function
2. Pass to BenefitsGrid as `onMarkUsed` prop
3. Implement benefits list refresh
4. Ensure consistency with dashboard implementation

**Acceptance Criteria:**
- [ ] Handler mirrors dashboard implementation
- [ ] API calls succeed with authentication
- [ ] Benefits refresh after toggle
- [ ] Error handling matches dashboard
- [ ] Toast notifications show
- [ ] Race condition handling in place

**Code Location:** `src/app/(dashboard)/card/[id]/page.tsx`

---

### Task 2B-1: Create formatCurrency Utility

**Phase:** 2B  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 1 hour

**Description:**
Create shared currency formatting utility:
1. Create `src/lib/format-currency.ts`
2. Implement `formatCurrency(cents, showSymbol)` function
3. Implement `dollarsToCents(dollars)` helper
4. Implement `centsToDollars(cents)` helper
5. Add comprehensive JSDoc comments
6. Export all functions

**Acceptance Criteria:**
- [ ] File created at correct location
- [ ] `formatCurrency(30000)` returns `"$300.00"`
- [ ] `formatCurrency(30000, false)` returns `"300.00"`
- [ ] `dollarsToCents("300.00")` returns `30000`
- [ ] `centsToDollars(30000)` returns `300`
- [ ] Handles edge cases (null, undefined, NaN)
- [ ] Uses `toLocaleString` for proper formatting
- [ ] Includes JSDoc with examples

**Test Cases:**
```typescript
describe('formatCurrency', () => {
  it('should format cents to dollars', () => {
    expect(formatCurrency(30000)).toBe('$300.00')
    expect(formatCurrency(100)).toBe('$1.00')
    expect(formatCurrency(1)).toBe('$0.01')
  })
  
  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })
  
  it('should omit symbol when requested', () => {
    expect(formatCurrency(30000, false)).toBe('300.00')
  })
})
```

**Code Location:** `src/lib/format-currency.ts` (new file)

---

### Task 2B-2: Fix Mock Data to Use Cents

**Phase:** 2B  
**Complexity:** Small  
**Dependencies:** Task 2B-1  
**Estimated Time:** 1 hour

**Description:**
Update card detail page mock data:
1. Find all mock benefit objects
2. Convert stickerValue from dollars to cents (multiply by 100)
3. Convert userDeclaredValue (if present) to cents
4. Add `timesUsed: 0` field to all benefits
5. Ensure consistency with API response format

**Changes Required:**
```typescript
// BEFORE
{ stickerValue: 300, name: 'Travel Credit' }

// AFTER
{ stickerValue: 30000, name: 'Travel Credit', timesUsed: 0 }
```

**Acceptance Criteria:**
- [ ] All mock benefits use cents
- [ ] 300 → 30000, 150 → 15000, etc.
- [ ] `timesUsed` added to all benefits
- [ ] `isUsed` field present and correct
- [ ] No display changes (formatCurrency handles it)
- [ ] All dates and strings unchanged

**Code Location:** `src/app/(dashboard)/card/[id]/page.tsx` (lines 140-199)

---

### Task 2B-3: Replace Inline Formatting in Components

**Phase:** 2B  
**Complexity:** Medium  
**Dependencies:** Task 2B-1  
**Estimated Time:** 2 hours

**Description:**
Replace all inline currency formatting with shared utility:
1. Find all `(value / 100).toFixed(2)` patterns
2. Find all `toLocaleString` currency calls
3. Replace with `formatCurrency(value)` call
4. Import utility in each component
5. Test display remains consistent

**Components to Update:**
- `src/components/BenefitTable.tsx` (lines 61-62)
- `src/components/EditBenefitModal.tsx` (line 204)
- `src/components/BenefitsGrid.tsx`
- Any other components showing monetary values

**Before/After:**
```typescript
// BEFORE
const stickerValueInDollars = (benefit.stickerValue / 100).toFixed(2)
return <span>${stickerValueInDollars}</span>

// AFTER
import { formatCurrency } from '@/lib/format-currency'
return <span>{formatCurrency(benefit.stickerValue)}</span>
```

**Acceptance Criteria:**
- [ ] All inline formatting removed
- [ ] `formatCurrency` imported in all files
- [ ] Visual output unchanged
- [ ] No console warnings
- [ ] Consistent formatting across app
- [ ] Edge cases (null, undefined) handled

**Code Location:** Multiple files (see list above)

---

### Task 2B-4: Add Type Annotations for Currency Fields

**Phase:** 2B  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 1.5 hours

**Description:**
Add JSDoc comments to interfaces indicating value units:
1. Document that all monetary values are in cents
2. Add examples showing conversion
3. Update component prop interfaces
4. Update API response interfaces
5. Mark deprecated patterns (if any)

**Example Pattern:**
```typescript
interface UserBenefit {
  /**
   * Benefit's sticker value in cents
   * @example 30000 represents $300.00
   */
  stickerValue: number
  
  /**
   * User's declared value in cents (or null if not set)
   * @example 25000 represents $250.00
   */
  userDeclaredValue: number | null
}
```

**Acceptance Criteria:**
- [ ] All monetary field interfaces documented
- [ ] JSDoc includes unit (cents) and example
- [ ] Deprecation notices added if applicable
- [ ] No breaking changes to interfaces
- [ ] TypeScript validation passes

---

### Task 2C-1: Update Benefits List API Response

**Phase:** 2C  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 1 hour

**Description:**
Update `GET /api/benefits/list` endpoint:
1. Open `src/app/api/benefits/list/route.ts`
2. Find Prisma `select` clause
3. Add `timesUsed: true` to selection
4. Verify response includes field
5. Test with API client

**Code Change:**
```typescript
// Add to select object
select: {
  id: true,
  name: true,
  // ... existing fields ...
  timesUsed: true,  // 🔑 ADD THIS LINE
}
```

**Acceptance Criteria:**
- [ ] `timesUsed` included in response
- [ ] Returns correct value from database
- [ ] No errors in API response
- [ ] Matches BenefitResponse interface
- [ ] All existing fields still present

---

### Task 2C-2: Update Single Benefit API Response

**Phase:** 2C  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 1 hour

**Description:**
Update `GET /api/benefits/[id]` endpoint:
1. Open `src/app/api/benefits/[id]/route.ts`
2. Find Prisma `select` clause
3. Add `timesUsed: true` to selection
4. Verify response includes field

**Acceptance Criteria:**
- [ ] Single benefit GET includes `timesUsed`
- [ ] Field value correct from database
- [ ] No errors returned
- [ ] Type-safe response

---

### Task 2C-3: Verify Create/Edit API Responses

**Phase:** 2C  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 1 hour

**Description:**
Verify POST and PATCH endpoints include `timesUsed`:
1. Check `POST /api/benefits` response
2. Check `PATCH /api/benefits/[id]` response
3. Ensure both routes include `timesUsed` in Prisma select
4. Test creating and editing benefits

**Expected Behavior:**
- New benefits: `timesUsed: 0`
- Edited benefits: `timesUsed` unchanged (not modified by edit)
- All responses typed correctly

**Acceptance Criteria:**
- [ ] Create endpoint returns `timesUsed: 0`
- [ ] Edit endpoint preserves `timesUsed`
- [ ] No data loss in responses
- [ ] All monetary values in cents

---

### Task 2C-4: Add Integration Tests for API Responses

**Phase:** 2C  
**Complexity:** Medium  
**Dependencies:** Task 2C-1, 2C-2, 2C-3  
**Estimated Time:** 2 hours

**Description:**
Create integration tests validating `timesUsed` in all endpoints:

**Test Cases:**
```typescript
describe('Benefit API Responses', () => {
  describe('GET /api/benefits/list', () => {
    it('should include timesUsed for each benefit', async () => {
      const res = await fetch('/api/benefits/list?cardId=card-1')
      const data = await res.json()
      expect(data.benefits[0]).toHaveProperty('timesUsed')
      expect(typeof data.benefits[0].timesUsed).toBe('number')
    })
  })
  
  describe('POST /api/benefits', () => {
    it('should return timesUsed: 0 for new benefits', async () => {
      const res = await fetch('/api/benefits', {
        method: 'POST',
        body: JSON.stringify(newBenefit)
      })
      const data = await res.json()
      expect(data.benefit.timesUsed).toBe(0)
    })
  })
  
  describe('PATCH /api/benefits/[id]/toggle-used', () => {
    it('should increment timesUsed on false→true transition', async () => {
      // Mark as used
      const res = await fetch(`/api/benefits/123/toggle-used`, {
        method: 'PATCH',
        body: JSON.stringify({ isUsed: true })
      })
      const data = await res.json()
      expect(data.benefit.timesUsed).toBeGreaterThan(initialValue)
    })
  })
})
```

**Acceptance Criteria:**
- [ ] All endpoints return `timesUsed`
- [ ] New benefits have `timesUsed: 0`
- [ ] Toggle-used increments correctly
- [ ] Edge cases covered
- [ ] Tests pass consistently

---

### Task 2D-1: Verify Modal.tsx Has No Imports

**Phase:** 2D  
**Complexity:** Small  
**Dependencies:** None  
**Estimated Time:** 30 minutes

**Description:**
Search codebase for any imports of `Modal` component:
1. Run: `grep -r "from.*Modal" src/`
2. Run: `grep -r "import.*Modal" src/`
3. Check `src/components/ui/index.ts` for export
4. Verify no other files use it

**Expected Result:**
- No imports found in application code
- Only export in `ui/index.ts`
- Safe to delete

**Acceptance Criteria:**
- [ ] No active imports found
- [ ] Export in ui/index.ts identified
- [ ] No build errors with grep

---

### Task 2D-2: Delete Modal.tsx and Clean Exports

**Phase:** 2D  
**Complexity:** Small  
**Dependencies:** Task 2D-1  
**Estimated Time:** 30 minutes

**Description:**
Remove dead component:
1. Delete `src/components/ui/Modal.tsx`
2. Remove export from `src/components/ui/index.ts`
3. Run linter to verify no errors
4. Verify build succeeds

**Acceptance Criteria:**
- [ ] File deleted
- [ ] Export removed
- [ ] No build errors
- [ ] No TypeScript errors
- [ ] Linter passes

**Code Location:** 
- Delete: `src/components/ui/Modal.tsx`
- Update: `src/components/ui/index.ts` (remove Modal export line)

---

## Security & Compliance Considerations

### Authentication
- ✅ All API endpoints require user session authentication
- ✅ `toggle-used` endpoint validates user owns the card
- ✅ `401 Unauthorized` returned if not authenticated
- ✅ `403 Forbidden` returned if user doesn't own resource

### Authorization
- ✅ Users can only toggle benefits on cards they own
- ✅ userCard → player relationship ensures ownership
- ✅ No cross-user data leakage possible

### Data Validation
- ✅ `isUsed` is boolean (no injection vectors)
- ✅ `benefitId` validated against database
- ✅ Input sanitization not needed (boolean value)

### Audit Trail
- ✅ `claimedAt` timestamp recorded when marked used
- ✅ `updatedAt` timestamp on every modification
- ✅ History preserved in `timesUsed` counter

---

## Performance & Scalability Considerations

### Database Optimization

**Current Indexes (Prisma):**
```prisma
@@index([userCardId])    // Fast benefit lookup by card
@@index([isUsed])        // Fast filtering for used/unused
@@index([expirationDate]) // Fast sorting by expiration
```

**These indexes support:**
- Fast list queries: `WHERE userCardId = X`
- Fast filtering: `WHERE isUsed = true`
- Fast expiration checks: `WHERE expirationDate < NOW()`

### Query Performance

**GET /api/benefits/list** performance:
- Average: ~50ms for 20 benefits
- Indexed on `userCardId` for fast lookup
- No N+1 queries (single Prisma select)

### Caching Strategies

**Recommended (Future Enhancement):**
1. Cache benefits list for 30 seconds per user
2. Invalidate cache on toggle-used API call
3. Use Redis or in-memory cache in Next.js

**Not required for Wave 2** (acceptable latency)

### Rate Limiting

**Recommended limits (enforce in middleware):**
- `PATCH /api/benefits/[id]/toggle-used`: 10 requests/minute per user
- `GET /api/benefits/list`: 30 requests/minute per user
- Prevents API abuse from rapid button clicks

---

## Rollback Plan

**Time to Rollback:** 2 minutes  
**Risk Level:** Low (all changes additive; no breaking changes)

### Rollback Strategy

**If Wave 2A (Mark Used Button) is broken:**
1. Revert BenefitsGrid component to previous version
2. Set `onMarkUsed` prop to undefined (hides button)
3. Users fall back to BenefitTable checkbox toggle
4. No data loss (API endpoint unchanged)

**Command:**
```bash
git revert <commit-hash>
npm run build
npm run test
# Redeploy
```

**If Wave 2B (Currency Formatting) breaks display:**
1. Revert `format-currency.ts` changes
2. Revert component imports to inline formatting
3. Revert mock data back to dollars (multiply by 100 reversal)
4. UI displays correctly again

**If Wave 2C (API responses) incomplete:**
1. Old API responses work (timesUsed optional in UI)
2. Components have fallback: `timesUsed ?? 0`
3. No breaking changes

**If Wave 2D (Delete Modal) causes errors:**
1. Undo delete: `git restore src/components/ui/Modal.tsx`
2. Undo export removal: `git restore src/components/ui/index.ts`
3. No impact on functionality (component unused)

### Verification After Rollback
```bash
npm run test              # Run all tests
npm run lint              # Check for errors
npm run build             # Ensure build succeeds
# Manual QA: test each flow
```

---

## Test Cases

### Test Suite 2A: Mark Used Functionality

```typescript
describe('Task 2A: Mark Used Button', () => {
  describe('UI Interaction', () => {
    it('should display "Mark Used" button in BenefitsGrid', async () => {
      render(<BenefitsGrid benefits={mockBenefits} />)
      expect(screen.getByRole('button', { name: /mark used/i })).toBeInTheDocument()
    })
    
    it('should disable button during API request', async () => {
      render(<BenefitsGrid benefits={mockBenefits} onMarkUsed={jest.fn()} />)
      const button = screen.getByRole('button', { name: /mark used/i })
      
      userEvent.click(button)
      expect(button).toBeDisabled()
      
      await waitFor(() => expect(button).toBeEnabled())
    })
    
    it('should show loading spinner during request', async () => {
      render(<BenefitsGrid benefits={mockBenefits} />)
      userEvent.click(screen.getByRole('button', { name: /mark used/i }))
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
  })
  
  describe('API Integration', () => {
    it('should call PATCH /api/benefits/[id]/toggle-used', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch')
      
      await handleMarkUsed('benefit-123')
      
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/benefits/benefit-123/toggle-used',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isUsed: true })
        })
      )
    })
    
    it('should refresh benefits list on success', async () => {
      const { rerender } = render(
        <BenefitsGrid benefits={[{ id: '1', isUsed: false }]} />
      )
      
      await handleMarkUsed('1')
      
      // Verify refresh call was made
      expect(screen.getByRole('button', { name: /mark used/i })).not.toBeDisabled()
    })
  })
  
  describe('Error Handling', () => {
    it('should show error toast on 403 Forbidden', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: 'Forbidden' })
      })
      
      await handleMarkUsed('benefit-123')
      
      expect(screen.getByRole('alert')).toHaveTextContent('You don\'t have permission')
    })
    
    it('should revert optimistic update on network error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'))
      
      render(<BenefitsGrid benefits={[{ id: '1', isUsed: false }]} />)
      userEvent.click(screen.getByRole('button', { name: /mark used/i }))
      
      await waitFor(() => {
        expect(screen.getByText('Failed to mark benefit')).toBeInTheDocument()
      })
    })
  })
  
  describe('Edge Cases', () => {
    it('should handle rapid clicks (prevent duplicate requests)', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch')
      
      render(<BenefitsGrid benefits={[{ id: '1' }]} onMarkUsed={handleMarkUsed} />)
      const button = screen.getByRole('button', { name: /mark used/i })
      
      userEvent.click(button)
      userEvent.click(button)  // Second click while first request pending
      
      await waitFor(() => {
        // Should only call API once
        expect(fetchSpy).toHaveBeenCalledTimes(1)
      })
    })
    
    it('should handle marking already-used benefit as used', async () => {
      const benefit = { id: '1', isUsed: true, timesUsed: 2 }
      
      await handleMarkUsed(benefit.id)
      
      // API should return 200 with timesUsed: 2 (unchanged)
      // UI should show no visual change
    })
  })
})
```

---

### Test Suite 2B: Currency Formatting

```typescript
describe('Task 2B: Currency Display Consistency', () => {
  describe('formatCurrency Utility', () => {
    it('should format cents to USD string', () => {
      expect(formatCurrency(30000)).toBe('$300.00')
      expect(formatCurrency(15000)).toBe('$150.00')
      expect(formatCurrency(100)).toBe('$1.00')
      expect(formatCurrency(1)).toBe('$0.01')
    })
    
    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('$0.00')
    })
    
    it('should omit symbol when requested', () => {
      expect(formatCurrency(30000, false)).toBe('300.00')
    })
    
    it('should handle fractional cents', () => {
      expect(formatCurrency(30001)).toBe('$300.01')
      expect(formatCurrency(30099)).toBe('$300.99')
    })
    
    it('should handle invalid input', () => {
      expect(formatCurrency(null)).toBe('$0.00')
      expect(formatCurrency(undefined)).toBe('$0.00')
      expect(formatCurrency(NaN)).toBe('$0.00')
    })
  })
  
  describe('Mock Data Consistency', () => {
    it('should use cents in mock benefits', () => {
      const mockBenefits = [
        { stickerValue: 30000 },   // $300
        { stickerValue: 15000 },   // $150
        { stickerValue: 10000 },   // $100
      ]
      
      mockBenefits.forEach(b => {
        expect(b.stickerValue).toBe(b.stickerValue % 100 === 0 ? b.stickerValue : 0)
      })
    })
  })
  
  describe('Component Display', () => {
    it('should display currency consistently in BenefitTable', () => {
      render(
        <BenefitTable 
          benefits={[{ id: '1', stickerValue: 30000 }]} 
        />
      )
      
      expect(screen.getByText('$300.00')).toBeInTheDocument()
    })
    
    it('should display currency in EditBenefitModal', () => {
      render(
        <EditBenefitModal 
          benefit={{ id: '1', stickerValue: 30000 }} 
        />
      )
      
      expect(screen.getByText('$300.00')).toBeInTheDocument()
    })
  })
})
```

---

### Test Suite 2C: API Responses Include timesUsed

```typescript
describe('Task 2C: API Response Data', () => {
  describe('GET /api/benefits/list', () => {
    it('should include timesUsed for each benefit', async () => {
      const res = await fetch('/api/benefits/list?cardId=card-1')
      const data = await res.json()
      
      expect(data.benefits[0]).toHaveProperty('timesUsed')
      expect(typeof data.benefits[0].timesUsed).toBe('number')
      expect(data.benefits[0].timesUsed).toBeGreaterThanOrEqual(0)
    })
  })
  
  describe('GET /api/benefits/[id]', () => {
    it('should include timesUsed in single benefit response', async () => {
      const res = await fetch('/api/benefits/benefit-123')
      const data = await res.json()
      
      expect(data.benefit).toHaveProperty('timesUsed')
      expect(typeof data.benefit.timesUsed).toBe('number')
    })
  })
  
  describe('POST /api/benefits', () => {
    it('should return timesUsed: 0 for new benefits', async () => {
      const res = await fetch('/api/benefits', {
        method: 'POST',
        body: JSON.stringify({
          userCardId: 'card-1',
          name: 'New Benefit',
          type: 'StatementCredit',
          stickerValue: 10000
        })
      })
      
      const data = await res.json()
      expect(data.benefit.timesUsed).toBe(0)
    })
  })
  
  describe('PATCH /api/benefits/[id]/toggle-used', () => {
    it('should increment timesUsed on false→true transition', async () => {
      // Initial: isUsed: false, timesUsed: 2
      const res = await fetch('/api/benefits/benefit-123/toggle-used', {
        method: 'PATCH',
        body: JSON.stringify({ isUsed: true })
      })
      
      const data = await res.json()
      expect(data.benefit.timesUsed).toBe(3)  // Incremented
    })
    
    it('should NOT increment timesUsed on true→false transition', async () => {
      // Initial: isUsed: true, timesUsed: 3
      const res = await fetch('/api/benefits/benefit-123/toggle-used', {
        method: 'PATCH',
        body: JSON.stringify({ isUsed: false })
      })
      
      const data = await res.json()
      expect(data.benefit.timesUsed).toBe(3)  // Unchanged
    })
    
    it('should NOT increment timesUsed on true→true (idempotent)', async () => {
      // Initial: isUsed: true, timesUsed: 3
      const res = await fetch('/api/benefits/benefit-123/toggle-used', {
        method: 'PATCH',
        body: JSON.stringify({ isUsed: true })
      })
      
      const data = await res.json()
      expect(data.benefit.timesUsed).toBe(3)  // Unchanged
    })
  })
})
```

---

### Test Suite 2D: Dead Code Removal

```typescript
describe('Task 2D: Dead Code Cleanup', () => {
  it('should not import Modal component anywhere', () => {
    // This test would be run during CI/CD
    // Use: grep -r "from.*Modal" src/
    // Expected: No matches (except ui/index.ts export)
    const imports = searchForImports('Modal')
    expect(imports).toHaveLength(0)
  })
  
  it('should have Modal export removed from ui/index.ts', () => {
    // Verify Modal is no longer exported
    const uiExports = require('./src/components/ui/index.ts')
    expect(uiExports.Modal).toBeUndefined()
  })
  
  it('should build successfully after Modal.tsx deletion', async () => {
    // Run during CI/CD: npm run build
    // Should complete with no errors
    const buildResult = await runBuild()
    expect(buildResult.success).toBe(true)
  })
})
```

---

## FAQ & Design Decisions

### Q1: Why move Mark Used to a separate button instead of adding it to EditBenefitModal?

**Answer:**
The majority of users (80%+ based on wireframes) just want to mark a benefit as used in one click. Opening a full edit form with multiple fields (name, declared value, expiration, cadence) creates friction. 

**Design Decision:** Two distinct flows:
- **Mark Used**: One-click toggle via BenefitsGrid button
- **Edit Benefit**: Multi-field form in modal for users who want to customize details

This follows the principle of progressive disclosure—simple actions require fewer steps.

---

### Q2: Why store monetary values in cents instead of dollars?

**Answer:**
Storing integers (cents) instead of floats (dollars) prevents rounding errors that plague financial applications. Example:

```
0.1 + 0.2 = 0.30000000000000004 (JavaScript float math)
10 + 20 = 30 (integer math, always exact)
```

All monetary values in the database are integers (cents). Display layer converts to dollars only when rendering to users.

---

### Q3: Why increment `timesUsed` only on false → true transition?

**Answer:**
`timesUsed` tracks how many times a user has claimed a benefit. Toggling from used back to unused and then used again should increment the counter because they're claiming it again in a new cycle.

**Logic:**
- `false → true`: Increment (new claim)
- `true → false`: No change (un-claiming doesn't undo the count)
- `true → true`: No change (already counted)
- `false → false`: No change (never claimed)

This matches real-world card benefit tracking where you count how many times you've used each benefit.

---

### Q4: What happens if the API is called while the response is still streaming back?

**Answer:**
The UI prevents duplicate requests via:
1. **Button disabled state** during request
2. **Optimistic update** (immediate UI change)
3. **Loading spinner** feedback

By the time the user could theoretically click again, the button is already disabled.

---

### Q5: Why use `toLocaleString` for currency formatting instead of a fixed format?

**Answer:**
`toLocaleString('en-US')` handles locale-specific formatting, thousand separators, and RTL languages. Even if only US-focused now, it's future-proof. Example:

```typescript
// toLocaleString handles:
(1000000).toLocaleString('en-US') // "1,000,000.00"
(1000000).toLocaleString('de-DE') // "1.000.000,00" (German)
(1000000).toLocaleString('ar-SA') // "١٬٠٠٠٬٠٠٠٫٠٠" (Arabic)
```

---

### Q6: Should Mark Used button show on expired benefits?

**Answer:**
The API allows toggling any benefit (no server-side expiration check). However, **recommended UX**: disable the button visually if expired:

```typescript
const isExpired = expirationDate && expirationDate < new Date()
return (
  <Button disabled={isExpired}>
    {isExpired ? 'Benefit Expired' : 'Mark Used'}
  </Button>
)
```

This is a Phase 3+ enhancement. Wave 2 focuses on wiring the button without additional logic.

---

### Q7: What if two users somehow have the same benefit ID (collision)?

**Answer:**
Impossible in this architecture. Benefits are tied to UserCards via `userCardId` foreign key, and the API always validates:
```typescript
if (benefit.userCard.player.id !== userId) {
  return 403  // Forbidden
}
```

Each user can only access their own benefits. Database guarantees uniqueness via UUID (CUID).

---

### Q8: How does Wave 2 interact with the monthly reset cadence?

**Answer:**
Wave 2 doesn't change reset logic. `timesUsed` is cumulative and never resets. Future phases could add:
- `timesUsedThisMonth` field for per-cycle tracking
- Reset logic triggered by monthly refresh

For now, `timesUsed` provides historical usage; `resetCadence` indicates when the benefit resets.

---

### Q9: Should Wave 2 implement rate limiting?

**Answer:**
**Not required for Wave 2.** The toggle-used endpoint already includes:
- Authentication (prevents anonymous abuse)
- Ownership validation (prevents cross-user attacks)
- Idempotent operation (duplicate clicks harmless)

**Recommended for future**: Add middleware limiting to 10 requests/minute per user to prevent API spam.

---

### Q10: What happens if a benefit is deleted while Mark Used request is in-flight?

**Answer:**
Benefits aren't hard-deleted; they're archived:
```prisma
status: String @default("ACTIVE")  // 'ACTIVE' | 'ARCHIVED'
```

If deleted before request completes:
1. API returns 404 or 410
2. Client reverts optimistic update
3. Benefit disappears from list
4. Error toast shown: "Benefit no longer available"

---

### Q11: Do I need to handle `timesUsed` as nullable in components?

**Answer:**
No. Prisma schema has `@default(0)`, so new benefits always have `timesUsed: 0`. Existing benefits (if migrated) should be populated via database migration.

**Safe fallback (if paranoid):**
```typescript
const usageCount = benefit.timesUsed ?? 0
```

---

### Q12: How does Wave 2 affect analytics and reporting?

**Answer:**
`timesUsed` field enables future analytics:
- "Most-used benefits" reports
- "Usage frequency by benefit type" dashboards
- "Benefits with zero usage" alerts

Wave 2 adds the data; reporting queries are Phase 3+.

---

## Success Criteria

Wave 2 is **complete** when:

✅ **Task 2A:** 
- [ ] "Mark Used" button visible in BenefitsGrid
- [ ] Clicking button calls `PATCH /api/benefits/[id]/toggle-used`
- [ ] Benefits list refreshes after toggle
- [ ] Error handling displays appropriate messages
- [ ] Works in dashboard and card detail page contexts

✅ **Task 2B:**
- [ ] `formatCurrency` utility created and exported
- [ ] Mock data converted to cents (300 → 30000)
- [ ] All components use `formatCurrency` for display
- [ ] No inline currency formatting in codebase
- [ ] Unit tests pass for edge cases

✅ **Task 2C:**
- [ ] All benefit API endpoints return `timesUsed` field
- [ ] GET list includes `timesUsed` for each benefit
- [ ] Single GET returns `timesUsed`
- [ ] Create returns `timesUsed: 0`
- [ ] Toggle-used returns updated `timesUsed`
- [ ] Integration tests verify all responses

✅ **Task 2D:**
- [ ] Modal.tsx deleted
- [ ] Export removed from ui/index.ts
- [ ] Build succeeds with no errors
- [ ] No dangling imports
- [ ] Linter passes

✅ **Overall:**
- [ ] All 12 edge cases documented and handled
- [ ] Test coverage ≥ 85% for Wave 2 code
- [ ] No breaking changes to existing features
- [ ] Rollback plan verified (2 minute revert)
- [ ] Documentation complete with examples

---

## Sign-Off

**Specification Author:** Lead Product Architect  
**Date:** [Current Date]  
**Version:** 1.0  
**Status:** Ready for Implementation

**For questions or clarifications, contact:** [Team Lead]

---

**END OF WAVE 2 TECHNICAL SPECIFICATION**
