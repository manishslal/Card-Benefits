# Card Benefits Tracker - Custom Benefit Values Feature Specification

## Document Information

- **Version:** 2.0 (Refined)
- **Date:** April 2024
- **Status:** Ready for Implementation
- **Target Audience:** Full-Stack Engineers, QA Engineers
- **Scope:** Custom benefit value editing, validation, ROI recalculation, and audit tracking

---

## Executive Summary

The Custom Values feature enables users to override default benefit valuations with personalized amounts based on their actual usage and perceived worth. This feature is critical for accurate financial tracking, as it allows users to recognize that a $300 travel credit may be worth only $200 to them if they don't use it fully.

**Primary Objectives:**
1. Provide an intuitive inline editing interface for benefit values
2. Enable real-time ROI recalculation across benefit, card, player, and household levels
3. Maintain comprehensive audit trail of all value changes
4. Support both individual and bulk value modifications
5. Deliver performant, accessible user experience on all devices

**Success Criteria:**
- Users can edit values with 1-click activation and auto-save
- ROI values update in real-time without page reload (< 100ms visible feedback)
- All value changes logged with timestamp, user, and changeHistory
- Support for 200+ benefits per household without performance degradation
- 95%+ test coverage with comprehensive edge case testing
- WCAG 2.1 AA accessibility compliance

---

## Functional Requirements

### Core Features

#### FR1: Inline Value Editing
- **Requirement:** Users can edit benefit values directly in list/card views
- **Behavior:**
  - Single click or hover activates edit mode
  - Input field shows current effective value (custom if set, else sticker)
  - Numeric input only (format: dollars.cents, stored in cents)
  - Auto-save on blur or Enter key press
  - Loading spinner indicates server request in progress
  - Success/error toast notifications
  - Value reverts on save error
- **Constraints:**
  - Non-negative values only
  - Max value: 999,999,999 cents ($9,999,999.99)
  - Input must be numeric (regex: `^\d+(\.\d{2})?$`)
  - Prevent zero-width input states

#### FR2: Value Comparison Display
- **Requirement:** Display both master (sticker) and custom values clearly
- **Display Elements:**
  - Sticker value: "$300 (master value)" - read-only
  - Custom value: "$250 (your value)" - editable
  - Difference: "-$50 (-16.67%)" - calculated
  - Active value indicator: "Using your value" or "Using master value"
  - Visual highlight when custom differs > 10% from sticker
- **Visual Feedback:**
  - Color coding: Green if custom < sticker (saving money), Red if custom > sticker (higher value)
  - Conditional styling for "significantly different" state
  - Accessible text for screen readers

#### FR3: Real-Time ROI Recalculation
- **Requirement:** When user changes a benefit value, ROI updates cascade across all levels
- **Calculation Levels:**
  
  ```
  Level 1: Benefit ROI
  ├─ Formula: (userDeclaredValue / annualFee) * 100
  ├─ Example: ($250 / $550) * 100 = 45.45%
  └─ Display: Next to benefit name
  
  Level 2: Card ROI
  ├─ Formula: (sum of all benefit userDeclaredValues / annual fee) * 100
  ├─ Example: (($250 + $400 + $100) / $550) * 100 = 145.45%
  └─ Display: Card summary card, dashboard card tile
  
  Level 3: Player ROI
  ├─ Formula: (sum of all benefit values across all cards / sum of all annual fees) * 100
  ├─ Example: (($750 + $900 + $600) / ($550 + $650 + $400)) * 100 = 112.31%
  └─ Display: Player stats panel, dashboard player row
  
  Level 4: Household ROI
  ├─ Formula: (sum of all player benefits / sum of all player annual fees) * 100
  ├─ Example: (($2,250 + $1,850) / ($1,600 + $1,350)) * 100 = 108.33%
  └─ Display: Dashboard summary, household overview
  ```

- **Update Strategy:**
  - Optimistic UI update (instant visual feedback)
  - Server confirms calculation and returns actual values
  - Revert on error without data loss
  - Cache ROI values with 5-minute TTL to prevent expensive recalculations
  - Invalidate cache on any benefit/card change

#### FR4: Input Validation
- **Real-Time Validation (Client-Side):**
  - Non-negative check: `value >= 0`
  - Numeric format validation: Allow integers and decimals to 2 places
  - Prevent negative numbers with input type="number"
  - Max value check: `value <= 999999999`
  
- **Warning Validation (Non-Blocking):**
  - Too low: `value < (stickerValue * 0.10)` → "This value seems very low compared to the master value"
  - Too high: `value > (stickerValue * 1.50)` → "This value seems very high compared to the master value"
  - Confirm dialog for unreasonable values: "Are you sure? This is {X}% of the master value"

- **Server-Side Validation (Blocking):**
  - Re-validate all constraints (authorization, value ranges)
  - Reject if benefit doesn't exist or is deleted
  - Reject if user lacks ownership
  - Reject if non-numeric or negative
  - Return specific error codes for different failure types

#### FR5: Value Presets
- **Quick Preset Buttons:**
  - "Use Master": Reset to stickerValue (100%)
  - "50%": Set to stickerValue * 0.5
  - "75%": Set to stickerValue * 0.75
  - "90%": Set to stickerValue * 0.9
  - "Custom...": Open detailed modal for manual input

- **Benefit-Type-Specific Presets:**
  - StatementCredit: Show percentage presets (50%, 75%, 90%, 100%)
  - UsagePerk: Show common usage presets (e.g., "Once a month", "Rarely used", "Never used")
  
- **Behavior:**
  - Clicking preset auto-saves immediately
  - Show loading spinner during save
  - Display ROI change preview before confirming

#### FR6: Change Audit Trail
- **Tracking Requirements:**
  - Record timestamp of every value change
  - Store original value and new value
  - Capture user ID of who made the change
  - Capture source: 'manual' | 'import' | 'system'
  - Optional change reason (user note)

- **Storage:**
  - `valueHistory` JSON array in UserBenefit table
  - Immutable append-only structure
  - Schema per entry:
    ```json
    {
      "value": 25000,
      "changedAt": "2024-04-02T15:30:00Z",
      "changedBy": "user_123",
      "source": "manual",
      "reason": "I don't use this credit"
    }
    ```

- **Display:**
  - Small history icon on benefit
  - Click opens popover showing last 10 changes
  - Timeline view with dates and values
  - "Revert" button to restore any previous value

#### FR7: Bulk Value Updates
- **Workflow:**
  1. User selects multiple benefits via checkboxes
  2. "Apply to selected" button appears
  3. Modal opens with selected benefits listed
  4. User enters value or selects preset
  5. Preview shows impact on each card's ROI
  6. User confirms or cancels
  7. All values updated atomically (all succeed or all fail)
  8. Dashboard updates automatically

- **Constraints:**
  - Validate all values before any save
  - Rollback on any validation failure
  - Show which benefits failed (if applicable)
  - Provide option to exclude failed benefits and retry
  - Batch database updates for performance

#### FR8: Reset/Clear Custom Value
- **Clear Button Behavior:**
  - One-click button to remove custom override
  - Revert to using stickerValue in calculations
  - Confirm dialog if value significantly different (> 10%)
  - Automatically recalculate ROI
  - Record in audit trail as "Reset to master"

#### FR9: Mobile-Friendly Editing
- **Touch Interactions:**
  - Input fields touch-friendly with adequate padding (min 44x44px)
  - Numeric keyboard triggered on mobile (input type="number")
  - Tap to edit (no hover state on mobile)
  - Swipe to reveal additional actions (if space constrained)
  - Preset buttons visible without horizontal scrolling

- **Responsive Design:**
  - Portrait orientation: Stacked layout
  - Landscape orientation: Compact layout
  - Max 2 columns on tablet
  - Single column on mobile

#### FR10: Accessibility
- **Keyboard Navigation:**
  - Tab through all interactive elements
  - Enter to activate edit mode
  - Escape to cancel edit
  - Arrow keys to navigate presets (if applicable)
  
- **Screen Reader Support:**
  - Descriptive labels for input fields
  - ARIA labels for icon buttons
  - Announce value changes to screen readers
  - Error messages linked to inputs via aria-describedby
  
- **Visual Indicators:**
  - Clear focus states (2px outline, contrasting color)
  - Color not the only indicator (use icons + color)
  - Sufficient contrast ratio (WCAG AA: 4.5:1 for text)
  - Loading states announced to screen readers

---

## Implementation Phases

### Phase 1: Core Editing Infrastructure (2-3 Days)
**Objectives:** Build foundational components and database updates

**Deliverables:**
- EditableValueField component with inline editing
- Input validation utility functions
- Database schema updates for valueHistory tracking
- BenefitValueComparison display component
- Basic server action for single value updates

**Estimated Scope:** 10-12 hours

**Dependencies:** None (independent phase)

### Phase 2: ROI Integration & Real-Time Updates (2-3 Days)
**Objectives:** Connect value changes to ROI calculation system

**Deliverables:**
- ROI calculation updates for all 4 levels (benefit, card, player, household)
- Cache layer with invalidation strategy
- Real-time dashboard updates via React Context
- Before/after ROI comparison display
- Performance optimization for large wallets

**Estimated Scope:** 12-14 hours

**Dependencies:** Phase 1 (requires editing components)

### Phase 3: Advanced Features & Workflows (2-3 Days)
**Objectives:** Add bulk updates, history, presets, and import integration

**Deliverables:**
- BenefitValuePresets component with quick-set buttons
- ValueHistoryPopover for timeline view and reverts
- BulkValueEditor multi-step workflow
- CSV import integration (support userDeclaredValue column)
- Revert-to-previous functionality

**Estimated Scope:** 12-14 hours

**Dependencies:** Phase 2 (requires ROI calculations)

### Phase 4: Testing & Polish (2-3 Days)
**Objectives:** Comprehensive testing, performance optimization, accessibility

**Deliverables:**
- Unit tests (validation, calculations, edge cases)
- Component and integration tests
- E2E tests (complete workflows)
- Accessibility testing and remediation
- Performance profiling and optimization
- Mobile device testing
- Documentation and deployment guide

**Estimated Scope:** 12-14 hours

**Dependencies:** Phase 3 (requires all features)

**Phase Timeline:**
```
Phase 1 ─────────┐
                 ├─→ Phase 2 ─────────┐
                                      ├─→ Phase 3 ─────────┐
                                                            ├─→ Phase 4
```

---

## Data Schema & State Management

### Database Schema Updates

#### UserBenefit Table Modifications

**Current Fields (No Changes):**
```prisma
id                String   @id @default(cuid())
userCardId        String   // FK to UserCard
playerId          String   // FK to Player
name              String   // Benefit name
type              String   // 'StatementCredit' | 'UsagePerk'
stickerValue      Int      // Original master value in cents
resetCadence      String   // 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
userDeclaredValue Int?     // Custom value in cents (ALREADY EXISTS)
isUsed            Boolean
timesUsed         Int
expirationDate    DateTime?
importedFrom      String?
importedAt        DateTime?
version           Int      // Optimistic locking
createdAt         DateTime
updatedAt         DateTime
claimedAt         DateTime?
```

**New Fields to Add:**
```prisma
// Value history tracking
valueHistory      String?           // JSON array of historical changes
valueUpdatedAt    DateTime?         // When userDeclaredValue last changed
valueUpdatedBy    String?           // User ID who made last change
```

**Migration Script:**
```sql
-- Add new columns for value history tracking
ALTER TABLE "UserBenefit" ADD COLUMN "valueHistory" TEXT;
ALTER TABLE "UserBenefit" ADD COLUMN "valueUpdatedAt" DATETIME;
ALTER TABLE "UserBenefit" ADD COLUMN "valueUpdatedBy" STRING;

-- Add indexes for performance
CREATE INDEX "UserBenefit_playerId_isUsed_expirationDate" 
  ON "UserBenefit" ("playerId", "isUsed", "expirationDate");
CREATE INDEX "UserBenefit_valueUpdatedAt" 
  ON "UserBenefit" ("valueUpdatedAt");
```

#### Derived Types (Application Layer)

```typescript
// Type: BenefitValueDisplay
interface BenefitValueDisplay {
  stickerValue: number;           // cents, read-only from master
  customValue: number | null;     // cents, user override (userDeclaredValue)
  effectiveValue: number;         // cents, value used in calculations
  differenceAmount: number;       // cents, custom - sticker
  differencPercent: number;       // 0-1, (custom - sticker) / sticker
  isDifferent: boolean;           // customValue !== null
  isSignificant: boolean;         // |differencPercent| > 0.10
}

// Type: BenefitValueChange
interface BenefitValueChange {
  id?: string;                    // Optional: change ID
  benefitId: string;              // FK to UserBenefit
  value: number;                  // cents, the new value
  changedAt: Date;                // ISO timestamp
  changedBy: string;              // User ID or 'system'
  source: 'manual' | 'import' | 'system'; // Where change came from
  reason?: string;                // Optional user-provided reason
}

// Type: ROISnapshot (for change preview)
interface ROISnapshot {
  benefitROI: number;             // Benefit ROI percentage
  cardROI: number;                // Card ROI percentage
  playerROI: number;              // Player ROI percentage
  householdROI: number;           // Household ROI percentage
  benefitValue: number;           // cents
  cardAnnualValue: number;        // cents
  playerAnnualValue: number;      // cents
}
```

### In-Memory State Management

#### Component State (EditableValueField)

```typescript
interface EditableValueFieldState {
  isEditing: boolean;             // Edit mode active?
  pendingValue: string;           // String input being typed
  isSaving: boolean;              // Server request in progress?
  validationError: string | null; // Inline validation error message
  saveError: string | null;       // Server error message
  lastSavedAt: Date | null;       // When last save completed
  previousValue: number | null;   // For reverting on error
}
```

#### Global State (React Context)

```typescript
interface BenefitValueContext {
  // Value state
  values: Map<string, number>;    // benefitId -> effective value (cents)
  
  // ROI state (cached)
  roiCache: Map<string, {
    value: number;                // ROI percentage
    level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD';
    cachedAt: Date;
  }>;
  
  // Operations
  updateValue: (benefitId: string, newValue: number) => Promise<void>;
  bulkUpdateValues: (updates: Array<{benefitId, value}>) => Promise<void>;
  invalidateROI: (level: string, ids: string[]) => Promise<void>;
  getROI: (level: string, id: string) => Promise<number>;
  
  // UI state
  isLoading: boolean;
  error: string | null;
}
```

---

## API Specifications

### Server Actions (Preferred Over REST)

All server actions follow the pattern:
```typescript
export async function actionName(
  params: ParameterType
): Promise<ActionResponse<ResultType>>

// Response envelope
interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
  timestamp: Date;
}
```

#### 1. Update Single Benefit Value

**Endpoint:** `src/actions/benefits.ts`

**Function Signature:**
```typescript
export async function updateUserDeclaredValue(
  benefitId: string,
  valueInCents: number,
  changeReason?: string
): Promise<ActionResponse<UpdateBenefitValueResult>>
```

**Request Parameters:**
```typescript
{
  benefitId: string;              // Required: Benefit ID (UUID format)
  valueInCents: number;           // Required: Value in cents (0-999999999)
  changeReason?: string;          // Optional: User-provided reason (max 255 chars)
}
```

**Validation Rules:**
```typescript
// Server-side validation (authoritative)
if (!benefitId || !isValidUUID(benefitId)) {
  throw new ValidationError('Invalid benefit ID format');
}
if (typeof valueInCents !== 'number' || valueInCents < 0) {
  throw new ValidationError('Value must be non-negative number');
}
if (!Number.isInteger(valueInCents) || valueInCents > 999999999) {
  throw new ValidationError('Value must be whole cents amount, max $9,999,999.99');
}

// Authorization check
const benefit = await db.userBenefit.findUnique({ where: { id: benefitId } });
const player = await db.player.findUnique({ where: { id: benefit.playerId } });
const user = await getCurrentUser();
if (player.userId !== user.id) {
  throw new AuthorizationError('Not authorized to modify this benefit');
}
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "benefit": {
      "id": "ben_123abc",
      "name": "Travel Credit",
      "stickerValue": 30000,
      "userDeclaredValue": 25000,
      "type": "StatementCredit",
      "expirationDate": "2024-12-31T23:59:59Z",
      "updatedAt": "2024-04-02T15:30:00Z"
    },
    "rois": {
      "benefit": 45.45,              // 25000 / 550 * 100
      "card": 145.45,                // Sum of benefits / fee * 100
      "player": 112.31,              // Total across cards / total fees * 100
      "household": 108.33            // Total for household / total fees * 100
    },
    "affectedCards": ["card_123"],
    "valueBefore": 30000,
    "valueAfter": 25000,
    "changeAmount": -5000,
    "changePercent": -16.67,
    "changedAt": "2024-04-02T15:30:00Z"
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Response Error: Invalid Input (400 Bad Request)**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "errorCode": "INVALID_VALUE_FORMAT",
  "message": "Value must be non-negative whole cents amount",
  "details": {
    "field": "valueInCents",
    "received": -50,
    "constraint": ">= 0"
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Response Error: Authorization (403 Forbidden)**
```json
{
  "success": false,
  "error": "AUTHORIZATION_FAILED",
  "errorCode": "NOT_OWNER",
  "message": "You do not have permission to modify this benefit",
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Response Error: Resource Not Found (404 Not Found)**
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "errorCode": "BENEFIT_DELETED",
  "message": "Benefit no longer exists or has been removed",
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Response Error: Server Error (500 Internal Server Error)**
```json
{
  "success": false,
  "error": "INTERNAL_ERROR",
  "errorCode": "ROI_CALCULATION_FAILED",
  "message": "Value saved but ROI recalculation failed. Please refresh.",
  "timestamp": "2024-04-02T15:30:00Z"
}
```

---

#### 2. Clear Custom Value

**Function Signature:**
```typescript
export async function clearUserDeclaredValue(
  benefitId: string
): Promise<ActionResponse<ClearValueResult>>
```

**Request Parameters:**
```typescript
{
  benefitId: string;              // Required: Benefit ID
}
```

**Response Success (200 OK):**
- Same structure as updateUserDeclaredValue
- `userDeclaredValue` set to `null`
- ROI values recalculated using stickerValue
- Change logged as source: "system", reason: "User reset to master value"

---

#### 3. Bulk Update Values

**Function Signature:**
```typescript
export async function bulkUpdateUserDeclaredValues(
  updates: Array<{
    benefitId: string;
    valueInCents: number;
  }>,
  cardId?: string
): Promise<ActionResponse<BulkUpdateResult>>
```

**Request Parameters:**
```typescript
{
  updates: [
    {
      benefitId: "ben_1",
      valueInCents: 25000
    },
    {
      benefitId: "ben_2",
      valueInCents: 15000
    }
  ],
  cardId: null  // Optional: limit to benefits on specific card
}
```

**Behavior:**
- Validate ALL values before ANY save (atomic operation)
- If ANY value is invalid, reject entire batch
- If ANY authorization fails, reject entire batch
- If ANY database error occurs, rollback all changes (transaction)

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "updated": 2,
    "failed": 0,
    "benefits": [
      {
        "id": "ben_1",
        "name": "Travel Credit",
        "valueBefore": 30000,
        "valueAfter": 25000
      },
      {
        "id": "ben_2",
        "name": "Dining Credit",
        "valueBefore": 20000,
        "valueAfter": 15000
      }
    ],
    "rois": {
      "card": 145.45,
      "player": 112.31,
      "household": 108.33
    },
    "affectedCards": ["card_123", "card_456"],
    "recalculatedAt": "2024-04-02T15:30:00Z"
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Response Error: Validation Failure (400 Bad Request)**
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "errorCode": "BULK_UPDATE_VALIDATION_FAILED",
  "message": "Some values failed validation",
  "details": {
    "failedUpdates": [
      {
        "benefitId": "ben_3",
        "error": "Value must be non-negative",
        "received": -100
      }
    ]
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

---

#### 4. Get Benefit Value History

**Function Signature:**
```typescript
export async function getBenefitValueHistory(
  benefitId: string,
  limit: number = 10
): Promise<ActionResponse<ValueHistoryResult>>
```

**Response Success (200 OK):**
```json
{
  "success": true,
  "data": {
    "benefitId": "ben_123",
    "current": {
      "value": 25000,
      "type": "custom",
      "changedAt": "2024-04-02T15:30:00Z"
    },
    "history": [
      {
        "value": 25000,
        "changedAt": "2024-04-02T15:30:00Z",
        "changedBy": "user_123",
        "source": "manual",
        "reason": "I don't use this credit much"
      },
      {
        "value": 30000,
        "changedAt": "2024-04-01T10:00:00Z",
        "changedBy": "system",
        "source": "import",
        "reason": "Bulk import from CSV"
      },
      {
        "value": 30000,
        "changedAt": "2024-03-15T12:00:00Z",
        "changedBy": "system",
        "source": "system",
        "reason": "Initial sticker value"
      }
    ],
    "totalChanges": 3
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

---

#### 5. Revert to Previous Value

**Function Signature:**
```typescript
export async function revertUserDeclaredValue(
  benefitId: string,
  historyIndex: number
): Promise<ActionResponse<UpdateBenefitValueResult>>
```

**Request Parameters:**
```typescript
{
  benefitId: string;              // Required: Benefit ID
  historyIndex: number;           // Required: Index in history array to restore (0-based)
}
```

**Behavior:**
- Fetch benefit with full valueHistory
- Validate historyIndex is within bounds
- Extract value at specified index
- Call updateUserDeclaredValue with that value
- Log as source: "system", reason: "Reverted to previous value"

**Response:** Same as updateUserDeclaredValue

---

### ROI Calculation Functions

These functions are server-side utilities used by actions to compute ROI values.

#### calculateBenefitROI

```typescript
function calculateBenefitROI(
  userDeclaredValue: number,      // cents
  annualCardFee: number           // cents
): number {                        // percentage (0-100)
  if (annualCardFee === 0) return 0;
  return (userDeclaredValue / annualCardFee) * 100;
}

// Example:
calculateBenefitROI(25000, 55000);  // 45.45%
```

#### calculateCardROI

```typescript
async function calculateCardROI(
  cardId: string
): Promise<number> {              // percentage (0-100)
  const card = await db.userCard.findUnique({
    where: { id: cardId },
    include: {
      benefits: {
        where: { isUsed: true }  // Only count claimed benefits in ROI
      }
    }
  });
  
  const totalBenefitValue = card.benefits.reduce((sum, benefit) => {
    return sum + (benefit.userDeclaredValue ?? benefit.stickerValue);
  }, 0);
  
  if (card.annualFee === 0) return 0;
  return (totalBenefitValue / card.annualFee) * 100;
}
```

#### calculatePlayerROI

```typescript
async function calculatePlayerROI(
  playerId: string
): Promise<number> {              // percentage (0-100)
  const player = await db.player.findUnique({
    where: { id: playerId },
    include: {
      cards: {
        include: {
          benefits: {
            where: { isUsed: true }
          }
        }
      }
    }
  });
  
  let totalValue = 0;
  let totalFees = 0;
  
  for (const card of player.cards) {
    totalFees += card.annualFee;
    for (const benefit of card.benefits) {
      totalValue += (benefit.userDeclaredValue ?? benefit.stickerValue);
    }
  }
  
  if (totalFees === 0) return 0;
  return (totalValue / totalFees) * 100;
}
```

#### calculateHouseholdROI

```typescript
async function calculateHouseholdROI(
  householdId: string
): Promise<number> {              // percentage (0-100)
  const players = await db.player.findMany({
    where: { householdId },
    include: {
      cards: {
        include: {
          benefits: {
            where: { isUsed: true }
          }
        }
      }
    }
  });
  
  let totalValue = 0;
  let totalFees = 0;
  
  for (const player of players) {
    for (const card of player.cards) {
      totalFees += card.annualFee;
      for (const benefit of card.benefits) {
        totalValue += (benefit.userDeclaredValue ?? benefit.stickerValue);
      }
    }
  }
  
  if (totalFees === 0) return 0;
  return (totalValue / totalFees) * 100;
}
```

---

### ROI Cache Management

**Cache Strategy:**
- TTL: 5 minutes (300,000 ms)
- Entry format: `{value: number, level: string, cachedAt: Date}`
- Key format: `${level}:${id}` (e.g., `CARD:card_123`)

**Cache Invalidation Triggers:**

| Trigger | Cache Keys to Invalidate |
|---------|--------------------------|
| Benefit value changed | BENEFIT:{id}, CARD:{cardId}, PLAYER:{playerId}, HOUSEHOLD:{householdId} |
| Benefit claimed/unclaimed | BENEFIT:{id}, CARD:{cardId}, PLAYER:{playerId}, HOUSEHOLD:{householdId} |
| Card annual fee changed | CARD:{id}, PLAYER:{playerId}, HOUSEHOLD:{householdId} |
| Benefit added/removed | CARD:{cardId}, PLAYER:{playerId}, HOUSEHOLD:{householdId} |
| Card added/removed | PLAYER:{playerId}, HOUSEHOLD:{householdId} |
| Player joined/left | HOUSEHOLD:{householdId} |

**Cache Implementation:**
```typescript
const roiCache = new Map<string, {
  value: number;
  level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD';
  cachedAt: Date;
}>();

const CACHE_TTL_MS = 5 * 60 * 1000;

async function getROI(
  level: string,
  id: string,
  options?: { bypassCache?: boolean }
): Promise<number> {
  const cacheKey = `${level}:${id}`;
  const cached = roiCache.get(cacheKey);
  
  if (!options?.bypassCache && cached) {
    const age = Date.now() - cached.cachedAt.getTime();
    if (age < CACHE_TTL_MS) {
      return cached.value;  // Cache hit
    }
  }
  
  // Cache miss or bypass: recalculate
  let value: number;
  switch (level) {
    case 'BENEFIT':
      value = calculateBenefitROI(...);
      break;
    case 'CARD':
      value = await calculateCardROI(id);
      break;
    case 'PLAYER':
      value = await calculatePlayerROI(id);
      break;
    case 'HOUSEHOLD':
      value = await calculateHouseholdROI(id);
      break;
  }
  
  roiCache.set(cacheKey, { value, level: level as any, cachedAt: new Date() });
  return value;
}

function invalidateROICache(affectedKeys: string[]): void {
  for (const key of affectedKeys) {
    roiCache.delete(key);
  }
}
```

---

## User Flows & Workflows

### Flow 1: Single Benefit Value Edit (Happy Path)

```
1. USER VIEWS BENEFIT
   ├─ Benefit card/row displays:
   │  ├─ Name: "Travel Credit"
   │  ├─ Sticker: "$300 (master value)"
   │  ├─ Custom: "$300 (using master)" [Edit button]
   │  ├─ Card ROI: "45%"
   │  └─ Expandable details
   
2. USER CLICKS EDIT BUTTON
   ├─ Edit mode activates
   ├─ Input field appears with "$300"
   ├─ Field focused, text selected
   ├─ Show hint: "Type new value or use presets"
   ├─ Preset buttons visible: [50%] [75%] [90%] [Use Master]
   
3. USER TYPES NEW VALUE
   ├─ Types: "250"
   ├─ Input validates: ✓ (non-negative, numeric, under max)
   ├─ Tooltip shows: "New value: $250"
   ├─ Estimated ROI impact shows: "Card ROI: 45% → 42%"
   ├─ No errors shown (valid input)
   
4. USER PRESSES ENTER OR CLICKS AWAY
   ├─ Final validation runs: ✓
   ├─ Spinner appears: "Saving..."
   ├─ Server action called: updateUserDeclaredValue('ben_123', 25000)
   
5. SERVER PROCESSES
   ├─ ✓ Validates authorization (user owns benefit)
   ├─ ✓ Validates value (non-negative, integer, < max)
   ├─ ✓ Updates UserBenefit.userDeclaredValue = 25000
   ├─ ✓ Records in valueHistory array
   ├─ ✓ Invalidates ROI cache
   ├─ ✓ Recalculates: card, player, household ROI
   ├─ ✓ Returns updated benefit + ROI values
   
6. UI UPDATES OPTIMISTICALLY
   ├─ Value shows: "$250 (your value)"
   ├─ Card ROI updates: "45%" → "42%"
   ├─ Edit mode closes
   ├─ Spinner vanishes
   ├─ Success toast: "✓ Value updated"
   
7. DASHBOARD SYNCS
   ├─ React Context notifies all subscribers
   ├─ Player stats update: "Your ROI: 45%" → "Your ROI: 42%"
   ├─ Household summary updates (if multi-player)
   ├─ No page reload required
   
8. USER CONTINUES
   ├─ Can edit another benefit
   ├─ Can navigate to other pages
   ├─ Changes persist across page visits
```

**Timing Targets:**
- Edit activation: < 50ms (instant)
- Input validation: < 10ms (every keystroke)
- Spinner display: After 200ms if still saving (debounced)
- Total save: < 500ms (optimistic update shows sooner)

---

### Flow 2: Preset Selection

```
1. USER SEES PRESET BUTTONS
   ├─ Buttons visible: [50%] [75%] [90%] [Use Master]
   ├─ Current value highlighted if matches
   
2. USER CLICKS "75%" BUTTON
   ├─ System calculates: $300 × 0.75 = $225
   ├─ Spinner shows: "Saving..."
   ├─ Server called: updateUserDeclaredValue('ben_123', 22500)
   
3. VALUE UPDATES
   ├─ Display: "$225 (your value)"
   ├─ Button "75%" highlighted (current selection)
   ├─ ROI recalculated and displayed
   ├─ Success toast shown
   
4. ALTERNATIVE: USER CLICKS "Use Master"
   ├─ System calls: clearUserDeclaredValue('ben_123')
   ├─ Display: "$300 (master value)"
   ├─ ROI returns to default calculation
   ├─ Custom value removed from database
```

---

### Flow 3: Bulk Update Multiple Benefits

```
1. USER SELECTS MULTIPLE BENEFITS
   ├─ Checkboxes visible on each benefit card/row
   ├─ User clicks checkboxes for 3 benefits
   ├─ "3 selected" indicator shown
   ├─ "Apply to selected" button appears
   
2. USER CLICKS "APPLY TO SELECTED"
   ├─ Modal opens with workflow
   
3. STEP 1: REVIEW SELECTED
   ├─ Modal shows 3 benefits:
   │  ├─ Chase Travel: $300
   │  ├─ AmEx Travel: $250
   │  └─ AmEx Dining: $100
   ├─ Total impact shown
   ├─ "Next" button
   
4. STEP 2: CHOOSE VALUE OPTION
   ├─ Radio buttons:
   │  ├─ "Set percentage of master" (50%, 75%, 90%)
   │  ├─ "Set fixed amount ($)" 
   │  └─ "Use preset template"
   ├─ User selects "Set percentage" → "75%"
   
5. STEP 3: PREVIEW IMPACT
   ├─ Shows calculation for each benefit:
   │  ├─ Chase: $300 → $225 (ROI: 45% → 43%)
   │  ├─ AmEx: $250 → $187.50 (ROI: 42% → 38%)
   │  └─ AmEx: $100 → $75 (ROI: 30% → 25%)
   ├─ Total card impact shown
   ├─ "Confirm" or "Back" button
   
6. USER CONFIRMS
   ├─ Spinner: "Updating 3 benefits..."
   ├─ Server action: bulkUpdateUserDeclaredValues([{ben1, 22500}, ...])
   
7. SERVER PROCESSES
   ├─ ✓ Validates all 3 values
   ├─ ✓ All succeed or all fail (atomic)
   ├─ ✓ Updates all 3 benefits
   ├─ ✓ Invalidates affected card/player/household ROI
   ├─ ✓ Returns results
   
8. UI UPDATES
   ├─ All 3 benefits show new values
   ├─ Card ROI updated
   ├─ Modal closes
   ├─ Toast: "✓ Updated 3 benefits"
   ├─ Dashboard refreshes
   
9. USER CONTINUES
   ├─ Can perform another bulk edit
   ├─ Can undo by reverting individual values (if needed)
```

---

### Flow 4: Error Path - Invalid Input

```
SCENARIO: User types unreasonable value

1. USER TYPES "999999"
   ├─ System calculates: $9,999.99 (way above $300 sticker)
   ├─ Difference: $9,699.99 (3,233% increase)
   ├─ Non-blocking warning: "Value seems very high (3,233% of master)"
   ├─ Input still shows value (not blocked)
   
2. USER PRESSES ENTER
   ├─ Confirmation dialog appears:
   │  ├─ "This value is 3,233% of the master value."
   │  ├─ "Master: $300 → Your value: $9,999.99"
   │  ├─ Buttons: [Cancel] [Yes, I'm Sure]
   ├─ User can review and confirm or cancel
   
3. USER CLICKS "CANCEL"
   ├─ Dialog closes
   ├─ Input reverts to previous value
   ├─ Edit mode stays active (user can try again)
   
4. ALTERNATIVE: USER TYPES "-50"
   ├─ Validation error: "Value cannot be negative"
   ├─ Input shows error inline
   ├─ Save button disabled
   ├─ User must fix before saving
   
5. ALTERNATIVE: USER TYPES "abc"
   ├─ Input type="number" prevents non-numeric input
   ├─ If user somehow pastes text, validation catches it
   ├─ Error message: "Please enter a valid dollar amount"
```

---

### Flow 5: Error Path - Network Timeout

```
1. USER EDITS VALUE
   ├─ Clicks away to save
   ├─ Spinner shows: "Saving..."
   
2. NETWORK TIMEOUT (after 5 seconds)
   ├─ Server request times out
   ├─ Spinner disappears
   ├─ Error toast: "Failed to save. Network timeout. Try again?"
   ├─ Edit mode closes (prevents editing state)
   ├─ Value reverts to previous state
   
3. USER CLICKS RETRY
   ├─ Clicking edit again shows previous value
   ├─ Can attempt save again
   ├─ Retry succeeds this time
   
4. IF PERSISTENT ERROR
   ├─ After 3 retries, show: "Contact support if problem persists"
   ├─ Log error to monitoring system
   ├─ Allow user to continue with other features
```

---

### Flow 6: History View & Revert

```
1. USER CLICKS HISTORY ICON
   ├─ Small popover appears with timeline
   ├─ Shows:
   │  ├─ Apr 2, 3:30 PM: $250 (Manual change)
   │  │  └─ Reason: "I don't use this much"
   │  ├─ Apr 1, 10 AM: $300 (Bulk import)
   │  └─ Mar 15, 12 PM: $300 (Initial)
   
2. USER HOVERS OVER HISTORY ENTRY
   ├─ Tooltip shows: "Apr 2, 3:30 PM by you"
   
3. USER CLICKS "REVERT" ON "APR 1" ENTRY
   ├─ Confirmation: "Revert to $300 (Apr 1, 10:00 AM)?"
   ├─ User confirms
   ├─ Server called: revertUserDeclaredValue('ben_123', 1)
   ├─ Value updates to $300
   ├─ New entry added to history: "Reverted to previous value"
   ├─ Popover closes
   ├─ Value displayed as "$300 (your value)"
   
4. HISTORY PRESERVED
   ├─ Old change still in history (append-only)
   ├─ New change logged with timestamp
   ├─ Complete audit trail maintained
```

---

## Edge Cases & Error Handling

### Edge Case 1: Sticker Value Updates After Custom Set
**Scenario:** User sets custom value to $200. Later, master catalog updates sticker from $300 to $350.

**Expected Behavior:**
- Custom value persists at $200 (user's explicit preference)
- Comparison updates: "Master: $350 (changed from $300), Your value: $200"
- ROI percentages recalculate with new baseline
- Visual indicator: Still shows custom is different
- User can accept new sticker or keep custom
- Audit trail shows sticker value change separately

**Implementation:**
```typescript
// When master value changes, don't auto-update custom value
const benefit = await db.userBenefit.findUnique({...});
// benefit.userDeclaredValue stays the same
// benefit.stickerValue updates (from master)
// comparison recalculates automatically
```

**Testing:**
- [ ] Update master value while custom set
- [ ] Verify custom persists
- [ ] Verify ROI recalculates
- [ ] Verify display shows new comparison

---

### Edge Case 2: Zero Value Override
**Scenario:** User sets benefit value to $0 (doesn't use benefit)

**Expected Behavior:**
- Accept zero as valid value (user explicitly states: "worth nothing to me")
- Benefit contributes $0 to ROI calculations
- Display: "Your value: $0"
- Warning optional: "This benefit won't contribute to ROI"
- ROI recalculated excluding benefit value
- Can be edited back to sticker or another value anytime

**Implementation:**
```typescript
// Zero is valid input
if (valueInCents < 0) throw ValidationError('Must be non-negative');
// valueInCents === 0 is OK

// In ROI calculation
const effectiveValue = benefit.userDeclaredValue ?? benefit.stickerValue;
// If userDeclaredValue is 0, effectiveValue is 0
```

**Testing:**
- [ ] Save zero value
- [ ] Verify ROI excludes that benefit
- [ ] Verify card/player/household ROI updates
- [ ] Verify display shows $0
- [ ] Verify can edit away from $0

---

### Edge Case 3: Extreme Value Inputs
**Scenario:** User types "999999999" or "0.01"

**Expected Behavior:**
- Accept any integer value in range [0, 999999999]
- Reject decimals (only cents, integers)
- Warn if > 150% or < 10% of sticker (non-blocking)
- Require confirmation for values > 150% of sticker
- Smallest unit is 1 cent (no fractional cents)

**Implementation:**
```typescript
const MAX_SAFE_VALUE = 999999999;  // $9,999,999.99

if (valueInCents < 0 || valueInCents > MAX_SAFE_VALUE) {
  throw ValidationError('Value must be between $0 and $9,999,999.99');
}

if (!Number.isInteger(valueInCents)) {
  throw ValidationError('Value must be whole cents (no fractions)');
}

// Warning thresholds
const percentOfSticker = (valueInCents / stickerValue) * 100;
if (percentOfSticker < 10) {
  warnUser('Value is less than 10% of master value');
}
if (percentOfSticker > 150) {
  warnUser('Value is more than 150% of master value');
  requireConfirmation = true;
}
```

**Testing:**
- [ ] Boundary values: 0, 1, 999999998, 999999999
- [ ] Values > 150%: require confirmation
- [ ] Values < 10%: show warning but allow
- [ ] Decimal values: rejected
- [ ] Negative values: rejected
- [ ] Very large numbers: handled correctly

---

### Edge Case 4: Rapid Successive Edits
**Scenario:** User quickly changes value 5 times in 2 seconds

**Expected Behavior:**
- Debounce auto-save: wait 500ms after last keystroke
- Show "saving..." indicator only if still saving after 200ms
- Queue updates if save in progress (only process latest)
- Prevent race conditions: last save wins
- No duplicate entries in valueHistory
- UI shows optimistic update instantly

**Implementation:**
```typescript
let saveTimeout: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 500;
const SHOW_SPINNER_MS = 200;

function onValueChange(newValue: string) {
  // Clear previous timeout
  if (saveTimeout) clearTimeout(saveTimeout);
  
  // Show optimistic update immediately
  setPendingValue(newValue);
  
  // Debounce actual save
  let spinnerTimeout: NodeJS.Timeout;
  spinnerTimeout = setTimeout(() => {
    setIsSaving(false);  // Hide spinner if save completes
  }, SHOW_SPINNER_MS);
  
  saveTimeout = setTimeout(async () => {
    setIsSaving(true);
    try {
      const result = await updateUserDeclaredValue(benefitId, parseInt(newValue));
      setDisplayValue(result.data.benefit.userDeclaredValue);
      setIsSaving(false);
    } catch (err) {
      setError(err.message);
      setIsSaving(false);
    }
  }, DEBOUNCE_MS);
}
```

**Testing:**
- [ ] Rapid keystrokes don't trigger multiple saves
- [ ] Only last value is saved
- [ ] Spinner appears after 200ms delay
- [ ] History shows single entry (not 5 entries)
- [ ] No race conditions (last update wins)

---

### Edge Case 5: Network Timeout During Save
**Scenario:** Save request hangs for 10+ seconds

**Expected Behavior:**
- Timeout after 5 seconds
- Show error: "Network timeout. Please try again."
- Revert to previous value in UI
- Allow retry without data loss
- Offline mode indicator if needed
- Log error for debugging

**Implementation:**
```typescript
const SAVE_TIMEOUT_MS = 5000;

async function performSave(benefitId: string, value: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
  
  try {
    const result = await updateUserDeclaredValue(benefitId, value, {
      signal: controller.signal
    });
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new TimeoutError('Request timed out after 5 seconds');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Testing:**
- [ ] Simulate network timeout
- [ ] Verify error message shown
- [ ] Verify retry button available
- [ ] Verify value reverts on timeout
- [ ] Verify can retry successfully after
- [ ] Verify no duplicate updates on retry

---

### Edge Case 6: Benefit Deleted While Editing
**Scenario:** User edits value. Benefit is deleted (soft delete) by admin or player removes card.

**Expected Behavior:**
- Server returns 404: "Benefit not found"
- UI shows: "This benefit is no longer available"
- Edit mode closes
- Benefit removed from list
- No orphaned state in UI
- User can continue editing other benefits

**Implementation:**
```typescript
async function updateUserDeclaredValue(benefitId: string, value: number) {
  const benefit = await db.userBenefit.findUnique({
    where: { id: benefitId }
  });
  
  if (!benefit) {
    throw new NotFoundError('BENEFIT_DELETED', 'Benefit no longer exists');
  }
  
  if (benefit.deletedAt) {  // Soft delete check
    throw new NotFoundError('BENEFIT_DELETED', 'Benefit has been deleted');
  }
  
  // Continue with update...
}
```

**Testing:**
- [ ] Delete benefit during edit
- [ ] Verify 404 returned
- [ ] Verify error message shown
- [ ] Verify edit mode closes
- [ ] Verify list updates
- [ ] Verify no frozen state

---

### Edge Case 7: Authorization Error (Session Expired)
**Scenario:** User logs out then logs back in. Session invalid. Attempt to save.

**Expected Behavior:**
- Server returns 401: "Unauthorized"
- UI shows: "Your session expired. Please log in again."
- Clear pending edits
- Redirect to login page
- No partial updates
- User can log back in and continue

**Implementation:**
```typescript
async function updateUserDeclaredValue(benefitId: string, value: number) {
  const user = await getCurrentUser();  // Returns null if session invalid
  
  if (!user) {
    throw new UnauthorizedError('SESSION_EXPIRED', 'Please log in again');
  }
  
  // Continue with ownership verification...
}
```

**Testing:**
- [ ] Expire session during edit
- [ ] Verify 401 returned
- [ ] Verify redirect to login
- [ ] Verify edit mode closes
- [ ] Verify no data loss
- [ ] Verify can log back in and retry

---

### Edge Case 8: Concurrent Edit by Another Session
**Scenario:** User edits benefit. Another browser tab also edits same benefit. First save wins.

**Expected Behavior:**
- First save succeeds
- Second save detects conflict (compare version number)
- UI shows: "This benefit was modified elsewhere. Refreshing..."
- Load latest value from server
- Show new value to user
- Allow user to edit again if desired

**Implementation:**
```typescript
// In database schema (already exists)
version Int @default(1)

// In update logic
const benefit = await db.userBenefit.update({
  where: { 
    id: benefitId,
    version: expectedVersion  // Optimistic locking
  },
  data: {
    userDeclaredValue: valueInCents,
    version: { increment: 1 }
  }
});

// If update returns null (WHERE clause failed), version mismatch
if (!benefit) {
  throw new ConflictError('Benefit was modified elsewhere');
}
```

**Testing:**
- [ ] Edit in two tabs simultaneously
- [ ] Verify first save succeeds
- [ ] Verify second save detects conflict
- [ ] Verify user sees "modified elsewhere" message
- [ ] Verify can retry after refresh
- [ ] Verify data consistent (no duplicates)

---

### Edge Case 9: Bulk Edit with Mixed Validations
**Scenario:** User bulk edits 5 benefits. 2 have invalid new values (negative, too large).

**Expected Behavior:**
- Validate all values before any save (atomic operation)
- Report which benefits have errors
- Block save until all errors fixed
- Show each error individually
- Allow user to fix and retry
- If any fails: all succeed or all fail (no partial updates)

**Implementation:**
```typescript
async function bulkUpdateUserDeclaredValues(updates: Array<{...}>) {
  const errors: Array<{benefitId, error}> = [];
  
  // Validate all first
  for (const update of updates) {
    if (update.valueInCents < 0) {
      errors.push({benefitId: update.benefitId, error: 'Must be non-negative'});
    }
    if (update.valueInCents > 999999999) {
      errors.push({benefitId: update.benefitId, error: 'Exceeds maximum'});
    }
  }
  
  // If any errors, reject entire batch
  if (errors.length > 0) {
    throw new ValidationError('BULK_VALIDATION_FAILED', errors);
  }
  
  // All valid: update all atomically
  // Use transaction to ensure all-or-nothing
  try {
    const results = await db.$transaction(
      updates.map(u => 
        db.userBenefit.update({
          where: { id: u.benefitId },
          data: { userDeclaredValue: u.valueInCents }
        })
      )
    );
    return results;
  } catch (err) {
    // Rollback all changes
    throw err;
  }
}
```

**Testing:**
- [ ] Bulk edit with some invalid values
- [ ] Verify validation runs for all
- [ ] Verify error list returned
- [ ] Verify no values updated (atomic)
- [ ] Verify user can fix and retry
- [ ] Verify all succeed on retry

---

### Edge Case 10: ROI Calculation Error
**Scenario:** Save succeeds on server. ROI recalculation fails (edge case in calculations)

**Expected Behavior:**
- Value saves to database (primary goal met)
- Return: "Value saved, but ROI calculation failed. Refresh to sync."
- UI shows value as updated (not reverted)
- Allow manual refresh to sync ROI
- Log error for debugging
- User can continue and refresh later

**Implementation:**
```typescript
async function updateUserDeclaredValue(benefitId: string, value: number) {
  // Save value first (critical)
  const benefit = await db.userBenefit.update({...});
  
  // Calculate ROI (best effort)
  try {
    const updatedROIs = {
      benefit: calculateBenefitROI(...),
      card: await calculateCardROI(...),
      player: await calculatePlayerROI(...),
      household: await calculateHouseholdROI(...)
    };
    
    return { success: true, benefit, rois: updatedROIs };
  } catch (calcError) {
    // Value saved, ROI failed
    logger.error('ROI calculation failed after value save', calcError);
    return { 
      success: true,  // Value save succeeded
      benefit,
      rois: null,     // ROI unavailable
      warning: 'Value saved. ROI calculation failed. Refresh to sync.',
      calcError: calcError.message
    };
  }
}
```

**Testing:**
- [ ] Simulate ROI calculation error
- [ ] Verify value saves despite error
- [ ] Verify warning shown to user
- [ ] Verify value persisted in database
- [ ] Verify manual refresh syncs ROI
- [ ] Verify no data loss

---

### Edge Case 11: Editing Claimed Benefit
**Scenario:** User claimed benefit (isUsed=true). Later edits value.

**Expected Behavior:**
- Allow editing claimed benefits (value still affects ROI)
- Update calculation to reflect new claimed value
- Show benefit is claimed in UI
- Claimed benefits included in ROI (not excluded)
- Can unclaim anytime (resets contribution)

**Implementation:**
```typescript
// When calculating card ROI, include all benefits with isUsed=true
const benefits = await db.userBenefit.findMany({
  where: { 
    userCardId: cardId,
    isUsed: true  // Only claimed benefits count toward ROI
  }
});
```

**Testing:**
- [ ] Edit value of claimed benefit
- [ ] Verify ROI includes claimed benefit
- [ ] Verify unclaiming updates ROI
- [ ] Verify UI shows claimed status
- [ ] Verify value persists after unclaiming

---

### Edge Case 12: Value Override with Importing
**Scenario:** User imports CSV with custom values. Then manually edits some. Conflicts in history.

**Expected Behavior:**
- Import sets userDeclaredValue
- Manual edit overrides import value
- Both stored in valueHistory with source annotation
- Can revert to any previous value (import or manual)
- Latest value shown as "current"
- Full history preserved

**Implementation:**
```typescript
// valueHistory schema
interface ValueHistoryEntry {
  value: number;
  changedAt: Date;
  changedBy: string;        // user ID or 'system'
  source: 'manual' | 'import' | 'system';
  reason?: string;
  importJobId?: string;     // If source='import'
}

// When editing
const newEntry: ValueHistoryEntry = {
  value: newValue,
  changedAt: new Date(),
  changedBy: currentUserId,
  source: 'manual',
  reason: changeReason
};

const history = JSON.parse(benefit.valueHistory || '[]');
history.push(newEntry);
benefit.valueHistory = JSON.stringify(history);
```

**Testing:**
- [ ] Import CSV with custom values
- [ ] Edit imported value manually
- [ ] Verify history shows both entries
- [ ] Verify can revert to import value
- [ ] Verify latest value displayed
- [ ] Verify source annotations correct

---

### Edge Case 13: Batch Update Partial Failure
**Scenario:** Bulk update 10 benefits. Database constraint violation on benefit #5.

**Expected Behavior:**
- Transaction rollback (no partial updates)
- Response: "Failed to update due to constraint error"
- Show which benefit caused issue (benefit #5)
- Return to edit without losing input
- Allow user to exclude problematic benefit and retry
- No data corruption

**Implementation:**
```typescript
try {
  const results = await db.$transaction(
    updates.map(u => 
      db.userBenefit.update({
        where: { id: u.benefitId },
        data: { userDeclaredValue: u.valueInCents }
      })
    ),
    { isolationLevel: 'Serializable' }  // Strongest isolation
  );
} catch (err) {
  // Entire transaction rolled back
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {  // Record not found
      throw new ValidationError('One or more benefits no longer exist');
    }
  }
  throw err;
}
```

**Testing:**
- [ ] Simulate constraint violation during bulk update
- [ ] Verify rollback occurs
- [ ] Verify no partial updates
- [ ] Verify error message clear
- [ ] Verify can exclude bad record and retry
- [ ] Verify database consistent

---

### Edge Case 14: Custom Value for Expired Benefit
**Scenario:** User edits value for benefit that expired (expirationDate < now)

**Expected Behavior:**
- Allow editing (value change is still valid)
- Show warning: "This benefit expired on {date}"
- Note: "Won't contribute to current period ROI"
- Include in calculations but flag as inactive
- Track for historical ROI tracking
- Can reactivate if benefit reset

**Implementation:**
```typescript
// When calculating current ROI, exclude expired benefits
const activeDate = new Date();
const benefits = await db.userBenefit.findMany({
  where: {
    userCardId: cardId,
    isUsed: true,
    expirationDate: { gt: activeDate }  // Not expired
  }
});

// For historical ROI, include expired but tracked separately
const expiredBenefits = await db.userBenefit.findMany({
  where: {
    userCardId: cardId,
    isUsed: true,
    expirationDate: { lte: activeDate }  // Expired
  }
});
```

**Testing:**
- [ ] Edit expired benefit value
- [ ] Verify warning shown
- [ ] Verify value saves
- [ ] Verify excluded from current ROI
- [ ] Verify included in history
- [ ] Verify can still be edited

---

### Edge Case 15: Memory/Performance with Large Wallet
**Scenario:** Wallet has 200+ benefits. Edit one value. Recalculation affects all ROI values.

**Expected Behavior:**
- Calculate efficiently (< 100ms for single benefit, < 500ms for card)
- Memoize intermediate calculations
- Update only affected components
- Show loading state if calculation > 500ms
- Batch UI updates (not re-render 200 times)
- No browser freezing

**Implementation:**
```typescript
// Memoized calculation
const memoizedCardROI = useMemo(() => {
  const totalValue = benefits.reduce((sum, b) => 
    sum + (b.userDeclaredValue ?? b.stickerValue), 0
  );
  return (totalValue / annualFee) * 100;
}, [benefits, annualFee]);

// Batch updates
const updateBatch = useCallback((updates: Array<{id, value}>) => {
  setRoiValues(prev => ({
    ...prev,
    ...Object.fromEntries(updates.map(u => [u.id, u.value]))
  }));
}, []);

// Loading state with threshold
const [isRecalculating, setIsRecalculating] = useState(false);
const recalcStartTime = useRef(null);

useEffect(() => {
  const elapsed = Date.now() - recalcStartTime.current;
  if (elapsed > 500) {
    setIsRecalculating(true);
  }
}, []);
```

**Testing:**
- [ ] Create wallet with 200+ benefits
- [ ] Edit one benefit value
- [ ] Measure calculation time (< 500ms)
- [ ] Verify no browser freeze
- [ ] Verify loading indicator appears if slow
- [ ] Verify all ROI values update correctly
- [ ] Verify memory usage reasonable

---

## Component Architecture

### UI Components

#### 1. EditableValueField Component

```typescript
interface EditableValueFieldProps {
  benefitId: string;
  stickerValue: number;           // in cents
  currentValue: number | null;    // in cents (custom value if set)
  onSave: (valueInCents: number) => Promise<void>;
  onError?: (error: string) => void;
  disabled?: boolean;
  showPresets?: boolean;
  presetOptions?: PresetOption[];
}

interface EditableValueFieldState {
  isEditing: boolean;
  pendingValue: string;
  isSaving: boolean;
  validationError: string | null;
  saveError: string | null;
  lastSavedValue: number | null;
}

// Component Behavior
- Display: Shows effective value with $ formatting
- Click: Activates edit mode (input field appears)
- Input: Validates on keystroke (non-negative, numeric, < max)
- Blur/Enter: Triggers save (debounced 500ms)
- Error: Shows inline error message (if validation fails)
- Loading: Shows spinner while saving
- Success: Closes edit mode, shows toast
- Failure: Reverts to previous value, shows error toast

// Accessibility
- aria-label: "Edit {benefit name} value"
- aria-describedby: Links to error message
- Keyboard: Tab to field, Enter to save, Escape to cancel
- Screen reader: Announces state changes ("Saving value..." etc)
```

#### 2. BenefitValueComparison Component

```typescript
interface BenefitValueComparisonProps {
  benefitName: string;
  stickerValue: number;           // cents
  customValue: number | null;     // cents
  effectiveValue: number;         // cents (custom or sticker)
  benefitROI: number;             // percentage
  cardROI: number;                // percentage
  previousCardROI?: number;       // For showing change
  showHistory?: boolean;
}

// Display
- Side-by-side comparison
  - Sticker: "$300 (master value)"
  - Custom: "$250 (your value)" or "(not set)"
  - Difference: "-$50 (-16.67%)"
- ROI impact
  - Benefit ROI: "45.45%"
  - Card ROI: "48%" (↑2% from your custom)
  - Annual value: "$4,500"
- History button (if enabled)
  - Opens popover with timeline
  - Shows previous values and dates
```

#### 3. BenefitValuePresets Component

```typescript
interface BenefitValuePresetsProps {
  stickerValue: number;           // cents
  currentValue: number | null;    // cents
  onSelect: (valueInCents: number) => Promise<void>;
  presetOptions?: number[];       // Custom preset percentages
  benefitType?: 'StatementCredit' | 'UsagePerk';
  isLoading?: boolean;
}

// Behavior
- Buttons: [Use Master] [50%] [75%] [90%] [Custom...]
- Click: Selects preset, auto-saves
- Highlight: Current selection shown with border/background
- Mobile: Buttons stack vertically if space constrained
- Loading: Spinner shows while saving
- Accessibility: Each button has clear label
```

#### 4. ValueHistoryPopover Component

```typescript
interface ValueHistoryPopoverProps {
  benefitId: string;
  history: BenefitValueChange[];
  currentValue: number | null;
  onRevert: (historyIndex: number) => Promise<void>;
}

// Display
- Timeline of changes
  - Apr 2, 3:30 PM: $250 (Manual change)
  - Apr 1, 10:00 AM: $300 (Imported)
  - Mar 15, 12:00 PM: $300 (Initial)
- For each entry
  - Value and date
  - Who/what made change
  - Optional reason
  - Revert button
- Preview: Show impact if reverting
```

#### 5. BulkValueEditor Component

```typescript
interface BulkValueEditorProps {
  selectedBenefits: Array<{
    id: string;
    name: string;
    stickerValue: number;
    currentValue: number | null;
  }>;
  onApply: (valueInCents: number) => Promise<void>;
  onCancel: () => void;
}

// Workflow (Multi-step)
Step 1: Review Selected
- List of selected benefits
- Total count
- "Next" button

Step 2: Choose Value Option
- Radio buttons for different approaches
  - "Apply percentage of sticker"
  - "Set fixed amount"
  - "Use preset templates"
- Input field based on selection
- Preview updates live

Step 3: Preview Changes
- Shows each benefit: before → after ROI
- Card ROI change summary
- "Confirm" or "Back" button

Step 4: Apply
- Spinner: "Updating {N} benefits..."
- Success: Toast, list updates, modal closes
- Error: Shows error message, allows retry
```

### Integration Points

#### With Existing ROI Calculation System
```typescript
// File: src/lib/calculations.ts (extend existing)

export function calculateBenefitROI(
  userDeclaredValue: number,
  annualFee: number
): number { ... }

export async function calculateCardROI(cardId: string): Promise<number> { ... }

export async function calculatePlayerROI(playerId: string): Promise<number> { ... }

export async function calculateHouseholdROI(householdId: string): Promise<number> { ... }

// Cache management
export function invalidateROICache(level: string, ids: string[]): void { ... }
export async function getROI(level: string, id: string): Promise<number> { ... }
```

#### With Dashboard Components
```typescript
// Use React Context for real-time updates
export const BenefitValueContext = createContext<BenefitValueContextType | null>(null);

// Dashboard subscribes to context
const { roiCache, values, isLoading } = useContext(BenefitValueContext);

// Updates trigger re-render automatically
useEffect(() => {
  // When ROI cache changes, dashboard updates
  // No manual refresh needed
}, [roiCache]);
```

#### With Benefit List Components
```typescript
// Embed EditableValueField in benefit row
<BenefitCard>
  <BenefitInfo name={benefit.name} />
  
  <EditableValueField
    benefitId={benefit.id}
    stickerValue={benefit.stickerValue}
    currentValue={benefit.userDeclaredValue}
    onSave={handleValueChange}
  />
  
  <BenefitValueComparison
    benefitName={benefit.name}
    stickerValue={benefit.stickerValue}
    customValue={benefit.userDeclaredValue}
    effectiveValue={benefit.userDeclaredValue ?? benefit.stickerValue}
    benefitROI={calculatedROI}
  />
  
  <BenefitValuePresets
    stickerValue={benefit.stickerValue}
    currentValue={benefit.userDeclaredValue}
    onSelect={handlePresetSelect}
  />
</BenefitCard>
```

---

## Implementation Checklist

### Phase 1: Core Components & Database

- [ ] **Database Migration**
  - [ ] Add `valueHistory` column (TEXT, nullable, JSON array)
  - [ ] Add `valueUpdatedAt` column (DateTime, nullable)
  - [ ] Add `valueUpdatedBy` column (String, nullable)
  - [ ] Create indexes on valueUpdatedAt and playerId
  - [ ] Test migration on development database
  - [ ] Verify backward compatibility

- [ ] **EditableValueField Component**
  - [ ] Component skeleton with TypeScript types
  - [ ] Display mode rendering (shows value with sticker comparison)
  - [ ] Click to activate edit mode
  - [ ] Input field with number validation (client-side)
  - [ ] Error message display (inline, below input)
  - [ ] Loading spinner during save
  - [ ] Success toast notification
  - [ ] Error toast notification
  - [ ] Auto-save on blur (debounced)
  - [ ] Auto-save on Enter key
  - [ ] Escape key cancels edit
  - [ ] Reverts on save error
  - [ ] Accepts currency format ($250.00, 250, 25000 cents)
  - [ ] Tests: Display, edit activation, validation, save, error handling

- [ ] **BenefitValueComparison Component**
  - [ ] Side-by-side value display
  - [ ] Difference calculation ($, %)
  - [ ] "Significant difference" highlight (> 10%)
  - [ ] ROI impact display
  - [ ] Tests: Math accuracy, display formatting

- [ ] **Input Validation Utilities**
  - [ ] Function: validateBenefitValue() - returns error or null
  - [ ] Function: formatCurrencyDisplay() - formats for UI
  - [ ] Function: calculateDifference() - math for comparison
  - [ ] Function: isSignificantlyDifferent() - > 10% check
  - [ ] Tests: All validation rules, edge cases

- [ ] **Server Action: updateUserDeclaredValue()**
  - [ ] TypeScript types for request/response
  - [ ] Parameter validation (benefitId format, value range)
  - [ ] Authorization check (user owns benefit)
  - [ ] Record change in valueHistory (JSON append)
  - [ ] Update database (UserBenefit.userDeclaredValue)
  - [ ] Return updated benefit + ROI values
  - [ ] Error handling (4xx, 5xx error codes)
  - [ ] Tests: Happy path, validation, authorization, error cases

- [ ] **Server Action: clearUserDeclaredValue()**
  - [ ] Set userDeclaredValue to null
  - [ ] Record in history as "Reset to master"
  - [ ] Trigger ROI recalculation
  - [ ] Return updated benefit
  - [ ] Tests: Clear operation, history tracking

### Phase 2: ROI Integration

- [ ] **ROI Calculation Functions**
  - [ ] calculateBenefitROI() - single benefit ROI
  - [ ] calculateCardROI() - sum of benefits ROI
  - [ ] calculatePlayerROI() - across all cards ROI
  - [ ] calculateHouseholdROI() - across all players ROI
  - [ ] Tests: Math accuracy for all 4 levels, edge cases (zero, expired)

- [ ] **ROI Cache Layer**
  - [ ] Cache map with TTL (5 minutes)
  - [ ] Cache key format: "{level}:{id}"
  - [ ] getROI() function (hit or miss)
  - [ ] invalidateROICache() function (invalidate keys)
  - [ ] Cache invalidation on all relevant triggers
  - [ ] Tests: Cache hit/miss, TTL expiry, invalidation

- [ ] **React Context for ROI State**
  - [ ] Create BenefitValueContext
  - [ ] Provider wrapper component
  - [ ] useROI hook for accessing values
  - [ ] updateROI callback for mutations
  - [ ] isLoading state
  - [ ] Tests: Context updates, hook usage

- [ ] **Real-Time Dashboard Updates**
  - [ ] Dashboard components subscribe to context
  - [ ] Update on value change (no page reload)
  - [ ] Show loading state if calculation > 500ms
  - [ ] Batch UI updates (not individual re-renders)
  - [ ] Tests: Real-time updates, no flashing, performance

- [ ] **Before/After ROI Display**
  - [ ] Component shows previous vs new ROI
  - [ ] Change delta (+ or -)
  - [ ] Percentage change
  - [ ] Color coding (green/red)
  - [ ] Tests: Display accuracy, math

### Phase 3: Advanced Features

- [ ] **BenefitValuePresets Component**
  - [ ] Preset buttons: [Use Master] [50%] [75%] [90%]
  - [ ] Calculate preset values correctly
  - [ ] Click saves immediately (with loading state)
  - [ ] Highlight current selection
  - [ ] Responsive layout (mobile-friendly)
  - [ ] Tests: Preset calculations, saving, highlight state

- [ ] **ValueHistoryPopover Component**
  - [ ] Timeline display of changes
  - [ ] Show value, date, who, reason
  - [ ] Revert button for each entry
  - [ ] Confirm dialog before reverting
  - [ ] Update history on revert
  - [ ] Tests: Timeline display, revert functionality, history tracking

- [ ] **Bulk Value Update Workflow**
  - [ ] Component: BulkValueEditor
  - [ ] Step 1: Review selected benefits
  - [ ] Step 2: Choose value approach
  - [ ] Step 3: Preview impact
  - [ ] Step 4: Apply and confirm
  - [ ] Server action: bulkUpdateUserDeclaredValues()
  - [ ] Atomic updates (all or nothing)
  - [ ] Error handling (show which failed)
  - [ ] Tests: Full workflow, preview accuracy, atomic updates

- [ ] **CSV Import Integration**
  - [ ] Support userDeclaredValue column in import
  - [ ] Validate values during import
  - [ ] Preview custom values before commit
  - [ ] Store import source in valueHistory
  - [ ] Tests: Import parsing, validation, preview

- [ ] **Revert Functionality**
  - [ ] Fetch benefit with valueHistory
  - [ ] Restore value at specified index
  - [ ] Record as "system" source with revert reason
  - [ ] Update all related ROI values
  - [ ] Tests: Revert to any historical value, history updates

### Phase 4: Testing & Optimization

- [ ] **Unit Tests (Validation & Calculations)**
  - [ ] Validation: 25+ test cases
    - Non-negative, numeric, max value, zero, extremes
    - Warning thresholds, error messages
  - [ ] Calculations: 30+ test cases
    - Benefit/card/player/household ROI
    - Zero value, max value, decimal values
    - Edge cases (expired, unclaimed)
  - [ ] Target coverage: 95%+

- [ ] **Component Tests**
  - [ ] EditableValueField: 15+ tests (edit, save, error, keyboard)
  - [ ] BenefitValuePresets: 10+ tests (preset selection, calculation)
  - [ ] ValueHistoryPopover: 10+ tests (display, revert)
  - [ ] BulkValueEditor: 15+ tests (workflow steps, validation)
  - [ ] Target coverage: 90%+

- [ ] **Integration Tests**
  - [ ] Value change triggers ROI recalculation
  - [ ] Dashboard updates in real-time
  - [ ] Bulk update atomic behavior
  - [ ] History tracking for all changes
  - [ ] Cache invalidation on all triggers
  - [ ] 15+ scenarios tested

- [ ] **E2E Tests (Playwright)**
  - [ ] Single benefit edit flow (happy path)
  - [ ] Single benefit edit with error recovery
  - [ ] Preset selection and save
  - [ ] Bulk update workflow (full flow)
  - [ ] Value history view and revert
  - [ ] Mobile touch interactions
  - [ ] 10+ scenarios, all critical paths

- [ ] **Accessibility Testing**
  - [ ] Keyboard navigation (Tab, Enter, Escape)
  - [ ] Screen reader compatibility (NVDA, JAWS)
  - [ ] Color contrast (WCAG AA: 4.5:1)
  - [ ] Focus states (visible, obvious)
  - [ ] Error messages linked to inputs
  - [ ] Loading states announced
  - [ ] Mobile accessibility (touch targets 44x44px)

- [ ] **Performance Testing**
  - [ ] Single benefit edit: < 100ms save time
  - [ ] Card ROI recalc: < 200ms
  - [ ] Household ROI recalc: < 300ms
  - [ ] Bulk update 100 benefits: < 1 second
  - [ ] Large wallet (200+ benefits): no freezing
  - [ ] Cache hit: < 5ms, miss: < 100ms
  - [ ] Profile with DevTools, identify bottlenecks

- [ ] **Mobile Device Testing**
  - [ ] iPhone (iOS 14+) - Safari
  - [ ] Android (10+) - Chrome
  - [ ] Portrait and landscape orientations
  - [ ] Touch interactions responsive
  - [ ] Numeric keyboard appears
  - [ ] Buttons readable, tappable (min 44x44px)
  - [ ] No horizontal scroll on mobile

- [ ] **Deployment & Documentation**
  - [ ] Database migration script
  - [ ] Environment variables documented
  - [ ] API documentation (all endpoints)
  - [ ] Component documentation (usage examples)
  - [ ] Troubleshooting guide
  - [ ] Performance monitoring setup
  - [ ] Error logging and alerting

---

## Security & Compliance

### Authorization
- **Benefit Ownership:** All value updates verify user owns the benefit via Player relationship
- **No Cross-User Access:** Impossible to modify another user's benefits
- **Session Validation:** Every action requires valid authenticated session
- **Optimistic Locking:** Version field prevents concurrent update conflicts

### Input Validation
- **Server-Side (Authoritative):** All validation re-run on server, never trust client
- **Format Validation:** Value must be non-negative integer (cents)
- **Range Validation:** 0 <= value <= 999,999,999
- **No Code Execution:** Input treated as data only, no template evaluation
- **Error Messages:** Sanitized, no sensitive data exposure

### Audit Trail
- **Immutable History:** valueHistory JSON array is append-only
- **Complete Tracking:** Every change records: value, timestamp, user, source, reason
- **Accountability:** Can identify who made each change and when
- **Dispute Resolution:** Full history enables reverting to any prior state
- **Compliance:** Audit trail supports regulatory requirements (if applicable)

### Data Privacy
- **No Data Leakage:** Users cannot see other users' values or changes
- **Export Privacy:** User data respects ownership boundaries
- **Sensitive Logging:** Change reasons not logged if they contain PII
- **Encryption:** PostgreSQL at-rest encryption (if configured)
- **Access Control:** Only authenticated users can view/modify their own data

---

## Performance & Scalability

### Performance Targets

| Operation | Target | Acceptable Range |
|-----------|--------|------------------|
| Single benefit value save | < 100ms | < 150ms |
| Benefit ROI calculation | < 10ms | < 20ms |
| Card ROI calculation | < 50ms | < 100ms |
| Player ROI calculation | < 100ms | < 200ms |
| Household ROI calculation | < 200ms | < 300ms |
| Bulk update 10 benefits | < 200ms | < 300ms |
| Bulk update 100 benefits | < 800ms | < 1000ms |
| Cache hit (ROI retrieval) | < 5ms | < 10ms |
| Cache miss (ROI recalc) | < 50ms | < 100ms |

### Optimization Strategies

**Calculation Optimization:**
- Memoize intermediate calculations (avoid recalculating same data)
- Only recalculate affected levels (benefit change affects card + up)
- Batch UI updates (single re-render, not 200)
- Defer non-critical calculations (history after main update)

**Database Optimization:**
- Eager load relationships (benefit + card + player in 1 query)
- Use database indexes on frequently queried columns
- Batch updates with createMany/updateMany
- Use transactions for atomic updates

**Caching Strategy:**
- Cache ROI values with 5-minute TTL
- Invalidate only affected cache entries
- Real-time bypass for UI feedback (no cache)
- Server-side cache layer (in-memory or Redis)

**Scalability Considerations:**
- Current design supports 100K+ benefits per user (O(n) is acceptable)
- No architectural changes needed for foreseeable growth
- If usage exceeds 1M benefits, consider:
  - Database read replicas for calculations
  - Job queue for bulk operations (imports, exports)
  - Distributed caching (Redis)
  - GraphQL batch loading

---

## Deployment Considerations

### Database Migration
```bash
# Create migration file
npx prisma migrate dev --name add_value_history_tracking

# Run migration in production
npx prisma migrate deploy
```

### Environment Variables
```
# .env variables (if needed for caching, monitoring)
ROI_CACHE_TTL_MS=300000
ROI_CALCULATION_TIMEOUT_MS=5000
BULK_UPDATE_BATCH_SIZE=100
```

### Monitoring & Alerting
- Track: ROI calculation times (should be < targets)
- Track: Server action error rates (watch for spikes)
- Alert: If ROI calculation > 1 second (performance issue)
- Alert: If value save fails repeatedly (data integrity risk)
- Alert: If authorization failures increase (security issue)

### Rollback Plan
- If feature breaks: Disable server actions (return error)
- If database corrupts: Restore from backup before migration
- If calculation wrong: Deploy fix, re-run calculations batch
- Users can always revert to previous values via history

---

## References & Examples

### Sample API Responses

**Update Value (Success):**
```json
{
  "success": true,
  "data": {
    "benefit": {
      "id": "ben_abc123",
      "name": "Travel Credit",
      "stickerValue": 30000,
      "userDeclaredValue": 25000,
      "type": "StatementCredit"
    },
    "rois": {
      "benefit": 45.45,
      "card": 145.45,
      "player": 112.31,
      "household": 108.33
    }
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Bulk Update (Success):**
```json
{
  "success": true,
  "data": {
    "updated": 3,
    "failed": 0,
    "rois": {
      "card": 150.0,
      "player": 115.0,
      "household": 110.5
    },
    "affectedCards": ["card_123", "card_456"]
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

**Get History (Success):**
```json
{
  "success": true,
  "data": {
    "benefitId": "ben_123",
    "history": [
      {
        "value": 25000,
        "changedAt": "2024-04-02T15:30:00Z",
        "changedBy": "user_123",
        "source": "manual",
        "reason": "I don't use this much"
      },
      {
        "value": 30000,
        "changedAt": "2024-04-01T10:00:00Z",
        "changedBy": "system",
        "source": "import"
      }
    ]
  },
  "timestamp": "2024-04-02T15:30:00Z"
}
```

### Component Usage Examples

**EditableValueField:**
```typescript
<EditableValueField
  benefitId="ben_123"
  stickerValue={30000}
  currentValue={25000}
  onSave={async (value) => {
    const result = await updateUserDeclaredValue('ben_123', value);
    if (!result.success) throw new Error(result.error);
  }}
  showPresets={true}
/>
```

**BenefitValueComparison:**
```typescript
<BenefitValueComparison
  benefitName="Travel Credit"
  stickerValue={30000}
  customValue={25000}
  effectiveValue={25000}
  benefitROI={45.45}
  cardROI={145.45}
  previousCardROI={148.0}
/>
```

**BulkValueEditor:**
```typescript
<BulkValueEditor
  selectedBenefits={[
    { id: 'ben_1', name: 'Travel', stickerValue: 30000, currentValue: null },
    { id: 'ben_2', name: 'Dining', stickerValue: 20000, currentValue: 15000 }
  ]}
  onApply={async (value) => {
    const result = await bulkUpdateUserDeclaredValues([
      { benefitId: 'ben_1', valueInCents: value },
      { benefitId: 'ben_2', valueInCents: value }
    ]);
  }}
  onCancel={() => console.log('Cancelled')}
/>
```

---

## Document Summary

This refined specification provides a complete, production-ready blueprint for implementing the Custom Values feature. It includes:

✅ **Complete Requirements** - 13 functional requirements with detailed specifications
✅ **Data Design** - Database schema with migration scripts
✅ **API Contracts** - 5 server actions with full request/response examples
✅ **ROI Calculations** - Mathematical formulas and algorithms for all 4 levels
✅ **User Flows** - 6 detailed workflows with step-by-step user interactions
✅ **Edge Cases** - 15 comprehensive edge cases with handling strategies
✅ **Component Architecture** - 5 UI components with props, state, and behavior
✅ **Implementation Checklist** - 50+ actionable tasks organized by phase
✅ **Testing Strategy** - Unit, integration, E2E, accessibility, and performance testing
✅ **Security & Compliance** - Authorization, validation, audit trail, privacy
✅ **Performance Targets** - Clear SLAs for all operations
✅ **Deployment Guide** - Migration, monitoring, rollback procedures

**Status:** ✅ Ready for full-stack engineer implementation

**Next Steps:**
1. Review with team for clarifications
2. Set up development database with migration
3. Begin Phase 1: Core Components & Database
4. Follow implementation checklist for task tracking
5. Run tests after each phase completion

---

**Document Version:** 2.0 (Refined)
**Created:** April 2024
**Status:** Ready for Implementation
**Audience:** Full-Stack Engineers, QA Engineers
**Dependencies:** Existing Card Benefits codebase, Prisma ORM, Next.js

