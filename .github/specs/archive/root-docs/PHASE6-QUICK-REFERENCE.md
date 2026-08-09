# Phase 6: Button Implementation - Quick Reference

## API Endpoints Summary

### Cards
| Method | Endpoint | Purpose | Auth | Body | Response |
|--------|----------|---------|------|------|----------|
| PATCH | `/api/cards/[id]` | Edit card | ✅ | customName?, actualAnnualFee?, renewalDate? | 200 card |
| DELETE | `/api/cards/[id]` | Delete card | ✅ | - | 204 |

### Benefits
| Method | Endpoint | Purpose | Auth | Body | Response |
|--------|----------|---------|------|------|----------|
| POST | `/api/benefits/add` | Create benefit | ✅ | userCardId, name, type, stickerValue, resetCadence, ... | 201 benefit |
| PATCH | `/api/benefits/[id]` | Edit benefit | ✅ | name?, userDeclaredValue?, ... | 200 benefit |
| DELETE | `/api/benefits/[id]` | Delete benefit | ✅ | - | 204 |
| PATCH | `/api/benefits/[id]/toggle-used` | Mark as used | ✅ | isUsed: boolean | 200 benefit |

## React Components

### EditCardModal
```typescript
import { EditCardModal } from '@/components/EditCardModal';

<EditCardModal
  card={cardObject}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onCardUpdated={(updated) => {
    // Update parent state with new card data
  }}
/>
```

### AddBenefitModal
```typescript
import { AddBenefitModal } from '@/components/AddBenefitModal';

<AddBenefitModal
  cardId={cardId}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onBenefitAdded={(benefit) => {
    // Add new benefit to list
  }}
/>
```

### EditBenefitModal
```typescript
import { EditBenefitModal } from '@/components/EditBenefitModal';

<EditBenefitModal
  benefit={benefitObject}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onBenefitUpdated={(updated) => {
    // Update benefit in list
  }}
/>
```

### DeleteBenefitConfirmationDialog
```typescript
import { DeleteBenefitConfirmationDialog } from '@/components/DeleteBenefitConfirmationDialog';

<DeleteBenefitConfirmationDialog
  benefit={benefitObject}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={() => {
    // Remove from list
  }}
/>
```

### DeleteCardConfirmationDialog
```typescript
import { DeleteCardConfirmationDialog } from '@/components/DeleteCardConfirmationDialog';

<DeleteCardConfirmationDialog
  card={cardObject}
  benefitCount={count}
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={() => {
    // Navigate away or remove from list
  }}
/>
```

## Complete Integration Example

```typescript
'use client';

import { useState } from 'react';
import { EditCardModal } from '@/components/EditCardModal';
import { AddBenefitModal } from '@/components/AddBenefitModal';
import { EditBenefitModal } from '@/components/EditBenefitModal';
import { DeleteBenefitConfirmationDialog } from '@/components/DeleteBenefitConfirmationDialog';
import { DeleteCardConfirmationDialog } from '@/components/DeleteCardConfirmationDialog';

export function CardDetail({ card, benefits }) {
  // Modal states
  const [editCardOpen, setEditCardOpen] = useState(false);
  const [addBenefitOpen, setAddBenefitOpen] = useState(false);
  const [editBenefitOpen, setEditBenefitOpen] = useState(false);
  const [deleteBenefitOpen, setDeleteBenefitOpen] = useState(false);
  const [deleteCardOpen, setDeleteCardOpen] = useState(false);

  // Tracking which item is selected
  const [selectedBenefit, setSelectedBenefit] = useState(null);

  // Card updated
  const handleCardUpdated = (updated) => {
    // Refetch or update card in parent
    console.log('Card updated:', updated);
  };

  // Benefit added
  const handleBenefitAdded = (benefit) => {
    // Add to benefits list
    console.log('Benefit added:', benefit);
  };

  // Benefit updated
  const handleBenefitUpdated = (updated) => {
    // Update benefits list
    console.log('Benefit updated:', updated);
  };

  // Benefit deleted
  const handleBenefitDeleted = () => {
    // Remove from benefits list
    console.log('Benefit deleted');
  };

  // Card deleted
  const handleCardDeleted = () => {
    // Navigate away
    console.log('Card deleted');
  };

  return (
    <>
      {/* Edit Card Button */}
      <button onClick={() => setEditCardOpen(true)}>
        Edit Card
      </button>

      {/* Add Benefit Button */}
      <button onClick={() => setAddBenefitOpen(true)}>
        Add Benefit
      </button>

      {/* Delete Card Button */}
      <button onClick={() => setDeleteCardOpen(true)}>
        Delete Card
      </button>

      {/* Benefit actions */}
      {benefits.map((benefit) => (
        <div key={benefit.id}>
          <span>{benefit.name}</span>
          <button
            onClick={() => {
              setSelectedBenefit(benefit);
              setEditBenefitOpen(true);
            }}
          >
            Edit
          </button>
          <button
            onClick={() => {
              setSelectedBenefit(benefit);
              setDeleteBenefitOpen(true);
            }}
          >
            Delete
          </button>
        </div>
      ))}

      {/* Modals */}
      <EditCardModal
        card={card}
        isOpen={editCardOpen}
        onClose={() => setEditCardOpen(false)}
        onCardUpdated={handleCardUpdated}
      />

      <AddBenefitModal
        cardId={card.id}
        isOpen={addBenefitOpen}
        onClose={() => setAddBenefitOpen(false)}
        onBenefitAdded={handleBenefitAdded}
      />

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

      <DeleteCardConfirmationDialog
        card={card}
        benefitCount={benefits.length}
        isOpen={deleteCardOpen}
        onClose={() => setDeleteCardOpen(false)}
        onConfirm={handleCardDeleted}
      />
    </>
  );
}
```

## Validation Rules Reference

### Card Validation
- customName: 0-100 characters (optional)
- actualAnnualFee: 0-9,999.99 in cents (optional)
- renewalDate: valid future date (optional)

### Benefit Validation
- name: 1-100 characters, unique per card (required)
- type: StatementCredit | UsagePerk (required)
- stickerValue: > 0 in cents (required)
- resetCadence: Monthly | CalendarYear | CardmemberYear | OneTime (required)
- userDeclaredValue: ≤ stickerValue (optional)
- expirationDate: future date (optional)

## Error Handling Pattern

All APIs return consistent error format:

```typescript
// On validation error
{
  "success": false,
  "error": "Validation failed",
  "fieldErrors": {
    "name": "Benefit name is required",
    "stickerValue": "Must be greater than 0"
  }
}

// On auth error
{
  "success": false,
  "error": "Not authenticated"
}

// On permission error
{
  "success": false,
  "error": "You do not have permission to edit this card"
}

// On not found error
{
  "success": false,
  "error": "Card not found"
}
```

## Testing Checklist

### Functional Tests
- [ ] Edit card: change name, fee, renewal date
- [ ] Delete card: confirm warning shows benefit count
- [ ] Add benefit: create with all fields
- [ ] Edit benefit: update name, value, cadence
- [ ] Delete benefit: confirm deletion
- [ ] Mark used: toggle checkbox, verify in DB
- [ ] Validation: test all error cases
- [ ] Permissions: verify ownership checks

### UX Tests
- [ ] Success toast appears after submit
- [ ] Error toast appears on failure
- [ ] Modal closes after success
- [ ] Form clears on success
- [ ] Buttons disabled during loading
- [ ] Loading spinner shows
- [ ] Escape key closes modals
- [ ] Tab navigation works

### Styling Tests
- [ ] Dark mode: all elements visible
- [ ] Mobile: forms stack properly
- [ ] Accessibility: ARIA labels present
- [ ] Focus: visible focus indicators
- [ ] Colors: good contrast

---

**Status**: Ready for integration and testing! 🚀
