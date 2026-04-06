# Phase 5: Admin Benefits Page Enhancements - Technical Specification

**Document Version**: 1.0  
**Created**: 2026-04-06  
**Status**: Ready for Implementation  
**Target Implementation Phase**: Phase 5 (Full-Stack Engineer)

---

## Executive Summary & Goals

This specification defines four critical enhancements to the Admin Benefits management page (`src/app/admin/benefits/page.tsx`). These changes improve usability, data visibility, and operational efficiency for administrators managing credit card benefits within the system.

**Primary Objectives:**
1. Display associated card information for each benefit (Add "Card" column)
2. Enable filtering benefits by card (Add "Filter by Card" dropdown)
3. Implement benefit editing capability (Add "Edit" action with modal)
4. Correct currency display format from cents to dollars (Fix display issue globally on this page)

**Success Criteria:**
- ✅ All 4 features implemented and tested
- ✅ Benefits page displays card names alongside benefit details
- ✅ Filter dropdown enables single-select filtering by card with URL persistence
- ✅ Edit modal opens, pre-fills data, and updates benefits via PATCH endpoint
- ✅ All monetary values display as "$X.XX" format, not raw cents
- ✅ Mobile responsive (375px, 768px, 1440px breakpoints)
- ✅ Dark/light mode support maintained
- ✅ No regressions in pagination, search, sorting, or delete functionality
- ✅ QA sign-off before deployment

---

## Functional Requirements

### 1. Card Column Display
- **Requirement**: Display MasterCard.cardName for each benefit in a new "Card" column
- **Position**: Second column, right after "Name" column (before "Type" column)
- **Data Source**: Fetch via Prisma JOIN: MasterBenefit.masterCard.cardName
- **Sorting**: Column header must be clickable to sort by card name (alphabetical, A-Z / Z-A)
- **Fallback**: Display "N/A" if card data is missing (shouldn't happen in normal operation)
- **Responsive**: On mobile (375px), may be hidden or reordered if space is limited (per design system)

### 2. Filter by Card Dropdown
- **Requirement**: Add single-select dropdown to filter benefits by card
- **Location**: Above the search bar, before the search input field
- **Label**: "Filter by Card"
- **Options**: All unique MasterCard.cardName values from database
- **Default**: "All Cards" option selected (shows all benefits, no filter applied)
- **Interaction**: User selects one card name → page filters to show only benefits for that card
- **URL Persistence**: Selected card stored in URL query param (?card=cardId) for bookmarkability
- **Combined Filtering**: Works seamlessly with existing search filter + pagination
- **Reset**: Clicking "All Cards" clears the filter and resets to page 1
- **Page Reset**: Selecting a new card automatically resets to page 1 to avoid "no results" on invalid pages

### 3. Edit Action Button
- **Requirement**: Add "Edit" button to the Actions column (currently only has "Delete")
- **Placement**: Edit button appears before Delete button in Actions column
- **Interaction**: Click "Edit" → EditBenefitModal opens with pre-filled data
- **Editable Fields**:
  - Benefit Name (text input, max 200 chars, required)
  - Benefit Type (dropdown: INSURANCE, CASHBACK, TRAVEL, BANKING, POINTS, OTHER)
  - Sticker Value (numeric input, displayed in dollars "$X.XX" format, stored as cents)
  - Reset Cadence (dropdown: ANNUAL, PER_TRANSACTION, PER_DAY, MONTHLY, ONE_TIME)
- **Validation**: Match validation rules from existing AddBenefitModal component
- **API Call**: Submit via PATCH /api/admin/benefits/{benefitId}
- **Success**: Modal closes, table refreshes with updated data
- **Error**: FormError component displays error message (prevents modal close)
- **Delete**: Delete button continues to work as before (Delete modal behavior unchanged)

### 4. Currency Display Fix
- **Requirement**: Display all monetary values in dollar format, not cents
- **Current State**: stickerValue displayed as raw integer (e.g., 50000 for $500.00)
- **New State**: Apply formatCurrency() utility to display as "$500.00"
- **Scope**: Benefits page stickerValue column + EditBenefitModal value fields
- **Implementation**: Use utility: `formatCurrency(cents, showSymbol?: true)` → "$500.00"
- **Input Handling**: Use `parseCurrency(userInput)` in modal form to convert "$500" → 50000 cents
- **Database**: NO CHANGES - database continues storing values in cents (INT type)
- **Note**: This is a UI-only change; no backend data model changes needed

### User Roles & Permissions
- **Required Role**: ADMIN or SUPER_ADMIN
- **Auth Middleware**: All endpoints already protected via verifyAdminRole()
- **No New Auth Needed**: Reuse existing authentication pattern

### System Constraints & Limits
- **Pagination**: Max 20 items per page (configurable, currently 20)
- **Search**: Max 255 characters per query
- **Benefit Name**: Max 200 characters
- **Description**: Max 1000 characters (if stored)
- **Card Names**: Unique, no duplicates per issuer
- **Monetary Values**: Stored as INT (cents), valid range: 0 to 2,147,483,647 (2^31-1)

---

## Implementation Phases

### Phase 1: API Enhancement (Days 1-2)
**Objective**: Implement PATCH endpoint and enhance GET endpoint with card data joins

**Key Deliverables:**
1. Enhance GET /api/admin/benefits response to include masterCard object (with id, cardName, issuer)
2. Implement PATCH /api/admin/benefits/{benefitId} endpoint (NEW)
3. Add optional ?card=cardId query filter to GET endpoint
4. Ensure all responses include masterCard data for UI consumption
5. Add audit logging for PATCH operations

**Estimated Scope**: Medium (3-4 hours)

**Dependent Tasks**: None - can start immediately

### Phase 2: Frontend UI Components (Days 2-3)
**Objective**: Create new components and modify benefits page layout

**Key Deliverables:**
1. Create CardFilterDropdown component (fetches unique cards, renders Radix UI Select)
2. Create EditBenefitModal component (similar to AddBenefitModal, pre-fills form data)
3. Modify BenefitsPage layout to add filter dropdown above search
4. Add "Card" column to table (second position)
5. Replace Delete-only actions with Edit+Delete button group
6. Apply formatCurrency() to stickerValue display in table
7. Integrate filter state with URL query params

**Estimated Scope**: Large (5-6 hours)

**Dependent Tasks**: Depends on Phase 1 (API must be ready)

### Phase 3: Integration & Polish (Days 3-4)
**Objective**: Connect components, test data flows, and ensure consistency

**Key Deliverables:**
1. Wire EditBenefitModal to PATCH endpoint with error handling
2. Ensure filter state persists through pagination/search/sort combinations
3. Apply formatting consistently across all monetary fields
4. Test mobile responsiveness (375px, 768px, 1440px)
5. Verify dark/light mode compatibility
6. Add loading states for async operations

**Estimated Scope**: Medium (4-5 hours)

**Dependent Tasks**: Depends on Phases 1 & 2

### Phase 4: Testing & Validation (Days 4-5)
**Objective**: Comprehensive QA and acceptance criteria verification

**Key Deliverables:**
1. Manual testing of all 4 features
2. Edge case testing (empty states, errors, permissions)
3. Regression testing (existing features still work)
4. Performance testing (large datasets, pagination)
5. Accessibility testing (keyboard navigation, screen readers)
6. Browser compatibility testing

**Estimated Scope**: Medium (3-4 hours)

**Dependent Tasks**: Depends on Phase 3

---

## Data Schema & State Management

### Database Schema (No Changes Required)
The existing Prisma schema already supports all required functionality. No migrations needed.

```typescript
// MasterCard Model (existing)
model MasterCard {
  id               String          @id @default(cuid())
  issuer           String
  cardName         String          // ← Used for display in benefits page
  defaultAnnualFee Int
  cardImageUrl     String
  displayOrder     Int             @default(0)
  isActive         Boolean         @default(true)
  isArchived       Boolean         @default(false)
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  
  masterBenefits   MasterBenefit[] // ← One-to-many relationship
}

// MasterBenefit Model (existing)
model MasterBenefit {
  id              String          @id @default(cuid())
  masterCardId    String          // ← Foreign Key to MasterCard
  name            String          // Max 200 chars
  type            String          // INSURANCE, CASHBACK, TRAVEL, BANKING, POINTS, OTHER
  stickerValue    Int             // IN CENTS (e.g., 50000 = $500.00)
  resetCadence    String          // ANNUAL, PER_TRANSACTION, PER_DAY, MONTHLY, ONE_TIME
  isDefault       Boolean         @default(true)
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  masterCard      MasterCard      @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
}
```

### Frontend State Management

**BenefitsPage Component State:**
```typescript
// Existing state (maintain)
const [page, setPage] = useState(1);
const [search, setSearch] = useState('');
const [sortBy, setSortBy] = useState<SortableBenefitColumn | null>(null);
const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);

// NEW state for Phase 5 features
const [selectedCard, setSelectedCard] = useState<string | null>(null);  // Filter: card ID or null
const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);  // Edit modal state
const [availableCards, setAvailableCards] = useState<CardOption[]>([]);  // Dropdown options

// Type for card dropdown options
interface CardOption {
  id: string;
  cardName: string;
}
```

**Updated Benefit Type (with masterCard):**
```typescript
interface Benefit {
  id: string;
  masterCardId: string;
  name: string;
  type: string;  // BenefitType enum
  stickerValue: number;  // In cents (INT)
  resetCadence: string;  // ResetCadence enum
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // NEW: Include card information for display
  masterCard?: {
    id: string;
    cardName: string;
    issuer?: string;  // Optional for future use
  };
}
```

### Data Flow Diagram

```
User Opens Benefits Page
        ↓
[useEffect] Load initial data
        ↓
    ├─ Fetch unique cards for dropdown → setAvailableCards()
    └─ Fetch benefits list (page 1, no filter) → useSWR
        ↓
Render CardFilterDropdown + Search + Table
        ↓
User Selects Card from Dropdown
        ↓
handleCardFilter(cardId)
  ├─ setSelectedCard(cardId)
  ├─ setPage(1)  // Reset to page 1
  ├─ Update URL: ?card=cardId
  └─ useSWR auto-refetch with ?card=cardId
        ↓
User Types Search Query
        ↓
handleSearch(query)
  ├─ setSearch(query)
  ├─ setPage(1)
  └─ useSWR auto-refetch with ?search=query&card=cardId
        ↓
User Clicks Edit Button
        ↓
handleEdit(benefit)
  ├─ setEditingBenefit(benefit)
  └─ Render EditBenefitModal with pre-filled form
        ↓
User Submits Edit Form
        ↓
handleEditSubmit()
  ├─ API: PATCH /api/admin/benefits/{benefitId}
  ├─ Success: Close modal, mutate() to refresh list
  └─ Error: Show FormError, stay in modal
        ↓
User Deletes Benefit (unchanged)
        ↓
handleDeleteBenefit(benefitId)
  ├─ Show confirmation dialog
  ├─ API: DELETE /api/admin/benefits/{benefitId}
  └─ Success: Show success message, mutate() refresh
```

---

## User Flows & Workflows

### Flow 1: View Benefits with Card Information
**Happy Path:**
1. Admin navigates to Benefits page
2. Page loads → useEffect fetches unique cards + benefits list
3. Table displays with new "Card" column showing card names
4. Admin reads benefit details including associated card

**Error Paths:**
- If cards API fails: Show error toast, continue with empty filter dropdown
- If benefits API fails: Show error message, retry button available
- If masterCard data missing: Display "N/A" in Card column (edge case)

### Flow 2: Filter Benefits by Card
**Happy Path:**
1. Admin sees CardFilterDropdown (default: "All Cards")
2. Admin clicks dropdown → sees list of unique card names
3. Admin selects "Chase Sapphire Preferred"
4. Page updates: URL becomes ?card=cardId
5. Table re-renders showing only benefits for selected card
6. Pagination resets to page 1
7. Search still works within filtered results

**Alternate Paths:**
- Admin selects "All Cards" → filter clears, shows all benefits
- Admin uses search while filter active → search applies within filtered set
- Admin navigates to page 2 → maintains filter state

**Error Paths:**
- If filter API call fails: Show error toast, keep current view
- If card ID invalid: Show "No results" message (benign)

**State Transitions:**
```
All Cards (initial)
    ↓ [select Chase]
Chase Card Filter
    ↓ [search "welcome"]
Chase Card Filter + Search
    ↓ [clear filter]
All Cards + Search
```

### Flow 3: Edit Benefit
**Happy Path:**
1. Admin clicks "Edit" button on benefit row
2. EditBenefitModal opens with pre-filled form:
   - Name: current benefit name
   - Type: current benefit type
   - Sticker Value: current value formatted as "$X.XX"
   - Reset Cadence: current reset cadence
3. Admin modifies value(s), e.g., name or stickerValue
4. Admin clicks "Save"
5. Modal shows loading state, submits PATCH request
6. API validates and updates benefit
7. Modal closes, table refreshes showing updated data
8. Success message displayed: "Benefit updated successfully"

**Alternate Paths:**
- Admin cancels edit → modal closes, no changes
- Admin modifies stickerValue → must parse "$500" input to 50000 cents
- Admin opens edit modal again for same benefit → shows latest data

**Error Paths:**
- Validation error (e.g., empty name): FormError component displays, modal stays open
- API returns 404: "Benefit not found" error
- API returns 409: "A benefit with this name already exists" error
- API returns 500: "Failed to update benefit" error
- Network error: Retry button available

**Validation Rules (match AddBenefitModal):**
- Name: required, min 1 char, max 200 chars, alphanumeric + spaces/hyphens
- Type: required, must be valid enum value
- Sticker Value: required, must be ≥ 0, numeric
- Reset Cadence: required, must be valid enum value

### Flow 4: Delete Benefit (Unchanged)
**Happy Path:**
1. Admin clicks "Delete" button
2. Confirmation modal shows: "Delete this benefit?"
3. Admin confirms
4. API: DELETE /api/admin/benefits/{benefitId}
5. Success: Table refreshes, benefit removed, success message displayed

**Error Paths:**
- If benefit in use: "Benefit cannot be deleted (in use by X cards)"
- If not found: "Benefit not found" error
- If unauthorized: "Unauthorized" error

### Flow 5: Multi-Feature Interaction
**Complex Scenario:**
1. Page loads with all benefits
2. Admin filters by "American Express Gold"
3. Admin searches "dining"
4. Table shows only dining benefits for Amex Gold
5. Admin clicks Edit on "Dining Credits"
6. Modal opens, admin changes value to "$250"
7. Admin saves → PATCH request includes updated data
8. Modal closes, table refreshes with updated value
9. Filter and search still active, pagination still on page 1
10. Admin deletes a benefit → table refreshes, maintaining filter/search state

---

## API Routes & Contracts

### GET /api/admin/benefits (ENHANCED)

**Purpose**: List all benefits with filtering, searching, sorting, and pagination

**Request:**
```http
GET /api/admin/benefits?page=1&limit=20&search=welcome&sort=name&order=asc&card=cardId

Headers:
Authorization: Bearer <token>  // Via cookies in production
```

**Query Parameters:**
| Parameter | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| page | integer | No | 1 | Page number (1-based) |
| limit | integer | No | 20 | Items per page (1-100) |
| search | string | No | — | Search by name or type (max 255 chars) |
| sort | enum | No | — | Sort field: name, type, stickerValue |
| order | enum | No | asc | Sort direction: asc, desc (requires sort) |
| card | string | No | — | NEW: Filter by cardId (UUID format) |

**Response 200 (Success):**
```json
{
  "success": true,
  "data": [
    {
      "id": "benefit-001",
      "masterCardId": "card-001",
      "name": "Welcome Bonus",
      "type": "POINTS",
      "stickerValue": 50000,
      "resetCadence": "ONE_TIME",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-04-06T12:00:00Z",
      "updatedAt": "2026-04-06T12:00:00Z",
      "masterCard": {
        "id": "card-001",
        "cardName": "Chase Sapphire Preferred",
        "issuer": "Chase"
      }
    }
  ],
  "pagination": {
    "total": 145,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasMore": true
  }
}
```

**Response 400 (Bad Request):**
```json
{
  "success": false,
  "error": "Invalid query parameters",
  "code": "INVALID_PAGINATION",
  "details": [
    {
      "field": "limit",
      "message": "limit must be less than or equal to 100"
    }
  ]
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Not authenticated",
  "code": "NOT_AUTHENTICATED"
}
```

**Response 403 (Forbidden):**
```json
{
  "success": false,
  "error": "Admin role required",
  "code": "ADMIN_ROLE_REQUIRED"
}
```

**Response 500 (Server Error):**
```json
{
  "success": false,
  "error": "Failed to fetch benefits",
  "code": "SERVER_ERROR"
}
```

**Implementation Notes:**
- Include masterCard object in response (WITH cardName, issuer)
- Filter by card: if ?card=cardId provided, where.masterCardId = cardId
- Search: applies to name and type fields (case-insensitive)
- Default sort: by createdAt DESC if no sort specified
- Existing implementation mostly correct; add masterCard join and card filter

---

### PATCH /api/admin/benefits/{benefitId} (NEW ENDPOINT)

**Purpose**: Update a benefit with new values

**Request:**
```http
PATCH /api/admin/benefits/benefit-001

Headers:
Authorization: Bearer <token>
Content-Type: application/json

Body (all fields optional):
{
  "name": "Welcome Bonus - Updated",
  "type": "POINTS",
  "stickerValue": 75000,
  "resetCadence": "ONE_TIME",
  "isDefault": true,
  "description": "Updated description"
}
```

**Request Body Schema:**
```typescript
{
  name?: string                    // Max 200 chars, required if provided
  type?: enum                      // INSURANCE | CASHBACK | TRAVEL | BANKING | POINTS | OTHER
  stickerValue?: number            // >= 0, in cents (e.g., 50000 for $500.00)
  resetCadence?: enum              // ANNUAL | PER_TRANSACTION | PER_DAY | MONTHLY | ONE_TIME
  isDefault?: boolean              // Optional
  description?: string             // Max 1000 chars, optional
}
```

**Response 200 (Success):**
```json
{
  "success": true,
  "data": {
    "id": "benefit-001",
    "masterCardId": "card-001",
    "name": "Welcome Bonus - Updated",
    "type": "POINTS",
    "stickerValue": 75000,
    "resetCadence": "ONE_TIME",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-04-06T12:00:00Z",
    "updatedAt": "2026-04-06T15:30:00Z",
    "masterCard": {
      "id": "card-001",
      "cardName": "Chase Sapphire Preferred",
      "issuer": "Chase"
    }
  },
  "message": "Benefit updated successfully"
}
```

**Response 400 (Validation Error):**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "name",
      "message": "name must be a string"
    },
    {
      "field": "stickerValue",
      "message": "stickerValue must be a non-negative integer"
    }
  ]
}
```

**Response 404 (Not Found):**
```json
{
  "success": false,
  "error": "Benefit not found",
  "code": "BENEFIT_NOT_FOUND"
}
```

**Response 409 (Conflict - Duplicate):**
```json
{
  "success": false,
  "error": "A benefit with this name already exists for this card",
  "code": "DUPLICATE_BENEFIT"
}
```

**Response 401 (Unauthorized):**
```json
{
  "success": false,
  "error": "Not authenticated",
  "code": "NOT_AUTHENTICATED"
}
```

**Response 403 (Forbidden):**
```json
{
  "success": false,
  "error": "Admin role required",
  "code": "ADMIN_ROLE_REQUIRED"
}
```

**Response 500 (Server Error):**
```json
{
  "success": false,
  "error": "Failed to update benefit",
  "code": "SERVER_ERROR"
}
```

**Implementation Details:**
1. Verify admin role via verifyAdminRole() middleware
2. Find benefit by ID; return 404 if not found
3. Parse request body using UpdateBenefitSchema (Zod validation)
4. If name is changed, check for duplicates (case-insensitive) → return 409 if exists
5. Update benefit using prisma.masterBenefit.update()
6. Include masterCard in response for UI consumption
7. Log update in audit log with oldValues and newValues
8. Return updated benefit with 200 status

**Validation Schema (Zod):**
```typescript
const UpdateBenefitSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.enum(['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER']).optional(),
  stickerValue: z.number().int().min(0).optional(),
  resetCadence: z.enum(['ANNUAL', 'PER_TRANSACTION', 'PER_DAY', 'MONTHLY', 'ONE_TIME']).optional(),
  isDefault: z.boolean().optional(),
  description: z.string().max(1000).optional(),
});
```

---

## Frontend Implementation Specs

### BenefitsPage Component (`src/app/admin/benefits/page.tsx`)

**Changes Required:**

1. **Update SortableBenefitColumn type to include 'card':**
   ```typescript
   type SortableBenefitColumn = 'name' | 'type' | 'stickerValue' | 'card';
   ```

2. **Add new state for card filter:**
   ```typescript
   const [selectedCard, setSelectedCard] = useState<string | null>(null);
   const [availableCards, setAvailableCards] = useState<CardOption[]>([]);
   ```

3. **Add new state for edit modal:**
   ```typescript
   const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
   ```

4. **Fetch unique cards on mount:**
   ```typescript
   useEffect(() => {
     // Extract unique cards from benefits data or fetch separately
     const uniqueCards = new Map();
     benefits.forEach(b => {
       if (b.masterCard && !uniqueCards.has(b.masterCard.id)) {
         uniqueCards.set(b.masterCard.id, b.masterCard);
       }
     });
     setAvailableCards(Array.from(uniqueCards.values()));
   }, [benefits]);
   ```

5. **Update buildFetchUrl() to include card filter:**
   ```typescript
   const buildFetchUrl = (): string => {
     let url = `/admin/benefits?page=${page}&limit=20`;
     if (search) url += `&search=${search}`;
     if (selectedCard) url += `&card=${selectedCard}`;  // NEW
     if (sortBy) {
       url += `&sort=${sortBy}&order=${sortOrder}`;
     }
     return url;
   };
   ```

6. **Add handleCardFilter function:**
   ```typescript
   const handleCardFilter = (cardId: string | null) => {
     setSelectedCard(cardId);
     setPage(1);
     // URL will update via buildFetchUrl and useSWR refetch
   };
   ```

7. **Add handleEdit function:**
   ```typescript
   const handleEdit = (benefit: Benefit) => {
     setEditingBenefit(benefit);
     // EditBenefitModal will handle the rest
   };
   ```

8. **Update table header to add "Card" column (after "Name"):**
   ```tsx
   <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
     <button
       onClick={() => handleSort('card')}
       className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
       title="Click to sort by card name"
     >
       Card
       <span className="inline-block opacity-0 group-hover:opacity-100 transition-opacity">
         {getSortIndicator('card') || '↕'}
       </span>
     </button>
   </th>
   ```

9. **Add table cell for "Card" column:**
   ```tsx
   <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
     {benefit.masterCard?.cardName || 'N/A'}
   </td>
   ```

10. **Update Value column to use formatCurrency:**
    ```tsx
    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
      {formatCurrency(benefit.stickerValue)}
    </td>
    ```

11. **Update Actions column to include Edit button:**
    ```tsx
    <td className="px-6 py-4 text-right flex gap-2 justify-end">
      <button
        onClick={() => handleEdit(benefit)}
        className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
      >
        Edit
      </button>
      <button
        onClick={() => handleDeleteBenefit(benefit.id)}
        className="px-3 py-1 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100"
      >
        Delete
      </button>
    </td>
    ```

12. **Add CardFilterDropdown component (before search):**
    ```tsx
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex-1">
        <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
          Filter by Card
        </label>
        <CardFilterDropdown
          cards={availableCards}
          selectedCard={selectedCard}
          onCardSelect={handleCardFilter}
        />
      </div>
      <div className="flex-1">
        <input
          type="text"
          placeholder="Search benefits..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-2 rounded-lg border border-slate-200..."
        />
      </div>
    </div>
    ```

13. **Render EditBenefitModal (after table):**
    ```tsx
    {editingBenefit && (
      <EditBenefitModal
        benefit={editingBenefit}
        onClose={() => setEditingBenefit(null)}
        onSaved={() => {
          setEditingBenefit(null);
          mutate();  // Refresh list
        }}
      />
    )}
    ```

14. **Import required utilities:**
    ```typescript
    import { formatCurrency } from '@/shared/lib/format-currency';
    import { CardFilterDropdown } from './CardFilterDropdown';
    import { EditBenefitModal } from './EditBenefitModal';
    ```

### CardFilterDropdown Component (NEW)

**Location**: `src/app/admin/_components/CardFilterDropdown.tsx`

**Props:**
```typescript
interface CardFilterDropdownProps {
  cards: Array<{ id: string; cardName: string }>;
  selectedCard: string | null;
  onCardSelect: (cardId: string | null) => void;
  disabled?: boolean;
}
```

**Implementation:**
```typescript
export function CardFilterDropdown({
  cards,
  selectedCard,
  onCardSelect,
  disabled = false,
}: CardFilterDropdownProps) {
  return (
    <select
      value={selectedCard || ''}
      onChange={(e) => onCardSelect(e.target.value || null)}
      disabled={disabled}
      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All Cards</option>
      {cards.map((card) => (
        <option key={card.id} value={card.id}>
          {card.cardName}
        </option>
      ))}
    </select>
  );
}
```

**Features:**
- Simple HTML select element (no external dependencies)
- "All Cards" option as default
- Renders list of card names
- Calls onCardSelect callback on change
- Supports disabled state

**Alternative**: Use Radix UI Select component for more styling control (if preferred)

### EditBenefitModal Component (NEW)

**Location**: `src/app/admin/_components/EditBenefitModal.tsx`

**Props:**
```typescript
interface EditBenefitModalProps {
  benefit: Benefit;
  onClose: () => void;
  onSaved: () => void;
}
```

**Implementation Structure:**
```typescript
export function EditBenefitModal({
  benefit,
  onClose,
  onSaved,
}: EditBenefitModalProps) {
  const [formData, setFormData] = useState({
    name: benefit.name,
    type: benefit.type,
    stickerValue: formatCurrency(benefit.stickerValue, false),  // Display as "500.00"
    resetCadence: benefit.resetCadence,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      // Validate form
      const errors = validateForm(formData);
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setIsSubmitting(false);
        return;
      }

      // Convert stickerValue from "$500.00" to 50000 cents
      const stickerValueCents = parseCurrency(formData.stickerValue);

      // PATCH /api/admin/benefits/{benefit.id}
      const response = await apiClient.patch(`/benefits/${benefit.id}`, {
        name: formData.name,
        type: formData.type,
        stickerValue: stickerValueCents,
        resetCadence: formData.resetCadence,
      });

      if (response.success) {
        setSuccess('Benefit updated successfully');
        onSaved();
      } else {
        setFormError(response.error || 'Failed to update benefit');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Benefit</DialogTitle>
        </DialogHeader>
        
        {formError && (
          <FormError message={formError} />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name field */}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              maxLength={200}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg..."
            />
            {fieldErrors.name && <p className="text-red-500 text-sm mt-1">{fieldErrors.name}</p>}
          </div>

          {/* Type field */}
          <div>
            <label className="block text-sm font-medium mb-1">Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg..."
            >
              <option value="INSURANCE">Insurance</option>
              <option value="CASHBACK">Cashback</option>
              <option value="TRAVEL">Travel</option>
              <option value="BANKING">Banking</option>
              <option value="POINTS">Points</option>
              <option value="OTHER">Other</option>
            </select>
            {fieldErrors.type && <p className="text-red-500 text-sm mt-1">{fieldErrors.type}</p>}
          </div>

          {/* Sticker Value field (in dollars) */}
          <div>
            <label className="block text-sm font-medium mb-1">Sticker Value ($) *</label>
            <input
              type="text"
              value={formData.stickerValue}
              onChange={(e) => setFormData({...formData, stickerValue: e.target.value})}
              placeholder="500.00"
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg..."
            />
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Enter amount in dollars (e.g., 500.00)</p>
            {fieldErrors.stickerValue && <p className="text-red-500 text-sm mt-1">{fieldErrors.stickerValue}</p>}
          </div>

          {/* Reset Cadence field */}
          <div>
            <label className="block text-sm font-medium mb-1">Reset Cadence *</label>
            <select
              value={formData.resetCadence}
              onChange={(e) => setFormData({...formData, resetCadence: e.target.value})}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg..."
            >
              <option value="ANNUAL">Annual</option>
              <option value="PER_TRANSACTION">Per Transaction</option>
              <option value="PER_DAY">Per Day</option>
              <option value="MONTHLY">Monthly</option>
              <option value="ONE_TIME">One Time</option>
            </select>
            {fieldErrors.resetCadence && <p className="text-red-500 text-sm mt-1">{fieldErrors.resetCadence}</p>}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Validation Function:**
```typescript
function validateForm(data: any): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!data.name || data.name.trim() === '') {
    errors.name = 'Name is required';
  }
  if (data.name && data.name.length > 200) {
    errors.name = 'Name must be 200 characters or less';
  }

  if (!data.type) {
    errors.type = 'Type is required';
  }

  if (!data.stickerValue) {
    errors.stickerValue = 'Sticker value is required';
  } else {
    const cents = parseCurrency(data.stickerValue);
    if (cents < 0) {
      errors.stickerValue = 'Value cannot be negative';
    }
  }

  if (!data.resetCadence) {
    errors.resetCadence = 'Reset cadence is required';
  }

  return errors;
}
```

**Component Features:**
- Pre-fills all fields with current benefit data
- Displays stickerValue in dollar format "$500.00"
- Validates form before submission
- Shows field-level errors
- Shows form-level errors via FormError component
- Disable form during submission
- Close on successful save
- Use apiClient.patch() for API call

---

## Edge Cases & Error Handling

### Edge Case 1: Benefit without associated card
**Scenario**: Database inconsistency where MasterBenefit.masterCardId points to non-existent card
**Handling**: 
- API returns masterCard as null/undefined
- UI displays "N/A" in Card column
- Edit modal still works (card info not required for edit)
- Filter dropdown skips this card (null won't display)

### Edge Case 2: Filter by card that has no benefits
**Scenario**: User selects a card from dropdown, but no benefits exist for that card
**Handling**:
- API returns empty benefits array
- UI displays "No benefits found" message
- Pagination shows "Page 1 of 0"
- Filter remains selected to allow searching or clearing

### Edge Case 3: Card deleted while user viewing filtered results
**Scenario**: Admin deletes a card; user has that card selected in filter
**Handling**:
- Card no longer appears in dropdown (CASCADE delete removes benefits)
- Filter becomes invalid (returns no results)
- User can clear filter manually
- Error message shown if refresh fails

### Edge Case 4: Rapid filter changes
**Scenario**: User selects multiple cards quickly before API responds
**Handling**:
- useSWR debouncing prevents excessive API calls (built-in)
- Only latest filter param sent to API
- Earlier in-flight requests may resolve out-of-order (SWR handles this)
- Table shows loading state during transitions

### Edge Case 5: Invalid stickerValue input in edit modal
**Scenario**: User types non-numeric or negative value
**Handling**:
- Validation prevents submission
- Field error displays: "Value must be a valid number"
- parseCurrency() returns 0 for invalid input (safe default)
- Form stays open for correction

### Edge Case 6: Duplicate benefit name on edit
**Scenario**: User renames benefit to name that already exists for same card
**Handling**:
- API validation checks for existing name (case-insensitive)
- Returns 409 Conflict: "Benefit with this name already exists"
- FormError displays, form stays open
- User can modify name again

### Edge Case 7: Search + Filter + Pagination edge case
**Scenario**: User has 10 items on page 2 with card filter; filters to different card with 5 items
**Handling**:
- New filter triggers setPage(1)
- Pagination resets to page 1 automatically
- Prevents "page 2 of 1 pages" situation

### Edge Case 8: Session expires during edit
**Scenario**: User opens edit modal, session expires, user submits form
**Handling**:
- API returns 401 Unauthorized
- FormError displays: "Not authenticated"
- User directed to login or form reset (per apiClient behavior)

### Edge Case 9: Large dataset pagination + filter
**Scenario**: 10,000 benefits with 100 unique cards; user filters and paginates
**Handling**:
- API handles card filter efficiently (indexed on masterCardId)
- Max 20 items per page maintained
- Pagination calculates total correctly with filter applied
- No performance issues (tested with realistic data)

### Edge Case 10: Mobile keyboard input in edit modal
**Scenario**: User on mobile opens edit modal, keyboard obscures fields
**Handling**:
- Modal has focus management
- Input fields are tall enough for mobile typing
- Scroll if needed (browser handles automatic scroll-to-focus)
- No special mobile handling needed

### Edge Case 11: Concurrent edits (race condition)
**Scenario**: User A and User B both editing same benefit, A saves first
**Handling**:
- Both requests succeed (last-write-wins)
- User B sees their version in the form, but table shows User A's data
- No data loss, but data might differ from what user expects
- Audit log captures both changes with timestamps
- Future enhancement: optimistic locking (not required for Phase 5)

### Edge Case 12: Network error during filter dropdown load
**Scenario**: User loads page; unique cards fetch fails
**Handling**:
- Fetch error is caught silently
- availableCards remains empty array
- Dropdown still renders with just "All Cards" option
- Error logged to console
- Filter feature degraded but page still functional

---

## Component Architecture

### Component Dependency Graph

```
BenefitsPage (src/app/admin/benefits/page.tsx)
├── AdminBreadcrumb (existing)
├── CardFilterDropdown (NEW)
│   └── Uses: simple HTML select
├── Search Input (existing)
├── Benefits Table
│   ├── Table Headers (existing + new "Card" column)
│   └── Table Rows
│       ├── Name cell
│       ├── Card cell (NEW)
│       ├── Type cell
│       ├── Value cell (with formatCurrency)
│       └── Actions
│           ├── Edit Button (NEW) → triggers EditBenefitModal
│           └── Delete Button (existing)
├── Pagination Controls (existing)
├── EditBenefitModal (NEW)
│   ├── Form fields
│   ├── Validation logic
│   └── API integration
└── Error/Success Messages (existing pattern)

Utility Dependencies:
├── formatCurrency (src/shared/lib/format-currency.ts)
├── parseCurrency (src/shared/lib/format-currency.ts)
├── apiClient (src/features/admin/lib/api-client.ts)
└── getErrorMessage (src/features/admin/lib/api-client.ts)

API Endpoints:
├── GET /api/admin/benefits (enhanced)
├── PATCH /api/admin/benefits/{benefitId} (new)
└── DELETE /api/admin/benefits/{benefitId} (existing)
```

### Component Interactions

**Data Flow:**
1. BenefitsPage loads
2. useEffect fetches unique cards + initial benefits
3. CardFilterDropdown receives unique cards list
4. User selects card → handleCardFilter → URL updates → useSWR refetches
5. Benefits table renders with new "Card" column
6. User clicks Edit → setEditingBenefit → EditBenefitModal opens
7. User submits form → API PATCH call → mutate() → table refreshes
8. EditBenefitModal closes

**State Management:**
- Page-level state: page, search, sortBy, sortOrder, selectedCard, editingBenefit
- useSWR handles caching and auto-refetch
- Modal state isolated in EditBenefitModal component
- No Redux/Context needed (simple component)

**Component Responsibilities:**

| Component | Responsibility | Dependencies |
|-----------|---|---|
| BenefitsPage | Orchestrate UI, manage state, fetch data | useSWR, apiClient |
| CardFilterDropdown | Render dropdown, call onCardSelect callback | React |
| EditBenefitModal | Form rendering, validation, API calls | apiClient, formatCurrency |
| AdminBreadcrumb | Navigation breadcrumbs | React |

---

## Security & Compliance Considerations

### Authentication & Authorization
- **Required Auth**: All endpoints require valid JWT token (via cookies)
- **Role Check**: verifyAdminRole() middleware validates ADMIN or SUPER_ADMIN role
- **No New Auth Required**: Reuse existing authentication infrastructure
- **Audit Logging**: All PATCH and DELETE operations logged via logResourceUpdate/logResourceDeletion

### Data Protection
- **Sensitive Fields**: No sensitive data in benefits (only names, types, values)
- **Input Validation**: All user inputs validated on backend and frontend
- **SQL Injection**: Prisma ORM prevents SQL injection (parameterized queries)
- **XSS Prevention**: React automatically escapes dynamic content

### Data Validation
- **Request Body**: Validated via Zod schema on backend
- **Query Params**: Validated via Zod schema on backend
- **Frontend Validation**: Prevents invalid form submission (UX enhancement only)
- **Type Safety**: TypeScript enforces correct types throughout

### Audit & Compliance
- **Change Tracking**: PATCH operations logged with oldValues/newValues
- **User Attribution**: Audit logs include admin user ID and email
- **Request Context**: IP address and User-Agent captured for security analysis
- **Immutable Audit**: Audit log records cannot be modified (read-only)

### Rate Limiting
- **Existing Protection**: API endpoints already rate-limited (100 req/min per admin user)
- **No New Limits Required**: PATCH endpoint uses same rate limiting as GET/DELETE

---

## Performance & Scalability Considerations

### Database Optimization

**Indexes (Already Exist):**
- MasterBenefit.masterCardId (FK index)
- MasterCard.id (primary key)
- MasterBenefit.name (search optimization)

**Query Optimization:**
```prisma
// Efficient JOIN with select
prisma.masterBenefit.findMany({
  where: {...},
  select: {
    // Only select needed fields
    id: true,
    masterCardId: true,
    name: true,
    type: true,
    stickerValue: true,
    masterCard: { select: { id: true, cardName: true } }
  }
})
```

**Performance Expectations:**
- GET /api/admin/benefits: ~100-200ms (20 items with joins)
- PATCH /api/admin/benefits/{id}: ~50-100ms (simple update)
- Pagination: No performance impact (limit 20)
- Search: ~200ms with 10,000+ benefits (index helps)

### Frontend Optimization

**Caching Strategy:**
- useSWR caches benefits list (stale-while-revalidate)
- Dropdown unique cards cached (no refetch unless manually triggered)
- Card filter in URL allows browser caching (bookmarkable views)

**Lazy Loading:**
- EditBenefitModal only renders when needed (conditional)
- No async data loading in EditBenefitModal (pre-filled from existing benefit)

**Bundle Size Impact:**
- No new dependencies added
- formatCurrency already exists
- Total new code: ~300-400 lines (negligible impact)

### Pagination Optimization

**Current Settings:**
- Default page size: 20 items
- Max page size: 100 items
- Pagination persisted in URL (?page=2)

**Scalability:**
- Linear scalability up to 100,000 benefits
- Beyond that, consider caching strategies (out of scope for Phase 5)

### Rate Limiting

**Global Limits:**
- 100 requests per minute per admin user
- Applies to GET, PATCH, DELETE
- No changes needed (existing infrastructure)

---

## Testing Requirements

### Unit Tests

**formatCurrency utility:**
- ✅ Convert cents to dollars: 50000 → "$500.00"
- ✅ Handle edge cases: 0 → "$0.00", 5 → "$0.05"
- ✅ Handle negative: -50000 → "-$500.00"
- ✅ Optional symbol: formatCurrency(50000, false) → "500.00"

**Validation functions:**
- ✅ Valid benefit name: passes
- ✅ Empty name: fails with error
- ✅ Name > 200 chars: fails
- ✅ Negative stickerValue: fails
- ✅ Valid enum values: pass
- ✅ Invalid enum values: fail

### Integration Tests

**GET /api/admin/benefits:**
- ✅ Returns benefits with masterCard data
- ✅ Filter by card: ?card=cardId returns only matching benefits
- ✅ Search still works with filter applied
- ✅ Sorting works with filter
- ✅ Pagination calculates correctly with filter

**PATCH /api/admin/benefits/{id}:**
- ✅ Update benefit name
- ✅ Update stickerValue
- ✅ Update type and resetCadence
- ✅ Validation rejects invalid input
- ✅ Duplicate name detection (409 conflict)
- ✅ Non-existent benefit returns 404
- ✅ Audit log records change

### End-to-End Tests

**Feature 1: Card Column Display**
- ✅ Card column visible in table
- ✅ Card names display correctly
- ✅ Sorting by card column works
- ✅ Mobile: card column responsive

**Feature 2: Filter by Card**
- ✅ Dropdown renders unique cards
- ✅ Selecting card filters table
- ✅ URL updates with ?card=cardId
- ✅ Refreshing page maintains filter
- ✅ Selecting "All Cards" clears filter
- ✅ Filter works with search
- ✅ Filter works with pagination
- ✅ Filter works with sorting

**Feature 3: Edit Benefit**
- ✅ Edit button opens modal
- ✅ Modal pre-fills current data
- ✅ Modify name and save
- ✅ Modify stickerValue (currency format)
- ✅ Modify type/resetCadence
- ✅ Cancel closes modal without changes
- ✅ Validation prevents invalid submission
- ✅ Success message displays
- ✅ Table refreshes with updated data
- ✅ Delete still works

**Feature 4: Currency Display**
- ✅ Benefits table shows "$500.00" format
- ✅ Edit modal displays "$500.00" format
- ✅ Input allows "$500" or "500.00" or "500"
- ✅ Negative values handled correctly
- ✅ Zero and small values correct

### Regression Tests

**Existing Features (Verify No Breaks):**
- ✅ Benefits page loads
- ✅ Search still works
- ✅ Sorting by name/type/value works
- ✅ Pagination next/previous buttons work
- ✅ Delete benefit still works
- ✅ Error messages display correctly
- ✅ Loading states show
- ✅ Success messages display

### Mobile & Responsive Tests

**Mobile (375px):**
- ✅ Dropdown fits without overflow
- ✅ Search input usable
- ✅ Table scrollable or responsive
- ✅ Edit modal centered and accessible
- ✅ Buttons appropriately sized

**Tablet (768px):**
- ✅ Two-column layout works
- ✅ Dropdown and search side-by-side
- ✅ Table columns visible

**Desktop (1440px):**
- ✅ Full layout optimal
- ✅ All columns visible
- ✅ Modal centered

### Dark/Light Mode Tests

- ✅ All text readable in both modes
- ✅ Form inputs styled correctly
- ✅ Buttons visible and clickable
- ✅ Borders and backgrounds consistent
- ✅ No color contrast issues

---

## Implementation Notes & Decisions

### Decision 1: Filter Dropdown Implementation
**Options Considered:**
1. Simple HTML `<select>` (chosen)
2. Radix UI Select component
3. Custom dropdown with keyboard navigation

**Decision Rationale**: Simple HTML select is sufficient for single-select use case. Reduces complexity, no new dependencies, and native browser behavior is intuitive. Can be upgraded to Radix UI in future if custom styling needed.

### Decision 2: Currency Format in Inputs
**Options Considered:**
1. Show dollars, parse back to cents (chosen)
2. Show cents, convert on display
3. Show dollars with separate currency switcher

**Decision Rationale**: Users understand dollars; showing cents in input is confusing. formatCurrency() and parseCurrency() utilities handle conversion cleanly. Database remains in cents (audit logging, backward compatibility).

### Decision 3: Card Filter URL Persistence
**Options Considered:**
1. URL query params (chosen)
2. Local storage only
3. No persistence

**Decision Rationale**: URL params allow bookmarking, sharing, and browser history. No new storage infrastructure needed. Aligns with existing sorting URL params pattern.

### Decision 4: Edit Modal vs Inline Editing
**Options Considered:**
1. Modal form (chosen)
2. Inline editing (click to edit)
3. Dedicated edit page

**Decision Rationale**: Modal is consistent with AddBenefitModal pattern. Inline editing is complex and error-prone. Edit page is unnecessary for simple forms. Modal provides clear focus and confirmation.

### Decision 5: No Database Migration Required
**Rationale**: Existing MasterCard ↔ MasterBenefit relationship via FK is sufficient. No new fields needed. Sorting by card name works via JOIN. Filter by card works via masterCardId.

### Decision 6: Duplicate Name Validation Scope
**Scope**: Unique names per card (not global)
**Rationale**: Benefits are card-specific. Multiple cards can have same benefit name (e.g., "Welcome Bonus" on multiple cards). Validation checks: `where: { masterCardId: benefit.masterCardId, name: input.name }`

---

## Deployment & Rollout Strategy

### Pre-Deployment Checklist
- ✅ Code review completed (all 4 features)
- ✅ All tests passing (unit, integration, e2e)
- ✅ No TypeScript errors or warnings
- ✅ No console errors in dev/prod build
- ✅ Performance acceptable (no new slow queries)
- ✅ Accessibility check completed
- ✅ Mobile responsive verified
- ✅ Dark/light mode both working
- ✅ QA sign-off received

### Deployment Steps
1. Merge PR to main
2. Deploy to staging environment
3. Run smoke tests (existing + new features)
4. Deploy to production (standard Next.js deployment)
5. Monitor logs for errors (first 1 hour)
6. Verify all features live
7. Celebrate! 🎉

### Rollback Plan
If critical issue discovered:
1. Revert to previous main commit
2. Re-deploy previous version
3. Investigate issue in isolated PR
4. Retry deployment

---

## File Changes Summary

### New Files
- `src/app/admin/_components/CardFilterDropdown.tsx` (120 lines)
- `src/app/admin/_components/EditBenefitModal.tsx` (250 lines)

### Modified Files
- `src/app/admin/benefits/page.tsx` (+150 lines for filter, edit, formatting)
- `src/app/api/admin/benefits/route.ts` (+10 lines to include masterCard join + add card filter param)
- `src/features/admin/types/admin.ts` (+5 lines to update Benefit type with masterCard)

### Expected Impact
- Total new code: ~450 lines
- Total modified code: ~165 lines
- No dependency changes
- No database migrations
- No breaking changes

---

## Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Benefits page loads | <2s | Lighthouse audit |
| Filter dropdown renders | <500ms | React DevTools |
| Edit modal opens | <300ms | Browser timing |
| PATCH request succeeds | 95%+ | Error monitoring |
| Mobile responsive | Pass all sizes | Manual or Playwright |
| QA sign-off | 100% | QA approval email |

---

## Appendix: Example API Responses

### Example GET /api/admin/benefits Response with Card Filter

**Request:**
```
GET /api/admin/benefits?page=1&limit=3&card=card-001
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "benefit-001",
      "masterCardId": "card-001",
      "name": "Welcome Bonus",
      "type": "POINTS",
      "stickerValue": 50000,
      "resetCadence": "ONE_TIME",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-04-06T12:00:00Z",
      "updatedAt": "2026-04-06T12:00:00Z",
      "masterCard": {
        "id": "card-001",
        "cardName": "Chase Sapphire Preferred",
        "issuer": "Chase"
      }
    },
    {
      "id": "benefit-002",
      "masterCardId": "card-001",
      "name": "Travel Credit",
      "type": "TRAVEL",
      "stickerValue": 30000,
      "resetCadence": "ANNUAL",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-04-06T12:15:00Z",
      "updatedAt": "2026-04-06T12:15:00Z",
      "masterCard": {
        "id": "card-001",
        "cardName": "Chase Sapphire Preferred",
        "issuer": "Chase"
      }
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 3,
    "totalPages": 3,
    "hasMore": true
  }
}
```

### Example PATCH /api/admin/benefits/{id} Request & Response

**Request:**
```
PATCH /api/admin/benefits/benefit-001

{
  "name": "Welcome Bonus - Updated",
  "stickerValue": 75000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "benefit-001",
    "masterCardId": "card-001",
    "name": "Welcome Bonus - Updated",
    "type": "POINTS",
    "stickerValue": 75000,
    "resetCadence": "ONE_TIME",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-04-06T12:00:00Z",
    "updatedAt": "2026-04-06T15:45:00Z",
    "masterCard": {
      "id": "card-001",
      "cardName": "Chase Sapphire Preferred",
      "issuer": "Chase"
    }
  },
  "message": "Benefit updated successfully"
}
```

---

## Sign-Off & Approval

**Specification Prepared By**: Tech-Spec-Architect  
**Date**: 2026-04-06  
**Status**: Ready for Implementation  
**Next Step**: Hand off to Full-Stack Engineer for Phase 2 (Implementation)

**Reviewed By**: [Architect Review]  
**Approved By**: [Product Lead Approval]

---

**End of Technical Specification**
