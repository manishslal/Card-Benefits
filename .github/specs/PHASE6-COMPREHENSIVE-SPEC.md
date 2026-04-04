# Phase 6: Button Implementation & Database Integration - Technical Specification

**Document Version:** 1.0  
**Status:** READY FOR IMPLEMENTATION  
**Target Audience:** Expert React Frontend Engineer  

## Overview

This comprehensive technical specification covers the implementation of Phase 6: connecting all missing button functionality to the database. Two QA audits identified **5 CRITICAL and 3 MEDIUM issues** that must be resolved.

## Critical Issues to Resolve

1. **Add Card button** - Modal exists but no trigger/onClick handler
2. **Edit Card button** - No component, no form, no API endpoint  
3. **Add Benefit button** - No component, no form, no API endpoint
4. **Edit Benefit button** - Only console.log stub, no actual edit
5. **Delete Benefit button** - Only console.log stub, no deletion

## Key Deliverables

- ✅ 6 new API endpoints (complete CRUD for cards and benefits)
- ✅ 5 new modal/dialog components (forms with validation)
- ✅ Button onClick handlers fully wired
- ✅ Database persistence for all operations
- ✅ Comprehensive error handling & edge case coverage
- ✅ Full test coverage

## Features to Implement (Priority Order)

### P1: CRITICAL - Edit Card Flow
- Edit Card modal with form (custom name, renewal date, annual fee)
- API: `PATCH /api/cards/[id]`
- Optimistic locking (version field)
- Full validation (client + server)

### P2: CRITICAL - Add Benefit Flow
- Add Benefit modal (select from master or create custom)
- API: `POST /api/benefits/add`
- Duplicate prevention
- Toast notifications

### P3: CRITICAL - Edit Benefit Flow
- Edit Benefit modal
- API: `PATCH /api/benefits/[id]`
- Version tracking
- Atomic updates

### P4: MEDIUM - Delete Benefit Flow
- Confirmation dialog
- API: `DELETE /api/benefits/[id]`
- Soft delete (preserve history)

### P5: MEDIUM - Delete Card Flow
- Confirmation dialog with typed confirmation
- API: `DELETE /api/cards/[id]`
- Cascade delete (benefits → archived)

### P6: MEDIUM - Mark Used Improvements
- Improve `/api/benefits/[id]/toggle-used`
- Track usage count
- Server-side verification

### P7: CRITICAL - Button Wiring
- Wire all onClick handlers
- Route to correct modals
- Manage state correctly

## What Already Exists ✅

| Component | Status |
|-----------|--------|
| CardTile.tsx | ✅ Grid view with dropdown menu |
| CardRow.tsx | ✅ List view with action buttons |
| CardDetailPanel.tsx | ✅ Side panel, ready to enhance |
| AddCardModal.tsx | ⚠️ Stub - needs form integration |
| POST /api/cards/add | ✅ Working |
| GET /api/cards/my-cards | ✅ Working |
| Prisma Schema | ✅ Complete (User, Card, Benefit models) |
| Type Definitions | ✅ Complete (card-management.ts) |

## What's Missing ❌

| Feature | Task |
|---------|------|
| Edit Card Modal | Create with form & API |
| PATCH /api/cards/[id] | Implement endpoint |
| Add Benefit Modal | Create with form & API |
| POST /api/benefits/add | Implement endpoint |
| Edit Benefit Modal | Create with form & API |
| PATCH /api/benefits/[id] | Implement endpoint |
| Delete Benefit Dialog | Create confirmation & API |
| DELETE /api/benefits/[id] | Implement endpoint |
| Delete Card Dialog | Create confirmation & API |
| DELETE /api/cards/[id] | Implement endpoint |
| Mark Used Toggle | Improve existing + UI |
| Button Handlers | Wire all actions |

## API Endpoints Summary

### 1. PATCH /api/cards/[id] - Edit Card
- Update: customName, actualAnnualFee, renewalDate
- Optimistic locking with version field
- Return updated card (200 OK)
- Handle version conflicts (409 Conflict)

### 2. DELETE /api/cards/[id] - Delete Card
- Soft delete card (status = 'DELETED')
- Cascade: Archive all benefits
- Require confirmation string (card name)
- Return count of deleted benefits (200 OK)

### 3. POST /api/benefits/add - Add Benefit
- Add from master catalog OR custom
- Unique constraint: (userCardId, name)
- Return created benefit (201 Created)
- Handle duplicates (409 Conflict)

### 4. PATCH /api/benefits/[id] - Edit Benefit
- Update: name, userDeclaredValue, resetCadence, expirationDate
- Optimistic locking with version field
- Return updated benefit (200 OK)
- Handle version conflicts (409)

### 5. DELETE /api/benefits/[id] - Delete Benefit
- Soft delete benefit (status = 'ARCHIVED')
- Return deleted benefit ID (200 OK)

### 6. PATCH /api/benefits/[id]/toggle-used - Mark Used
- Toggle isUsed flag
- Increment timesUsed when marking used
- Return updated benefit (200 OK)

## UI Components to Create

### EditCardModal
- Form: customName, actualAnnualFee, renewalDate
- Validation: required fields, date ranges
- Loading state, error display
- Token optimistic locking (version field)

### AddBenefitModal
- Two tabs: "From Catalog" and "Custom"
- Master catalog browser
- Custom form: name, type, value, cadence
- Duplicate prevention

### EditBenefitModal
- Form: name, userDeclaredValue, resetCadence, expirationDate
- Read-only: type, stickerValue
- Unique name validation per card
- Version tracking

### DeleteBenefitConfirmation
- Simple confirmation dialog
- Shows benefit name
- Destructive (red) Delete button

### DeleteCardConfirmation
- Confirmation with typed input
- Shows card name and benefit count
- Delete button disabled until match
- Warning styling

## Implementation Phases

### Phase 1: API Endpoints (2-3 days)
1. PATCH /api/cards/[id] - Edit Card
2. DELETE /api/cards/[id] - Delete Card
3. POST /api/benefits/add - Add Benefit
4. PATCH /api/benefits/[id] - Edit Benefit
5. DELETE /api/benefits/[id] - Delete Benefit
6. PATCH /api/benefits/[id]/toggle-used - Enhance existing

### Phase 2: Modal Components (3-4 days)
1. EditCardModal
2. AddBenefitModal
3. EditBenefitModal
4. DeleteBenefitConfirmation
5. DeleteCardConfirmation
6. Improve AddCardModal (from stub)

### Phase 3: Button Wiring (1-2 days)
1. Wire CardTile menu actions
2. Wire CardRow action buttons
3. Wire CardDetailPanel benefit actions
4. Set up modal state management

### Phase 4: Integration & Testing (1-2 days)
1. E2E flow testing
2. Error scenario testing
3. Accessibility testing

### Phase 5: Polish & Optimization (1 day)
1. Performance tuning
2. Dark mode verification
3. Mobile responsiveness

## Success Criteria ✅

- [x] All 6 API endpoints fully implemented and tested
- [x] All 5 modal components created with validation
- [x] All button handlers wired and functional
- [x] Data persists to database on all operations
- [x] Zero console.log stubs or TODO comments
- [x] All manual test cases passed
- [x] Zero TypeScript errors in strict mode
- [x] All edge cases handled gracefully
- [x] Users can complete workflows without errors
- [x] Code ready for production deployment

## Key Architecture Patterns

### Optimistic Locking (Version Field)
- Every card/benefit has `version` field
- Client sends current version with PATCH requests
- Server checks version matches before updating
- Returns 409 Conflict if version mismatch
- Client shows "Card was edited elsewhere" message
- User must refresh and retry

### Soft Deletes (Preservation)
- Never hard delete from database
- Mark status as 'DELETED' or 'ARCHIVED'
- Preserve all history for audits
- Allow future restore functionality

### Cascade Deletes
- DELETE /api/cards/[id] → Archives all benefits
- One atomic transaction
- Rollback on any error
- Return count of affected records

### Component Pattern (Radix UI)
- Use Dialog, DialogContent, DialogHeader
- React state for form + loading + errors
- Try/catch with proper error handling
- Toast notifications for feedback
- Dark mode support (Tailwind classes)
- Keyboard support (Escape to close)

## Error Handling Strategy

### Client-Side Validation
- Show errors before API call
- Red borders + error messages
- Field-level validation
- Prevent invalid submissions

### Server-Side Validation
- Enforce data constraints
- Check authorization
- Validate unique constraints
- Handle concurrent updates (version conflicts)

### Network Errors
- Timeout handling (30s limit)
- Connection lost detection
- Retry logic with exponential backoff
- Preserve form data for recovery

### User-Friendly Messages
- "Network error: unable to connect"
- "Request timed out. Please try again."
- "Card was edited by another user. Please refresh."
- "A benefit with this name already exists on this card"
- "Card not found or already deleted"

## Data Validation Rules

### Card Fields
- **customName**: String, max 100 chars, alphanumeric + spaces/dashes/parens
- **actualAnnualFee**: Integer, >= 0, <= 1,000,000 (cents)
- **renewalDate**: ISO date string, must be future date
- **version**: Must match current DB version (optimistic locking)

### Benefit Fields
- **name**: String, max 100 chars, unique per card
- **userDeclaredValue**: Integer, >= 0, <= 10,000,000
- **resetCadence**: Enum (Monthly, CalendarYear, CardmemberYear, OneTime)
- **expirationDate**: ISO date string (optional, must be future if provided)
- **version**: Must match current DB version (optimistic locking)

## Testing Checklist

### Unit Tests
- [ ] Validation functions for all fields
- [ ] Modal component rendering
- [ ] API response handling
- [ ] Error message display

### Integration Tests
- [ ] API endpoints with database
- [ ] Form submission flow
- [ ] Error handling and rollback

### E2E Tests (Manual)
- [ ] Complete edit card flow
- [ ] Complete add benefit flow
- [ ] Complete edit benefit flow
- [ ] Complete delete benefit flow
- [ ] Complete delete card flow
- [ ] Mark benefit as used toggle
- [ ] Version conflict handling
- [ ] Duplicate benefit prevention
- [ ] Network error handling
- [ ] Session expiration handling

### Browser/Device Tests
- [ ] Chrome (desktop)
- [ ] Safari (desktop)
- [ ] Firefox (desktop)
- [ ] iPhone (mobile)
- [ ] iPad (tablet)
- [ ] Dark mode appearance
- [ ] Keyboard navigation (Tab, Escape)
- [ ] Screen reader compatibility

## File Structure

```
src/app/api/
  ├── cards/[id]/route.ts                    # PATCH, DELETE
  └── benefits/
      ├── add/route.ts                       # POST
      └── [id]/
          ├── route.ts                       # PATCH, DELETE
          └── toggle-used/route.ts           # PATCH (improve)

src/components/card-management/
  ├── EditCardModal.tsx                      # NEW
  ├── AddBenefitModal.tsx                    # NEW
  ├── EditBenefitModal.tsx                   # NEW
  ├── DeleteBenefitConfirmation.tsx          # NEW
  ├── DeleteCardConfirmation.tsx             # NEW
  └── AddCardModal.tsx                       # IMPROVE (from stub)
```

## Next Steps

1. **Read this specification thoroughly** - Understand all features and patterns
2. **Review AddCardModal as pattern** - See component structure to follow
3. **Implement Phase 1 APIs** - Start with all 6 endpoints
4. **Implement Phase 2 modals** - Create 5 new components
5. **Wire Phase 3 buttons** - Connect all onClick handlers
6. **Test Phase 4** - E2E flows and edge cases
7. **Polish Phase 5** - Performance, dark mode, mobile
8. **Verify success criteria** - All items must pass

## Questions?

This specification is comprehensive and should answer most questions. If ambiguity exists:

1. Check Component Pattern Guide (section 10)
2. Check User Flows (section 7)
3. Check API Endpoints (section 5)
4. Check Edge Cases (section 8)

The engineer implementing should be able to complete Phase 6 without clarifying questions.

---

**Status:** READY FOR IMPLEMENTATION  
**Target Duration:** 5-7 days (Phase 1-5)  
**Success Metric:** Zero console.log stubs, all workflows functional  
