# Card Management Feature - Refined Technical Specification

**Document Version:** 2.0 (Refined)  
**Last Updated:** April 3, 2024  
**Status:** Ready for Implementation  
**Audience:** Full-Stack Engineers, QA, Product

---

## Executive Summary

This specification defines the complete card management and wallet interface for the Card Benefits Tracker. The feature enables users to manage their credit card portfolio with add, edit, view, archive, search, filter, and bulk operations. The system maintains card lifecycle from active use through closure while preserving historical data for analysis.

**Core Value Proposition:**
- Intuitive card management interface with multiple view modes
- Real-time search and filtering across card attributes
- Automatic ROI calculation and impact visualization
- Multi-user household support with role-based permissions
- Complete audit trail for compliance and dispute resolution

---

## 1. Functional Requirements

### 1.1 Card Discovery & Display

#### FR1: Multiple View Modes
Users can toggle between three visualization modes, with preference persisted:

**Grid View** (Default)
- Card-like tiles in responsive columns (3 on desktop, 2 on tablet, 1 on mobile)
- Visual card styling matching actual card appearance
- Issuer logo/branding if available
- Card name prominently displayed
- Current annual fee visible
- Renewal countdown (e.g., "Renews in 45 days")
- Quick stats: Active benefits count, Card ROI percentage
- Status badge: Active/Pending/Archived
- Action menu (three-dot button) for quick operations

**List View**
- Sortable table with columns: Name, Issuer, Annual Fee, Renewal, Status, Benefits, Card ROI
- Row selection checkboxes for bulk operations
- Inline quick actions: Edit, Archive, More menu
- Status color indicators (green=Active, gray=Archived, blue=Pending)
- Hover effects to reveal action buttons
- Expandable rows (optional) showing benefits mini-list
- Sortable column headers with visual indicators (↑/↓)

**Compact View**
- Minimal cards showing: Name, Annual Fee, Status badge only
- Useful for space-constrained layouts
- Full functionality preserved
- Quick access to action menu

**View Preferences**
- Save user's preferred view mode in `User.preferences.cardViewMode`
- Restore on page reload
- Switch views without losing search/filter state

#### FR2: Card Grid Tile Component
Each tile displays:
```
┌─────────────────────────────┐
│ [Logo] Card Name   [Menu ⋮] │
│ Status Badge                │
│ Annual Fee: $550            │
│ Renews in 45 days           │
│ Benefits: 7 | ROI: 12.5%    │
└─────────────────────────────┘
```

**Interactive Elements:**
- Click card to open detail panel
- Menu button (⋮) for Edit, Archive, Delete
- Badge shows current status with color coding
- Renewal countdown updates daily

#### FR3: Card List Row Component
Table row displays all key metrics with:
```
[☐] Card Name | Issuer | $Fee | Renewal | Active | Benefits | ROI% | [✎] [📁] [⋮]
```

**Interactions:**
- Checkbox for multi-select
- Sortable headers (click to sort ascending/descending)
- Inline action buttons (Edit, Archive, More)
- Row highlight on hover
- Expandable arrow to show benefits

#### FR4: Search & Filter Subsystem

**Search Functionality:**
- Real-time search across: Card name, issuer, custom name
- Debounced input (200ms) for performance
- Exact and partial matches
- Case-insensitive search
- Clear button (X icon) to reset
- No results message with suggestions

**Filter Categories:**

| Filter | Type | Options | Effect |
|--------|------|---------|--------|
| Status | Multi-select | Active, Pending, Archived | Card status matches |
| Issuer | Dropdown + autocomplete | [All issuers] | Card issuer matches |
| Annual Fee | Range slider | $0 - $10,000 | Effective fee in range |
| Renewal Date | Date range picker | Start/End dates | Renewal falls in range |
| Benefits | Toggle | Has benefits / No benefits | Benefit count > 0 |

**Filter State:**
- Filters combine with AND logic (all must match)
- Active filter count badge on filter button
- Clear all filters button
- Individual filter removable with X

**Saved Filters:**
- Save current filter state with custom name
- Store up to 10 named filters per user
- One-click apply saved filter
- Manage saved filters (rename, delete)
- Display saved filters in dropdown menu

**Performance:**
- Debounce search: 200ms
- Client-side filtering for <500 cards
- Server-side pagination for >500 cards
- Caching of search results (5-minute TTL)

#### FR5: Sorting & Default Order

**Sortable Columns:**
- Card name (A-Z)
- Issuer (A-Z)
- Annual fee (low-high)
- Card ROI (high-low)
- Renewal date (soonest first)
- Benefits count (most-least)

**Default Sort:** Renewal date (soonest first)  
**Persistence:** Save user's preferred sort in `User.preferences.cardSortBy` and `sortDir`

**UI Indicator:**
- Column header shows ↑ (ascending) or ↓ (descending)
- Active sort column highlighted
- Click header to toggle sort direction

---

### 1.2 Card Operations

#### FR6: Add Card to Wallet

**Flow:** Modal/Drawer with 3-step process

**Step 1: Select Card from Catalog**
- Search field: "Search card catalog..." with autocomplete
- Display matching MasterCard records
- Show card: issuer, name, default annual fee
- Show number of benefits to be cloned

**Step 2: Customize (Optional)**
- Custom name: (empty by default) e.g., "My Amex Gold - Travel"
- Annual fee override: (shows default, allow change)
- Renewal date: (required) date picker, defaults to today + 1 year

**Step 3: Review & Confirm**
- Summary of selected card and customizations
- List of benefits to be cloned
- "Add Card" button creates card

**Validation:**
- Card already exists (unique constraint): Show error, offer link to card
- Renewal date must be in future: Show error, suggest today + 1 year
- Custom name required length: 1-100 characters
- Annual fee must be non-negative: Allow zero

**Success:**
- Modal closes
- New card appears in list (highlighted briefly)
- Toast: "Added [Card Name]"
- Detail panel opens (optional)

**Error Handling:**
- Network timeout: Retry option, keep form state
- Master card deleted: Show message, offer to pick another
- Database constraint: Show specific error message

#### FR7: Edit Card Details

**Access:**
- Click "Edit" in card detail panel
- Click card row's edit icon
- Inline edit fields (optional: click to edit feature)

**Editable Fields:**
1. **Custom Name** (optional): 1-100 characters
2. **Annual Fee Override**: Non-negative integer (cents), allow zero
3. **Renewal Date**: Date picker, must be future date
4. **Status**: Dropdown: Active → Pending → Active → Archived

**Validation:**
- Annual fee must be >= 0
- Renewal date must be in future
- Status transitions valid per state machine (see § 2.4)
- Changes saved atomically

**ROI Impact:**
- Show live preview of ROI change if annual fee modified
- Alert: "Your wallet ROI will change by ±X%"
- Cancel without saving discards changes

**Success:**
- Toast: "[Card Name] updated"
- Detail panel reflects changes
- List view updates immediately

#### FR8: View Card Details

**Access:**
- Click card tile/row opens detail panel
- Slide panel from right (desktop) or modal (mobile)
- Panel can be dismissed with X or clicking outside

**Content:**

| Section | Information |
|---------|-------------|
| Header | Card name, issuer, status badge, close button |
| Card Info | Annual fee (default + override if applicable), Renewal date + countdown, Created date, Last updated |
| Metrics | Card ROI %, Annual value $, Percent of wallet total |
| Benefits | List of user benefits with: name, status (claimed/unclaimed), value, expiration |
| Actions | Edit button, Archive button, Delete button |
| Diagnostics | Warnings (renewal overdue, missing benefits), Suggestions |

**Benefits List:**
- Show both claimed and unclaimed benefits
- Expandable for full details
- Sort by value (high-low) default
- Filter by status (claimed/unclaimed)

**Responsive:**
- Desktop: Right-side slide panel (400px wide)
- Mobile: Full-screen modal
- Close on back button (mobile)

#### FR9: Archive Card (Soft Delete)

**Action:**
- Menu button → "Archive" option
- Shows confirmation dialog

**Confirmation Dialog:**
```
Confirm Archive: "Chase Sapphire Reserve"?

Your wallet ROI will decrease by 2.3% (from 12.5% to 10.2%)

[Archive] [Cancel]
```

**Upon Confirmation:**
- Card status changes to `ARCHIVED` (in database)
- Card visibility:
  - Hidden from default view (filter: status = ACTIVE)
  - Visible if user filters to show archived cards
  - Still searchable
- All associated benefits marked as `ARCHIVED` (read-only)
- Email alerts disabled
- ROI recalculation triggers (household ROI decreases)
- Toast: "Card archived"

**Audit Trail:**
- Record: `UserCard.archivedAt`, `UserCard.archivedBy`, `UserCard.archivedReason`
- Preserves all benefit data for historical analysis
- Can be un-archived (restore to ACTIVE status)

#### FR10: Unarchive Card

**Action:**
- Archive filter shows archived cards
- Click card → "Un-archive" option
- No confirmation required

**Upon Confirmation:**
- Card status changes to `ACTIVE`
- Card reappears in default view
- Benefits marked as `ACTIVE` again
- Email alerts re-enabled
- ROI recalculation triggers (household ROI increases)
- Toast: "Card restored"

#### FR11: Delete Card (Hard Delete)

**Flow:**
1. Open card detail panel
2. Click "Delete" button
3. Confirmation dialog appears:
   ```
   Permanently Delete "Chase Sapphire Reserve"?
   
   ⚠️  This cannot be undone. All benefit data will be lost.
   
   To confirm, type the card name exactly:
   [____________]
   
   [Delete] [Cancel]
   ```

4. User must type exact card name to enable "Delete" button
5. Click "Delete" → Hard delete from database
6. All related benefits soft-deleted (preserved for audit)

**Important Notes:**
- Recommend archive (soft delete) instead
- Archive should be default option; delete hidden in "More" menu
- Hard delete should be rare operation
- Soft delete (archive) preserves history

**Success:**
- Card removed from all views
- Toast: "Card permanently deleted"
- Return to card list

**Error Handling:**
- Network error: Show retry option
- Constraint violation (if exists): Show error, explain
- Typed confirmation doesn't match: Disable delete button, show error

#### FR12: Card Status Management

**Explicit Status Enum:**
```typescript
enum CardStatus {
  ACTIVE = 'ACTIVE',       // Card in active use
  PENDING = 'PENDING',     // Just added, not yet used
  ARCHIVED = 'ARCHIVED',   // Closed or no longer using
  PAUSED = 'PAUSED'        // Temporarily inactive
}
```

**Valid State Transitions:**

```
                    NEW CARD (Add)
                         │
                ┌────────┴────────┐
                ↓                 ↓
             ACTIVE ◄──────────► PENDING
                │                  │
        ┌───────┼──────────────────┤
        ↓       ↓                  ↓
      PAUSED  ARCHIVED ────────► DELETED
```

**Rules:**
- DELETED is final (no transitions out)
- ACTIVE/PENDING/PAUSED can go to ARCHIVED
- ARCHIVED can return to ACTIVE (rare, card reopened)
- Transition with reason: `statusChangedReason: string`
- Timestamp: `statusChangedAt: DateTime`

**UI Indication:**
- Status badge on every card (color-coded)
- Active = Green, Pending = Blue, Archived = Gray, Paused = Yellow
- Tooltip shows status description and status change date

#### FR13: Card Settings & Inline Customization

**Inline Edit (Optional Feature):**
- Click custom name field → inline text input
- Click annual fee → inline number input
- Click renewal date → inline date picker
- Auto-save on blur (no explicit save button)
- Loading spinner during save
- Success/error feedback toast

**Validation:**
- Custom name: 1-100 characters, trim whitespace
- Annual fee: >= 0, accept cents
- Renewal date: must be future date

**Impact Indicators:**
- If annual fee changes: Show "ROI impact: ±X%"
- If renewal date changes: Show "New countdown: X days"

#### FR14: Annual Fee Management

**Display:**
- Default annual fee (from MasterCard) shown
- If overridden: Show override value with indicator "(custom)"
- Difference if overridden: "+$50 vs default"

**Edit:**
- Allow setting to zero (some cards have no annual fee)
- Allow override without limit (user's actual fee)
- Real-time ROI impact preview

**Calculation:**
- Effective annual fee = override ?: defaultAnnualFee
- Card ROI = (annual benefits value - effective fee) / (typical spend or fixed)
- Wallet ROI = sum(all card ROI) / count(active cards)

#### FR15: Renewal Date Management

**Display:**
- Show exact renewal date (YYYY-MM-DD format)
- Show countdown: "Renews in X days" (updated daily)
- Color indicator:
  - Green: >60 days
  - Yellow: 30-60 days (renewal approaching)
  - Red: <30 days (renewal due soon)
  - Red with warning: <0 days (overdue, likely closed)

**Edit:**
- Date picker allows any future date
- Validation: Must be in future
- Default: Today + 365 days (when adding card)

**Alerts:**
- Email notification 30 days before renewal
- Email notification on renewal date
- Suggestions: Update benefits for new card year

**Card Closure Detection:**
- If renewal date is in past (overdue): Show warning
- Suggest: "Is this card closed? Archive it."
- Visual indicator: Red status on tile/row

---

### 1.3 Advanced Features

#### FR16: Card Issuance & Program Support

**Data Mapping:**
- Display issuer: Chase, Amex, Discover, Citi, etc.
- Display program tier: Gold, Platinum, Reserve, etc.
- Support card variants: Chase Sapphire Preferred vs. Reserve

**Master Card Structure:**
```typescript
MasterCard {
  id: string
  issuer: string        // "Chase", "American Express"
  cardName: string      // "Chase Sapphire Reserve"
  defaultAnnualFee: number
  cardImageUrl: string  // CDN image of actual card
  
  masterBenefits: MasterBenefit[]
}
```

**UI Elements:**
- Issuer logo/image on tile and list
- Program tier shown (e.g., "Reserve" in card name)
- Link to issuer's official product page (future)

#### FR17: Bulk Card Operations

**Multi-Select:**
- Checkboxes on each card (grid/list view)
- "Select all" checkbox in header (selects visible or all?)
- Count display: "X cards selected"
- Clear selection button
- Bulk action bar appears at bottom/top

**Bulk Actions:**

| Action | Effect | Confirmation |
|--------|--------|--------------|
| Archive | Change status to ARCHIVED | Yes, show ROI impact |
| Unarchive | Change status to ACTIVE | Yes |
| Delete | Hard delete all selected | Yes, confirm count |
| Update Fee | Change annual fee for all | Yes, show impact |
| Update Renewal | Change renewal date for all | Yes |

**Process:**
1. Select cards via checkboxes
2. Click action dropdown or button
3. Confirmation dialog with impact
4. Execute action
5. Progress indicator (for large operations)
6. Results: "X cards updated" or error details
7. Rollback on error (all-or-nothing)

**UI:**
```
Bulk Actions Bar:
[☐] Select all | "Archive" [v] | "Update Fee" [v] | [Confirm] [Clear]
```

**Success/Error:**
- Toast: "5 cards archived" (success)
- Toast: "Failed to archive 1 card: [reason]" (partial failure)
- Dialog: Details of failures with action items

#### FR18: Card Import/Export

**Export Functionality:**
- CSV format: Card name, Issuer, Annual fee, Renewal date, Status, Benefits count
- Include/exclude benefits detail
- One-click download
- Timestamp in filename

**Import Functionality:**
- CSV upload
- Auto-detect columns
- Validate data
- Preview before import
- Duplicate detection (existing cards)
- Rollback on error

**Related Feature:** See SPEC_PHASE4_IMPORT_EXPORT.md for full details

#### FR19: Card Diagnostics & Warnings

**Diagnostics Checks:**

| Check | Warning | Suggestion |
|-------|---------|-----------|
| Renewal overdue | "Renewal date is in the past" | Archive card or update renewal date |
| Missing benefits | "No benefits found for this card" | Add benefits or check card in catalog |
| All archived | "All your cards are archived" | Add a new card to your wallet |
| No cards | "Your wallet is empty" | Add your first card |

**Display Location:**
- Card detail panel (Diagnostics section)
- Dashboard widget (if major issues)
- Email alert (if overdue)

**Actionable Suggestions:**
- "Archive this card?" (one-click)
- "Update renewal date?" (opens date picker)
- "Add benefits?" (opens add benefit dialog)

#### FR20: Mobile & Responsive Design

**Mobile Optimization (<768px):**
- Grid collapses to 1 column
- FAB (floating action button) for "Add Card"
- Bottom action sheet instead of inline menus
- Touch-friendly targets (min 44px)
- Swipe to reveal actions (iOS style)
- Bottom sheet for filters
- Filter as slide-down panel

**Tablet Optimization (768px - 1024px):**
- Grid: 2 columns
- Condensed controls
- Filter panel slide-in or sticky
- Detail panel as modal (not side panel)

**Desktop Layout (>1024px):**
- Grid: 3 columns
- Side filter panel
- Right-side detail panel
- All features accessible

**Responsive Breakpoints:**
```typescript
const breakpoints = {
  mobile: '640px',   // max-width for mobile
  tablet: '1024px',  // max-width for tablet
  desktop: '1440px'  // max-width for desktop
}
```

**Touch Interactions:**
- Button/link min 44x44 pixels
- No hover-only actions
- Swipe for destructive actions (archive/delete)
- Confirmation dialogs on mobile

---

## 2. Critical Amendments & QA Resolution

### 2.1 Authorization Scope Clarity

**Authorization Matrix (Card Management):**

| Operation | Owner | Admin | Editor | Viewer | Guest |
|-----------|-------|-------|--------|--------|-------|
| View own cards | ✓ | ✓ | ✓ | ✓ | ✗ |
| View household cards | ✓ | ✓ (admin) | ✗ | ✗ | ✗ |
| Add card | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit own card | ✓ | ✓ | ✓ | ✗ | ✗ |
| Edit other's card | ✓ | ✓ (if delegated) | ✗ | ✗ | ✗ |
| Archive card | ✓ | ✓ | ✓ (own) | ✗ | ✗ |
| Delete card | ✓ | ✓ | ✓ (own, w/ confirm) | ✗ | ✗ |
| Bulk edit | ✓ | ✓ | ✓ (own only) | ✗ | ✗ |

**Multi-Player Household Permissions:**

```
User Alice (Owner):
  ├─ Can view: All cards (own + Bob's)
  ├─ Can edit: All cards
  └─ Can delete: All cards (with confirmation)

User Bob (Editor/Contributor):
  ├─ Can view: Own cards only (Alice's cards hidden)
  ├─ Can edit: Own cards only
  └─ Can delete: Own cards only (with confirmation)

User Charlie (Viewer):
  ├─ Can view: Own card details only (read-only)
  ├─ Can edit: Cannot edit
  └─ Can delete: Cannot delete
```

**Authorization Implementation Pattern:**

```typescript
async function authorizeCardOperation(
  userId: string,
  card: UserCard,
  operation: 'READ' | 'EDIT' | 'ARCHIVE' | 'DELETE' | 'BULK_EDIT'
): Promise<{ authorized: boolean; reason?: string }> {
  // 1. Verify user is in card's household
  const household = await getHouseholdFromCard(card);
  const userMembership = await verifyHouseholdMembership(userId, household.id);
  
  if (!userMembership) {
    return { authorized: false, reason: 'NOT_IN_HOUSEHOLD' };
  }

  // 2. Get user's role in household
  const userRole = userMembership.role; // 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'

  // 3. Get card owner
  const cardOwner = card.player; // Which player owns this card

  // 4. Check operation-specific rules
  switch (operation) {
    case 'READ':
      return {
        authorized: ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER'].includes(userRole)
      };

    case 'EDIT':
      if (userRole === 'OWNER') return { authorized: true };
      if (userRole === 'EDITOR') return { authorized: userId === cardOwner.userId };
      return { authorized: false, reason: 'INSUFFICIENT_ROLE' };

    case 'DELETE':
      if (userRole === 'OWNER') return { authorized: true };
      if (userRole === 'EDITOR') return { authorized: userId === cardOwner.userId };
      return { authorized: false, reason: 'INSUFFICIENT_ROLE' };

    default:
      return { authorized: false };
  }
}
```

**Enforcement Points:**
- Every server action checks authorization
- Every API endpoint verifies permission
- Every bulk operation checks each card
- Unauthorized operations return 403 Forbidden

### 2.2 Card Status State Machine

**Formal State Definitions:**

```typescript
enum CardStatus {
  ACTIVE = 'ACTIVE',      // Card in active use, contributes to ROI
  PENDING = 'PENDING',    // Just added, not yet claimed
  PAUSED = 'PAUSED',      // Temporarily inactive (e.g., overseas)
  ARCHIVED = 'ARCHIVED',  // Closed, not contributing to ROI
  DELETED = 'DELETED'     // Permanently deleted (hard delete)
}

interface CardStatusTransition {
  from: CardStatus;
  to: CardStatus;
  action: string;           // User action that triggers transition
  requiresConfirmation: boolean;
  impactDescription: string; // What will happen
}
```

**Valid Transitions Table:**

| From | To | Action | Confirm | Impact |
|------|----|---------|---------|----|
| ACTIVE | PENDING | Mark as unused | No | - |
| ACTIVE | PAUSED | Pause temporarily | No | ROI unchanged |
| ACTIVE | ARCHIVED | Archive card | Yes | ROI decreases |
| ACTIVE | DELETED | Delete permanently | Yes | All data lost |
| PENDING | ACTIVE | Mark as active | No | ROI includes benefits |
| PENDING | ARCHIVED | Archive unused | No | - |
| PENDING | DELETED | Delete | Yes | All data lost |
| PAUSED | ACTIVE | Resume card | No | ROI unchanged |
| PAUSED | ARCHIVED | Archive | Yes | ROI decreases |
| PAUSED | DELETED | Delete | Yes | All data lost |
| ARCHIVED | ACTIVE | Restore card | Yes | ROI increases |
| ARCHIVED | DELETED | Delete | Yes | All data lost |
| DELETED | * | Cannot transition | - | Final state |

**State Transition Validation:**

```typescript
const VALID_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  [CardStatus.ACTIVE]: [CardStatus.PENDING, CardStatus.PAUSED, CardStatus.ARCHIVED, CardStatus.DELETED],
  [CardStatus.PENDING]: [CardStatus.ACTIVE, CardStatus.ARCHIVED, CardStatus.DELETED],
  [CardStatus.PAUSED]: [CardStatus.ACTIVE, CardStatus.ARCHIVED, CardStatus.DELETED],
  [CardStatus.ARCHIVED]: [CardStatus.ACTIVE, CardStatus.DELETED],
  [CardStatus.DELETED]: [] // No transitions out
};

function isValidTransition(from: CardStatus, to: CardStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

**Status Change Logic:**

```typescript
async function changeCardStatus(
  cardId: string,
  newStatus: CardStatus,
  reason?: string
): Promise<UserCard> {
  const card = await db.userCard.findUnique({ where: { id: cardId } });

  // Validate transition
  if (!isValidTransition(card.status, newStatus)) {
    throw new Error(`Cannot transition ${card.status} → ${newStatus}`);
  }

  // Special handling for transitions
  if (newStatus === CardStatus.ARCHIVED) {
    // Mark all benefits as archived
    await db.userBenefit.updateMany({
      where: { userCardId: cardId },
      data: { status: 'ARCHIVED' }
    });
    
    // Disable email alerts
    await db.scheduledAlert.deleteMany({
      where: { userCard: { id: cardId } }
    });
  }

  if (newStatus === CardStatus.ACTIVE && card.status === CardStatus.PENDING) {
    // Mark benefits as available for claiming
    await db.userBenefit.updateMany({
      where: { userCardId: cardId },
      data: { availableForClaim: true }
    });
  }

  // Update card status
  return await db.userCard.update({
    where: { id: cardId },
    data: {
      status: newStatus,
      statusChangedAt: new Date(),
      statusChangedReason: reason,
      ...(newStatus === CardStatus.ARCHIVED && {
        archivedAt: new Date(),
        archivedBy: getCurrentUserId()
      })
    }
  });
}
```

---

## 3. Data Schema

### 3.1 UserCard Table (Enhanced)

**Current Prisma Schema:**
```prisma
model UserCard {
  id                String      @id @default(cuid())
  playerId          String      // FK to Player
  masterCardId      String      // FK to MasterCard
  
  // Customizable fields
  customName        String?     // User's nickname
  actualAnnualFee   Int?        // Override fee in cents
  renewalDate       DateTime    // Card anniversary
  
  isOpen            Boolean     @default(true)  // Legacy: true = active/pending
  
  // Relationships
  player            Player      @relation(fields: [playerId], references: [id], onDelete: Cascade)
  masterCard        MasterCard  @relation(fields: [masterCardId], references: [id], onDelete: Restrict)
  userBenefits      UserBenefit[]
  
  // Metadata
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  archivedAt        DateTime?
  
  // Indexes
  @@unique([playerId, masterCardId])
  @@index([playerId, isOpen])
  @@index([renewalDate])
}
```

**Enhanced Schema (New Fields):**
```prisma
model UserCard {
  id                String        @id @default(cuid())
  playerId          String
  masterCardId      String
  
  // Customizable fields
  customName        String?       // 1-100 chars, user's nickname
  actualAnnualFee   Int?          // Override in cents (null = use default)
  renewalDate       DateTime      // Card anniversary (must be future)
  
  // Status management (NEW)
  status            String        @default("ACTIVE")  // ACTIVE|PENDING|PAUSED|ARCHIVED|DELETED
  statusChangedAt   DateTime?     // When status changed
  statusChangedReason String?     // Why status changed
  statusChangedBy   String?       // Who changed it
  
  // Legacy field (keep for backward compatibility)
  isOpen            Boolean       @default(true)      // Deprecated: use status instead
  
  // Archive metadata (NEW)
  archivedAt        DateTime?     // When archived
  archivedBy        String?       // Who archived (userId)
  archivedReason    String?       // Why archived
  
  // Relationships
  player            Player        @relation(fields: [playerId], references: [id], onDelete: Cascade)
  masterCard        MasterCard    @relation(fields: [masterCardId], references: [id], onDelete: Restrict)
  userBenefits      UserBenefit[]
  
  // Metadata
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  // Indexes
  @@unique([playerId, masterCardId])
  @@index([playerId, status])
  @@index([renewalDate])
  @@index([archivedAt])
}
```

**Migration Strategy:**
- Keep `isOpen` field for backward compatibility
- Add new `status` field with smart defaults
- Map `isOpen = true` → `status = 'ACTIVE'`
- Map `isOpen = false` → `status = 'ARCHIVED'`
- Gradual transition to new status field

**Field Constraints:**
```typescript
interface UserCardCreateInput {
  playerId: string;              // Required
  masterCardId: string;          // Required
  customName?: string;           // 1-100 chars, trimmed
  actualAnnualFee?: number;      // >= 0, in cents
  renewalDate: Date;             // Must be future date
}

interface UserCardUpdateInput {
  customName?: string;           // 1-100 chars
  actualAnnualFee?: number;      // >= 0 or null
  renewalDate?: Date;            // Must be future date
  status?: CardStatus;           // Validated transition
}
```

### 3.2 Card Display Models

**CardDisplayModel** (for list/grid views):
```typescript
interface CardDisplayModel {
  id: string;
  issuer: string;
  cardName: string;
  customName: string | null;
  defaultAnnualFee: number;      // In cents
  actualAnnualFee: number | null;
  effectiveAnnualFee: number;    // actualAnnualFee ?? defaultAnnualFee
  
  renewalDate: Date;
  daysUntilRenewal: number;      // Calculated daily
  renewalStatus: 'DueNow' | 'DueSoon' | 'Coming' | 'Safe';
  
  status: CardStatus;
  isOpen: boolean;               // Derived from status
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  
  // Derived metrics
  benefitsCount: number;
  activeBenefitsCount: number;
  claimedBenefitsCount: number;
  cardROI: number;               // Percentage
  annualValue: number;           // In cents
  
  // Issuer branding
  issuerLogo?: string;           // CDN URL
  cardImageUrl: string;          // CDN URL
}
```

**CardDetailsModel** (for detail panel):
```typescript
interface CardDetailsModel extends CardDisplayModel {
  masterCard: MasterCardDetail;
  userBenefits: UserBenefitWithROI[];
  masterBenefits: MasterBenefitDetail[];
  
  benefitsSummary: {
    unclaimed: number;           // Total unclaimed value
    claimed: number;             // Total claimed value
    total: number;               // Sum of all benefits
    count: number;               // Number of benefits
    activeCount: number;         // Non-expired count
    expiredCount: number;        // Expired count
  };
  
  diagnostics: {
    warnings: DiagnosticWarning[];
    suggestions: DiagnosticSuggestion[];
  };
  
  relatedStats: {
    percentOfWallet: number;     // Card value / Total wallet value
    monthlyROI: number;          // ROI amortized monthly
    monthlyAnnualFee: number;    // Annual fee amortized monthly
    benefitsPerDollarSpent: number; // Efficiency metric
  };
}

interface DiagnosticWarning {
  type: 'RENEWAL_OVERDUE' | 'NO_BENEFITS' | 'EXPIRED_BENEFITS';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  suggestedAction: string;
}
```

### 3.3 In-Memory State Management

**CardManagementState** (React Context/Zustand):
```typescript
interface CardManagementState {
  // Data
  cards: CardDisplayModel[];
  selectedCard: CardDetailsModel | null;
  selectedCardIds: Set<string>;  // For bulk operations
  filteredCards: CardDisplayModel[];
  
  // UI State
  viewMode: 'grid' | 'list' | 'compact';
  sortBy: 'name' | 'issuer' | 'fee' | 'renewal' | 'roi' | 'benefits';
  sortDir: 'asc' | 'desc';
  isLoading: boolean;
  error: string | null;
  
  // Filters
  filters: {
    search: string;
    status: CardStatus[];
    issuer: string[];
    feeRange: [min: number, max: number];
    renewalRange: [start: Date, end: Date];
    hasBenefits: boolean | null;
  };
  
  savedFilters: SavedFilter[];
  selectedFilterId: string | null;
  
  // Actions
  setViewMode(mode: 'grid' | 'list' | 'compact'): void;
  setSortBy(sortBy: string, dir: 'asc' | 'desc'): void;
  setFilters(filters: Partial<Filters>): void;
  clearFilters(): void;
  selectCard(cardId: string | null): void;
  toggleCardSelection(cardId: string): void;
  setCards(cards: CardDisplayModel[]): void;
  applyFilters(): void;
}
```

---

## 4. API Routes & Contracts

### 4.1 Card Operations Endpoints

#### GET /api/cards - Fetch cards with filters
```typescript
// Request
interface GetCardsRequest {
  playerId: string;
  status?: CardStatus | 'ALL';      // Default: 'ACTIVE'
  search?: string;                  // Search name/issuer/custom name
  issuer?: string[];                // Filter by issuers
  sortBy?: SortField;               // Default: 'renewalDate'
  sortDir?: 'asc' | 'desc';         // Default: 'asc'
  limit?: number;                   // Default: 50
  offset?: number;                  // Default: 0
}

// Response
interface GetCardsResponse {
  success: true;
  data: {
    cards: CardDisplayModel[];
    total: number;
    limit: number;
    offset: number;
    stats: {
      totalCards: number;
      activeCards: number;
      archivedCards: number;
      pendingCards: number;
      totalROI: number;
      walletValue: number;
    };
  };
}

// Errors
// 400: Bad Request (invalid filter)
// 401: Unauthorized
// 403: Not in household
// 500: Server error
```

#### GET /api/cards/{cardId} - Get card details
```typescript
// Response
interface GetCardDetailsResponse {
  success: true;
  data: CardDetailsModel;
}

// Errors
// 404: Card not found
// 401: Unauthorized
// 403: Forbidden (no permission)
```

#### POST /api/cards - Create card
```typescript
// Request
interface CreateCardRequest {
  playerId: string;
  masterCardId: string;
  customName?: string;              // 1-100 chars
  actualAnnualFee?: number;         // Non-negative cents
  renewalDate: string;              // ISO date, must be future
}

// Response
interface CreateCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    benefitsAdded: number;
  };
}

// Errors
// 400: Validation failed (renewal in past, duplicate, etc.)
// 409: Card already exists for this player
// 401: Unauthorized
// 500: Server error
```

#### PUT /api/cards/{cardId} - Update card
```typescript
// Request
interface UpdateCardRequest {
  customName?: string;
  actualAnnualFee?: number;
  renewalDate?: string;
  status?: CardStatus;              // If transitioning states
}

// Response
interface UpdateCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    changes: {
      roiImpact?: number;           // Percent change in ROI
      affectedBenefits: number;
      statusChanged?: boolean;
    };
  };
}

// Errors
// 400: Validation failed
// 404: Card not found
// 401: Unauthorized
// 403: Forbidden (not owner)
// 409: Invalid state transition
```

#### POST /api/cards/{cardId}/archive - Archive card
```typescript
// Request
interface ArchiveCardRequest {
  reason?: string;
}

// Response
interface ArchiveCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    roiImpact: number;  // Percentage change
  };
}
```

#### POST /api/cards/{cardId}/unarchive - Restore card
```typescript
// Response
interface UnarchiveCardResponse {
  success: true;
  data: {
    card: CardDisplayModel;
    roiImpact: number;
  };
}
```

#### DELETE /api/cards/{cardId} - Hard delete
```typescript
// Request
interface DeleteCardRequest {
  confirmation: string;             // Must match card name
}

// Response
interface DeleteCardResponse {
  success: true;
  message: string;
}

// Errors
// 400: Confirmation text incorrect
// 404: Card not found
// 401: Unauthorized
// 403: Forbidden
```

#### POST /api/cards/bulk/update - Bulk update
```typescript
// Request
interface BulkUpdateRequest {
  cardIds: string[];
  updates: {
    status?: CardStatus;
    actualAnnualFee?: number;
    renewalDate?: string;
  };
}

// Response
interface BulkUpdateResponse {
  success: boolean;
  data: {
    updated: number;
    failed: number;
    errors?: Array<{ cardId: string; reason: string }>;
    roiImpact?: number;
  };
}

// Note: Transaction rolled back if any card fails
```

### 4.2 Server Actions (Preferred for Components)

```typescript
// src/actions/cards.ts

import { ActionResponse } from '@/lib/action-response';

/**
 * Fetch all cards for a player with filters
 */
export async function getPlayerCards(
  playerId: string,
  options: {
    status?: CardStatus;
    search?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResponse<{
  cards: CardDisplayModel[];
  total: number;
  stats: CardWalletStats;
}>>

/**
 * Get single card with full details
 */
export async function getCardDetails(
  cardId: string
): Promise<ActionResponse<CardDetailsModel>>

/**
 * Add card to player's wallet
 */
export async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date,
  customName?: string,
  actualAnnualFee?: number
): Promise<ActionResponse<CardDisplayModel>>

/**
 * Update card details
 */
export async function updateCard(
  cardId: string,
  updates: Partial<{
    customName: string;
    actualAnnualFee: number;
    renewalDate: Date;
    status: CardStatus;
  }>
): Promise<ActionResponse<CardDisplayModel>>

/**
 * Archive card (soft delete)
 */
export async function archiveCard(
  cardId: string,
  reason?: string
): Promise<ActionResponse<CardDisplayModel>>

/**
 * Restore archived card
 */
export async function unarchiveCard(
  cardId: string
): Promise<ActionResponse<CardDisplayModel>>

/**
 * Permanently delete card
 */
export async function deleteCard(
  cardId: string,
  confirmationText: string
): Promise<ActionResponse<{ success: boolean }>>

/**
 * Bulk update multiple cards
 */
export async function bulkUpdateCards(
  cardIds: string[],
  updates: Partial<{
    status: CardStatus;
    actualAnnualFee: number;
    renewalDate: Date;
  }>
): Promise<ActionResponse<{
  updated: number;
  failed: number;
  errors?: Array<{ cardId: string; reason: string }>;
}>>
```

---

## 5. Component Architecture

### 5.1 Component Hierarchy

```
CardWallet (Page/Layout)
├─ CardManagementHeader
│  ├─ ViewModeToggle (Grid|List|Compact)
│  ├─ CardSearchInput
│  └─ AddCardButton (FAB or button)
│
├─ CardFiltersPanel (Collapsible)
│  ├─ StatusFilter
│  ├─ IssuerFilter
│  ├─ FeeRangeSlider
│  ├─ RenewalDateRange
│  ├─ SavedFiltersDropdown
│  └─ ClearFiltersButton
│
├─ CardListDisplay (Grid/List/Compact)
│  ├─ CardTile[] (grid mode)
│  │  └─ CardTileAction menu
│  ├─ CardRow[] (list mode)
│  │  └─ CardRowActions
│  └─ CardCompact[] (compact mode)
│
├─ BulkActionBar (Conditional)
│  ├─ SelectionCount
│  ├─ ActionDropdown
│  ├─ ConfirmButton
│  └─ ClearSelectionButton
│
├─ CardDetailPanel (Conditional)
│  ├─ CardDetailHeader
│  ├─ CardBasicInfo
│  ├─ CardMetrics
│  ├─ BenefitsList
│  ├─ CardDiagnostics
│  └─ ActionButtons
│
└─ Modals (on demand)
   ├─ AddCardModal
   ├─ EditCardForm
   ├─ ConfirmDeleteDialog
   ├─ ArchiveConfirmation
   └─ BulkOperationProgress
```

### 5.2 Core Components

#### CardWallet (Container)
- Main page component
- Manages all card state
- Handles search, filter, sort
- Renders correct view mode
- Coordinates between sub-components

#### CardTile (Grid View)
```typescript
interface CardTileProps {
  card: CardDisplayModel;
  isSelected: boolean;
  onSelect: (cardId: string) => void;
  onCardClick: (card: CardDisplayModel) => void;
  onMenuAction: (action: string, cardId: string) => void;
}

// Renders:
// ┌─────────────────────────────┐
// │ [Logo] Card Name   [⋮]      │
// │ Status Badge (color-coded)  │
// │ Annual Fee: $550            │
// │ Renews in 45 days (yellow)  │
// │ 7 Benefits | 12.5% ROI      │
// └─────────────────────────────┘
```

#### CardRow (List View)
```typescript
interface CardRowProps {
  card: CardDisplayModel;
  isSelected: boolean;
  onSelect: (cardId: string) => void;
  onCardClick: (card: CardDisplayModel) => void;
  onAction: (action: string, cardId: string) => void;
}

// Renders:
// [☐] Name | Issuer | Fee | Renewal | Status | Benefits | ROI% | [✎] [⋮]
```

#### CardDetailPanel (Side Panel)
```typescript
interface CardDetailPanelProps {
  card: CardDetailsModel | null;
  isOpen: boolean;
  isEditing: boolean;
  onClose: () => void;
  onEdit: () => void;
  onSave: (updates: any) => void;
  onArchive: (card: CardDetailsModel) => void;
  onDelete: (card: CardDetailsModel) => void;
}

// Sections:
// - Header (card name, close)
// - Card info (fee, renewal, status)
// - Metrics (ROI, annual value)
// - Benefits list (expandable)
// - Diagnostics/warnings
// - Edit form (if editing=true)
```

#### AddCardModal
```typescript
interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (card: CardDisplayModel) => void;
}

// Steps:
// 1. Select from catalog
// 2. Customize (optional)
// 3. Review & confirm
```

#### CardFiltersPanel
```typescript
interface CardFiltersPanelProps {
  filters: CardFilters;
  savedFilters: SavedFilter[];
  onFiltersChange: (filters: CardFilters) => void;
  onSaveFilter: (name: string) => void;
  onLoadFilter: (filterId: string) => void;
  onClearFilters: () => void;
}
```

#### BulkActionBar
```typescript
interface BulkActionBarProps {
  selectedCount: number;
  availableActions: string[];
  onAction: (action: string) => void;
  onClearSelection: () => void;
}
```

---

## 6. Edge Cases & Error Handling

### 6.1 Data Conflicts & Duplicates

**EC1: Add Duplicate Card**
- **Scenario:** User adds Chase Sapphire Reserve twice
- **Error:** Unique constraint violation (playerId, masterCardId)
- **Handling:** Return 409 CONFLICT_DUPLICATE with message: "You already have this card. [View it]"
- **UI:** Show error toast, offer link to existing card

**EC2: Master Card Deleted from Catalog**
- **Scenario:** Admin removes MasterCard while users have it
- **Constraint:** Foreign key `onDelete: Restrict` prevents deletion
- **Handling:** If somehow deleted: card shows "Deprecated" badge, can archive/delete
- **UI:** Warning: "This card is no longer in our catalog"

**EC3: Concurrent Modification (Optimistic Locking)**
- **Scenario:** User edits in Tab A, Tab B also edits simultaneously
- **Problem:** Last write wins, first edit lost
- **Solution:** Implement `lastModifiedAt` timestamp
- **Handling:** 
  - Before save, check if `lastModifiedAt` changed server-side
  - If changed: Show conflict dialog with both versions
  - User chooses: Keep mine, Keep theirs, or merge
- **UI:** "This card was modified elsewhere. [Refresh] [Merge]"

### 6.2 Validation & Constraints

**EC4: Renewal Date in Past**
- **Scenario:** User edits card, sets renewal to 2020-01-01
- **Validation:** Must be future date
- **Handling:** Client-side validation prevents submission
- **UI:** "Renewal date must be in the future"
- **Suggestion:** "Is this card closed? Archive it instead."

**EC5: Negative Annual Fee**
- **Scenario:** User enters "-250" for annual fee
- **Validation:** Must be >= 0
- **Handling:** Validation error, field cleared
- **UI:** "Annual fee must be zero or positive"

**EC6: Invalid Custom Name**
- **Scenario:** User enters 500+ character name
- **Validation:** Max 100 characters, trim whitespace
- **Handling:** Auto-trim to 100 chars or show validation error
- **UI:** "Name must be under 100 characters"

### 6.3 State & Authorization Issues

**EC7: Unauthorized Access**
- **Scenario:** User A tries to edit User B's card without permission
- **Check:** Authorization middleware verifies ownership
- **Handling:** Return 403 Forbidden
- **UI:** Toast: "You don't have permission to edit this card"
- **Test:** Try to access other player's card via URL

**EC8: Invalid State Transition**
- **Scenario:** User tries to transition DELETED → ACTIVE
- **Validation:** DELETED is final state
- **Handling:** Throw error, prevent transition
- **UI:** "This card cannot be restored"
- **Test:** All invalid transitions documented in § 2.2

**EC9: Bulk Operation Partial Failure**
- **Scenario:** Bulk update 5 cards, 2 fail due to constraint
- **Handling:** Transaction rollback (all-or-nothing)
- **UI:** "Failed to update due to constraint. [Retry] [Skip failed]"
- **Alternative:** Show which cards failed, allow retry without others

### 6.4 Data Loss & Destructive Operations

**EC10: Delete Card with Unclaimed Benefits**
- **Scenario:** Card has $500 worth of unclaimed benefits
- **Warning:** "This card has 3 unused benefits worth $500"
- **Confirmation:** User must type card name to confirm
- **Recommendation:** "Archive instead to preserve history"
- **Handling:** Hard delete removes all data

**EC11: Archive Card with Claimed Benefits**
- **Scenario:** Archive card with claimed benefits
- **Allowed:** Yes, benefits stay in history
- **Effect:** Card no longer contributes to ROI
- **UI:** Warning: "3 benefits marked as claimed will no longer contribute to ROI"

**EC12: Delete All Cards**
- **Scenario:** User deletes entire wallet
- **Handling:** Allow (each delete requires confirmation)
- **Suggestion:** Show "Your wallet will be empty" warning
- **Recovery:** Can import cards if have backup

### 6.5 Performance & Scale Issues

**EC13: Large Wallet (200+ Cards)**
- **Scenario:** Player has 200+ cards
- **Problem:** All cards loaded at once may be slow
- **Handling:** 
  - Pagination (50 per page)
  - Lazy load on scroll
  - Search/filter to reduce dataset
  - Debounce search (200ms)
- **Performance Target:** <1 second to load first 50 cards

**EC14: Search Returns Zero Results**
- **Scenario:** User searches "xyz" with no matches
- **Handling:** Show "No cards found matching 'xyz'"
- **Suggestion:** Show recent or popular cards, offer to clear filters
- **UI:** Empty state with suggestions and search tips

**EC15: Filter with No Results**
- **Scenario:** Filter combination (Archived + Fee > $5000) returns nothing
- **Handling:** Show empty state message
- **UI:** "No cards match these filters" with [Clear filters] button

### 6.6 Network & Connectivity

**EC16: Network Timeout During Save**
- **Scenario:** User saves card edit, network fails
- **Handling:**
  - Keep form state intact (no data loss)
  - Show: "Failed to save. Retrying..."
  - Implement exponential backoff (3 retries)
  - Allow manual retry
- **UI:** Offline indicator if persistent

**EC17: Mobile Swipe Gesture Conflict**
- **Scenario:** User swipes on card, row responds with action sheet
- **Handling:** 
  - Swipe left: Reveal archive/edit/delete buttons
  - Swipe right: Cancel action sheet
  - Tap to dismiss
- **Fallback:** Overflow menu button (⋮) always available

### 6.7 Mobile & Responsive Issues

**EC18: Select All with Pagination**
- **Scenario:** User clicks "Select all" with 50 shown, 150 total
- **Clarification:** "Select all 50 shown" vs "Select all 150"
- **Handling:** 
  - Option 1: Select only visible (50)
  - Option 2: Select all total (150) with confirmation
  - Show count and impact before confirming
- **UI:** Dialog: "Select all 150 cards? This will [action] all your cards."

**EC19: Historical Data Export**
- **Scenario:** User deletes card permanently, later wants historical ROI
- **Note:** Hard delete is permanent (no recovery)
- **Recommendation:** Archive instead (preserves history)
- **Handling:** Warn before hard delete: "Data cannot be recovered"
- **Best Practice:** Archive is default; delete hidden in more menu

---

## 7. Implementation Checklist

### Phase 1: Card Display & Navigation (Days 1-2)

**Task 1.1: Create CardTile and CardRow Components**
- [ ] Implement CardTile component (grid view)
  - [ ] Render card styling
  - [ ] Display all required fields
  - [ ] Status badge with colors
  - [ ] Renewal countdown calculation
  - [ ] Action menu (three-dots)
- [ ] Implement CardRow component (list view)
  - [ ] Table row layout
  - [ ] Checkbox for selection
  - [ ] Sortable column headers
  - [ ] Inline action buttons
  - [ ] Hover effects
- [ ] Implement CardCompact component
  - [ ] Minimal card display
  - [ ] Essential info only
- [ ] Acceptance Criteria:
  - [ ] All three views render without errors
  - [ ] Components match design specs
  - [ ] Data displays accurately
  - [ ] No console errors or warnings

**Task 1.2: Implement Search & Filter System**
- [ ] Create CardSearchInput component
  - [ ] Debounced input (200ms)
  - [ ] Autocomplete suggestions
  - [ ] Clear button functionality
- [ ] Create CardFiltersPanel component
  - [ ] Status filter (checkboxes)
  - [ ] Issuer filter (dropdown + autocomplete)
  - [ ] Fee range slider
  - [ ] Renewal date range picker
  - [ ] Benefit filter toggle
- [ ] Implement filter logic
  - [ ] Combine filters with AND logic
  - [ ] Real-time filtering
  - [ ] Performance acceptable (<200ms)
- [ ] Acceptance Criteria:
  - [ ] Search filters in real-time
  - [ ] All filters work independently and together
  - [ ] Results update correctly
  - [ ] No performance issues

**Task 1.3: View Toggle & Preferences**
- [ ] Add view mode toggle buttons (Grid|List|Compact)
- [ ] Implement localStorage persistence
- [ ] Save user preferences on change
- [ ] Restore preferences on page load
- [ ] Test all three view modes
- [ ] Acceptance Criteria:
  - [ ] View toggle switches correctly
  - [ ] Preferences persist across sessions
  - [ ] No data loss when switching views

### Phase 2: Card Operations (Days 3-4)

**Task 2.1: Add Card Modal**
- [ ] Create AddCardModal component
  - [ ] Multi-step flow (select → customize → confirm)
  - [ ] Step 1: MasterCard autocomplete search
  - [ ] Step 2: Optional customization fields
  - [ ] Step 3: Review before confirming
- [ ] Implement card catalog search
  - [ ] Autocomplete with matching
  - [ ] Show card details (issuer, fee, benefits)
- [ ] Form validation
  - [ ] Master card required
  - [ ] Renewal date must be future
  - [ ] Annual fee non-negative
- [ ] Server action: `addCardToWallet()`
- [ ] Acceptance Criteria:
  - [ ] Modal flows through all steps
  - [ ] Validation prevents invalid inputs
  - [ ] New card saved to database
  - [ ] Benefits cloned correctly
  - [ ] Success toast displays

**Task 2.2: Edit Card Form**
- [ ] Create card edit form
  - [ ] Editable fields: custom name, annual fee, renewal date
  - [ ] Optional: inline edit feature
  - [ ] Real-time ROI impact preview
- [ ] Server action: `updateCard()`
  - [ ] Validate inputs
  - [ ] Authorization check
  - [ ] Update database
  - [ ] Recalculate ROI if fee changed
- [ ] Acceptance Criteria:
  - [ ] All fields editable
  - [ ] Changes save correctly
  - [ ] ROI recalculates on fee change
  - [ ] Error handling for validation failures

**Task 2.3: Card Detail Panel**
- [ ] Create CardDetailPanel component
  - [ ] Display all card information
  - [ ] Show benefits list (expandable)
  - [ ] Display ROI and value metrics
  - [ ] Show diagnostics/warnings
- [ ] Responsive design
  - [ ] Desktop: Right-side slide panel
  - [ ] Mobile: Full-screen modal
- [ ] Action buttons (Edit, Archive, Delete)
- [ ] Acceptance Criteria:
  - [ ] All information displays correctly
  - [ ] Panel responsive at all breakpoints
  - [ ] Action buttons functional
  - [ ] Close button works

**Task 2.4: Archive/Unarchive Functionality**
- [ ] Server action: `archiveCard()`
  - [ ] Status transition validation
  - [ ] Mark benefits as archived
  - [ ] Disable email alerts
  - [ ] Record archived timestamp/reason
- [ ] Server action: `unarchiveCard()`
  - [ ] Restore card to ACTIVE status
  - [ ] Reactivate benefits
  - [ ] Re-enable email alerts
- [ ] Confirmation dialog
  - [ ] Show ROI impact
  - [ ] Confirm before proceeding
- [ ] Acceptance Criteria:
  - [ ] Archive removes from active view
  - [ ] Unarchive restores card
  - [ ] ROI recalculates correctly
  - [ ] Confirmation works as expected

**Task 2.5: Delete Card Functionality**
- [ ] Server action: `deleteCard()`
  - [ ] Require typed confirmation (card name)
  - [ ] Hard delete from database
  - [ ] Log deletion with reason
- [ ] Confirmation dialog
  - [ ] Show warnings about data loss
  - [ ] Require typed card name
  - [ ] Recommend archive instead
- [ ] Error handling
  - [ ] Prevent accidental deletion
  - [ ] Require explicit confirmation
- [ ] Acceptance Criteria:
  - [ ] Confirmation prevents accidents
  - [ ] Hard delete removes all data
  - [ ] Archive recommended as safer alternative

**Task 2.6: Authorization Middleware**
- [ ] Implement `authorizeCardOperation()`
  - [ ] Check user in household
  - [ ] Verify role-based permissions
  - [ ] Check ownership (for editors)
- [ ] Add authorization checks to all server actions
  - [ ] Every operation verifies permission
  - [ ] Return 403 Forbidden if unauthorized
- [ ] Test authorization matrix
- [ ] Acceptance Criteria:
  - [ ] Unauthorized access blocked
  - [ ] Proper error messages returned
  - [ ] All operations protected

### Phase 3: Advanced Features (Days 5-6)

**Task 3.1: Bulk Operations**
- [ ] Implement multi-select (checkboxes)
  - [ ] Select/deselect individual cards
  - [ ] Select all button
  - [ ] Clear selection
- [ ] Create BulkActionBar component
  - [ ] Show selection count
  - [ ] Action dropdown (Archive, Delete, Update fee, etc.)
  - [ ] Confirm button
- [ ] Server action: `bulkUpdateCards()`
  - [ ] Validate transitions for all cards
  - [ ] Transaction rollback on error
  - [ ] Return results with count of success/failure
- [ ] UI feedback
  - [ ] Progress indicator during operation
  - [ ] Success/error toast with count
- [ ] Acceptance Criteria:
  - [ ] Multi-select works correctly
  - [ ] Bulk actions execute
  - [ ] Progress shows during operation
  - [ ] Error handling with rollback

**Task 3.2: Status Management**
- [ ] Implement status state machine
  - [ ] Validate transitions (see § 2.2)
  - [ ] Prevent invalid transitions
  - [ ] Record status change metadata
- [ ] Update CardStatus enum in Prisma
  - [ ] Add status field to UserCard
  - [ ] Add migration for existing cards
  - [ ] Keep isOpen field for compatibility
- [ ] Status badges in UI
  - [ ] Color-coded indicators
  - [ ] Tooltip with status description
  - [ ] Show status change date
- [ ] Filter by status
  - [ ] Include/exclude status types
  - [ ] Default: show ACTIVE only
- [ ] Acceptance Criteria:
  - [ ] Status transitions validated
  - [ ] Badges display correctly
  - [ ] Status filtering works
  - [ ] ROI excludes archived cards

**Task 3.3: Card Diagnostics & Warnings**
- [ ] Implement diagnostic checks
  - [ ] Renewal overdue: renewal date in past
  - [ ] No benefits: card has zero benefits
  - [ ] Expired benefits: benefits past expiration
- [ ] Create DiagnosticsPanel component
  - [ ] Display warnings with severity
  - [ ] Show suggested actions
  - [ ] One-click action buttons
- [ ] Display in detail panel
  - [ ] Prominent warning section
  - [ ] Actionable suggestions
- [ ] Email notifications (if applicable)
  - [ ] Alert when renewal due soon
  - [ ] Warn if overdue
- [ ] Acceptance Criteria:
  - [ ] Warnings display correctly
  - [ ] Suggestions are actionable
  - [ ] No false warnings
  - [ ] UI helpful and clear

**Task 3.4: Named Filters & Saved Views**
- [ ] Implement filter save/load
  - [ ] Save current filters with custom name
  - [ ] Store in database (or localStorage)
  - [ ] Up to 10 saved filters per user
- [ ] UI for saved filters
  - [ ] Dropdown menu with saved filters
  - [ ] Apply filter with one click
  - [ ] Manage filters (rename, delete)
  - [ ] Show active filter badge
- [ ] Filter persistence
  - [ ] Save applied filter name in state
  - [ ] Restore filter on reload
- [ ] Acceptance Criteria:
  - [ ] Filters save and load correctly
  - [ ] Can delete/rename saved filters
  - [ ] Quick access from UI
  - [ ] No duplicate filter names

### Phase 4: Testing & Optimization (Days 7-8)

**Task 4.1: Unit Tests**
- [ ] Test validation logic
  - [ ] Future date validation
  - [ ] Annual fee range validation
  - [ ] Custom name length validation
  - [ ] Duplicate card detection (20+ tests)
- [ ] Test calculations
  - [ ] Annual fee effective calculation
  - [ ] Card ROI calculation
  - [ ] Days until renewal calculation
  - [ ] Renewal status determination (15+ tests)
- [ ] Test status transitions
  - [ ] Valid transitions allowed
  - [ ] Invalid transitions prevented
  - [ ] Status change metadata recorded (10+ tests)
- [ ] Acceptance Criteria:
  - [ ] 80%+ code coverage
  - [ ] All paths tested
  - [ ] Edge cases covered
  - [ ] Tests pass with no skips

**Task 4.2: Component Tests**
- [ ] Test CardTile rendering
  - [ ] All fields display correctly
  - [ ] Status badge colors correct
  - [ ] Menu interactions work
  - [ ] Selection checkbox works
- [ ] Test CardRow rendering
  - [ ] Columns display correctly
  - [ ] Sorting works
  - [ ] Inline actions display
  - [ ] Hover effects work
- [ ] Test filter components
  - [ ] Filters apply correctly
  - [ ] Search debounces
  - [ ] Clear filters works
  - [ ] Saved filters load correctly (25+ tests)
- [ ] Acceptance Criteria:
  - [ ] 80%+ component coverage
  - [ ] All interactions tested
  - [ ] Responsive at all breakpoints
  - [ ] No accessibility issues

**Task 4.3: Integration Tests**
- [ ] Test add card workflow
  - [ ] Search catalog
  - [ ] Customize card
  - [ ] Add to wallet
  - [ ] Verify in list (10+ tests)
- [ ] Test edit card workflow
  - [ ] Open detail panel
  - [ ] Edit fields
  - [ ] Save changes
  - [ ] Verify updates (8+ tests)
- [ ] Test archive workflow
  - [ ] Archive card
  - [ ] Verify status change
  - [ ] Verify ROI impact
  - [ ] Restore card (8+ tests)
- [ ] Test bulk operations
  - [ ] Select multiple cards
  - [ ] Bulk update
  - [ ] Verify all updated
  - [ ] Error handling (10+ tests)
- [ ] Acceptance Criteria:
  - [ ] All workflows tested
  - [ ] Data consistency verified
  - [ ] Error scenarios handled
  - [ ] Tests stable and reliable

**Task 4.4: E2E Tests (Playwright)**
- [ ] E2E test: Add card workflow
  - [ ] From empty wallet to one card
  - [ ] Verify card appears in grid/list
  - [ ] Verify details correct
- [ ] E2E test: Edit card
  - [ ] Edit custom name
  - [ ] Edit annual fee
  - [ ] Edit renewal date
  - [ ] Verify changes
- [ ] E2E test: Archive card
  - [ ] Archive workflow
  - [ ] Verify removed from view
  - [ ] Filter to show archived
  - [ ] Unarchive and verify
- [ ] E2E test: Search and filter
  - [ ] Search for card
  - [ ] Apply filters
  - [ ] Verify results correct
  - [ ] Save filter and reload
- [ ] E2E test: Bulk operations
  - [ ] Select multiple cards
  - [ ] Bulk archive
  - [ ] Verify all updated
- [ ] Acceptance Criteria:
  - [ ] 10-12 E2E tests
  - [ ] Critical paths covered
  - [ ] Tests stable (no flakes)
  - [ ] Coverage >80%

**Task 4.5: Performance Testing**
- [ ] Profile rendering performance
  - [ ] Grid view with 50 cards
  - [ ] List view with 50 cards
  - [ ] Search performance
  - [ ] Filter performance
- [ ] Optimize re-renders
  - [ ] Use React.memo for components
  - [ ] Memoize callbacks with useCallback
  - [ ] Memoize selectors
  - [ ] Lazy load images if used
- [ ] Test with large wallet
  - [ ] 200+ cards
  - [ ] Verify smooth scrolling (60fps)
  - [ ] Verify search/filter responsive (<200ms)
- [ ] Acceptance Criteria:
  - [ ] Smooth scrolling (60fps)
  - [ ] No jank on interactions
  - [ ] Search/filter responsive
  - [ ] Large datasets handle correctly

**Task 4.6: Mobile Responsiveness Testing**
- [ ] Test mobile layout (<768px)
  - [ ] Single column grid
  - [ ] FAB for add card
  - [ ] Bottom action sheet
  - [ ] Filter slide-down
  - [ ] No horizontal scroll
- [ ] Test tablet layout (768px-1024px)
  - [ ] Two column grid
  - [ ] Side filter panel
  - [ ] Modal detail panel
- [ ] Test desktop layout (>1024px)
  - [ ] Three column grid
  - [ ] Full feature set
  - [ ] Right-side detail panel
- [ ] Test touch interactions
  - [ ] Tap targets min 44x44px
  - [ ] Swipe for actions
  - [ ] Mobile keyboard
  - [ ] No hover-only actions
- [ ] Acceptance Criteria:
  - [ ] All breakpoints render correctly
  - [ ] Touch interactions work
  - [ ] No horizontal scroll
  - [ ] Mobile UX smooth

**Task 4.7: Accessibility Testing**
- [ ] Semantic HTML
  - [ ] Proper heading hierarchy
  - [ ] Form labels
  - [ ] ARIA roles where needed
- [ ] Keyboard navigation
  - [ ] Tab through all controls
  - [ ] Enter/Space activate buttons
  - [ ] Escape closes modals
- [ ] Screen reader
  - [ ] All content readable
  - [ ] Status messages announced
  - [ ] Form errors announced
- [ ] Color contrast
  - [ ] WCAG AA compliance
  - [ ] Status badges readable
- [ ] Acceptance Criteria:
  - [ ] WCAG 2.1 Level AA
  - [ ] Keyboard navigable
  - [ ] Screen reader compatible
  - [ ] No accessibility violations

---

## 8. Security & Compliance

### 8.1 Authorization & Access Control

**Role-Based Access Control (RBAC):**
- Owner: Full access to all cards
- Admin: Full access (if household admin)
- Editor: Edit own cards only
- Viewer: Read-only access
- Guest: No access

**Implementation Points:**
- ✓ Verify authorization before every operation
- ✓ Authorization checks on server actions
- ✓ Return 403 Forbidden if unauthorized
- ✓ Log authorization failures

### 8.2 Input Validation

**Server-Side Validation (Mandatory):**
- Custom name: 1-100 characters, no HTML/scripts
- Annual fee: Non-negative integer
- Renewal date: ISO date, must be future
- Card ID: Valid UUID format
- Player ID: Valid UUID format

**Validation Pattern:**
```typescript
async function validateCardInput(input: any) {
  const errors: Record<string, string> = {};
  
  if (!input.masterCardId?.match(/^[a-z0-9]+$/i)) {
    errors.masterCardId = 'Invalid card ID';
  }
  
  if (input.customName && input.customName.length > 100) {
    errors.customName = 'Name must be under 100 characters';
  }
  
  if (input.actualAnnualFee !== undefined && input.actualAnnualFee < 0) {
    errors.actualAnnualFee = 'Annual fee must be non-negative';
  }
  
  if (new Date(input.renewalDate) < new Date()) {
    errors.renewalDate = 'Renewal date must be in future';
  }
  
  return errors;
}
```

### 8.3 Data Protection

**Soft Deletes Preserve Audit Trail:**
- Archive (status = ARCHIVED) preserves all data
- Hard delete only on explicit user confirmation
- Record who archived/deleted and when
- Enable dispute resolution

**Sensitive Data:**
- No card numbers stored (only issuer + name)
- No PII in card names
- Annual fee shown only to card owner

### 8.4 Audit Logging

**Audit Trail Fields:**
- `archivedAt`: When archived
- `archivedBy`: Who archived (userId)
- `archivedReason`: Why archived
- `statusChangedAt`: When status changed
- `statusChangedReason`: Why changed
- `updatedAt`: Last modification timestamp

**Log on:**
- Add card (success/failure)
- Edit card (what changed)
- Archive card (who, when, why)
- Delete card (hard delete, irreversible)
- Bulk operations (count, IDs affected)

---

## 9. Performance & Scalability

### 9.1 Performance Targets

| Operation | Size | Target |
|-----------|------|--------|
| Load card list | 50 cards | <1 second |
| Search | 50 cards | <200ms |
| Filter application | 50 cards | <200ms |
| Add card | 1 card | <2 seconds |
| Update card | 1 card | <1 second |
| Archive card | 1 card | <1 second |
| Bulk update | 10 cards | <5 seconds |

### 9.2 Database Optimization

**Indexes:**
```prisma
@@index([playerId, status])
@@index([renewalDate])
@@index([archivedAt])
@@unique([playerId, masterCardId])
```

**Query Optimization:**
- Load cards with filters (status, issuer, fee range, renewal date)
- Join with MasterCard for display fields
- Count benefits per card
- Calculate ROI metrics

**Pagination:**
- Default limit: 50 cards per page
- Support offset pagination for larger wallets
- Client-side lazy load on scroll

### 9.3 Client-Side Optimization

**Caching:**
- Cache master card list (rarely changes)
- Cache player's card list (invalidate on add/delete)
- Cache card detail (invalidate on edit)
- Cache search results (5-minute TTL)

**Performance Optimization:**
- Debounce search input (200ms)
- Lazy load images if used
- Memoize expensive calculations
- Virtual scroll for 200+ cards
- Limit initial render (50 cards)

### 9.4 Scalability

**Current Design Supports:**
- 1000s of cards per player
- 10000+ cards per household
- Real-time filtering and search
- 5+ concurrent users

**Future Considerations:**
- Database sharding if 1M+ cards globally
- Redis caching for ROI calculations
- Background jobs for bulk operations
- Async import/export for large datasets

---

## 10. Test Scenarios & Acceptance Criteria

### 10.1 Happy Path Tests

**Test: Add Card Complete Workflow**
1. Click "Add Card" button
2. Search for and select "Chase Sapphire Reserve"
3. Set custom name: "My Amex Gold"
4. Set renewal date: 2025-03-15
5. Confirm and submit
6. **Expect:** Card appears in list, success toast, detail panel opens

**Test: Edit Card Details**
1. Click on card to open detail panel
2. Click "Edit" button
3. Change custom name to "Travel Card"
4. Change annual fee to $450
5. Click "Save"
6. **Expect:** Detail panel updates, card list updates, ROI recalculates

**Test: Archive Card**
1. Open card detail panel
2. Click "Archive"
3. Confirm in dialog
4. **Expect:** Card removed from active view, can filter to show archived

**Test: Search and Filter**
1. Type "Chase" in search → shows Chase cards
2. Apply filter: Status = Active → hides archived cards
3. Apply filter: Fee range $0-$300 → shows only low-fee cards
4. **Expect:** Results narrow correctly with each filter

**Test: Bulk Archive**
1. Select 3 cards via checkboxes
2. Click "Archive" from dropdown
3. Confirm bulk action
4. **Expect:** All 3 cards archived, ROI recalculates

### 10.2 Edge Case Tests

**Test: EC4 - Renewal Date in Past**
1. Try to add card with renewal date 2020-01-01
2. **Expect:** Validation error, form doesn't submit

**Test: EC9 - Bulk Operation Partial Failure**
1. Select 5 cards for bulk archive
2. Mock failure on card 3
3. **Expect:** Transaction rolls back, no cards archived, error message

**Test: EC13 - Large Wallet Performance**
1. Load wallet with 200+ cards
2. Apply search filter
3. **Expect:** Results in <200ms, smooth scrolling

**Test: EC18 - Select All Ambiguity**
1. Show 50 cards, 150 total in wallet
2. Click "Select All" button
3. **Expect:** Dialog asks "Select all 50 shown or all 150 total"

### 10.3 Authorization Tests

**Test: Editor Cannot Edit Other's Card**
1. Login as Editor (not owner of card)
2. Try to edit card belonging to Owner
3. **Expect:** 403 Forbidden error, "Cannot edit this card"

**Test: Viewer Cannot Archive**
1. Login as Viewer
2. Try to archive card
3. **Expect:** Archive button disabled or hidden

---

## 11. Implementation Notes for Engineers

### 11.1 Key Dependencies

- **React 18+**: Component framework
- **Next.js 14+**: Framework with server actions
- **Prisma**: ORM with SQLite
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React Query** (optional): Data fetching/caching
- **Zod** (recommended): Schema validation
- **Playwright**: E2E testing

### 11.2 Recommended Structure

```
src/
├─ components/
│  ├─ cards/
│  │  ├─ CardWallet.tsx        (main container)
│  │  ├─ CardManagementHeader.tsx
│  │  ├─ CardTile.tsx
│  │  ├─ CardRow.tsx
│  │  ├─ CardCompact.tsx
│  │  ├─ CardDetailPanel.tsx
│  │  ├─ AddCardModal.tsx
│  │  ├─ CardFiltersPanel.tsx
│  │  ├─ BulkActionBar.tsx
│  │  └─ index.ts
│  └─ ...
├─ actions/
│  └─ cards.ts                 (server actions)
├─ services/
│  └─ cardService.ts           (business logic)
├─ lib/
│  ├─ validators/
│  │  └─ card.ts               (Zod schemas)
│  ├─ auth.ts                  (authorization)
│  └─ helpers.ts               (utility functions)
├─ types/
│  └─ card.ts                  (TypeScript interfaces)
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ e2e/
```

### 11.3 Code Example: Server Action

```typescript
// src/actions/cards.ts

'use server';

import { db } from '@/lib/db';
import { authorizeCardOperation } from '@/lib/auth';
import { CardSchema } from '@/lib/validators/card';
import { ActionResponse } from '@/lib/action-response';

export async function updateCard(
  cardId: string,
  updates: Record<string, any>
): Promise<ActionResponse<CardDisplayModel>> {
  try {
    // Get current user
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: 'NOT_AUTHENTICATED' };
    }

    // Fetch card
    const card = await db.userCard.findUnique({
      where: { id: cardId },
      include: { player: true, masterCard: true }
    });

    if (!card) {
      return { success: false, error: 'CARD_NOT_FOUND' };
    }

    // Authorize
    const authorized = await authorizeCardOperation(
      session.user.id,
      card,
      'EDIT'
    );

    if (!authorized) {
      return { success: false, error: 'FORBIDDEN' };
    }

    // Validate input
    const parsed = CardSchema.partial().safeParse(updates);
    if (!parsed.success) {
      return { success: false, error: 'VALIDATION_FAILED', issues: parsed.error.issues };
    }

    // Update card
    const updated = await db.userCard.update({
      where: { id: cardId },
      data: parsed.data
    });

    // Recalculate ROI if fee changed
    if (updates.actualAnnualFee !== undefined) {
      // Trigger ROI recalculation
      invalidateROICache(card.playerId);
    }

    return {
      success: true,
      data: formatCardForDisplay(updated)
    };
  } catch (error) {
    console.error('Error updating card:', error);
    return { success: false, error: 'SERVER_ERROR' };
  }
}
```

### 11.4 Common Pitfalls to Avoid

1. **Don't skip authorization checks** - Always verify ownership
2. **Don't modify state without validation** - Validate on server side
3. **Don't hard delete without confirmation** - Use soft delete (archive) by default
4. **Don't forget ROI recalculation** - Update whenever metrics change
5. **Don't assume master cards exist** - Use foreign key constraints
6. **Don't render sensitive data** - Only show info user owns
7. **Don't implement optimistic locking** - Use version timestamps
8. **Don't block UI on slow operations** - Use async/await and loading states

### 11.5 Testing Strategy

**Unit Tests (Validation, Calculations):**
- Test each validator function
- Test ROI calculation formula
- Test date/days calculations
- Test status transitions

**Integration Tests (Workflows):**
- Test add card from start to finish
- Test edit card with ROI recalculation
- Test archive/unarchive workflow
- Test bulk operations

**E2E Tests (User Journeys):**
- Test complete user workflow in browser
- Test search/filter combinations
- Test mobile interactions
- Test error scenarios

**Performance Tests:**
- Load 200+ cards and verify performance
- Profile search and filter response time
- Test with slow network (throttling)

---

## 12. Deployment & Monitoring

### 12.1 Deployment Checklist

- [ ] All tests passing (unit, integration, E2E)
- [ ] Code reviewed and approved
- [ ] Database migrations applied
- [ ] Authorization checks verified
- [ ] Error handling comprehensive
- [ ] Performance targets met
- [ ] Mobile responsiveness verified
- [ ] Accessibility verified (WCAG 2.1 AA)
- [ ] Documentation updated
- [ ] Rollback plan documented

### 12.2 Monitoring & Alerts

**Key Metrics to Monitor:**
- Card add success rate
- Card edit success rate
- Bulk operation success rate
- Authorization failure rate
- Average response time
- Error rate by operation

**Alerts to Set:**
- Success rate <95%
- Response time >2 seconds
- Authorization failures >10/hour
- Database errors >5/hour

---

## 13. Success Criteria

✓ All functional requirements implemented  
✓ Data schema supports card management operations  
✓ API design RESTful and consistent  
✓ All user flows documented with error handling  
✓ 19 edge cases identified and handled  
✓ Components modular and testable  
✓ Authorization verified and tested  
✓ Performance targets met  
✓ Mobile responsive at all breakpoints  
✓ WCAG 2.1 AA accessibility compliance  
✓ Comprehensive test coverage (80%+)  
✓ Documentation complete and clear  

---

**Document Version:** 2.0 (Refined)  
**Status:** ✅ Ready for Implementation  
**Next Step:** Begin Phase 1 - Task 1.1: Create CardTile and CardRow Components  
**Estimated Timeline:** 8 days (2 engineers, full-time)

