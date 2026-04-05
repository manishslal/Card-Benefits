# Card Discovery & Selection Feature - Technical Specification

## Executive Summary & Goals

The **Card Discovery & Selection** feature empowers users to explore a curated catalog of 10+ master credit cards and seamlessly add them to their personal collection. This feature serves as the gateway for users to onboard and manage their credit card portfolio. By providing rich previews of card benefits before commitment, users can make informed decisions about which cards to track. This feature is critical for user acquisition and engagement—it transforms passive browsing into active portfolio management.

### Primary Objectives
- **Enable Card Discovery**: Present all available master cards with rich metadata in a filterable, responsive catalog
- **Inform Decisions**: Display comprehensive benefit previews before users add cards to their collection
- **Streamline Onboarding**: Provide a quick-add flow that requires minimal user input to get started
- **Support Customization**: Allow users to override default annual fees and assign custom card names
- **Drive Engagement**: Make card selection intuitive and visually appealing across all device sizes
- **Maintain Data Integrity**: Prevent duplicate card ownership, validate input, and handle errors gracefully

### Success Criteria
- Users can discover and browse all available cards without friction
- 95%+ of card discovery requests complete in <500ms (p95)
- Benefit preview data is accurate and complete for all master cards
- Users can add a card with 2-3 clicks in the happy path
- Mobile responsiveness is perfect across iOS, Android, tablet, and desktop
- Zero card duplication errors; constraint validation prevents duplicate ownership
- Error states are user-friendly and guide next steps
- Loading states are clear and prevent accidental duplicate submissions

---

## Functional Requirements

### Feature Scope
This feature is **scoped to card discovery and initial collection management** and excludes:
- Benefit tracking (separate feature: Benefit Tracking & Management)
- Card comparison tools (future enhancement)
- Card replacement/upgrade workflows (future)
- Bulk import of cards (separate feature: CSV Import)

### User Roles & Permissions

**Any Authenticated User** can:
- View the master card catalog (filtered, paginated)
- View card details and benefit previews
- Add a card to their collection (PlayerProfile-scoped)
- Customize annual fee and card name during addition
- See which cards they already own (prevent duplicates)

**System** (Admin features, not in scope):
- Manage master cards and their benefits (seed/update in database)

### System Constraints & Limits

| Constraint | Value | Rationale |
|-----------|-------|-----------|
| Max Cards Browsable | 500+ | Master catalog size |
| Page Size (Pagination) | 12-20 cards | Visual grid optimization |
| Benefit Preview Limit | 5 benefits | UI space constraint |
| Custom Card Name Length | Max 100 characters | Database varchar constraint |
| Annual Fee Precision | Integer cents | Match financial precision |
| API Response Timeout | 5 seconds | User experience threshold |
| Concurrent Add Requests | No duplicate submission | Race condition prevention |

---

## Implementation Phases

### Phase 1: API Foundation & Data Layer (3-4 days)
**Objective**: Build robust backend APIs for card discovery with comprehensive error handling

**Key Deliverables**:
- ✅ GET `/api/cards/available` - List master cards with pagination and filtering
- ✅ GET `/api/cards/:cardId` - Card detail view with full benefits list
- ✅ POST `/api/cards/add` - Add card to user collection (with validation)
- Database indexes optimized for discovery queries
- Comprehensive error handling and validation

**Dependencies**: None (existing MasterCard & MasterBenefit models)

### Phase 2: Frontend Discovery Interface (3-4 days)
**Objective**: Build responsive UI components for browsing and viewing cards

**Key Deliverables**:
- CardCatalog component (grid view with pagination)
- CardPreviewCard component (teaser card with hover interactions)
- CardDetailsModal component (full details with benefit list)
- MobileCardDrawer component (mobile-optimized variant)
- Loading skeletons and error states

**Dependencies**: Phase 1 APIs complete

### Phase 3: Add-to-Collection Flow (2-3 days)
**Objective**: Build the interaction layer for adding cards to user's collection

**Key Deliverables**:
- QuickAddForm component (modal with fee override, custom name)
- Duplicate detection UI (warn user if card already owned)
- Success feedback with next-step CTAs
- Optimistic UI updates and error recovery

**Dependencies**: Phase 2 UI components + Phase 1 APIs

### Phase 4: State Management & Integration (2-3 days)
**Objective**: Wire up client-side state and integrate all pieces

**Key Deliverables**:
- React Context or state hook for card discovery session
- Manage pagination, filters, and modal visibility
- Handle real-time card list updates (invalidate cache after add)
- Integrate with authentication (player profile context)

**Dependencies**: Phases 1-3 complete

### Phase 5: Testing, Mobile Polish & Deployment (2-3 days)
**Objective**: QA, responsive design finalization, production readiness

**Key Deliverables**:
- Unit tests for API routes and validation logic
- Component integration tests (Playwright/Vitest)
- Mobile responsiveness testing (iOS, Android, tablet)
- Performance profiling and optimizations
- Deployment guides and monitoring

**Dependencies**: Phases 1-4 complete

---

## Data Schema / State Management

### Data Model (Existing)

The feature leverages three core entities that are **already defined in Prisma schema**:

#### MasterCard
```prisma
model MasterCard {
  id               String          @id @default(cuid())
  issuer           String          // e.g., "Chase", "American Express"
  cardName         String          // e.g., "Sapphire Preferred"
  defaultAnnualFee Int             // in cents, e.g., 9500 = $95.00
  cardImageUrl     String          // URL to card image asset
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  masterBenefits   MasterBenefit[] // Relationship
  userCards        UserCard[]      // Relationship
  
  @@unique([issuer, cardName])
  @@index([issuer])
  @@index([cardName])
}
```

**Key Notes**:
- `id`: Unique card identifier; use CUID for distributed ID generation
- `issuer` + `cardName` composite unique constraint prevents duplicates in master catalog
- Indexes on `issuer` and `cardName` support fast filtering/search

#### MasterBenefit
```prisma
model MasterBenefit {
  id           String     @id @default(cuid())
  masterCardId String     // Foreign key to MasterCard
  name         String     // e.g., "$300 travel credit"
  type         String     // Enum-style: "Travel", "Dining", "Transfer", "Insurance"
  stickerValue Int        // Dollar value in cents
  resetCadence String     // e.g., "Annual", "Monthly", "One-time", "Unlimited"
  isActive     Boolean    @default(true)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  masterCard   MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
  
  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
}
```

**Key Notes**:
- Cascading delete: if a MasterCard is deleted, all its MasterBenefits are deleted
- Multiple benefits per card; no unique constraint (allows duplicate benefit names for different card variants)
- Type and resetCadence are string enums (seed with specific values)

#### UserCard (Updated on POST /api/cards/add)
```prisma
model UserCard {
  id              String        @id @default(cuid())
  playerId        String        // Links to current Player (user's profile)
  masterCardId    String        // Links to master card
  customName      String?       // User-provided override, e.g., "My Chase Sapphire"
  actualAnnualFee Int?          // User-provided override (in cents)
  renewalDate     DateTime      // Auto-calculated or set by user
  isOpen          Boolean       @default(true)
  status          String        @default("ACTIVE")
  statusChangedAt DateTime?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  userBenefits    UserBenefit[]
  masterCard      MasterCard    @relation(fields: [masterCardId], references: [id])
  player          Player        @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  @@unique([playerId, masterCardId])  // CRITICAL: Prevents duplicate card ownership
  @@index([playerId])
  @@index([masterCardId])
}
```

**Key Notes**:
- `playerId + masterCardId` composite unique constraint is **critical**—prevents a user from adding the same card twice
- `customName` and `actualAnnualFee` are nullable; if not provided, use MasterCard defaults
- `renewalDate` should default to 1 year from now
- `status` supports future state transitions (ACTIVE, ARCHIVED, CLOSED, etc.)

#### UserBenefit (Created via Cascade)
```prisma
model UserBenefit {
  id             String    @id @default(cuid())
  userCardId     String    // Links to UserCard
  playerId       String    // Denormalized for efficient queries
  name           String    // Copied from MasterBenefit
  type           String    // Copied from MasterBenefit
  stickerValue   Int       // Copied from MasterBenefit
  resetCadence   String    // Copied from MasterBenefit
  isUsed         Boolean   @default(false)
  timesUsed      Int       @default(0)
  expirationDate DateTime?
  status         String    @default("ACTIVE")
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  userCard       UserCard  @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  player         Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  @@unique([userCardId, name])  // Prevents duplicate benefit records per card
  @@index([userCardId])
  @@index([playerId])
}
```

**Key Notes**:
- When a card is added, benefits are created by copying MasterBenefit rows
- The `userCardId + name` unique constraint ensures benefits aren't duplicated per card

### Client-Side State Management

#### Discovery Session State
```typescript
interface CardDiscoveryState {
  // Pagination
  currentPage: number;
  pageSize: number;
  totalCards: number;
  
  // Filtering
  searchQuery: string;
  selectedIssuer: string | null;
  selectedBenefitType: string | null;
  
  // Data
  cards: AvailableCard[];
  selectedCard: CardDetails | null;
  userOwnedCardIds: Set<string>; // Cards user already owns
  
  // UI States
  isLoading: boolean;
  isLoadingMore: boolean;
  error: ApiError | null;
  
  // Modal States
  showDetailsModal: boolean;
  showAddModal: boolean;
  isSubmittingAdd: boolean;
  addError: ApiError | null;
  
  // Optimistic Updates
  pendingAddCardId: string | null;
}
```

#### Add-to-Collection Form State
```typescript
interface AddCardFormState {
  masterCardId: string;
  customName: string;      // Optional override
  actualAnnualFee: number; // Optional override (in cents)
  renewalDate: Date;       // Auto-calculated, user can adjust
  
  // Validation
  errors: Record<string, string>;
  isValid: boolean;
  isTouched: Record<string, boolean>;
}
```

---

## User Flows & Workflows

### Flow 1: Browse & Filter Cards (Primary Discovery Path)

```
Start: User navigates to /cards/discover
  ↓
[Load card catalog]
  ├─ GET /api/cards/available (page=1, limit=12)
  ├─ GET /api/auth/session → Fetch user's owned cards
  └─ Parallel requests for speed
  ↓
[Render card grid with pagination]
  ├─ Show 12 cards per page
  ├─ Display issuer, name, image, benefit preview (3 benefits)
  ├─ Visual indicator: "You own this" on user's cards
  └─ Pagination controls (prev/next + numbered pages)
  ↓
[User browsing options]
  ├─ Scenario A: Click filter by issuer
  │   └─ GET /api/cards/available?issuer=Chase
  ├─ Scenario B: Search by card name
  │   └─ GET /api/cards/available?search=Sapphire
  ├─ Scenario C: Scroll to next page
  │   └─ GET /api/cards/available?page=2
  └─ Scenario D: Click on card → Flow 2
```

**Key States**:
- Loading: Show skeleton cards during initial load
- Error: Show retry banner + empty state explanation
- No Results: Show "No cards match your filters" with clear filters button

### Flow 2: View Card Details & Preview Benefits

```
Start: User clicks on a card in the catalog
  ↓
[Open card details modal]
  ├─ Show card image (full size)
  ├─ Display card metadata (issuer, name, default annual fee)
  ├─ GET /api/cards/{cardId} → Fetch full benefit list
  └─ Display full benefit list with:
      ├─ Benefit name
      ├─ Type badge (Travel, Dining, etc.)
      ├─ Sticker value (e.g., "$300")
      └─ Reset cadence (Annual, Monthly, etc.)
  ↓
[User actions in modal]
  ├─ Option A: Click "Add to My Cards" → Flow 3
  ├─ Option B: Click back/close → Return to catalog
  └─ Option C: Scroll through benefits list (mobile drawer slides up)
```

**Key States**:
- Loading: Show skeleton content while benefits load
- Error: Show "Unable to load benefits. Try again." + retry button
- Success: All benefits displayed in scrollable list

### Flow 3: Add Card to Collection (Quick-Add Form)

```
Start: User clicks "Add to My Cards" from detail view
  ↓
[Open Add Card Modal/Form]
  ├─ Pre-fill: Card name (use MasterCard cardName)
  ├─ Pre-fill: Annual fee (use MasterCard defaultAnnualFee)
  ├─ Pre-fill: Renewal date (today + 1 year)
  └─ Display form fields:
      ├─ Custom Card Name (optional text input)
      ├─ Actual Annual Fee (optional number input)
      ├─ Renewal Date (date picker)
      └─ "Add Card" button (primary CTA)
  ↓
[Validation & Error Handling]
  ├─ On input change:
  │   ├─ Validate custom name (max 100 chars)
  │   ├─ Validate annual fee (0-9999 dollars, whole cents)
  │   └─ Validate renewal date (present + future)
  └─ Show field-level error messages
  ↓
[On Submit → POST /api/cards/add]
  ├─ Optimistic UI: Disable button, show loading state
  ├─ POST body:
  │   ├─ masterCardId
  │   ├─ customName (or null)
  │   ├─ actualAnnualFee (or null)
  │   └─ renewalDate
  ├─ API validates:
  │   ├─ User authentication & player context
  │   ├─ MasterCard exists
  │   ├─ User doesn't already own this card (unique constraint check)
  │   └─ Input validation (name length, fee range, date logic)
  └─ On success:
      ├─ Create UserCard record
      ├─ Create UserBenefit records (copy from MasterBenefit)
      └─ Return newly created UserCard with benefits
  ↓
[Success State]
  ├─ Show success toast: "Card added to your collection!"
  ├─ Close modal
  ├─ Optionally: Navigate to card detail or /cards/my-cards
  └─ Mark card as "You own this" in catalog
  ↓
[Error Path]
  ├─ Duplicate card error:
  │   ├─ Show user-friendly message: "You already own this card"
  │   └─ Offer: "View it in your collection" button
  ├─ Validation error:
  │   ├─ Show field-level errors
  │   └─ Keep modal open for correction
  └─ Server error (500):
      ├─ Show: "Something went wrong. Please try again."
      └─ Offer: Retry button + contact support link
```

**Key States**:
- Ready: Form is clean, button enabled
- Validating: Show inline validation feedback
- Submitting: Button disabled, loading spinner, prevent escape/close
- Success: Toast notification + modal close
- Error: Field errors or modal-level error alert

### Flow 4: Handle Duplicate Ownership (Race Condition Prevention)

```
Scenario: User has multiple tabs open; adds same card in tab A, then tab B

Tab A:
  POST /api/cards/add {masterCardId: "card123"}
  ↓ (Processing...)
  Creates UserCard successfully ✓

Tab B:
  [User unaware of tab A action]
  POST /api/cards/add {masterCardId: "card123"}
  ↓
  Database constraint violation: playerId + masterCardId already exists
  ↓
  API returns 409 Conflict:
  {
    "success": false,
    "error": "Card already in collection",
    "code": "CARD_DUPLICATE"
  }
  ↓
  UI shows: "You already own this card. View in my collection?"
  ↓
  User can click link to view owned card or go back
```

**Prevention Layers**:
1. Database: `@@unique([playerId, masterCardId])` constraint
2. Client: Show "You own this" indicators before modal
3. Client: Disable "Add" if card is in user's collection
4. API: Double-check ownership before creating record
5. API: Return clear 409 error with guidance

---

## API Routes & Contracts

### 1. GET /api/cards/available

**Purpose**: Retrieve paginated list of master cards with optional filtering

**Method**: `GET`

**Query Parameters**:
```typescript
interface GetAvailableCardsQuery {
  page?: number;          // Default: 1, Min: 1
  limit?: number;         // Default: 12, Min: 1, Max: 50
  issuer?: string;        // Optional filter (case-insensitive partial match)
  search?: string;        // Optional search by card name (case-insensitive)
  benefitType?: string;   // Optional filter by benefit type
}
```

**Request Example**:
```
GET /api/cards/available?page=1&limit=12&issuer=Chase&search=Sapphire
```

**Response 200 - Success**:
```json
{
  "success": true,
  "cards": [
    {
      "id": "cuid_mastercard_001",
      "issuer": "Chase",
      "cardName": "Sapphire Preferred",
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://cdn.example.com/cards/chase-sapphire.jpg",
      "benefits": {
        "count": 8,
        "preview": [
          "$300 annual travel credit",
          "3x points on dining",
          "2x points on travel"
        ]
      }
    },
    {
      "id": "cuid_mastercard_002",
      "issuer": "Chase",
      "cardName": "Freedom Unlimited",
      "defaultAnnualFee": 0,
      "cardImageUrl": "https://cdn.example.com/cards/chase-freedom.jpg",
      "benefits": {
        "count": 3,
        "preview": [
          "1.5x points on all purchases",
          "5% introductory APR for 12 months",
          "No annual fee"
        ]
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

**Response 400 - Bad Request**:
```json
{
  "success": false,
  "error": "Invalid pagination parameters",
  "details": "limit must be between 1 and 50"
}
```

**Response 500 - Server Error**:
```json
{
  "success": false,
  "error": "Failed to fetch available cards",
  "details": "Database connection error"
}
```

**Performance SLOs**:
- p50: <200ms
- p95: <500ms
- p99: <1000ms

---

### 2. GET /api/cards/:cardId

**Purpose**: Retrieve complete details for a specific master card including full benefits list

**Method**: `GET`

**Path Parameters**:
```typescript
interface GetCardDetailsParams {
  cardId: string;  // MasterCard.id (CUID)
}
```

**Request Example**:
```
GET /api/cards/cuid_mastercard_001
```

**Response 200 - Success**:
```json
{
  "success": true,
  "card": {
    "id": "cuid_mastercard_001",
    "issuer": "Chase",
    "cardName": "Sapphire Preferred",
    "defaultAnnualFee": 9500,
    "cardImageUrl": "https://cdn.example.com/cards/chase-sapphire.jpg",
    "benefits": [
      {
        "id": "benefit_001",
        "name": "$300 annual travel credit",
        "type": "Travel",
        "stickerValue": 30000,
        "resetCadence": "Annual"
      },
      {
        "id": "benefit_002",
        "name": "3x points on dining",
        "type": "Dining",
        "stickerValue": 0,
        "resetCadence": "Unlimited"
      },
      {
        "id": "benefit_003",
        "name": "2x points on travel",
        "type": "Travel",
        "stickerValue": 0,
        "resetCadence": "Unlimited"
      },
      {
        "id": "benefit_004",
        "name": "Trip cancellation insurance",
        "type": "Insurance",
        "stickerValue": 0,
        "resetCadence": "Annual"
      },
      {
        "id": "benefit_005",
        "name": "Emergency medical insurance",
        "type": "Insurance",
        "stickerValue": 0,
        "resetCadence": "Annual"
      },
      {
        "id": "benefit_006",
        "name": "Baggage delay reimbursement",
        "type": "Travel",
        "stickerValue": 50000,
        "resetCadence": "Annual"
      },
      {
        "id": "benefit_007",
        "name": "Lost luggage reimbursement",
        "type": "Travel",
        "stickerValue": 250000,
        "resetCadence": "Per Incident"
      },
      {
        "id": "benefit_008",
        "name": "24/7 travel assistance",
        "type": "Travel",
        "stickerValue": 0,
        "resetCadence": "Unlimited"
      }
    ],
    "metadata": {
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-11-20T14:30:00Z",
      "isActive": true
    }
  }
}
```

**Response 404 - Not Found**:
```json
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}
```

**Response 500 - Server Error**:
```json
{
  "success": false,
  "error": "Failed to fetch card details",
  "details": "Database query error"
}
```

**Performance SLOs**:
- p50: <150ms
- p95: <400ms
- p99: <800ms

---

### 3. POST /api/cards/add

**Purpose**: Add a master card to user's personal collection (create UserCard + UserBenefits)

**Method**: `POST`

**Authentication**: Required (via session/JWT)

**Headers**:
```
Authorization: Bearer <token>  (or cookie-based session)
Content-Type: application/json
```

**Request Body**:
```typescript
interface AddCardRequest {
  masterCardId: string;      // Required: MasterCard.id
  customName?: string;       // Optional: User-provided name (max 100 chars)
  actualAnnualFee?: number;  // Optional: Override annual fee in cents (0-999900)
  renewalDate?: string;      // Optional: ISO 8601 date (default: today + 1 year)
}
```

**Request Example**:
```json
POST /api/cards/add
Content-Type: application/json
Authorization: Bearer eyJhbGc...

{
  "masterCardId": "cuid_mastercard_001",
  "customName": "My Chase Sapphire",
  "actualAnnualFee": 9500,
  "renewalDate": "2025-12-01"
}
```

**Response 201 - Created**:
```json
{
  "success": true,
  "userCard": {
    "id": "usercard_123",
    "playerId": "player_456",
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

**Response 400 - Validation Error**:
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "customName": "Must be less than 100 characters",
    "actualAnnualFee": "Must be between 0 and 999900 cents",
    "renewalDate": "Must be in the future"
  }
}
```

**Response 401 - Unauthorized**:
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**Response 403 - Forbidden**:
```json
{
  "success": false,
  "error": "Access denied",
  "code": "FORBIDDEN",
  "details": "You don't have permission to add cards to this profile"
}
```

**Response 404 - Not Found**:
```json
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}
```

**Response 409 - Conflict (Duplicate)**:
```json
{
  "success": false,
  "error": "Card already in collection",
  "code": "CARD_DUPLICATE",
  "details": "You already own this card. View it in your collection."
}
```

**Response 500 - Server Error**:
```json
{
  "success": false,
  "error": "Failed to add card",
  "code": "SERVER_ERROR",
  "details": "An unexpected error occurred. Please try again."
}
```

**Validation Rules** (all applied server-side):
- `masterCardId`: Required, must match existing MasterCard
- `customName`: Optional, string, max 100 characters, no special restrictions
- `actualAnnualFee`: Optional, integer, range [0, 999900] (cents), null allowed
- `renewalDate`: Optional, ISO 8601 date string, must be in future, defaults to now + 1 year
- **Uniqueness**: User cannot own same card twice (playerId + masterCardId must be unique)

**Side Effects**:
1. Creates UserCard record with provided/default values
2. Queries MasterBenefit records for the card
3. Creates UserBenefit records (one per MasterBenefit) copying:
   - `name`, `type`, `stickerValue`, `resetCadence` from MasterBenefit
   - `status`: "ACTIVE"
   - `timesUsed`: 0
   - `isUsed`: false
   - `expirationDate`: null (benefit-specific logic)
4. Returns created UserCard (no benefits in response for brevity)

**Performance SLOs**:
- p50: <300ms
- p95: <800ms
- p99: <1500ms

**Idempotency**: Not idempotent. Duplicate submissions return 409 error (by design to catch race conditions).

---

## Edge Cases & Error Handling

### Edge Case 1: Concurrent Card Addition (Race Condition)

**Scenario**: User adds same card in two browser tabs simultaneously

**Technical Challenge**: Database unique constraint on `(playerId, masterCardId)` only prevents one from succeeding

**Handling**:
- **Database Layer**: PostgreSQL enforces unique constraint; second INSERT fails
- **API Layer**: Catch constraint violation, return 409 Conflict with clear error message
- **Client Layer**: Show "Card already in collection" message + link to view card
- **Prevention**: Client-side checks before showing "Add" button; disable button if card already owned

**Test Case**:
```typescript
// Tab A: First POST succeeds
POST /api/cards/add { masterCardId: "card1" }
→ 201 Created

// Tab B: Simultaneous POST fails
POST /api/cards/add { masterCardId: "card1" }
→ 409 Conflict { error: "Card already in collection" }
```

### Edge Case 2: Invalid Annual Fee Input

**Scenario**: User enters negative, non-integer, or out-of-range annual fee

**Handling**:
- **Validation**: Check actualAnnualFee is integer, >= 0, <= 999900 (cents)
- **UI**: Show inline error message during form input
- **API**: Return 400 with specific validation error
- **User Guidance**: "Annual fee must be between $0 and $9,999"

**Test Cases**:
```typescript
// Negative fee
{ actualAnnualFee: -5000 } → 400 Bad Request

// Non-integer
{ actualAnnualFee: 9500.50 } → 400 Bad Request

// Out of range
{ actualAnnualFee: 10000000 } → 400 Bad Request

// Valid
{ actualAnnualFee: 9500 } → 201 Created
```

### Edge Case 3: Custom Name Exceeds Limit

**Scenario**: User enters card name >100 characters

**Handling**:
- **Validation**: Check customName.length <= 100
- **UI**: Show character count; disable "Add" button when over limit
- **API**: Return 400 with validation error
- **User Guidance**: "Card name must be 100 characters or less"

**Test Cases**:
```typescript
// Valid (100 chars)
{ customName: "a".repeat(100) } → 201 Created

// Invalid (101 chars)
{ customName: "a".repeat(101) } → 400 Bad Request

// Empty string (valid)
{ customName: "" } → 201 Created (uses MasterCard cardName)
```

### Edge Case 4: Renewal Date in Past

**Scenario**: User attempts to set renewal date before today

**Handling**:
- **Validation**: Check renewalDate > now()
- **UI**: Date picker prevents past dates; show "Renewal date must be in the future"
- **API**: Return 400 if date validation fails
- **Default Behavior**: If not provided, auto-set to now + 1 year

**Test Cases**:
```typescript
// Past date
{ renewalDate: "2020-01-01" } → 400 Bad Request

// Today (valid)
{ renewalDate: today } → 201 Created

// Future (valid)
{ renewalDate: "2026-12-01" } → 201 Created

// Omitted (defaults to now + 1 year)
{ } → 201 Created with renewalDate = now + 1 year
```

### Edge Case 5: Master Card Deleted Between Browse & Add

**Scenario**: Admin deletes a card from master catalog while user is viewing it

**Handling**:
- **API Layer**: GET /api/cards/:cardId returns 404
- **Modal**: Show error "Card is no longer available"
- **UI**: Offer "Back to catalog" button or auto-close modal
- **Prevention**: Client caches card list; unlikely but handled gracefully

**Test Case**:
```typescript
// User has card detail modal open
// Admin deletes card from database
// User clicks "Add to My Cards"
POST /api/cards/add { masterCardId: "deleted_card" }
→ 404 Not Found { error: "Card not found" }
→ UI shows: "This card is no longer available. Return to catalog?"
```

### Edge Case 6: User Session Expires During Add

**Scenario**: User's session expires between clicking form and POST completing

**Handling**:
- **API Layer**: Check authentication before processing
- **Response**: 401 Unauthorized
- **UI**: Show "Your session expired. Please log in again."
- **CTA**: Redirect to login; optionally re-render add flow after login
- **Prevention**: Extend session timeout; show countdown before expiry

**Test Case**:
```typescript
// User form is open
// Session expires server-side
POST /api/cards/add
→ 401 Unauthorized { error: "Session expired" }
→ UI redirects to /login with returnUrl=/cards/discover
```

### Edge Case 7: Network Failure During Add (POST Timeout)

**Scenario**: Network request times out before server responds

**Handling**:
- **Client**: Timeout after 10s; show "Request timed out"
- **UI**: Keep modal open with form data intact; show Retry button
- **Server**: Request may complete (idempotent check not guaranteed; unique constraint will catch duplicate)
- **User Guidance**: "Check your connection and try again"

**Recovery**:
- Show retry button
- User can either retry or navigate back
- If server processed despite timeout, next attempt returns 409 Conflict (clarifies what happened)

### Edge Case 8: MasterCard Missing Benefits

**Scenario**: A MasterCard has no associated MasterBenefits

**Handling**:
- **API**: Still returns 200 with empty benefits array
- **UI**: Show "No benefits available for this card"
- **Data Integrity**: Creating UserCard still succeeds (UserBenefit table will be empty)
- **Prevention**: Seed data must include benefits; admin UI should enforce benefits before publishing card

**Test Case**:
```typescript
// Card exists but no benefits
GET /api/cards/card_no_benefits
→ 200 {
  card: { ..., benefits: [] }
}

// User can still add card
POST /api/cards/add { masterCardId: "card_no_benefits" }
→ 201 Created { benefitsCreated: 0 }
```

### Edge Case 9: Pagination Boundary (Empty Page)

**Scenario**: User requests page beyond total pages available

**Handling**:
- **API**: Return empty cards array with pagination metadata showing actualPages
- **UI**: Show "No more cards to load"
- **Prevention**: Client should not allow requesting pages > totalPages

**Test Case**:
```typescript
// Total 47 cards, 12 per page = 4 pages
GET /api/cards/available?page=5&limit=12
→ 200 {
  cards: [],
  pagination: { total: 47, page: 5, totalPages: 4, hasMore: false }
}
```

### Edge Case 10: Special Characters in Custom Name

**Scenario**: User enters card name with emojis, unicode, SQL injection attempts

**Handling**:
- **Validation**: Allow any UTF-8 characters; no SQL injection risk (using parameterized queries)
- **Database**: Store as-is in VARCHAR field
- **UI**: Render safely (React auto-escapes)
- **Example**: "💳 My Chase Card (Preferred)" → Valid, stored and displayed correctly

### Edge Case 11: Zero Annual Fee (No Annual Fee Card)

**Scenario**: User adds a card with $0 annual fee

**Handling**:
- **Validation**: actualAnnualFee = 0 is valid
- **UI**: Display "No Annual Fee" badge
- **Data**: Store as 0 in database
- **Calculations**: Works correctly in fee calculations

**Test Case**:
```typescript
// Valid
{ actualAnnualFee: 0 } → 201 Created

// Card display shows "No Annual Fee"
```

### Edge Case 12: Player Profile Mismatch

**Scenario**: User's session shows Player A, but request tries to add card to Player B

**Handling**:
- **API**: Validate playerId in request matches authenticated user's selected player
- **Response**: 403 Forbidden "Access denied"
- **Prevention**: Client always uses current player context; no manual playerId in request

**Test Case**:
```typescript
// User logged in; selected player is playerA
POST /api/cards/add
// Server extracts playerId from session = playerA
// Adds card to playerA ✓

// Attacker tries to specify playerB
POST /api/cards/add { masterCardId, playerIdOverride: "playerB" }
// API ignores playerIdOverride; uses sessionPlayerId = playerA ✓
// Request succeeds but card added to correct player
```

---

## Component Architecture

### Component Hierarchy

```
CardDiscovery (Page Component)
├── CardCatalogSection
│   ├── FilterBar
│   │   ├── SearchInput
│   │   └── IssuerSelect
│   ├── CardGrid
│   │   ├── CardPreviewCard (x12)
│   │   │   ├── CardImage
│   │   │   ├── CardMeta
│   │   │   ├── BenefitPreview
│   │   │   └── OwnshipIndicator (if user owns)
│   │   └── LoadingSkeleton (during fetch)
│   └── PaginationControls
│       ├── PrevButton
│       ├── PageNumbers
│       └── NextButton
│
├── CardDetailsModal
│   ├── CardHeader
│   │   ├── CardImage (large)
│   │   ├── CardMetadata
│   │   └── CloseButton
│   ├── BenefitsList
│   │   └── BenefitItem (x N)
│   │       ├─ BenefitIcon
│   │       ├─ BenefitName
│   │       ├─ BenefitType Badge
│   │       ├─ StickerValue
│   │       └─ ResetCadence
│   └── CardDetailsFooter
│       ├─ "Add to Collection" Button (primary)
│       ├─ "Already own this card" Message (if duplicate)
│       └─ Link to owned card (if duplicate)
│
└── AddCardModal
    ├── ModalHeader ("Add Card to Collection")
    ├── AddCardForm
    │   ├── CardSummary (show which card is being added)
    │   ├── FormFields
    │   │   ├── CustomNameInput
    │   │   ├── AnnualFeeInput (with spinner)
    │   │   └── RenewalDatePicker
    │   ├── ValidationFeedback (field errors)
    │   └── FormActions
    │       ├── "Add Card" Button (primary, disabled if invalid)
    │       └── "Cancel" Button (secondary)
    └── SuccessMessage (after submission)
        ├── "Card added successfully"
        ├── Link to /cards/my-cards
        └─ Link back to /cards/discover
```

### Component Responsibilities

#### CardCatalog (Container Component)
- **Responsibility**: Manage discovery session state, fetch/filter logic
- **Props**: None (reads from context/hooks)
- **State**: 
  - `cards`, `pagination`, `filters`, `isLoading`, `error`
  - `selectedCardId`, `showDetailsModal`, `showAddModal`
- **API Calls**: 
  - GET /api/cards/available (on mount, filter change, pagination)
  - GET /api/auth/session (fetch user's owned cards)
- **Children**: FilterBar, CardGrid, PaginationControls, CardDetailsModal, AddCardModal

#### CardGrid (Presentational Component)
- **Responsibility**: Render grid of card preview cards
- **Props**: 
  - `cards: AvailableCard[]`
  - `userOwnedCardIds: Set<string>`
  - `onCardClick: (cardId: string) => void`
  - `isLoading: boolean`
- **Responsive**: 
  - Mobile: 1-2 columns
  - Tablet: 2-3 columns
  - Desktop: 3-4 columns
- **Children**: CardPreviewCard (x N), LoadingSkeleton

#### CardPreviewCard (Presentational Component)
- **Responsibility**: Display single card in catalog preview
- **Props**:
  - `card: AvailableCard`
  - `isOwned: boolean`
  - `onClick: () => void`
- **Visual Elements**:
  - Card image (aspect ratio 3:2)
  - Issuer + card name
  - Benefit preview (3 benefits as tags)
  - "You own this" badge (if isOwned)
  - Hover interaction (raise, shadow)
- **Responsive**: Same size across devices; scales with grid

#### CardDetailsModal (Modal Component)
- **Responsibility**: Display full card details with all benefits
- **Props**:
  - `card: CardDetails | null`
  - `isOwned: boolean`
  - `isLoading: boolean`
  - `onClose: () => void`
  - `onAddClick: () => void`
- **Data Fetching**: GET /api/cards/:cardId inside modal
- **Behavior**:
  - Modal overlay (dark background, click-to-close)
  - Scrollable benefit list (max-height for long benefit lists)
  - Mobile: Full-screen drawer that slides up from bottom
  - Desktop: Centered modal (max-width 600px)
- **Children**: CardHeader, BenefitsList, CardDetailsFooter

#### BenefitsList (Presentational Component)
- **Responsibility**: Render scrollable list of benefits
- **Props**:
  - `benefits: MasterBenefit[]`
  - `isLoading: boolean`
- **Visual Elements**: Each benefit shows:
  - Icon (based on type: Travel, Dining, Transfer, Insurance)
  - Benefit name
  - Type badge
  - Sticker value (if non-zero)
  - Reset cadence (Annual, Monthly, Unlimited)
- **Interactions**: Tap to expand more details (mobile)

#### AddCardModal (Modal Component)
- **Responsibility**: Handle card addition with form validation
- **Props**:
  - `masterCardId: string`
  - `masterCardName: string`
  - `defaultAnnualFee: number`
  - `onSuccess: (userCard: UserCard) => void`
  - `onCancel: () => void`
  - `isSubmitting: boolean`
- **Form State Management**: Local form state hook
- **Validation**: Real-time field validation (onChange)
- **API Call**: POST /api/cards/add
- **Error Handling**: Show field errors or modal-level error
- **Children**: ModalHeader, AddCardForm, FormActions

#### AddCardForm (Presentational Component)
- **Responsibility**: Render form fields for card customization
- **Props**:
  - `formState: AddCardFormState`
  - `onChange: (field, value) => void`
  - `errors: Record<string, string>`
  - `isSubmitting: boolean`
- **Fields**:
  - Custom Card Name (text input, max 100 chars, optional)
  - Annual Fee (number input with spinner, optional)
  - Renewal Date (date picker, defaults to 1 year from now)
- **Validation Feedback**: Show red error text below each field

#### FilterBar (Presentational Component)
- **Responsibility**: Provide search and filter inputs
- **Props**:
  - `searchQuery: string`
  - `selectedIssuer: string | null`
  - `onSearchChange: (query: string) => void`
  - `onIssuerChange: (issuer: string | null) => void`
  - `issuers: string[]` (list of available issuers)
- **Interactions**:
  - Search: Debounced input (300ms delay) → triggers fetch
  - Issuer: Dropdown or pills (shows all, user selects one)
  - Clear: Button to reset all filters
- **Mobile**: Collapse filters under "Filter" button

#### PaginationControls (Presentational Component)
- **Responsibility**: Navigate through card pages
- **Props**:
  - `currentPage: number`
  - `totalPages: number`
  - `onPageChange: (page: number) => void`
- **UI Options**:
  - Desktop: Numbered buttons (1, 2, 3, 4...) + Prev/Next
  - Mobile: Only Prev/Next buttons + page indicator ("Page 1 of 4")
- **Interactions**: Page change scrolls grid to top

---

## Implementation Tasks

### Phase 1: API Foundation (Days 1-4)

#### Task 1.1: Implement GET /api/cards/available endpoint
- **Complexity**: Medium
- **Description**: Create API route to list master cards with pagination and filtering
- **Acceptance Criteria**:
  - Supports pagination (page, limit)
  - Supports filtering by issuer (exact or partial match)
  - Supports searching by card name (case-insensitive)
  - Returns benefit count + preview (3 benefits) for each card
  - Validates query parameters (limit 1-50, page >= 1)
  - Returns proper error responses (400, 500)
  - Performance: p95 < 500ms for 10K+ cards
- **Files**: 
  - `src/app/api/cards/available/route.ts` (NEW)
  - `src/lib/cards.ts` (utility functions for card queries)
- **Dependencies**: Existing Prisma MasterCard + MasterBenefit models
- **Testing**: Unit tests for query logic, edge cases (empty results, invalid params)

#### Task 1.2: Implement GET /api/cards/:cardId endpoint
- **Complexity**: Medium
- **Description**: Create API route to fetch full card details with complete benefits list
- **Acceptance Criteria**:
  - Returns complete card metadata
  - Returns all benefits for the card (no limit)
  - Returns 404 if card doesn't exist
  - Validates cardId format (CUID)
  - Performance: p95 < 400ms
  - Includes benefit sorting (by type or creation order)
- **Files**:
  - `src/app/api/cards/[id]/route.ts` (modify existing or create new)
- **Dependencies**: Task 1.1 complete (shared utilities)
- **Testing**: Unit tests for valid/invalid IDs, missing benefits

#### Task 1.3: Implement POST /api/cards/add endpoint
- **Complexity**: Large
- **Description**: Create API route to add a card to user's collection
- **Acceptance Criteria**:
  - Validates request body (masterCardId, customName, actualAnnualFee, renewalDate)
  - Checks user authentication (session/JWT)
  - Verifies user has access to their player profile
  - Checks masterCard exists (404 if not)
  - Enforces unique constraint: prevents duplicate (playerId, masterCardId)
  - Creates UserCard with provided/default values
  - Creates UserBenefit records for all card benefits (copy from MasterBenefit)
  - Returns created UserCard in response
  - Handles race conditions gracefully (409 on duplicate)
  - All-or-nothing transaction (if benefit creation fails, rollback UserCard)
  - Performance: p95 < 800ms
- **Files**:
  - `src/app/api/cards/add/route.ts` (modify existing)
  - `src/lib/validation.ts` (add validation functions)
  - `src/lib/errors.ts` (structured error responses)
- **Dependencies**: Task 1.1, 1.2 complete; auth middleware working
- **Testing**: 
  - Valid requests → 201 with UserCard
  - Duplicate card → 409 Conflict
  - Invalid masterCardId → 404
  - Validation failures → 400 with field errors
  - Race condition simulation (concurrent requests)

#### Task 1.4: Add database indexes and optimize queries
- **Complexity**: Small
- **Description**: Add indexes to support discovery queries at scale
- **Acceptance Criteria**:
  - Index on MasterCard(issuer) for issuer filtering
  - Index on MasterCard(cardName) for search
  - Index on MasterBenefit(masterCardId) for benefit joins
  - Query plans use indexes (verify with EXPLAIN ANALYZE)
  - No N+1 query issues (use Prisma include/select)
  - Performance test shows p95 < 500ms for 50K+ cards
- **Files**:
  - `prisma/schema.prisma` (already has indexes; verify coverage)
  - `src/lib/cards.ts` (optimize queries with Prisma includes)
- **Dependencies**: Tasks 1.1-1.3 complete
- **Testing**: Load test with realistic card catalog (50+ cards, 500+ benefits)

---

### Phase 2: Frontend Discovery Interface (Days 5-8)

#### Task 2.1: Build CardCatalog container component
- **Complexity**: Large
- **Description**: Create main discovery page component with state management
- **Acceptance Criteria**:
  - Manages all discovery session state (cards, pagination, filters, modals)
  - Fetches available cards on mount
  - Handles filter changes (issuer, search)
  - Handles pagination (prev/next, numbered pages)
  - Manages CardDetailsModal visibility
  - Manages AddCardModal visibility
  - Fetches user's owned cards (from session)
  - Loading and error states for all API calls
  - Responsive layout (mobile, tablet, desktop)
- **Files**:
  - `src/components/CardDiscovery/CardCatalog.tsx` (NEW)
  - `src/context/CardDiscoveryContext.ts` (NEW) - for shared state
  - `src/hooks/useCardDiscovery.ts` (NEW) - custom hook for state logic
- **Dependencies**: Phase 1 APIs complete
- **Testing**: Component integration tests (Vitest)

#### Task 2.2: Build CardGrid + CardPreviewCard components
- **Complexity**: Medium
- **Description**: Create grid layout and individual card preview components
- **Acceptance Criteria**:
  - Responsive grid (1 col mobile, 2 tablet, 3-4 desktop)
  - Cards display issuer, name, image, benefit preview
  - "You own this" indicator for cards user already owns
  - Click handler to show details modal
  - Loading skeleton cards (during fetch)
  - Proper spacing and alignment
  - Image aspect ratio (3:2)
  - Hover effects (desktop only)
- **Files**:
  - `src/components/CardDiscovery/CardGrid.tsx` (NEW)
  - `src/components/CardDiscovery/CardPreviewCard.tsx` (NEW)
  - `src/components/CardDiscovery/CardSkeleton.tsx` (NEW)
- **Dependencies**: Task 2.1 complete
- **Testing**: Snapshot tests, responsive design tests (Playwright)

#### Task 2.3: Build CardDetailsModal component
- **Complexity**: Large
- **Description**: Create modal for viewing full card details and benefits
- **Acceptance Criteria**:
  - Displays card image (large)
  - Shows card metadata (issuer, name, default annual fee)
  - Fetches and displays all benefits
  - Benefits list is scrollable (long lists)
  - Modal closes on backdrop click or close button
  - Mobile: Renders as full-screen drawer sliding from bottom
  - Desktop: Centered modal (max-width 600px)
  - "Add to My Cards" button in footer
  - "Already own this card" message + link if duplicate
  - Loading state while fetching benefits
  - Error state with retry button
- **Files**:
  - `src/components/CardDiscovery/CardDetailsModal.tsx` (NEW)
  - `src/components/CardDiscovery/BenefitsList.tsx` (NEW)
  - `src/components/shared/Modal.tsx` (NEW, reusable)
  - `src/components/shared/Drawer.tsx` (NEW, mobile-specific)
- **Dependencies**: Task 2.2 complete
- **Testing**: Modal interactions, benefit list rendering

#### Task 2.4: Build FilterBar component
- **Complexity**: Small
- **Description**: Create search and filter input components
- **Acceptance Criteria**:
  - Search input (debounced 300ms)
  - Issuer filter (dropdown or pills)
  - "Clear filters" button
  - Responsive (collapse to icon on mobile)
  - Shows active filter count
  - Accessibility: proper labels, ARIA attributes
- **Files**:
  - `src/components/CardDiscovery/FilterBar.tsx` (NEW)
  - `src/components/shared/Debounce.ts` (NEW)
- **Dependencies**: Task 2.1 complete
- **Testing**: Filter logic, debounce behavior

#### Task 2.5: Build PaginationControls component
- **Complexity**: Small
- **Description**: Create pagination UI
- **Acceptance Criteria**:
  - Desktop: Numbered page buttons + Prev/Next
  - Mobile: Prev/Next only + page indicator
  - Disabled state when at boundary (page 1, last page)
  - Scroll to top on page change
  - Accessibility: proper button labels
- **Files**:
  - `src/components/CardDiscovery/PaginationControls.tsx` (NEW)
- **Dependencies**: Task 2.1 complete
- **Testing**: Pagination logic, scroll behavior

---

### Phase 3: Add-to-Collection Flow (Days 9-11)

#### Task 3.1: Build AddCardModal component
- **Complexity**: Large
- **Description**: Create modal for customizing and adding a card
- **Acceptance Criteria**:
  - Form with three fields: customName, actualAnnualFee, renewalDate
  - Pre-fills defaults from MasterCard
  - Real-time field validation (onChange)
  - Shows validation errors below each field
  - Submit button disabled if form invalid
  - Loading state during submission (button disabled, spinner)
  - Success state: Toast notification + modal close
  - Error state: Show error message, keep modal open
  - Handles duplicate card error (409) → Show "Already own" message
  - Mobile: Full-screen modal
  - Desktop: Centered modal (max-width 500px)
- **Files**:
  - `src/components/CardDiscovery/AddCardModal.tsx` (NEW)
  - `src/components/CardDiscovery/AddCardForm.tsx` (NEW)
  - `src/hooks/useFormValidation.ts` (NEW)
- **Dependencies**: Task 2.3 complete (modal infrastructure)
- **Testing**: Form validation, submission logic, error handling

#### Task 3.2: Implement form validation logic
- **Complexity**: Medium
- **Description**: Build client-side validation for add card form
- **Acceptance Criteria**:
  - Validates customName (max 100 chars)
  - Validates actualAnnualFee (0-999900 cents)
  - Validates renewalDate (must be future date)
  - Validates masterCardId (not empty)
  - Shows field-level error messages
  - Supports async validation (optional: check card still exists)
  - Touched field tracking (only show errors for touched fields)
  - Real-time feedback (onChange) for better UX
- **Files**:
  - `src/lib/validation.ts` (enhance from Task 1.3)
  - `src/hooks/useFormValidation.ts` (NEW)
  - `src/types/forms.ts` (NEW, form type definitions)
- **Dependencies**: Task 3.1 in progress
- **Testing**: Validation logic for all fields, boundary conditions

#### Task 3.3: Implement API submission and error handling
- **Complexity**: Medium
- **Description**: Handle POST /api/cards/add submission and error recovery
- **Acceptance Criteria**:
  - Submits form data to POST /api/cards/add
  - Prevents double-submit (button disabled during request)
  - Handles timeout (>10s) gracefully with retry option
  - Handles 409 Conflict (duplicate) → Show user message
  - Handles 400 Validation error → Show field errors
  - Handles 401/403 Auth errors → Redirect to login
  - Handles 500 Server error → Show retry option
  - On success: Show toast "Card added!" + close modal + refresh catalog
  - Optimistic UI updates (optional: update card grid immediately)
- **Files**:
  - `src/components/CardDiscovery/AddCardModal.tsx` (enhance)
  - `src/lib/api-client.ts` (NEW, API client with error handling)
- **Dependencies**: Task 1.3 (API endpoint) + Task 3.1 (modal)
- **Testing**: API submission, error scenarios, timeout handling

#### Task 3.4: Build duplicate card detection UI
- **Complexity**: Small
- **Description**: Warn users if card is already in collection
- **Acceptance Criteria**:
  - Client-side: Show "You own this" indicator in catalog
  - Client-side: Disable "Add to My Cards" button if already owned
  - Client-side: Show warning message in details modal
  - Modal: Show "View in my collection" link
  - API: Return 409 on duplicate submission (safety net)
  - Edge case: Handle case where API returns 409 (race condition)
- **Files**:
  - `src/components/CardDiscovery/OwnershipIndicator.tsx` (NEW)
  - `src/components/CardDiscovery/CardDetailsModal.tsx` (enhance)
- **Dependencies**: Task 2.3 + 3.1 complete
- **Testing**: Duplicate detection logic, edge case handling

---

### Phase 4: State Management & Integration (Days 12-14)

#### Task 4.1: Implement CardDiscoveryContext for state management
- **Complexity**: Medium
- **Description**: Create React Context for managing discovery session state
- **Acceptance Criteria**:
  - Context stores: cards, pagination, filters, selectedCard, modals, loading states
  - Provides actions: setPage, setFilter, setSearch, openDetailsModal, openAddModal, etc.
  - Caches card list (avoid re-fetching on filter reset)
  - Invalidates cache after successful add (refresh card list)
  - Integrates with useCardDiscovery hook
  - Persists filter preferences (localStorage, optional)
- **Files**:
  - `src/context/CardDiscoveryContext.tsx` (NEW)
  - `src/hooks/useCardDiscovery.ts` (enhance)
- **Dependencies**: Task 2.1 in progress
- **Testing**: Context behavior, action dispatching

#### Task 4.2: Integrate authentication & player context
- **Complexity**: Small
- **Description**: Connect CardDiscovery to existing auth system
- **Acceptance Criteria**:
  - Fetches user's owned cards from session on mount
  - Passes player context to API calls (POST /api/cards/add)
  - Handles auth errors gracefully (401 → redirect to login)
  - Supports multi-player profiles (user selects which profile)
  - Shows correct owned cards for selected player
- **Files**:
  - `src/context/CardDiscoveryContext.tsx` (enhance)
  - `src/components/CardDiscovery/CardCatalog.tsx` (enhance)
- **Dependencies**: Task 4.1 complete; auth context already exists
- **Testing**: Auth integration, player selection

#### Task 4.3: Implement real-time cache invalidation
- **Complexity**: Medium
- **Description**: Refresh card list after successful add (without full page reload)
- **Acceptance Criteria**:
  - After POST /api/cards/add succeeds, refetch available cards
  - Update owned card list to show newly added card
  - Show success toast with "View in my cards" link
  - Optional: Scroll to newly added card in catalog
  - Handle refetch errors gracefully
- **Files**:
  - `src/hooks/useCardDiscovery.ts` (enhance)
  - `src/components/CardDiscovery/AddCardModal.tsx` (integrate)
- **Dependencies**: Task 4.1 complete
- **Testing**: Cache invalidation behavior

---

### Phase 5: Testing, Mobile Polish & Deployment (Days 15-17)

#### Task 5.1: Write API route tests
- **Complexity**: Medium
- **Description**: Unit and integration tests for all API endpoints
- **Acceptance Criteria**:
  - GET /api/cards/available: Test pagination, filtering, search, error cases
  - GET /api/cards/:cardId: Test valid/invalid IDs, missing benefits
  - POST /api/cards/add: Test success, validation errors, duplicates, race conditions
  - Auth checks: Verify 401/403 responses when appropriate
  - Coverage: >80% of API logic
- **Files**:
  - `src/app/api/cards/__tests__/available.test.ts` (NEW)
  - `src/app/api/cards/__tests__/[id].test.ts` (NEW)
  - `src/app/api/cards/__tests__/add.test.ts` (NEW)
- **Dependencies**: All Phase 1 APIs complete
- **Testing Framework**: Vitest + @testing-library/node

#### Task 5.2: Write component integration tests
- **Complexity**: Large
- **Description**: Integration tests for CardDiscovery flow end-to-end
- **Acceptance Criteria**:
  - CardCatalog renders on mount and fetches cards
  - Filter changes trigger API calls and update grid
  - Pagination works correctly
  - Clicking card opens details modal
  - Details modal shows all benefits
  - "Add to My Cards" button opens form modal
  - Form submission triggers POST and shows success
  - Error handling: Modal shows errors and allows retry
  - Duplicate detection: Shows "You own this" message
  - Mobile: Layout adapts (1 column, full-screen modal)
  - Coverage: >70% of UI logic
- **Files**:
  - `src/components/CardDiscovery/__tests__/CardCatalog.test.tsx` (NEW)
  - `src/components/CardDiscovery/__tests__/AddCardModal.test.tsx` (NEW)
- **Dependencies**: All Phase 2-4 components complete
- **Testing Framework**: Vitest + @testing-library/react + Playwright

#### Task 5.3: Mobile responsiveness testing and fixes
- **Complexity**: Medium
- **Description**: Ensure perfect mobile UX across all devices
- **Acceptance Criteria**:
  - iPhone 12 (390px): 1 column grid, drawer modals
  - iPad (768px): 2 columns, side modal
  - Desktop (1440px): 3-4 columns, centered modal
  - Touch-friendly: Buttons 44px+ tap targets
  - No horizontal scroll on any device
  - Modal: Full-screen on mobile, fixed max-width on desktop
  - Filter bar: Collapses to icon on mobile
  - Form: Inputs properly sized for touch keyboards
  - Images: Load efficiently (lazy load, responsive sizes)
  - Playwright tests on multiple viewports
- **Files**:
  - Various component files (adjust Tailwind/CSS as needed)
  - `src/__tests__/mobile-responsive.test.tsx` (NEW)
- **Dependencies**: All components complete
- **Testing**: Playwright multi-device testing

#### Task 5.4: Performance profiling and optimization
- **Complexity**: Medium
- **Description**: Profile and optimize critical paths
- **Acceptance Criteria**:
  - API endpoint p95 < 500ms (verified in load test)
  - Initial page load: <2s (Core Web Vitals)
  - Card grid renders efficiently (virtualization if 100+ cards)
  - Image loading: Lazy load, responsive sizes, WebP format
  - Bundle size: Card discovery feature <50KB (gzipped)
  - No N+1 queries in API routes
  - React DevTools: No unnecessary re-renders
  - Lighthouse score: >90 for Performance
- **Files**:
  - Various component files (optimize as needed)
  - `src/lib/performance.ts` (NEW, performance utilities)
- **Dependencies**: All components complete
- **Testing**: Lighthouse, load testing, React DevTools profiling

#### Task 5.5: Deployment and monitoring setup
- **Complexity**: Small
- **Description**: Prepare feature for production deployment
- **Acceptance Criteria**:
  - Feature flag (optional): Control rollout to subset of users
  - Monitoring: Track API response times, error rates
  - Alerting: Alert on p95 > 1s or error rate > 1%
  - Documentation: Deployment guide, rollback procedure
  - Seed data: Ensure 10+ master cards in production
  - Database: Run migrations if schema changed
  - Changelog: Document feature for release notes
- **Files**:
  - `.github/workflows/deploy.yml` (enhance if needed)
  - `docs/DEPLOYMENT.md` (NEW)
  - `src/lib/monitoring.ts` (NEW, metrics reporting)
- **Dependencies**: All tasks complete
- **Testing**: Staging environment verification

---

## Security & Compliance Considerations

### Authentication & Authorization

**Requirements**:
- All API endpoints except `GET /api/cards/available` and `GET /api/cards/:cardId` require authentication
- POST `/api/cards/add` must verify:
  - User is logged in (valid session/JWT)
  - User has access to their player profile
  - Player is not locked/suspended
- Client should never reveal user's playerId in requests; derived from session only

**Implementation**:
- Existing auth middleware (`src/middleware.ts`) already checks session validity
- API routes use `req.user` from session to determine player context
- Use `@/lib/auth.ts` utilities for consistent auth checks

**Edge Cases**:
- Session expires during add request → Return 401, client redirects to login
- Player profile deleted after page load → Return 403 on add request
- User switched players → Correct player context used (from session, not request)

### Data Protection & Privacy

**Sensitive Data Handled**:
- User's card collection (not exposed; only to authenticated user)
- Annual fees (user-provided values; not sensitive but user's financial data)
- Renewal dates (user's card management data; not exported)

**Privacy Controls**:
- Users can only see their own card collections
- Master card data (issuer, name, benefits) is public
- User's owned cards are not shared with other users
- No analytics on individual users' cards without consent

**Data Retention**:
- UserCard records: Kept indefinitely (user can mark as archived/closed)
- UserBenefit records: Kept indefinitely
- No automatic deletion of user data (GDPR/CCPA compliance handled separately)

### Input Validation & Sanitization

**Validation Rules** (all enforced server-side):
- `masterCardId`: CUID format, verified to exist in MasterCard table
- `customName`: UTF-8 string, max 100 characters, no SQL injection risk (parameterized queries)
- `actualAnnualFee`: Integer, range [0, 999900] cents
- `renewalDate`: ISO 8601 date string, must be in future

**Sanitization**:
- No HTML sanitization needed (no rich text input)
- React auto-escapes user input in JSX
- Database parameterized queries prevent SQL injection
- API responses don't include sensitive data

### Audit & Logging

**Recommended Logging**:
- Log each POST `/api/cards/add` request: userId, playerId, masterCardId, timestamp
- Log errors: API errors (400+), validation failures, database errors
- Optional: Track duplicate add attempts (could indicate UI confusion)
- Exclude: Annual fees, renewal dates (user's financial data)

**Implementation**:
- Use existing logging framework (Winston/Pino, if available)
- Structured logs with consistent schema
- Logs retained for 30+ days (adjust per retention policy)

---

## Performance & Scalability Considerations

### Expected Load & Growth

**Initial Phase**:
- 1K-10K monthly active users
- ~5-10 cards per user average
- 50-100 concurrent users during peak hours

**Growth Phase (6-12 months)**:
- 100K+ monthly active users
- Catalog grows to 500+ cards
- 1K+ concurrent users during peak

### Caching Strategies

**Client-Side Caching**:
- Card list: Cache in Context/state, invalidate after add
- Card details: Cache in browser memory, refetch on modal open
- User's owned cards: Fetch once per session, invalidate after add
- Filters: Optional localStorage persistence (e.g., preferred issuer)

**Server-Side Caching** (optional, for scaling):
- Master card list: Cache in Redis (1-2 hour TTL)
  - Key: `cards:list:page:{page}:limit:{limit}:filter:{filter_hash}`
  - Invalidate on admin card updates
- Single card details: Cache in Redis (24 hour TTL)
  - Key: `card:{cardId}:details`
  - Invalidate on benefit updates
- Issuers list: Cache (static reference data)
  - Key: `cards:issuers:list`

**Cache Invalidation**:
- After successful add: Invalidate user's card list (Context + optional Redis)
- After admin updates master card: Invalidate card list + card details caches

### Database Optimization

**Indexes** (all critical indexes already in schema):
- MasterCard: `(issuer)`, `(cardName)` for discovery queries
- MasterBenefit: `(masterCardId)` for benefit joins
- UserCard: `(playerId, masterCardId)` unique constraint
- UserCard: `(playerId)` for user's collection queries

**Query Optimization**:
- Use Prisma `include/select` to fetch only needed fields
- Avoid N+1: Include benefits in single query, not loop per card
- Pagination: Always use limit/offset to avoid loading entire table
- Sample queries:
  ```typescript
  // GET /api/cards/available - Get paginated cards with benefit preview
  const cards = await prisma.masterCard.findMany({
    take: limit,
    skip: offset,
    where: { issuer: { contains: filter } },
    include: {
      masterBenefits: { take: 3, orderBy: { createdAt: 'asc' } }
    }
  });
  
  // GET /api/cards/:cardId - Get card with all benefits
  const card = await prisma.masterCard.findUnique({
    where: { id: cardId },
    include: { masterBenefits: { orderBy: { createdAt: 'asc' } } }
  });
  
  // POST /api/cards/add - Create card + benefits in transaction
  const result = await prisma.$transaction(async (tx) => {
    const userCard = await tx.userCard.create({...});
    const benefits = await tx.userBenefit.createMany({...});
    return { userCard, benefitsCreated: benefits.count };
  });
  ```

### Rate Limiting & Throttling

**Rate Limits** (recommended):
- GET /api/cards/available: 100 req/min per user (discovery browsing)
- GET /api/cards/:cardId: 1000 req/min per user (detail views)
- POST /api/cards/add: 10 req/min per user (add limit to prevent abuse)

**Implementation**:
- Use Redis for distributed rate limiting (if available)
- Token bucket algorithm: Allow burst but limit sustained rate
- Return 429 Too Many Requests when exceeded
- Include `Retry-After` header in response

**Client-Side Throttling**:
- Debounce search input (300ms) to avoid excessive API calls
- Disable button during submission (prevent double-submit)
- No rapid pagination (user must wait for page load)

### Scaling Roadmap

**Phase 1** (Current):
- Single PostgreSQL database
- Single Node.js server
- No caching layer

**Phase 2** (1K+ concurrent):
- Add Redis for caching (card list, user owned cards)
- Add database replicas for read scaling
- Optimize queries (indexes, lazy loading images)

**Phase 3** (10K+ concurrent):
- Horizontal scaling (multiple Node.js servers)
- Load balancer (nginx, AWS ALB)
- CDN for card images
- Database connection pooling (PgBouncer)
- Elasticsearch for card search (if 1000+ cards)

---

## Future Enhancements (Out of Scope)

These features are intentionally excluded from this spec but should be considered for future phases:

1. **Card Comparison**: Side-by-side comparison of 2-3 cards with benefit differences highlighted
2. **Personalized Recommendations**: "Cards you might like" based on browsing/existing cards
3. **Card Ratings & Reviews**: User ratings and text reviews of cards
4. **Card Switching**: Replace one card with another (benefit migration logic)
5. **Bulk Import**: Upload CSV to add multiple cards at once
6. **Advanced Search**: Filter by specific benefit types, minimum annual fee, etc.
7. **Card Alerts**: Notify when new benefits or cards added matching user's interests
8. **Integrated Comparison Tools**: Interest rate comparisons, cashback calculators
9. **Admin Dashboard**: UI for managing master cards, benefits, and seed data
10. **Analytics**: Track card discovery funnel, popular cards, conversion rates

---

## Quality Control Checklist

- ✅ **All Functional Requirements Addressed**
  - Browse catalog with pagination and filtering
  - View card details and benefits
  - Add card with customization (fee, name)
  - Duplicate prevention
  - Mobile responsiveness

- ✅ **Data Schema Supports All Features**
  - MasterCard + MasterBenefit for catalog
  - UserCard + UserBenefit for collection
  - Unique constraints prevent duplicates
  - Indexes optimize queries

- ✅ **API Design is RESTful & Intuitive**
  - GET for retrieval (available, details)
  - POST for creation (add card)
  - Proper status codes (200, 201, 400, 404, 409, 500)
  - Structured response schemas
  - Clear error messages

- ✅ **All User Flows Complete with Error Paths**
  - Browse → Filter → Details → Add (happy path)
  - Duplicate detection (prevention + error)
  - Validation errors (field-level + clear messages)
  - Network failures (retry logic)
  - Session expiry (redirect to login)

- ✅ **Edge Cases Realistically & Comprehensively Handled**
  - 12 edge cases documented with handling strategies
  - Race conditions (concurrent adds)
  - Invalid input (validation + feedback)
  - Network failures (timeout + retry)
  - Resource not found (clear messaging)
  - Session/auth failures (redirect)

- ✅ **Components Truly Modular & Developable in Parallel**
  - Phase structure: API (1-4) → UI (5-8) → Integration (9-11) → Testing (12-14)
  - Each component has clear inputs/outputs
  - Minimal cross-component dependencies
  - Can start UI development using mock API (if needed)

- ✅ **Implementation Tasks Specific & Measurable**
  - 14 tasks with clear acceptance criteria
  - Complexity estimates (Small/Medium/Large)
  - Dependencies documented
  - Testing requirements defined

- ✅ **Documentation Clear for Senior Engineers**
  - Architect can code from this spec
  - All API contracts fully specified
  - Component hierarchies clear
  - State management approach defined
  - Error handling strategies explicit

- ✅ **System Constraints & Limits Documented**
  - Pagination limits (1-50)
  - Input limits (name 100 chars, fee up to $9,999)
  - Performance SLOs (p95 < 500ms)
  - Rate limiting recommendations
  - Scaling roadmap for growth

- ✅ **Security Addressed**
  - Authentication required for mutations
  - Authorization checks (player context)
  - Input validation all server-side
  - No SQL injection risk (parameterized queries)
  - Audit logging recommended
  - GDPR/privacy considerations noted

---

## Appendix A: Database Schema Summary

### Key Relationships
```
MasterCard (1) ──→ (N) MasterBenefit
   ↓                      
   └─→ (N) UserCard ──→ (N) UserBenefit
        ↓                    ↑
        └─→ (N) Player ──────┘
```

### Unique Constraints (Critical for Data Integrity)
- `MasterCard(issuer, cardName)`: Prevents duplicate cards in catalog
- `UserCard(playerId, masterCardId)`: Prevents duplicate card ownership
- `UserBenefit(userCardId, name)`: Prevents duplicate benefits per card

### Key Indexes (Query Performance)
- `MasterCard(issuer)`: Issuer filtering
- `MasterCard(cardName)`: Card search
- `MasterBenefit(masterCardId)`: Benefit joins
- `UserCard(playerId)`: User's collection queries
- `UserCard(masterCardId)`: Reverse lookups

---

## Appendix B: API Response Code Summary

| Code | Scenario | Response |
|------|----------|----------|
| 200 | Successful GET | List/detail data |
| 201 | Successful POST | Created UserCard |
| 400 | Invalid input | Validation errors |
| 401 | Not authenticated | Session expired |
| 403 | Not authorized | Player access denied |
| 404 | Resource not found | Card doesn't exist |
| 409 | Conflict | Card already owned |
| 500 | Server error | Retry later |

---

## Appendix C: Component Testing Priorities

**High Priority** (must have):
- CardCatalog (pagination, filtering, API integration)
- AddCardModal (form validation, submission, error handling)
- CardDetailsModal (data fetching, benefit rendering)

**Medium Priority** (should have):
- CardGrid (responsive layout)
- FilterBar (search/filter logic)
- PaginationControls (navigation)

**Low Priority** (nice to have):
- CardPreviewCard (individual card rendering)
- OwnershipIndicator (visual indicator)
- LoadingSkeletons (loading states)

---

## Appendix D: Mobile Responsiveness Breakpoints

```
Mobile:   320px - 479px  → 1 column grid, full-screen modal, collapsed filters
Tablet:   480px - 1023px → 2 columns, 60vw modal, expandable filters
Desktop: 1024px+         → 3-4 columns, fixed 600px modal, side filter bar
```

---

**Specification Version**: 1.0  
**Last Updated**: November 2024  
**Status**: Ready for Implementation  
**Estimated Total Duration**: 15-17 days (all phases)
