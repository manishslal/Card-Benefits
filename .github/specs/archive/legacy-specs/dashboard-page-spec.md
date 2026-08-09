# Card Benefits Dashboard Page - Technical Specification

## Executive Summary & Goals

The Dashboard Page (`app/page.tsx`) is the main landing page of the Card Benefits application. It serves as a comprehensive overview of all credit cards in a user's wallet, organized by player (household member), with live ROI metrics, benefit tracking, and actionable alerts.

**Primary Objectives:**
1. Display all user cards organized by player with summary metrics
2. Provide household-level ROI aggregation to show overall value capture
3. Enable quick access to individual card details via the `CardTrackerPanel` component
4. Support multi-player households (primary, spouse, etc.)
5. Handle empty states gracefully and provide clear navigation paths

**Success Criteria:**
- Server-side data fetching with optimal query performance (single Prisma query with proper includes)
- Displays total household ROI prominently with visual status indicators (green/red)
- Groups cards logically by player name with clear visual hierarchy
- Empty state messaging for players with no cards and empty database
- Responsive layout that works on mobile and desktop
- Page renders without client-side hydration for performance

---

## Functional Requirements

### Core Features

1. **Header Section**
   - Title: "Card Benefits Dashboard"
   - Subtitle: "Track benefits, optimize spending, maximize value"
   - Household ROI Badge displaying the sum of all card ROIs
     - Green badge (bg-green-100 text-green-800) if total ROI ≥ $0
     - Red badge (bg-red-100 text-red-800) if total ROI < $0
   - Last updated timestamp (optional, shows when page was rendered)

2. **Player Sections**
   - Group cards by player.playerName
   - Display player name as a section header (e.g., "Primary's Cards", "Spouse's Cards")
   - Render one `CardTrackerPanel` component per card
   - Show "No cards yet" message if a player has no cards

3. **Card Panels**
   - Render `CardTrackerPanel` components with properly shaped props
   - Pass `userCard` with all nested relationships (masterCard, userBenefits)
   - Pass `playerName` for identification

4. **Data Consistency**
   - Fetch data at request time (no stale cache)
   - Include only active cards (isOpen = true)
   - Include all active and inactive benefits (show full benefit list)

### User Roles & Permissions

- **Unauthenticated users:** Temporary placeholder behavior (future: redirect to login)
- **Authenticated users:** See only their own household cards and players
- **Multi-player household:** See cards from all players under the same user

### System Constraints & Limits

- **Scale:** Supports households with multiple players and 5–20+ cards per player
- **Performance:** Page should render in < 500ms from Prisma query
- **Data freshness:** Real-time; Prisma queries run at request time
- **Empty database:** Gracefully handles zero players or zero cards

---

## Implementation Phases

### Phase 1: Core Data Fetching & Type Safety
**Objective:** Establish the Prisma query and TypeScript interfaces  
**Deliverables:**
- Prisma query with proper `include()` relationships
- TypeScript type definitions for the fetched data structure
- Error handling for missing user context

**Scope:** Small  
**Dependencies:** Database schema is finalized (Prisma Client generated)

---

### Phase 2: Layout & Structure
**Objective:** Build the page container, header, and player grouping logic  
**Deliverables:**
- Page shell with Tailwind layout (header, main content, optional footer)
- Player grouping/sorting logic
- Household ROI aggregation and badge rendering
- Server-side rendering (no `use client` directive)

**Scope:** Medium  
**Dependencies:** Phase 1 (data fetching)

---

### Phase 3: Integration & Edge Cases
**Objective:** Integrate CardTrackerPanel and handle all edge cases  
**Deliverables:**
- CardTrackerPanel rendering with correct prop shapes
- Empty state messaging (empty database, player with no cards)
- Error boundaries or graceful degradation
- Timestamp formatting and display

**Scope:** Medium  
**Dependencies:** Phase 2 (layout)

---

### Phase 4: Testing & Optimization
**Objective:** Validate all user flows and optimize performance  
**Deliverables:**
- Unit tests for grouping logic and ROI aggregation
- Integration tests for full page render with sample data
- Performance metrics (page render time, bundle size impact)
- Accessibility audit (WCAG 2.1 Level AA)

**Scope:** Medium  
**Dependencies:** Phase 3 (integration)

---

## Data Schema / State Management

### Prisma Query Structure

The dashboard page will execute a single optimized Prisma query:

```typescript
const players = await prisma.player.findMany({
  where: {
    userId: string, // From authenticated session (future)
    isActive: true,
  },
  include: {
    userCards: {
      where: {
        isOpen: true, // Only show active cards
      },
      include: {
        masterCard: {
          select: {
            id: true,
            issuer: true,
            cardName: true,
            defaultAnnualFee: true,
            cardImageUrl: true,
          },
        },
        userBenefits: {
          orderBy: { createdAt: 'asc' }, // Consistent ordering
        },
      },
    },
  },
  orderBy: { createdAt: 'asc' }, // Consistent player ordering
});
```

### Data Structure Returned

```typescript
type DashboardData = {
  players: Array<{
    id: string;
    userId: string;
    playerName: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    userCards: Array<{
      id: string;
      playerId: string;
      masterCardId: string;
      customName: string | null;
      actualAnnualFee: number | null;
      renewalDate: Date;
      isOpen: boolean;
      createdAt: Date;
      updatedAt: Date;
      masterCard: {
        id: string;
        issuer: string;
        cardName: string;
        defaultAnnualFee: number;
        cardImageUrl: string;
      };
      userBenefits: Array<{
        id: string;
        userCardId: string;
        playerId: string;
        name: string;
        type: 'StatementCredit' | 'UsagePerk';
        stickerValue: number;
        resetCadence: 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime';
        userDeclaredValue: number | null;
        isUsed: boolean;
        timesUsed: number;
        expirationDate: Date | null;
        createdAt: Date;
        updatedAt: Date;
        claimedAt: Date | null;
      }>;
    }>;
  }>;
};
```

### Aggregation Calculations

**Household ROI:**
```
householdROI = sum(getEffectiveROI(userCard, userCard.userBenefits)) for all userCards
```

This should be calculated by:
1. Iterating through all players
2. For each player, iterate through all userCards
3. Call `getEffectiveROI(userCard, userBenefits)` for each card
4. Sum the results

---

## User Flows & Workflows

### Primary Flow: View Dashboard

```
1. User navigates to / (app/page.tsx)
2. Page renders as Server Component
   a. Query database for players and cards
   b. If no authenticated user:
      - Show empty state or placeholder
      - (Future: redirect to /login)
   c. If no players:
      - Show "No players found" message
      - Suggest creating a player
   d. If players exist:
      - Fetch all players with cards
      - Calculate household ROI
      - Render header with ROI badge
      - Render player sections
      - Render CardTrackerPanel for each card
3. User sees:
   - Dashboard title and subtitle
   - Household ROI badge (green or red)
   - Grouped cards by player
   - Live ROI, benefits, and fee info in each panel
4. User can:
   - Click on a card's checkbox to mark benefit as used
   - See instant visual feedback (optimistic update in CardTrackerPanel)
   - View all benefits for each card
```

### Alternative Flow: Empty Database

```
1. User navigates to /
2. Database has no players or cards
3. Page renders:
   - Dashboard header with ROI badge showing $0.00
   - Message: "No cards in your wallet yet"
   - (Future: Link to "Add Card" flow)
```

### Alternative Flow: Player with No Cards

```
1. Player exists in database but has no cards
2. Page renders that player's section with:
   - Player name as header
   - Message: "No cards yet"
```

### Error Flow: Database Query Fails

```
1. Prisma query throws an error (network, constraint violation, etc.)
2. Page catches error and displays:
   - Error boundary or error message
   - Stack trace (development only)
   - Suggestion to refresh or contact support
3. HTTP status: 500
```

### State Diagram

```
[Page Load]
    ↓
[Fetch Players & Cards (Prisma)]
    ↓
    ├─→ [Error] → [Error Page]
    │
    └─→ [Success]
        ├─→ [No Players] → [Empty State: "No players found"]
        ├─→ [Players Found, Some/All with No Cards]
        │   ├─→ [Render Player Sections]
        │   ├─→ [Render "No cards yet" for empty players]
        │   └─→ [Render CardTrackerPanel for cards]
        └─→ [All Players Have Cards]
            ├─→ [Render Header with Household ROI]
            ├─→ [Render Player Sections with Cards]
            └─→ [Render CardTrackerPanel for each card]
```

---

## API Routes & Contracts

### Page Route: GET `/`

**Route Type:** Server Component (no API route, renders directly)

**Request:**
- URL: `GET /`
- Headers: Standard HTTP headers
- Query Parameters: None (future: user context from session/auth)
- Authentication: Required (future: session cookie or JWT)

**Response:**
- Format: HTML (rendered React components)
- Status Codes:
  - `200 OK`: Page rendered successfully
  - `500 Internal Server Error`: Database query failed or server error
  - `307/308 Redirect`: (Future) Unauthenticated user redirected to `/login`

**Page Props:**

```typescript
// No props passed to page.tsx as a Server Component
// Data is fetched directly within the component using prisma client
```

---

## Edge Cases & Error Handling

### 1. Empty Database (No Players)

**Scenario:** User has no players in the database yet.

**Expected Behavior:**
- Page renders header with title and subtitle
- Household ROI badge shows "$0.00" in gray
- Main content area displays: "No players in your wallet yet. Create a new player to get started."
- (Future: Show a "Create Player" button)

**Implementation:**
```typescript
if (players.length === 0) {
  return (
    <div className="text-center py-12">
      <p>No players in your wallet yet. Create a new player to get started.</p>
    </div>
  );
}
```

---

### 2. Player with No Cards

**Scenario:** A player exists (e.g., "Primary") but has not yet added any cards.

**Expected Behavior:**
- Render the player section as a header
- Display message: "No cards yet"
- (Future: Show an "Add Card" button)

**Implementation:**
```typescript
if (player.userCards.length === 0) {
  return (
    <div className="py-6">
      <h2 className="text-lg font-bold">{player.playerName}'s Cards</h2>
      <p className="text-gray-500">No cards yet.</p>
    </div>
  );
}
```

---

### 3. Household ROI with Mixed Positive/Negative Cards

**Scenario:** Two cards: Card A with ROI +$150, Card B with ROI -$50. Household ROI = +$100.

**Expected Behavior:**
- Badge shows: "ROI: +$100.00" in green
- Individual cards show their own ROI (both green and red badges visible)

**Implementation:**
- Aggregate all card ROIs regardless of sign
- Apply badge color based on total sign

---

### 4. Household ROI Exactly Zero

**Scenario:** Total household ROI = $0.00.

**Expected Behavior:**
- Badge shows: "ROI: $0.00" in gray (neutral color)
- Condition: `roi === 0` → `bg-gray-100 text-gray-700`

**Implementation:**
```typescript
const roiBadgeClass =
  roi > 0
    ? 'bg-green-100 text-green-800'
    : roi < 0
    ? 'bg-red-100 text-red-800'
    : 'bg-gray-100 text-gray-700';
```

---

### 5. Card with No Benefits

**Scenario:** A card exists but has no benefits associated (freshly added, all deleted, etc.).

**Expected Behavior:**
- CardTrackerPanel renders with empty benefits table
- Footer shows: "Total Extracted: $0.00 | Uncaptured: $0.00 | Net Fee: [actual fee]"
- ROI badge may be negative (showing -[annual fee])

**Implementation:**
- `CardTrackerPanel` handles empty `userBenefits` array gracefully (already does)

---

### 6. Benefit with No Expiration Date

**Scenario:** A benefit has `expirationDate = null` (e.g., permanent perks like lounge access).

**Expected Behavior:**
- CardTrackerPanel shows "—" in the Expires column (already implemented)
- Benefit is never considered "expiring soon"

**Implementation:**
- `CardTrackerPanel` already handles this with conditional rendering

---

### 7. Multiple Players in Household

**Scenario:** User has 3 players: "Primary", "Spouse", "Child". Each has multiple cards.

**Expected Behavior:**
- Page renders 3 separate sections, each with a header showing player name
- Cards are grouped correctly under their respective player
- Household ROI sums all cards from all players
- Total household ROI badge appears at top

**Implementation:**
```typescript
{players.map((player) => (
  <div key={player.id}>
    <h2>{player.playerName}'s Cards</h2>
    {player.userCards.map((card) => (
      <CardTrackerPanel key={card.id} userCard={card} playerName={player.playerName} />
    ))}
  </div>
))}
```

---

### 8. Closed Card (isOpen = false)

**Scenario:** User has closed a card but it still exists in the database.

**Expected Behavior:**
- Closed cards are NOT included in the query (filtered by `where: { isOpen: true }`)
- Page only displays active, open cards
- Closed cards are invisible to the dashboard (but preserved in database for history)

**Implementation:**
- Prisma query already filters: `where: { isOpen: true }`

---

### 9. Inactive Player (isActive = false)

**Scenario:** User has soft-deleted a player.

**Expected Behavior:**
- Inactive players are NOT included in the query
- Their cards are not displayed
- Player is preserved in database for audit/history

**Implementation:**
- Prisma query already filters: `where: { isActive: true }`

---

### 10. Concurrent Benefit Toggle & Page Refresh

**Scenario:** User marks a benefit as used in CardTrackerPanel, then quickly navigates away and back to the dashboard. Server action may still be in-flight.

**Expected Behavior:**
- If refresh occurs before server action completes:
  - Page shows old state (benefit not marked as used)
  - User's optimistic local state is lost (by design, since it's a new page load)
- If refresh occurs after server action completes:
  - Page shows new state (benefit marked as used)

**Implementation:**
- No special handling needed; optimistic updates are only within CardTrackerPanel
- Page fetch is independent and always reflects server state

---

### 11. Large Household (50+ Cards)

**Scenario:** Performance test: household with 5 players, 10 cards each, 15 benefits per card = 750 benefit records.

**Expected Behavior:**
- Query should complete in < 1 second
- Page should render without layout shift
- Component tree should be manageable for React

**Implementation:**
- Prisma indexes are in place (playerId, masterCardId, isOpen)
- Consider pagination or virtualization if households grow beyond this (future optimization)

---

### 12. Custom Annual Fee Override

**Scenario:** User has customized the annual fee for a card via `actualAnnualFee`.

**Expected Behavior:**
- CardTrackerPanel displays `actualAnnualFee` instead of `defaultAnnualFee`
- ROI calculations use the custom fee (already handled in `getNetAnnualFee`)
- All aggregations are correct

**Implementation:**
- No special handling in dashboard page
- CardTrackerPanel already handles this with: `userCard.actualAnnualFee ?? userCard.masterCard.defaultAnnualFee`

---

### 13. Prisma Query Timeout or Network Failure

**Scenario:** Database connection is slow or times out.

**Expected Behavior:**
- Query times out after N seconds (default Prisma timeout)
- Page throws an error
- Error boundary catches it and displays: "Unable to load dashboard. Please refresh or try again."
- HTTP status: 500

**Implementation:**
```typescript
try {
  const players = await prisma.player.findMany({ ... });
  // Render page
} catch (error) {
  console.error('Dashboard query failed:', error);
  throw new Error('Failed to load dashboard');
  // Next.js error.tsx boundary handles this
}
```

---

### 14. Missing MasterCard Reference

**Scenario:** A UserCard has a `masterCardId` that doesn't exist in the database (data integrity issue).

**Expected Behavior:**
- Prisma query fails with constraint violation
- Page throws an error
- (Should never happen in normal operation due to foreign key constraint)

**Implementation:**
- Handled by Prisma error boundary (error.tsx)

---

### 15. Null or Missing Player Name

**Scenario:** A player has `playerName = null` or empty string (invalid data).

**Expected Behavior:**
- Render the invalid name as-is (defensive)
- Or filter out invalid players before rendering
- Display: "Unnamed Player's Cards" or similar fallback

**Implementation:**
```typescript
const displayName = player.playerName || 'Unnamed Player';
```

---

## Component Architecture

### System Components & Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│  app/page.tsx (Server Component)                         │
│  - Fetch all players + cards + benefits (Prisma)        │
│  - Calculate household ROI                              │
│  - Group cards by player                                │
│  - Render header with household ROI badge               │
│  - Render player sections                               │
│  └─ Render CardTrackerPanel for each card               │
│     (Client Component, handles local interactivity)     │
└─────────────────────────────────────────────────────────┘
         ↓ uses                  ↓ calls
    ┌────────────────────────────────────────────┐
    │ Utilities & Modules                        │
    ├────────────────────────────────────────────┤
    │ src/lib/calculations.ts                    │
    │ - getEffectiveROI(userCard, benefits)      │
    │ - getTotalValueExtracted(benefits)         │
    │ - getNetAnnualFee(userCard, benefits)      │
    │ - getUncapturedValue(benefits)             │
    │                                            │
    │ Prisma Client                              │
    │ - prisma.player.findMany(...)              │
    └────────────────────────────────────────────┘
```

### Component Composition

```typescript
// app/page.tsx
export default async function DashboardPage() {
  // 1. Fetch data (Server Component)
  const players = await fetchPlayersWithCards();
  
  // 2. Aggregate metrics
  const householdROI = calculateHouseholdROI(players);
  
  // 3. Render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header householdROI={householdROI} />
      
      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {players.length === 0 ? (
          <EmptyState />
        ) : (
          players.map((player) => (
            <PlayerSection key={player.id} player={player} />
          ))
        )}
      </main>
      
      {/* Footer */}
      <Footer lastUpdated={new Date()} />
    </div>
  );
}

// Sub-components (internal to page, no export)
function Header({ householdROI }: { householdROI: number }) {
  // Title, subtitle, ROI badge
}

function PlayerSection({ player }: { player: PlayerWithCards }) {
  // Player header + CardTrackerPanel list
}

function EmptyState() {
  // "No players" message
}

function Footer({ lastUpdated }: { lastUpdated: Date }) {
  // Optional timestamp
}
```

### Dependencies Between Components

```
DashboardPage (root)
  ├─ Header
  ├─ PlayerSection (renders for each player)
  │   └─ CardTrackerPanel (renders for each card, Client Component)
  └─ Footer
```

**Notes:**
- `CardTrackerPanel` is a Client Component (`'use client'`) and handles its own state and interactivity
- All other components are Server Components and contain no client-side hooks
- Data flows from top down (no prop drilling; CardTrackerPanel receives fully formed userCard object)

---

## Implementation Tasks

### Phase 1: Core Data Fetching & Type Safety

**Task 1.1: Define Prisma Query Function**
- **Description:** Create `src/lib/db.ts` with `fetchPlayersWithCards()` function
- **Acceptance Criteria:**
  - Function returns strongly-typed player array with all nested relationships
  - Filters by `userId` (future: from session)
  - Includes only active players and open cards
  - Properly typed with TypeScript
  - Handles errors gracefully
- **Complexity:** Small
- **Dependencies:** None

**Task 1.2: Create TypeScript Interfaces**
- **Description:** Define types for dashboard data structure in `src/types/dashboard.ts`
- **Acceptance Criteria:**
  - `PlayerWithCards` interface encompasses player + cards + benefits
  - Extends Prisma-generated types where possible
  - Fully typed for all calculations
  - Exported and used in page.tsx
- **Complexity:** Small
- **Dependencies:** Task 1.1

**Task 1.3: Test Data Fetching Function**
- **Description:** Write unit tests for `fetchPlayersWithCards()` with mock data
- **Acceptance Criteria:**
  - Tests cover happy path (multiple players, various card counts)
  - Tests cover edge cases (no players, no cards, inactive records filtered out)
  - Tests verify correct relationship includes
  - All tests pass
- **Complexity:** Small
- **Dependencies:** Task 1.1

---

### Phase 2: Layout & Structure

**Task 2.1: Create Page Component Shell**
- **Description:** Create `app/page.tsx` with basic structure and Tailwind layout
- **Acceptance Criteria:**
  - Page is a Server Component (async, no `'use client'`)
  - Calls `fetchPlayersWithCards()` and handles errors
  - Basic layout: header, main, footer sections
  - Tailwind grid/flex for responsive layout
  - Builds without errors
- **Complexity:** Medium
- **Dependencies:** Task 1.1, Task 1.2

**Task 2.2: Implement Household ROI Aggregation**
- **Description:** Create function to calculate total household ROI from all cards
- **Acceptance Criteria:**
  - `calculateHouseholdROI(players)` iterates all cards and calls `getEffectiveROI()`
  - Returns total in cents (integer)
  - Handles empty player array (returns 0)
  - Exported for use in page and tests
- **Complexity:** Small
- **Dependencies:** Task 2.1

**Task 2.3: Build Header Component**
- **Description:** Create Header sub-component with title, subtitle, and ROI badge
- **Acceptance Criteria:**
  - Title: "Card Benefits Dashboard"
  - Subtitle: "Track benefits, optimize spending, maximize value"
  - ROI badge shows total household ROI with correct color (green/red/gray)
  - Currency formatted correctly ($X.XX)
  - Responsive design (badge on right side or below on mobile)
- **Complexity:** Medium
- **Dependencies:** Task 2.2

**Task 2.4: Implement Player Grouping Logic**
- **Description:** Create function to organize cards by player
- **Acceptance Criteria:**
  - Groups cards by `player.playerName`
  - Maintains player order (sorted by createdAt)
  - Each player section has a header (e.g., "Primary's Cards")
  - Returns structure ready for rendering
- **Complexity:** Small
- **Dependencies:** Task 2.1

---

### Phase 3: Integration & Edge Cases

**Task 3.1: Render CardTrackerPanel Components**
- **Description:** Integrate CardTrackerPanel into page for each card
- **Acceptance Criteria:**
  - CardTrackerPanel imported and rendered for each card
  - Props passed correctly: `userCard` (with masterCard & userBenefits) and `playerName`
  - All props are properly typed
  - Benefits are visible and interactive
- **Complexity:** Small
- **Dependencies:** Task 2.1

**Task 3.2: Implement Empty States**
- **Description:** Create EmptyState component for no players, no cards scenarios
- **Acceptance Criteria:**
  - Empty database shows: "No players in your wallet yet"
  - Player with no cards shows: "No cards yet"
  - Messages are clear and helpful
  - Styling matches dashboard design
- **Complexity:** Small
- **Dependencies:** Task 2.1

**Task 3.3: Add Last Updated Timestamp**
- **Description:** Display "Last updated at HH:MM:SS" in footer
- **Acceptance Criteria:**
  - Shows current server time when page renders
  - Format: "Last updated at 3:45 PM"
  - Optional component (can be hidden/removed)
  - Responsive layout
- **Complexity:** Small
- **Dependencies:** Task 2.1

**Task 3.4: Error Handling & Boundaries**
- **Description:** Ensure errors are caught and displayed gracefully
- **Acceptance Criteria:**
  - Prisma query errors are caught and logged
  - Error boundary displays user-friendly message
  - Stack traces shown only in development
  - No blank page or unhandled exceptions
  - HTTP 500 status returned on error
- **Complexity:** Medium
- **Dependencies:** Task 2.1

---

### Phase 4: Testing & Optimization

**Task 4.1: Write Integration Tests**
- **Description:** Test full page render with various data scenarios
- **Acceptance Criteria:**
  - Test with empty database
  - Test with single player, multiple cards
  - Test with multiple players
  - Verify correct grouping and calculations
  - All tests pass
- **Complexity:** Medium
- **Dependencies:** Phase 3

**Task 4.2: Performance Benchmarking**
- **Description:** Measure page render time and identify bottlenecks
- **Acceptance Criteria:**
  - Prisma query completes in < 500ms (typical)
  - Page renders in < 1 second (with sample data)
  - No N+1 queries (verified with Prisma logging)
  - Bundle size impact is negligible
  - Document findings and optimization opportunities
- **Complexity:** Medium
- **Dependencies:** Phase 3

**Task 4.3: Accessibility Audit**
- **Description:** Verify WCAG 2.1 Level AA compliance
- **Acceptance Criteria:**
  - All text has sufficient contrast (4.5:1 for body text)
  - Semantic HTML structure (headings, lists, buttons)
  - Keyboard navigation works
  - Screen reader tested (audit tool + manual)
  - Fix any issues found
- **Complexity:** Medium
- **Dependencies:** Phase 3

**Task 4.4: Responsive Design Testing**
- **Description:** Test layout on mobile, tablet, desktop viewports
- **Acceptance Criteria:**
  - Mobile (375px): stacked layout, readable text
  - Tablet (768px): cards in 2-column grid or list
  - Desktop (1024px+): optimal layout
  - No horizontal scroll or overflow
  - Touch targets are 44px minimum
- **Complexity:** Small
- **Dependencies:** Phase 3

---

## Security & Compliance Considerations

### Authentication & Authorization

1. **User Context** (Future Implementation)
   - Current state: No authentication enforcement (placeholder for `userId`)
   - Future: Extract `userId` from authenticated session (NextAuth.js, Clerk, etc.)
   - Query filters by `userId`: `where: { userId: session.user.id }`
   - Only users can see their own household data

2. **Access Control**
   - Players and cards are scoped to a single User
   - Foreign key constraints prevent direct access to other users' data
   - No player/card ID validation needed if query is scoped by userId

### Data Protection & Privacy

1. **Sensitive Fields in Response**
   - No passwords or API keys in player/card data
   - Annual fees and benefit values are user-generated, not sensitive
   - Personally identifiable information (player name) is user-supplied

2. **Client-Side Data Exposure**
   - CardTrackerPanel is a Client Component and receives full benefit data
   - This is intentional: the user owns this data and needs it for interactivity
   - Data is not logged or exposed to third parties

3. **Database Security**
   - SQLite file permissions: restricted to application user
   - No direct database access from client (all via Prisma/Server Components)
   - Connection string stored in `.env.local` (not committed)

### Audit & Logging

1. **Page Access Logging** (Optional Future Feature)
   - Consider logging dashboard page views for analytics
   - Track user sessions and time spent on dashboard

2. **Benefit Toggle Logging** (Already Implemented)
   - Server action `toggleBenefit` should log changes
   - `claimedAt` timestamp tracks when benefits were marked as used
   - Audit trail available via database timestamps

3. **Error Logging**
   - Catch and log Prisma errors for debugging
   - Sanitize error messages shown to users (no internal details)
   - Monitor for repeated failures (potential outage)

---

## Performance & Scalability Considerations

### Expected Load & Growth

1. **Current Scale**
   - Small households: 1–2 players, 3–5 cards each, 10–15 benefits per card
   - Database: < 10,000 records per user

2. **Growth Projections**
   - Large households: 3–5 players, 10+ cards each
   - Power users: 20+ cards with hundreds of benefits
   - Thousands of household records as user base grows

### Caching Strategies

1. **Server-Side Caching** (Not Recommended for Dashboard)
   - Dashboard data changes frequently (benefits toggled, cards added)
   - Stale cache could show incorrect ROI or benefit status
   - Better to fetch fresh data on every request

2. **Client-Side Caching** (Handled by CardTrackerPanel)
   - CardTrackerPanel maintains optimistic local state
   - Server actions are non-blocking (useTransition)
   - No app-level caching needed for dashboard page

3. **HTTP Caching**
   - Dashboard is HTML (Server Component rendered)
   - Set `Cache-Control: no-store` or `private` to prevent browser caching
   - Each request should fetch fresh data

### Database Optimization

1. **Indexes** (Already Defined in Schema)
   ```prisma
   // Player
   @@index([userId])
   @@unique([userId, playerName])
   
   // UserCard
   @@index([playerId])
   @@index([masterCardId])
   @@unique([playerId, masterCardId])
   
   // UserBenefit
   @@index([userCardId])
   @@index([playerId])
   @@index([type])
   @@index([isUsed])
   @@index([expirationDate])
   @@unique([userCardId, name])
   ```

2. **Query Optimization**
   - Use Prisma `include` to fetch relationships in single round-trip
   - Filter early (`where: { isOpen: true }`) before including nested data
   - Avoid fetching unused columns (use `select` if needed in future)

3. **Pagination** (Future Feature)
   - If households grow beyond 50 cards, consider paginating cards per player
   - Server-side pagination with URL query params: `?page=1`
   - CardTrackerPanel components lazy-loaded as user scrolls

### Rate Limiting & Throttling

1. **Page Requests**
   - No rate limiting needed for dashboard page (Server Component)
   - Implicit rate limiting via page load time

2. **Benefit Toggle Actions**
   - Handled by CardTrackerPanel via `toggleBenefit` server action
   - Consider rate limiting server action: max 1 toggle per second per user
   - Prevent accidental double-clicks with `disabled={inFlight}` checkbox state

### Bundle Size Impact

1. **Server Component**
   - No bundled JavaScript for page logic (Server Component)
   - Only CardTrackerPanel is bundled (Client Component)

2. **Calculation Utilities**
   - `src/lib/calculations.ts` is imported by both Server and Client
   - Tree-shakeable; unused functions are removed by bundler
   - Minimal impact (< 5KB gzipped)

---

## TypeScript & Type Definitions

### Page-Level Types

```typescript
// Type for grouped players + cards (with all relations)
type PlayerWithCards = Awaited<ReturnType<typeof prisma.player.findMany>>[0];

type CardTrackerPanelUserCard = PlayerWithCards['userCards'][0];

// Aggregation results
type HouseholdROI = {
  total: number;       // in cents
  perCard: Record<string, number>;  // cardId -> ROI in cents
  perPlayer: Record<string, number>; // playerId -> summed ROI
};
```

### Calculation Function Signatures

```typescript
// From src/lib/calculations.ts (already defined)
export function getEffectiveROI(
  userCard: UserCard,
  userBenefits: UserBenefit[]
): number;

export function getTotalValueExtracted(userBenefits: UserBenefit[]): number;

export function getNetAnnualFee(
  userCard: UserCard,
  userBenefits: UserBenefit[]
): number;

export function getUncapturedValue(userBenefits: UserBenefit[]): number;
```

---

## File Structure & Organization

```
app/
  page.tsx                    # Main dashboard page (this spec)
  error.tsx                   # Error boundary
  layout.tsx                  # Root layout (if not exists)

src/
  components/
    CardTrackerPanel.tsx      # Already exists (Client Component)
  
  lib/
    calculations.ts           # Already exists (utilities)
    db.ts                      # New: Database query functions
  
  types/
    dashboard.ts              # New: Dashboard-specific types

.github/
  specs/
    dashboard-page-spec.md    # This specification
```

---

## Acceptance Criteria Checklist

- [ ] Page fetches all players and cards in a single Prisma query
- [ ] Household ROI badge displays correctly (green/red/gray)
- [ ] Cards are grouped by player name
- [ ] CardTrackerPanel components render with correct props
- [ ] Empty states display for no players or player with no cards
- [ ] Last updated timestamp is shown in footer
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] All TypeScript types are correct and no `any` used
- [ ] Error handling catches and displays errors gracefully
- [ ] Page is a Server Component (no `'use client'`)
- [ ] No N+1 queries or performance issues
- [ ] Unit tests cover all calculation logic
- [ ] Integration tests verify full page render
- [ ] Accessibility audit passes (WCAG 2.1 Level AA)
- [ ] Security: no sensitive data exposure
- [ ] Future auth integration is possible (userId parameter support)

---

## Future Enhancements

1. **Add Card Flow**
   - Button to create new cards
   - Link from empty states

2. **Player Management**
   - Add/remove players
   - Rename player
   - Link from header

3. **Card Customization**
   - Edit card name, annual fee
   - Change renewal date
   - Reorder cards

4. **Notifications & Alerts**
   - Alert banner for expiring benefits
   - Toast notification on benefit toggle
   - Summary of upcoming expirations

5. **Analytics & Reports**
   - Chart of ROI over time
   - Spending optimization suggestions
   - Annual summary reports

6. **Pagination**
   - Load cards on demand (infinite scroll or pagination)
   - Improve performance for large households

7. **Dark Mode**
   - Theme toggle
   - Persist user preference

8. **Mobile App**
   - Native React Native version
   - Share dashboard data

---

## Related Documentation

- **Prisma Schema:** `/prisma/schema.prisma`
- **CardTrackerPanel Component:** `src/components/CardTrackerPanel.tsx`
- **Calculation Utilities:** `src/lib/calculations.ts`
- **Database Quick Reference:** `/DB-QUICK-REFERENCE.md`
- **Setup Instructions:** `/SETUP-COMPLETE.md`

---

## Sign-Off

**Specification Version:** 1.0  
**Status:** Ready for Implementation  
**Last Updated:** [Current Date]  

This specification is complete and ready to be handed to the engineering team. All requirements are defined, edge cases are documented, and implementation tasks are actionable.
