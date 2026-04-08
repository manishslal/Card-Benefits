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

#### Error Response: 400 Bad Request
```json
{
  "success": false,
  "error": "Card name must be 1-50 characters"
}
```

#### Error Response: 404 Not Found
```json
{
  "success": false,
  "error": "Card not found"
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
| **MSTest** (if .NET backend) | API contract testing | Verify responses match spec |

### 6.3 Test Data Management

#### Unit/Integration Tests
```typescript
// Mock card data
const mockCard: Card = {
  id: 'test-card-1',
  userId: 'user-1',
  name: 'Test Card',
  lastFourDigits: '4242',
  cardNetwork: 'Visa',
  cardType: 'Credit',
  isActive: true,
  createdAt: '2024-11-01T00:00:00Z',
};

// Mock API responses
jest.mock('fetch', () => ({
  __esModule: true,
  default: jest.fn(),
}));

mockFetch.mockResolvedValue({
  ok: true,
  json: async () => ({
    success: true,
    cards: [mockCard],
  }),
});
```

#### E2E Tests
- Use Playwright `page.goto('http://localhost:3000/settings')`
- Create test users via seed script before each test suite
- Use test database isolated from production
- Clean up test data after suite completion

### 6.4 Test Cases

#### Filter Refinement Tests

```typescript
// Unit: StatusFilters Component
describe('StatusFilters', () => {
  it('should render exactly 3 status options', () => {
    // Arrange: mount with 3 status options
    // Act: render
    // Assert: screen.getAllByRole('button').length === 3
  });

  it('should toggle status when clicked', () => {
    // Arrange: mount, status not selected
    // Act: click status button
    // Assert: onStatusChange called with updated array
  });

  it('should support keyboard navigation with arrow keys', () => {
    // Arrange: mount, focus on filter button
    // Act: press ArrowRight
    // Assert: scroll container scrolled right
  });

  it('should hide scrollbar using CSS class', () => {
    // Arrange: mount with overflow content
    // Act: render
    // Assert: className includes 'scrollbar-hide'
  });

  it('should match CardSwitcher scrolling behavior', () => {
    // Arrange: render both StatusFilters and CardSwitcher
    // Act: scroll each
    // Assert: scroll animations identical (smooth duration)
  });
});

// Accessibility: StatusFilters
describe('StatusFilters Accessibility', () => {
  it('should have sufficient color contrast (4.5:1)', async () => {
    // Arrange: render component
    // Act: run axe-core
    // Assert: no color contrast violations
  });

  it('should be keyboard navigable', async () => {
    // Arrange: render, focus on first button
    // Act: press Tab through all buttons
    // Assert: all buttons receive focus
  });

  it('should have proper ARIA attributes', () => {
    // Arrange: render
    // Assert: buttons have aria-pressed, aria-label attributes
  });
});

// E2E: Filter Workflow
describe('Dashboard Filters E2E', () => {
  it('should filter benefits when status changes', async () => {
    // Arrange: navigate to dashboard, 10 benefits visible
    // Act: click "Active" filter only
    // Assert: only active benefits displayed
  });

  it('should maintain filter state during period change', async () => {
    // Arrange: select "Used" status filter
    // Act: change period from Monthly to Quarterly
    // Assert: "Used" filter still selected
  });
});
```

#### My Cards Section Tests

```typescript
// Unit: CardItem Component
describe('CardItem', () => {
  it('should display card information correctly', () => {
    // Assert: name, last 4 digits, type, network all visible
  });

  it('should call onEdit when Edit button clicked', () => {
    // Arrange: mock onEdit callback
    // Act: click Edit
    // Assert: onEdit(card) called
  });

  it('should call onDelete when Delete button clicked', () => {
    // Arrange: mock onDelete callback
    // Act: click Delete
    // Assert: onDelete(card) called
  });

  it('should show loading state when isLoading prop true', () => {
    // Arrange: render with isLoading={true}
    // Assert: buttons disabled, spinner visible
  });
});

// Integration: CardEditModal
describe('CardEditModal', () => {
  it('should pre-fill form with card data when opened', () => {
    // Arrange: render with card prop, isOpen={true}
    // Assert: input values match card data
  });

  it('should validate required fields', async () => {
    // Arrange: modal open, name field
    // Act: clear name and click Save
    // Assert: validation error shown
  });

  it('should call API and close on success', async () => {
    // Arrange: modal open with valid data
    // Act: click Save
    // Assert: fetch called, modal closes on 200 response
  });

  it('should show error message on API failure', async () => {
    // Arrange: mock API to return error
    // Act: submit form
    // Assert: error message displayed
  });
});

// Integration: CardDeleteConfirmation
describe('CardDeleteConfirmation', () => {
  it('should show card name in confirmation text', () => {
    // Arrange: render with card "My Amex"
    // Assert: dialog text includes "My Amex"
  });

  it('should delete card when confirmed', async () => {
    // Arrange: dialog open
    // Act: click Delete button
    // Assert: DELETE API called with correct id
  });

  it('should show loading state during deletion', async () => {
    // Arrange: click Delete, mock slow API
    // Assert: button shows loading spinner
  });
});

// E2E: My Cards Workflow
describe('My Cards Section E2E', () => {
  it('should display all user cards on load', async () => {
    // Arrange: user has 3 cards
    // Act: navigate to settings
    // Assert: 3 cards visible in My Cards section
  });

  it('should edit card successfully', async () => {
    // Arrange: on settings page
    // Act: click Edit on first card
    // Assert: modal opens
    // Act: change name and click Save
    // Assert: API called, card name updated in list
  });

  it('should delete card successfully', async () => {
    // Arrange: on settings page, 3 cards visible
    // Act: click Delete on second card
    // Assert: confirmation dialog shown
    // Act: click Delete in confirmation
    // Assert: card removed from list, success message shown
  });

  it('should show empty state when no cards', async () => {
    // Arrange: user has no cards
    // Act: navigate to settings
    // Assert: empty state message displayed
  });
});
```

### 6.5 CI/CD Integration

#### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      # Unit tests
      - run: npm run test:unit -- --coverage
        env:
          COVERAGE_THRESHOLD: 80
      
      # E2E tests
      - run: npm run test:e2e
      
      # Accessibility tests
      - run: npm run test:a11y
      
      # Upload coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### 6.6 Coverage Requirements

| Category | Minimum Coverage |
|----------|-----------------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |
| Critical Paths | 100% (filters, API calls, delete) |

### 6.7 Performance Testing

```typescript
// Measure filter scroll performance
performance.mark('scroll-start');
container.scrollBy({ left: 300, behavior: 'smooth' });
performance.mark('scroll-end');
performance.measure('filter-scroll', 'scroll-start', 'scroll-end');
// Assert: < 60ms for smooth 60fps
```

---

## 7. Rationale & Context

### 7.1 Filter Reduction to 3 Options

**Rationale**: The original 5 status options (Active, Expiring Soon, Used, Expired, Pending) created cognitive load and UI clutter, particularly on mobile devices. Research shows users most commonly care about:
- **Active**: Benefits they can currently use
- **Expiring**: Time-sensitive benefits requiring attention
- **Used**: Historical record of claimed benefits

**Rationale for removal**:
- **Expired**: Rarely relevant after expiration date passes; data can be archived
- **Pending**: Represents edge case (benefits not yet approved); can be handled via modal details

**Business Impact**: 
- Reduces filter noise by 40%
- Improves mobile UX (fewer wrapped filter lines)
- Maintains core functionality (filters show most-used statuses)

### 7.2 Horizontal Scrolling for Filters

**Rationale**: Fixed-height single-row scrollable container prevents layout shifting and provides consistent visual pattern across dashboard (matches CardSwitcher tabs).

**Alternative Considered**: Multi-row wrapping with flex-wrap
- ❌ Causes layout instability
- ❌ Less predictable on different screen sizes
- ❌ Breaks accessibility focus flow

**Selected Approach**: Single-row scroll with snap points
- ✅ Consistent interaction pattern (users expect scroll behavior)
- ✅ Predictable layout across all devices
- ✅ Improved keyboard navigation
- ✅ Better visual hierarchy

### 7.3 My Cards in Settings (Not Dashboard)

**Rationale**: Card management is account/profile-scoped, not benefit-scoped. Placing in Settings > Profile tab:
- Aligns with mental model (account settings vs. benefit tracking)
- Reduces dashboard complexity
- Provides dedicated space for card admin features
- Follows common app patterns (e.g., payment settings in account section)

### 7.4 Reduced Status Set Performance Impact

**Data Model**: Backend will maintain all 5 statuses in database but frontend filters only show 3.

**Filtering Logic**:
```javascript
// Dashboard benefits filter
benefits.filter(b => {
  // Map backend status to user-visible status
  const displayStatus = {
    'active': 'active',
    'expiring_soon': 'expiring',
    'used': 'used',
    'expired': null,  // hidden
    'pending': null,  // hidden
  }[b.status];
  
  return displayStatus && selectedStatuses.includes(displayStatus);
});
```

### 7.5 Modal Reuse for Card Editing

**Rationale**: CardEditModal mirrors EditBenefitModal structure for:
- Consistency in UX patterns
- Reduced learning curve (users see familiar interface)
- Easier maintenance (similar code patterns)
- Accessibility compliance (uses same Radix patterns)

### 7.6 API Design Decisions

**Single Card Edit Endpoint** (`PATCH /api/cards/[id]`):
- ✅ Follows REST conventions
- ✅ Supports partial updates (only changed fields)
- ✅ Atomic operation (all or nothing)

**Separate Delete Endpoint** (`DELETE /api/cards/[id]`):
- ✅ Follows HTTP semantics
- ✅ Clear intent
- ✅ Easier to log/audit (separate endpoint = separate log entries)

---

## 8. Dependencies & External Integrations

### External Systems

**EXT-001**: Authentication Service
- **Type**: Session-based or token-based (bearer token)
- **Purpose**: Verify user identity for API calls
- **Integration**: Already implemented; API calls include credentials

**EXT-002**: User Service
- **Type**: REST API endpoint `/api/user/profile`
- **Purpose**: Load user profile data (firstName, lastName, email)
- **Integration**: Existing; called on dashboard/settings load

### Third-Party Services

**SVC-001**: Card Issuer Data (Future)
- **Service**: Optional integration with card networks API
- **Purpose**: Validate card type/network during creation
- **SLA**: Not critical for MVP
- **Note**: Currently card type/network are user-selected dropdowns

### Infrastructure Dependencies

**INF-001**: Database with Card Table
- **Type**: Relational database (PostgreSQL, MySQL, etc.)
- **Schema**: Requires `cards` table with fields: id, userId, name, lastFourDigits, cardNetwork, cardType, isActive, createdAt
- **Indexing**: Index on (userId, id) for fast user card lookups
- **Constraint**: Foreign key on userId → users table

**INF-002**: API Server with Express/Next.js Router
- **Type**: Web server handling REST endpoints
- **Endpoints**: GET/PATCH/DELETE `/api/cards/*`
- **Response Format**: JSON with error handling

**INF-003**: CSS Custom Properties System
- **Type**: CSS variables defined globally
- **Location**: `src/styles/design-tokens.css`
- **Required Variables**: `--color-primary`, `--color-bg`, `--color-text`, `--color-border`, etc.
- **Dark Mode**: Automatically updated by theme provider

### Data Dependencies

**DAT-001**: User Authentication State
- **Source**: Session cookie or bearer token (from auth middleware)
- **Format**: User ID included in request context
- **Frequency**: Per-request validation
- **Access**: Automatically included by fetch/axios interceptors

**DAT-002**: User's Card List
- **Source**: Database query filtered by userId
- **Format**: Array of Card objects
- **Frequency**: On-demand (when settings page loads or after add/edit/delete)
- **Cache**: Optional client-side cache with 5-minute TTL

### Technology Platform Dependencies

**PLT-001**: React 18+
- **Requirement**: Function components with hooks
- **Usage**: useState, useEffect, useCallback, useRef
- **Rationale**: Required for component implementation

**PLT-002**: Next.js 14+ with App Router
- **Requirement**: Dynamic page export, API routes
- **Usage**: Route handlers for `/api/cards/*` endpoints
- **Rationale**: App framework and routing

**PLT-003**: TypeScript 5+
- **Requirement**: Strict mode (`"strict": true`)
- **Usage**: Type all component props and API responses
- **Rationale**: Type safety and IDE support

**PLT-004**: Tailwind CSS 3.4+
- **Requirement**: Utility classes for styling
- **Usage**: `flex`, `overflow-x-auto`, `gap-3`, etc.
- **Rationale**: Rapid styling with design tokens integration

**PLT-005**: Radix UI Primitives (Dialog)
- **Requirement**: `@radix-ui/react-dialog` package
- **Usage**: Modal and confirmation dialog components
- **Rationale**: Accessible primitives with keyboard/focus management

**PLT-006**: Lucide React Icons
- **Requirement**: Icon library (lucide-react package)
- **Usage**: ChevronLeft, ChevronRight, Edit, Trash, CreditCard icons
- **Rationale**: Consistent icon set across app

**PLT-007**: HTTP Client
- **Requirement**: Fetch API or Axios
- **Usage**: API calls to `/api/cards/*` endpoints
- **Rationale**: Essential for data communication

### Compliance Dependencies

**COM-001**: WCAG 2.1 Level AA Accessibility Standard
- **Requirement**: 4.5:1 contrast ratio for text, keyboard navigation, screen reader support
- **Impact**: All components must have aria-labels, focus management, semantic HTML
- **Validation**: axe-core testing in CI/CD

**COM-002**: GDPR Compliance (if EU users)
- **Requirement**: User data privacy and right to deletion
- **Impact**: User must be able to delete cards; no unnecessary data retention
- **Validation**: Privacy policy updated with card management details

---

## 9. Examples & Edge Cases

### 9.1 Filter Scrolling Example

```typescript
// Scenario: User on mobile (375px) viewport with many filters
// Expected: Filters scroll smoothly with keyboard and mouse

// Implementation:
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

// Keyboard handling:
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowRight') {
    containerRef.current?.scrollBy({ left: 100, behavior: 'smooth' });
  } else if (e.key === 'ArrowLeft') {
    containerRef.current?.scrollBy({ left: -100, behavior: 'smooth' });
  }
};
```

### 9.2 Card Edit Modal - Dark Mode Example

```typescript
// Light mode (default)
--color-bg: #ffffff;
--color-text: #111827;
--color-border: #e5e7eb;

// Dark mode (@media (prefers-color-scheme: dark))
--color-bg: #1f2937;
--color-text: #f9fafb;
--color-border: #374151;

// Component uses tokens automatically:
<DialogPrimitive.Content
  className="rounded-lg border"
  style={{ 
    backgroundColor: 'var(--color-bg)',      // Adapts to theme
    borderColor: 'var(--color-border)',      // Adapts to theme
    color: 'var(--color-text)'                // Adapts to theme
  }}
/>
```

### 9.3 Card Delete - Error Handling

```typescript
// Scenario: User tries to delete card that still has active benefits

// API Response:
{
  "success": false,
  "error": "Cannot delete card with active benefits. Please deactivate benefits first."
}

// Frontend handling:
catch (error) {
  if (error.status === 409) { // Conflict
    showError(error.message); // User sees actionable message
  } else if (error.status === 404) {
    showError('Card not found - it may have been deleted');
  } else {
    showError('An unexpected error occurred');
  }
}
```

### 9.4 Edge Case: Empty Card Name

```typescript
// Client-side validation:
if (!formData.name.trim()) {
  setErrors({ name: 'Card name is required' });
  return; // Prevent submission
}

// Server-side validation:
if (!req.body.name || req.body.name.trim().length === 0) {
  return res.status(400).json({
    success: false,
    error: 'Card name is required'
  });
}

// Result: Consistent validation across stack
```

### 9.5 Concurrent Filter Changes

```typescript
// Scenario: User changes both status filter AND period simultaneously

// React batching handles automatically:
setSelectedStatuses([...newStatuses]);    // Batched
setSelectedPeriod(newPeriod);             // Batched
// → Single re-render instead of two

// Filtering logic:
filteredBenefits = benefits
  .filter(b => selectedStatuses.includes(getDisplayStatus(b.status)))
  .filter(b => isWithinPeriod(b.expirationDate, selectedPeriod));
```

### 9.6 Loading State During Card Deletion

```typescript
// User Experience:
// 1. User clicks Delete
// 2. Confirmation dialog appears
// 3. User clicks "Delete" in confirmation
// 4. Button becomes disabled with spinner: "Deleting..."
// 5. After 500ms-2s: Success toast appears, dialog closes
// 6. Card list refreshed, card removed
// 7. Toast auto-dismisses after 5s

// Code:
const [isDeleting, setIsDeleting] = useState(false);

const handleDelete = async () => {
  setIsDeleting(true);
  try {
    const response = await fetch(`/api/cards/${card.id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      showSuccessToast('Card deleted');
      refreshCardList();
      onClose();
    }
  } finally {
    setIsDeleting(false);
  }
};

// Button:
<button disabled={isDeleting}>
  {isDeleting ? <Spinner /> : null}
  {isDeleting ? 'Deleting...' : 'Delete'}
</button>
```

### 9.7 Form Validation - Multiple Errors

```typescript
// User leaves multiple fields invalid:
const validateForm = () => {
  const newErrors: Record<string, string> = {};
  
  if (!formData.name.trim()) {
    newErrors.name = 'Card name is required';
  } else if (formData.name.length > 50) {
    newErrors.name = 'Card name must be 50 characters or less';
  }
  
  if (!formData.cardType) {
    newErrors.cardType = 'Please select a card type';
  }
  
  if (!formData.cardNetwork) {
    newErrors.cardNetwork = 'Please select a card network';
  }
  
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

// UI displays:
// [X] Card name is required
// [X] Please select a card type
// [X] Please select a card network
```

### 9.8 Network Error with Retry

```typescript
// API call fails due to network timeout:
const fetchUserCards = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch('/api/cards/user-cards', {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error('API error');
    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      showError('Request timed out. Please check your connection.');
    } else {
      showError('Failed to load cards. Please try again.');
    }
    // Show retry button
  }
};
```

---

## 10. Validation Criteria

| Criterion | How to Validate | Pass Condition |
|-----------|-----------------|---|
| **VC-001**: Status filters reduced to 3 | Count visible filter buttons | Exactly 3 buttons displayed |
| **VC-002**: No line wrapping on mobile | Screenshot at 375px | Single row, horizontal scroll present |
| **VC-003**: Keyboard navigation works | Tab through and arrow key test | Focus moves smoothly, scroll works |
| **VC-004**: Dark mode colors correct | Enable dark mode, check contrast | 4.5:1 contrast ratio met |
| **VC-005**: Cards display correctly | Load settings page | All card fields visible (name, last 4, type, network) |
| **VC-006**: Edit modal opens | Click Edit button | Modal appears with pre-filled form |
| **VC-007**: Delete confirmation shows | Click Delete button | Confirmation dialog appears with card name |
| **VC-008**: Card deletion works | Confirm deletion | Card removed from list, API called |
| **VC-009**: Error handling | Trigger network error | Error message displayed with retry option |
| **VC-010**: Loading states visible | Monitor during async operations | Skeleton/spinner shown for appropriate duration |
| **VC-011**: API responses match spec | Check network tab | Responses match exact schema (fields, types) |
| **VC-012**: Form validation works | Submit empty form | Validation errors displayed for required fields |
| **VC-013**: Responsive grid works | Resize viewport | 1 col mobile, 2+ cols tablet/desktop |
| **VC-014**: Empty state displays | Create test user with no cards | Empty state message shown |
| **VC-015**: Toast notifications | Complete action | Toast appears and auto-dismisses |

---

## 11. Related Specifications & Further Reading

- **[Existing Dashboard Filter Implementation](/src/app/dashboard/new/components/StatusFilters.tsx)** - Reference component structure
- **[CardSwitcher Component](/src/shared/components/features/CardSwitcher.tsx)** - Scrolling behavior template
- **[EditBenefitModal](/src/features/benefits/components/modals/EditBenefitModal.tsx)** - Modal pattern reference
- **[Design Tokens Documentation](/src/styles/design-tokens.css)** - Color and spacing tokens
- **[WCAG 2.1 Level AA Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)** - Accessibility standards
- **[Radix UI Dialog Documentation](https://www.radix-ui.com/docs/primitives/components/dialog)** - Modal component docs
- **[Lucide React Icons](https://lucide.dev/)** - Icon reference
- **[Tailwind CSS Documentation](https://tailwindcss.com/docs)** - Utility classes
- **[React Accessibility Patterns](https://react.dev/reference/react-dom/components#form-components)** - Form accessibility

---

**Document Status**: ✅ READY FOR IMPLEMENTATION

**Version History**:
- **v1.0** (2024-11-28): Initial specification with all requirements, constraints, and acceptance criteria
