# Phase 6: Technical Specification - Complete Index

## 📋 Documents Created

### 1. **PHASE6-COMPREHENSIVE-SPEC.md** (11 KB)
Quick reference guide with all critical information:
- Overview and critical issues
- All features to implement (P1-P7)
- What exists vs what's missing
- All 6 API endpoints summary
- 5 UI components to create
- Implementation phases (5 phases)
- Success criteria
- Key architecture patterns
- Error handling strategy
- Testing checklist
- File structure
- Next steps

**USE THIS FOR:** Quick reference during implementation

---

## 📦 Phase 6 Scope

### Critical Issues (5)
1. **Add Card button** - No submission logic
2. **Edit Card button** - No component/form/API
3. **Add Benefit button** - No component/form/API
4. **Edit Benefit button** - Console.log stub only
5. **Delete Benefit button** - Console.log stub only

### Medium Issues (3)
- Mark Used benefit has incomplete server persistence
- View toggle issues
- Form submission gaps

---

## 🎯 Implementation Priorities

### P1: CRITICAL ⚠️
- Edit Card flow (form + API + database)
- Add Benefit flow (form + API + database)
- Edit Benefit flow (form + API + database)
- Button onClick handlers wiring

### P2: MEDIUM 🟡
- Delete Benefit flow (confirmation + API)
- Delete Card flow (confirmation + API)
- Mark Used Benefit improvements (server-side)

---

## 📡 API Endpoints to Create (6 total)

### 1. Edit Card
```
PATCH /api/cards/[id]
Body: { customName?, actualAnnualFee?, renewalDate, version }
Response: 200 OK with updated card (version incremented)
Errors: 400 (validation), 409 (version conflict), 404 (not found)
```

### 2. Delete Card
```
DELETE /api/cards/[id]
Body: { confirmation: string, reason?: string }
Response: 200 OK with deletedBenefitsCount
Errors: 400 (invalid confirmation), 403 (forbidden)
```

### 3. Add Benefit
```
POST /api/benefits/add
Body: { userCardId, masterBenefitId? OR custom fields, resetCadence }
Response: 201 Created with created benefit
Errors: 400 (validation), 409 (duplicate)
```

### 4. Edit Benefit
```
PATCH /api/benefits/[id]
Body: { name?, userDeclaredValue?, resetCadence?, expirationDate?, version }
Response: 200 OK with updated benefit
Errors: 400 (validation), 409 (version conflict)
```

### 5. Delete Benefit
```
DELETE /api/benefits/[id]
Response: 200 OK with deletedBenefitId
```

### 6. Mark Used (Improve Existing)
```
PATCH /api/benefits/[id]/toggle-used
Body: { isUsed: boolean }
Response: 200 OK with updated benefit
Side effect: timesUsed incremented when isUsed=true
```

---

## 🧩 UI Components to Create (5 total)

### 1. EditCardModal
- File: `src/components/card-management/EditCardModal.tsx`
- Fields: customName, actualAnnualFee, renewalDate
- Features: Pre-filled, validation, optimistic locking, version handling

### 2. AddBenefitModal
- File: `src/components/card-management/AddBenefitModal.tsx`
- Two tabs: "From Catalog" and "Custom"
- Catalog: Browse master benefits, mark as "Already added"
- Custom: Name, type, value, cadence, expiration

### 3. EditBenefitModal
- File: `src/components/card-management/EditBenefitModal.tsx`
- Editable: Name, userDeclaredValue, resetCadence, expirationDate
- Read-only: Type, stickerValue
- Features: Unique name validation, version tracking

### 4. DeleteBenefitConfirmation
- File: `src/components/card-management/DeleteBenefitConfirmation.tsx`
- Simple confirmation dialog
- Shows benefit name
- Warning styling, destructive Delete button

### 5. DeleteCardConfirmation
- File: `src/components/card-management/DeleteCardConfirmation.tsx`
- Requires typed confirmation (card name exact match)
- Shows benefit count
- Delete button disabled until match

---

## 🔄 Implementation Phases

### Phase 1: API Endpoints (2-3 days)
- [ ] PATCH /api/cards/[id]
- [ ] DELETE /api/cards/[id]
- [ ] POST /api/benefits/add
- [ ] PATCH /api/benefits/[id]
- [ ] DELETE /api/benefits/[id]
- [ ] PATCH /api/benefits/[id]/toggle-used (enhance)

**Acceptance:** All endpoints tested, return correct responses

### Phase 2: Modal Components (3-4 days)
- [ ] EditCardModal
- [ ] AddBenefitModal
- [ ] EditBenefitModal
- [ ] DeleteBenefitConfirmation
- [ ] DeleteCardConfirmation
- [ ] Improve AddCardModal (from stub)

**Acceptance:** All modals render, validate, submit data

### Phase 3: Button Wiring (1-2 days)
- [ ] Wire CardTile menu actions
- [ ] Wire CardRow action buttons
- [ ] Wire CardDetailPanel benefit actions
- [ ] Set up modal state management

**Acceptance:** All buttons trigger correct modals, pass card/benefit context

### Phase 4: Integration & Testing (1-2 days)
- [ ] E2E flow testing (complete workflows)
- [ ] Error scenario testing (validation, timeouts, etc.)
- [ ] Accessibility testing (keyboard, screen reader)

**Acceptance:** All test cases pass, no console errors

### Phase 5: Polish & Optimization (1 day)
- [ ] Performance tuning (debouncing, memoization)
- [ ] Dark mode verification
- [ ] Mobile responsiveness check

**Acceptance:** All looks good, performs well

---

## 📊 What Exists vs What's Missing

### ✅ Exists
- CardTile.tsx (grid view with dropdown)
- CardRow.tsx (list view with actions)
- CardDetailPanel.tsx (side panel)
- AddCardModal.tsx (stub, needs work)
- POST /api/cards/add (working)
- GET /api/cards/my-cards (working)
- Prisma schema (complete)
- Type definitions (complete)

### ❌ Missing
- EditCardModal component
- PATCH /api/cards/[id] endpoint
- AddBenefitModal component
- POST /api/benefits/add endpoint
- EditBenefitModal component
- PATCH /api/benefits/[id] endpoint
- DeleteBenefitConfirmation component
- DELETE /api/benefits/[id] endpoint
- DeleteCardConfirmation component
- DELETE /api/cards/[id] endpoint
- Button onClick handlers (wiring)
- Improve /api/benefits/[id]/toggle-used

---

## 🏗️ Architecture Patterns

### Optimistic Locking
- Every card/benefit has `version` field
- Client sends version with PATCH requests
- Server checks version before updating
- Returns 409 Conflict if mismatch
- Client shows "edited elsewhere" message

### Soft Deletes
- Never hard delete from database
- Mark status as 'DELETED' or 'ARCHIVED'
- Preserve history for audits
- Enable future restore functionality

### Component Pattern (Radix UI)
- Use Dialog, DialogContent, DialogHeader
- State: form data, loading, errors, touched fields
- Error handling: try/catch with specific status codes
- Toast notifications for feedback
- Dark mode support (Tailwind)
- Keyboard support (Escape to close)

---

## ✅ Success Criteria (All Must Pass)

**Functionality:**
- [x] All 6 API endpoints implemented
- [x] All 5 modal components created
- [x] All button handlers wired
- [x] Data persists to database
- [x] Card list refreshes after changes

**Validation:**
- [x] Client-side validation prevents invalid submissions
- [x] Server-side validation enforces constraints
- [x] Duplicate benefit names prevented
- [x] Authorization checked on all endpoints

**Error Handling:**
- [x] Network errors show user-friendly messages
- [x] Timeout errors with retry option
- [x] Version conflicts handled gracefully
- [x] Form data preserved for recovery

**User Experience:**
- [x] Loading states disable buttons
- [x] Toast notifications for feedback
- [x] Dark mode styling complete
- [x] Mobile-responsive layout
- [x] Keyboard navigation works

**Code Quality:**
- [x] TypeScript strict mode
- [x] Zero TypeScript errors
- [x] Follows project patterns
- [x] Comprehensive error handling
- [x] No console.log stubs

**Testing:**
- [x] All unit tests pass
- [x] All integration tests pass
- [x] All E2E flows work
- [x] Edge cases handled
- [x] Accessibility verified

---

## 📝 Component Pattern Reference

All new modals should follow this pattern (see AddCardModal):

```typescript
'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  card: CardDisplayModel | null;
  onClose: () => void;
  onSuccess: (data: any) => void;
}

export function YourModal({ isOpen, card, onClose, onSuccess }: Props) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/endpoint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* payload */ }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409) {
          setError('Item was modified elsewhere');
        } else if (data.error?.details) {
          setFieldErrors(/* field errors */);
        } else {
          setError(data.error?.message || 'An error occurred');
        }
        return;
      }

      const { data } = await response.json();
      onSuccess(data);
      toast({ title: 'Success', description: 'Changes saved' });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Form fields with validation display */}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🧪 Manual Testing Checklist

### Edit Card Flow
- [ ] Open edit modal
- [ ] Pre-filled values show correctly
- [ ] Can edit all fields
- [ ] Validation errors display
- [ ] Submit button disabled during loading
- [ ] Success toast appears
- [ ] Card list updates
- [ ] Can retry after error

### Add Benefit Flow
- [ ] Open add modal
- [ ] Master catalog tab shows benefits
- [ ] Can select from catalog
- [ ] Custom tab has all fields
- [ ] Can create custom benefit
- [ ] Duplicate prevention works
- [ ] Success toast appears
- [ ] Benefits list updates

### Edit Benefit Flow
- [ ] Open edit modal
- [ ] Pre-filled values show correctly
- [ ] Can edit editable fields
- [ ] Read-only fields protected
- [ ] Unique name validation works
- [ ] Success toast appears
- [ ] Benefit updates in list

### Delete Benefit Flow
- [ ] Confirmation dialog appears
- [ ] Shows benefit name
- [ ] Clicking Delete removes benefit
- [ ] Toast confirms deletion
- [ ] Benefit list updates

### Delete Card Flow
- [ ] Confirmation dialog appears
- [ ] Shows card name and benefit count
- [ ] Delete button disabled until confirmation typed
- [ ] Case-insensitive matching
- [ ] Clicking Delete removes card
- [ ] Toast shows count
- [ ] Card list updates

### Mark as Used
- [ ] Toggle switch works
- [ ] Immediate UI update
- [ ] Server update succeeds
- [ ] Error rolls back toggle

### Error Scenarios
- [ ] Version conflict shows message
- [ ] Network error shows message
- [ ] Timeout shows message
- [ ] Invalid data shows field errors
- [ ] Duplicate benefit shows message

### Browser & Device
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] iPhone (mobile)
- [ ] iPad (tablet)
- [ ] Dark mode appearance
- [ ] Keyboard navigation

---

## 🚀 Quick Start

1. **Read this index** ✓ (you are here)
2. **Read PHASE6-COMPREHENSIVE-SPEC.md** - Full details
3. **Review AddCardModal.tsx** - Component pattern template
4. **Start Phase 1:** Implement 6 API endpoints
5. **Continue Phase 2:** Create 5 modal components
6. **Wire Phase 3:** Connect button handlers
7. **Test Phase 4:** E2E flows and edge cases
8. **Polish Phase 5:** Performance and styling
9. **Verify:** All success criteria pass

---

## 📞 Support

**Questions about specification?**
- Check component pattern guide
- Check user flows section
- Check API endpoint specs
- Check edge cases section

**Implementation blocked?**
- Review AddCardModal pattern
- Check existing API routes for reference
- Check type definitions in card-management.ts
- Review error handling patterns

**Testing issues?**
- See manual testing checklist
- See edge case handling strategies
- See error response patterns

---

**Document Status:** ✅ READY FOR IMPLEMENTATION  
**Last Updated:** 2024  
**Target Duration:** 5-7 days  
**Success Metric:** All workflows functional, zero stubs, all tests pass
