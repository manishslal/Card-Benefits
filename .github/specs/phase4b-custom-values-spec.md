# Phase 4B: Custom Values UI - Technical Specification

**Version:** 1.0  
**Date:** April 2024  
**Status:** Architecture Complete - Ready for Implementation  
**Priority:** High (User Personalization Feature)

---

## Executive Summary & Goals

The Custom Values UI feature enables users to personalize benefit values based on their individual spending patterns and preferences. Currently, all benefit values are static and sourced from the admin-managed master catalog. Phase 4B adds a user-facing UI layer that allows users to override benefit values for their cards, creating a more personalized ROI calculation experience.

**Example Use Case:** "I value dining credits at $1.50 per $100 spent instead of the default $1.25, because I frequently use restaurants near expensive areas. My card's ROI should reflect my actual value perception."

**Primary Objectives:**
- Enable single-benefit value editing through inline EditableValueField component
- Support bulk editing of multiple benefits through BulkValueEditor
- Provide audit trail with value history and revert capability via ValueHistoryPopover
- Maintain real-time ROI recalculation with custom values
- Ensure data consistency and permission isolation across users
- Deliver accessible, responsive, and dark-mode-compatible UI

**Success Criteria:**
- Users can click "Edit" on any benefit to set a custom value
- Values persist to database and survive page reloads
- ROI calculations update in real-time to reflect custom values
- Bulk editing allows updating all benefits on a card at once
- Users can view change history and revert to previous values
- All edits are audit-logged with timestamp and user identification
- UI works on mobile, tablet, and desktop (responsive)
- All components meet WCAG 2.1 AA accessibility standards
- Dark mode properly themed with adequate contrast ratios

---

## Functional Requirements

### FR-1: Single Benefit Value Editing
- User clicks "Edit Value" button next to any benefit
- EditableValueField enters edit mode, showing current value in an input field
- User enters new value (in dollars, formatted as currency)
- System validates value is a positive integer (cents) with optional upper bound warning
- On Enter or blur, changes are saved via server action
- On success: UI updates immediately (optimistic), toast confirms change, ROI recalculates
- On error: User sees error message, value reverts, previous state restored

**Constraints:**
- Value must be >= $0.00 (allow zero values as valid)
- Value must be <= $99,999.99 (warn if exceeds, allow confirmation)
- Value must be numeric only
- Input must accept decimal notation (e.g., "12.50")
- Value updates are per-user (other users' custom values unaffected)

### FR-2: Bulk Benefit Value Editing
- Admin or user opens card detail page with BulkValueEditor
- BulkValueEditor displays table with all benefits for the selected card
- Each row shows: benefit name, type, sticker value, current custom value (if set)
- User can edit multiple values inline or through a modal per-benefit
- "Save All" button triggers single server action with all updates
- On success: All values update atomically, ROI recalculates for card
- On error: All changes are rolled back, no partial updates

**Constraints:**
- All updates in a batch must succeed or fail together (atomic)
- Cannot edit benefits from different cards in same batch
- Requires permission verification for each benefit

### FR-3: Value History and Audit Trail
- ValueHistoryPopover shows clickable "History" button for each benefit
- Popover displays timeline of all value changes (newest first)
- Each entry shows: old value → new value, timestamp, changed by (user ID), change reason (if provided)
- Each entry has "Revert to this value" button
- Clicking revert triggers updateCustomValue action with historical value
- On success: Value updated, history entry added (with source='revert'), UI updates

**Constraints:**
- History is read-only (entries cannot be deleted or edited)
- History is scoped to current user only
- Revert creates a new history entry (not replacement)
- History entries must be timestamp-ordered

### FR-4: Real-Time ROI Recalculation
- When a custom value is saved, server action returns updated ROI at benefit, card, and user levels
- UI immediately displays new ROI values
- Summary cards refresh to show updated values
- Benefit table updates to show new ROI and custom value indicator
- Recalculation considers all user's cards and benefits, not just affected benefit

**Constraints:**
- ROI calculations must use custom value if set, else fall back to sticker value
- Recalculation must not cause UI flicker or loading delays >500ms
- ROI cache should be invalidated on save to ensure accuracy

### FR-5: Permission & Data Isolation
- Only authenticated users can set custom values
- Users can only edit their own custom values
- Users cannot view or edit other users' custom values
- Admin can view audit logs (future: admin dashboard)
- Server actions verify userId matches session before updating

**Constraints:**
- All server actions must verify user ownership of benefit/card
- Responses must not leak data from other users
- Concurrent edits by same user allowed (last write wins)

### FR-6: Visual Indicators for Custom Values
- When custom value differs from sticker value, display visual indicator
- Indicator shows: "Custom: $X.XX" in lighter text color
- Optionally show difference percentage: "Custom: $X.XX (+15%)"
- Indicator visible in benefit table, card detail, summary stats
- Different styling for values >10% above/below sticker value (significant)

**Constraints:**
- Indicator must not obscure primary benefit information
- Indicator color must change in dark mode for readability
- Mobile: may truncate indicator if space constrained

---

## Implementation Phases

### Phase 4B-A: Data Schema & Server Actions (Est. 6-8 hours)
**Objectives:**
- Add CustomBenefitValue model to Prisma schema (if not already present)
- Implement server action: updateCustomValue (single benefit)
- Implement server action: bulkUpdateCustomValues (multiple benefits)
- Implement server action: getCustomValues (fetch user's custom values)
- Implement server action: revertCustomValue (historical revert)
- Add database indexes for query performance
- Create Zod validation schemas for all requests

**Key Deliverables:**
- Prisma schema with CustomBenefitValue model
- Server action implementations with error handling
- Zod validation schemas
- Database indexes on userId, benefitId
- Authorization checks in all actions
- Unit tests for validation and authorization

**Dependencies:** Existing Prisma setup, authentication system

---

### Phase 4B-B: EditableValueField Component (Est. 4-6 hours)
**Objectives:**
- Implement complete EditableValueField.tsx component
- Support click-to-edit UI pattern
- Add input validation and error messages
- Implement value confirmation dialog for high values
- Add accessibility features (labels, ARIA, keyboard nav)
- Dark mode support with proper contrast

**Key Deliverables:**
- Fully functional EditableValueField component
- Toast notifications for success/error
- Keyboard support (Enter/Escape)
- Focus management
- Unit tests with Vitest
- Storybook stories for interactive testing

**Dependencies:** UI component library (Button, Input), toast system

---

### Phase 4B-C: ValueHistoryPopover Component (Est. 3-5 hours)
**Objectives:**
- Implement ValueHistoryPopover.tsx component
- Display history in chronological order (newest first)
- Show who changed value, when, and to what
- Implement revert-to-value button
- Add popover positioning and z-index management
- Dark mode support

**Key Deliverables:**
- Fully functional ValueHistoryPopover component
- History data fetching via server action
- Revert functionality integration
- Popover UI with shadcn/ui Popover
- Unit tests
- Accessibility testing

**Dependencies:** Server action for history fetch, UI components

---

### Phase 4B-D: BulkValueEditor Component (Est. 5-7 hours)
**Objectives:**
- Implement BulkValueEditor.tsx component
- Display benefits in editable table
- Support inline or modal editing per benefit
- Implement "Save All" functionality
- Handle errors gracefully (rollback on failure)
- Dark mode support

**Key Deliverables:**
- Fully functional BulkValueEditor component
- Table component with inline editing
- Atomic save operation
- Error handling and rollback
- Unit tests
- E2E tests for bulk save flow

**Dependencies:** EditableValueField, server action for bulk updates

---

### Phase 4B-E: Integration Points (Est. 5-7 hours)
**Objectives:**
- Integrate EditableValueField into card detail page
- Integrate BulkValueEditor into admin card management
- Update BenefitTable to show custom value indicators
- Update SummaryStats to use custom values in ROI calculations
- Add "Edit" buttons to each benefit in all views
- Implement real-time ROI refresh on custom value save

**Key Deliverables:**
- Modified card detail page with EditableValueField buttons
- Modified BenefitTable with custom value display
- Modified SummaryStats ROI calculations
- Real-time ROI updates in UI
- Integration tests for data flow
- E2E tests for complete user flows

**Dependencies:** All previous phases

---

### Phase 4B-F: Accessibility & Dark Mode (Est. 3-4 hours)
**Objectives:**
- Audit all components for WCAG 2.1 AA compliance
- Test with screen readers (NVDA, JAWS)
- Verify keyboard navigation (Tab, Enter, Escape)
- Dark mode contrast verification (7:1 min)
- Focus management and visual indicators
- Responsive testing (mobile, tablet, desktop)

**Key Deliverables:**
- Accessibility audit report
- Screen reader testing results
- Dark mode contrast verification
- Responsive design verification
- Updated components with accessibility fixes

**Dependencies:** All UI components completed

---

### Phase 4B-G: Testing & Documentation (Est. 4-6 hours)
**Objectives:**
- Write comprehensive unit tests (>80% coverage)
- Write E2E tests for complete user flows
- Write integration tests for data persistence
- Create API documentation
- Create component documentation
- Create user guide

**Key Deliverables:**
- Unit tests (Vitest)
- E2E tests (Playwright)
- Integration tests
- API documentation
- Component Storybook stories
- User guide/help text

**Dependencies:** All components, actions, integrations

---

## Data Schema / State Management

### Database Models

#### CustomBenefitValue (NEW - Optional if not already in schema)
```sql
model CustomBenefitValue {
  id            String    @id @default(cuid())
  
  // Relationships
  userId        String
  benefitId     String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Data
  customValue   Int                    // Value in cents (e.g., 12500 = $125.00)
  
  // Audit fields
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  
  // Indexes
  @@unique([userId, benefitId])
  @@index([userId])
  @@index([benefitId])
  @@index([userId, createdAt])
}
```

#### Extend UserBenefit Model (EXISTING - Add field if missing)
```sql
model UserBenefit {
  // ... existing fields ...
  
  // Custom value tracking
  userDeclaredValue  Int?                  // Custom value in cents (null = use stickerValue)
  valueHistory       String?               // JSON array of BenefitValueChange entries
  
  // Keep existing timestamps
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

### State Management Architecture

#### Client State (React Context)
```typescript
interface BenefitValueState {
  // Map of benefitId -> { customValue, stickerValue, effectiveValue }
  values: Map<string, BenefitValue>;
  
  // ROI cache by level
  roiCache: Map<string, { value: number; cachedAt: Date }>;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  updateValue: (benefitId: string, value: number) => Promise<void>;
  invalidateROI: () => Promise<void>;
}
```

#### Local Component State (EditableValueField)
```typescript
interface EditableValueFieldState {
  isEditing: boolean;
  pendingValue: string;           // String input from user
  isSaving: boolean;
  validationError: string | null;
  saveError: string | null;
  lastSavedAt: Date | null;
}
```

#### Server State (Prisma)
- CustomBenefitValue: stores userId, benefitId, customValue
- UserBenefit: userDeclaredValue field stores effective custom value
- AdminAuditLog: captures all value changes for compliance

---

## User Flows & Workflows

### Flow 1: Single Benefit Value Edit (Happy Path)

```
User Views Card Detail
    ↓
User Clicks "Edit Value" Button on Benefit
    ↓
EditableValueField Enters Edit Mode
    ↓
User Enters Custom Value (e.g., "150")
    ↓
System Validates Input (is numeric, positive)
    ↓
User Presses Enter or Clicks Save
    ↓
EditableValueField Calls updateCustomValue(benefitId, value) Server Action
    ↓
Server Action:
  - Verifies User Ownership of Benefit
  - Validates Value (positive, within bounds)
  - Upserts CustomBenefitValue Record
  - Recalculates ROI at All Levels
  - Returns { success: true, roi, timestamp }
    ↓
Client:
  - Optimistically Updates UI Immediately
  - Shows Success Toast "Value updated"
  - Refreshes ROI Display
  - Stores Custom Value in Context
    ↓
User Sees Updated ROI and Custom Indicator
    ↓
[END - Success]
```

### Flow 1b: Error Path

```
User Enters Invalid Value (e.g., "-50" or "abc")
    ↓
Client-Side Validation Fails
    ↓
Error Message Shown Inline: "Please enter a positive amount"
    ↓
Input Field Highlighted in Red (dark mode: red border)
    ↓
User Cannot Save Until Valid Value Entered
    ↓
[END - Value Not Saved]
```

### Flow 1c: Unusually High Value Confirmation

```
User Enters Very High Value (e.g., "5000")
    ↓
Client Detects Value > (stickerValue * 2) or Exceeds Threshold
    ↓
Confirmation Dialog Appears:
  "You're setting a very high value ($5000) compared to master ($150).
   Are you sure?"
    ↓
User Clicks Confirm or Cancel
    ↓
If Cancel: Dialog Closes, Value Unchanged
If Confirm: Proceeds to Save (Flow 1 Happy Path)
    ↓
[END]
```

### Flow 2: Bulk Benefit Value Editing

```
Admin/User Opens Card Detail with Bulk Editor
    ↓
BulkValueEditor Loads All Benefits for Card
    ↓
Table Displays:
  | Benefit Name | Type | Sticker Value | Current Custom | Edit |
  | Dining Credit| Usage| $100         | $150 (custom)  | ... |
  | Hotel Credit | Usage| $200         | $200 (default) | ... |
    ↓
User Clicks Edit on Multiple Benefits
    ↓
Each Benefit Opens EditableValueField (Modal or Inline)
    ↓
User Changes Values:
  - Dining: $150 → $175
  - Hotel: $200 → $225
    ↓
User Clicks "Save All Changes"
    ↓
BulkValueEditor Calls bulkUpdateCustomValues(updates[])
    ↓
Server Action:
  - Opens Transaction
  - For Each Update:
    - Verify User Ownership
    - Validate Value
    - Upsert CustomBenefitValue
  - Recalculate Card-Level ROI
  - Commit Transaction (or Rollback on Any Error)
  - Return { updated: 2, affected: [id1, id2], roi }
    ↓
Client:
  - If Success: All Values Update, Toast "2 benefits updated"
  - If Error: Rollback All Changes, Show Error Message
    ↓
User Sees Updated Table and ROI
    ↓
[END]
```

### Flow 3: Value History and Revert

```
User Clicks History Icon on Benefit
    ↓
ValueHistoryPopover Opens
    ↓
Popover Displays Timeline:
  [2024-04-06 10:30] Changed to $175 by user:abc123
  [2024-04-05 14:15] Changed to $150 by user:abc123
  [Master Default]  $100
    ↓
User Clicks "Revert to $150"
    ↓
revertCustomValue(benefitId, historyIndex) Server Action Called
    ↓
Server:
  - Verifies User Ownership
  - Retrieves Historical Value from History
  - Updates UserBenefit.userDeclaredValue = $150
  - Appends New History Entry: source='revert', oldValue=$175, newValue=$150
  - Recalculates ROI
  - Returns { success: true, roi }
    ↓
Client:
  - Updates UI with Reverted Value
  - Shows Toast "Reverted to previous value ($150)"
  - Refreshes ROI and History Popover
    ↓
History Now Shows:
  [2024-04-06 11:00] Reverted to $150 by user:abc123
  [2024-04-06 10:30] Changed to $175 by user:abc123
  [2024-04-05 14:15] Changed to $150 by user:abc123
    ↓
[END - Success]
```

### Flow 4: Mobile Single-Benefit Edit

```
User Viewing Card on Mobile (375px)
    ↓
User Taps "Edit" Button
    ↓
EditableValueField Enters Edit Mode
    ↓
Mobile Keyboard Appears, Input Field Focused
    ↓
User Types Value (e.g., "150")
    ↓
Input Shows Clear Button (X) to Reset
    ↓
User Taps Save Button (Full Width)
    ↓
Saving Spinner Shows While Request Pending
    ↓
Server Responds
    ↓
Toast Notification at Bottom of Screen
    ↓
UI Updates, Keyboard Closes
    ↓
Custom Indicator Shows Inline or Below Benefit Row
    ↓
[END]
```

### Flow 5: Permission Violation Attempt

```
User A Somehow Gets Benefit ID of User B
    ↓
User A Calls updateCustomValue(benefitIdFromUserB, value)
    ↓
Client: Request Sent to Server
    ↓
Server:
  - Checks Authorization: verifyBenefitOwnership(benefitId, userId)
  - Ownership Check Fails
  - Returns { success: false, error: "Unauthorized" }
    ↓
Client:
  - Receives Error Response
  - Shows Error Toast: "Permission denied"
  - Does NOT Update UI
    ↓
User A Sees No Change, Error Message Displayed
    ↓
[END - Blocked]
```

---

## API Routes & Contracts

### Server Action: updateCustomValue

**Purpose:** Update or create a custom value for a single benefit

**Location:** `src/features/custom-values/actions/custom-values.ts`

**Request Schema:**
```typescript
interface UpdateCustomValueRequest {
  benefitId: string;                   // Benefit ID (from URL or context)
  customValue: number;                 // Value in cents (e.g., 12500 = $125.00)
  changeReason?: string;               // Optional reason for change (max 255 chars)
}
```

**Response Schema (Success):**
```typescript
interface UpdateCustomValueResponse {
  success: true;
  benefitId: string;
  customValue: number;                 // Saved value in cents
  previousValue: number | null;        // Previous custom value (null if first time)
  effectiveValue: number;              // Final value used (custom if set, else sticker)
  stickerValue: number;                // Master sticker value for reference
  roi: {
    benefit: number;                   // Benefit-level ROI percentage
    card: number;                      // Card-level ROI percentage
    player: number;                    // Player-level ROI percentage
    household: number;                 // Household-level ROI percentage
  };
  timestamp: Date;
  changeAmount: number;                // customValue - previousValue (in cents)
  changePercent: number;               // % change relative to previous value
}
```

**Response Schema (Error):**
```typescript
interface UpdateCustomValueResponse {
  success: false;
  error: string;                       // User-friendly error message
  code: string;                        // Error code for client-side handling
                                       // Possible: INVALID_VALUE, UNAUTHORIZED, NOT_FOUND, SERVER_ERROR
  timestamp: Date;
}
```

**Validation Rules:**
- customValue must be integer >= 0
- customValue must be <= 9999999 (optional upper bound warning)
- customValue must pass Zod schema validation
- benefitId must exist and belong to current user's card
- userId from session must match benefit owner

**Example Request:**
```typescript
const result = await updateCustomValue({
  benefitId: 'ben_12345',
  customValue: 15000,  // $150.00
  changeReason: 'More accurate valuation based on spending patterns'
});
```

**Example Response (Success):**
```json
{
  "success": true,
  "benefitId": "ben_12345",
  "customValue": 15000,
  "previousValue": 10000,
  "effectiveValue": 15000,
  "stickerValue": 10000,
  "roi": {
    "benefit": 45.2,
    "card": 12.5,
    "player": 8.3,
    "household": 5.1
  },
  "timestamp": "2024-04-06T10:30:00Z",
  "changeAmount": 5000,
  "changePercent": 50
}
```

---

### Server Action: bulkUpdateCustomValues

**Purpose:** Update multiple custom values atomically

**Location:** `src/features/custom-values/actions/custom-values.ts`

**Request Schema:**
```typescript
interface BulkUpdateCustomValuesRequest {
  updates: Array<{
    benefitId: string;
    customValue: number;               // Value in cents
  }>;
  cardId?: string;                     // Optional: all benefits must belong to this card
  changeReason?: string;               // Optional: applies to all updates
}
```

**Response Schema (Success):**
```typescript
interface BulkUpdateCustomValuesResponse {
  success: true;
  updated: number;                     // Number of benefits successfully updated
  failed: number;                      // Number of failures (0 if all succeed)
  updates: Array<{
    benefitId: string;
    benefitName: string;
    valueBefore: number;
    valueAfter: number;
    roiBefore: number;
    roiAfter: number;
  }>;
  roi: {
    card: number;                      // Recalculated card-level ROI
    player: number;
    household: number;
  };
  timestamp: Date;
}
```

**Response Schema (Error):**
```typescript
interface BulkUpdateCustomValuesResponse {
  success: false;
  error: string;
  code: string;                        // INVALID_BATCH, PARTIAL_FAILURE, UNAUTHORIZED, etc.
  failedBenefits?: Array<{
    benefitId: string;
    reason: string;
  }>;
  rollbackPerformed: boolean;          // Always true on error (atomic rollback)
  timestamp: Date;
}
```

**Behavior:**
- All updates must succeed or all fail (atomic transaction)
- No partial updates allowed
- All benefitIds must belong to current user
- All benefitIds should belong to same cardId (validation warning if not)
- Each value is validated individually before batch processing
- If any value invalid: entire batch rejected, transaction rolled back

---

### Server Action: getCustomValues

**Purpose:** Fetch all custom values for current user

**Location:** `src/features/custom-values/actions/custom-values.ts`

**Request Schema:**
```typescript
interface GetCustomValuesRequest {
  cardId?: string;                     // Optional: filter to specific card
  benefitId?: string;                  // Optional: fetch single benefit
}
```

**Response Schema (Success):**
```typescript
interface GetCustomValuesResponse {
  success: true;
  values: Array<{
    benefitId: string;
    benefitName: string;
    cardId: string;
    cardName: string;
    customValue: number;               // Value in cents
    stickerValue: number;
    effectiveValue: number;
    isDifferent: boolean;              // customValue !== stickerValue
    differencePercent: number;         // (customValue - stickerValue) / stickerValue
    createdAt: Date;
    updatedAt: Date;
  }>;
  timestamp: Date;
}
```

**Response Schema (Error):**
```typescript
interface GetCustomValuesResponse {
  success: false;
  error: string;
  code: string;
}
```

**Example Request:**
```typescript
const result = await getCustomValues({ cardId: 'card_12345' });
```

---

### Server Action: getBenefitValueHistory

**Purpose:** Fetch change history for a specific benefit

**Location:** `src/features/custom-values/actions/custom-values.ts`

**Request Schema:**
```typescript
interface GetBenefitValueHistoryRequest {
  benefitId: string;
  limit?: number;                      // Default: 20 (max: 100)
}
```

**Response Schema (Success):**
```typescript
interface GetBenefitValueHistoryResponse {
  success: true;
  benefitId: string;
  benefitName: string;
  current: {
    value: number | null;              // Current custom value (or null if default)
    type: 'custom' | 'sticker';
    changedAt: Date | null;
  };
  history: Array<{
    id: string;
    value: number;
    changedAt: Date;
    changedBy: string;                 // User ID or 'system'
    source: 'manual' | 'import' | 'revert' | 'system';
    reason?: string;                   // Optional change reason
  }>;
  totalChanges: number;
  timestamp: Date;
}
```

**Ordering:** Newest changes first (DESC by changedAt)

**Example Response:**
```json
{
  "success": true,
  "benefitId": "ben_12345",
  "benefitName": "Dining Credit",
  "current": {
    "value": 15000,
    "type": "custom",
    "changedAt": "2024-04-06T10:30:00Z"
  },
  "history": [
    {
      "id": "hist_001",
      "value": 15000,
      "changedAt": "2024-04-06T10:30:00Z",
      "changedBy": "user_abc123",
      "source": "manual",
      "reason": "Updated based on spending patterns"
    },
    {
      "id": "hist_002",
      "value": 10000,
      "changedAt": "2024-04-05T14:15:00Z",
      "changedBy": "user_abc123",
      "source": "manual"
    }
  ],
  "totalChanges": 2,
  "timestamp": "2024-04-06T10:35:00Z"
}
```

---

### Server Action: revertCustomValue

**Purpose:** Revert to a previous custom value from history

**Location:** `src/features/custom-values/actions/custom-values.ts`

**Request Schema:**
```typescript
interface RevertCustomValueRequest {
  benefitId: string;
  historyIndex: number;                // Index in history array (0 = most recent)
  reason?: string;                     // Optional reason for revert
}
```

**Response Schema (Success):**
```typescript
interface RevertCustomValueResponse {
  success: true;
  benefitId: string;
  valueBefore: number;
  valueAfter: number;                  // Reverted-to value
  historyEntry: {
    id: string;
    value: number;
    changedAt: Date;
    source: 'revert';
    reason: string;                    // Auto-generated: "Reverted from $X to $Y"
  };
  roi: {
    benefit: number;
    card: number;
    player: number;
    household: number;
  };
  timestamp: Date;
}
```

**Response Schema (Error):**
```typescript
interface RevertCustomValueResponse {
  success: false;
  error: string;
  code: string;                        // HISTORY_INDEX_OUT_OF_RANGE, UNAUTHORIZED, etc.
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: User Sets Value to $0.00
**Scenario:** User intentionally sets custom value to $0 (no value perceived)
**Expected Behavior:**
- Allow the value ($0 is valid)
- ROI calculation should reflect $0 value
- Benefit-level ROI will be negative or zero
- Card ROI may decrease
- History captures the change
**Validation:** No error, accept and save

### Edge Case 2: User Sets Extremely High Value (>$10,000)
**Scenario:** User enters $15,000 for a dining credit (sticker: $100)
**Expected Behavior:**
- Client detects value > (stickerValue * 20) or exceeds global threshold
- Confirmation dialog appears with warning
- User can cancel or confirm
- If confirmed, value is saved with warning note
- History captures the high value

### Edge Case 3: Benefit No Longer Exists
**Scenario:** User tries to edit a benefit that was deleted from master catalog
**Expected Behavior:**
- Server action returns error: "Benefit not found"
- UI shows error message
- Value is not saved
- Client does not update custom values map

### Edge Case 4: User Edits Same Benefit Twice in Rapid Succession
**Scenario:** User clicks Edit, changes value to $150, clicks Save. Before response comes back, user clicks Edit again and changes to $200.
**Expected Behavior:**
- First request sent: updateCustomValue(benefitId, 15000)
- While pending, second request sent: updateCustomValue(benefitId, 20000)
- Server responds to first (saves $150)
- Server responds to second (saves $200, overwrites first)
- UI updates to $200 (last response wins)
- Potential race condition: handled by "last write wins" strategy
- **Note:** Future improvement could use optimistic locking with version field

### Edge Case 5: User Offline During Save
**Scenario:** User's internet disconnects while save request is in flight
**Expected Behavior:**
- Request timeout after 10s
- Error message shown: "Network error, please try again"
- Input field retains user's value
- User can retry save when online
- **Note:** Offline support not in Phase 4B scope

### Edge Case 6: Server Error During Bulk Update
**Scenario:** 3 benefits in batch; 2nd benefit fails validation; transaction rolled back
**Expected Behavior:**
- Transaction aborted
- All 3 benefits keep their previous values
- Error message: "Update failed: benefit 'Hotel Credit' has invalid value"
- UI does not update any values
- User can fix and retry

### Edge Case 7: User Deletes Custom Value (Revert to Master)
**Scenario:** User has custom value $150; wants to revert to sticker value $100
**Expected Behavior:**
- No explicit "delete" action; instead use revert to master
- If history available: click revert to oldest entry (sticker value)
- If no history: future clear/reset button removes custom value and sets userDeclaredValue = NULL
- ROI recalculates using stickerValue
- History entry added: source='revert', reason='Reverted to master value'

### Edge Case 8: Concurrent Edits by Different Users
**Scenario:** User A and User B both edit custom values simultaneously
**Expected Behavior:**
- Each user only affects their own custom values
- No cross-user impact (data isolation verified in server action)
- Both requests succeed independently
- No race condition (different benefitId or userId)

### Edge Case 9: User Tries to Revert to Non-Existent History Entry
**Scenario:** History has 3 entries; user requests historyIndex=10
**Expected Behavior:**
- Server validates historyIndex is within bounds
- Returns error: "History entry not found"
- No value change
- Error message shown to user

### Edge Case 10: Authorization Bypass Attempt
**Scenario:** Attacker somehow gets another user's benefitId and tries updateCustomValue
**Expected Behavior:**
- Server verifies benefitId belongs to current session's userId
- Ownership check fails
- Returns error: "Unauthorized: you don't own this benefit"
- No value saved
- Optionally logged as security event

### Edge Case 11: Invalid Input: Non-Numeric Value
**Scenario:** User types "abc" in value field
**Expected Behavior:**
- Client-side validation detects non-numeric input
- Error message: "Please enter a valid number"
- Save button disabled
- Input field highlighted with error styling

### Edge Case 12: Input with Excessive Decimals
**Scenario:** User enters "12.3456" (4 decimal places, but cents only need 2)
**Expected Behavior:**
- Client parses input, rounds to nearest cent: $12.35
- Display shows rounded value: "12.35"
- Server also rounds on receipt for consistency
- No error, just silent rounding

---

## Component Architecture

### Component Hierarchy

```
Card Detail Page (src/app/(dashboard)/card/[id]/page.tsx)
├─ BenefitTable
│  └─ BenefitTableRow (for each benefit)
│     ├─ Benefit Name & Type
│     ├─ Sticker Value Display
│     ├─ EditableValueField (NEW)
│     │  ├─ Display Mode (shows current value)
│     │  └─ Edit Mode (input + Save/Cancel buttons)
│     └─ ValueHistoryPopover (NEW)
│        └─ History Timeline
│           └─ Revert Buttons
├─ SummaryStats
│  ├─ ROI Calculation (uses custom values)
│  └─ Custom Value Indicators
└─ BulkValueEditor (Optional, future admin use)
   └─ Bulk Edit Table
```

### EditableValueField Component

**File:** `src/features/custom-values/components/EditableValueField.tsx`

**Props:**
```typescript
interface EditableValueFieldProps {
  benefitId: string;
  stickerValue: number;                // Master/sticker value in cents
  currentValue: number | null;         // Custom value if set, else null
  onSave?: (valueInCents: number) => Promise<void>;
  onError?: (error: string) => void;
  disabled?: boolean;
  showPresets?: boolean;               // Show quick-select preset buttons
  presetOptions?: Array<{
    label: string;
    value: number;
    description?: string;
  }>;
}
```

**Key Features:**
- Click "Edit Value" to enter edit mode
- Input field shows current value formatted as currency
- Validation warnings for unusual values (high/low)
- Confirmation dialog for values > 2x sticker value
- Optimistic UI update on save
- Error toast on failure
- Keyboard support: Enter to save, Escape to cancel
- Loading spinner during save
- Accessibility: proper labels, ARIA, focus management
- Dark mode support with Tailwind dark: variants

**State Management:**
```typescript
// Local state
const [isEditing, setIsEditing] = useState(false);
const [inputValue, setInputValue] = useState(formatValue(currentValue));
const [isSaving, setIsSaving] = useState(false);
const [validationError, setValidationError] = useState('');
const [showConfirmDialog, setShowConfirmDialog] = useState(false);
const [pendingValue, setPendingValue] = useState(null);
```

**User Interactions:**
1. Display mode: Click "Edit Value" → Enter edit mode
2. Edit mode: Type value → See validation feedback
3. Enter key or blur: Validate input
4. If unusual value: Show confirmation dialog
5. Confirm: Call onSave with new value
6. On success: Update local state, close edit mode, show toast
7. On error: Show error message, revert to previous value

---

### ValueHistoryPopover Component

**File:** `src/features/custom-values/components/ValueHistoryPopover.tsx`

**Props:**
```typescript
interface ValueHistoryPopoverProps {
  benefitId: string;
  currentValue: number | null;
  onRevert: (historyIndex: number) => Promise<void>;
  onClose?: () => void;
}
```

**Key Features:**
- Popover triggered by "History" button/icon next to benefit
- Displays timeline of value changes (newest first)
- Each entry shows: value, date/time, user, change reason
- "Revert to this value" button for each entry
- Loading state while fetching history
- Error message if history fetch fails
- Positioned relative to trigger button
- Z-index management to appear above other content
- Dark mode support

**Data Flow:**
1. Component mounts: Fetch history via getBenefitValueHistory()
2. Display history in chronological order (DESC)
3. User clicks "Revert to $X.XX"
4. Call onRevert(historyIndex)
5. Parent component calls server action
6. On success: Popover closes, parent updates UI
7. On error: Show error message in popover

---

### BulkValueEditor Component

**File:** `src/features/custom-values/components/BulkValueEditor.tsx`

**Props:**
```typescript
interface BulkValueEditorProps {
  selectedBenefits: Array<{
    id: string;
    name: string;
    stickerValue: number;
    currentValue: number | null;
  }>;
  onApply: (updates: Array<{ benefitId: string; valueInCents: number }>) => Promise<void>;
  onCancel: () => void;
}
```

**Key Features:**
- Displays benefits in editable table format
- Columns: Benefit Name, Type, Sticker Value, Custom Value, Edit
- Inline or modal editing for each benefit
- "Save All Changes" button (disabled until changes made)
- "Cancel" button to discard changes
- Atomic save: all succeed or all fail
- Show count of changed benefits
- Loading state during save
- Error rollback on server error
- Dark mode support

**State Management:**
```typescript
const [edits, setEdits] = useState<{ [benefitId: string]: number }>({});
const [isSaving, setIsSaving] = useState(false);
const [error, setError] = useState('');

const hasChanges = Object.keys(edits).length > 0;
```

**Behavior:**
1. Display all selected benefits in table
2. User edits values inline or via modal EditableValueField
3. Store edits in local state (keyed by benefitId)
4. "Save All" builds update array
5. Call onApply(updates)
6. Show loading spinner
7. On success: Close editor, show toast, emit changes
8. On error: Show error message, don't close, allow retry

---

## Integration Points

### Integration Point 1: Card Detail Page

**File:** `src/app/(dashboard)/card/[id]/page.tsx`

**Changes Required:**
```typescript
// Import custom values components
import { EditableValueField, ValueHistoryPopover } from '@/features/custom-values/components';
import { getCustomValues } from '@/features/custom-values/actions';

// Fetch custom values on page load
const customValues = await getCustomValues({ cardId: card.id });

// Pass to BenefitTable via props
<BenefitTable 
  benefits={benefits}
  customValues={customValues}
  onValueChange={handleValueChange}
/>
```

**UI Changes:**
- Add EditableValueField button/component for each benefit row
- Add ValueHistoryPopover trigger (history icon)
- Display custom value indicator if custom value exists
- Show difference percentage (if different from sticker)

---

### Integration Point 2: BenefitTable Component

**File:** `src/components/BenefitTable.tsx`

**Changes Required:**
```typescript
// Add custom values to each row
const BenefitTableRow = ({ benefit, customValue, onEdit }) => {
  const displayValue = customValue ?? benefit.stickerValue;
  const isDifferent = customValue !== null && customValue !== benefit.stickerValue;
  
  return (
    <tr>
      <td>{benefit.name}</td>
      <td>{benefit.type}</td>
      <td>
        ${(benefit.stickerValue / 100).toFixed(2)}
        {isDifferent && (
          <span className="text-xs text-gray-500 ml-2">
            Custom: ${(customValue / 100).toFixed(2)}
          </span>
        )}
      </td>
      <td>
        <EditableValueField
          benefitId={benefit.id}
          stickerValue={benefit.stickerValue}
          currentValue={customValue}
          onSave={onEdit}
        />
      </td>
    </tr>
  );
};
```

**Key Changes:**
- Check customValues map for each benefit
- Display custom value indicator if exists
- Pass customValue and onSave handler to EditableValueField

---

### Integration Point 3: SummaryStats Component

**File:** `src/components/SummaryStats.tsx`

**Changes Required:**
```typescript
// Update ROI calculation to use custom values
const calculateROI = (cards, customValues) => {
  let totalValue = 0;
  let totalFee = 0;
  
  for (const card of cards) {
    for (const benefit of card.benefits) {
      const customValue = customValues.get(benefit.id);
      const value = customValue ?? benefit.stickerValue;
      totalValue += value;
    }
    totalFee += card.annualFee;
  }
  
  return (totalValue - totalFee) / totalFee;
};

// Display count of custom values
<div className="text-sm text-gray-600">
  {customCount} benefits with custom values
</div>
```

**Key Changes:**
- Use custom values in ROI formula instead of sticker values
- Display custom value indicator and count
- Show breakdown of custom vs default benefits

---

### Integration Point 4: Authorization & Permission Checks

**File:** `src/features/auth/lib/auth.ts`

**Server-Side Verification (in each action):**
```typescript
// Every custom values action must verify ownership
const userId = await getAuthUserIdOrThrow();  // From session

// Verify benefit ownership
const benefit = await prisma.userBenefit.findUnique({
  where: { id: benefitId },
  include: { userCard: { include: { player: true } } }
});

if (benefit?.userCard?.player?.userId !== userId) {
  throw new AppError('Unauthorized', ERROR_CODES.FORBIDDEN);
}
```

---

### Integration Point 5: Real-Time ROI Refresh

**Flow:**
1. EditableValueField calls updateCustomValue() server action
2. Server returns { success: true, roi: { benefit, card, player, household } }
3. EditableValueField passes roi to onSave callback
4. Parent component (Card Detail Page) receives roi
5. Parent updates local state with new ROI values
6. SummaryStats component re-renders with new ROI
7. BenefitTable row updates to show new ROI

**Implementation:**
```typescript
// In Card Detail Page
const handleValueChange = async (benefitId: string, newValue: number) => {
  const result = await updateCustomValue({ benefitId, customValue: newValue });
  
  if (result.success) {
    // Update local ROI state
    setCardROI(result.roi.card);
    setPlayerROI(result.roi.player);
    
    // Refresh custom values cache
    const updated = await getCustomValues({ cardId: cardId });
    setCustomValues(updated.values);
  }
};
```

---

## Security & Compliance Considerations

### Authentication Requirements
- All custom value operations require valid session/authentication
- Session must be verified in every server action
- No guest access to custom values feature

### Authorization Strategy
- Users can only modify their own custom values
- Users cannot view other users' custom values
- Admins can audit all custom values (admin dashboard, future)
- Every action verifies userId matches benefit owner

### Data Protection
- Custom values stored in database with user isolation
- Prisma relations enforce referential integrity
- No sensitive data in history entries (only userId, not email)
- No custom value data exposed in public APIs

### Audit & Logging
- All value changes logged with:
  - benefitId
  - userId (who made the change)
  - oldValue and newValue
  - timestamp
  - source (manual, revert, import, system)
  - optional reason/comment
- Admin can view audit logs (future)
- AdminAuditLog table captures all changes

### Input Validation & Sanitization
- All numeric inputs validated with Zod
- Reason text limited to 255 chars, sanitized
- No SQL injection possible (Prisma parameterized)
- No XSS possible (value is number, no HTML)

### Rate Limiting
- Consider rate limiting on updateCustomValue to prevent spam
- Suggested: 100 updates per user per hour
- Implemented via middleware or Redis (future)

---

## Performance & Scalability Considerations

### Database Optimization
- Index on (userId, benefitId) for fast lookups
- Index on userId for fetching user's custom values
- Index on benefitId for audit/admin queries
- Consider partitioning if CustomBenefitValue table grows large

### Query Performance
- getCustomValues should use indexed lookup: O(n) where n = custom values for user (typically <50)
- getBenefitValueHistory: fetch history from UserBenefit.valueHistory JSON (fast, single row)
- updateCustomValue: single upsert operation, no N+1 queries

### Caching Strategy
- Client-side: Cache custom values in React Context
- Invalidate cache on updateCustomValue response
- Don't cache history (audit trail should be fresh)
- ROI calculations: computed on-demand (not cached, to ensure accuracy)

### Load Expectations
- Per-user custom values typically 5-50 benefits
- Per-benefit history typically 2-10 entries
- Query for all custom values: sub-100ms with index
- Bulk update with 10 benefits: <500ms

### Scalability Concerns
- No foreseeable scalability issues for Phase 4B
- If CustomBenefitValue table reaches millions of rows:
  - Consider partitioning by userId
  - Implement pagination for history
  - Archive old history entries

---

## Accessibility (WCAG 2.1 AA)

### Keyboard Navigation
- All buttons and inputs reachable via Tab key
- Shift+Tab navigates backward
- Enter key confirms actions (Save, Confirm)
- Escape key cancels edit mode or closes popover
- Focus trap in modal dialogs (confirm high value)
- Focus restoration after modal closes

### Screen Reader Support
- EditableValueField has proper <label> elements
- Input field labeled: aria-label="Custom benefit value in dollars"
- Buttons have descriptive aria-labels: "Edit value for Dining Credit"
- Error messages announced via aria-describedby
- History popover marked as dialog with proper ARIA roles
- Revert buttons announce old/new values: "Revert to $150.00"

### Visual Contrast
- Light mode: All text >= 4.5:1 contrast (AA)
- Dark mode: All text >= 7:1 contrast (AAA)
- Error messages: Not color-only (use icon + text)
- Validation warnings: Use color + icon + text
- Focus indicators: Visible outline or background change

### Form & Input Fields
- Labels visually associated with inputs
- Required fields marked (if applicable)
- Error messages clearly explained (not codes)
- Placeholder text does not replace labels
- Input mode correct for mobile: inputMode="decimal" for currency

### Responsive Text
- No fixed font sizes smaller than 14px
- Line height >= 1.5
- Letter spacing normal or increased (no negative spacing)
- Text doesn't disappear on zoom (up to 200%)

### Popover & Modal Dialogs
- Modal has proper focus management
- Escape key closes popover/modal
- Focus returned to trigger button on close
- Background content not interactive when modal open (overlay)
- Focus visible within modal

---

## Dark Mode Support

### Color Palette
- Light Mode Background: #FFFFFF (white)
- Dark Mode Background: #0F172A (slate-900)
- Light Mode Text: #1F2937 (gray-900)
- Dark Mode Text: #F3F4F6 (gray-100)

### Tailwind Dark Variants
```tsx
// Example: EditableValueField input styling
<Input
  className="
    bg-white dark:bg-slate-950
    text-gray-900 dark:text-gray-100
    border-gray-200 dark:border-gray-700
    placeholder-gray-500 dark:placeholder-gray-400
  "
/>
```

### Component Styling (Dark Mode)
- Buttons: Use `dark:bg-slate-700 dark:hover:bg-slate-600`
- Cards/Containers: Use `dark:bg-slate-900 dark:border-gray-700`
- Text: Use `dark:text-gray-100` for primary, `dark:text-gray-400` for secondary
- Warnings/Errors: Use `dark:bg-red-900/20 dark:text-red-300`
- Success: Use `dark:bg-green-900/20 dark:text-green-300`

### High Contrast Mode
- Ensure color-only indicators (e.g., green checkmark) also have text
- Error states use icon + text, not just red background
- Custom value indicator uses text "Custom: $X.XX", not just color

### Testing Dark Mode
- Test all components in dark mode with browser dev tools
- Verify contrast ratios with WebAIM Contrast Checker
- Test with system dark mode enabled
- Verify images/icons visible in dark background

---

## Responsive Design

### Breakpoints
- Mobile: < 640px (phone, vertical)
- Tablet: 640px - 1024px (portrait)
- Desktop: > 1024px (landscape)

### Mobile (< 640px)
- EditableValueField:
  - Full-width input field
  - Stacked buttons (Save, Cancel) on separate rows or full-width
  - Confirmation dialog: modal overlay, centered, touch-friendly
  - Input with phone keyboard on mobile
- ValueHistoryPopover:
  - Full-width popover or bottom sheet
  - Scrollable history list
  - Large touch targets (min 44px height)
- BenefitTable:
  - Stack columns vertically or show as cards
  - EditableValueField in collapsed/expandable section
  - No horizontal scroll

### Tablet (640px - 1024px)
- EditableValueField:
  - Wider input field
  - Buttons side-by-side
  - Confirmation dialog: centered modal
- BenefitTable:
  - Two-column layout possible
  - EditableValueField visible inline
- Custom value indicator: visible inline

### Desktop (> 1024px)
- EditableValueField: normal inline editing
- BenefitTable: full table with all columns
- ValueHistoryPopover: positioned popover (right side)
- Custom value indicator: visible inline with percentage

### Touch-Friendly Design
- Min touch target: 44px x 44px (44px recommended, 32px minimum)
- Button padding: 12px vertical, 16px horizontal (min)
- Input field height: >= 44px
- Spacing between interactive elements: >= 8px

---

## Testing Strategy

### Unit Tests (Vitest)

**EditableValueField Component:**
```typescript
describe('EditableValueField', () => {
  // Display mode tests
  test('shows current value in display mode', () => {});
  test('shows edit button in display mode', () => {});
  test('shows sticker value for reference', () => {});
  
  // Edit mode tests
  test('enters edit mode on button click', () => {});
  test('shows input field with current value', () => {});
  test('validates numeric input', () => {});
  test('shows validation error for non-numeric', () => {});
  
  // Save tests
  test('calls onSave on Enter key', () => {});
  test('calls onSave on blur', () => {});
  test('shows loading spinner during save', () => {});
  test('shows success toast on save success', () => {});
  test('shows error message on save error', () => {});
  test('reverts to previous value on error', () => {});
  
  // Confirmation dialog tests
  test('shows confirmation for unusually high values', () => {});
  test('saves value on confirmation', () => {});
  test('cancels save when confirmation dismissed', () => {});
  
  // Keyboard tests
  test('escapes edit mode on Escape key', () => {});
  test('saves on Enter key', () => {});
  
  // Accessibility tests
  test('has proper aria-label on input', () => {});
  test('has aria-describedby for errors', () => {});
  test('has visible label element', () => {});
});
```

**Server Actions (Integration Tests):**
```typescript
describe('updateCustomValue', () => {
  // Success tests
  test('updates custom value for valid input', () => {});
  test('returns updated ROI values', () => {});
  test('creates history entry with source=manual', () => {});
  
  // Validation tests
  test('rejects negative values', () => {});
  test('rejects non-numeric values', () => {});
  test('rejects benefitId that user does not own', () => {});
  
  // Authorization tests
  test('verifies user owns benefit before updating', () => {});
  test('returns unauthorized error for non-owner', () => {});
  
  // Edge case tests
  test('allows zero value', () => {});
  test('allows very high values (with warning)', () => {});
  test('handles concurrent updates (last write wins)', () => {});
});
```

### Integration Tests

**Custom Values Data Flow:**
```typescript
describe('Custom Values Data Flow', () => {
  test('user edits single benefit, ROI updates in UI', async () => {
    // 1. Render card detail page
    // 2. Click edit on benefit
    // 3. Enter custom value
    // 4. Save
    // 5. Assert custom value displayed
    // 6. Assert ROI updated
  });
  
  test('user reverts to previous value, history updated', async () => {
    // 1. Load benefit with history
    // 2. Click history icon
    // 3. Click revert button
    // 4. Assert value reverted
    // 5. Assert new history entry added
  });
  
  test('bulk update multiple benefits atomically', async () => {
    // 1. Open bulk editor
    // 2. Edit 3 benefits
    // 3. Save all
    // 4. Assert all 3 saved
    // 5. Assert ROI updated once
  });
});
```

### End-to-End Tests (Playwright)

**User Flows:**
```typescript
describe('Custom Values E2E', () => {
  test('User edits single benefit value and sees ROI update', async ({ page }) => {
    // 1. Login
    // 2. Navigate to card detail page
    // 3. Click "Edit Value" on first benefit
    // 4. Clear input
    // 5. Type new value (e.g., "150")
    // 6. Press Enter
    // 7. Verify success toast
    // 8. Verify custom value displayed
    // 9. Verify ROI section updated
    // 10. Reload page
    // 11. Verify custom value persisted
  });
  
  test('User reverts to previous value from history', async ({ page }) => {
    // 1. Login
    // 2. Navigate to benefit with history
    // 3. Click history icon
    // 4. Click "Revert to $X" on previous entry
    // 5. Verify value reverted
    // 6. Verify toast shown
    // 7. Verify history shows revert entry
  });
  
  test('User bulk edits multiple benefits', async ({ page }) => {
    // 1. Login
    // 2. Open bulk editor
    // 3. Edit 3 benefits
    // 4. Click "Save All"
    // 5. Verify all saved with one request
    // 6. Verify all values updated in table
    // 7. Verify ROI updated
  });
  
  test('User gets permission error for unauthorized access', async ({ page }) => {
    // 1. Login as User A
    // 2. Get benefit ID from User B's card
    // 3. Try to edit via direct API call or URL manipulation
    // 4. Verify 401/403 error
    // 5. Verify UI shows error message
  });
});
```

### Accessibility Tests
- Use axe-core in integration tests
- Screen reader testing (NVDA on Windows)
- Keyboard navigation testing (no mouse)
- Contrast ratio validation (WebAIM)

### Performance Tests
- Single update should complete in <500ms
- Bulk update (10 benefits) should complete in <1000ms
- Page load with custom values should not exceed 3s

---

## Deployment Considerations

### Database
- No database schema changes required if CustomBenefitValue already exists
- If adding CustomBenefitValue model:
  - Run `npx prisma migrate dev --name add_custom_benefit_value`
  - Deployment: Run migrations on production database
  - No data migration needed (start with empty custom values)
- Add indexes:
  ```sql
  CREATE INDEX idx_custom_benefit_value_user_id ON custom_benefit_value(user_id);
  CREATE INDEX idx_custom_benefit_value_user_benefit ON custom_benefit_value(user_id, benefit_id);
  ```

### Environment Variables
- No new environment variables required
- Uses existing authentication and database config

### Backwards Compatibility
- Custom values are optional (fallback to sticker values)
- Existing benefit data unaffected
- Existing ROI calculations work unchanged
- No breaking changes to APIs

### Deployment Steps
1. Deploy code with new components and server actions
2. Run database migrations (if schema changes)
3. Verify server actions are correctly deployed
4. Test custom value editing in staging
5. Deploy to production
6. Monitor logs for errors
7. Verify ROI calculations still accurate

### Rollback Plan
- If critical bug found:
  1. Revert code to previous version
  2. Remove UI components (EditableValueField, etc)
  3. Custom values data remains in database (safe)
  4. ROI calculations revert to sticker values
  5. No data loss, no database cleanup needed

### Monitoring
- Log all server action calls to custom-values actions
- Track error rates: unauthorized, validation errors, server errors
- Monitor response times for update operations
- Alert if error rate > 1%

---

## Success Metrics

### Feature Adoption
- % of users who set at least one custom value
- Total number of custom values set (per week/month)
- Average custom values per active user

### Engagement
- Average number of benefits customized per user
- Frequency of value edits (edits per week)
- Use of bulk editor vs single edits

### Data Quality
- % of custom values within 50%-200% of sticker value (expected range)
- % of custom values > 300% of sticker value (potential outliers)
- Revert rate (reverts per 100 edits)

### Performance
- P95 response time for updateCustomValue < 500ms
- P95 response time for bulkUpdateCustomValues < 1000ms
- Error rate < 1%

### User Satisfaction
- Feature usage vs no usage: survey users about usefulness
- NPS question: "How useful is custom benefit values?"

---

## Open Questions & Future Enhancements

### Future Phase Possibilities
1. **Admin Dashboard Custom Values View:**
   - Admins can view/audit all users' custom values
   - Export custom value data for analysis
   - Override user's custom value if needed

2. **Custom Value Presets:**
   - "Quick presets" like +10%, +20%, +50% of sticker value
   - User-defined presets (save favorite custom values)
   - Recommended presets based on user's spending

3. **Value Suggestions:**
   - ML model suggests custom values based on user's transaction history
   - "You typically spend $2 per transaction on dining, try $200 value"

4. **Value Categories/Rules:**
   - Rules-based custom values: "Always set dining to X% above master"
   - Category-level overrides (all statement credits, all perks)

5. **Offline Support:**
   - Cache custom values locally
   - Queue edits while offline
   - Sync when online

6. **Collaborative Custom Values:**
   - Multiple users share custom value configs
   - Family/household-level custom values

7. **Advanced Audit:**
   - Admin view of all value changes with detailed audit trail
   - Export audit logs
   - Webhook notifications on value changes

8. **A/B Testing:**
   - Test different value presets with user segments
   - Track ROI accuracy improvements with custom values

---

## Document Control

**Version History:**
- v1.0 (2024-04-06): Initial technical specification complete

**Approval Sign-Off:**
- Architecture: APPROVED (Ready for Phase 4B-A implementation)
- Product: PENDING
- QA: PENDING

**Revision Notes:**
- Complete comprehensive spec with all sections from requirements
- Ready for development team handoff
- Component stub implementations exist; full implementation needed
- Server actions need completion and testing

