# Card Discovery & Selection Feature - Implementation Guide

## Overview

This document describes the Card Discovery & Selection feature implementation for the Card-Benefits tracking application. The feature enables users to browse, search, and add credit cards from a master catalog to their personal collection.

## Architecture

### API Layer

Three main API endpoints power the feature:

#### 1. GET /api/cards/available
**Purpose**: List available master cards with pagination and filtering
**Location**: `src/app/api/cards/available/route.ts`

```
GET /api/cards/available?page=1&limit=12&issuer=Chase&search=Sapphire
```

**Query Parameters**:
- `page`: Page number (default: 1, min: 1)
- `limit`: Cards per page (default: 12, min: 1, max: 50)
- `issuer`: Filter by issuer (case-insensitive partial match, optional)
- `search`: Search by card name (case-insensitive partial match, optional)

**Response Format**:
```json
{
  "success": true,
  "cards": [
    {
      "id": "cuid_mastercard_001",
      "issuer": "Chase",
      "cardName": "Sapphire Preferred",
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://...",
      "benefits": {
        "count": 8,
        "preview": ["$300 travel credit", "3x points on dining", "2x points on travel"]
      }
    }
  ],
  "pagination": {
    "total": 47,
    "page": 1,
    "limit": 12,
    "totalPages": 4,
    "hasMore": true
  }
}
```

**Error Responses**:
- 400: Invalid pagination (page < 1 or limit not in range)
- 500: Database error

#### 2. GET /api/cards/master/[id]
**Purpose**: Fetch complete details for a master card including all benefits
**Location**: `src/app/api/cards/master/[id]/route.ts`

```
GET /api/cards/master/cuid_mastercard_001
```

**Response Format**:
```json
{
  "success": true,
  "card": {
    "id": "cuid_mastercard_001",
    "issuer": "Chase",
    "cardName": "Sapphire Preferred",
    "defaultAnnualFee": 9500,
    "cardImageUrl": "https://...",
    "benefits": [
      {
        "id": "benefit_001",
        "name": "$300 annual travel credit",
        "type": "Travel",
        "stickerValue": 30000,
        "resetCadence": "Annual"
      }
    ]
  }
}
```

**Error Responses**:
- 400: Invalid card ID format
- 404: Card not found
- 500: Database error

#### 3. POST /api/cards/add
**Purpose**: Add a master card to user's collection
**Location**: `src/app/api/cards/add/route.ts`
**Authentication**: Required (uses getAuthContext())

```
POST /api/cards/add
Authorization: (from session/JWT cookie)
Content-Type: application/json

{
  "masterCardId": "cuid_mastercard_001",
  "customName": "My Chase Sapphire",
  "actualAnnualFee": 9500,
  "renewalDate": "2025-12-01"
}
```

**Field Validation**:
- `masterCardId`: Required, must exist in database
- `customName`: Optional, max 100 characters
- `actualAnnualFee`: Optional, must be non-negative integer (cents), max 999900
- `renewalDate`: Optional ISO 8601 date, defaults to 1 year from now

**Response (201 Created)**:
```json
{
  "success": true,
  "userCard": {
    "id": "usercard_456",
    "playerId": "player_789",
    "masterCardId": "cuid_mastercard_001",
    "customName": "My Chase Sapphire",
    "actualAnnualFee": 9500,
    "renewalDate": "2025-12-01T00:00:00Z",
    "isOpen": true,
    "status": "ACTIVE",
    "createdAt": "2024-11-20T15:45:00Z",
    "updatedAt": "2024-11-20T15:45:00Z"
  },
  "benefitsCreated": 8,
  "message": "Card added to your collection"
}
```

**Error Responses**:
- 400: Validation error (returns fieldErrors)
- 401: Not authenticated
- 403: Player profile not accessible
- 404: MasterCard not found
- 409: Card already in collection
- 500: Server error

### Frontend Component

#### CardCatalog Component
**Location**: `src/features/cards/components/CardCatalog.tsx`
**Type**: Client component (`'use client'`)

**Features**:
1. **Card Grid**: Responsive layout (1 col mobile, 2 col tablet, 3 col desktop)
2. **Pagination**: Page-based navigation with numbered buttons
3. **Search**: Real-time search by card name
4. **Filter**: Dropdown filter by issuer
5. **Card Details Modal**: Shows full benefits list
6. **Add Card Modal**: Form with validation for customization
7. **Error Handling**: Network errors, validation errors, server errors
8. **Loading States**: Skeleton cards, loading indicators
9. **Dark Mode**: Full dark mode support

**State Management**:
```typescript
// Pagination & Filtering
const [currentPage, setCurrentPage] = useState(1);
const [searchQuery, setSearchQuery] = useState('');
const [selectedIssuer, setSelectedIssuer] = useState<string | null>(null);

// Data Loading
const [cards, setCards] = useState<MasterCard[]>([]);
const [pagination, setPagination] = useState<PaginationInfo | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Modal Control
const [selectedCard, setSelectedCard] = useState<CardDetails | null>(null);
const [showDetailsModal, setShowDetailsModal] = useState(false);
const [showAddModal, setShowAddModal] = useState(false);

// Form State
const [formData, setFormData] = useState({
  customName: '',
  actualAnnualFee: 0,
  renewalDate: '',
});
const [formErrors, setFormErrors] = useState<Record<string, string>>({});
const [isSubmitting, setIsSubmitting] = useState(false);
```

## Integration Guide

### Add to a Page

```typescript
// src/app/cards/discover/page.tsx
import { CardCatalog } from '@/features/cards/components/CardCatalog';

export default function CardsDiscoveryPage() {
  return (
    <div className="container mx-auto p-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Discover Credit Cards
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Browse our catalog of premium credit cards and add them to your collection
        </p>
      </div>
      <CardCatalog />
    </div>
  );
}
```

### Add to Dashboard

```typescript
// In dashboard page component
import { CardCatalog } from '@/features/cards/components/CardCatalog';

<section className="mt-12">
  <h2 className="text-2xl font-bold mb-6">Browse Cards</h2>
  <CardCatalog />
</section>
```

## Styling Conventions

### Responsive Breakpoints

- **Mobile**: 320px-479px → 1 column grid, full-screen modals
- **Tablet**: 480px-1023px → 2 column grid, modal width 60vw
- **Desktop**: 1024px+ → 3-4 column grid, modal width fixed 600px

### Color Scheme

**Light Mode**:
- Background: white
- Text: gray-900
- Borders: gray-300
- Buttons: blue-600 (primary), blue-700 (hover)
- Errors: red-600
- Success: green-600

**Dark Mode**:
- Background: gray-800
- Text: gray-100
- Borders: gray-600
- Buttons: blue-600 (primary), blue-700 (hover)
- Errors: red-400
- Success: green-400

### Component Classes

```typescript
// Card container
"border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg"

// Form input
"px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 
 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"

// Error input
"border-red-500"

// Button primary
"bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"

// Button secondary
"border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 
 hover:bg-gray-100 dark:hover:bg-gray-700"
```

## Error Handling

### API Errors

The component handles all API error codes gracefully:

```typescript
if (response.status === 409) {
  // Card already in collection
  setSubmitError('You already own this card');
} else if (response.status === 400) {
  // Validation error - show field-level errors
  setFormErrors(errorData.fieldErrors);
  setSubmitError('Please fix the errors above');
} else if (response.status === 401) {
  // Session expired - user should log in again
  setSubmitError('Your session expired. Please log in again.');
} else {
  // Other errors
  setSubmitError(errorData.error);
}
```

### Form Validation

Client-side validation prevents invalid submissions:

```typescript
function validateForm(): boolean {
  const newErrors: Record<string, string> = {};

  // Custom name validation
  if (formData.customName && formData.customName.length > 100) {
    newErrors.customName = 'Card name must be 100 characters or less';
  }

  // Annual fee validation
  if (typeof formData.actualAnnualFee === 'number') {
    if (formData.actualAnnualFee < 0 || formData.actualAnnualFee > 999900) {
      newErrors.actualAnnualFee = 'Annual fee must be between $0 and $9,999';
    }
  }

  // Renewal date validation
  if (formData.renewalDate) {
    const renewalDate = new Date(formData.renewalDate);
    if (renewalDate < new Date()) {
      newErrors.renewalDate = 'Renewal date must be in the future';
    }
  }

  setFormErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}
```

## Performance Considerations

### API Performance SLOs

- GET /api/cards/available: p95 < 500ms
- GET /api/cards/master/[id]: p95 < 400ms
- POST /api/cards/add: p95 < 800ms

### Frontend Optimization

1. **Pagination**: Only fetches 12 cards per page (reduces payload)
2. **Lazy Loading**: Benefits loaded only when modal opens
3. **Debouncing**: Search input debounced to 300ms (not implemented in current version, but recommended)
4. **Caching**: Card list cached in component state, refetched after add
5. **No N+1 Queries**: All benefits fetched in single query via `include`

### Database Optimization

The following indexes are critical for performance:

```sql
-- Already in Prisma schema
MasterCard(issuer)           -- For issuer filtering
MasterCard(cardName)         -- For search
MasterBenefit(masterCardId)  -- For benefit joins
UserCard(playerId, masterCardId)  -- Unique constraint prevents duplicates
```

## Testing Checklist

### API Tests

- [ ] GET /api/cards/available with page/limit parameters
- [ ] GET /api/cards/available with issuer filter
- [ ] GET /api/cards/available with search query
- [ ] GET /api/cards/available pagination boundary (empty pages)
- [ ] GET /api/cards/master/[id] returns all benefits
- [ ] GET /api/cards/master/[id] with invalid ID (404)
- [ ] POST /api/cards/add with all valid inputs
- [ ] POST /api/cards/add duplicate card (409)
- [ ] POST /api/cards/add validation errors (400)
- [ ] POST /api/cards/add not authenticated (401)

### Component Tests

- [ ] Cards render in grid
- [ ] Pagination navigation works
- [ ] Search updates results
- [ ] Issuer filter works
- [ ] Card click opens details modal
- [ ] Modal close button works
- [ ] Details load in modal
- [ ] Add button opens form modal
- [ ] Form validation works
- [ ] Form submission succeeds
- [ ] Error states display correctly
- [ ] Loading states display

### Responsive Tests

- [ ] Mobile (375px): 1 column, full-screen modal
- [ ] Tablet (768px): 2 columns, 60vw modal
- [ ] Desktop (1440px): 3 columns, fixed modal

### Dark Mode Tests

- [ ] All text visible in dark mode
- [ ] Form inputs styled correctly in dark mode
- [ ] Modal backgrounds dark in dark mode
- [ ] Borders visible in dark mode

## Troubleshooting

### Common Issues

**Problem**: Cards not loading on page load
- **Solution**: Check network tab for /api/cards/available request, verify API endpoint exists

**Problem**: Modal not opening when clicking card
- **Solution**: Check browser console for JavaScript errors, verify setShowDetailsModal is called

**Problem**: Form submission fails with 401
- **Solution**: User session expired, need to refresh page or log in again

**Problem**: Card appears duplicated after adding
- **Solution**: Browser cache issue, try hard refresh (Cmd+Shift+R) to clear cache

**Problem**: Annual fee shows wrong value
- **Solution**: Verify input is in dollars, not cents. Component handles conversion to cents internally.

## Future Enhancements

- [ ] Add toast notifications for success/error feedback
- [ ] Implement search debouncing (300ms delay)
- [ ] Add card comparison feature
- [ ] Implement card favorites/wishlist
- [ ] Add analytics tracking for card discovery
- [ ] Optimize images with lazy loading and WebP format
- [ ] Add sorting options (by annual fee, issuer, etc.)
- [ ] Cache card list in localStorage for offline browsing
- [ ] Add keyboard navigation (arrow keys for pagination)
- [ ] Implement infinite scroll as alternative to pagination

## References

- **Spec**: `.github/specs/card-discovery-spec.md`
- **Database Schema**: `prisma/schema.prisma`
- **Auth Utilities**: `src/features/auth/lib/auth.ts`
- **Currency Formatting**: `src/shared/lib/format-currency.ts`
