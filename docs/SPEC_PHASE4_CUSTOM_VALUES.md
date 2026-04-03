# Card Benefits Tracker - Custom Benefit Values UI Specification

## Executive Summary

This specification defines the interface and workflow for customizing benefit values in the Card Benefits Tracker. Users can override benefit "sticker values" (advertised amounts) with personalized valuations based on their actual usage and perceived worth. These custom values directly impact ROI calculations, enabling accurate financial tracking that reflects each user's unique benefit utilization.

**Primary Objectives:**
- Provide intuitive UI for overriding benefit sticker values
- Display both master and custom values for clarity
- Validate user inputs (positive values, reasonable ranges)
- Update ROI calculations instantly upon value change
- Maintain audit trail of value modifications
- Support both individual and bulk value updates

---

## Functional Requirements

### FR1: Inline Value Editing
- Users can edit benefit value directly in benefit list
- Hover/click to activate edit mode
- Show current value (sticker and custom)
- Accept numeric input in dollars and cents
- Auto-save on blur or Enter key
- Show loading state during save
- Display success/error feedback

### FR2: Value Comparison Display
- Show sticker value (advertised/master value)
- Show custom value if set (user override)
- Show difference percentage (custom vs sticker)
- Show which is active in calculations
- Highlight when custom differs significantly from sticker

### FR3: ROI Recalculation on Change
- When user changes value, recalculate benefit ROI instantly
- Recalculate card ROI (sum of benefits)
- Recalculate player/wallet total ROI
- Update dashboard summary without page reload
- Show before/after ROI comparison

### FR4: Input Validation
- Require non-negative numeric values
- Validate input format (supports dollars.cents)
- Warn if custom value is unreasonably low (< 10% of sticker)
- Warn if custom value is unreasonably high (> 150% of sticker)
- Prevent non-numeric input
- Show validation errors inline

### FR5: Value Presets
- Quick-set buttons: "Use sticker value" (reset to default)
- Quick-set buttons: "50% of sticker", "75% of sticker", etc.
- Custom value modal for detailed editing
- Preset options customizable per benefit type

### FR6: Audit Trail
- Track when values changed and by whom
- Store old value and new value
- Timestamp all changes
- Display change history (optional)
- Log in background without impacting UX

### FR7: Bulk Value Updates
- Select multiple benefits to edit
- Apply value override to all selected
- Confirm bulk change with preview
- Rollback if confirmation fails
- Show affected ROI changes

### FR8: Clear/Reset to Default
- One-click button to clear custom value
- Revert to sticker value in calculations
- Confirm if value significantly different
- Update ROI immediately

### FR9: Mobile-Friendly Editing
- Touch-friendly input fields
- Numeric keyboard on mobile
- Swipe to reveal edit controls
- Support portrait and landscape orientations

### FR10: Accessibility
- Keyboard navigation throughout
- Screen reader friendly labels
- Clear visual indicators of editable fields
- Error messages linked to inputs

---

## Functional Requirements (continued)

### FR11: Benefit Type-Specific Presets
- StatementCredit: Suggest preset percentages (100%, 90%, 75%, 50%)
- UsagePerk: Suggest actual usage value presets
- Different UI for different benefit types

### FR12: Historical Value Tracking
- Show previous value if user made multiple changes
- Display tooltip with full history on hover
- Option to view detailed change log
- Revert to previous value if needed

### FR13: Bulk Import Integration
- Import CSV with custom values
- Support userDeclaredValue column in CSV
- Validate values during import
- Preview custom values before committing

---

## Critical Amendments - QA Issue Resolution

### Amendment #11: ROI Recalculation Scope - Complete Specification

**When custom benefit values change, the system MUST recalculate ROI at multiple levels.**

#### ROI Recalculation Scope

When user changes a benefit's userDeclaredValue:

```
CUSTOM VALUE CHANGED
  ↓
Benefit-level:
  ├─ Calculate: Benefit ROI = (userDeclaredValue / annualFee) * 100
  └─ Update: Shown next to benefit name
  ↓
Card-level:
  ├─ Recalculate: Sum of all benefit ROI values
  ├─ Formula: (sum of userDeclaredValues) / (annual fee) * 100
  └─ Update: Card ROI badge (Dashboard, Card Details)
  ↓
Player-level:
  ├─ Recalculate: Sum of ROI from all cards
  ├─ Formula: (total userDeclaredValues across cards) / (total annual fees) * 100
  └─ Update: Player stats panel
  ↓
Household-level:
  ├─ Recalculate: Sum of all players' ROI
  ├─ Formula: (household total userDeclaredValues) / (household total fees) * 100
  └─ Update: Dashboard summary metrics
```

#### Display Locations (All Must Update)

When benefit value changes from $100 → $150:

```
1. Benefit card (in benefits list):
   OLD: "Travel Credit: $100 (sticker value)"
   NEW: "Travel Credit: $150 (your value)"

2. Card ROI badge:
   OLD: "13% ROI"
   NEW: "15% ROI" (because benefit value increased)

3. Card total value:
   OLD: "$3,500 annual value"
   NEW: "$3,600 annual value" (sum of all benefits changed)

4. Player stats (if showing):
   OLD: "Your 5 cards earn $12,400/year"
   NEW: "Your 5 cards earn $12,500/year"

5. Dashboard summary:
   OLD: "Household ROI: 8.5%"
   NEW: "Household ROI: 8.7%"
```

#### Caching Strategy

**Problem:** Recalculating ROI for every keystroke is expensive
**Solution:** Cache with invalidation

```typescript
// ROI cache with TTL
const roiCache = new Map<string, {
  value: number;
  calculatedAt: Date;
  level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD';
}>();

const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

async function getROI(
  level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD',
  id: string,
  options?: { bypassCache?: boolean }
): Promise<number> {
  const cacheKey = `${level}:${id}`;
  const cached = roiCache.get(cacheKey);

  // Return cached value if fresh
  if (
    !options?.bypassCache &&
    cached &&
    Date.now() - cached.calculatedAt.getTime() < CACHE_TTL_MS
  ) {
    return cached.value;
  }

  // Recalculate
  const roi = await calculateROI(level, id);
  roiCache.set(cacheKey, { value: roi, calculatedAt: new Date(), level });

  return roi;
}

// For real-time updates, bypass cache
async function getROIRealTime(
  level: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD',
  id: string
): Promise<number> {
  return getROI(level, id, { bypassCache: true });
}
```

#### Refresh/Invalidation Triggers

**Invalidate affected cache entries when:**

```typescript
async function invalidateROICache(
  triggerLevel: 'BENEFIT' | 'CARD' | 'PLAYER' | 'HOUSEHOLD',
  affectedIds: string[]
): Promise<void> {
  // Invalidate at trigger level and all parent levels
  for (const id of affectedIds) {
    if (triggerLevel === 'BENEFIT') {
      // Invalidate: benefit, card, player, household
      roiCache.delete(`BENEFIT:${id}`);

      const benefit = await db.userBenefit.findUnique({ where: { id } });
      const card = await db.userCard.findUnique({ where: { id: benefit.userCardId } });
      const player = await db.player.findUnique({ where: { id: card.playerId } });

      roiCache.delete(`CARD:${card.id}`);
      roiCache.delete(`PLAYER:${player.id}`);
      roiCache.delete(`HOUSEHOLD:${player.householdId}`);

    } else if (triggerLevel === 'CARD') {
      // Invalidate: card, player, household
      roiCache.delete(`CARD:${id}`);

      const card = await db.userCard.findUnique({ where: { id } });
      const player = await db.player.findUnique({ where: { id: card.playerId } });

      roiCache.delete(`PLAYER:${player.id}`);
      roiCache.delete(`HOUSEHOLD:${player.householdId}`);

    } else if (triggerLevel === 'PLAYER') {
      // Invalidate: player, household
      roiCache.delete(`PLAYER:${id}`);

      const player = await db.player.findUnique({ where: { id } });
      roiCache.delete(`HOUSEHOLD:${player.householdId}`);

    } else if (triggerLevel === 'HOUSEHOLD') {
      // Invalidate: household only
      roiCache.delete(`HOUSEHOLD:${id}`);
    }
  }
}
```

**Triggers that MUST invalidate cache:**

1. **User sets custom value** (FR3)
   - Trigger: BENEFIT
   - Affects: Benefit, Card, Player, Household ROI
   - Time: Immediately when user saves value

2. **User claims/unclaims benefit** (Integration with Benefits)
   - Trigger: BENEFIT
   - Rationale: Claimed benefits may affect ROI display
   - Time: When claim status changes

3. **Card annual fee updated** (Integration with Card Management)
   - Trigger: CARD
   - Affects: Card, Player, Household ROI
   - Time: When renewal fee changes

4. **Benefit added/removed** (Integration with Import/Add)
   - Trigger: CARD
   - Affects: Card, Player, Household ROI
   - Time: When benefit is created/deleted

5. **Card added/removed** (Integration with Card Management)
   - Trigger: PLAYER
   - Affects: Player and Household ROI
   - Time: When card is added/deleted

6. **Player joined/left household** (Integration with Auth)
   - Trigger: HOUSEHOLD
   - Affects: Household ROI only
   - Time: When household membership changes

#### Real-Time ROI Display

When user edits value inline:

```typescript
async function updateBenefitValue(
  benefitId: string,
  newValue: number
): Promise<{ benefit: UserBenefit; updatedROIs: ROIValues }> {
  // 1. Save new value
  const benefit = await db.userBenefit.update({
    where: { id: benefitId },
    data: { userDeclaredValue: newValue }
  });

  // 2. Invalidate affected cache
  await invalidateROICache('BENEFIT', [benefitId]);

  // 3. Calculate fresh ROI values (no cache)
  const updatedROIs = {
    benefit: await getROIRealTime('BENEFIT', benefitId),
    card: await getROIRealTime('CARD', benefit.userCardId),
    player: await getROIRealTime('PLAYER', benefit.card.playerId),
    household: await getROIRealTime('HOUSEHOLD', benefit.card.player.householdId)
  };

  // 4. Return to UI for immediate display
  return { benefit, updatedROIs };
}

// Client-side: Show fresh ROI values immediately
async function handleValueChange(newValue: number) {
  // Optimistic UI update (instant visual feedback)
  setLocalROI(newValue);

  try {
    // Save to server
    const { updatedROIs } = await updateBenefitValue(benefitId, newValue);

    // Update UI with server-confirmed values
    setDisplayROI(updatedROIs);

  } catch (error) {
    // Revert on error
    setDisplayROI(oldROI);
    showError('Failed to update value');
  }
}
```

#### Performance Considerations

**Calculation Complexity:**

```
Benefit ROI: O(1)
  - Just: (userDeclaredValue / annualFee) * 100
  - Time: <1ms

Card ROI: O(n) where n = benefits per card
  - Average: 3-5 benefits
  - Max: ~20 benefits (edge case)
  - Time: 5-20ms

Player ROI: O(m) where m = cards per player
  - Average: 2-5 cards
  - Max: ~50 cards (extreme case)
  - Time: 10-50ms

Household ROI: O(k) where k = total benefits in household
  - Average: 10-30 benefits
  - Max: ~200 benefits (large household)
  - Time: 20-100ms
```

**With 5-minute caching:**
- Cache hit: <5ms
- Cache miss: 10-100ms (acceptable)
- Real-time (no cache): 10-100ms (acceptable for single save)

**No performance issues expected.**

#### Edge Cases

**Edge Case 1: Multiple rapid changes**

```
User rapidly changes value: $100 → $150 → $120 → $180

Behavior:
  - Each keystroke invalidates cache
  - Recalculates on each save (acceptable for User events)
  - After 5 minutes, cache stabilizes if no more changes
  - No stale data shown to user
```

**Edge Case 2: Imported benefit already has userDeclaredValue**

```
Existing benefit: userDeclaredValue = $100
User edits to: userDeclaredValue = $200

Behavior:
  - Old value: $100
  - New value: $200
  - Invalidate cache
  - ROI recalculates with new value
  - Log change in audit trail (see FR6: Audit Trail)
```

**Edge Case 3: Bulk edit with many benefits**

```
User bulk edits 50 benefits: Set all to $100

Behavior:
  - For each benefit, update value
  - Collect benefitIds: [id1, id2, ..., id50]
  - Call invalidateROICache('BENEFIT', benefitIds) once
  - Recalculate Card, Player, Household ROI once (batched)
  - Total time: ~50-100ms
```

**Edge Case 4: Zero custom value**

```
User sets userDeclaredValue = 0

Behavior:
  - Benefit is effectively worthless in ROI calc
  - Card ROI might drop significantly
  - System allows (it's valid input)
  - User can reset to sticker value (FR8: Clear/Reset)
```

#### Implementation Checklist

- [ ] Cache implementation (get, set, invalidate)
- [ ] Invalidation triggers in all relevant operations
- [ ] ROI calculation at 4 levels (benefit, card, player, household)
- [ ] Real-time display without stale data
- [ ] Performance testing with 100+ cards/benefits
- [ ] Cache TTL properly set (5 minutes)
- [ ] Test all edge cases (rapid changes, bulk edit, zero values)
- [ ] Audit trail logged for all value changes
- [ ] Documentation on cache invalidation patterns

#### Updated Implementation Task List

**Phase 2 additions:**
- Task 2.1: Implement ROI cache layer (3-4 hours)
- Task 2.2: Add invalidation triggers (3-4 hours)
- Task 2.3: Implement real-time ROI display (2-3 hours)

**Phase 4 additions:**
- Task 4.1: Performance testing with large wallets (3-4 hours)
- Task 4.2: Cache hit/miss testing (2-3 hours)
- Task 4.3: Edge case testing (rapid changes, bulk ops) (3-4 hours)

---

## Implementation Phases

### Phase 1: Core Value Editing UI (Days 1-2)
**Objectives:** Build basic inline editing and validation
- Estimated Scope: Medium (8-10 hours)
- Create EditableValue component
- Implement input validation
- Add auto-save mechanism
- Create value display component

### Phase 2: ROI Integration (Days 3-4)
**Objectives:** Connect value changes to ROI calculations
- Estimated Scope: Medium (8-10 hours)
- Integrate with existing ROI calculation system
- Real-time ROI updates
- Performance optimization for calculations
- Test calculation accuracy

### Phase 3: Advanced Features (Days 5-6)
**Objectives:** Presets, history, bulk updates
- Estimated Scope: Medium (8-10 hours)
- Implement value presets UI
- Add change history tracking
- Implement bulk edit workflow
- Create preset management

### Phase 4: Testing & Polish (Days 7)
**Objectives:** Comprehensive testing and UX refinement
- Estimated Scope: Medium (8-10 hours)
- Unit tests for validation
- Integration tests for ROI updates
- E2E tests for complete workflows
- Accessibility testing

**Phase Dependencies:**
- Phase 1 → Phase 2 (requires editing UI)
- Phase 2 → Phase 3 (requires ROI integration)
- All phases → Phase 4 (test all features)

---

## Data Schema / State Management

### Database Schema Changes

#### UserBenefit Table Updates
```
UserBenefit {
  ...existing fields...

  userDeclaredValue: Int?              // User's custom valuation in cents
                                        // Null = use stickerValue in calculations
                                        // Set = override stickerValue in calculations

  valueHistory: String?                 // JSON array of historical values
                                        // [{value: 30000, changedAt: DateTime, changedBy: userId}]

  valueUpdatedAt: DateTime?             // When custom value was last set
}
```

### Derived/Calculated Fields

```
BenefitValueDisplay {
  stickerValue: Int                     // Master value (read-only)
  customValue: Int | null               // User override (editable)
  effectiveValue: Int                   // Value used in calculations (custom or sticker)
  difference: Int                       // Absolute difference (effectiveValue - stickerValue)
  percentageDifference: number          // Relative difference as percentage
  isDifferent: boolean                  // true if custom != sticker
  isSignificant: boolean                // true if difference > 10%
}
```

### In-Memory State Management

```
BenefitValueState {
  benefitId: string
  editMode: boolean                     // Is user currently editing?
  pendingValue: Int | null              // Value being edited, not yet saved
  displayValue: Int | null              // Value shown in input
  isSaving: boolean                     // Server request in progress
  saveError: string | null              // Error message from save attempt
  lastSavedAt: DateTime                 // When last save completed
}

CardROIState {
  cardId: string
  previousROI: number
  currentROI: number
  isRecalculating: boolean              // ROI update in progress
  affectedBenefits: string[]            // Which benefits changed
}
```

### Change Tracking Schema

```
BenefitValueChange {
  benefitId: string
  userId: string
  oldValue: Int
  newValue: Int
  changedAt: DateTime
  changeReason?: string                 // Optional: why user changed it
}
```

---

## User Flows & Workflows

### Single Benefit Value Edit (Happy Path)

```
1. User views benefit in list/card view
   ├─ Benefit row shows:
   │  ├─ Benefit name: "Travel Credit"
   │  ├─ Sticker value: $300
   │  ├─ Custom value: (empty or "$X")
   │  ├─ Edit button / Quick presets
   │  └─ Current card/wallet ROI

2. User hovers over value or clicks edit button
   ├─ Edit mode activates
   ├─ Input field appears with current value
   ├─ Field focused and ready for input
   ├─ Current value highlighted for easy replacement

3. User types new value (e.g., "250")
   ├─ Input validates on each keystroke
   ├─ Shows live validation feedback
   ├─ Preview of impact on ROI (tooltip or side panel)

4. User presses Tab/Enter or clicks away (blur)
   ├─ Final validation runs
   ├─ Shows loading spinner
   ├─ Server updates UserBenefit.userDeclaredValue
   ├─ Server recalculates affected ROI values
   ├─ Returns updated benefit and card ROI

5. UI updates in place
   ├─ Value saved and displayed
   ├─ Edit mode closes
   ├─ Show success toast: "Value updated"
   ├─ ROI values update on dashboard
   ├─ No page reload needed

6. User continues browsing
   ├─ Can edit another benefit
   ├─ Can add/remove cards
   ├─ Dashboard stays synced
```

### Value Edit with Quick Preset

```
1. User clicks quick preset buttons (below benefit value)
   ├─ "Use sticker" - reset to default
   ├─ "50%" - set to 50% of sticker
   ├─ "75%" - set to 75% of sticker
   ├─ "Custom..." - open detailed modal

2. User clicks "75%"
   ├─ System calculates: $300 × 0.75 = $225
   ├─ Input updates to "$225"
   ├─ Auto-save triggers
   ├─ ROI updates in real-time

3. User sees preview
   ├─ Before: Card ROI 45%
   ├─ After: Card ROI 42% (adjusted down due to lower benefit value)
   ├─ Benefit ROI: now showing as $225 instead of $300
```

### Bulk Value Update

```
1. User selects multiple benefits via checkboxes
   ├─ "Travel Credit" on Chase Sapphire
   ├─ "Travel Credit" on AmEx Platinum
   ├─ "Dining Credit" on AmEx Gold

2. "Apply to selected" button appears
   ├─ User clicks it

3. Bulk edit modal opens
   ├─ Shows list of selected benefits (3 total)
   ├─ Input field for value override
   ├─ Preset buttons (50%, 75%, custom)
   ├─ Warning: "Will update 3 benefits"
   ├─ "Preview" button to see impact

4. User enters value "200" for all
   ├─ System calculates impact:
   │  ├─ Chase benefit: $300 → $200 (card ROI: 45% → 40%)
   │  ├─ AmEx benefit: $300 → $200 (card ROI: 50% → 45%)
   │  └─ AmEx benefit: $100 → $200 (card ROI: 60% → 62%)

5. User clicks "Confirm & Apply"
   ├─ All 3 benefits updated
   ├─ Card ROI values recalculated
   ├─ Toast: "Updated 3 benefits"
   ├─ Dashboard refreshed automatically
```

### Error Path: Invalid Input

```
1. User types invalid value "-50"
   ├─ Input shows error: "Value must be non-negative"
   ├─ Save button disabled
   ├─ No server call made

2. User types "abc"
   ├─ Input shows error: "Value must be numeric"
   ├─ Accepts only number input

3. User types "0"
   ├─ Accepted (zero is valid, benefit worth nothing to user)
   ├─ Auto-saves
   ├─ ROI recalculated (benefit now contributes $0)

4. User types "999999999" (unreasonably high)
   ├─ Validation warning: "Value seems unreasonably high (>150% of sticker)"
   ├─ Shows breakdown: "Sticker: $300, Entered: $999,999,999"
   ├─ Confirm button: "Yes, that's correct" or "Cancel"
   ├─ Prevents accidental typos
```

### Error Path: Save Failure

```
1. User edits value: "$200"
   ├─ Presses Enter
   ├─ System calls updateUserDeclaredValue()

2. Server error occurs (e.g., network timeout)
   ├─ Spinner shows for 3 seconds
   ├─ Error message appears: "Failed to save. Please try again."
   ├─ Value reverts to previous
   ├─ Edit mode closes

3. User can retry
   ├─ Click edit again
   ├─ Value shows previous state
   ├─ Can attempt save again
   ├─ No data loss

4. If persistent error
   ├─ Show contact support button
   ├─ Log error for debugging
   ├─ User can continue with other features
```

### History Viewing (Optional Feature)

```
1. User clicks "change history" icon on benefit
   ├─ Small popover appears

2. Shows recent changes:
   ├─ April 2: Changed from $300 to $250 (manual edit)
   ├─ April 1: Changed from $300 to $200 (bulk import)
   ├─ March 15: Initial sticker value $300

3. User can:
   ├─ Click any previous value to preview ROI impact
   ├─ Click "Restore" to revert to any previous value
   ├─ Close popover to continue
```

### State Transitions

#### EditMode Lifecycle
```
Idle → [User clicks edit] → Active → [User types] → PendingValidation
  ↑                                                        ↓
  └─────────────────── Saving ←──────────────────────────┘
                        ↓
                   Saved / Error
                        ↓
                       Idle
```

#### Value States
```
Sticker (original) → Custom (user override) → Sticker (user cleared)
```

---

## API Routes & Contracts

### Update Single Benefit Value

#### Server Action (Preferred for UI)
```typescript
// src/actions/benefits.ts (existing, extend)
export async function updateUserDeclaredValue(
  benefitId: string,
  valueInCents: number,
  changeReason?: string
): Promise<ActionResponse<BenefitWithROI>>
```

**Request:**
```
benefitId: string          // Benefit ID to update
valueInCents: number       // Value in cents (e.g., 25000 = $250)
changeReason: string?      // Optional reason for change (user note)
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "benefit": {
      "id": "ben_123",
      "name": "Travel Credit",
      "stickerValue": 30000,
      "userDeclaredValue": 25000,
      "isUsed": false,
      "expirationDate": "2024-12-31",
      "updatedAt": "2024-04-02T15:30:00Z"
    },
    "card": {
      "id": "card_123",
      "roi": 0.45,
      "annualValue": 175000,
      "updatedAt": "2024-04-02T15:30:00Z"
    },
    "wallet": {
      "totalROI": 0.42,
      "totalAnnualValue": 450000,
      "affectedCards": ["card_123"]
    }
  }
}
```

**Response Error (400):**
```json
{
  "success": false,
  "error": "VALIDATION_FIELD",
  "message": "Value must be non-negative",
  "details": {
    "field": "valueInCents",
    "reason": "Received -50, but must be >= 0"
  }
}
```

**Response Error (401/403):**
```json
{
  "success": false,
  "error": "AUTHZ_OWNERSHIP",
  "message": "Unauthorized to modify this benefit"
}
```

### Clear Custom Value

#### Server Action
```typescript
export async function clearUserDeclaredValue(
  benefitId: string
): Promise<ActionResponse<BenefitWithROI>>
```

**Request:**
```
benefitId: string
```

**Response:** Same as updateUserDeclaredValue, with userDeclaredValue: null

### Bulk Update Values

#### Server Action
```typescript
export async function bulkUpdateUserDeclaredValues(
  updates: {
    benefitId: string
    valueInCents: number
  }[],
  cardId?: string  // If provided, only update benefits on this card
): Promise<ActionResponse<BulkUpdateResult>>
```

**Request:**
```json
{
  "updates": [
    {"benefitId": "ben_1", "valueInCents": 25000},
    {"benefitId": "ben_2", "valueInCents": 15000},
    {"benefitId": "ben_3", "valueInCents": 0}
  ],
  "cardId": null
}
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "updated": 3,
    "failed": 0,
    "benefits": [
      {
        "id": "ben_1",
        "name": "Travel Credit",
        "userDeclaredValue": 25000,
        "updatedAt": "2024-04-02T15:30:00Z"
      }
    ],
    "wallet": {
      "totalROI": 0.41,
      "totalAnnualValue": 445000,
      "affectedCards": ["card_1", "card_2"]
    },
    "recalculatedAt": "2024-04-02T15:30:00Z"
  }
}
```

### Get Benefit Value History

#### Server Action
```typescript
export async function getBenefitValueHistory(
  benefitId: string,
  limit: number = 10
): Promise<ActionResponse<ValueHistoryResult>>
```

**Response Success (200):**
```json
{
  "success": true,
  "data": {
    "benefitId": "ben_123",
    "history": [
      {
        "value": 25000,
        "changedAt": "2024-04-02T15:30:00Z",
        "changedBy": "user_1",
        "reason": "Manual adjustment"
      },
      {
        "value": 30000,
        "changedAt": "2024-04-01T10:00:00Z",
        "changedBy": "system",
        "reason": "Imported from CSV"
      },
      {
        "value": 30000,
        "changedAt": "2024-03-15T12:00:00Z",
        "changedBy": "system",
        "reason": "Initial sticker value"
      }
    ],
    "current": {
      "value": 25000,
      "type": "custom"  // 'custom' or 'sticker'
    }
  }
}
```

### Revert to Previous Value

#### Server Action
```typescript
export async function revertUserDeclaredValue(
  benefitId: string,
  historyIndex: number  // Index in history array to revert to
): Promise<ActionResponse<BenefitWithROI>>
```

---

## Component Architecture

### UI Components

#### 1. EditableValueField Component
```
EditableValueField
├─ Props:
│  ├─ benefitId: string
│  ├─ currentValue: Int | null
│  ├─ stickerValue: Int
│  ├─ onSave: (value: Int) => Promise<void>
│  ├─ presets?: number[]
│  └─ disabled?: boolean
│
├─ State:
│  ├─ isEditing: boolean
│  ├─ pendingValue: string
│  ├─ isSaving: boolean
│  ├─ error: string | null
│  └─ success: boolean
│
├─ Behavior:
│  ├─ Display: Shows effective value with sticker comparison
│  ├─ Click: Activates edit mode
│  ├─ Type: Validates on each keystroke
│  ├─ Blur/Enter: Saves to server
│  └─ Error: Shows inline error message
│
└─ Renders:
   ├─ Display Mode:
   │  ├─ Value display with $ formatting
   │  ├─ Sticker value label
   │  ├─ % difference badge
   │  └─ Edit button
   │
   └─ Edit Mode:
      ├─ Input field (number type)
      ├─ Validation error (if any)
      ├─ Loading spinner (while saving)
      ├─ Quick preset buttons
      └─ Clear/Reset button
```

#### 2. BenefitValuePresets Component
```
BenefitValuePresets
├─ Props:
│  ├─ stickerValue: Int
│  ├─ currentValue: Int | null
│  ├─ onSelect: (value: Int) => void
│  ├─ presetOptions?: PresetOption[]
│  └─ benefitType: 'StatementCredit' | 'UsagePerk'
│
├─ Presets Shown:
│  ├─ "Use Sticker" → stickerValue
│  ├─ "50%" → stickerValue * 0.5
│  ├─ "75%" → stickerValue * 0.75
│  ├─ "90%" → stickerValue * 0.9
│  └─ "Custom..." → Open modal
│
└─ Renders:
   ├─ Button row with preset percentages
   ├─ Each button shows $ amount and %
   ├─ Highlight current selection
   └─ "Custom" button (or three-dots menu on mobile)
```

#### 3. BenefitValueComparison Component
```
BenefitValueComparison
├─ Props:
│  ├─ benefitId: string
│  ├─ name: string
│  ├─ stickerValue: Int
│  ├─ customValue: Int | null
│  ├─ benefitROI: number
│  ├─ previousBenefitROI?: number
│  └─ showHistory?: boolean
│
└─ Renders:
   ├─ Side-by-side comparison
   │  ├─ Sticker: $300 (master value)
   │  ├─ Custom: $250 (your value)
   │  └─ Difference: -$50 (-16.67%)
   ├─ ROI impact
   │  ├─ Benefit ROI: 45%
   │  ├─ Card ROI: 48% (↑2% from your customization)
   │  └─ Annual value: $4,500 (vs $5,400 at sticker)
   └─ History button (if enabled)
```

#### 4. ValueHistoryPopover Component
```
ValueHistoryPopover
├─ Props:
│  ├─ benefitId: string
│  ├─ history: ValueChange[]
│  ├─ currentValue: Int | null
│  └─ onRevert: (index: number) => void
│
└─ Renders:
   ├─ Timeline of value changes
   │  ├─ April 2, 3:30 PM: $250 (Manual change)
   │  ├─ April 1, 10:00 AM: $300 (Imported)
   │  └─ March 15: $300 (Initial)
   ├─ For each entry:
   │  ├─ Value and date
   │  ├─ Who/what made change
   │  ├─ Optional change reason
   │  └─ Revert button
   └─ Preview: Show impact if reverting
```

#### 5. BulkValueEditor Component
```
BulkValueEditor
├─ Props:
│  ├─ selectedBenefits: BenefitInfo[]
│  ├─ onApply: (value: Int) => Promise<void>
│  └─ onCancel: () => void
│
├─ Workflow:
│  ├─ Step 1: Select benefits (checkbox UI)
│  ├─ Step 2: Choose value option
│  │  ├─ "Apply percentage of sticker"
│  │  ├─ "Set fixed amount"
│  │  └─ "Use preset templates"
│  ├─ Step 3: Preview changes
│  │  ├─ Show all affected benefits
│  │  ├─ Show before/after ROI
│  │  └─ Confirm or cancel
│  └─ Step 4: Apply and refresh
│
└─ Renders:
   ├─ List of selected benefits
   ├─ Input for value
   ├─ Preset buttons
   ├─ Impact preview section
   └─ Confirm/Cancel buttons
```

### Integration Points

#### With Benefit Listing Components
- EditableValueField embedded in benefit row
- BenefitValuePresets shown as popup/dropdown
- BenefitValueComparison shown as detail panel

#### With ROI Calculation System
- Call `calculateBenefitROI()` with userDeclaredValue
- Call `calculateCardROI()` with updated benefits
- Call `calculateWalletROI()` for total impact
- Existing system in src/lib/calculations.ts

#### With Dashboard
- Update displayed ROI values in real-time
- Trigger re-render of dashboard stats
- Use React Context or callback for state updates
- Maintain sync between benefit and card views

---

## Edge Cases & Error Handling

### 1. Sticker Value Changes After Custom Set
**Scenario:** User sets custom value to $200. Later, master catalog updates sticker value from $300 to $350.
**Handling:**
- Custom value persists at $200 (user's preference)
- Display updates to show new comparison: "Sticker $350 (was $300), Your value: $200"
- Recalculate ROI with new sticker baseline
- No automatic revert of custom value
- Test: Update master value while user has custom override

### 2. Zero Value Override
**Scenario:** User sets benefit value to $0 (doesn't use benefit)
**Handling:**
- Accept and allow zero value (valid case)
- Contribution to ROI is zero
- Display: "Your value: $0" (benefit contributes nothing)
- Card/wallet ROI recalculated excluding this benefit
- Test: Zero value handling in calculations

### 3. Extreme Value Inputs
**Scenario:** User types "999999999" or "0.01"
**Handling:**
- Validate max safe integer (Number.MAX_SAFE_INTEGER)
- Accept cents (smallest unit, no decimals)
- Warn if > 150% of sticker (likely typo)
- Require confirmation for extreme values
- Test: Boundary values, very large numbers, very small amounts

### 4. Rapid Successive Edits
**Scenario:** User quickly changes value 5 times in 2 seconds
**Handling:**
- Debounce auto-save (wait 500ms after last keystroke)
- Show loading state while saving
- Queue updates if save in progress
- Show "saving..." indicator
- Prevent race conditions (last update wins)
- Test: Rapid input changes, race condition handling

### 5. Network Timeout During Save
**Scenario:** Save request hangs for 10+ seconds
**Handling:**
- Timeout after 5 seconds
- Show error: "Network timeout. Please try again."
- Revert to previous value
- Allow retry without data loss
- Offline indication if connectivity lost
- Test: Timeout handling, network failures

### 6. Benefit Deleted While Editing
**Scenario:** User edits value. Benefit is deleted (soft delete) by admin or player removes card.
**Handling:**
- Server returns 404: Benefit not found
- UI shows: "This benefit is no longer available"
- Revert edit and close edit mode
- Update benefit list (show deletion)
- No orphaned state in UI
- Test: Resource deletion during edit

### 7. Authorization Error (User Changed)
**Scenario:** User logs out then logs back in. Session invalid. Attempt to save.
**Handling:**
- Server returns 401: Unauthorized
- UI: "Your session expired. Please log in again."
- Clear pending edits
- Redirect to login
- No partial updates
- Test: Session expiration during edit

### 8. Concurrent Edit by Another Session
**Scenario:** User edits benefit. Another browser tab also edits same benefit. First save wins.
**Handling:**
- First save succeeds
- Second save: Server returns latest value (concurrency conflict)
- UI shows: "This benefit was modified elsewhere. Refreshing..."
- Load latest value from server
- Show new value to user
- Allow user to edit again if desired
- Test: Concurrent updates detection

### 9. Bulk Edit with Mixed Validations
**Scenario:** User bulk edits 5 benefits. 2 have invalid new values (negative, too large).
**Handling:**
- Validation runs on all before any save
- Report which benefits have errors
- Block save until all errors fixed
- Show each error individually
- Allow user to fix and retry
- Test: Bulk validation, partial failures

### 10. Value Doesn't Update Due to Calculate Error
**Scenario:** Save succeeds on server. ROI recalculation fails (edge case in calculations.ts).
**Handling:**
- Server catches calculation error
- Returns: "Value saved, but ROI calculation failed. Refresh to sync."
- Store value in database (primary goal met)
- Allow manual refresh
- Log error for debugging
- Test: Calculation error resilience

### 11. Editing Claimed Benefit
**Scenario:** User claimed benefit (isUsed=true, claimedAt set). Later edits value.
**Handling:**
- Allow editing claimed benefits (value is still part of ROI)
- Update calculation to reflect new claimed value
- Show that benefit is claimed in UI
- Test: Editing claimed benefits impact on metrics

### 12. Value Override with Importing
**Scenario:** User imports CSV with custom values. Then manually edits some. Conflicts arise.
**Handling:**
- Import sets userDeclaredValue
- Manual edit overrides import value
- Both stored in valueHistory with source annotation
- Revert to any previous value including import
- Test: Manual edit overrides import, history tracking

### 13. Batch Update Partial Failure
**Scenario:** Bulk update 10 benefits. Database constraint violation on benefit #5.
**Handling:**
- Transaction rollback (no partial updates)
- Response: "Failed to update due to constraint error"
- Show which benefit caused issue
- Return to edit without losing input
- Allow user to exclude problematic benefit and retry
- Test: Bulk update rollback on error

### 14. Custom Value for Expired Benefit
**Scenario:** User edits value for benefit that has expired (expirationDate < now).
**Handling:**
- Allow edit (value change is still valid)
- Show warning: "This benefit has expired (12/31/2024)"
- Inform that it won't contribute to current period ROI
- Update calculation to exclude from active benefits
- Include in historical ROI
- Test: Expired benefit value editing

### 15. Memory/Performance with Large Wallet
**Scenario:** Wallet has 200 benefits. Edit one value. Recalculation affects all ROI values.
**Handling:**
- Calculate efficiently (memoization of intermediate values)
- Update only affected components (benefit, card, wallet)
- Show loading state if calculation > 500ms
- Batch UI updates
- No browser freezing
- Test: Performance with large wallets (200+ benefits)

---

## Component Architecture (Detailed)

### Data Flow Architecture

```
User Input (Edit Value)
    ↓
EditableValueField Component
    ├─ Validates input locally
    ├─ Prevents invalid input
    ├─ Shows loading state
    └─ Calls server action: updateUserDeclaredValue()
         ↓
    Server Action (src/actions/benefits.ts)
    ├─ Validates benefitId (authorization)
    ├─ Validates value (non-negative, max safe int)
    ├─ Updates UserBenefit.userDeclaredValue
    ├─ Records value change in valueHistory
    ├─ Calls calculateBenefitROI() with new value
    ├─ Calls calculateCardROI() for card total
    ├─ Calls calculateWalletROI() for wallet total
    ├─ Returns updated benefit + ROI values
    └─ Transaction completes
         ↓
    Component Updates UI
    ├─ Shows new value display
    ├─ Updates ROI badges/text
    ├─ Clears loading state
    ├─ Shows success toast
    └─ Closes edit mode
         ↓
    Dashboard Auto-Updates
    ├─ React Context triggers
    ├─ Connected components re-render
    ├─ Summary stats update
    └─ No page reload needed
```

### Component Composition

```
BenefitCard / BenefitRow
├─ BenefitInfo
│  ├─ Icon + Name
│  └─ Type badge
├─ EditableValueField
│  ├─ Display mode (sticker + custom)
│  └─ Edit mode (input + presets)
├─ ROI Display
│  ├─ Benefit ROI %
│  ├─ Annual value $
│  └─ Change from sticker
└─ Actions
   ├─ Edit (click to activate)
   ├─ More options (...)
   └─ Toggle used/unused
```

### State Management Strategy

**Local Component State (EditableValueField):**
- `isEditing`: boolean (edit mode active)
- `pendingValue`: string (input field content)
- `isSaving`: boolean (server request in progress)
- `error`: string | null (validation/save error)

**Server State (Database):**
- `UserBenefit.userDeclaredValue`: Int | null
- `UserBenefit.valueUpdatedAt`: DateTime
- `UserBenefit.valueHistory`: JSON array

**Global State (React Context, if needed):**
- `WalletROI`: number (total wallet ROI)
- `CardROI`: { [cardId]: number } (per-card ROI)
- `LastUpdateTime`: DateTime (cache invalidation)

**Optimization:**
- Memoize ROI calculations
- Batch updates to reduce re-renders
- Debounce auto-save
- Only re-render affected components

---

## Implementation Tasks

### Phase 1: Core Value Editing

**Task 1.1:** Create EditableValueField component
- Complexity: Medium (4-5 hours)
- Display component showing sticker and custom values
- Click/hover to activate edit mode
- Input field with validation
- Quick preset buttons
- Auto-save on blur
- Acceptance criteria:
  - Display shows both sticker and custom values
  - Edit mode activates on click
  - Input validates numeric values
  - Saves on blur/Enter with loading state
  - Error messages show inline

**Task 1.2:** Implement value validation utilities
- Complexity: Small (2-3 hours)
- Create src/lib/benefitValueValidation.ts
- Validate non-negative values
- Validate max safe integer
- Check for unreasonable values (< 10%, > 150% of sticker)
- Format errors clearly
- Acceptance criteria:
  - All validation rules working
  - Clear error messages
  - Test coverage 100%

**Task 1.3:** Create BenefitValueComparison component
- Complexity: Small (2-3 hours)
- Display sticker vs custom comparison
- Show difference percentage
- Show which is active
- Highlight when significantly different
- Acceptance criteria:
  - Component renders correctly
  - Math accurate for percentages
  - Visual highlight working

**Task 1.4:** Add database schema for value history
- Complexity: Small (1-2 hours)
- Add valueHistory column to UserBenefit
- Add valueUpdatedAt column
- Run Prisma migration
- Acceptance criteria:
  - Schema updated correctly
  - Migration runs cleanly
  - Backward compatible

### Phase 2: ROI Integration

**Task 2.1:** Integrate with ROI calculation system
- Complexity: Medium (4-5 hours)
- Update calculateBenefitROI() to use userDeclaredValue if present
- Update calculateCardROI() to sum updated benefits
- Update calculateWalletROI() for total impact
- Return ROI deltas (before/after)
- Acceptance criteria:
  - ROI calculations use custom values
  - Deltas calculated correctly
  - No breaking changes to existing calcs

**Task 2.2:** Implement value update server action
- Complexity: Medium (3-4 hours)
- Extend src/actions/benefits.ts with updateUserDeclaredValue
- Validate inputs server-side
- Update UserBenefit
- Record change in valueHistory
- Return updated data + new ROI values
- Add authorization checks
- Acceptance criteria:
  - Action updates database correctly
  - ROI values returned accurately
  - Authorization enforced
  - Error handling comprehensive

**Task 2.3:** Real-time dashboard ROI updates
- Complexity: Medium (4-5 hours)
- Use React Context to share ROI state
- Update dashboard components on value change
- Debounce and batch calculations
- Show loading states during recalc
- No page reload needed
- Acceptance criteria:
  - Dashboard updates in real-time
  - No flashing/jarring updates
  - Performance acceptable (< 500ms)

**Task 2.4:** ROI change visualization
- Complexity: Small (2-3 hours)
- Show before/after ROI comparison
- Display change delta with up/down arrow
- Show percentage and absolute change
- Color coding (green for improvement, red for decline)
- Acceptance criteria:
  - Visual changes clear
  - Math accurate
  - Accessible colors

### Phase 3: Advanced Features

**Task 3.1:** Implement value presets UI
- Complexity: Small (2-3 hours)
- Create BenefitValuePresets component
- Show preset buttons (50%, 75%, 90%, 100%)
- Calculate preset values correctly
- Auto-save on preset selection
- Acceptance criteria:
  - Presets display correctly
  - Clicking preset saves value
  - Calculations accurate

**Task 3.2:** Add value history tracking and display
- Complexity: Medium (3-4 hours)
- Record all value changes with timestamps
- Create BenefitValueHistoryPopover component
- Show change timeline
- Implement revert-to-previous functionality
- Acceptance criteria:
  - History recorded for all changes
  - Popover displays timeline correctly
  - Revert functionality works

**Task 3.3:** Implement bulk value update workflow
- Complexity: Medium (4-5 hours)
- Create BulkValueEditor component
- Multi-step workflow (select → configure → preview → apply)
- Implement bulkUpdateUserDeclaredValues server action
- Show ROI impact preview before applying
- Acceptance criteria:
  - All steps functional
  - Bulk update server action works
  - Preview shows accurate impact
  - Rollback on error

**Task 3.4:** Integration with CSV import
- Complexity: Small (2-3 hours)
- Support userDeclaredValue column in import CSV
- Validate values during import
- Preview custom values before commit
- Acceptance criteria:
  - CSV import supports custom values
  - Validation works during import
  - Preview shows values correctly

### Phase 4: Testing & Polish

**Task 4.1:** Unit tests for validation and calculations
- Complexity: Medium (4-5 hours)
- Test validation rules (20+ tests)
- Test ROI calculation updates (25+ tests)
- Test edge cases (zero, max values, etc)
- Test calculation accuracy
- Acceptance criteria:
  - Coverage 90%+
  - All paths tested
  - Edge cases covered

**Task 4.2:** Component and integration tests
- Complexity: Medium (4-5 hours)
- Test EditableValueField (15+ tests)
- Test bulk update workflow (10+ tests)
- Test real-time dashboard updates (8+ tests)
- Test error handling (15+ tests)
- Acceptance criteria:
  - Coverage 85%+
  - All workflows tested
  - Error paths tested

**Task 4.3:** E2E tests for complete workflows
- Complexity: Medium (3-4 hours)
- Playwright test for single value edit
- Playwright test for bulk update
- Playwright test for revert/history
- Playwright test for error scenarios
- Acceptance criteria:
  - 8-10 E2E tests
  - Critical paths covered
  - Tests stable and reliable

**Task 4.4:** Performance optimization
- Complexity: Small (2-3 hours)
- Profile ROI calculation performance
- Optimize for large wallets (200+ benefits)
- Implement memoization if needed
- Test with stress scenarios
- Acceptance criteria:
  - Update completes in < 500ms
  - No browser freezing
  - Memory usage reasonable

**Task 4.5:** Accessibility and mobile testing
- Complexity: Small (2-3 hours)
- Test keyboard navigation
- Test screen reader support
- Test mobile touch interactions
- Test portrait and landscape
- Acceptance criteria:
  - WCAG 2.1 AA compliant
  - Mobile responsive
  - Keyboard accessible

---

## Security & Compliance Considerations

### Authorization
- All updates verify user owns the benefit (via player ownership)
- No cross-user data modification possible
- Session validation on every action

### Input Validation
- Server-side validation mandatory (never trust client)
- Validate value is non-negative, max safe integer
- No code execution or template evaluation
- Sanitize error messages (no sensitive data)

### Audit Trail
- All value changes recorded with timestamp and user ID
- valueHistory column immutable (append-only)
- Track source of change (manual, import, system)
- Enable accountability and dispute resolution

### Data Privacy
- No exposure of other users' values
- Export respects user's data ownership
- No logging of sensitive change reasons
- Encryption at rest for PostgreSQL (if configured)

---

## Performance & Scalability Considerations

### Calculation Performance

**Targets:**
- Single benefit value update: < 100ms
- Card ROI recalculation: < 200ms
- Wallet ROI recalculation: < 300ms
- Bulk update 100 benefits: < 1 second

**Optimization Strategies:**
- Memoize ROI calculations (cache intermediate results)
- Only recalculate affected cards/wallet
- Batch database updates
- Debounce auto-save (500ms wait)
- Use Prisma's batch query optimization

### Database Query Optimization

**Queries:**
- Fetch benefit + card + player in single query (eager load)
- Update benefit + record history atomically
- Bulk update via createMany + updateMany

**Indexes:**
- UserBenefit(userCardId, isUsed, expirationDate)
- UserCard(playerId)
- User(id)

### Caching Strategies
- Cache card ROI calculations (invalidate on any benefit change)
- Cache wallet ROI (invalidate on any card change)
- In-memory cache with 5-minute TTL for master data

### Scalability for Growth
- Current design supports 100K+ benefits per user
- ROI calculation O(n) complexity acceptable
- No architectural changes needed for foreseeable growth
- Consider job queue for bulk imports/exports (future)

---

## Quality Control Checklist

- [x] All functional requirements addressed
- [x] Data schema supports value tracking and history
- [x] API design consistent with existing patterns
- [x] All user flows documented with error paths
- [x] 15 edge cases documented with handling strategies
- [x] Components modular and independently testable
- [x] Implementation tasks specific with clear acceptance criteria
- [x] Security and authorization verified
- [x] Performance targets defined
- [x] Documentation clear for implementation team
- [x] Accessibility requirements specified
- [x] Mobile-responsive design considered

---

## References & Examples

### Sample Value Changes

**Change 1: Manual Adjustment**
```json
{
  "benefitId": "ben_123",
  "userId": "user_456",
  "oldValue": 30000,
  "newValue": 25000,
  "changedAt": "2024-04-02T15:30:00Z",
  "source": "manual",
  "reason": "I rarely use this credit, worth less to me"
}
```

**Change 2: Import**
```json
{
  "benefitId": "ben_789",
  "userId": "user_456",
  "oldValue": null,
  "newValue": 20000,
  "changedAt": "2024-04-01T10:00:00Z",
  "source": "import",
  "importJobId": "imp_abc123"
}
```

### Sample Component Usage

```typescript
// In a benefit row component
<EditableValueField
  benefitId="ben_123"
  currentValue={25000}
  stickerValue={30000}
  onSave={async (value) => {
    const result = await updateUserDeclaredValue(benefitId, value);
    if (!result.success) throw new Error(result.error);
    // UI updates automatically via context
  }}
  presets={[15000, 22500, 30000]}
/>
```

---

**Document Version:** 1.0
**Last Updated:** April 2, 2026
**Status:** Ready for Implementation
**Next Phase:** Task 1.1 - Create EditableValueField component
