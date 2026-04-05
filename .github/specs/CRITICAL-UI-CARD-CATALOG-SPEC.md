# Card Benefits: Critical UI Fixes + Card Catalog System
## Comprehensive Technical Specification

**Version**: 1.0  
**Date**: 2024  
**Status**: Ready for Implementation  
**Audience**: Senior Full-Stack Engineers, Frontend Engineers, Backend Engineers

---

## Executive Summary & Goals

This specification addresses 5 critical UI/UX bugs that block core functionality and introduces the **Card Catalog System**—a transformative feature that enables users to quickly add credit cards from a pre-built catalog of 10+ real-world cards (American Express Gold, Chase Sapphire Reserve, etc.), each with unique, realistic benefits.

### Primary Objectives
1. **Fix critical accessibility violations** – Ensure WCAG 2.1 Level AA compliance across all modals
2. **Fix broken Add Card flow** – Modal state management & UI rendering
3. **Fix hardcoded card data** – Replace hardcoded card ID '1' with real user-scoped queries
4. **Implement Card Catalog** – Allow users to quickly select from pre-built cards with unique benefits
5. **Establish template-based architecture** – Enable future bulk imports, card recommendations, and value comparisons

### Success Criteria
- ✓ All 4 modals have accessible `DialogTitle` components
- ✓ Add Card modal appears when button clicked and state is wired correctly
- ✓ Edit/Delete buttons appear in card footer (right-aligned)
- ✓ Checkboxes in Settings are standard size (w-4 h-4 or w-5 h-5)
- ✓ Dashboard fetches real user cards, not hardcoded ID
- ✓ Card Catalog API returns 10+ card templates with realistic benefits
- ✓ Users can select a card from catalog and create it with template benefits
- ✓ Seed data includes 10 realistic card templates with accurate benefits

---

## Functional Requirements

### Core Features & Capabilities

#### 1. Accessibility Compliance
- All modals (AddCard, EditCard, AddBenefit, EditBenefit) must have:
  - `<DialogTitle>` component for semantic labeling (WCAG 2.1 Level AA)
  - Proper `aria-labelledby` and `aria-describedby` attributes
  - Option to visually hide title using `VisuallyHidden` component (for modals that have visual instructions)
  - Focus management (focus enters first interactive element, returns to trigger on close)
  - Keyboard navigation (Tab, Shift+Tab, Escape to close)

#### 2. Add Card Modal Functionality
- Modal must be:
  - Rendered in the dashboard/page component
  - Controlled by `isOpen` state wired to button `onClick`
  - Dismissible via Escape key, X button, or backdrop click
  - Show card catalog by default (browse tab)
  - Allow custom card creation (via toggle)

#### 3. Card Catalog System
- Users see a list/grid of pre-built card templates
- Each template displays:
  - Card issuer & name
  - Annual fee
  - Benefit preview (first 3 benefits)
  - "Select Card" button
- Selecting a card:
  - Creates UserCard with `masterCardId` pointing to template
  - Clones all MasterBenefit entries to UserBenefit (with counts reset)
  - Displays toast confirmation
  - Closes modal and refreshes card list

#### 4. Card Data Architecture
- Separate **MasterCard/MasterBenefit** (read-only templates) from **UserCard/UserBenefit** (editable user instances)
- UserCard contains `masterCardId` foreign key (already in schema)
- When card is created from template, benefits are cloned from MasterBenefit to UserBenefit

#### 5. Dashboard Data Fetching
- Replace hardcoded `/api/cards/1` queries with `/api/cards/my-cards`
- Fetch all user cards scoped to current user's player
- Display all user cards with their respective benefits

#### 6. UI/Layout Fixes
- **Edit/Delete buttons**: Move from card header to footer (flex row, right-aligned)
- **Checkbox sizing**: All checkboxes in Settings reduced to `w-4 h-4` or `w-5 h-5`
- **Card footer structure**: `flex justify-between items-center` with action buttons right-aligned

### User Roles & Permissions
- **Authenticated User**: Can view their own cards, add cards from catalog, edit/delete their cards
- **Unauthenticated User**: Cannot access card management (redirected to login)

### System Constraints & Limits
- Max 50 cards per player (enforced in API POST /api/cards/add)
- Max 30 benefits per card (enforced in seeding script)
- Annual fee capped at $999 (validation in form)
- Renewal date must be in future or today (validation in form)
- Card names limited to 100 characters
- API rate limit: 100 requests per minute per user (Redis-based)

---

## Implementation Phases

### Phase 1: Database Schema & Seeding (Estimated: 2 days)
**Objectives**:
- Add new CardTemplate and BenefitTemplate models to Prisma schema (if not already present)
- Update UserCard schema to track source template
- Create comprehensive seed data with 10 realistic card templates

**Key Deliverables**:
- Updated `prisma/schema.prisma` with CardTemplate/BenefitTemplate models
- Prisma migration (`npx prisma migrate dev --name add-card-templates`)
- Seed script (`prisma/seed-card-templates.ts`) with 10 realistic cards
- Verify migration runs cleanly and seed data loads

**Dependencies**: None  
**Scope**: Database layer only

---

### Phase 2: API Layer - Card Catalog Endpoints (Estimated: 2 days)
**Objectives**:
- Implement GET `/api/cards/catalog` endpoint (returns card templates)
- Update POST `/api/cards/add` to accept `masterCardId` parameter
- Ensure `/api/cards/my-cards` returns all user cards with benefits

**Key Deliverables**:
- `src/app/api/cards/catalog/route.ts` - GET endpoint
- Updated `src/app/api/cards/add/route.ts` - POST with template support
- Integration tests for all three endpoints
- API documentation with request/response schemas

**Dependencies**: Phase 1  
**Scope**: API layer only

---

### Phase 3: Frontend - Critical Bug Fixes (Estimated: 1 day)
**Objectives**:
- Add DialogTitle to all 4 modals
- Fix Add Card modal state wiring
- Move Edit/Delete buttons to card footer
- Fix checkbox sizing in Settings

**Key Deliverables**:
- Updated `AddCardModal.tsx`, `EditCardModal.tsx`, `AddBenefitModal.tsx`, `EditBenefitModal.tsx`
- Updated `Card.tsx` (move buttons to footer)
- Updated `SettingsPanel.tsx` (checkbox sizing)
- QA testing on all 4 modals

**Dependencies**: None (can parallel with Phase 1-2)  
**Scope**: Frontend bug fixes only

---

### Phase 4: Frontend - Card Catalog UI (Estimated: 2 days)
**Objectives**:
- Rewrite AddCardModal to show card catalog browser
- Implement card selection flow
- Fetch real user cards from `/api/cards/my-cards`
- Display selected card with template benefits

**Key Deliverables**:
- Rewritten `AddCardModal.tsx` with catalog tabs
- Updated dashboard page to fetch real cards
- Updated Card component to render template benefits
- Integration tests for catalog flow (E2E with Playwright)

**Dependencies**: Phase 2 (API), Phase 3 (modal fixes)  
**Scope**: Frontend integration with new API endpoints

---

### Phase 5: QA & Deployment (Estimated: 1 day)
**Objectives**:
- End-to-end testing of entire flow
- Accessibility audit (WCAG 2.1)
- Performance testing (catalog load times)
- Deployment to staging/production

**Key Deliverables**:
- E2E test suite covering all user flows
- Accessibility audit report
- Deployment documentation
- Rollback plan

**Dependencies**: All prior phases  
**Scope**: Testing and deployment validation

---

## Data Schema / State Management

### Database Models (Prisma Schema)

#### Existing Models (Already in schema.prisma)

```prisma
model MasterCard {
  id                String   @id @default(cuid())
  issuer            String   // e.g., "American Express", "Chase", "Discover"
  cardName          String   // e.g., "American Express Gold Card"
  defaultAnnualFee  Int      // In cents (e.g., 25000 = $250)
  cardImageUrl      String   // CDN URL to card image

  // Relationships
  masterBenefits    MasterBenefit[]
  userCards         UserCard[]

  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Indexes & Constraints
  @@index([issuer])
  @@index([cardName])
  @@unique([issuer, cardName])
}

model MasterBenefit {
  id                String   @id @default(cuid())
  masterCardId      String   // FK to MasterCard
  name              String   // e.g., "Dining Credit", "Uber Cash"
  type              String   // 'StatementCredit' | 'UsagePerk'
  stickerValue      Int      // In cents (e.g., 12000 = $120)
  resetCadence      String   // 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'

  // Relationships
  masterCard        MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Cascade)

  // Metadata
  isActive          Boolean @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Indexes
  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
}

model UserCard {
  id                String   @id @default(cuid())
  playerId          String   // FK to Player (current user's player)
  masterCardId      String   // FK to MasterCard (template reference) ← KEY FIELD
  
  // Custom/Cloned Fields
  customName        String?  // User can rename card
  actualAnnualFee   Int?     // Override annual fee (in cents)
  renewalDate       DateTime // Card anniversary/renewal date
  isOpen            Boolean @default(true) // Card is active in wallet
  
  // Status Management
  status            String @default("ACTIVE") // ACTIVE|PENDING|PAUSED|ARCHIVED|DELETED
  statusChangedAt   DateTime?
  statusChangedReason String?
  statusChangedBy   String?
  
  // Archive Metadata
  archivedAt        DateTime?
  archivedBy        String?
  archivedReason    String?
  
  // Import Audit Fields
  importedFrom      String?   // ImportJob ID
  importedAt        DateTime? // When bulk imported
  version           Int       @default(1) // For optimistic locking
  
  // Relationships
  player            Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  masterCard        MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Restrict)
  userBenefits      UserBenefit[]
  
  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  // Indexes
  @@index([playerId])
  @@index([masterCardId])
  @@index([playerId, masterCardId])
  @@index([playerId, status])
  @@index([renewalDate])
  @@unique([playerId, masterCardId])  // Prevent duplicate card instances
}

model UserBenefit {
  id                String   @id @default(cuid())
  userCardId        String   // FK to UserCard
  playerId          String   // FK to Player (denormalized)
  
  // Cloned Fields from MasterBenefit
  name              String   // e.g., "Dining Credit"
  type              String   // 'StatementCredit' | 'UsagePerk'
  stickerValue      Int      // Original value in cents
  resetCadence      String   // 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
  
  // User Customization & Tracking
  userDeclaredValue Int?     // User's estimated value
  isUsed            Boolean @default(false)
  timesUsed         Int @default(0)
  expirationDate    DateTime?
  
  // Status
  status            String @default("ACTIVE") // ACTIVE | ARCHIVED
  
  // Import Audit Fields
  importedFrom      String?
  importedAt        DateTime?
  version           Int @default(1)
  
  // Value History Audit Trail
  valueHistory      String?  // JSON array of value changes
  
  // Relationships
  userCard          UserCard @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  player            Player @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  claimedAt         DateTime?
  
  // Indexes
  @@index([userCardId])
  @@index([playerId])
  @@index([userCardId, name])
  @@index([type])
  @@index([isUsed])
  @@unique([userCardId, name])  // Prevent duplicate benefits on same card
}
```

### No Schema Changes Required
The `MasterCard` and `MasterBenefit` models already exist in your schema.prisma file. **No Prisma schema changes are needed.** We only need to:
1. Create seed data for these models
2. Use `masterCardId` in UserCard (already present)
3. Update API endpoints to query these tables

### State Management (Frontend)

#### AddCardModal Internal State
```typescript
interface AddCardModalState {
  // Catalog browsing
  availableCards: MasterCard[];      // All cards from /api/cards/catalog
  selectedCard: MasterCard | null;   // Currently selected card
  isLoadingCatalog: boolean;         // Loading catalog from API
  
  // Custom card form (fallback)
  formData: {
    cardName: string;
    issuer: string;
    customAnnualFee: string;
    renewalDate: string;
  };
  
  // UI State
  activeTab: 'browse' | 'custom';    // Which tab is visible
  isOpen: boolean;                   // Modal visibility
  isSubmitting: boolean;             // Creating card
  errors: Record<string, string>;    // Validation errors
  message: string;                   // Success/error message
}
```

#### Dashboard Page State
```typescript
interface DashboardState {
  userCards: UserCard[];             // All user's cards from /api/cards/my-cards
  isLoadingCards: boolean;           // Fetching cards
  addCardModalOpen: boolean;         // AddCardModal visibility
  editingCardId: string | null;      // Card being edited
  deleteConfirmCardId: string | null; // Card pending deletion
}
```

---

## User Flows & Workflows

### User Flow 1: Browse & Select Card from Catalog (Primary Flow)

```
START: User clicks "Add Card" button
  ↓
Show AddCardModal with "Browse Cards" tab active
  ↓
API calls GET /api/cards/catalog
  ↓
Modal displays list/grid of MasterCard templates
Each card shows:
  - Card issuer + name
  - Annual fee
  - First 3 benefits preview
  - "Select Card" button
  ↓
User clicks "Select Card" on desired card (e.g., "Amex Gold")
  ↓
Show confirmation UI with selected card details
  ↓
User confirms selection
  ↓
API POST /api/cards/add with:
  {
    masterCardId: "card-123",
    renewalDate: "2025-01-15"
  }
  ↓
Server creates UserCard with masterCardId
Server clones MasterBenefits → UserBenefits (timesUsed=0)
Returns new UserCard with benefits
  ↓
Modal closes, toast shows "Card added successfully"
  ↓
Dashboard refreshes card list from /api/cards/my-cards
  ↓
New card appears in card grid with all template benefits visible
  ↓
END
```

### User Flow 2: Create Custom Card (Fallback Flow)

```
START: User clicks "Add Card" button
  ↓
Show AddCardModal with "Browse Cards" tab
  ↓
User clicks "Create Custom Card" tab
  ↓
Show form with fields:
  - Card Name (required)
  - Issuer (optional)
  - Annual Fee (optional)
  - Renewal Date (required)
  ↓
User fills form and clicks "Create Card"
  ↓
API POST /api/cards/add with:
  {
    customName: "My Custom Card",
    issuer: "Custom Issuer",
    actualAnnualFee: 10000,
    renewalDate: "2025-01-15"
  }
  ↓
Server creates UserCard with masterCardId = null (no template)
Returns new empty UserCard
  ↓
Modal closes, user can add benefits via "Add Benefit" button
  ↓
END
```

### User Flow 3: View User's Cards (Dashboard)

```
START: User loads dashboard
  ↓
Page component calls GET /api/cards/my-cards
  ↓
API returns all UserCards for current player:
  {
    success: true,
    cards: [
      {
        id: "card-1",
        masterCardId: "master-123", // Reference to template
        customName: "My Amex Gold",
        actualAnnualFee: 25000,
        renewalDate: "2025-01-15",
        userBenefits: [
          {
            id: "benefit-1",
            name: "Dining Credit",
            stickerValue: 12000,
            timesUsed: 2,
            isUsed: true
          },
          ...
        ]
      },
      ...
    ]
  }
  ↓
Dashboard renders CardGrid component
Each card shows:
  - Card header: issuer, name, annual fee
  - Benefits list with timesUsed counter
  - Footer with Edit/Delete buttons (flex right-aligned)
  ↓
User can click:
  - Edit button → EditCardModal
  - Delete button → DeleteConfirmation dialog
  - Benefit row → EditBenefitModal
  ↓
END
```

### User Flow 4: Edit Card (Existing Flow, But Simplified)

```
START: User clicks Edit button on card
  ↓
Show EditCardModal with card data pre-filled:
  - Card name
  - Annual fee
  - Renewal date
  ↓
User modifies field(s) and clicks "Save"
  ↓
API PATCH /api/cards/[id] with changed fields
  ↓
Server updates UserCard.customName / actualAnnualFee / renewalDate
Returns updated card
  ↓
Modal closes, card on dashboard refreshes
  ↓
END
```

### User Flow 5: Delete Card (Existing Flow, Unchanged)

```
START: User clicks Delete button on card
  ↓
Show DeleteCardConfirmationDialog
  ↓
User confirms deletion
  ↓
API DELETE /api/cards/[id]
  ↓
Server soft-deletes card (sets status = "DELETED")
  ↓
Dialog closes, card is removed from dashboard
  ↓
END
```

### State Transition Diagram (AddCardModal)

```
┌─────────────────────────────────────────────────────────┐
│                   CLOSED (isOpen=false)                 │
└──────────────────────┬──────────────────────────────────┘
                       │ User clicks "Add Card" button
                       ↓
┌─────────────────────────────────────────────────────────┐
│         BROWSE_CATALOG (isOpen=true, tab="browse")      │
│  - Loading catalog from API                             │
│  - Display card templates                               │
└──────────────────────┬──────────────────────────────────┘
        ↙             ↓              ↘
   Click        Click "Create       Click
  "Create        Custom"           "Select"
  Custom"                           button
    ↓                                ↓
    ↓                         ┌─────────────────────┐
    ↓                         │  CONFIRM_SELECTION  │
    ↓                         │ - Show card details │
    ↓                         │ - User confirms     │
    ↓                         └────────┬────────────┘
    ↓                                  │ Confirm
    ↓                          ┌───────↓────────┐
    ↓                          │ CREATING_CARD  │
    ↓                          │ - API call     │
    ↓                          └────────┬───────┘
    ↓                                   │
    ↓        ┌────────────────────────→ Card created
    ↓        │                          ↓
    ↓    ┌───┴──────────────────────────────────┐
    └───→│      CLOSED_SUCCESS (onClose)        │
         │ - Modal closes                       │
         │ - Toast: "Card added"                │
         │ - Dashboard refreshes                │
         └─────────────────────────────────────┘
```

---

## API Routes & Contracts

### 1. GET /api/cards/catalog
**Purpose**: Fetch all available card templates (for AddCardModal catalog browser)

**Request**:
```http
GET /api/cards/catalog HTTP/1.1
Authorization: Bearer {sessionToken}
Accept: application/json
```

**Query Parameters**:
- `limit` (optional, default: 50, max: 100) – Max number of cards to return
- `skip` (optional, default: 0) – Pagination offset
- `category` (optional) – Filter by category (e.g., "Travel", "Cashback")
- `maxAnnualFee` (optional, in cents) – Filter cards under fee threshold

**Response (200 OK)**:
```json
{
  "success": true,
  "cards": [
    {
      "id": "card-123",
      "issuer": "American Express",
      "cardName": "American Express Gold Card",
      "defaultAnnualFee": 25000,
      "cardImageUrl": "https://cdn.example.com/amex-gold.png",
      "masterBenefits": [
        {
          "id": "benefit-1",
          "name": "$120 Dining Credit",
          "type": "StatementCredit",
          "stickerValue": 12000,
          "resetCadence": "CalendarYear"
        },
        {
          "id": "benefit-2",
          "name": "$100 Uber Credit",
          "type": "StatementCredit",
          "stickerValue": 10000,
          "resetCadence": "CalendarYear"
        },
        {
          "id": "benefit-3",
          "name": "4x Points on Restaurants",
          "type": "UsagePerk",
          "stickerValue": 0,
          "resetCadence": "CalendarYear"
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "id": "card-456",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Reserve",
      "defaultAnnualFee": 55000,
      "cardImageUrl": "https://cdn.example.com/chase-sapphire-reserve.png",
      "masterBenefits": [
        {
          "id": "benefit-4",
          "name": "$300 Travel Credit",
          "type": "StatementCredit",
          "stickerValue": 30000,
          "resetCadence": "CalendarYear"
        },
        {
          "id": "benefit-5",
          "name": "$300 Dining Credit",
          "type": "StatementCredit",
          "stickerValue": 30000,
          "resetCadence": "CalendarYear"
        },
        {
          "id": "benefit-6",
          "name": "3x Points on Travel",
          "type": "UsagePerk",
          "stickerValue": 0,
          "resetCadence": "CalendarYear"
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 2,
  "hasMore": false
}
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "error": "User not authenticated"
}
```

**Response (500 Internal Server Error)**:
```json
{
  "success": false,
  "error": "Failed to fetch card catalog"
}
```

**Implementation Details**:
- Query MasterCard table with eager-load MasterBenefit relations
- Filter by `isActive = true` in MasterBenefit
- Sort by `createdAt DESC` (newest first)
- Apply pagination (skip, limit)
- No authentication required beyond user session (catalog is public to all logged-in users)
- Cache response in Redis for 1 hour (catalog rarely changes)

---

### 2. POST /api/cards/add
**Purpose**: Create a new user card from template or custom entry

**Request**:
```http
POST /api/cards/add HTTP/1.1
Authorization: Bearer {sessionToken}
Content-Type: application/json

{
  "masterCardId": "card-123",
  "renewalDate": "2025-01-15",
  "customName": "My Amex Gold (Optional override)"
}
```

**Request Schema** (one of two patterns):

**Pattern A: From Catalog Template** (Primary)
```typescript
{
  masterCardId: string;        // Required - FK to MasterCard
  renewalDate: string;         // Required - ISO 8601 date
  customName?: string;         // Optional - override card name
}
```

**Pattern B: Custom Card** (Fallback)
```typescript
{
  customName: string;          // Required
  issuer?: string;             // Optional
  actualAnnualFee?: number;    // Optional - in cents
  renewalDate: string;         // Required - ISO 8601 date
  // Note: masterCardId is null/omitted
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "card": {
    "id": "usercard-abc123",
    "playerId": "player-123",
    "masterCardId": "card-123",
    "customName": "My Amex Gold",
    "actualAnnualFee": 25000,
    "renewalDate": "2025-01-15",
    "status": "ACTIVE",
    "createdAt": "2024-11-20T10:30:00Z",
    "userBenefits": [
      {
        "id": "benefit-ub-1",
        "userCardId": "usercard-abc123",
        "name": "$120 Dining Credit",
        "type": "StatementCredit",
        "stickerValue": 12000,
        "resetCadence": "CalendarYear",
        "userDeclaredValue": null,
        "isUsed": false,
        "timesUsed": 0,
        "expirationDate": null,
        "status": "ACTIVE",
        "createdAt": "2024-11-20T10:30:00Z"
      },
      {
        "id": "benefit-ub-2",
        "userCardId": "usercard-abc123",
        "name": "$100 Uber Credit",
        "type": "StatementCredit",
        "stickerValue": 10000,
        "resetCadence": "CalendarYear",
        "userDeclaredValue": null,
        "isUsed": false,
        "timesUsed": 0,
        "expirationDate": null,
        "status": "ACTIVE",
        "createdAt": "2024-11-20T10:30:00Z"
      },
      {
        "id": "benefit-ub-3",
        "userCardId": "usercard-abc123",
        "name": "4x Points on Restaurants",
        "type": "UsagePerk",
        "stickerValue": 0,
        "resetCadence": "CalendarYear",
        "userDeclaredValue": null,
        "isUsed": false,
        "timesUsed": 0,
        "expirationDate": null,
        "status": "ACTIVE",
        "createdAt": "2024-11-20T10:30:00Z"
      }
    ]
  }
}
```

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Invalid renewal date",
  "details": {
    "renewalDate": "Must be in future or today"
  }
}
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "error": "User not authenticated"
}
```

**Response (409 Conflict - Duplicate Card)**:
```json
{
  "success": false,
  "error": "This card already exists in your wallet",
  "details": {
    "cardId": "usercard-abc123"
  }
}
```

**Response (422 Unprocessable Entity - Card Limit)**:
```json
{
  "success": false,
  "error": "Card limit exceeded (max 50 cards per player)"
}
```

**Validation Rules**:
- `masterCardId`: Must be valid, active MasterCard OR must be omitted (for custom)
- `renewalDate`: Must be valid ISO 8601 date, today or in future
- `customName`: If provided, length 1-100 characters
- `issuer`: If provided, length 1-100 characters
- `actualAnnualFee`: If provided, 0-99999 (cents) → $0-$999.99
- Cannot add duplicate card (same masterCardId) twice to same player
- Max 50 cards per player

**Implementation Details**:
- Verify user is authenticated (get playerId from session)
- If `masterCardId` provided: fetch MasterCard & MasterBenefits
- Create UserCard with validated fields
- If `masterCardId`: Clone all MasterBenefits → UserBenefits (timesUsed=0, isUsed=false)
- If custom: Create empty UserCard, user adds benefits later
- Return full UserCard with populated UserBenefits
- Fire event for analytics/logging

---

### 3. GET /api/cards/my-cards
**Purpose**: Fetch all cards for current user (replace hardcoded /api/cards/1)

**Request**:
```http
GET /api/cards/my-cards HTTP/1.1
Authorization: Bearer {sessionToken}
Accept: application/json
```

**Query Parameters**:
- `status` (optional) – Filter by status: ACTIVE, PENDING, PAUSED, ARCHIVED, DELETED (default: ACTIVE)
- `limit` (optional, default: 50, max: 100)
- `skip` (optional, default: 0)
- `sort` (optional, default: "createdAt") – Sort by: createdAt, name, annualFee

**Response (200 OK)**:
```json
{
  "success": true,
  "cards": [
    {
      "id": "usercard-abc123",
      "playerId": "player-123",
      "masterCardId": "card-123",
      "customName": "My Amex Gold",
      "actualAnnualFee": 25000,
      "renewalDate": "2025-01-15",
      "status": "ACTIVE",
      "masterCard": {
        "id": "card-123",
        "issuer": "American Express",
        "cardName": "American Express Gold Card",
        "defaultAnnualFee": 25000,
        "cardImageUrl": "https://cdn.example.com/amex-gold.png"
      },
      "userBenefits": [
        {
          "id": "benefit-ub-1",
          "name": "$120 Dining Credit",
          "type": "StatementCredit",
          "stickerValue": 12000,
          "userDeclaredValue": null,
          "isUsed": true,
          "timesUsed": 2,
          "status": "ACTIVE"
        },
        {
          "id": "benefit-ub-2",
          "name": "$100 Uber Credit",
          "type": "StatementCredit",
          "stickerValue": 10000,
          "userDeclaredValue": null,
          "isUsed": false,
          "timesUsed": 0,
          "status": "ACTIVE"
        },
        {
          "id": "benefit-ub-3",
          "name": "4x Points on Restaurants",
          "type": "UsagePerk",
          "stickerValue": 0,
          "userDeclaredValue": null,
          "isUsed": false,
          "timesUsed": 0,
          "status": "ACTIVE"
        }
      ],
      "createdAt": "2024-11-20T10:30:00Z",
      "updatedAt": "2024-11-20T14:00:00Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

**Response (401 Unauthorized)**:
```json
{
  "success": false,
  "error": "User not authenticated"
}
```

**Implementation Details**:
- Query UserCard table filtered by playerId from session
- Eager-load masterCard and userBenefits relations
- Filter by status (default: ACTIVE only)
- Apply pagination
- Include MasterCard data for reference (issuer, cardName, etc.)
- Cache per user in Redis for 5 minutes

---

### 4. GET /api/cards/[id]
**Purpose**: Fetch single card with all details (already exists, no changes needed)

**Request**:
```http
GET /api/cards/[id] HTTP/1.1
Authorization: Bearer {sessionToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "card": {
    "id": "usercard-abc123",
    "playerId": "player-123",
    "masterCardId": "card-123",
    "customName": "My Amex Gold",
    "actualAnnualFee": 25000,
    "renewalDate": "2025-01-15",
    "status": "ACTIVE",
    "masterCard": {
      "id": "card-123",
      "issuer": "American Express",
      "cardName": "American Express Gold Card",
      "defaultAnnualFee": 25000,
      "cardImageUrl": "https://cdn.example.com/amex-gold.png"
    },
    "userBenefits": [...]
  }
}
```

**Response (404 Not Found)**:
```json
{
  "success": false,
  "error": "Card not found"
}
```

---

### 5. PATCH /api/cards/[id]
**Purpose**: Update card details (already exists, verify it works with new schema)

**Request**:
```http
PATCH /api/cards/[id] HTTP/1.1
Authorization: Bearer {sessionToken}
Content-Type: application/json

{
  "customName": "Updated Name",
  "actualAnnualFee": 25000,
  "renewalDate": "2025-01-15"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "card": { ... }
}
```

---

### 6. DELETE /api/cards/[id]
**Purpose**: Delete/soft-delete card (already exists, no changes needed)

**Request**:
```http
DELETE /api/cards/[id] HTTP/1.1
Authorization: Bearer {sessionToken}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Card deleted successfully"
}
```

**Implementation**: Soft-delete by setting `status = "DELETED"` (do NOT hard-delete)

---

## Edge Cases & Error Handling

### Edge Case 1: User Adds Same Card Twice

**Scenario**: User selects "Amex Gold" from catalog, creates it. Then selects "Amex Gold" again.

**Expected Behavior**: 
- ❌ **Prevent via unique constraint**: `@@unique([playerId, masterCardId])` in UserCard schema
- **Error response (409 Conflict)**:
  ```json
  {
    "success": false,
    "error": "This card already exists in your wallet"
  }
  ```
- **Frontend handling**: Show toast message "Card already added"
- **Alternative (if business rule allows duplicates)**: Remove unique constraint, allow multiple instances, add instance counter (e.g., "Amex Gold #1", "Amex Gold #2")

### Edge Case 2: User Adds Maximum Cards (50+)

**Scenario**: User has 50 cards, tries to add another.

**Expected Behavior**:
- ❌ **Reject in API**: Return 422 "Card limit exceeded"
- **Frontend handling**: Disable "Add Card" button, show message "You've reached max 50 cards"
- **Logic**: Check card count in POST /api/cards/add before creating

### Edge Case 3: Card with No Benefits

**Scenario**: A MasterCard is created with 0 MasterBenefits. User adds this card.

**Expected Behavior**:
- ✓ **Allow creation**: UserCard created with empty userBenefits array
- **Frontend handling**: Show card without benefits section, allow user to add benefits manually
- **Logic**: No validation preventing 0 benefits

### Edge Case 4: Card Template Deleted After User Added It

**Scenario**: Admin deletes a MasterCard. User still has a UserCard referencing it.

**Expected Behavior**:
- ❌ **Schema constraint**: `@relation(..., onDelete: Restrict)` prevents deletion of MasterCard if UserCards reference it
- **Alternative**: Soft-delete MasterCard (set isActive=false), keep UserCard intact
- **Frontend**: Show card data from UserCard even if MasterCard is deleted

### Edge Case 5: Renewal Date in the Past

**Scenario**: User enters renewal date "2020-01-01" (past date).

**Expected Behavior**:
- ❌ **Reject in API validation**: "Renewal date must be today or in future"
- **Frontend validation**: HTML input `min` attribute set to today's date
- **Error response (400)**:
  ```json
  {
    "success": false,
    "error": "Invalid renewal date",
    "details": { "renewalDate": "Must be today or in future" }
  }
  ```

### Edge Case 6: Concurrent Add Card Requests

**Scenario**: User rapidly clicks "Select Card" twice (network latency → duplicate creation).

**Expected Behavior**:
- ✓ **Idempotency**: Use unique constraint `[playerId, masterCardId]` to catch duplicates
- **First request**: Creates card, returns success
- **Second request**: Database rejects duplicate, API returns 409 Conflict
- **Frontend handling**: Disable button during submission, show loading state
- **Logic**: Modal auto-closes after success, preventing duplicate clicks

### Edge Case 7: Catalog API Returns 0 Cards

**Scenario**: No MasterCards seeded in database yet.

**Expected Behavior**:
- ✓ **Allow**:返回空数组，不是错误
- **Frontend handling**: Show "No cards available" message with link to "Create Custom Card"
- **Response**:
  ```json
  {
    "success": true,
    "cards": [],
    "total": 0,
    "hasMore": false
  }
  ```

### Edge Case 8: Session Expires During Modal

**Scenario**: User opens AddCardModal, session expires, tries to select a card.

**Expected Behavior**:
- ❌ **API returns 401**: "User not authenticated"
- **Frontend handling**: Redirect to login with return URL
- **Logic**: All API calls include auth check (middleware)

### Edge Case 9: Database Connection Fails During Catalog Load

**Scenario**: GET /api/cards/catalog times out (DB unreachable).

**Expected Behavior**:
- **API returns 500**: "Failed to fetch card catalog"
- **Frontend handling**: Show error message with retry button
- **Logic**: Timeout after 10s, fallback to custom card creation

### Edge Case 10: User Edits Card While Benefits Are Being Used

**Scenario**: User updates renewal date while viewing benefit details.

**Expected Behavior**:
- ✓ **Allow**: Both operations are independent
- **Logic**: Optimistic locking via `version` field in UserCard/UserBenefit
  - If conflict detected (version mismatch), return 409 with "This card was modified by another request"
  - Frontend shows retry/reload dialog

### Edge Case 11: Benefit Name Contains Special Characters

**Scenario**: MasterBenefit name: "$120 Dining Credit (Excludes Alcohol)"

**Expected Behavior**:
- ✓ **Allow**: Store as-is, no sanitization needed (not user input)
- **Frontend**: Render safely with React (auto-escapes)
- **Logic**: Data comes from seed file (trusted source)

### Edge Case 12: Mobile Layout - Card Footer Buttons Overflow

**Scenario**: On mobile (320px width), Edit/Delete buttons don't fit in footer.

**Expected Behavior**:
- ✓ **Stack vertically**: On small screens, show buttons in column (flex-col) instead of row
- **Logic**: Tailwind responsive: `flex-row md:flex-col` or similar
- **Test**: Verify on 320px, 375px, 768px widths

### Edge Case 13: Checkbox Sizing Conflict in Settings

**Scenario**: Global CSS or Tailwind config sets all checkboxes to w-6 h-6, override needed for Settings.

**Expected Behavior**:
- ✓ **Force override with !important or scoped class**:
  ```jsx
  <input type="checkbox" className="w-4 h-4" /> {/* or w-5 h-5 */}
  ```
- **Logic**: No global style change (might break other checkboxes)
- **Frontend**: Update only SettingsPanel component

### Edge Case 14: Null masterCard Reference in UserCard

**Scenario**: User created custom card (masterCardId = null). Card displays on dashboard.

**Expected Behavior**:
- ✓ **Allow**:显示自定义卡片数据（不显示masterCard）
- **Frontend**: Check if masterCard exists:
  ```jsx
  {masterCard ? <div>{masterCard.issuer} - {masterCard.cardName}</div> : <div>{customName}</div>}
  ```
- **Logic**: masterCard relation is optional (`masterCard: MasterCard?`)

---

## Component Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend Layer                              │
│                                                                       │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │   Dashboard Page     │  │    Settings Page     │                │
│  │  - Fetch my-cards    │  │  - Checkbox sizing   │                │
│  │  - Render CardGrid   │  │    fixes (w-4 h-4)   │                │
│  │  - Add Card button   │  │                      │                │
│  └──────────┬───────────┘  └──────────────────────┘                │
│             │                                                        │
│             ↓                                                        │
│  ┌──────────────────────────────────────────┐                      │
│  │   AddCardModal Component (Rewritten)     │                      │
│  │  ┌─────────────────────────────────────┐│                      │
│  │  │ Browse Tab (Primary)                ││                      │
│  │  │ - Fetch /api/cards/catalog          ││                      │
│  │  │ - Display MasterCard list/grid      ││                      │
│  │  │ - Show benefit preview (3-5)        ││                      │
│  │  │ - "Select Card" button              ││                      │
│  │  └─────────────────────────────────────┘│                      │
│  │  ┌─────────────────────────────────────┐│                      │
│  │  │ Custom Tab (Fallback)               ││                      │
│  │  │ - Form: name, issuer, fee, date     ││                      │
│  │  │ - "Create Custom Card" button       ││                      │
│  │  └─────────────────────────────────────┘│                      │
│  │  ┌─────────────────────────────────────┐│                      │
│  │  │ ✓ DialogTitle component             ││                      │
│  │  │ ✓ Focus management                  ││                      │
│  │  │ ✓ Keyboard navigation               ││                      │
│  │  └─────────────────────────────────────┘│                      │
│  └──────────────────────────────────────────┘                      │
│             │                                                        │
│             ↓ POST /api/cards/add                                   │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  Card Component (Updated)                │                      │
│  │  ┌──────────────────────────────────────┐│                      │
│  │  │ Card Header: issuer, name, fee       ││                      │
│  │  └──────────────────────────────────────┘│                      │
│  │  ┌──────────────────────────────────────┐│                      │
│  │  │ Benefits List (from template)        ││                      │
│  │  │ - render UserBenefits with counts    ││                      │
│  │  └──────────────────────────────────────┘│                      │
│  │  ┌──────────────────────────────────────┐│                      │
│  │  │ Card Footer (MOVED buttons here)     ││                      │
│  │  │ - [Edit] [Delete] (flex-right)       ││                      │
│  │  └──────────────────────────────────────┘│                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  Modal Components (All with DialogTitle) │                      │
│  │  - EditCardModal.tsx (+ DialogTitle)     │                      │
│  │  - AddBenefitModal.tsx (+ DialogTitle)   │                      │
│  │  - EditBenefitModal.tsx (+ DialogTitle)  │                      │
│  └──────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP Requests
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend API Layer                            │
│                                                                       │
│  ┌──────────────────────────────────────────┐                      │
│  │  GET /api/cards/catalog                  │                      │
│  │  - Query MasterCard + MasterBenefit      │                      │
│  │  - Pagination, filtering, caching        │                      │
│  │  - Return array of templates             │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  POST /api/cards/add (Updated)           │                      │
│  │  - Validate masterCardId OR custom data  │                      │
│  │  - Create UserCard                       │                      │
│  │  - Clone MasterBenefits → UserBenefits   │                      │
│  │  - Return UserCard with benefits         │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  GET /api/cards/my-cards (Updated)       │                      │
│  │  - Query UserCard filtered by playerId   │                      │
│  │  - Eager-load masterCard + userBenefits  │                      │
│  │  - Return user's cards with benefits     │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  GET /api/cards/[id]                     │                      │
│  │  PATCH /api/cards/[id]                   │                      │
│  │  DELETE /api/cards/[id]                  │                      │
│  │  (Existing endpoints, no changes)        │                      │
│  └──────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Prisma ORM
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      Database Layer                                  │
│                                                                       │
│  ┌──────────────────────────────────────────┐                      │
│  │  MasterCard (Read-Only Templates)        │                      │
│  │  - id, issuer, cardName, annualFee, etc. │                      │
│  │  - 1 → N MasterBenefit                   │                      │
│  │  - 1 → N UserCard (references)           │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  MasterBenefit (Benefit Templates)       │                      │
│  │  - id, masterCardId, name, value, etc.   │                      │
│  │  - N → 1 MasterCard                      │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  UserCard (User's Card Instances)        │                      │
│  │  - id, playerId, masterCardId, etc.      │                      │
│  │  - 1 → N UserBenefit                     │                      │
│  │  - N → 1 MasterCard (FK reference)       │                      │
│  └──────────────────────────────────────────┘                      │
│                                                                      │
│  ┌──────────────────────────────────────────┐                      │
│  │  UserBenefit (User's Benefit Instances)  │                      │
│  │  - id, userCardId, name, value, etc.     │                      │
│  │  - N → 1 UserCard                        │                      │
│  └──────────────────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Dependency Graph

```
AddCardModal (REWRITTEN)
  ├── depends on: /api/cards/catalog
  ├── depends on: /api/cards/add
  ├── uses: DialogTitle, DialogContent, Button, Input, Select, TabsComponent
  └── emits: onCardAdded callback

Dashboard Page
  ├── depends on: /api/cards/my-cards
  ├── uses: CardGrid, CardComponent, AddCardModal
  ├── state: userCards[], addCardModalOpen
  └── refetch on: card added/deleted

Card Component
  ├── depends on: UserCard + UserBenefit[] from parent
  ├── uses: CardHeader, BenefitsList, CardFooter
  ├── props: card: UserCard, onEdit, onDelete
  └── actions: Edit button, Delete button (in FOOTER)

CardGrid
  ├── depends on: Card component
  ├── uses: multiple Card components in grid layout
  └── props: cards: UserCard[]

EditCardModal
  ├── depends on: /api/cards/[id] PATCH
  ├── uses: DialogTitle (FIXED), DialogContent, Form
  └── emits: onCardUpdated

AddBenefitModal
  ├── depends on: /api/cards/[id]/benefits POST
  ├── uses: DialogTitle (FIXED), Form
  └── emits: onBenefitAdded

EditBenefitModal
  ├── depends on: /api/cards/[id]/benefits/[id] PATCH
  ├── uses: DialogTitle (FIXED), Form
  └── emits: onBenefitUpdated

SettingsPanel
  ├── uses: Checkbox (w-4 h-4 FIXED)
  └── no API dependencies
```

### Component Integration Points

| Component | Responsibility | Dependencies | Notes |
|-----------|---|---|---|
| **Dashboard** | Fetch user cards, render grid, manage modals | /api/cards/my-cards | Replace hardcoded /api/cards/1 |
| **AddCardModal** | Browse catalog, select card, show tabs | /api/cards/catalog, /api/cards/add | Rewrite with tabs (browse/custom) |
| **Card** | Display card info, show benefits, action buttons | UserCard + UserBenefit data | Move Edit/Delete to footer |
| **EditCardModal** | Edit card details (name, fee, date) | /api/cards/[id] PATCH | Add DialogTitle |
| **AddBenefitModal** | Add benefit to card | /api/cards/[id]/benefits POST | Add DialogTitle |
| **EditBenefitModal** | Edit benefit details | /api/cards/[id]/benefits/[id] PATCH | Add DialogTitle |
| **SettingsPanel** | Manage user settings, checkboxes | None | Fix checkbox size (w-4 h-4) |

---

## Implementation Tasks

### Phase 1: Database Schema & Seeding (Est. 2 days)

#### Task 1.1: Create Seed Data Script
**Description**: Create `prisma/seed-card-templates.ts` with 10+ realistic card templates and their benefits

**Acceptance Criteria**:
- ✓ Script creates 10+ MasterCard records with realistic names (Amex Gold, Chase Sapphire, etc.)
- ✓ Each MasterCard has 5-8 realistic MasterBenefit records
- ✓ Benefits include statement credits, points, perks with accurate stickerValues
- ✓ Benefits have correct resetCadence (CalendarYear, Monthly, OneTime)
- ✓ Script runs without errors: `npx prisma db seed`
- ✓ Database contains exactly expected number of MasterCard/MasterBenefit records
- ✓ Seed script is idempotent (can run multiple times without duplication)

**Card Templates to Include**:
1. American Express Gold Card ($250 annual fee)
2. Chase Sapphire Reserve ($550 annual fee)
3. Chase Sapphire Preferred ($95 annual fee)
4. Discover IT ($0 annual fee)
5. Capital One Venture X ($395 annual fee)
6. American Express Business Platinum ($695 annual fee)
7. Citi Premier Card ($95 annual fee)
8. Bank of America Premium Rewards ($95 annual fee)
9. US Bank Altitude Reserve ($400 annual fee)
10. Wells Fargo Propel American Express Card ($0 annual fee)

**Complexity**: Medium  
**Dependencies**: None

---

#### Task 1.2: Verify Prisma Schema (No Changes Needed)
**Description**: Confirm MasterCard and MasterBenefit models exist and UserCard references masterCardId

**Acceptance Criteria**:
- ✓ MasterCard model exists with: id, issuer, cardName, defaultAnnualFee, cardImageUrl, masterBenefits relation
- ✓ MasterBenefit model exists with: id, masterCardId, name, type, stickerValue, resetCadence, masterCard relation
- ✓ UserCard model includes: masterCardId FK, masterCard relation
- ✓ No schema changes are needed (only seeding and API updates)

**Complexity**: Small  
**Dependencies**: None

---

#### Task 1.3: Run Migration & Test Seed
**Description**: Execute Prisma migration and test seed data loads correctly

**Acceptance Criteria**:
- ✓ `npx prisma migrate dev --name add-card-templates` runs without errors
- ✓ `npx prisma db seed` executes without errors
- ✓ Database queries return correct MasterCard/MasterBenefit counts
- ✓ Sample queries work: `SELECT * FROM MasterCard JOIN MasterBenefit...`
- ✓ Test script confirms all cards have benefits (no empty cards)

**Complexity**: Small  
**Dependencies**: Task 1.1, Task 1.2

---

### Phase 2: API Layer - Card Catalog Endpoints (Est. 2 days)

#### Task 2.1: Implement GET /api/cards/catalog Endpoint
**Description**: Create new route `src/app/api/cards/catalog/route.ts` that returns all MasterCard templates with benefits

**Acceptance Criteria**:
- ✓ Route responds to GET requests
- ✓ Requires authentication (user session)
- ✓ Returns all MasterCard records (with relations to MasterBenefit)
- ✓ Supports pagination: `?limit=20&skip=0`
- ✓ Supports filtering: `?category=Travel` (if category field exists in MasterCard)
- ✓ Response format matches spec: `{ success: true, cards: [...], total: N, hasMore: bool }`
- ✓ Error handling: 401 if not authenticated, 500 on DB error
- ✓ Response cached in Redis for 1 hour (using existing Redis client)
- ✓ Performance: Returns <1s for full catalog (10-50 cards)
- ✓ Integration test covers pagination, filtering, auth check

**Complexity**: Medium  
**Dependencies**: Phase 1

---

#### Task 2.2: Update POST /api/cards/add Endpoint
**Description**: Enhance existing `src/app/api/cards/add/route.ts` to accept masterCardId parameter and clone benefits

**Acceptance Criteria**:
- ✓ Accepts `masterCardId` in request body (optional, for template selection)
- ✓ If masterCardId provided:
  - Validates MasterCard exists
  - Creates UserCard with masterCardId FK
  - Clones all MasterBenefits → UserBenefits (timesUsed=0, isUsed=false, status=ACTIVE)
- ✓ If masterCardId not provided (custom card):
  - Falls back to existing behavior (create empty UserCard)
- ✓ Validates renewal date (must be today or future)
- ✓ Validates annual fee (0-99999 cents)
- ✓ Checks unique constraint: prevents duplicate [playerId, masterCardId]
- ✓ Checks card limit: max 50 cards per player
- ✓ Response includes new UserCard with all cloned UserBenefits (201 Created)
- ✓ Error handling: 400 for validation, 409 for duplicate, 422 for limit
- ✓ Integration test covers template selection flow and custom card fallback

**Complexity**: Medium  
**Dependencies**: Phase 1

---

#### Task 2.3: Update GET /api/cards/my-cards Endpoint
**Description**: Ensure existing `src/app/api/cards/my-cards/route.ts` returns all cards with masterCard relation

**Acceptance Criteria**:
- ✓ Queries UserCard filtered by playerId from session
- ✓ Eager-loads masterCard and userBenefits relations
- ✓ Returns only ACTIVE cards (default) or filtered by ?status=
- ✓ Response includes MasterCard data (issuer, cardName, defaultAnnualFee, cardImageUrl)
- ✓ Response includes all UserBenefit data (name, stickerValue, isUsed, timesUsed, etc.)
- ✓ Pagination support: ?limit=50&skip=0
- ✓ Sorting support: ?sort=createdAt (default) or name or annualFee
- ✓ Cached in Redis per user (5 min TTL)
- ✓ Performance: Returns <500ms even with 50+ cards
- ✓ Integration test covers with/without template reference

**Complexity**: Small  
**Dependencies**: Phase 1

---

#### Task 2.4: API Integration Testing
**Description**: Write comprehensive tests for all three endpoints using Playwright or Jest

**Acceptance Criteria**:
- ✓ Test GET /api/cards/catalog: returns array, pagination works, auth required
- ✓ Test POST /api/cards/add with template: creates card with cloned benefits
- ✓ Test POST /api/cards/add custom: creates empty card (no template)
- ✓ Test duplicate prevention: 409 on duplicate masterCardId
- ✓ Test GET /api/cards/my-cards: returns user's cards only, includes masterCard
- ✓ Test auth failures: all endpoints return 401 without session
- ✓ Tests cover pagination, filtering, validation errors
- ✓ All tests pass with 100% success rate

**Complexity**: Medium  
**Dependencies**: Tasks 2.1, 2.2, 2.3

---

### Phase 3: Frontend - Critical Bug Fixes (Est. 1 day)

#### Task 3.1: Add DialogTitle to AddCardModal
**Description**: Add `<DialogTitle>` component to `src/components/AddCardModal.tsx` for WCAG compliance

**Acceptance Criteria**:
- ✓ Import DialogTitle from `@radix-ui/react-dialog`
- ✓ Add `<DialogTitle>` inside modal (e.g., "Add a Credit Card")
- ✓ Title is accessible to screen readers
- ✓ Title visually displays above form (or use VisuallyHidden if crowded)
- ✓ Focus management: focus enters first interactive element on open
- ✓ Keyboard navigation: Tab, Shift+Tab, Escape work correctly
- ✓ Accessibility audit passes (axe DevTools, WAVE)
- ✓ No visual layout breaks

**Complexity**: Small  
**Dependencies**: None

---

#### Task 3.2: Add DialogTitle to EditCardModal
**Description**: Add `<DialogTitle>` to `src/components/EditCardModal.tsx`

**Acceptance Criteria**:
- ✓ DialogTitle added (e.g., "Edit Card: {cardName}")
- ✓ Accessibility audit passes
- ✓ Focus management works

**Complexity**: Small  
**Dependencies**: None

---

#### Task 3.3: Add DialogTitle to AddBenefitModal
**Description**: Add `<DialogTitle>` to `src/components/AddBenefitModal.tsx`

**Acceptance Criteria**:
- ✓ DialogTitle added (e.g., "Add Benefit")
- ✓ Accessibility audit passes

**Complexity**: Small  
**Dependencies**: None

---

#### Task 3.4: Add DialogTitle to EditBenefitModal
**Description**: Add `<DialogTitle>` to `src/components/EditBenefitModal.tsx`

**Acceptance Criteria**:
- ✓ DialogTitle added (e.g., "Edit Benefit: {benefitName}")
- ✓ Accessibility audit passes

**Complexity**: Small  
**Dependencies**: None

---

#### Task 3.5: Fix Add Card Modal State Wiring
**Description**: Ensure AddCardModal is rendered in dashboard and button onClick wires to setOpen(true)

**Acceptance Criteria**:
- ✓ AddCardModal component is imported and rendered in dashboard/page
- ✓ Modal isOpen state is controlled by dashboard component
- ✓ "Add Card" button has onClick={() => setAddCardModalOpen(true)}
- ✓ Modal onClose callback sets isOpen to false
- ✓ Modal backdrop/X button closes modal
- ✓ Manual test: click "Add Card" button → modal appears
- ✓ Manual test: click X button → modal closes
- ✓ Manual test: press Escape → modal closes

**Complexity**: Small  
**Dependencies**: None

---

#### Task 3.6: Move Edit/Delete Buttons to Card Footer
**Description**: Refactor `src/components/Card.tsx` to move action buttons from header to footer

**Acceptance Criteria**:
- ✓ Edit and Delete buttons moved from card header to footer
- ✓ Footer is styled as flexbox row, buttons right-aligned
- ✓ Footer has consistent padding/spacing
- ✓ On mobile (320px), buttons stack vertically (responsive)
- ✓ Buttons remain accessible (focus visible, keyboard navigable)
- ✓ No visual regression in card header (less crowded)
- ✓ Manual test: buttons appear in footer on desktop and mobile

**Complexity**: Small  
**Dependencies**: None

---

#### Task 3.7: Fix Checkbox Sizing in Settings
**Description**: Update `src/components/SettingsPanel.tsx` checkboxes to standard size (w-4 h-4 or w-5 h-5)

**Acceptance Criteria**:
- ✓ All checkboxes in SettingsPanel use Tailwind classes `w-4 h-4` or `w-5 h-5`
- ✓ Checkboxes are visually consistent (all same size)
- ✓ No visual regression in other components (only Settings affected)
- ✓ Manual test: checkboxes appear small/standard sized
- ✓ Accessibility: labels still properly associated with checkboxes

**Complexity**: Small  
**Dependencies**: None

---

### Phase 4: Frontend - Card Catalog UI (Est. 2 days)

#### Task 4.1: Rewrite AddCardModal with Catalog Browsing
**Description**: Replace existing AddCardModal form with tabs: "Browse Cards" (primary) and "Create Custom" (fallback)

**Acceptance Criteria**:
- ✓ "Browse Cards" tab displays as grid/list of MasterCard templates
- ✓ Each card shows: issuer, cardName, defaultAnnualFee, benefit preview (3-5 benefits)
- ✓ Each card has "Select Card" button
- ✓ "Create Custom" tab displays existing form (fallback)
- ✓ Tab switching works (click to switch)
- ✓ Catalog loading: shows spinner while fetching from /api/cards/catalog
- ✓ Empty state: "No cards available" if catalog returns 0 results
- ✓ Error state: shows error message if catalog fetch fails
- ✓ Performance: catalog renders <500ms
- ✓ Responsive on mobile: cards stack in single column
- ✓ Accessibility: tabs are semantic (Radix UI tabs component)

**Complexity**: Large  
**Dependencies**: Task 2.1 (API endpoint)

---

#### Task 4.2: Implement Card Selection Flow
**Description**: Wire "Select Card" button to create UserCard from template

**Acceptance Criteria**:
- ✓ Clicking "Select Card" opens confirmation dialog or inline confirmation
- ✓ Confirmation shows selected card details
- ✓ Confirmation shows renewal date input
- ✓ User confirms → API POST /api/cards/add with masterCardId
- ✓ Loading state shown during API call
- ✓ Success: modal closes, toast "Card added successfully"
- ✓ Error: shows error message (e.g., "Card already added" for duplicates)
- ✓ Response includes new UserCard with cloned benefits
- ✓ onCardAdded callback fired (to refresh dashboard)

**Complexity**: Medium  
**Dependencies**: Task 2.2 (API endpoint)

---

#### Task 4.3: Update Dashboard to Fetch Real Cards
**Description**: Replace hardcoded `/api/cards/1` queries with `/api/cards/my-cards`

**Acceptance Criteria**:
- ✓ Dashboard page calls GET /api/cards/my-cards on mount
- ✓ Removes hardcoded ID '1' from all queries
- ✓ Displays all user's cards (if >1 card added)
- ✓ If no cards, shows "Add your first card" message
- ✓ Loading state shown while fetching
- ✓ Error handling: "Failed to load cards" with retry button
- ✓ Manual test: add multiple cards → all appear on dashboard
- ✓ Manual test: delete card → card disappears from dashboard

**Complexity**: Medium  
**Dependencies**: Task 2.3 (API endpoint)

---

#### Task 4.4: Update Card Component to Display Template Benefits
**Description**: Wire Card component to display UserBenefit[] with proper data from template

**Acceptance Criteria**:
- ✓ Card displays issuer and name from masterCard (if available) or customName
- ✓ Card displays annual fee from masterCard.defaultAnnualFee or UserCard.actualAnnualFee
- ✓ Benefits list displays all UserBenefits:
  - Benefit name
  - Sticker value (formatted as currency)
  - Reset cadence
  - Times used counter
  - Is used toggle
- ✓ If card has no benefits (custom), shows "No benefits" message
- ✓ If card has masterCard reference, displays as "[Issuer] - [Name]"
- ✓ If card is custom (no template), displays customName only
- ✓ Manual test: template card shows correct benefits
- ✓ Manual test: custom card displays without benefits

**Complexity**: Small  
**Dependencies**: Task 2.3 (API returns correct data)

---

#### Task 4.5: Add E2E Tests for Catalog Flow
**Description**: Write Playwright tests covering entire user flow from catalog selection to card display

**Acceptance Criteria**:
- ✓ Test: click "Add Card" → catalog modal appears
- ✓ Test: catalog loads and displays 10+ cards
- ✓ Test: click "Select Card" on Amex Gold → confirmation shows
- ✓ Test: confirm selection → card created, modal closes
- ✓ Test: dashboard refreshes and shows new card with benefits
- ✓ Test: new card displays all Amex Gold benefits correctly
- ✓ Test: can add different card (e.g., Chase Sapphire)
- ✓ Test: duplicate card detection (add Amex Gold twice → error)
- ✓ Test: custom card creation (fallback tab)
- ✓ All tests pass with >95% success rate

**Complexity**: Large  
**Dependencies**: All prior tasks

---

### Phase 5: QA & Deployment (Est. 1 day)

#### Task 5.1: Accessibility Audit (WCAG 2.1)
**Description**: Run accessibility audit on all modals and card components using axe DevTools or Lighthouse

**Acceptance Criteria**:
- ✓ All 4 modals pass axe audit (no critical violations)
- ✓ All modals have proper ARIA labels and descriptions
- ✓ DialogTitle components are present and semantic
- ✓ Focus management works (focus visible, trap in modal, returns to trigger)
- ✓ Keyboard navigation works (Tab, Shift+Tab, Escape)
- ✓ Color contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for graphics)
- ✓ Button and input elements are properly labeled
- ✓ No axe audit violations reported
- ✓ Lighthouse accessibility score >90

**Complexity**: Medium  
**Dependencies**: All Phase 3, 4 tasks

---

#### Task 5.2: Performance Testing
**Description**: Test catalog load time, API response times, and component render performance

**Acceptance Criteria**:
- ✓ GET /api/cards/catalog returns <1s (measured with DevTools network tab)
- ✓ GET /api/cards/my-cards returns <500ms
- ✓ POST /api/cards/add completes <2s
- ✓ AddCardModal renders <500ms (after catalog loads)
- ✓ CardGrid with 50 cards renders <1s
- ✓ No React re-render loops (React DevTools Profiler)
- ✓ No unnecessary API calls (single call per action)

**Complexity**: Small  
**Dependencies**: All API and frontend tasks

---

#### Task 5.3: Manual QA Testing
**Description**: Execute comprehensive manual test plan covering all user flows

**Acceptance Criteria**:
- ✓ Test Plan covers:
  - Add card from catalog (happy path)
  - Create custom card (fallback)
  - Edit card (name, fee, renewal date)
  - Delete card
  - Add benefit
  - Edit benefit
  - All 4 modals (DialogTitle, focus, keyboard)
  - Mobile responsiveness (320px, 375px, 768px)
  - Accessibility (keyboard only, screen reader)
  - Error scenarios (duplicate, limit exceeded, network failure)
- ✓ All tests pass
- ✓ No visual regressions
- ✓ No console errors or warnings

**Complexity**: Medium  
**Dependencies**: All implementation tasks

---

#### Task 5.4: Deployment & Rollback Plan
**Description**: Deploy to staging, verify, then production with rollback plan

**Acceptance Criteria**:
- ✓ Code reviewed and approved
- ✓ All tests pass in CI/CD pipeline
- ✓ Deployed to staging environment
- ✓ Smoke tests pass on staging
- ✓ Deployed to production with feature flag (optional)
- ✓ Monitoring alerts configured for errors/performance degradation
- ✓ Rollback plan documented and tested (revert to previous DB schema if needed)
- ✓ Post-deployment: verify analytics tracking (card additions, etc.)

**Complexity**: Small  
**Dependencies**: All prior tasks

---

## Security & Compliance Considerations

### Authentication & Authorization
- **Requirement**: All API endpoints require valid user session (SessionToken)
- **Implementation**: Middleware checks session validity before route handler
- **Error Response**: 401 Unauthorized if session missing/expired
- **Token Refresh**: Existing Redis-based session refresh mechanism

### Data Protection
- **User Scoping**: All queries filtered by playerId from session (prevent cross-user access)
- **Soft Deletes**: UserCard.status = "DELETED" instead of hard delete (audit trail)
- **Encryption**: Sensitive fields (renewal dates) not encrypted (not PII, can be plaintext)
- **HTTPS Only**: All API calls must use HTTPS in production

### Input Validation
- **Renewal Date**: ISO 8601 format, must be today or future
- **Annual Fee**: 0-99999 cents, positive integer
- **Card Name**: 1-100 characters, no special restrictions (user input)
- **masterCardId**: Must reference valid MasterCard (validate against DB)

### Rate Limiting
- **Implementation**: Redis-based rate limiter (existing)
- **Limits**: 100 requests/minute per user to /api/cards/* endpoints
- **Error Response**: 429 Too Many Requests if limit exceeded

### Audit Logging
- **Logged Events**:
  - Card creation (via template or custom)
  - Card deletion
  - Card edits
  - Benefit additions/edits
- **Log Format**: JSON with timestamp, userId, action, resource ID
- **Retention**: 90 days (existing policy)

### WCAG 2.1 Level AA Compliance
- **Modal Accessibility**: DialogTitle, aria-labelledby, aria-describedby, focus trap
- **Keyboard Navigation**: Tab, Shift+Tab, Escape
- **Screen Reader**: Proper semantic HTML, ARIA roles and labels
- **Color Contrast**: 4.5:1 for text, 3:1 for graphics

---

## Performance & Scalability Considerations

### Expected Load
- **Active Users**: 1000-5000 concurrent users
- **Cards per User**: 1-50 (most have 1-10)
- **Catalog Queries**: 10-100 per day (one per AddCardModal open)
- **My-Cards Queries**: 1000-5000 per day (dashboard loads)

### Caching Strategy
- **Catalog (GET /api/cards/catalog)**: Cache in Redis for 1 hour
  - Invalidated manually when seed data changes
  - Cache key: `catalog:page:{skip}:limit:{limit}`
- **User Cards (GET /api/cards/my-cards)**: Cache per user for 5 minutes
  - Invalidated on card add/edit/delete
  - Cache key: `user_cards:{playerId}:{status}`

### Database Optimization
- **Indexes Already Present**:
  - `MasterCard`: @@index([issuer]), @@unique([issuer, cardName])
  - `UserCard`: @@index([playerId, masterCardId]), @@unique([playerId, masterCardId])
  - `UserBenefit`: @@unique([userCardId, name])
- **Query Optimization**:
  - Use `include` or `select` in Prisma to eager-load relations
  - Avoid N+1 queries (fetch all benefits in single query)
  - Pagination for large result sets (limit 100)

### Rate Limiting
- **Per User**: 100 requests/minute to /api/cards/* endpoints
- **Per IP**: 1000 requests/minute (if abusing)
- **Burst**: Allow 10 requests in quick succession, then rate limit

### Connection Pooling
- **Database**: Use Prisma connection pooling (default 10 connections)
- **Redis**: Connection pooling configured in existing middleware

### Monitoring & Alerts
- **Metrics to Track**:
  - API response times (p50, p95, p99)
  - Error rates (4xx, 5xx per endpoint)
  - Catalog cache hit ratio
  - Database query slow logs (>1s)
- **Alerts**:
  - 5% error rate on any endpoint
  - p99 response time > 5s
  - Database connection errors

---

## Testing Strategy

### Unit Tests
- **API Route Handlers**: Jest tests for input validation, business logic
- **Modal Components**: Jest + React Testing Library for state management
- **Utility Functions**: Tests for data transformation, formatting

### Integration Tests
- **API Endpoints**: Playwright + test database (separate DB instance for tests)
  - Test full flow: create card → fetch card → delete card
  - Test error scenarios: duplicate, validation, auth
- **Database**: Verify schema migrations, seed data integrity

### E2E Tests
- **User Flows**: Playwright tests from UI to database
  - Add card from catalog
  - Create custom card
  - Edit card
  - Delete card
  - Verify dashboard refresh
- **Mobile Responsiveness**: Test on 320px, 375px, 768px widths
- **Accessibility**: Test keyboard navigation, screen reader

### Performance Tests
- **Load Testing**: k6 or Artillery to simulate 1000 concurrent users
- **API Response Times**: Monitor p50, p95, p99 response times
- **Database Query Performance**: Slow log monitoring

### Quality Gates
- **Code Coverage**: Minimum 80% for new code
- **Type Safety**: TypeScript strict mode enabled
- **Linting**: ESLint with Airbnb config
- **Accessibility**: axe DevTools audit pass

---

## Implementation Checklist & Success Metrics

### Pre-Implementation
- [ ] Specification reviewed and approved by team
- [ ] Dependencies (Node packages, TypeScript types) verified
- [ ] Development environment setup (local DB, Redis)
- [ ] Test database created and seeded

### Phase 1: Database (Complete by Day 2)
- [ ] Seed script created with 10+ cards
- [ ] Seed script runs without errors
- [ ] MasterCard/MasterBenefit data verified in DB
- [ ] Migration runs cleanly
- [ ] Seed data is production-ready

### Phase 2: API (Complete by Day 4)
- [ ] GET /api/cards/catalog implemented and tested
- [ ] POST /api/cards/add updated with template support
- [ ] GET /api/cards/my-cards working with real cards
- [ ] All endpoints authenticated and authorized
- [ ] Integration tests passing (100%)
- [ ] API documentation updated

### Phase 3: Frontend Bugs (Complete by Day 5)
- [ ] DialogTitle added to all 4 modals
- [ ] Add Card modal state wired correctly
- [ ] Edit/Delete buttons moved to footer
- [ ] Checkboxes sized correctly (w-4 h-4)
- [ ] Manual testing passes
- [ ] No console errors

### Phase 4: Catalog UI (Complete by Day 7)
- [ ] AddCardModal rewritten with tabs
- [ ] Card selection flow working
- [ ] Dashboard fetches real cards
- [ ] Card component displays template benefits
- [ ] E2E tests passing (90%+ success)
- [ ] Mobile responsive

### Phase 5: QA & Deployment (Complete by Day 8)
- [ ] Accessibility audit passing (0 critical violations)
- [ ] Performance testing complete
- [ ] Manual QA test plan signed off
- [ ] Code review approved
- [ ] Deployed to staging
- [ ] Smoke tests pass
- [ ] Deployed to production
- [ ] Monitoring configured

### Success Metrics
- **Functional**: All 5 bugs fixed + catalog system working
- **Performance**: Catalog load <1s, my-cards <500ms
- **Accessibility**: WCAG 2.1 Level AA pass, 0 critical violations
- **Quality**: 80%+ code coverage, 0 console errors
- **User Experience**: Modal appears on click, benefits display correctly, responsive on mobile

---

## Migration & Data Consistency

### Backward Compatibility
- **Existing Custom Cards**: Have masterCardId = null (no migration needed)
- **Existing UserBenefits**: Manually added by users (not affected)
- **No Breaking Changes**: New fields are optional, existing fields unchanged

### Database Migration Path
1. **Step 1**: Create seed script (does NOT modify existing data)
2. **Step 2**: Run Prisma migration (adds new seed data)
3. **Step 3**: Deploy API code (new endpoints ready)
4. **Step 4**: Deploy frontend code (UI changes)
5. **Step 5**: No data backfill needed (catalog is new feature, coexists with custom cards)

### Rollback Plan
- **If seed fails**: Delete seed data, revert migration
- **If API fails**: Revert to previous API code (endpoint still works)
- **If UI fails**: Revert to previous UI code (fallback to custom form)
- **If database corrupt**: Restore from backup (99.9% uptime SLA applies)

---

## Documentation & Developer Handoff

### Code Documentation
- **API Routes**: JSDoc comments with request/response schema examples
- **Components**: Component props documentation with Storybook
- **Utilities**: Function signatures with TypeScript types

### Testing Documentation
- **Test Plan**: Manual QA checklist with steps and expected results
- **Test Database**: Instructions for seeding test data
- **CI/CD**: GitHub Actions workflow file explaining test execution

### Deployment Documentation
- **Staging**: Steps to deploy to staging environment
- **Production**: Pre-flight checks, deployment steps, rollback procedure
- **Monitoring**: How to check logs, metrics, and alerts

---

## Appendix: Card Catalog Data Schema

### 10 Pre-Built Card Templates

```json
[
  {
    "issuer": "American Express",
    "cardName": "American Express Gold Card",
    "defaultAnnualFee": 25000,
    "benefits": [
      { "name": "$120 Dining Credit", "stickerValue": 12000, "resetCadence": "CalendarYear" },
      { "name": "$100 Uber Credit", "stickerValue": 10000, "resetCadence": "CalendarYear" },
      { "name": "4x Points on Restaurants", "stickerValue": 0, "resetCadence": "CalendarYear" }
    ]
  },
  {
    "issuer": "Chase",
    "cardName": "Chase Sapphire Reserve",
    "defaultAnnualFee": 55000,
    "benefits": [
      { "name": "$300 Travel Credit", "stickerValue": 30000, "resetCadence": "CalendarYear" },
      { "name": "$300 Dining Credit", "stickerValue": 30000, "resetCadence": "CalendarYear" },
      { "name": "3x Points on Travel", "stickerValue": 0, "resetCadence": "CalendarYear" }
    ]
  },
  {
    "issuer": "Discover",
    "cardName": "Discover IT",
    "defaultAnnualFee": 0,
    "benefits": [
      { "name": "5% Cashback (rotating categories)", "stickerValue": 15000, "resetCadence": "CalendarYear" },
      { "name": "1% Cashback on all other purchases", "stickerValue": 10000, "resetCadence": "CalendarYear" }
    ]
  }
]
```

---

**END OF SPECIFICATION**

This document is the single source of truth for the 5 critical bug fixes + Card Catalog system implementation. Engineers should reference this specification for all details regarding requirements, API contracts, edge cases, and acceptance criteria.

