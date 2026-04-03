# Card Management Feature - Quick Start Guide

**For:** Full-Stack Engineers  
**Use:** Reference this while implementing  
**Estimated Reading Time:** 10 minutes  

---

## What You're Building

A complete card management interface where users can:
- ✅ View cards in Grid/List/Compact modes
- ✅ Search and filter cards
- ✅ Add new cards to their wallet
- ✅ Edit card details (name, fee, renewal date)
- ✅ Archive (soft delete) or permanently delete cards
- ✅ Bulk update multiple cards
- ✅ See card ROI, benefits, and diagnostics

**Timeline:** 8 days (2 engineers)  
**Complexity:** Large (4 features, state machine, authorization)

---

## Start Here

### 1. Read the Full Spec (30 minutes)
- Full spec: `.github/specs/card-management-refined-spec.md`
- Key sections to read first:
  - Executive Summary (§ 0)
  - Data Schema (§ 3)
  - API Routes (§ 4)
  - Component Architecture (§ 5)

### 2. Understand the Data Model (15 minutes)
```typescript
// Main table: UserCard
UserCard {
  id: string
  playerId: string           // Which player owns this
  masterCardId: string       // Reference to card catalog
  
  customName?: string        // User's nickname
  actualAnnualFee?: number   // Override fee
  renewalDate: DateTime      // Card anniversary
  
  status: 'ACTIVE' | 'PENDING' | 'ARCHIVED' | 'DELETED'
  archivedAt?: DateTime
  
  // Timestamps
  createdAt, updatedAt
}

// Display model: CardDisplayModel
{
  // + Master card details (issuer, cardName, defaultFee, logo)
  // + Calculated fields (daysUntilRenewal, cardROI, benefitsCount)
  // + All UserCard fields
}
```

### 3. Understand the State Machine (10 minutes)
```
ACTIVE ← → PENDING
  ↓       ↓
PAUSED ↘ ↙ ARCHIVED
         ↓
      DELETED (final)
```

**Key Rules:**
- DELETED has no transitions OUT (final state)
- ARCHIVED can go back to ACTIVE (rare)
- PENDING can become ACTIVE when first benefit claimed
- Status changes record WHO, WHEN, and WHY

### 4. Know the Authorization Rules (5 minutes)
```
Role      | View | Add | Edit Own | Edit Other | Delete |
----------|------|-----|----------|------------|--------|
Owner     | All  | Yes | Yes      | Yes        | Yes    |
Admin     | All  | Yes | Yes      | If delegated | Yes  |
Editor    | Own  | Yes | Yes      | No         | Own    |
Viewer    | Own  | No  | No       | No         | No     |
Guest     | No   | No  | No       | No         | No     |
```

Every operation checks: `authorizeCardOperation(userId, card, operation)`

### 5. Follow the Implementation Checklist
See § 7 in full spec for detailed tasks with checkboxes.

**Phase 1 (Days 1-2): Display & Navigation**
- [ ] CardTile, CardRow, CardCompact components
- [ ] Search input with debounce
- [ ] Filter panel with all filter types
- [ ] View toggle (persist preference)

**Phase 2 (Days 3-4): Operations**
- [ ] Add card modal (3-step wizard)
- [ ] Edit card form
- [ ] Detail panel
- [ ] Archive/unarchive
- [ ] Delete with confirmation
- [ ] Authorization middleware

**Phase 3 (Days 5-6): Advanced Features**
- [ ] Bulk operations (select, bulk archive, bulk update)
- [ ] Status management (state machine)
- [ ] Diagnostics & warnings
- [ ] Named filters

**Phase 4 (Days 7-8): Testing & Polish**
- [ ] Unit tests (validation, calculations)
- [ ] Component tests (rendering, interactions)
- [ ] Integration tests (workflows)
- [ ] E2E tests (Playwright)
- [ ] Performance testing
- [ ] Mobile responsiveness
- [ ] Accessibility (WCAG 2.1 AA)

---

## API Summary

### Endpoints You'll Implement
```
GET    /api/cards              # Get cards with filters
GET    /api/cards/{id}         # Get card details
POST   /api/cards              # Create card
PUT    /api/cards/{id}         # Update card
POST   /api/cards/{id}/archive # Archive card
POST   /api/cards/{id}/unarchive # Restore card
DELETE /api/cards/{id}         # Permanently delete
POST   /api/cards/bulk/update  # Bulk update
```

### Server Actions You'll Create
```typescript
// src/actions/cards.ts

getPlayerCards(playerId, filters?)         // Returns CardDisplayModel[]
getCardDetails(cardId)                     // Returns CardDetailsModel
addCardToWallet(playerId, masterCardId, ...) // Returns CardDisplayModel
updateCard(cardId, updates)                // Returns CardDisplayModel
archiveCard(cardId, reason?)               // Returns CardDisplayModel
unarchiveCard(cardId)                      // Returns CardDisplayModel
deleteCard(cardId, confirmationText)       // Returns {success: boolean}
bulkUpdateCards(cardIds[], updates)        // Returns {updated, failed}
```

---

## Component Hierarchy

```
CardWallet (page)
├─ CardManagementHeader
│  ├─ ViewModeToggle
│  ├─ CardSearchInput
│  └─ AddCardButton
├─ CardFiltersPanel
│  ├─ StatusFilter
│  ├─ IssuerFilter
│  ├─ FeeRangeSlider
│  ├─ RenewalDateRange
│  └─ SavedFiltersDropdown
├─ CardListDisplay (chooses: Grid | List | Compact)
│  ├─ CardTile[] (grid)
│  ├─ CardRow[] (list)
│  └─ CardCompact[] (compact)
├─ BulkActionBar (if selected)
├─ CardDetailPanel (side panel)
└─ Modals
   ├─ AddCardModal
   ├─ EditCardForm
   └─ ConfirmDeleteDialog
```

---

## Key Implementation Details

### CardTile Component
```tsx
<CardTile
  card={CardDisplayModel}
  isSelected={boolean}
  onSelect={(cardId) => {}}
  onCardClick={(card) => openDetailPanel(card)}
  onMenuAction={(action, cardId) => {}}
/>

// Renders:
// ┌─────────────────────────────┐
// │ Logo Card Name   [⋮]        │
// │ Status Badge (color)        │
// │ Annual Fee: $550            │
// │ Renews in 45 days           │
// │ 7 Benefits | 12.5% ROI      │
// └─────────────────────────────┘
```

### Search & Filter Performance
- Debounce search input: 200ms
- Debounce filter application: 200ms
- Client-side filtering for <500 cards
- Server-side pagination for >500 cards
- Cache results: 5-minute TTL

### Authorization Enforcement
```typescript
// Every server action must:
1. Get current user session
2. Check authorization
3. Validate input
4. Execute operation
5. Return ActionResponse<T>

// Example:
if (!authorized) {
  return { success: false, error: 'FORBIDDEN' };
}
```

### State Machine Implementation
```typescript
// Before any state transition:
if (!isValidTransition(currentStatus, newStatus)) {
  throw new Error(`Cannot transition ${currentStatus} → ${newStatus}`);
}

// Handle side effects:
if (newStatus === 'ARCHIVED') {
  // Disable benefits
  // Disable alerts
  // Record archived timestamp
}

// Update card:
await db.userCard.update({
  where: { id: cardId },
  data: {
    status: newStatus,
    statusChangedAt: new Date(),
    statusChangedReason: reason
  }
});
```

---

## Common Patterns

### Server Action Pattern
```typescript
'use server';

export async function updateCard(
  cardId: string,
  updates: any
): Promise<ActionResponse<CardDisplayModel>> {
  try {
    // 1. Get session
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: 'NOT_AUTHENTICATED' };
    }

    // 2. Fetch and authorize
    const card = await db.userCard.findUnique({where: {id: cardId}});
    const authorized = await authorizeCardOperation(
      session.user.id, card, 'EDIT'
    );
    if (!authorized) {
      return { success: false, error: 'FORBIDDEN' };
    }

    // 3. Validate
    const parsed = CardSchema.partial().safeParse(updates);
    if (!parsed.success) {
      return { success: false, error: 'VALIDATION_FAILED' };
    }

    // 4. Update
    const updated = await db.userCard.update({
      where: { id: cardId },
      data: parsed.data
    });

    // 5. Return
    return { success: true, data: formatCard(updated) };
  } catch (error) {
    return { success: false, error: 'SERVER_ERROR' };
  }
}
```

### Validation Pattern (Zod)
```typescript
const CardSchema = z.object({
  customName: z.string().min(1).max(100).optional(),
  actualAnnualFee: z.number().nonnegative().optional(),
  renewalDate: z.date().refine(d => d > new Date(), {
    message: 'Must be in future'
  })
});
```

### Filter Combination (AND logic)
```typescript
const filtered = cards.filter(card => {
  if (search && !matches(card, search)) return false;
  if (statusFilter.length && !statusFilter.includes(card.status)) return false;
  if (issuerFilter.length && !issuerFilter.includes(card.issuer)) return false;
  if (feeRange && (card.effectiveAnnualFee < feeRange[0] || card.effectiveAnnualFee > feeRange[1])) return false;
  // ... more filters
  return true;
});
```

---

## Testing Checklist

### Unit Tests to Write
- [ ] Validation rules (future date, non-negative fee, name length)
- [ ] Calculations (daysUntilRenewal, cardROI, effectiveAnnualFee)
- [ ] Status transitions (all valid/invalid combinations)
- [ ] Filter logic (each filter independently and combined)

### Component Tests
- [ ] CardTile renders all fields correctly
- [ ] CardRow shows correct columns and sorting
- [ ] CardDetailPanel displays full card info
- [ ] Filter panel applies filters
- [ ] Search debounces and filters

### Integration Tests
- [ ] Add card workflow (end-to-end)
- [ ] Edit card workflow
- [ ] Archive/unarchive workflow
- [ ] Bulk operations
- [ ] Search and filter combinations

### E2E Tests (Playwright)
- [ ] User adds card to empty wallet
- [ ] User edits card and sees ROI change
- [ ] User archives and restores card
- [ ] User searches and filters cards
- [ ] User selects and bulk archives

---

## Edge Cases to Handle

| # | Scenario | Handling |
|---|----------|----------|
| EC1 | Add duplicate card | 409 Conflict, suggest view existing |
| EC4 | Renewal date in past | Validation error, suggest archive |
| EC5 | Negative annual fee | Validation error, allow zero |
| EC7 | Unauthorized access | 403 Forbidden |
| EC8 | Invalid state transition | Error, prevent transition |
| EC9 | Bulk operation fails on one | Transaction rollback, show error |
| EC13 | Wallet with 200+ cards | Pagination, lazy load, perform OK |
| EC14 | Search zero results | Show "No results" message |
| EC16 | Network timeout | Keep form state, retry, offline mode |
| EC18 | Select all ambiguity | Ask: select visible or all? |

See § 6 of full spec for all 19 edge cases with detailed handling.

---

## Performance Targets

| Operation | Target | How to Verify |
|-----------|--------|--------------|
| Load 50 cards | <1 second | Measure page load |
| Search 50 cards | <200ms | Debounce timing |
| Filter 50 cards | <200ms | Real-time filtering |
| Add card | <2 seconds | Timeline from click to toast |
| Update card | <1 second | Save latency |
| Bulk update 10 | <5 seconds | Operation duration |

**Optimization Tips:**
- Memoize components with React.memo
- Debounce search/filter (200ms)
- Lazy load images
- Paginate for 200+ cards
- Cache search results (5 min TTL)

---

## Mobile Responsiveness

| Breakpoint | Layout | Features |
|-----------|--------|----------|
| Mobile (<768px) | 1 column | FAB, bottom sheet, swipe |
| Tablet (768-1024px) | 2 columns | Side filter, modal detail |
| Desktop (>1024px) | 3 columns | Side panel, full controls |

**Touch Targets:** Minimum 44x44 pixels  
**No Hover-Only Actions:** All features accessible via touch

---

## Debugging Tips

### If Cards Not Showing
1. Check database has UserCard records
2. Check authorization: User in household?
3. Check filters: Is status filter hiding them?
4. Check search: Is search string matching?

### If Authorization Failing
1. Check `authorizeCardOperation()` return value
2. Check user role in household
3. Check card owner matches
4. Check household membership

### If ROI Not Updating
1. Check annual fee changed (trigger invalidation)
2. Check benefit claimed (not just benefit added)
3. Check card status is ACTIVE (not ARCHIVED)
4. Check calculation formula correct

### If Tests Failing
1. Check mock data created correctly
2. Check server action called (not client-side)
3. Check state updated after action
4. Check authorization mocked for test

---

## Key Files You'll Create/Modify

```
src/
├─ components/
│  └─ cards/
│     ├─ CardWallet.tsx          (main page)
│     ├─ CardTile.tsx            (grid view)
│     ├─ CardRow.tsx             (list view)
│     ├─ CardCompact.tsx         (compact view)
│     ├─ CardDetailPanel.tsx     (detail view)
│     ├─ CardManagementHeader.tsx
│     ├─ CardFiltersPanel.tsx
│     ├─ AddCardModal.tsx
│     ├─ BulkActionBar.tsx
│     └─ index.ts
│
├─ actions/
│  └─ cards.ts                   (server actions)
│
├─ lib/
│  ├─ validators/
│  │  └─ card.ts                 (Zod schemas)
│  ├─ auth.ts                    (authorization)
│  └─ helpers.ts                 (utilities)
│
├─ types/
│  └─ card.ts                    (TypeScript types)
│
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ e2e/

prisma/
└─ schema.prisma                 (update UserCard model)
```

---

## Quick Links in Full Spec

| Topic | Section |
|-------|---------|
| Functional Requirements | § 1 |
| Data Schema | § 3 |
| API Routes | § 4 |
| Components | § 5 |
| Edge Cases | § 6 |
| Implementation Checklist | § 7 |
| Authorization | § 2.1 |
| State Machine | § 2.2 |
| Performance Targets | § 9.1 |
| Testing | § 10 |

---

## Getting Help

1. **Questions about requirements?** See § 1 (Functional Requirements)
2. **Questions about API?** See § 4 (API Routes)
3. **Questions about components?** See § 5 (Component Architecture)
4. **Questions about edge case?** See § 6 (Edge Cases)
5. **Questions about testing?** See § 10 (Test Scenarios)
6. **Questions about authorization?** See § 2.1 (Authorization)

---

## Success Criteria (Final Checklist)

- [ ] All 4 phases completed (display, operations, advanced, testing)
- [ ] All components render correctly
- [ ] All API endpoints working
- [ ] All server actions tested
- [ ] Authorization enforced on every operation
- [ ] State machine transitions validated
- [ ] Edge cases handled
- [ ] 80%+ test coverage
- [ ] Performance targets met
- [ ] Mobile responsive
- [ ] WCAG 2.1 AA accessibility
- [ ] Documentation complete

---

**Status:** Ready to start implementation  
**Timeline:** 8 days  
**Next Step:** Start Phase 1, Task 1.1 (CardTile & CardRow components)

Good luck! 🚀

