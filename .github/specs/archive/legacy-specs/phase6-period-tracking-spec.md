# Phase 6: Period-Based Benefit Usage Tracking - Technical Specification

## Executive Summary & Goals

Phase 6 transforms benefit tracking from a simple binary (used/unused) annual model to a sophisticated period-based system that matches real-world benefit reset cycles. Users can now track claims across monthly, quarterly, semi-annual, and annual benefit periods, with fine-grained control over partial claims, historical views, and period-specific analytics.

### Primary Objectives

- Implement dynamic period-based tracking for benefits with multiple reset cadences
- Enable users to claim benefits multiple times within a single period (partial claims)
- Provide historical tracking and editing capabilities for past periods
- Create intuitive UI for claiming benefits in current or past periods
- Maintain data integrity with unique constraints and proper state management
- Support migration from legacy annual UserBenefit model without data loss

### Success Criteria

- All benefit usage records properly track claimed amounts by period
- Users can claim benefits for current period and historical periods
- Period boundaries calculate correctly for all cadences (monthly, quarterly, semi-annual, annual)
- Duplicate claims for same period are prevented
- Dashboard displays accurate period-based summaries
- Historical usage accessible and editable
- Zero data loss during migration from UserBenefit model

---

## Functional Requirements

### Core Features

1. **Period-Based Tracking**
   - Benefits reset on defined cadences (monthly, quarterly, semi-annual, annual, custom)
   - Each benefit track available amount, claimed amount, and remaining per period
   - Users can claim full or partial amounts within a period
   - Multiple claims in same period are cumulative (partial claims)

2. **User Roles & Permissions**
   - Authenticated users can view/claim only their own cards' benefits
   - Users cannot claim more than available per period
   - Users cannot duplicate-claim same period for same benefit
   - Admin can view all user claims for moderation/support

3. **System Constraints & Limits**
   - Maximum 15 premium cards per user (existing constraint)
   - Maximum ~65 benefits across all cards
   - Historical periods accessible for 7+ years (no archival)
   - Rate limit: 10 claims per minute per user
   - Period start/end dates in UTC only

---

## Implementation Phases

### Phase 6A: Core Data Model & Migration (Week 1-2)
**Objectives:**
- Implement new Prisma schema with MasterBenefit cadence fields and BenefitUsageRecord table
- Create database migration strategy
- Build period calculation utilities
- Migrate legacy UserBenefit data (if applicable)

**Key Deliverables:**
- Updated Prisma schema file
- Database migration scripts
- Period utility functions (getPeriodBoundaries, calculateAmountPerPeriod, etc.)
- Migration verification script

**Scope:** Medium
**Dependencies:** None (independent)

---

### Phase 6B: API Layer & Business Logic (Week 2-3)
**Objectives:**
- Implement all RESTful endpoints for benefit usage
- Build validation and authorization middleware
- Create rate limiting middleware
- Implement error handling and logging

**Key Deliverables:**
- Complete API endpoints (5 routes)
- Request/response validation schemas
- Authorization guards on all endpoints
- Rate limiting configuration

**Scope:** Medium
**Dependencies:** Phase 6A (data model)

---

### Phase 6C: Frontend Components & UI (Week 3-4)
**Objectives:**
- Build MarkBenefitUsedModal with period selection
- Update BenefitCard to show period status
- Create HistoricalUsageTab component
- Enhance Dashboard with period-based views

**Key Deliverables:**
- 4 new React components
- Period selector dropdown logic
- Progress bar visualization
- Filter/sort logic for historical usage

**Scope:** Large
**Dependencies:** Phase 6B (API endpoints)

---

### Phase 6D: Edge Cases & Polish (Week 4-5)
**Objectives:**
- Implement special handling (December UberEats, leap year, timezone edge cases)
- Add confirmation flows for period changes
- Build admin view for usage history
- Comprehensive testing

**Key Deliverables:**
- Special case handlers
- Confirmation modals
- Admin endpoints for support
- Full test suite (unit + integration)

**Scope:** Medium
**Dependencies:** Phase 6A, 6B, 6C

---

### Phase 6E: Documentation & Rollout (Week 5)
**Objectives:**
- Write API documentation
- Create user-facing guides
- Set up monitoring/alerts
- Plan rollout strategy

**Key Deliverables:**
- API documentation (OpenAPI/Swagger)
- User guides with screenshots
- Monitoring dashboards
- Rollout runbook

**Scope:** Small
**Dependencies:** All prior phases

---

## Data Schema / State Management

### Database Schema Changes

#### 1. MasterBenefit Model Updates

Add two new fields to track period-based resets:

```prisma
model MasterBenefit {
  id                    String   @id @default(cuid())
  name                  String
  description           String?
  cardId                String
  card                  Card     @relation(fields: [cardId], references: [id])
  
  // Existing fields...
  annualAmount          Int      // in cents (e.g., 20000 = $200)
  benefitCategory       String
  
  // NEW FIELDS FOR PHASE 6
  resetCadence          ResetCadence @default(ANNUAL)  // MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, CUSTOM
  cadenceAmount         Int?     // optional: specific amount for this period (in cents)
                                 // if null, calculated from annualAmount
  customResetStartDate  DateTime? // for CUSTOM cadence only
  customResetEndDate    DateTime? // for CUSTOM cadence only
  
  // Relationships
  usageRecords          BenefitUsageRecord[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([cardId])
  @@index([resetCadence])
}

enum ResetCadence {
  MONTHLY       // Resets 1st of each month
  QUARTERLY     // Resets 1st of each quarter (01/01, 04/01, 07/01, 10/01)
  SEMI_ANNUAL   // Resets 01/01 and 07/01
  ANNUAL        // Resets on card anniversary date (when added to user account)
  CUSTOM        // User-defined start/end dates
}
```

#### 2. New BenefitUsageRecord Table

```prisma
model BenefitUsageRecord {
  id                    String   @id @default(cuid())
  
  // Foreign Keys
  userId                String   // Authenticated user claiming benefit
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  userCardId            String   // The specific card instance user owns
  userCard              UserCard @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  
  masterBenefitId       String   // The benefit definition
  masterBenefit         MasterBenefit @relation(fields: [masterBenefitId], references: [id], onDelete: Cascade)
  
  // Period Information
  periodStart           DateTime  // Start of benefit period (first day of month, quarter, etc.)
  periodEnd             DateTime  // End of benefit period (last day of period)
  resetCadence          ResetCadence // Denormalized for query efficiency
  
  // Claim Information
  amountAvailable       Int       // Total available for this period (in cents)
  amountClaimed         Int       // Amount claimed by user (in cents)
  claimDate             DateTime  @default(now())  // When user made claim
  
  // Optional Details
  notes                 String?   // Why/where benefit was used (e.g., "UberEats order #12345")
  
  // Audit Fields
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime? // Soft delete support

  @@unique([userCardId, masterBenefitId, periodStart]) // Prevent duplicate claims same period
  @@index([userId, periodStart])     // Query: all claims by user in a period
  @@index([userCardId, masterBenefitId]) // Query: all claims for specific card benefit
  @@index([periodStart, periodEnd])  // Query: all claims in period range
  @@index([userId, claimDate])       // Query: recent claims by user
  @@index([deletedAt])               // Query: active vs soft-deleted records
}
```

#### 3. UserCard Model Updates

Add anniversary date for annual benefit resets:

```prisma
model UserCard {
  id                    String   @id @default(cuid())
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cardId                String
  card                  Card     @relation(fields: [cardId], references: [id])
  
  // Card anniversary for annual benefit resets
  cardAddedDate         DateTime  @default(now())  // Used as "card anniversary"
  
  // NEW: Benefit usage records for this card
  usageRecords          BenefitUsageRecord[]
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([userId, cardId])
  @@index([userId])
  @@index([cardAddedDate])
}
```

#### 4. User Model Update

Add relationship to usage records:

```prisma
model User {
  // ... existing fields ...
  
  benefitUsageRecords   BenefitUsageRecord[]
}
```

### Migration Strategy

#### From Legacy UserBenefit Model (if exists)

**Goal:** Convert existing binary used/unused tracking to period-based tracking without data loss.

**Strategy:**
1. Identify all existing UserBenefit records
2. For each UserBenefit where used=true:
   - Calculate the most likely period it was used in (assume claimed in current/recent period)
   - Create BenefitUsageRecord with full annual amount as claimed amount
   - Set periodStart/periodEnd based on benefit's reset cadence
3. Archive or keep old UserBenefit table for reference
4. Verify data integrity before production rollout

**Migration Script Pseudo-Code:**

```typescript
async function migrateUserBenefitsToUsageRecords() {
  // 1. Get all old UserBenefit records with used=true
  const legacyBenefits = await prisma.userBenefit.findMany({
    where: { used: true },
    include: { userCard: true, masterBenefit: true }
  });

  // 2. For each, create corresponding BenefitUsageRecord
  for (const legacy of legacyBenefits) {
    const { periodStart, periodEnd } = getPeriodBoundaries(
      legacy.masterBenefit.resetCadence,
      legacy.userCard.cardAddedDate,
      new Date()
    );

    await prisma.benefitUsageRecord.create({
      data: {
        userId: legacy.userCard.userId,
        userCardId: legacy.userCardId,
        masterBenefitId: legacy.masterBenefitId,
        periodStart,
        periodEnd,
        resetCadence: legacy.masterBenefit.resetCadence,
        amountAvailable: legacy.masterBenefit.annualAmount,
        amountClaimed: legacy.masterBenefit.annualAmount,
        notes: 'Migrated from legacy UserBenefit'
      }
    });
  }

  // 3. Optionally archive or drop old table
  // await prisma.$executeRaw`ALTER TABLE user_benefit RENAME TO user_benefit_legacy`;
}
```

**Rollback Plan:**
- Keep legacy UserBenefit table intact for 30 days
- If critical issues found, can restore from backup
- Document both tables in migration runbook

### Schema Diagram

```
User
├── UserCard (user's instance of a card)
│   ├── Card (card definition: Amex Platinum, Chase Sapphire, etc.)
│   │   └── MasterBenefit (benefit definition: UberEats $200/year, etc.)
│   │       └── BenefitUsageRecord* (individual claim: "$15 claimed April 1-30")
│   └── BenefitUsageRecord* (claims for all benefits on this card)
└── BenefitUsageRecord* (all claims by this user across all cards)

* Many-to-many via foreign keys
```

---

## User Flows & Workflows

### Flow 1: Mark Benefit as Used (Current Period)

**Happy Path:**
1. User views Dashboard or CardDetail page
2. Sees BenefitCard for "Amex Platinum - UberEats $200/year"
3. Clicks "Mark Used" or "Claim $15/$15" button
4. MarkBenefitUsedModal opens with:
   - Benefit name and description
   - Card name
   - **Period selector pre-filled with "April 2026 (Monthly)"**
   - Current period info: "April 2026 (Monthly) - $15 available"
   - "Claimed so far this period: $0"
   - Amount input field (default: full available amount $15)
   - Notes field (optional: "Uber Eats $XX.XX on")
   - "Claim" button
5. User adjusts amount to $15 (or leaves default)
6. User enters notes: "UberEats March 15 order"
7. Clicks "Claim" button
8. **POST /api/benefits/usage** sent with:
   ```json
   {
     "masterBenefitId": "ben_123",
     "userCardId": "uc_456",
     "amountClaimed": 1500,
     "notes": "UberEats March 15 order"
   }
   ```
9. API validates:
   - User owns userCardId ✓
   - masterBenefitId exists on card ✓
   - amountClaimed ($15) ≤ amountAvailable ($15) ✓
   - No duplicate claim for this period ✓
10. API creates BenefitUsageRecord and returns success
11. Modal closes, Dashboard updates:
    - Progress bar shows "Claimed $15/$15" with checkmark
    - Button changes to "Fully Claimed ✓"
12. Success toast: "UberEats $15 claimed for April 2026"

**Alternative: Partial Claim**
- User enters $7 instead of $15
- Clicks "Claim"
- Progress bar shows "Claimed $7/$15"
- Button still shows "Claim $8 more"
- Later, user can click again and claim remaining $8
- Cumulative result: two records, both April period, totaling $15

**Error Path: Over-Claiming**
1. User enters $20 (exceeds $15 available)
2. Clicks "Claim"
3. API rejects: amountClaimed > amountAvailable
4. Modal shows error: "Cannot claim more than $15 available"
5. Amount field highlights in red

**Error Path: No Authentication**
1. User not logged in
2. Clicks "Claim"
3. Redirected to login page

---

### Flow 2: Claim for Past Period

**Scenario:** User forgot to claim UberEats benefit in March, now it's April 15.

1. User views HistoricalUsageTab on Amex Platinum card
2. Sees "March 2026 (Monthly) - $15 available, $0 claimed"
3. Clicks "Claim" button for March row
4. MarkBenefitUsedModal opens with **Period selector showing "March 2026 (Monthly)"**
5. Shows: "March 2026 (Monthly) - $15 available"
6. User enters amount $15 and notes
7. Clicks "Claim"
8. **POST /api/benefits/usage** with forPeriod parameter:
   ```json
   {
     "masterBenefitId": "ben_123",
     "userCardId": "uc_456",
     "amountClaimed": 1500,
     "notes": "Retroactive March claim",
     "forPeriod": "2026-03-01"
   }
   ```
9. API validates period is in past (2026-03-01 < now) ✓
10. API creates record with periodStart=2026-03-01, periodEnd=2026-03-31
11. HistoricalUsageTab updates: March now shows "Claimed $15/$15"

**Constraint:** 
- Can claim periods up to 7 years in past
- Cannot claim future periods

---

### Flow 3: View Historical Usage

**Scenario:** User wants to see all UberEats claims across last 6 months.

1. User clicks "History" tab on Amex Platinum card
2. Tab shows:
   - **Filter buttons:** "This Month" | "Last 3 Mo" | "Last 6 Mo" | "All Time"
   - **Table columns:** Period | Benefit | Amount Claimed | Notes | Actions
3. Default shows "All Time" with all periods in reverse chronological order
4. User clicks "Last 6 Mo"
5. Table filters to only show April-Sept 2026:
   ```
   | Period       | Benefit      | Amount Claimed | Notes                    |
   |--------------|--------------|----------------|--------------------------|
   | Sept 2026    | UberEats     | $15/$15        | Sept UberEats orders     |
   | Aug 2026     | UberEats     | $15/$15        | Aug UberEats orders      |
   | July 2026    | UberEats     | $7/$15         | Partial claim            |
   | June 2026    | UberEats     | -              | Not claimed              |
   | May 2026     | UberEats     | $15/$15        | May UberEats orders      |
   | April 2026   | UberEats     | $15/$15        | UberEats March 15 order  |
   ```
6. User clicks on "July 2026" row
7. Expand or modal shows:
   - Can edit amountClaimed or notes
   - Can delete claim
   - Shows claimDate (when it was recorded in system)

---

### Flow 4: Dashboard Overview

**Scenario:** User opens app on April 15, 2026.

1. Dashboard loads with cards user owns
2. For each card, shows benefits applicable to current period:
   - **Amex Platinum** (Annual, anniversary May 1)
     - UberEats: $15 claimed / $15 available (April = $15 allocation)
     - Airline Fee: $0 / $300 available
     - Saks Off 5th: $0 / $50 available
   - **Chase Sapphire** (Annual, anniversary Sept 1)
     - Travel Credit: $0 / $300 available
     - Lyft: $0 / $15 available
3. Summary stats shown:
   - "8 benefits claimed this period, $2,450 total value"
   - "7 benefits remaining to claim, $1,050 available"
4. Each benefit card shows progress bar:
   - Blue fill for claimed amount
   - Gray for remaining
   - Label: "Claimed $15/$15 ✓" or "Claim $15/$300"
5. Sort options: by date added, by amount claimed, by category

---

### Flow 5: Period Selection Logic (UX)

**Period Selector Dropdown:**

When user clicks period selector in modal, shows:

```
Current Period
├─ April 2026 (Monthly) [SELECTED]

Recent Periods
├─ March 2026 (Monthly)
├─ February 2026 (Monthly)
├─ January 2026 (Monthly)

Previous Year
├─ 2025 (view all months)
├─ 2024 (view all months)

Custom Date Range (optional)
├─ Pick date...
```

**UX Rules:**
- Pre-selects current period for benefit's cadence
- Highlights if period already has a claim for this benefit
- Disables future periods
- Shows period end date (e.g., "April 30, 2026")

---

## API Routes & Contracts

### Endpoint 1: POST /api/benefits/usage

**Purpose:** Record a new benefit claim

**Authentication:** Required (JWT)

**Request Body:**
```json
{
  "masterBenefitId": "ben_uberEats_amex",
  "userCardId": "uc_12345",
  "amountClaimed": 1500,
  "notes": "UberEats order #ABC123 on 2026-04-15",
  "forPeriod": "2026-04-01"
}
```

**Request Schema:**
```typescript
interface CreateBenefitUsageRequest {
  masterBenefitId: string;        // Required
  userCardId: string;             // Required (must belong to authenticated user)
  amountClaimed: number;          // Required, in cents, > 0
  notes?: string;                 // Optional, max 500 chars
  forPeriod?: string;             // Optional ISO date (defaults to current period)
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "record": {
    "id": "bur_xyz789",
    "userId": "user_123",
    "userCardId": "uc_12345",
    "masterBenefitId": "ben_uberEats_amex",
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30",
    "resetCadence": "MONTHLY",
    "amountAvailable": 1500,
    "amountClaimed": 1500,
    "claimDate": "2026-04-15T14:30:00Z",
    "notes": "UberEats order #ABC123 on 2026-04-15",
    "createdAt": "2026-04-15T14:30:00Z",
    "updatedAt": "2026-04-15T14:30:00Z"
  },
  "remaining": 0,
  "message": "Benefit claimed successfully"
}
```

**Error Responses:**

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "amountClaimed cannot exceed amountAvailable",
  "details": {
    "amountClaimed": 2000,
    "amountAvailable": 1500
  },
  "statusCode": 400
}
```

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "User does not own this card",
  "statusCode": 403
}
```

```json
{
  "success": false,
  "error": "DUPLICATE_CLAIM",
  "message": "Benefit already claimed for this period",
  "details": {
    "existingRecordId": "bur_existing",
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30"
  },
  "statusCode": 409
}
```

```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Benefit or card not found",
  "statusCode": 404
}
```

**Validation Rules:**
- amountClaimed > 0 and ≤ amountAvailable
- masterBenefitId exists
- userCardId exists and belongs to authenticated user
- forPeriod (if provided) is valid date, not in future
- No duplicate (userCardId, masterBenefitId, periodStart) combination

---

### Endpoint 2: GET /api/benefits/usage

**Purpose:** List all benefit usage records for authenticated user (paginated)

**Authentication:** Required (JWT)

**Query Parameters:**
```
?page=1&limit=20&filter=all&sortBy=claimDate&sortOrder=desc
```

**Query Schema:**
```typescript
interface ListBenefitUsageQuery {
  page?: number;           // Default: 1 (1-indexed)
  limit?: number;          // Default: 20, max: 100
  filter?: "all" | "active" | "deleted";  // Default: "active"
  sortBy?: "claimDate" | "periodStart" | "amountClaimed";  // Default: claimDate
  sortOrder?: "asc" | "desc";  // Default: desc
  userCardId?: string;     // Filter by specific card (optional)
  startDate?: string;      // Filter by period start (ISO date)
  endDate?: string;        // Filter by period end (ISO date)
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "bur_xyz789",
      "userId": "user_123",
      "userCardId": "uc_12345",
      "masterBenefitId": "ben_uberEats_amex",
      "masterBenefitName": "UberEats $200/year",
      "cardName": "Amex Platinum",
      "periodStart": "2026-04-01",
      "periodEnd": "2026-04-30",
      "resetCadence": "MONTHLY",
      "amountAvailable": 1500,
      "amountClaimed": 1500,
      "claimDate": "2026-04-15T14:30:00Z",
      "notes": "UberEats order #ABC123",
      "createdAt": "2026-04-15T14:30:00Z",
      "updatedAt": "2026-04-15T14:30:00Z"
    },
    {
      "id": "bur_abc456",
      "userId": "user_123",
      "userCardId": "uc_12345",
      "masterBenefitId": "ben_airlineFee_amex",
      "masterBenefitName": "Airline Fee Credit $300/year",
      "cardName": "Amex Platinum",
      "periodStart": "2026-04-01",
      "periodEnd": "2026-04-30",
      "resetCadence": "ANNUAL",
      "amountAvailable": 30000,
      "amountClaimed": 0,
      "claimDate": null,
      "notes": null,
      "createdAt": "2026-04-15T14:30:00Z",
      "updatedAt": "2026-04-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Authentication required",
  "statusCode": 401
}
```

---

### Endpoint 3: GET /api/benefits/[id]/status

**Purpose:** Get current period status for a specific benefit

**Authentication:** Required (JWT)

**URL Parameters:**
```
/api/benefits/ben_uberEats_amex/status?userCardId=uc_12345
```

**Query Parameters:**
```typescript
interface BenefitStatusQuery {
  userCardId: string;  // Required: which card to check
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "benefit": {
    "id": "ben_uberEats_amex",
    "name": "UberEats $200/year",
    "description": "Up to $15/month on UberEats",
    "annualAmount": 20000,
    "card": {
      "id": "card_amex",
      "name": "Amex Platinum"
    }
  },
  "currentPeriod": {
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30",
    "resetCadence": "MONTHLY",
    "amountAvailable": 1500,
    "amountClaimed": 1500,
    "remaining": 0,
    "percentageClaimed": 100,
    "claimDate": "2026-04-15T14:30:00Z",
    "status": "FULLY_CLAIMED"
  },
  "upcomingPeriod": {
    "periodStart": "2026-05-01",
    "periodEnd": "2026-05-31",
    "resetCadence": "MONTHLY",
    "amountAvailable": 1500,
    "amountClaimed": 0,
    "remaining": 1500,
    "percentageClaimed": 0,
    "status": "NOT_STARTED"
  },
  "recentClaims": [
    {
      "periodStart": "2026-03-01",
      "periodEnd": "2026-03-31",
      "amountClaimed": 1500,
      "claimDate": "2026-03-20T10:15:00Z",
      "notes": "March UberEats orders"
    }
  ]
}
```

**Error Responses:**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Benefit or card not found",
  "statusCode": 404
}
```

---

### Endpoint 4: PATCH /api/benefits/usage/[recordId]

**Purpose:** Update an existing benefit claim (edit amount or notes)

**Authentication:** Required (JWT)

**URL Parameters:**
```
/api/benefits/usage/bur_xyz789
```

**Request Body:**
```json
{
  "amountClaimed": 1000,
  "notes": "Updated: partial claim"
}
```

**Request Schema:**
```typescript
interface UpdateBenefitUsageRequest {
  amountClaimed?: number;   // Optional, must be > 0 and ≤ amountAvailable
  notes?: string;           // Optional, max 500 chars
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "record": {
    "id": "bur_xyz789",
    "userId": "user_123",
    "userCardId": "uc_12345",
    "masterBenefitId": "ben_uberEats_amex",
    "periodStart": "2026-04-01",
    "periodEnd": "2026-04-30",
    "resetCadence": "MONTHLY",
    "amountAvailable": 1500,
    "amountClaimed": 1000,
    "claimDate": "2026-04-15T14:30:00Z",
    "notes": "Updated: partial claim",
    "createdAt": "2026-04-15T14:30:00Z",
    "updatedAt": "2026-04-15T15:00:00Z"
  },
  "remaining": 500
}
```

**Error Responses:**
```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Cannot modify records from other users",
  "statusCode": 403
}
```

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "amountClaimed cannot exceed amountAvailable",
  "statusCode": 400
}
```

---

### Endpoint 5: DELETE /api/benefits/usage/[recordId]

**Purpose:** Delete/cancel a benefit claim

**Authentication:** Required (JWT)

**URL Parameters:**
```
/api/benefits/usage/bur_xyz789?hardDelete=false
```

**Query Parameters:**
```typescript
interface DeleteBenefitUsageQuery {
  hardDelete?: boolean;  // Default: false (soft delete)
}
```

**Strategy:** Use soft delete by default (set deletedAt timestamp)
- Soft delete: User can "undo" deletions within 30 days
- Hard delete: Permanent removal (admin only, requires confirmation)

**Response (200 OK - Soft Delete):**
```json
{
  "success": true,
  "message": "Benefit claim deleted. Can be recovered within 30 days.",
  "recordId": "bur_xyz789",
  "deletedAt": "2026-04-15T15:05:00Z"
}
```

**Response (200 OK - Hard Delete - Admin Only):**
```json
{
  "success": true,
  "message": "Benefit claim permanently deleted",
  "recordId": "bur_xyz789"
}
```

**Error Responses:**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Record not found or already deleted",
  "statusCode": 404
}
```

```json
{
  "success": false,
  "error": "UNAUTHORIZED",
  "message": "Cannot delete records from other users",
  "statusCode": 403
}
```

---

## UI Components & Dashboard

### Component 1: MarkBenefitUsedModal

**Purpose:** Primary interface for claiming benefits

**Props:**
```typescript
interface MarkBenefitUsedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (record: BenefitUsageRecord) => void;
  benefit: MasterBenefit & { card: Card };
  userCard: UserCard;
  forPeriod?: Date;  // Optional: pre-select specific period
}
```

**Component Structure:**

```
┌─────────────────────────────────────────────┐
│ Mark Benefit as Used                    [×] │
├─────────────────────────────────────────────┤
│                                             │
│ Amex Platinum - UberEats $200/year         │
│                                             │
│ ┌───────────────────────────────────────┐  │
│ │ Period: [April 2026 (Monthly) ▼]      │  │
│ │         [Show 12 months + custom]      │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Period Details:                             │
│ • Start: April 1, 2026                      │
│ • End: April 30, 2026                       │
│ • Available: $15                            │
│ • Claimed so far: $0                        │
│                                             │
│ ┌───────────────────────────────────────┐  │
│ │ Amount to Claim: [$15.00     ]        │  │
│ │ (Max: $15.00)                         │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ ┌───────────────────────────────────────┐  │
│ │ Notes (optional):                     │  │
│ │ [UberEats order #ABC123           ] │  │
│ │ (character count: 28/500)             │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Progress Preview:                           │
│ ████████████░░ Claimed $15/$15 (100%)      │
│                                             │
│ [ Cancel ]  [ Claim Benefit ]               │
└─────────────────────────────────────────────┘
```

**Features:**
- Period dropdown with:
  - Current period pre-selected
  - Recent periods (last 12 months)
  - Visual indicator if period already claimed
  - "Show All" to access older periods
- Real-time period details update when period changes
- Amount input with:
  - Max validation (cannot exceed available)
  - Currency formatting ($X.XX)
  - Spinner buttons to increment/decrement
- Notes field with character counter
- Progress bar preview shows result after claim
- Loading state during submission
- Success/error toast messages

**State Management:**
```typescript
const [selectedPeriod, setSelectedPeriod] = useState<Date>(
  calculateCurrentPeriod(benefit.resetCadence, userCard.cardAddedDate)
);
const [amountClaimed, setAmountClaimed] = useState<number>(
  periodAvailable // pre-fill with max available
);
const [notes, setNotes] = useState<string>('');
const [isLoading, setIsLoading] = useState<boolean>(false);
const [error, setError] = useState<string | null>(null);
```

---

### Component 2: BenefitCard Updates

**Purpose:** Show benefit status with progress bar

**Updated Structure:**

```
┌──────────────────────────────────────────────┐
│ UberEats $200/year                    [info] │
├──────────────────────────────────────────────┤
│ Description: Up to $15/month digital orders  │
│ Card: Amex Platinum                          │
│ Period: April 2026 (Monthly) | Resets: 5/1  │
│                                              │
│ Progress:                                    │
│ ████████████░░░░░░ $15 / $15                │
│ Status: Fully Claimed ✓                      │
│                                              │
│ [ View History ]  [ Claim More ]             │
└──────────────────────────────────────────────┘
```

**Props:**
```typescript
interface BenefitCardProps {
  benefit: MasterBenefit;
  userCard: UserCard;
  status: {
    amountAvailable: number;
    amountClaimed: number;
    periodStart: Date;
    periodEnd: Date;
    resetCadence: ResetCadence;
  };
  onClaimClick: () => void;
  onHistoryClick: () => void;
}
```

**States:**
- **NOT_STARTED**: Gray progress bar, "Claim $X/$X" button
- **PARTIALLY_CLAIMED**: Blue progress bar, "Claim $Y more" button
- **FULLY_CLAIMED**: Full blue progress bar, "✓ Fully Claimed" with checkmark
- **EXPIRED**: Gray strikethrough, "Period expired" label

**Responsive Design:**
- Desktop: Horizontal layout with side-by-side buttons
- Tablet: Stacked layout
- Mobile: Compact layout, buttons stack vertically

---

### Component 3: HistoricalUsageTab

**Purpose:** View and manage past benefit claims

**Structure:**

```
┌────────────────────────────────────────────────────┐
│ Historical Usage                                    │
├────────────────────────────────────────────────────┤
│ Filter: [This Month] [Last 3 Mo] [Last 6 Mo] [All] │
│ Sort: [Newest ▼]                                    │
├────────────────────────────────────────────────────┤
│ Period           Claimed    Available  Notes        │
├────────────────────────────────────────────────────┤
│ April 2026 ✓     $15        $15        March order │
│ March 2026 ✓     $15        $15        All used    │
│ Feb 2026   ⚠     $8         $15        Partial     │
│ Jan 2026   -     -          $15        Not claimed │
│ Dec 2025 ✓      $15        $15        Holiday     │
└────────────────────────────────────────────────────┘
```

**Features:**
- Filter buttons:
  - "This Month": Current calendar month
  - "Last 3 Mo": Last 3 months
  - "Last 6 Mo": Last 6 months
  - "All": All periods with data
- Sort options: Newest, Oldest, Amount
- Table columns:
  - Period (with status indicator ✓/⚠/-)
  - Claimed amount
  - Available amount
  - Notes (truncated, clickable to expand)
  - Actions (Edit, Delete buttons on hover)
- Row expansion on click to show full details:
  - Full notes
  - Claim date
  - Edit/Delete buttons
  - Undo if recently deleted

**Props:**
```typescript
interface HistoricalUsageTabProps {
  userCard: UserCard;
  benefit: MasterBenefit;
  records: BenefitUsageRecord[];
  isLoading: boolean;
  onEdit: (recordId: string) => void;
  onDelete: (recordId: string) => void;
}
```

---

### Component 4: BenefitStatusCard (Dashboard Widget)

**Purpose:** Summary of benefit status for dashboard

**Structure:**

```
┌─────────────────────────────┐
│ UberEats Credit             │
│ Amex Platinum               │
├─────────────────────────────┤
│ April 2026                  │
│ $15 / $15 Claimed           │
│ ███████████████░ 100%       │
│                             │
│ Next Reset: May 1, 2026     │
│ Days Until Reset: 16        │
├─────────────────────────────┤
│ [Claim] [History]           │
└─────────────────────────────┘
```

**Props:**
```typescript
interface BenefitStatusCardProps {
  benefit: MasterBenefit;
  userCard: UserCard;
  status: BenefitStatus;
  onClaimClick: () => void;
  onHistoryClick: () => void;
}

interface BenefitStatus {
  amountAvailable: number;
  amountClaimed: number;
  percentageClaimed: number;
  periodStart: Date;
  periodEnd: Date;
  daysUntilReset: number;
  nextResetDate: Date;
  lastClaimDate?: Date;
}
```

---

### Dashboard Enhancements

**Updated Dashboard Layout:**

```
┌──────────────────────────────────────────────────────┐
│ Benefits Dashboard                                    │
├──────────────────────────────────────────────────────┤
│                                                       │
│ Summary Stats:                                       │
│ ┌────────────┬─────────────┬─────────────┐           │
│ │ Claimed    │ Remaining   │ Cards       │           │
│ │ $2,450     │ $1,050      │ 4/4         │           │
│ └────────────┴─────────────┴─────────────┘           │
│                                                       │
│ Filter by Card: [All Cards ▼] Filter: [All ▼]      │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ AMEX Platinum (Annual - Reset May 1)            │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ┌─────────────────────────┐                     │  │
│ │ │ UberEats $15/$15    ✓   │                     │  │
│ │ │ Airline Fee $0/$300     │                     │  │
│ │ │ Saks $0/$50             │                     │  │
│ │ └─────────────────────────┘                     │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Chase Sapphire (Annual - Reset Sept 1)          │  │
│ ├─────────────────────────────────────────────────┤  │
│ │ ┌─────────────────────────┐                     │  │
│ │ │ Travel $50/$300         │                     │  │
│ │ │ Lyft $0/$15             │                     │  │
│ │ └─────────────────────────┘                     │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ View: [Cards] [Benefits] [Timeline]                 │
└──────────────────────────────────────────────────────┘
```

**Key Features:**
- Summary stats at top showing overall progress
- Cards grouped by reset period
- Benefits within each card sorted by claimed status (claimed first)
- View toggle between Cards view and Benefits view
- Timeline view shows benefits chronologically when they reset

---

## Period Reset Logic

### Function: getPeriodBoundaries

**Purpose:** Calculate start and end dates for a benefit period

**Signature:**
```typescript
function getPeriodBoundaries(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  referenceDate: Date = today
): { start: Date; end: Date }
```

**Implementation Examples:**

```typescript
export function getPeriodBoundaries(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  const ref = dateUTC(referenceDate);  // Ensure UTC
  
  switch (resetCadence) {
    case 'MONTHLY': {
      // First day of current month to last day
      const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'QUARTERLY': {
      // Quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
      const quarter = Math.floor(ref.getUTCMonth() / 3);
      const start = new Date(Date.UTC(ref.getUTCFullYear(), quarter * 3, 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), (quarter + 1) * 3, 0));
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'SEMI_ANNUAL': {
      // H1: Jan-Jun, H2: Jul-Dec
      const isH1 = ref.getUTCMonth() < 6;
      const start = new Date(Date.UTC(ref.getUTCFullYear(), isH1 ? 0 : 6, 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), isH1 ? 6 : 12, 0));
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'ANNUAL': {
      // Card anniversary date (month/day of card added date)
      const cardMonth = cardAddedDate.getUTCMonth();
      const cardDay = cardAddedDate.getUTCDate();
      const refYear = ref.getUTCFullYear();
      
      // Anniversary is month/day of card added date
      const anniversary = new Date(Date.UTC(refYear, cardMonth, cardDay));
      
      // If reference date is before anniversary, use previous year's anniversary
      let start, end;
      if (ref < anniversary) {
        start = new Date(Date.UTC(refYear - 1, cardMonth, cardDay));
        end = new Date(Date.UTC(refYear, cardMonth, cardDay - 1));
      } else {
        start = new Date(Date.UTC(refYear, cardMonth, cardDay));
        end = new Date(Date.UTC(refYear + 1, cardMonth, cardDay - 1));
      }
      
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'CUSTOM': {
      // Handled separately with stored customResetStartDate/customResetEndDate
      throw new Error('CUSTOM cadence not supported in this function');
    }
  }
}
```

**Edge Cases:**

1. **Leap Year (Feb 29):**
   - Annual reset on Feb 29: anniversary occurs on Feb 28 in non-leap years
   ```typescript
   // If card anniversary is Feb 29 and reference year is not leap year
   const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
   const adjustedDay = cardDay === 29 && !isLeapYear(refYear) ? 28 : cardDay;
   ```

2. **December Special Case:**
   - Some benefits (like UberEats) grant extra $5 in December
   - NOT handled in getPeriodBoundaries, but checked separately:
   ```typescript
   const isDecember = periodStart.getUTCMonth() === 11;
   const amountThisPeriod = isDecember 
     ? calculateAmountPerPeriod(annualAmount, cadence) + 500  // extra $5
     : calculateAmountPerPeriod(annualAmount, cadence);
   ```

3. **Monthly Period on 31st:**
   - Monthly: Always 1st to last day of month (works correctly)
   - Quarterly: Always 1st to last day of quarter (works correctly)

---

### Function: calculateAmountPerPeriod

**Purpose:** Convert annual amount to period-specific amount

**Signature:**
```typescript
function calculateAmountPerPeriod(
  annualAmount: number,
  resetCadence: ResetCadence
): number
```

**Implementation:**

```typescript
export function calculateAmountPerPeriod(
  annualAmount: number,
  resetCadence: ResetCadence
): number {
  switch (resetCadence) {
    case 'MONTHLY':
      return Math.round(annualAmount / 12);
    case 'QUARTERLY':
      return Math.round(annualAmount / 4);
    case 'SEMI_ANNUAL':
      return Math.round(annualAmount / 2);
    case 'ANNUAL':
      return annualAmount;
    case 'CUSTOM':
      // Custom cadence amount handled separately
      throw new Error('Use cadenceAmount field for CUSTOM cadence');
  }
}
```

**Examples:**
- Annual $200 / 12 months = $16 (16.67 rounds to 1667 cents = $16.67, but store as cents: 1667)
- Annual $300 / 4 quarters = $75 (7500 cents)
- Annual $300 / 2 half-years = $150 (15000 cents)

**Note:** Store all amounts in cents, use banker's rounding for consistency.

---

### Function: getAvailablePeriods

**Purpose:** List all periods user can claim for (current + past)

**Signature:**
```typescript
function getAvailablePeriods(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  historyYears: number = 7
): Array<{ start: Date; end: Date; label: string }>
```

**Implementation:**

```typescript
export function getAvailablePeriods(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  historyYears: number = 7
): Array<{ start: Date; end: Date; label: string }> {
  const periods = [];
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear() - historyYears, now.getMonth(), now.getDate());
  
  // For monthly: iterate through months
  if (resetCadence === 'MONTHLY') {
    let current = new Date(cutoffDate);
    while (current <= now) {
      const { start, end } = getPeriodBoundaries(resetCadence, cardAddedDate, current);
      periods.push({
        start,
        end,
        label: start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      });
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  // Similar logic for QUARTERLY, SEMI_ANNUAL, ANNUAL...
  
  return periods.reverse();  // Newest first
}
```

---

### Function: canClaimPeriod

**Purpose:** Validate if user can claim a benefit for a specific period

**Signature:**
```typescript
function canClaimPeriod(
  masterBenefitId: string,
  userCardId: string,
  periodStart: Date,
  existingRecords: BenefitUsageRecord[]
): { canClaim: boolean; reason?: string }
```

**Implementation:**

```typescript
export function canClaimPeriod(
  masterBenefitId: string,
  userCardId: string,
  periodStart: Date,
  existingRecords: BenefitUsageRecord[]
): { canClaim: boolean; reason?: string } {
  // Check for duplicate claim in same period
  const duplicate = existingRecords.find(
    r => r.masterBenefitId === masterBenefitId &&
         r.userCardId === userCardId &&
         isSamePeriod(r.periodStart, periodStart)
  );
  
  if (duplicate) {
    return {
      canClaim: false,
      reason: `Already claimed for this period on ${duplicate.claimDate.toLocaleDateString()}`
    };
  }
  
  // Check if period is in the future
  const now = new Date();
  if (periodStart > now) {
    return {
      canClaim: false,
      reason: 'Cannot claim for future periods'
    };
  }
  
  // Check if period is too old (> 7 years)
  const sevenYearsAgo = new Date(now.getFullYear() - 7, now.getMonth(), now.getDate());
  if (periodStart < sevenYearsAgo) {
    return {
      canClaim: false,
      reason: 'Period too old (maximum 7 years of history)'
    };
  }
  
  return { canClaim: true };
}

function isSamePeriod(date1: Date, date2: Date): boolean {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth() === date2.getUTCMonth() &&
         date1.getUTCDate() === date2.getUTCDate();
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: Double-Claiming Same Period

**Scenario:** User tries to claim UberEats twice in April 2026

**Prevention:**
- Unique constraint: `@@unique([userCardId, masterBenefitId, periodStart])`
- API validation in canClaimPeriod function
- UI shows "Already claimed" warning

**Error Response:**
```json
{
  "success": false,
  "error": "DUPLICATE_CLAIM",
  "message": "UberEats already claimed for April 2026",
  "statusCode": 409
}
```

**Frontend UX:**
- Period dropdown shows checkmark for already-claimed periods
- Disabled state or "View Existing Claim" button instead of "Claim"

---

### Edge Case 2: Partial Claims Across Multiple Records

**Scenario:** User claims $7 of $15 UberEats in April, then claims $8 more later

**Handling:**
- First claim creates record: amountClaimed=700
- Second claim creates separate record: amountClaimed=800
- Both in same period (April 2026)
- **Problem:** Unique constraint prevents duplicate!

**Solution:** Modify unique constraint to allow multiple records per period
```prisma
// Remove the strict unique constraint
// @@unique([userCardId, masterBenefitId, periodStart])

// Add index for querying efficiently
@@index([userCardId, masterBenefitId, periodStart])
```

**Alternative: Single Record with Updates**
- Create one record per period
- Use PATCH to update amountClaimed
- Example:
  - POST: create record with amountClaimed=$7
  - PATCH: update same record to amountClaimed=$15

**Chosen Approach:** Allow multiple records per period, calculate total claimed by summing.

---

### Edge Case 3: Leap Year (Feb 29)

**Scenario:** Card anniversary on Feb 29, querying Feb 2025 (non-leap year)

**Handling:**
```typescript
const cardAddedDate = new Date('2024-02-29');  // Leap year
const referenceDate = new Date('2025-02-15');  // Non-leap year

const { start, end } = getPeriodBoundaries('ANNUAL', cardAddedDate, referenceDate);
// start should be Feb 28, 2025 (adjusted for non-leap year)
// end should be Feb 27, 2026

const adjustedDay = cardDay === 29 && !isLeapYear(refYear) 
  ? 28 
  : cardDay;
```

---

### Edge Case 4: December UberEats Bonus ($5 extra)

**Scenario:** Amex Platinum UberEats gets $20 in December instead of $15

**Handling:**
1. Store in database: annualAmount = 200 (200 * 12 = ~16.67 average)
2. Special case logic in calculateAmountPerPeriod:
```typescript
function getAmountForPeriod(
  benefit: MasterBenefit,
  periodStart: Date
): number {
  let amount = calculateAmountPerPeriod(benefit.annualAmount, benefit.resetCadence);
  
  // December bonus for specific benefits
  if (benefit.name.includes('UberEats') && periodStart.getUTCMonth() === 11) {
    amount += 500;  // Extra $5 in December
  }
  
  return amount;
}
```

3. UI displays: "December: $20 available" (vs other months: $15)

---

### Edge Case 5: Card Cancelled Mid-Period

**Scenario:** User cancels Amex Platinum card on April 15 (mid-month)

**Handling:**
- Existing claims in current period: Keep as-is
- Future periods: No longer generate available amounts
- UserCard model: Add `cancelledDate` field
- Query filters out cancelled cards from dashboard

```typescript
// In API: only show benefits for active cards
const activeUserCards = userCards.filter(uc => !uc.cancelledDate);
```

**Display:**
- Dashboard: Removed from current view
- Historical tab: Still accessible (shows all past periods)
- Archive view: Option to view archived cards and their history

---

### Edge Case 6: User Cancels Card, Then Re-adds

**Scenario:** User adds Amex Platinum (anniversary May 1, 2026), cancels June 15, re-adds July 1

**Handling:**
- First instance: UserCard record (ID: uc_1, cardAddedDate: 2026-05-01)
- Cancellation: Set cancelledDate: 2026-06-15
- Re-add: New UserCard record (ID: uc_2, cardAddedDate: 2026-07-01)
- Historical claims stay linked to uc_1
- New claims linked to uc_2
- Dashboard shows only uc_2 (active)

```typescript
const { start: start1, end: end1 } = getPeriodBoundaries('ANNUAL', new Date('2026-05-01'));
// May 1, 2026 - April 30, 2027

const { start: start2, end: end2 } = getPeriodBoundaries('ANNUAL', new Date('2026-07-01'));
// July 1, 2026 - June 30, 2027
```

---

### Edge Case 7: Timezone Edge Cases

**Scenario:** User in New York (UTC-4), claims benefit at 11 PM local time on April 30

**Handling:**
- **Store all dates in UTC** (never local time)
- Period boundaries always calculated in UTC
- Display converted to user's local timezone

```typescript
// User claims at 2026-05-01 03:00 UTC (11 PM EDT on April 30)
// But reference date for period calculation is 2026-05-01
// So period is May 1-31 (not April)

const periodStart = new Date('2026-05-01T00:00:00Z');
const periodEnd = new Date('2026-05-31T23:59:59Z');
```

**User's Local Display:**
- Claim date: "April 30, 2026 at 11:00 PM EDT"
- Period: "May 2026"

---

### Edge Case 8: Claiming for Very Old Period

**Scenario:** User tries to claim for April 2018 (current date: April 2026)

**Handling:**
- Allow claims up to 7 years in past
- April 2018 is ~8 years old → reject

```typescript
const maxAge = 7 * 365;  // days
const periodAge = (now - periodStart) / (1000 * 60 * 60 * 24);

if (periodAge > maxAge) {
  return {
    canClaim: false,
    reason: 'Period too old (maximum 7 years of history)'
  };
}
```

---

### Edge Case 9: Rounding Errors in Amount Calculations

**Scenario:** Annual $200 ÷ 12 months = $16.666... per month

**Handling:**
- Store everything in cents (no decimals)
- Use banker's rounding (round half to even)
- Monthly: 20000 / 12 = 1666.67 → round to 1667 cents ($16.67)
- Track rounding differences

```typescript
function calculateAmountPerPeriod(annualAmount: number, cadence: ResetCadence): number {
  let divisor: number;
  switch (cadence) {
    case 'MONTHLY': divisor = 12; break;
    case 'QUARTERLY': divisor = 4; break;
    case 'SEMI_ANNUAL': divisor = 2; break;
    case 'ANNUAL': return annualAmount;
  }
  
  return Math.round(annualAmount / divisor);  // Banker's rounding
}
```

---

### Edge Case 10: Soft Delete Recovery

**Scenario:** User deletes April claim, then wants to undo within 30 days

**Handling:**
- Soft delete: Set deletedAt timestamp, don't hard delete
- Recovery button available within 30 days
- After 30 days: auto-purge old soft-deleted records (via scheduled job)

```typescript
// GET /api/benefits/usage?filter=deleted
// Shows only soft-deleted records (deletedAt IS NOT NULL)

// POST /api/benefits/usage/[recordId]/restore
// Clears deletedAt timestamp
```

---

### Edge Case 11: Network Failure / Retry Logic

**Scenario:** User submits claim, network drops, then connection restored

**Handling:**
- Client-side: Show "Claiming..." state
- Timeout after 5s: "Connection lost. Retry?"
- Retry button resubmits same request
- API is idempotent: if record already exists, return 200 (not duplicate)

```typescript
// Idempotent key: (userCardId, masterBenefitId, periodStart)
// If same key submitted twice, return existing record (don't create duplicate)

const existing = await prisma.benefitUsageRecord.findUnique({
  where: {
    userCardId_masterBenefitId_periodStart: {
      userCardId,
      masterBenefitId,
      periodStart
    }
  }
});

if (existing) {
  return { success: true, record: existing, isRetry: true };
}
```

---

### Edge Case 12: Rate Limiting / Spam Prevention

**Scenario:** User repeatedly clicks "Claim" button, submits 50 requests in 1 second

**Handling:**
- Rate limit: 10 requests per minute per user
- Return 429 (Too Many Requests) after threshold

```typescript
import rateLimit from 'express-rate-limit';

const benefitsLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests
  message: 'Too many benefit claims. Please try again in 1 minute.',
  statusCode: 429
});

app.post('/api/benefits/usage', benefitsLimiter, handleClaimBenefit);
```

**Frontend:**
- Disable "Claim" button during submission (1-2s)
- Show loading spinner
- Toast: "Rate limited. Please wait..."

---

## Component Architecture

### System Components & Responsibilities

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 15)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────┐  ┌──────────────────────────────┐   │
│ │   UI Components     │  │   Utility Functions          │   │
│ ├─────────────────────┤  ├──────────────────────────────┤   │
│ │ • MarkBenefitModal  │  │ • getPeriodBoundaries()      │   │
│ │ • BenefitCard       │  │ • calculateAmountPerPeriod() │   │
│ │ • HistoricalTab     │  │ • getAvailablePeriods()      │   │
│ │ • Dashboard         │  │ • canClaimPeriod()           │   │
│ │                     │  │ • formatAmount()             │   │
│ └─────────────────────┘  └──────────────────────────────┘   │
│          │                           │                       │
│          └───────────────┬───────────┘                       │
│                          │                                    │
│                    API Client Layer                          │
│                   (Next.js Fetch/SWR)                        │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
                   ┌───────┴────────┐
                   │ HTTP Requests  │
                   └───────┬────────┘
                           │
┌──────────────────────────┼────────────────────────────────────┐
│                  Backend API Layer (Next.js API Routes)      │
├──────────────────────────┼────────────────────────────────────┤
│                          │                                    │
│   ┌───────────────────┬──┴─────────────────┐                 │
│   │                   │                    │                 │
│   v                   v                    v                 │
│ Route 1            Route 2              Route N              │
│ POST               GET                 PATCH/DELETE          │
│ /benefits/usage    /benefits/usage      /benefits/usage/[id] │
│   │                   │                    │                 │
│   └───────────────────┼────────────────────┘                 │
│                       │                                      │
│       ┌───────────────┼───────────────┐                      │
│       │               │               │                      │
│       v               v               v                      │
│   ┌──────────────────────────────────────────┐              │
│   │   Middleware Layer                       │              │
│   ├──────────────────────────────────────────┤              │
│   │ • Authentication (JWT)                   │              │
│   │ • Authorization (user owns card)         │              │
│   │ • Validation (schema)                    │              │
│   │ • Rate Limiting (10 req/min)             │              │
│   │ • Error Handling                         │              │
│   └──────────────────────────────────────────┘              │
│                       │                                      │
│       ┌───────────────┼───────────────┐                      │
│       │               │               │                      │
│       v               v               v                      │
│   ┌──────────────────────────────────────────┐              │
│   │   Business Logic Layer                   │              │
│   ├──────────────────────────────────────────┤              │
│   │ • Period Calculation                     │              │
│   │ • Amount Validation                      │              │
│   │ • Duplicate Check                        │              │
│   │ • State Transitions                      │              │
│   └──────────────────────────────────────────┘              │
│                       │                                      │
│       ┌───────────────┼───────────────┐                      │
│       │               │               │                      │
│       v               v               v                      │
│   ┌──────────────────────────────────────────┐              │
│   │   Data Access Layer (Prisma ORM)         │              │
│   ├──────────────────────────────────────────┤              │
│   │ • BenefitUsageRecord CRUD                │              │
│   │ • Query helpers (findByUserAndPeriod)    │              │
│   │ • Transaction handling                   │              │
│   └──────────────────────────────────────────┘              │
│                       │                                      │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────┴──────────────────────────────────────┐
│                    PostgreSQL Database                        │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Tables:                                                       │
│ • user                                                        │
│ • card                                                        │
│ • user_card (with cardAddedDate, cancelledDate)             │
│ • master_benefit (with resetCadence, cadenceAmount)         │
│ • benefit_usage_record (main tracking table)                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Component Dependencies

**Phase 6A (Data Model):**
- Prisma schema files
- No other components depend yet

**Phase 6B (API Layer):**
- Depends on: Phase 6A (data model)
- Utilities layer (period calculation functions)
- Middleware (auth, validation, rate limiting)
- Provides: API contracts for frontend

**Phase 6C (UI Components):**
- Depends on: Phase 6B (API endpoints)
- Utilities layer (period calculation, formatting)
- Provides: User-facing interface

**Phase 6D (Polish & Edge Cases):**
- Depends on: All prior phases
- Implements: Special case handlers, confirmation flows, admin views
- Enhances: All components with error handling

### Integration Points

1. **Frontend ↔ Backend API**
   - RESTful JSON requests/responses
   - Standard HTTP status codes
   - Error response standardization

2. **Backend ↔ Database**
   - Prisma queries with proper indexing
   - Transaction support for consistency
   - Soft delete support (deletedAt field)

3. **UI ↔ Utilities**
   - Period calculation helpers
   - Amount formatting
   - Validation functions

4. **API ↔ Business Logic**
   - Cleanly separated concerns
   - Testable functions
   - No side effects in calculations

---

## Implementation Tasks

### Phase 6A: Core Data Model & Migration

#### Task 6A-1: Update Prisma Schema
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** None

**Acceptance Criteria:**
- MasterBenefit model updated with resetCadence and cadenceAmount fields
- BenefitUsageRecord model created with all required fields
- ResetCadence enum defined (MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL, CUSTOM)
- All indexes created for performance
- Unique constraint on (userCardId, masterBenefitId, periodStart)
- UserCard model updated with cardAddedDate field
- Prisma validation passes without warnings

**What to Deliver:**
```
- prisma/schema.prisma (updated)
- No database changes yet (just schema file)
```

---

#### Task 6A-2: Create Database Migration
**Complexity:** Medium
**Estimated Time:** 3-4 hours
**Dependencies:** Task 6A-1

**Acceptance Criteria:**
- Migration file created (timestamp_phase6_period_tracking.ts)
- Adds resetCadence enum type to database
- Creates benefit_usage_record table with all fields
- Adds indexes and constraints
- Migration runs successfully on local dev database
- Rollback command works correctly
- No data loss for existing tables

**What to Deliver:**
```
- prisma/migrations/XXXXXXXX_phase6_period_tracking/migration.sql
- Migration test run log
```

---

#### Task 6A-3: Implement Period Calculation Utilities
**Complexity:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** Task 6A-1

**Acceptance Criteria:**
- getPeriodBoundaries() function handles all 5 cadences correctly
- calculateAmountPerPeriod() converts annual to period amounts
- getAvailablePeriods() returns historical periods correctly
- canClaimPeriod() validates all constraints
- All functions handle UTC dates properly
- Leap year handling works (Feb 29)
- Unit tests pass for all functions (100+ test cases)
- Function signatures match API contract

**What to Deliver:**
```
- src/lib/period-utils.ts (all 4 utilities + helpers)
- src/lib/__tests__/period-utils.test.ts (comprehensive tests)
```

---

#### Task 6A-4: Data Migration Script (Legacy → New Model)
**Complexity:** Medium
**Estimated Time:** 3-4 hours
**Dependencies:** Task 6A-1, Task 6A-2

**Acceptance Criteria:**
- Script reads all legacy UserBenefit records
- For each used=true record, creates equivalent BenefitUsageRecord
- Sets periodStart/periodEnd based on resetCadence
- Sets amountClaimed = annualAmount (assume full claim)
- Adds migration note in notes field
- Script is idempotent (can run multiple times safely)
- Rollback script available
- Dry-run mode to preview changes before executing
- Logs all created records with IDs

**What to Deliver:**
```
- scripts/migrate-user-benefits-to-usage-records.ts
- scripts/rollback-user-benefits-migration.ts
- Migration execution log example
- Verification script to compare old vs new data
```

---

#### Task 6A-5: Schema Validation & Testing
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Tasks 6A-1 through 6A-4

**Acceptance Criteria:**
- Prisma client regenerates successfully
- All model relationships verified
- TypeScript types inferred correctly
- Foreign key constraints tested
- Unique constraints tested
- Indexes verified in database
- Migration test passes with sample data
- Documentation updated with schema explanation

**What to Deliver:**
```
- Updated docs/DATABASE_SCHEMA.md with Phase 6 schema
- Test results showing all validations passing
```

---

### Phase 6B: API Layer & Business Logic

#### Task 6B-1: Implement POST /api/benefits/usage
**Complexity:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 6A

**Acceptance Criteria:**
- Endpoint accepts POST requests with correct schema
- Validates all required fields (masterBenefitId, userCardId, amountClaimed)
- Checks authorization (user owns card)
- Prevents duplicate claims (unique constraint)
- Calculates correct period based on forPeriod or current date
- Validates amountClaimed ≤ amountAvailable
- Creates BenefitUsageRecord with all fields
- Returns 201 with record + remaining amount
- Returns appropriate 4xx errors with details
- Logs all claims for audit trail
- Rate limit enforced (10/minute)

**What to Deliver:**
```
- src/app/api/benefits/usage/route.ts (POST handler)
- src/lib/benefits-service.ts (business logic)
- Test file: src/app/api/benefits/usage/__tests__/route.test.ts
- API documentation updated
```

---

#### Task 6B-2: Implement GET /api/benefits/usage (List)
**Complexity:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 6A

**Acceptance Criteria:**
- Endpoint accepts GET with pagination parameters
- Returns paginated list of records (default 20 per page, max 100)
- Filters by userId (authenticated user only)
- Supports filters: all, active, deleted
- Supports sorting: claimDate, periodStart, amountClaimed
- Optional filters: userCardId, startDate, endDate
- Includes benefit name and card name in response
- Returns total count and page info
- Performance: < 200ms for 1000 records

**What to Deliver:**
```
- src/app/api/benefits/usage/route.ts (GET handler)
- Test file: GET specific tests
```

---

#### Task 6B-3: Implement GET /api/benefits/[id]/status
**Complexity:** Small
**Estimated Time:** 3-4 hours
**Dependencies:** Phase 6A, 6B-1

**Acceptance Criteria:**
- Returns current period status for a benefit
- Requires userCardId query parameter
- Shows available, claimed, remaining amounts
- Shows periodStart, periodEnd, nextResetDate
- Shows recent claims (last 3 periods)
- Returns correct period calculations
- Validates benefit exists on card

**What to Deliver:**
```
- src/app/api/benefits/[id]/status/route.ts
- Test file
```

---

#### Task 6B-4: Implement PATCH /api/benefits/usage/[recordId]
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6A, 6B-1

**Acceptance Criteria:**
- Allows updating amountClaimed and/or notes
- Validates new amountClaimed ≤ amountAvailable
- Checks user authorization
- Updates updatedAt timestamp
- Returns updated record with new remaining amount
- Prevents changing period or masterBenefitId

**What to Deliver:**
```
- src/app/api/benefits/usage/[recordId]/route.ts (PATCH handler)
- Test file
```

---

#### Task 6B-5: Implement DELETE /api/benefits/usage/[recordId]
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6A, 6B-1

**Acceptance Criteria:**
- Soft delete by default (set deletedAt)
- Hard delete requires admin + ?hardDelete=true
- Validates user authorization
- Returns 200 on success
- Optional recovery endpoint: POST /api/benefits/usage/[recordId]/restore
- Scheduled job purges soft-deleted records after 30 days

**What to Deliver:**
```
- src/app/api/benefits/usage/[recordId]/route.ts (DELETE handler)
- src/app/api/benefits/usage/[recordId]/restore/route.ts (POST restore)
- Test file
```

---

#### Task 6B-6: Authentication & Authorization Middleware
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Existing auth system

**Acceptance Criteria:**
- All endpoints verify JWT authentication
- All endpoints check user owns the card/benefit
- 401 for missing auth
- 403 for unauthorized access
- Middleware applied consistently across all routes

**What to Deliver:**
```
- Updated middleware in src/middleware.ts or src/lib/auth-utils.ts
- Test file
```

---

#### Task 6B-7: Rate Limiting & Validation
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Existing infrastructure

**Acceptance Criteria:**
- All POST/PATCH endpoints rate-limited to 10/minute
- Invalid input returns 400 with specific error details
- Database constraints enforced
- Request/response validation using Zod or similar
- Idempotent POST (retry safety)

**What to Deliver:**
```
- src/lib/rate-limiter.ts or middleware
- src/lib/validation-schemas.ts (Zod/TypeBox schemas)
- Test file
```

---

### Phase 6C: Frontend Components & UI

#### Task 6C-1: MarkBenefitUsedModal Component
**Complexity:** Large
**Estimated Time:** 6-8 hours
**Dependencies:** Phase 6B (API endpoints)

**Acceptance Criteria:**
- Modal displays benefit and card information
- Period selector dropdown shows all available periods
- Current period pre-selected with correct date range
- Real-time display of available amount for selected period
- Displays claimed-so-far in current period
- Amount input field validates against max available
- Notes field with 500 character limit and counter
- Progress bar preview shows result after claim
- Submit button disabled during loading
- Success toast on completion
- Error toast with specific error message
- Cancel button closes modal without changes
- Responsive on mobile/tablet/desktop
- Accessibility: ARIA labels, keyboard navigation

**What to Deliver:**
```
- src/components/benefits/MarkBenefitUsedModal.tsx
- Component test file with various scenarios
- Storybook story (optional)
```

---

#### Task 6C-2: BenefitCard Component Updates
**Complexity:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 6B, 6C-1

**Acceptance Criteria:**
- Displays benefit name, description, card name
- Shows current period information
- Progress bar shows claimed/available
- Status indicator (Claimed/Partially Claimed/Not Started)
- "Mark Used" button opens modal
- "History" button opens historical tab
- Updates in real-time after claim
- Shows next reset date
- Responsive design

**What to Deliver:**
```
- Updated src/components/benefits/BenefitCard.tsx
- Test file
```

---

#### Task 6C-3: HistoricalUsageTab Component
**Complexity:** Large
**Estimated Time:** 6-8 hours
**Dependencies:** Phase 6B, 6C-1

**Acceptance Criteria:**
- Displays table of all historical periods
- Filter buttons: This Month, Last 3 Mo, Last 6 Mo, All
- Sort options: Newest, Oldest, Amount
- Shows: Period, Amount Claimed, Available, Notes, Status
- Expandable rows show full details
- Edit button opens modal to edit amount/notes
- Delete button with confirmation
- Undo option for recently deleted (within 30 days)
- Pagination if > 50 records
- Empty state message
- Loading spinner during data fetch
- Responsive on all screen sizes

**What to Deliver:**
```
- src/components/benefits/HistoricalUsageTab.tsx
- Component test file
```

---

#### Task 6C-4: Dashboard Enhancements
**Complexity:** Medium
**Estimated Time:** 5-6 hours
**Dependencies:** Phase 6B, 6C-2, 6C-3

**Acceptance Criteria:**
- Summary stats at top: claimed, remaining, card count
- Cards grouped by reset period
- Benefits sorted by status (claimed first)
- Filter by card dropdown
- Filter by status (all, claimed, unclaimed, expired)
- Benefits show period dates and next reset
- Click on benefit opens modal or detail view
- Dashboard updates in real-time
- Performance: < 1s load for 15 cards × 65 benefits
- Responsive design

**What to Deliver:**
```
- Updated src/pages/dashboard.tsx or src/app/dashboard/page.tsx
- src/components/dashboard/BenefitsSummary.tsx
- src/components/dashboard/BenefitsGrid.tsx
- Test file
```

---

#### Task 6C-5: Period Selector Component
**Complexity:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** Period utilities (Phase 6A)

**Acceptance Criteria:**
- Reusable dropdown component
- Shows current period first
- Shows last 12 months in "Recent" section
- Shows previous years in collapsed sections
- Visual indicator for already-claimed periods
- Disabled state for future periods
- Keyboard navigation (arrow keys, Enter)
- Search/filter capability (optional)
- Accessible (ARIA labels, semantic HTML)

**What to Deliver:**
```
- src/components/periods/PeriodSelector.tsx
- Component test file
```

---

#### Task 6C-6: UI Polish & Accessibility
**Complexity:** Small
**Estimated Time:** 3-4 hours
**Dependencies:** All UI components

**Acceptance Criteria:**
- All components have proper ARIA labels
- Keyboard navigation works throughout
- Color contrast meets WCAG AA standards
- Touch targets min 44x44px on mobile
- Loading states on all async operations
- Error messages are clear and actionable
- Success messages confirm actions
- Responsive breakpoints: mobile, tablet, desktop
- Test with screen reader (accessibility audit)

**What to Deliver:**
```
- Updated components with accessibility fixes
- Accessibility audit report
```

---

### Phase 6D: Edge Cases & Polish

#### Task 6D-1: Special Case Handlers (Dec UberEats, Leap Year, etc.)
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6A utilities

**Acceptance Criteria:**
- December UberEats bonus ($5 extra) implemented
- Leap year handling (Feb 29 → Feb 28)
- Card cancellation mid-period handled
- Timezone edge cases tested
- Amount rounding consistent
- All edge cases in spec addressed
- Test cases for each edge case

**What to Deliver:**
```
- src/lib/edge-case-handlers.ts
- Comprehensive test file with 20+ scenarios
```

---

#### Task 6D-2: Confirmation Flows & Error Dialogs
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6C components

**Acceptance Criteria:**
- Delete claim shows confirmation dialog
- Edit large amount shows confirmation
- Network errors show retry option
- Rate limit shows user-friendly message
- Validation errors show specific field
- Success/failure toasts appropriately styled
- Undo option for deletions (30 days)

**What to Deliver:**
```
- Updated modal/dialog components
- Toast message service
- Test file
```

---

#### Task 6D-3: Admin Support Views (Optional for Phase 6 MVP)
**Complexity:** Medium
**Estimated Time:** 4-5 hours
**Dependencies:** Phase 6B API

**Acceptance Criteria:**
- Admin can view any user's benefit history
- Admin can edit/delete any claim (with audit log)
- Admin can force-reset a period
- Admin dashboard shows aggregate stats
- All admin actions logged

**What to Deliver:**
```
- src/app/admin/benefits/page.tsx
- src/app/api/admin/benefits/* endpoints
- Test file
```

---

#### Task 6D-4: Comprehensive Test Suite
**Complexity:** Large
**Estimated Time:** 8-10 hours
**Dependencies:** All prior tasks

**Acceptance Criteria:**
- Unit tests for all utilities (95%+ coverage)
- Integration tests for all API endpoints
- Component tests for all UI components
- End-to-end tests for major user flows
- Edge case coverage (all 12 edge cases tested)
- Performance benchmarks
- All tests pass locally and in CI

**What to Deliver:**
```
- src/**/__tests__/*.test.ts files
- e2e tests in tests/
- Coverage report (95%+ target)
```

---

#### Task 6D-5: Monitoring & Logging
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6B API

**Acceptance Criteria:**
- All API endpoints log requests/responses
- Claim operations logged with user ID, benefit ID, amount
- Errors logged with full context
- Performance metrics tracked (latency, success rate)
- Alerts configured for failures
- Dashboard shows claim trends
- Audit trail queryable for support

**What to Deliver:**
```
- Updated logging middleware
- src/lib/monitoring.ts or similar
- Logging configuration
```

---

### Phase 6E: Documentation & Rollout

#### Task 6E-1: API Documentation
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6B

**Acceptance Criteria:**
- OpenAPI/Swagger spec generated
- All 5 endpoints documented
- Request/response schemas shown
- Error codes and meanings explained
- Example requests/responses
- Rate limiting documented
- Authentication requirements clear

**What to Deliver:**
```
- openapi.yaml or swagger.json (updated)
- docs/PHASE6-API.md
```

---

#### Task 6E-2: User Guides & Help Documentation
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 6C UI

**Acceptance Criteria:**
- User guide with screenshots
- FAQ section
- Common issues and solutions
- Video tutorial (optional)
- In-app help tooltips
- Example scenarios documented

**What to Deliver:**
```
- docs/PHASE6-USER-GUIDE.md (with screenshots)
- docs/PHASE6-FAQ.md
```

---

#### Task 6E-3: Deployment & Rollout Runbook
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** All prior phases

**Acceptance Criteria:**
- Step-by-step deployment guide
- Database migration steps
- Rollback procedures
- Health checks before/after
- Gradual rollout strategy (feature flag optional)
- Monitoring setup
- Support handoff documentation

**What to Deliver:**
```
- docs/PHASE6-DEPLOYMENT-RUNBOOK.md
- scripts/deploy-phase6.sh (optional)
```

---

#### Task 6E-4: Knowledge Transfer & Training
**Complexity:** Small
**Estimated Time:** 2-3 hours
**Dependencies:** All documentation

**Acceptance Criteria:**
- Engineering team trained on new system
- Support team trained on user flows
- Admin team trained on tools
- Documentation reviewed by team
- Q&A session conducted
- Runbook walk-through completed

**What to Deliver:**
```
- Training session video/notes
- Recorded walkthrough
```

---

## Security & Compliance Considerations

### Authentication & Authorization

**Strategy:**
- All endpoints require valid JWT in Authorization header
- JWT contains userId for identity verification
- No cross-user data access (verified on every request)

**Implementation:**
```typescript
// Middleware: verify JWT and extract userId
const middleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const decoded = verifyJWT(token);
    req.userId = decoded.sub;  // Set user context
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Route handler: verify ownership
const claimBenefit = async (req, res) => {
  const userCard = await prisma.userCard.findUnique({
    where: { id: req.body.userCardId }
  });
  
  if (userCard.userId !== req.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Proceed with claim...
};
```

---

### Data Protection & Privacy

**Data Classification:**
- User IDs: Personally identifiable (PII)
- Benefit usage records: Sensitive financial data
- Claim amounts: Financial data

**Protection Measures:**
1. **Encryption at Rest:** All user data encrypted in PostgreSQL
2. **Encryption in Transit:** HTTPS/TLS for all API calls
3. **Access Control:** Row-level security (users see only own data)
4. **Audit Logging:** All access logged with timestamp and action
5. **Data Retention:** Historical records kept for 7 years per spec
6. **Soft Deletes:** No immediate permanent deletion (30-day recovery window)

**GDPR Compliance:**
- User can request export of all benefit usage data
- User can request deletion of all records (after 30-day soft delete)
- No third-party sharing of benefit data

---

### Audit & Logging

**Audit Trail for Benefit Claims:**
```typescript
async function auditLog(action: string, userId: string, details: object) {
  await prisma.auditLog.create({
    data: {
      action,        // 'CLAIM', 'UPDATE', 'DELETE', 'RESTORE'
      userId,
      resourceType:  'BenefitUsageRecord',
      resourceId:    details.recordId,
      changes:       JSON.stringify(details),
      timestamp:     new Date(),
      ipAddress:     getClientIP(req),
      userAgent:     req.headers['user-agent']
    }
  });
}

// Logged events:
// - CLAIM: when benefit claimed
// - UPDATE: when claim updated (amount/notes)
// - DELETE: when claim soft-deleted
// - RESTORE: when claim restored
// - VIEW: when user views historical records (optional)
```

**Query Audit Trail:**
```typescript
// Support can query: "Show me all claims by user X in period Y"
const logs = await prisma.auditLog.findMany({
  where: {
    userId,
    action: 'CLAIM',
    timestamp: { gte: periodStart, lte: periodEnd }
  }
});
```

---

### Input Validation & Sanitization

**Schema Validation (Zod):**
```typescript
const createClaimSchema = z.object({
  masterBenefitId: z.string().cuid('Invalid benefit ID'),
  userCardId: z.string().cuid('Invalid card ID'),
  amountClaimed: z.number()
    .int('Amount must be in cents')
    .positive('Amount must be positive')
    .max(999999, 'Amount too large'),
  notes: z.string().max(500, 'Notes too long').optional(),
  forPeriod: z.string().datetime().optional()
});

// Use in handler:
const data = createClaimSchema.parse(req.body);
```

**Prevention Measures:**
- No SQL injection (Prisma parameterized queries)
- No XSS (React automatically escapes)
- No CSRF (Next.js built-in CSRF protection)
- Input trimming and sanitization
- Rate limiting prevents brute force

---

### Database Constraints & Integrity

**Foreign Key Constraints (with cascade):**
```prisma
model BenefitUsageRecord {
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  userCard     UserCard    @relation(fields: [userCardId], references: [id], onDelete: Cascade)
  masterBenefit MasterBenefit @relation(fields: [masterBenefitId], references: [id], onDelete: Cascade)
}
```

**Unique Constraints:**
```prisma
@@unique([userCardId, masterBenefitId, periodStart])
```

**Check Constraints (if supported by Prisma):**
```sql
-- PostgreSQL level:
ALTER TABLE benefit_usage_record
ADD CONSTRAINT amount_claimed_le_available
CHECK (amount_claimed <= amount_available);

ALTER TABLE benefit_usage_record
ADD CONSTRAINT amount_positive
CHECK (amount_claimed > 0);
```

---

## Performance & Scalability Considerations

### Query Optimization

**Indexes Strategy:**
```prisma
model BenefitUsageRecord {
  @@unique([userCardId, masterBenefitId, periodStart])  // Prevent duplicates
  @@index([userId, periodStart])                        // Query: user claims in period
  @@index([userCardId, masterBenefitId])                // Query: card benefit history
  @@index([periodStart, periodEnd])                     // Query: claims in date range
  @@index([userId, claimDate])                          // Query: recent user claims
  @@index([deletedAt])                                  // Query: active vs soft-deleted
}
```

**Query Performance Targets:**
- List claims (20 records): < 100ms
- Get period status: < 50ms
- Create claim: < 200ms
- Update claim: < 150ms
- Delete claim: < 100ms

**Example Optimized Query:**
```typescript
// BAD: N+1 query problem
const records = await prisma.benefitUsageRecord.findMany({
  where: { userId }
});
const enriched = records.map(r => ({
  ...r,
  benefit: prisma.masterBenefit.findUnique({ where: { id: r.masterBenefitId } })  // N queries!
}));

// GOOD: Single query with joins
const records = await prisma.benefitUsageRecord.findMany({
  where: { userId },
  include: {
    masterBenefit: { include: { card: true } },
    userCard: true
  }
});
```

---

### Caching Strategy

**What to Cache:**
1. **Period Boundaries** (static per cadence)
   - Redis key: `period:${cadence}:${date}`
   - TTL: 24 hours
   
2. **Benefit Status** (semi-dynamic)
   - Redis key: `status:${userCardId}:${benefitId}`
   - TTL: 5 minutes
   
3. **User Benefit Summary** (frequently accessed)
   - Redis key: `summary:${userId}:${month}`
   - TTL: 10 minutes
   - Invalidate on claim

**Cache Invalidation:**
```typescript
async function createClaim(data: ClaimData) {
  const record = await prisma.benefitUsageRecord.create({ data });
  
  // Invalidate related caches
  await redis.del([
    `status:${data.userCardId}:${data.masterBenefitId}`,
    `summary:${data.userId}:${getPeriodMonth(data.periodStart)}`
  ]);
  
  return record;
}
```

---

### Database Scaling

**Current Scale:**
- ~1M users (estimate for growth)
- ~15 cards per user = ~15M UserCard records
- ~65 benefits × 1M users = ~65M MasterBenefit relationships
- ~2 claims per user per month = ~24M BenefitUsageRecord per year

**Sharding Strategy (if needed):**
- Partition by userId (most queries filter by userId)
- Shard key: userId % 256 shards
- Each shard handles ~4K users

**Example Partitioning (future):**
```sql
-- Partition benefit_usage_record by userId
CREATE TABLE benefit_usage_record_SHARD_00 PARTITION OF benefit_usage_record
  FOR VALUES FROM (0) TO (16777216);  -- userId hash % 256

-- Query routing layer determines correct shard
```

---

### Rate Limiting

**Strategy:**
- Per-user rate limit: 10 requests/minute
- Per-IP rate limit: 100 requests/minute (prevent abuse)
- Per-endpoint rate limit: 1000 requests/minute (global)

**Implementation (with Redis):**
```typescript
const rateLimiter = async (userId: string, endpoint: string) => {
  const key = `ratelimit:${userId}:${endpoint}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 60);  // Reset after 60s
  }
  
  if (count > 10) {
    throw new Error('Rate limit exceeded');
  }
};
```

---

## Example Scenarios

### Scenario 1: Amex Platinum UberEats ($200/year)

**Card Details:**
- Added: May 1, 2026
- Benefit: UberEats $200/year = $16.67/month (stored as 1667 cents)
- Special: December gets +$5 (2000 cents total)

**Monthly Periods:**
```
May 2026:    $1667 available
June 2026:   $1667 available
...
December 2026: $2000 available (extra $333 bonus)

May 2027:    $1667 available (resets on anniversary)
```

**User Actions:**
1. **April 15, 2026:** Card not yet added
2. **May 15, 2026:** User adds card, gets $1667 for May
3. **May 20, 2026:** Claims $1667 (full amount)
   ```
   POST /api/benefits/usage
   {
     masterBenefitId: "ben_uber_amex",
     userCardId: "uc_amex_001",
     amountClaimed: 1667,
     notes: "UberEats May orders"
   }
   
   Response: { success: true, remaining: 0 }
   Dashboard: Progress bar shows "100% claimed" with checkmark
   ```
4. **June 15, 2026:** New period, $1667 available
5. **June 20, 2026:** Claims $800
   ```
   amountClaimed: 800, remaining: 867
   Dashboard: Progress bar shows "48% claimed"
   ```
6. **June 28, 2026:** Claims remaining $867
   ```
   amountClaimed: 867, remaining: 0
   Total for June: $800 + $867 = $1667 ✓
   Dashboard: Progress bar shows "100% claimed"
   ```
7. **December 15, 2026:** December special ($2000 available)
8. **December 25, 2026:** Claims $2000
   ```
   amountClaimed: 2000, remaining: 0
   ```
9. **May 15, 2027:** Anniversary! Benefit resets
   ```
   { periodStart: "2027-05-01", amountAvailable: 1667 }
   ```

---

### Scenario 2: Chase Sapphire ($300 Annual Fee Credit)

**Card Details:**
- Added: September 1, 2025
- Benefit: Airline Fee Credit $300/year
- Reset: ANNUAL (September 1 each year)

**Annual Periods:**
```
Sept 1, 2025 - Aug 31, 2026:  $30000 available
Sept 1, 2026 - Aug 31, 2027:  $30000 available
```

**User Actions:**
1. **Sept 15, 2025:** Card added, $30000 available for 2025-2026
2. **Oct 1, 2025:** Claims $200 for airline fee
3. **Dec 15, 2025:** Claims $50 (remaining: $29750)
4. **March 20, 2026:** Claims $50 (remaining: $29700)
5. **Aug 31, 2026:** Period ends, $29700 was claimed (not fully used)
   - Historical tab shows: "Sept 2025-Aug 2026: $300 available, $300 claimed ✓"
6. **Sept 1, 2026:** New period! $30000 available again
7. **Dec 1, 2026:** Claims $100

**Dashboard September 2026:**
```
Chase Sapphire Preferred
Airline Fee Credit: $0/$30000 (2% claimed)
[Claim]
Next Reset: September 1, 2027
```

---

### Scenario 3: US Bank $300 Travel Credit (Quarterly)

**Card Details:**
- Added: April 15, 2026
- Benefit: Travel Credit $300/year = $75/quarter
- Reset: QUARTERLY

**Quarterly Periods:**
```
Q1 (Jan 1 - Mar 31):   $7500 available
Q2 (Apr 1 - Jun 30):   $7500 available
Q3 (Jul 1 - Sep 30):   $7500 available
Q4 (Oct 1 - Dec 31):   $7500 available
```

**User Timeline:**
1. **April 15, 2026:** Card added mid-Q2
   - Q2 starts April 1, so $7500 available (not prorated)
2. **April 25, 2026:** User queries status
   ```
   GET /api/benefits/[id]/status?userCardId=uc_usbank
   
   Response:
   currentPeriod: {
     periodStart: "2026-04-01",
     periodEnd: "2026-06-30",
     amountAvailable: 7500,
     amountClaimed: 0
   }
   upcomingPeriod: {
     periodStart: "2026-07-01",
     periodEnd: "2026-09-30",
     amountAvailable: 7500,
     amountClaimed: 0
   }
   ```
3. **May 10, 2026:** Claims $40 for airline ticket
4. **June 15, 2026:** Claims $35 for hotel (total Q2: $75)
   - Queries for next quarter:
   ```
   GET /api/benefits/usage?
     startDate=2026-07-01&
     endDate=2026-09-30&
     userCardId=uc_usbank
   
   Response: { total: 0 }  // Q3 not started yet
   ```
5. **July 1, 2026:** Q3 starts
   ```
   currentPeriod: {
     periodStart: "2026-07-01",
     periodEnd: "2026-09-30",
     amountAvailable: 7500,
     amountClaimed: 0
   }
   ```
6. **Historical View (Last 6 Months):**
   ```
   Q2 2026 (Apr-Jun):  $75/$75 ✓
   Q1 2026 (Jan-Mar):  -       (not owned yet)
   Q4 2025:            -       (not owned)
   ```

---

### Scenario 4: Handle Leap Year Anniversary (Feb 29 Card)

**Edge Case:**
- Card added: Feb 29, 2024 (leap year)
- Reset: ANNUAL on Feb 29
- Query date: Feb 15, 2025 (non-leap year)

**Period Calculation:**
```typescript
cardAddedDate = new Date('2024-02-29');
referenceDate = new Date('2025-02-15');

// Since Feb 15 < Feb 29, we're in previous year's period
// But adjust Feb 29 → Feb 28 for non-leap years

const { start, end } = getPeriodBoundaries('ANNUAL', cardAddedDate, referenceDate);
// start: Feb 28, 2024 (adjusted from Feb 29)
// end: Feb 27, 2025

// In 2026 (another non-leap year):
referenceDate = new Date('2026-03-15');
// start: Feb 28, 2025 (adjusted from Feb 29)
// end: Feb 27, 2026
```

**Result:** Benefits reset every Feb 28 on non-leap years, Feb 29 on leap years.

---

### Scenario 5: Partial Claims Over Time

**Scenario:** User claims UberEats benefit incrementally throughout month

**April 2026 (Monthly, $15 available):**

1. **April 5:** Claims $5
   ```
   POST /api/benefits/usage
   {
     masterBenefitId: "ben_uber",
     userCardId: "uc_amex",
     amountClaimed: 500,
     notes: "UberEats order #123"
   }
   
   Response:
   record: { amountClaimed: 500, amountAvailable: 1500 }
   remaining: 1000
   ```

2. **April 12:** Claims $8
   ```
   POST /api/benefits/usage
   {
     masterBenefitId: "ben_uber",
     userCardId: "uc_amex",
     amountClaimed: 800,
     notes: "UberEats order #456"
   }
   
   Response:
   record: { amountClaimed: 800, amountAvailable: 1500 }
   remaining: 200
   ```

3. **April 20:** Query total claimed for April
   ```
   GET /api/benefits/[ben_uber]/status?userCardId=uc_amex
   
   Response:
   currentPeriod: {
     amountAvailable: 1500,
     amountClaimed: 1300,  // Sum of all claims in period
     remaining: 200
   }
   ```

4. **April 28:** Claims final $2 (over claims by not checking!)
   ```
   POST /api/benefits/usage
   {
     masterBenefitId: "ben_uber",
     userCardId: "uc_amex",
     amountClaimed: 200,
     notes: "UberEats order #789"
   }
   
   Response:
   record: { amountClaimed: 200, amountAvailable: 1500 }
   remaining: 0
   
   Total April: $5 + $8 + $2 = $15 ✓
   ```

5. **Historical View Shows All 3 Claims:**
   ```
   Period: April 2026
   Records:
   - April 5: $5 claimed
   - April 12: $8 claimed
   - April 28: $2 claimed
   ```

---

## Conclusion

This Phase 6 specification provides a complete blueprint for implementing period-based benefit usage tracking. The design:

✓ **Supports all period cadences** (monthly, quarterly, semi-annual, annual, custom)
✓ **Handles partial claims** across multiple transactions
✓ **Maintains data integrity** with unique constraints and validation
✓ **Provides comprehensive history** for 7 years of past periods
✓ **Manages edge cases** (leap year, timezone, mid-period cancellations)
✓ **Ensures security** with authentication, authorization, and audit trails
✓ **Scales efficiently** with proper indexing and caching strategies
✓ **Delivers excellent UX** with intuitive modals, progress bars, and historical views

The implementation can proceed in parallel across API layer, UI components, and supporting utilities. Each phase is designed to be independently testable and developable.

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Status:** Ready for Implementation
