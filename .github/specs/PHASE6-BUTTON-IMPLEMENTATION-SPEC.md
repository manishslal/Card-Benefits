# Phase 6: Button Functionality & Database Integration Specification

## Executive Summary

This specification defines the implementation plan to fix all non-functional buttons in the Card Benefits Tracker application. Based on comprehensive QA audits, **8 buttons were reviewed with 5 critical and 3 medium-priority issues identified**. All issues stem from missing UI components, API endpoints, or incomplete onClick handlers.

**Timeline**: ~6-8 development hours  
**Deliverables**: 6 new modal components, 6 API endpoints, form validation, complete button integration  
**Success Criteria**: All buttons functional, data persists to database, error handling complete

---

## Part 1: Issues & Context

### Critical Issues (Must Fix)

| # | Button | Issue | Component Status | API Status | Form Status | Impact |
|---|--------|-------|------------------|------------|------------|--------|
| 1 | Add Card | No onClick handler | Modal exists | POST exists | Form exists | Users cannot add cards |
| 2 | Edit Card | No component/handler | ❌ Missing | ❌ Missing | ❌ Missing | Cannot edit card details |
| 3 | Add Benefit | No component/handler | ❌ Missing | ❌ Missing | ❌ Missing | Cannot manually add benefits |
| 4 | Edit Benefit | console.log only | ❌ Missing | ❌ Missing | ❌ Missing | Cannot edit benefit values |
| 5 | Delete Benefit | console.log only | ❌ Missing | ❌ Missing | ❌ Missing | Cannot remove benefits |

### Medium Issues

| # | Button | Issue | Severity | Status |
|---|--------|-------|----------|--------|
| 6 | Mark Used | Incomplete server persistence | MEDIUM | Partial |
| 7 | View Toggle | UI inconsistencies | MEDIUM | Partial |
| 8 | Form Submission | Validation gaps | MEDIUM | Partial |

---

## Part 2: Data Schema

### Existing Models (No Changes Needed)

**User Card Model** (`prisma/schema.prisma` lines 135-179)
```prisma
model UserCard {
  id                String   @id
  customName        String?  // User rename
  actualAnnualFee   Int?     // Override fee (cents)
  renewalDate       DateTime // Anniversary
  status            String   @default("ACTIVE")
  // ... other fields
}
```

**User Benefit Model** (`prisma/schema.prisma` lines 181-200+)
```prisma
model UserBenefit {
  id                String   @id
  userCardId        String   // FK to UserCard
  playerId          String   // FK to Player
  name              String   // Benefit name
  type              String   // 'StatementCredit' | 'UsagePerk'
  stickerValue      Int      // Original value (cents)
  resetCadence      String   // Monthly | CalendarYear | etc
  userDeclaredValue Int?     // Custom value estimate
  isUsed            Boolean  @default(false)
  timesUsed         Int      @default(0)
  expirationDate    DateTime?
  status            String   @default("ACTIVE")
  // ... other fields
}
```

**Validation Rules**:
- Card `customName`: 1-100 characters, trim whitespace
- Card `actualAnnualFee`: 0-999999 cents ($0-$9,999.99)
- Benefit `name`: 1-100 characters, cannot duplicate per card
- Benefit `userDeclaredValue`: Must be ≤ `stickerValue` if provided
- Benefit `expirationDate`: Must be in future or null

---

## Part 3: API Endpoints Specification

### 1. PATCH /api/cards/[id]

**Purpose**: Update card details (name, renewal date, annual fee)

**Request**:
```typescript
PATCH /api/cards/[id]
Content-Type: application/json
Authorization: Bearer {sessionToken}

{
  "customName"?: string,      // Optional: new card name
  "actualAnnualFee"?: number, // Optional: fee in cents
  "renewalDate"?: string      // ISO 8601 date string
}
```

**Response (200 OK)**:
```json
{
  "id": "card-123",
  "customName": "Amex Gold - Jon",
  "actualAnnualFee": 25000,
  "renewalDate": "2024-12-15T00:00:00Z",
  "status": "ACTIVE",
  "updatedAt": "2024-04-03T12:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation error
```json
{
  "error": "Validation failed",
  "details": {
    "customName": "Name exceeds 100 characters"
  }
}
```
- `401 Unauthorized`: Missing auth token
- `403 Forbidden`: Card belongs to different user
- `404 Not Found`: Card doesn't exist
- `500 Server Error`: Database error

**Implementation Location**: `src/app/api/cards/[id]/route.ts`

---

### 2. DELETE /api/cards/[id]

**Purpose**: Delete card and cascade-delete all benefits

**Request**:
```typescript
DELETE /api/cards/[id]
Authorization: Bearer {sessionToken}
```

**Response (204 No Content)**:
```
(Empty body)
```

**Pre-deletion Checks**:
- Verify card belongs to authenticated user
- Log deletion reason (user action)
- Cascade delete all UserBenefit records
- Soft-delete card (set status to "DELETED")

**Error Responses**:
- `401 Unauthorized`: Missing auth token
- `403 Forbidden`: Card belongs to different user
- `404 Not Found`: Card doesn't exist
- `500 Server Error`: Database error

**Implementation Location**: `src/app/api/cards/[id]/route.ts`

---

### 3. POST /api/benefits/add

**Purpose**: Create new benefit for a card

**Request**:
```typescript
POST /api/benefits/add
Content-Type: application/json
Authorization: Bearer {sessionToken}

{
  "userCardId": string,          // Required: which card
  "name": string,                // Required: benefit name
  "type": string,                // Required: 'StatementCredit' | 'UsagePerk'
  "stickerValue": number,        // Required: value in cents
  "resetCadence": string,        // Required: Monthly | CalendarYear | etc
  "userDeclaredValue"?: number,  // Optional: custom value
  "expirationDate"?: string      // Optional: ISO 8601 date
}
```

**Response (201 Created)**:
```json
{
  "id": "benefit-456",
  "userCardId": "card-123",
  "name": "Uber Cash",
  "type": "StatementCredit",
  "stickerValue": 20000,
  "resetCadence": "Monthly",
  "userDeclaredValue": 18000,
  "isUsed": false,
  "expirationDate": "2024-05-01T00:00:00Z",
  "createdAt": "2024-04-03T12:00:00Z"
}
```

**Validation**:
- Card must exist and belong to user
- `name` must be 1-100 chars, unique per card
- `stickerValue` must be > 0
- `userDeclaredValue` must be ≤ `stickerValue`
- `expirationDate` must be future if provided

**Error Responses**:
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing auth
- `403 Forbidden`: Card not owned by user
- `404 Not Found`: Card doesn't exist
- `500 Server Error`: Database error

**Implementation Location**: `src/app/api/benefits/add/route.ts`

---

### 4. PATCH /api/benefits/[id]

**Purpose**: Edit existing benefit

**Request**:
```typescript
PATCH /api/benefits/[id]
Content-Type: application/json
Authorization: Bearer {sessionToken}

{
  "name"?: string,
  "userDeclaredValue"?: number,
  "expirationDate"?: string,
  "resetCadence"?: string
}
```

**Response (200 OK)**:
```json
{
  "id": "benefit-456",
  "name": "Uber Cash Updated",
  "userDeclaredValue": 15000,
  "expirationDate": "2024-06-01T00:00:00Z",
  "resetCadence": "Monthly",
  "updatedAt": "2024-04-03T12:05:00Z"
}
```

**Validation**: Same as POST /api/benefits/add

**Error Responses**:
- `400 Bad Request`: Validation error
- `401 Unauthorized`: Missing auth
- `403 Forbidden`: Benefit not owned by user
- `404 Not Found`: Benefit doesn't exist
- `500 Server Error`: Database error

**Implementation Location**: `src/app/api/benefits/[id]/route.ts`

---

### 5. DELETE /api/benefits/[id]

**Purpose**: Delete a benefit with soft-delete

**Request**:
```typescript
DELETE /api/benefits/[id]
Authorization: Bearer {sessionToken}
```

**Response (204 No Content)**:
```
(Empty body)
```

**Logic**:
- Verify benefit belongs to authenticated user
- Soft-delete: set status to "ARCHIVED"
- Do NOT hard-delete for audit trail

**Error Responses**:
- `401 Unauthorized`: Missing auth
- `403 Forbidden`: Benefit not owned by user
- `404 Not Found`: Benefit doesn't exist
- `500 Server Error`: Database error

**Implementation Location**: `src/app/api/benefits/[id]/route.ts`

---

### 6. PATCH /api/benefits/[id]/toggle-used

**Purpose**: Toggle "mark as used" with server verification

**Request**:
```typescript
PATCH /api/benefits/[id]/toggle-used
Authorization: Bearer {sessionToken}

{
  "isUsed": boolean
}
```

**Response (200 OK)**:
```json
{
  "id": "benefit-456",
  "isUsed": true,
  "timesUsed": 1,
  "updatedAt": "2024-04-03T12:10:00Z"
}
```

**Logic**:
- Toggle `isUsed` boolean
- Increment `timesUsed` counter
- Return updated state to client

**Error Responses**:
- `401 Unauthorized`: Missing auth
- `403 Forbidden`: Benefit not owned by user
- `404 Not Found`: Benefit doesn't exist
- `500 Server Error`: Database error

**Implementation Location**: `src/app/api/benefits/[id]/route.ts` (or separate file)

---

## Part 4: UI Component Architecture

### New Modal Components

All modals follow the **AddCardModal pattern** (`src/components/AddCardModal.tsx`):
- Use Radix UI `Dialog` component for accessibility
- Form validation before submission
- Error state handling with field-level errors
- Optimistic UI updates
- Loading states during API calls
- Success/error messaging (toast notifications)
- Proper focus management

#### 4.1 EditCardModal

**File**: `src/components/EditCardModal.tsx`

**Props**:
```typescript
interface EditCardModalProps {
  card: UserCard;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated: (card: UserCard) => void;
}
```

**Form Fields**:
- `customName` (text input, 1-100 chars)
- `actualAnnualFee` (number input, display as currency)
- `renewalDate` (date picker)

**Implementation Pattern**:
1. Pre-fill form with current card values
2. Use React Hook Form + Zod for validation
3. On submit: call PATCH `/api/cards/[id]`
4. Optimistic update to parent state
5. Show success toast on completion
6. Close modal on success

**Accessibility**:
- Proper label associations
- ARIA error messages
- Tab order flow
- Escape key closes modal

---

#### 4.2 AddBenefitModal

**File**: `src/components/AddBenefitModal.tsx`

**Props**:
```typescript
interface AddBenefitModalProps {
  cardId: string;
  isOpen: boolean;
  onClose: () => void;
  onBenefitAdded: (benefit: UserBenefit) => void;
}
```

**Form Fields**:
- `name` (text input, 1-100 chars)
- `type` (dropdown: StatementCredit, UsagePerk)
- `stickerValue` (number input, display as currency)
- `resetCadence` (dropdown: Monthly, CalendarYear, CardmemberYear, OneTime)
- `userDeclaredValue` (optional number input)
- `expirationDate` (optional date picker)

**Validation**:
- `name`: Required, 1-100 chars, unique per card
- `type`: Required, must match enum
- `stickerValue`: Required, > 0
- `resetCadence`: Required
- `userDeclaredValue`: If provided, must be ≤ stickerValue
- `expirationDate`: If provided, must be future date

**Implementation Pattern**:
1. Empty form (no pre-fill)
2. React Hook Form + Zod validation
3. On submit: call POST `/api/benefits/add`
4. Show success toast
5. Close modal and callback

---

#### 4.3 EditBenefitModal

**File**: `src/components/EditBenefitModal.tsx`

**Props**:
```typescript
interface EditBenefitModalProps {
  benefit: UserBenefit;
  isOpen: boolean;
  onClose: () => void;
  onBenefitUpdated: (benefit: UserBenefit) => void;
}
```

**Editable Fields** (read-only fields are not shown):
- `name`
- `userDeclaredValue`
- `expirationDate`
- `resetCadence`

**Read-Only Fields** (display but don't allow edit):
- `stickerValue`
- `type`
- `resetCadence` (actually editable per schema)

**Implementation Pattern**: Same as EditCardModal but for benefits

---

#### 4.4 DeleteBenefitConfirmationDialog

**File**: `src/components/DeleteBenefitConfirmationDialog.tsx`

**Props**:
```typescript
interface DeleteBenefitConfirmationProps {
  benefit: UserBenefit;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
```

**UI Pattern**:
- Show benefit name prominently
- Confirmation text: "Are you sure? This action cannot be undone."
- Two buttons: "Cancel" (cancel) and "Delete" (destructive red)
- Show loading state during deletion

**Implementation**:
1. On confirm: call DELETE `/api/benefits/[id]`
2. Handle loading state
3. Close modal on success
4. Show error toast on failure

---

#### 4.5 DeleteCardConfirmationDialog

**File**: `src/components/DeleteCardConfirmationDialog.tsx`

**Props**:
```typescript
interface DeleteCardConfirmationProps {
  card: UserCard;
  benefitCount: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}
```

**UI Pattern**:
- Show card name prominently
- Warning: "This will delete the card AND all {benefitCount} benefits"
- Confirmation text: "Are you sure? This action cannot be undone."
- Buttons: "Cancel" and "Delete Card" (destructive)

**Implementation**: Same pattern as DeleteBenefitConfirmationDialog

---

### Button Trigger Components

#### 4.6 Edit Card Button

**Location**: `src/components/Card.tsx` or parent component

**Pattern**:
```typescript
const [editCardOpen, setEditCardOpen] = useState(false);

<Button 
  onClick={() => setEditCardOpen(true)}
  className="..."
>
  Edit
</Button>

<EditCardModal 
  card={card}
  isOpen={editCardOpen}
  onClose={() => setEditCardOpen(false)}
  onCardUpdated={handleCardUpdated}
/>
```

---

#### 4.7 Add Benefit Button

**Location**: `src/app/(dashboard)/card/[id]/page.tsx` or Card detail page

**Pattern**:
```typescript
const [addBenefitOpen, setAddBenefitOpen] = useState(false);

<Button 
  onClick={() => setAddBenefitOpen(true)}
  className="..."
>
  Add Benefit
</Button>

<AddBenefitModal 
  cardId={cardId}
  isOpen={addBenefitOpen}
  onClose={() => setAddBenefitOpen(false)}
  onBenefitAdded={handleBenefitAdded}
/>
```

---

#### 4.8 Edit/Delete Benefit Buttons

**Location**: `src/components/BenefitTable.tsx` or `BenefitsGrid.tsx`

**Pattern**:
```typescript
const [editBenefitOpen, setEditBenefitOpen] = useState(false);
const [deleteBenefitOpen, setDeleteBenefitOpen] = useState(false);
const [selectedBenefit, setSelectedBenefit] = useState(null);

<Button 
  onClick={() => {
    setSelectedBenefit(benefit);
    setEditBenefitOpen(true);
  }}
>
  Edit
</Button>

<Button 
  onClick={() => {
    setSelectedBenefit(benefit);
    setDeleteBenefitOpen(true);
  }}
  variant="destructive"
>
  Delete
</Button>

<EditBenefitModal 
  benefit={selectedBenefit}
  isOpen={editBenefitOpen}
  onClose={() => setEditBenefitOpen(false)}
  onBenefitUpdated={handleBenefitUpdated}
/>

<DeleteBenefitConfirmationDialog 
  benefit={selectedBenefit}
  isOpen={deleteBenefitOpen}
  onClose={() => setDeleteBenefitOpen(false)}
  onConfirm={handleBenefitDeleted}
/>
```

---

## Part 5: User Flows

### Flow 1: Edit Card

```
User clicks "Edit Card" button
  ↓
EditCardModal opens
  ↓
User modifies fields (name, fee, renewal date)
  ↓
Form validation (client-side)
  ↓
User clicks "Save"
  ↓
PATCH /api/cards/[id] sent
  ↓
Server validation & update
  ↓
Success response received
  ↓
UI optimistically updates
  ↓
Success toast shown
  ↓
Modal closes
```

**Error Cases**:
- Validation fails → Show field errors, don't submit
- Network error → Show error toast, keep modal open
- 403 Forbidden → Show "You don't have permission" error
- 404 Not Found → Show "Card no longer exists" error

---

### Flow 2: Add Benefit

```
User clicks "Add Benefit" button
  ↓
AddBenefitModal opens
  ↓
User fills form (name, type, value, etc.)
  ↓
Form validation
  ↓
User clicks "Add"
  ↓
POST /api/benefits/add sent
  ↓
Server validation (unique name, owned card, etc.)
  ↓
Benefit created in DB
  ↓
Success response with benefit data
  ↓
Benefits list updates optimistically
  ↓
Success toast shown
  ↓
Modal closes
```

---

### Flow 3: Edit Benefit

```
User sees benefit in list/grid
  ↓
User clicks "Edit" button on benefit
  ↓
EditBenefitModal opens with current data
  ↓
User modifies editable fields
  ↓
Form validation
  ↓
User clicks "Save"
  ↓
PATCH /api/benefits/[id] sent
  ↓
Server validates & updates
  ↓
Success response
  ↓
List updates
  ↓
Success toast shown
  ↓
Modal closes
```

---

### Flow 4: Delete Benefit

```
User clicks "Delete" button on benefit
  ↓
DeleteBenefitConfirmationDialog opens
  ↓
User sees: "Are you sure?" warning
  ↓
User clicks "Delete Benefit" (red button)
  ↓
DELETE /api/benefits/[id] sent
  ↓
Server soft-deletes (sets status: ARCHIVED)
  ↓
Response: 204 No Content
  ↓
Benefit removed from UI
  ↓
Success toast: "Benefit deleted"
  ↓
Dialog closes
```

---

### Flow 5: Mark Benefit as Used

```
User sees benefit checkbox "Mark as Used"
  ↓
User clicks checkbox
  ↓
PATCH /api/benefits/[id]/toggle-used sent (isUsed: true)
  ↓
Server updates DB
  ↓
Returns updated benefit with timesUsed incremented
  ↓
UI updates checkbox state
  ↓
No modal, instant feedback
```

---

## Part 6: Error Handling & Edge Cases

### Validation Edge Cases

| Scenario | Handling |
|----------|----------|
| User tries to add benefit with duplicate name | Server rejects with 400, show error: "Benefit name already exists" |
| User adds benefit with userDeclaredValue > stickerValue | Client-side validation prevents submission |
| User edits card with invalid annual fee (negative) | Client validation, server double-checks |
| User deletes card, then tries to add benefit | Server returns 404 "Card not found", UI shows error |
| Benefit expiration date in past | Client shows date error, server rejects |

### Network & Concurrency

| Scenario | Handling |
|----------|----------|
| Network timeout during PATCH card | Show "Network error" toast, keep modal open, allow retry |
| Two users edit same card simultaneously | Last-write-wins (simpler), or use version field (optimistic locking) |
| User deleted card via web, tries to edit from mobile | Server returns 404, show "Card no longer exists" |
| Concurrent benefit deletions | Second delete returns 404, show "Already deleted" |

### State Rollback

- If API returns error, optimistic UI update is rolled back
- Original data restored
- Error message shown to user
- User can retry

### Loading States

- Button becomes disabled during submission
- Spinner or skeleton shown in modal
- Form fields may be disabled during submit
- Cancel button always available

---

## Part 7: Implementation Sequence

### Phase 1: API Layer (2 hours)

1. **Create PATCH /api/cards/[id]**
   - Extract card ID from route
   - Validate ownership (user owns card)
   - Validate input with Zod schema
   - Update database
   - Return updated card

2. **Create DELETE /api/cards/[id]**
   - Validate ownership
   - Cascade delete benefits (or soft-delete)
   - Return 204

3. **Create POST /api/benefits/add**
   - Validate card ownership
   - Validate benefit uniqueness per card
   - Create benefit record
   - Return 201 with benefit data

4. **Create PATCH /api/benefits/[id]**
   - Similar pattern to card edit
   - Update only provided fields

5. **Create DELETE /api/benefits/[id]**
   - Soft-delete with status: ARCHIVED
   - Return 204

6. **Update PATCH /api/benefits/[id]/toggle-used**
   - Toggle isUsed and increment timesUsed
   - Return updated benefit

### Phase 2: Form Components (2.5 hours)

1. **Create EditCardModal.tsx**
   - Copy AddCardModal as template
   - Modify for card fields
   - Pre-fill with current values

2. **Create AddBenefitModal.tsx**
   - Form with all benefit fields
   - Dropdowns for type and cadence

3. **Create EditBenefitModal.tsx**
   - Similar to AddBenefitModal
   - Pre-fill with current values

4. **Create DeleteBenefitConfirmationDialog.tsx**
   - Confirmation dialog pattern
   - No form, just confirmation

5. **Create DeleteCardConfirmationDialog.tsx**
   - Confirmation dialog pattern

### Phase 3: Button Integration (1.5 hours)

1. **Wire Edit Card button**
   - Add state for modal open/close
   - Add EditCardModal to JSX
   - Connect callback

2. **Wire Add Benefit button**
   - Add state and modal
   - Connect callback to refresh list

3. **Wire Edit/Delete Benefit buttons**
   - Update BenefitTable/Grid components
   - Add state for selected benefit
   - Connect modals

4. **Update Mark Used**
   - Ensure server API is called
   - Show loading state

### Phase 4: Error Handling & Validation (1 hour)

1. **Add form validation**
   - Zod schemas for all forms
   - Client-side validation feedback

2. **Add error toasts**
   - Success toast on completion
   - Error toast on failure
   - Network error handling

3. **Add loading states**
   - Disable buttons during submit
   - Show spinners

4. **Add retry logic**
   - Allow user to retry failed operations
   - Maintain form state on error

### Phase 5: Testing & Polish (1 hour)

1. **Manual testing**
   - Test each flow end-to-end
   - Test error scenarios
   - Verify database persistence

2. **Code cleanup**
   - Remove any console.log stubs
   - Ensure code follows project patterns
   - Add comments where necessary

---

## Part 8: Component Pattern Reference

Follow **AddCardModal** pattern for all new modals:

```typescript
// src/components/EditCardModal.tsx
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';

const editCardSchema = z.object({
  customName: z.string().max(100).optional(),
  actualAnnualFee: z.number().min(0).optional(),
  renewalDate: z.string().datetime().optional(),
});

export function EditCardModal({ card, isOpen, onClose, onCardUpdated }) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const form = useForm({
    resolver: zodResolver(editCardSchema),
    defaultValues: {
      customName: card?.customName || '',
      actualAnnualFee: card?.actualAnnualFee || 0,
      renewalDate: card?.renewalDate?.split('T')[0] || '',
    },
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update card');
      }

      const updated = await response.json();
      onCardUpdated(updated);
      toast({ title: 'Card updated successfully' });
      onClose();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Card</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Form fields here */}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Part 9: Testing Strategy

### Unit Tests

```typescript
// __tests__/EditCardModal.test.tsx
describe('EditCardModal', () => {
  it('pre-fills form with card data', () => { /* ... */ });
  it('validates form input', () => { /* ... */ });
  it('submits valid data to API', () => { /* ... */ });
  it('handles API errors gracefully', () => { /* ... */ });
  it('closes on successful submission', () => { /* ... */ });
});
```

### Integration Tests

```typescript
// __tests__/card-edit-flow.integration.test.tsx
describe('Card Edit Flow', () => {
  it('user can edit card name and see update in list', async () => { /* ... */ });
  it('user cannot submit invalid form', async () => { /* ... */ });
  it('error toast shown on network failure', async () => { /* ... */ });
});
```

### Manual Testing Checklist

- [ ] Add Card button opens modal
- [ ] Edit Card button opens modal with prefilled values
- [ ] Add Benefit button opens modal
- [ ] Edit Benefit button opens modal with prefilled values
- [ ] Delete Benefit shows confirmation, then removes from list
- [ ] Mark Used toggles checkbox and persists to DB
- [ ] All error cases show proper error messages
- [ ] Dark mode works for all modals
- [ ] Mobile responsive (forms stack on small screens)
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Accessibility (screen reader compatible)

---

## Part 10: Success Criteria

### Functional Requirements

✅ **Every button has working onClick handler**
✅ **All forms submit data to API**
✅ **All data persists to database correctly**
✅ **All validation works (client + server)**
✅ **All error cases handled gracefully**
✅ **No console.log stubs remain in button handlers**
✅ **Users can CRUD (Create/Read/Update/Delete) cards and benefits**

### Code Quality Requirements

✅ **Code follows existing project patterns**
✅ **TypeScript strict mode**
✅ **Proper accessibility (ARIA labels, keyboard nav)**
✅ **Dark mode support**
✅ **Mobile responsive**
✅ **All tests pass**
✅ **Build completes with 0 errors**

### Performance Requirements

✅ **Modals load < 500ms**
✅ **API calls complete < 2 seconds**
✅ **UI responds immediately to user input**
✅ **Optimistic updates feel instant**

---

## Appendix: Dependencies & Tools

- **Forms**: React Hook Form + Zod
- **UI**: Radix UI Dialog, Shadcn/ui components
- **Styling**: Tailwind CSS
- **Async**: Native Fetch API
- **Notifications**: Toast component (existing)
- **Testing**: Vitest + React Testing Library

---

## Sign-Off

**Spec Created**: April 3, 2024  
**Status**: Ready for Implementation  
**Next Phase**: Expert React Frontend Engineer to implement all components and APIs  
**Estimated Duration**: 6-8 hours total development time
