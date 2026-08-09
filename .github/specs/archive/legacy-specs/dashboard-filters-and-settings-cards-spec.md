---
title: Dashboard Filters Refinement & My Cards Settings Section
version: 1.0
date_created: 2024-11-28
last_updated: 2024-11-28
owner: Card Benefits Team
tags: [design, ui, frontend, dashboard, settings, cards, filters, ux]
---

# Introduction

This specification defines the technical requirements for two interconnected dashboard enhancements that improve user experience by streamlining benefit filtering and enabling card management within the settings profile. The enhancements focus on reducing cognitive load through a simplified filter interface while providing robust card management capabilities.

## 1. Purpose & Scope

### 1.1 Overview

This specification covers:

1. **Dashboard Filter UI Refinement** - Transforming status and period filters into horizontally scrollable components that match the CardSwitcher tab interface, reducing clutter on mobile and tablet devices while improving usability across all screen sizes.

2. **My Cards Section in Settings** - Adding a new subsection within the Settings > Profile tab that displays all user-assigned cards with full CRUD operations (Create handled by existing Add Card flow, Read/Update/Delete in new section).

### 1.2 Scope Boundaries

**In Scope:**
- UI/UX refinement of filter interface (status & period filters)
- New "My Cards" management section in Settings > Profile tab
- API integration for card management operations
- Responsive design for mobile (375px), tablet (768px), and desktop (1440px+)
- Dark mode support throughout
- Accessibility compliance (WCAG AA standard)
- TypeScript strict mode compliance

**Out of Scope:**
- Bulk operations on cards
- Advanced filtering/search within card list (future enhancement)
- Card network logos/images (use icons from Lucide only)
- Card fraud reporting features
- Card replacement workflow

### 1.3 Intended Audience

- Frontend developers implementing UI components
- Backend developers implementing/extending API endpoints
- QA engineers testing features across devices and themes
- UI/UX designers validating responsive behavior

### 1.4 Assumptions

- User authentication already implemented and working
- Existing design tokens are available and maintained in `/src/styles/design-tokens.css`
- Existing component libraries (Button, Input, Select, Modal) are available
- API structure follows RESTful conventions with proper error handling
- Users have at least one card associated with their account
- Dark mode is implemented using CSS variables

---

## 2. Definitions

| Term | Definition |
|------|-----------|
| **Status Filter** | User-facing filter controls that display benefit statuses: Active, Expiring, Used |
| **Period Filter** | Date range selector for filtering benefits by billing/calendar periods (Monthly, Quarterly, Annual, etc.) |
| **Horizontally Scrollable** | UI pattern where content overflow is handled via left/right scrolling instead of text wrapping |
| **CardSwitcher** | Existing tab interface component at `src/shared/components/features/CardSwitcher.tsx` that displays credit cards as scrollable tabs |
| **Design Tokens** | CSS custom properties defined in `src/styles/design-tokens.css` that enforce design consistency |
| **Dark Mode** | Alternative color scheme activated when system/user prefers dark theme; implemented using CSS variables |
| **WCAG AA** | Web Content Accessibility Guidelines Level AA - standard requiring 4.5:1 contrast ratio for normal text |
| **Form Validation** | Client-side and server-side validation ensuring data integrity before submission |
| **Modal** | Dialog component using Radix UI DialogPrimitive for controlled focus management |
| **Confirmation Dialog** | Modal used for destructive actions (deletion) requiring explicit user confirmation |
| **Card Network** | Payment card issuer category (Visa, Mastercard, American Express, Discover) |
| **Card Type** | Payment card classification (Credit, Debit, Prepaid) |
| **Last Four Digits** | Final four digits of card number used for identification without exposing full PAN |
| **isActive** | Boolean flag indicating whether card can be used for benefits assignment |

---

## 3. Requirements, Constraints & Guidelines

### 3.1 Dashboard Filter Refinement Requirements

#### **REQ-001**: Status Filter Reduction
- Status filter options **MUST** be reduced from 5 to exactly 3 options: **Active**, **Expiring**, **Used**
- Remove: "Expired" and "Pending" statuses from user-facing filter
- These removed statuses **MAY** still be tracked in data model but not displayed in dashboard filters
- Label text **MUST** use simple, user-friendly terminology

#### **REQ-002**: Horizontal Scrolling Implementation
- Both status filters **AND** period filters **MUST** be horizontally scrollable containers
- Scrolling **MUST** be implemented using CSS `overflow-x-auto` with smooth behavior
- Filters **MUST NOT** wrap to multiple lines on any device size (mobile, tablet, desktop)
- Wrapper **MUST** include `scroll-snap-type: x mandatory` for predictable snap points
- Individual filter items **MUST** have `scroll-snap-align: center` for better UX

#### **REQ-003**: CardSwitcher Behavior Parity
- Scrolling implementation **MUST** match the CardSwitcher pattern from `src/shared/components/features/CardSwitcher.tsx`
- Navigation arrows **MUST** appear only when scrollable content overflows
- Arrow buttons **MUST** use `ChevronLeft` and `ChevronRight` icons from lucide-react
- Arrow placement: positioned absolutely outside scrollable area
- Smooth scrolling animation **MUST** use `scrollBy({ behavior: 'smooth' })`

#### **REQ-004**: Scrollbar Styling
- Scrollbar **MUST** use the `.scrollbar-hide` CSS class for subtle/hidden presentation
- Firefox: `scrollbar-width: none`
- WebKit browsers: `::-webkit-scrollbar { display: none }`
- Fallback: if scrollbar visible, use design token colors (`--color-border`, `--color-bg`)

#### **REQ-005**: Keyboard Navigation
- Arrow keys (← →) **MUST** scroll filters without changing selection
- Tab key **MUST** allow focus through individual filter buttons
- Enter/Space **MUST** toggle filter selection
- Home/End keys **MUST** navigate to first/last filter
- Focus indicators **MUST** use `focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]`

#### **REQ-006**: Responsive Breakpoints
- **Mobile (375px)**: Single row scrollable filters with visible scroll hints
- **Tablet (768px)**: Single row scrollable filters with arrows visible on overflow
- **Desktop (1440px+)**: Single row, may show all filters without scrolling depending on content
- All breakpoints **MUST** eliminate line wrapping via horizontal scroll

### 3.2 My Cards Section Requirements

#### **REQ-101**: Section Placement & Visibility
- "My Cards" section **MUST** appear below "Profile Information" in Settings > Profile tab
- Section **MUST** be visible to all authenticated users
- Section **MUST** appear after "Profile Information" section ends and before any other sections
- Empty state message: "No cards yet. Add a card to get started."

#### **REQ-102**: Card Display
- Each card **MUST** display: card name, last 4 digits, card type, card network
- Card layout **MUST** use a card/tile design matching existing dashboard card styling
- Cards **MUST** be displayed in a responsive grid (1 column mobile, 2+ columns tablet/desktop)
- Minimum card height: 120px; maximum width per card: 300px on desktop

#### **REQ-103**: Card Metadata Fields
- **Card Name**: User-provided custom name (editable, 1-50 characters)
- **Last Four Digits**: Display as "•••• XXXX" (read-only)
- **Card Type**: Credit/Debit/Prepaid (display as label, editable)
- **Card Network**: Visa/Mastercard/Amex/Discover (display as label, editable)
- **Active Status**: Toggle indicator showing if card can receive benefits

#### **REQ-104**: Card Actions
- Each card **MUST** provide two primary actions: **Edit** and **Delete**
- Action buttons **MUST** use consistent styling with existing action buttons
- Edit button: Opens CardEditModal (see REQ-201)
- Delete button: Shows confirmation dialog (see REQ-301)
- Actions **MUST** be keyboard accessible (Tab + Enter/Space)

#### **REQ-105**: Empty State Handling
- When user has no cards: display centered empty state message
- Empty state **MUST** include the text: "No cards yet. Add a card to get started."
- Empty state **SHOULD** include a "Add Card" link if Add Card modal flow exists
- Empty state styling **MUST** match existing empty states in the app

#### **REQ-106**: Loading States
- During initial data fetch: Show skeleton loaders (minimum 3 placeholder cards)
- Skeleton **MUST** use `.animate-pulse` class with design token colors
- During action (edit/delete): Show loading spinner or button state change
- Loading state **MUST** disable interaction with other cards

#### **REQ-107**: Error Handling
- Network errors during fetch: Display error message with retry button
- Card operation errors: Display error toast/alert with specific error message
- API timeout (>30s): Show user-friendly timeout message with retry option
- Validation errors: Show form-level error messages in edit modal

### 3.3 CardEditModal Requirements

#### **REQ-201**: Modal Structure & Appearance
- **MUST** use Radix UI DialogPrimitive for accessibility (same as EditBenefitModal)
- Modal header **MUST** display: "Edit Card"
- Modal **MUST** include close button (X icon) in top-right corner
- Modal width: `max-w-md` (500px max) on all screen sizes
- Modal **MUST** support scrollable content on mobile/small viewports
- Modal backdrop **MUST** use black overlay with 50% opacity

#### **REQ-202**: Editable Form Fields
- **Card Name** (required):
  - Text input, 1-50 characters
  - Validation: non-empty, no leading/trailing whitespace
  - Placeholder: "Enter card nickname"
  
- **Card Type** (required):
  - Dropdown select with options: Credit, Debit, Prepaid
  - Use UnifiedSelect component
  - Display as label in readonly view
  
- **Card Network** (required):
  - Dropdown select with options: Visa, Mastercard, Amex, Discover
  - Use UnifiedSelect component
  - Display as label in readonly view
  
- **Active Status** (required):
  - Toggle switch (or checkbox)
  - Label: "This card is active and can receive benefits"
  - Default: true (checked)

#### **REQ-203**: Read-Only Fields
- Last four digits: Display as "•••• XXXX" (non-editable)
- Card ID: **MUST NOT** be exposed in UI
- Created date: **MAY** be shown as informational text (non-editable)

#### **REQ-204**: Form Validation
- Client-side validation **MUST** occur on field blur and form submission
- Server-side validation **MUST** reject invalid requests with detailed error messages
- Display validation errors below each field in red using FormError component
- Show form-level error message if API request fails

#### **REQ-205**: Form Actions
- **Save Button**: Submit form and close modal on success
- **Cancel Button**: Close modal without changes
- Save button **MUST** show loading state during submission (disabled, spinner shown)
- Success: Show toast notification "Card updated successfully"
- Failure: Show inline error message above action buttons

#### **REQ-206**: Modal Styling
- Match EditBenefitModal styling from `src/features/benefits/components/modals/EditBenefitModal.tsx`
- Use design tokens for colors, spacing, typography
- Dark mode: Automatically inherit from CSS variables
- Focus management: Focus trap within modal; return focus to trigger button on close

### 3.4 CardDeleteConfirmation Requirements

#### **REQ-301**: Confirmation Dialog Structure
- **MUST** use Radix UI DialogPrimitive (match DeleteBenefitConfirmationDialog pattern)
- Dialog title: "Delete Card"
- Dialog description: "Are you sure you want to delete [CARD NAME]? This action cannot be undone."
- Include close button (X icon) in top-right
- Dialog width: `max-w-sm` (384px max)
- Backup: "This will remove the card from your account but won't affect existing benefits."

#### **REQ-302**: Confirmation Actions
- **Cancel Button**: Close dialog without action (primary/default action)
- **Delete Button**: Proceed with deletion (destructive action, typically red styling)
- Delete button **MUST** show loading state during API call
- Both buttons **MUST** be disabled during submission

#### **REQ-303**: Deletion Workflow
1. User clicks Delete on card
2. Confirmation dialog displays
3. User confirms deletion
4. POST request sent to DELETE `/api/cards/[id]`
5. On success: Close modal, refresh card list, show success toast
6. On error: Display error message, allow retry
7. Redirect/refresh card list **MUST** happen automatically

#### **REQ-304**: Error Handling in Deletion
- API error response: Display specific error message from server
- Network error: Show "Network error. Please try again."
- 404 error: Show "Card not found. It may have been deleted."
- 403 error: Show "You don't have permission to delete this card."

### 3.5 API Requirements

#### **REQ-501**: GET /api/cards/user-cards (New or Existing)
- **Method**: GET
- **Authentication**: Required (bearer token or session cookie)
- **Response**: 200 OK with card array
- **Error Responses**:
  - 401: Unauthorized - user not authenticated
  - 500: Server error
- **Response Body**:
  ```json
  {
    "success": true,
    "cards": [
      {
        "id": "uuid",
        "userId": "uuid",
        "name": "string",
        "lastFourDigits": "string",
        "cardNetwork": "enum: Visa|Mastercard|Amex|Discover",
        "cardType": "enum: Credit|Debit|Prepaid",
        "isActive": "boolean",
        "createdAt": "ISO8601 timestamp"
      }
    ]
  }
  ```

#### **REQ-502**: PATCH /api/cards/[id]
- **Method**: PATCH
- **Authentication**: Required
- **Path Params**: `id` - UUID of card to update
- **Request Body**:
  ```json
  {
    "name": "string (1-50 chars)",
    "cardType": "enum: Credit|Debit|Prepaid",
    "cardNetwork": "enum: Visa|Mastercard|Amex|Discover",
    "isActive": "boolean"
  }
  ```
- **Response**: 200 OK with updated card object
- **Error Responses**:
  - 400: Validation error (missing/invalid fields)
  - 401: Unauthorized
  - 404: Card not found
  - 500: Server error

#### **REQ-503**: DELETE /api/cards/[id]
- **Method**: DELETE
- **Authentication**: Required
- **Path Params**: `id` - UUID of card to delete
- **Response**: 200 OK with success message
- **Response Body**:
  ```json
  {
    "success": true,
    "message": "Card deleted successfully"
  }
  ```
- **Error Responses**:
  - 401: Unauthorized
  - 403: Forbidden (card owned by other user)
  - 404: Card not found
  - 500: Server error

### 3.6 Constraints

| Constraint | Details |
|-----------|---------|
| **CON-001** | Status filters reduced to 3 ONLY - no modal settings to change count |
| **CON-002** | No line wrapping on any screen size; horizontal scroll MANDATORY |
| **CON-003** | Card data is user-scoped; users can only view/edit/delete their own cards |
| **CON-004** | Cannot delete last card if it has active benefits (validation at API level) |
| **CON-005** | Card name max length: 50 characters; enforced client and server-side |
| **CON-006** | All timestamps in ISO8601 format (UTC timezone) |
| **CON-007** | No optimistic UI updates; wait for server confirmation before updating state |
| **CON-008** | Modal max-width: 500px; must be mobile-friendly without horizontal scroll |
| **CON-009** | Scrollable filter containers must maintain keyboard focus management |
| **CON-010** | Dark mode must have equivalent contrast ratios (4.5:1) in both themes |

### 3.7 Guidelines

| Guideline | Details |
|-----------|---------|
| **GUD-001** | Use existing design tokens from `src/styles/design-tokens.css` for all colors/spacing/typography |
| **GUD-002** | Components SHOULD use composition pattern; avoid prop drilling beyond 2 levels |
| **GUD-003** | Error messages SHOULD be user-friendly and actionable (avoid technical jargon) |
| **GUD-004** | Loading states SHOULD provide visual feedback within 100ms of user action |
| **GUD-005** | Toast notifications SHOULD auto-dismiss after 5-7 seconds for success messages |
| **GUD-006** | Form validation SHOULD debounce on input (300ms) to avoid excessive feedback |
| **GUD-007** | API calls SHOULD include timeout handling (30s max) with user notification |
| **GUD-008** | Filter buttons SHOULD use consistent hover/active states across both filters |
| **GUD-009** | Card edit modal SHOULD preserve scroll position when opened/closed |
| **GUD-010** | Deletion SHOULD be undoable via toast "undo" link if backend supports (soft delete) |

---

## 4. Interfaces & Data Contracts

### 4.1 Component Props

#### StatusFilters Component (Refined)
```typescript
interface StatusFiltersProps {
  selectedStatuses: ('active' | 'expiring' | 'used')[];
  onStatusChange: (statuses: ('active' | 'expiring' | 'used')[]) => void;
  availableStatuses: StatusOption[];
}

interface StatusOption {
  id: 'active' | 'expiring' | 'used';
  label: string;           // 'Active', 'Expiring', 'Used'
  icon: React.ReactNode;   // Lucide icon component
  description: string;     // Tooltip text
  color: string;          // CSS variable reference: --color-success, etc.
}
```

#### PeriodSelector Component (Existing)
```typescript
interface PeriodSelectorProps {
  selectedPeriod: PeriodOption;
  onPeriodChange: (period: PeriodOption) => void;
  availablePeriods: PeriodOption[];
}

interface PeriodOption {
  id: string;              // e.g., 'current_month', 'current_quarter'
  label: string;
  startDate: Date;
  endDate: Date;
}
```

#### MyCardsSection Component (New)
```typescript
interface MyCardsSectionProps {
  userId: string;          // Current authenticated user ID
  onCardAdded?: () => void; // Callback after successful card add
}
```

#### CardItem Component (New)
```typescript
interface CardItemProps {
  card: Card;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  isLoading?: boolean;
}

interface Card {
  id: string;
  userId: string;
  name: string;
  lastFourDigits: string;
  cardNetwork: 'Visa' | 'Mastercard' | 'Amex' | 'Discover';
  cardType: 'Credit' | 'Debit' | 'Prepaid';
  isActive: boolean;
  createdAt: string;       // ISO8601
}
```

#### CardEditModal Component (New)
```typescript
interface CardEditModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onCardUpdated: (card: Card) => void;
}
```

#### CardDeleteConfirmation Component (New)
```typescript
interface CardDeleteConfirmationProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>; // Async to show loading state
}
```

### 4.2 API Contracts

#### Request: Get User Cards
```http
GET /api/cards/user-cards
Authorization: Bearer <token>
Content-Type: application/json
```

#### Response: 200 OK
```json
{
  "success": true,
  "cards": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "550e8400-e29b-41d4-a716-446655440111",
      "name": "My Chase Sapphire",
      "lastFourDigits": "4242",
      "cardNetwork": "Visa",
      "cardType": "Credit",
      "isActive": true,
      "createdAt": "2024-11-01T10:30:00Z"
    }
  ]
}
```

#### Request: Update Card
```http
PATCH /api/cards/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Primary Travel Card",
  "cardType": "Credit",
  "cardNetwork": "Visa",
  "isActive": true
}
```

#### Response: 200 OK
```json
{
  "success": true,
  "card": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440111",
    "name": "Primary Travel Card",
    "lastFourDigits": "4242",
    "cardNetwork": "Visa",
    "cardType": "Credit",
    "isActive": true,
    "createdAt": "2024-11-01T10:30:00Z"
  }
}
```

#### Request: Delete Card
```http
DELETE /api/cards/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

#### Response: 200 OK
```json
{
  "success": true,
  "message": "Card deleted successfully"
}
```

---

## 5. Acceptance Criteria

### Filter Refinement Acceptance Criteria

#### **AC-001**: Status Filter Options Reduced
- **Given** the dashboard is loaded in any viewport
- **When** the user views the status filters
- **Then** exactly 3 filter options are visible: Active, Expiring, Used

#### **AC-002**: No Line Wrapping on Mobile
- **Given** the dashboard on a 375px mobile viewport
- **When** the user views the status and period filters
- **Then** filters are displayed in a single row with horizontal scroll (no wrapping)

#### **AC-003**: Filters Match CardSwitcher Behavior
- **Given** the CardSwitcher and Status Filters are both visible
- **When** the user scrolls each component
- **Then** both use smooth scrolling animation and display navigation arrows identically

#### **AC-004**: Keyboard Navigation Works
- **Given** filter buttons are focused
- **When** the user presses left/right arrow keys
- **Then** the scroll container scrolls smoothly without changing filter selection

#### **AC-005**: Scrollbar Hidden
- **Given** a browser with scrollable filter content
- **When** the user hovers over the filter container
- **Then** no visible scrollbar is displayed

#### **AC-006**: Responsive on All Breakpoints
- **Given** the dashboard loaded at three viewports (375px, 768px, 1440px)
- **When** the user views filters at each breakpoint
- **Then** filters remain in single row at all breakpoints with appropriate scroll behavior

### My Cards Section Acceptance Criteria

#### **AC-101**: Section Visible in Profile Tab
- **Given** user is in Settings > Profile tab
- **When** page loads and user data is available
- **Then** "My Cards" section is visible below "Profile Information"

#### **AC-102**: Cards Display Correctly
- **Given** user has 2+ cards in their account
- **When** My Cards section loads
- **Then** all cards are displayed with name, last 4 digits, type, and network

#### **AC-103**: Empty State Displays
- **Given** user has no cards
- **When** My Cards section loads
- **Then** empty state message displays: "No cards yet. Add a card to get started."

#### **AC-104**: Edit Modal Opens
- **Given** user clicks Edit button on a card
- **When** edit button click is processed
- **Then** CardEditModal opens with card data pre-filled

#### **AC-105**: Edit Form Validates
- **Given** user is in edit modal
- **When** user leaves card name empty and clicks Save
- **Then** validation error displays: "Card name is required"

#### **AC-106**: Delete Confirmation Shows
- **Given** user clicks Delete button on a card named "My Amex"
- **When** delete click is processed
- **Then** confirmation dialog shows with text "Are you sure you want to delete My Amex?"

#### **AC-107**: Card Deleted Successfully
- **Given** user confirms card deletion in dialog
- **When** API responds with 200 OK
- **Then** card is removed from list and success message displays

#### **AC-108**: Loading State Shown During Fetch
- **Given** My Cards section is loading
- **When** skeleton loaders are rendered
- **Then** 3 placeholder cards display with pulse animation

#### **AC-109**: Error Handling Works
- **Given** API returns 500 error during card fetch
- **When** error response received
- **Then** error message displays with retry button

#### **AC-110**: Dark Mode Support
- **Given** user has dark mode enabled
- **When** My Cards section is rendered
- **Then** all text, backgrounds, borders use correct dark mode colors

#### **AC-111**: Responsive on Mobile
- **Given** My Cards section on 375px mobile viewport
- **When** cards are rendered
- **Then** cards display in single column without horizontal scroll

#### **AC-112**: Responsive on Tablet
- **Given** My Cards section on 768px tablet viewport
- **When** cards are rendered
- **Then** cards display in 2-column grid layout

#### **AC-113**: Keyboard Accessible
- **Given** user navigates with Tab key
- **When** user reaches Edit/Delete buttons
- **Then** buttons can be activated with Enter or Space keys

---

## 6. Test Automation Strategy

### 6.1 Test Levels

| Level | Scope | Example |
|-------|-------|---------|
| **Unit** | Individual components in isolation | StatusFilters component with mock props |
| **Integration** | Components + local state management | MyCardsSection + CardItem with fetched data |
| **E2E** | Full user workflows | User adds card → navigates to settings → edits card → deletes card |
| **Accessibility** | WCAG AA compliance | Keyboard navigation, focus traps, contrast ratios |

### 6.2 Testing Frameworks & Tools

| Tool | Purpose | Config |
|------|---------|--------|
| **Vitest** | Unit & integration tests | `vitest.config.ts` |
| **React Testing Library** | Component testing | Queries: `getByRole`, `getByLabelText` |
| **Playwright** | E2E testing | `playwright.config.ts` - uses chromium, firefox, webkit |
| **axe-core** | Accessibility testing | Via Playwright with `@axe-core/playwright` |

### 6.3 Coverage Requirements

| Category | Minimum Coverage |
|----------|-----------------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |
| Critical Paths | 100% |

---

## 7. Rationale & Context

### 7.1 Filter Reduction to 3 Options

**Rationale**: The original 5 status options created cognitive load and UI clutter, particularly on mobile devices. Users most commonly care about:
- **Active**: Benefits they can currently use
- **Expiring**: Time-sensitive benefits requiring attention
- **Used**: Historical record of claimed benefits

**Removed statuses**:
- **Expired**: Rarely relevant after expiration date passes
- **Pending**: Represents edge case (not yet approved)

### 7.2 Horizontal Scrolling for Filters

**Rationale**: Single-row scrollable container prevents layout shifting and provides consistent interaction pattern across dashboard (matches CardSwitcher tabs).

**Alternative Considered**: Multi-row wrapping with flex-wrap
- ❌ Causes layout instability
- ❌ Less predictable on different screen sizes
- ✅ Selected: Single-row scroll with snap points

### 7.3 My Cards in Settings (Not Dashboard)

**Rationale**: Card management is account/profile-scoped. Placing in Settings > Profile aligns with mental model (account settings vs. benefit tracking).

---

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: Authentication Service - Verify user identity for API calls

### Technology Platform Dependencies
- **PLT-001**: React 18+ - Function components with hooks
- **PLT-002**: Next.js 14+ - Dynamic pages and API routes
- **PLT-003**: TypeScript 5+ - Strict mode required
- **PLT-004**: Tailwind CSS 3.4+ - Utility classes
- **PLT-005**: Radix UI Primitives - Dialog component
- **PLT-006**: Lucide React Icons - ChevronLeft, ChevronRight, Edit, Trash icons

### Compliance Dependencies
- **COM-001**: WCAG 2.1 Level AA - 4.5:1 contrast ratio, keyboard navigation
- **COM-002**: GDPR Compliance - User data privacy and right to deletion

---

## 9. Examples & Edge Cases

### Filter Scrolling Example
```typescript
<div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
  {filters.map(f => (
    <button 
      key={f.id}
      className="flex-shrink-0 snap-center"
      onClick={() => handleToggle(f.id)}
    >
      {f.label}
    </button>
  ))}
</div>
```

### Dark Mode Example
```typescript
// Automatic via CSS variables
--color-bg: #ffffff;      // Light mode
--color-bg: #1f2937;      // Dark mode
```

### Card Delete Error Handling
```typescript
// Scenario: API returns conflict error
{
  "success": false,
  "error": "Cannot delete card with active benefits"
}
```

---

## 10. Validation Criteria

| Criterion | How to Validate | Pass Condition |
|-----------|-----------------|---|
| **VC-001** | Status filters reduced | Exactly 3 buttons displayed |
| **VC-002** | No line wrapping on mobile | Screenshot at 375px shows single row |
| **VC-003** | Keyboard navigation | Arrow keys scroll filters |
| **VC-004** | Dark mode colors | 4.5:1 contrast ratio met |
| **VC-005** | Cards display | All fields visible (name, last 4, type, network) |
| **VC-006** | Edit modal opens | Modal appears with pre-filled form |
| **VC-007** | Delete confirmation | Dialog shows with card name |
| **VC-008** | Card deletion works | Card removed from list |
| **VC-009** | Error handling | Error message with retry displayed |
| **VC-010** | Loading states | Skeleton/spinner shown appropriately |
| **VC-011** | API responses | Match exact schema |
| **VC-012** | Form validation | Errors shown for required fields |
| **VC-013** | Responsive grid | 1 col mobile, 2+ cols tablet/desktop |
| **VC-014** | Empty state | Message shown when no cards |
| **VC-015** | Toast notifications | Appear and auto-dismiss |

---

## 11. Related Specifications & Further Reading

- **[StatusFilters Component](/src/app/dashboard/new/components/StatusFilters.tsx)** - Reference implementation
- **[CardSwitcher Component](/src/shared/components/features/CardSwitcher.tsx)** - Scrolling pattern
- **[EditBenefitModal](/src/features/benefits/components/modals/EditBenefitModal.tsx)** - Modal pattern
- **[Design Tokens](/src/styles/design-tokens.css)** - Color and spacing tokens
- **[WCAG 2.1 Level AA](https://www.w3.org/WAI/WCAG21/quickref/)** - Accessibility standards
- **[Radix UI Dialog](https://www.radix-ui.com/docs/primitives/components/dialog)** - Modal docs
- **[Lucide React Icons](https://lucide.dev/)** - Icon reference

---

**Document Status**: ✅ READY FOR IMPLEMENTATION

**Version History**:
- **v1.0** (2024-11-28): Initial specification with all requirements, constraints, and acceptance criteria
