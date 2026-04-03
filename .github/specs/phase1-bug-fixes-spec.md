# Card Benefits Tracker - Phase 1: MVP Bug Fixes
## Technical Specification

**Version:** 1.0  
**Date:** April 2024  
**Status:** Active  
**Priority:** Critical (5 blocking MVP issues)

---

## Executive Summary & Goals

The Card Benefits Tracker has **5 critical MVP bugs** preventing core functionality from working. This specification addresses the root causes and provides implementation details for each bug fix. These bugs span authentication, theming, routing, and card/benefit management features.

**Primary Objectives:**
- ✓ Fix user profile data (firstName/lastName) persistence to database
- ✓ Resolve Chrome extension message channel error in settings page
- ✓ Implement global dark/light mode theming across all UI components
- ✓ Fix navigation redirects to proper dashboard routes
- ✓ Enable users to add new cards and benefits to their wallet

**Success Criteria:**
- All user data submitted during signup is saved to the database and retrievable
- No console errors when loading settings page
- Dark mode toggle affects all UI elements (header, background, cards, icons)
- Logged-in users see /dashboard, not /; all navigation links redirect correctly
- Add card and add benefit buttons are fully functional with proper API backing

---

## Functional Requirements

### Bug #1: User Profile Data Not Saved
- Users submit firstName and lastName during signup
- These values must persist to the User database table
- Settings page must display actual user data (not placeholder "John Doe")
- User data must be updateable from settings page

### Bug #2: Chrome Extension Console Error
- Settings page causes "listener indicated asynchronous response" error
- This suggests improper promise handling or chrome.runtime API calls
- Error must be resolved without losing functionality
- No console errors allowed on production pages

### Bug #3: Dark/Light Mode Not Global
- Dark mode toggle exists but only affects form inputs
- All UI elements must respond to theme toggle (headers, backgrounds, cards, icons)
- Theme preference must persist across sessions
- Theme must work correctly on all pages (auth, dashboard, settings)

### Bug #4: Incorrect Navigation
- Navigation links should redirect to /dashboard (not /)
- Logged-in users accessing / should redirect to /dashboard
- Back button, logo, and dashboard links must use correct routes
- Navigation context must be aware of authentication status

### Bug #5: Add Card / Add Benefits Not Functional
- Add card button must open working modal/form
- Add benefits button must enable adding benefits to existing cards
- Must validate card selection from master catalog
- Must create proper database relationships
- Must handle edge cases (duplicate cards, invalid selections)

---

## Implementation Phases

### Phase 1A: Profile Data Persistence (Est. 2-4 hours)
**Objectives:**
- Save firstName and lastName from signup form to database
- Create API endpoint to retrieve user profile
- Update settings page to fetch and display user data
- Implement profile update functionality

**Key Deliverables:**
- Modified signup form to capture name as separate fields
- API endpoint: `GET /api/protected/user/profile` 
- API endpoint: `PATCH /api/protected/user/profile`
- Settings page refactored to load and update user data

**Dependencies:** None (standalone fix)

---

### Phase 1B: Chrome Extension Message Error (Est. 1-2 hours)
**Objectives:**
- Identify source of chrome.runtime message channel error
- Eliminate improper promise handling or message listeners
- Verify settings page loads without errors

**Key Deliverables:**
- Removed/fixed chrome message listeners
- Console error verification test
- Error boundary implementation if needed

**Dependencies:** None (standalone fix)

---

### Phase 1C: Global Dark/Light Mode (Est. 3-5 hours)
**Objectives:**
- Extend ThemeProvider to apply CSS variables globally
- Update all component styles to use CSS variables
- Test theme toggle on all pages and components

**Key Deliverables:**
- Enhanced ThemeProvider with global CSS variable application
- CSS refactor: use `var(--color-*)` in all components
- CSS variable definitions for light/dark modes
- Updated component styling tests

**Dependencies:** None (standalone fix)

---

### Phase 1D: Navigation Routing (Est. 2-3 hours)
**Objectives:**
- Update middleware to redirect logged-in users from / to /dashboard
- Fix navigation links to use /dashboard route
- Update logo and back button links

**Key Deliverables:**
- Middleware modification for auth-aware redirects
- Updated Header/Navigation component links
- Updated breadcrumb and back button logic
- Routing validation tests

**Dependencies:** None (standalone fix)

---

### Phase 1E: Add Card & Add Benefits (Est. 5-8 hours)
**Objectives:**
- Implement AddCardModal UI with card selection
- Create API endpoint for adding cards to wallet
- Implement AddBenefitModal for existing cards
- Create API endpoint for adding benefits
- Handle card/benefit validation and constraints

**Key Deliverables:**
- AddCardModal component with working form
- `POST /api/protected/cards` endpoint
- AddBenefitModal component
- `POST /api/protected/benefits` endpoint
- Form validation and error handling
- Integration tests

**Dependencies:** Requires working card selection UI

---

## Data Schema / State Management

### Bug #1: Profile Data - Database Changes

**Current Schema (User model):**
```prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  passwordHash      String
  firstName         String?  // Currently populated but may not be saved
  lastName          String?  // Currently populated but may not be saved
  // ... rest of model
}
```

**Required Changes:** ✓ Schema already supports firstName/lastName (optional fields)

**Issue:** The signup route receives firstName/lastName but stores them incorrectly.

**Root Cause Analysis:**
1. Signup form uses single "name" field instead of separate firstName/lastName
2. API receives firstName/lastName in request but form sends "name"
3. createUser() function may not properly handle the field mapping

**Fix Required:**
```typescript
// In signup form component:
const [formData, setFormData] = useState({
  firstName: '',    // Changed from: name
  lastName: '',     // Added
  email: '',
  password: '',
  confirmPassword: '',
});

// In API handler (route.ts), ensure createUser receives both:
const user = await createUser(email, passwordHash, firstName, lastName);
```

**Sample Data Structure:**
```json
{
  "user": {
    "id": "cuid123",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false,
    "createdAt": "2024-04-01T10:00:00Z"
  }
}
```

---

### Bug #3: Dark Mode - CSS Variable Structure

**Required CSS Variables (Light Mode - Default):**
```css
:root {
  /* Background Colors */
  --color-bg: #ffffff;                    /* Main background */
  --color-bg-secondary: #f5f5f5;          /* Secondary backgrounds (cards, panels) */
  --color-bg-tertiary: #ebebeb;           /* Tertiary backgrounds */
  
  /* Text Colors */
  --color-text: #1a1a1a;                  /* Primary text */
  --color-text-secondary: #666666;        /* Secondary text (muted) */
  --color-text-tertiary: #999999;         /* Tertiary text (very muted) */
  
  /* Border Colors */
  --color-border: #d9d9d9;                /* Component borders */
  --color-border-light: #e8e8e8;          /* Light borders */
  
  /* Primary/Accent Colors */
  --color-primary: #2563eb;               /* Primary CTA button, links */
  --color-primary-hover: #1d4ed8;         /* Primary hover state */
  --color-primary-light: #dbeafe;         /* Primary light (backgrounds) */
  
  /* Semantic Colors */
  --color-success: #10b981;               /* Success states */
  --color-warning: #f59e0b;               /* Warning states */
  --color-error: #ef4444;                 /* Error states */
  
  /* Component-Specific */
  --color-input-bg: #ffffff;              /* Input field background */
  --color-input-border: #cccccc;          /* Input field border */
  --color-input-text: #1a1a1a;            /* Input text color */
  --color-shadow: rgba(0, 0, 0, 0.1);    /* Shadow color */
}

[data-theme="dark"],
html[style*="color-scheme: dark"] {
  --color-bg: #0f172a;                    /* Dark background */
  --color-bg-secondary: #1e293b;          /* Dark secondary */
  --color-bg-tertiary: #334155;           /* Dark tertiary */
  
  --color-text: #f0f0f0;                  /* Light text */
  --color-text-secondary: #999999;        /* Muted light text */
  --color-text-tertiary: #666666;         /* Very muted light text */
  
  --color-border: #3a3a3a;                /* Dark borders */
  --color-border-light: #2a2a2a;          /* Light dark borders */
  
  --color-primary: #3b82f6;               /* Lighter blue in dark */
  --color-primary-hover: #2563eb;         /* Primary hover */
  --color-primary-light: #1e3a8a;         /* Dark primary light */
  
  --color-success: #059669;               /* Dark success */
  --color-warning: #d97706;               /* Dark warning */
  --color-error: #dc2626;                 /* Dark error */
  
  --color-input-bg: #1e293b;              /* Dark input */
  --color-input-border: #475569;          /* Dark input border */
  --color-input-text: #f0f0f0;            /* Light input text */
  --color-shadow: rgba(0, 0, 0, 0.3);    /* Darker shadow */
}
```

**Component Style Requirements:**
- All components must use `color: var(--color-text)` instead of hardcoded colors
- Headers must use `background: var(--color-bg-secondary); border-color: var(--color-border)`
- Cards must use `background: var(--color-bg-secondary); border-color: var(--color-border)`
- Inputs must use `background: var(--color-input-bg); color: var(--color-input-text); border-color: var(--color-input-border)`
- Icons must inherit text color: `fill: currentColor` or `stroke: var(--color-text)`

---

### Bug #4: Navigation - Route Architecture

**Route Structure (Protected by Middleware):**
```
Middleware Auth Check
├── PUBLIC_ROUTES (no auth required)
│   ├── /              → Must redirect to /dashboard if authenticated
│   ├── /login
│   ├── /signup
│   └── /forgot-password
├── PROTECTED_ROUTES (auth required)
│   ├── /dashboard
│   ├── /dashboard/card/[id]
│   ├── /settings
│   ├── /account
│   └── /wallet
└── API Routes
    ├── /api/auth/*    (public: signup, login, logout)
    └── /api/protected/* (protected: user data, cards, benefits)
```

**Current Issue:** Middleware doesn't redirect authenticated users from / to /dashboard

**Required Middleware Fix:**
```typescript
// In middleware.ts, PUBLIC_ROUTES section:
if (isPublic && pathname === '/') {
  // Special case: If user is authenticated, redirect to dashboard
  if (userId) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    return response;
  }
  // Otherwise proceed to login/landing page
  return NextResponse.next();
}
```

---

### Bug #5: Add Card & Add Benefits - Data Flow

**Add Card Flow:**
```
User clicks "Add Card" button
  ↓
AddCardModal opens
  ↓
Form: Select MasterCard from dropdown
  ↓
Optional: Customize card name, set renewal date, override annual fee
  ↓
Form validation (required fields)
  ↓
Submit POST /api/protected/cards
  ↓
API validates:
  - Card not already in user's wallet
  - Card exists in MasterCard catalog
  - User owns the player
  ↓
Database: Create UserCard record
  ↓
Return success with new card data
  ↓
UI: Close modal, update card list, show success message
```

**Add Benefit Flow:**
```
User clicks "Add Benefit" on existing card
  ↓
AddBenefitModal opens
  ↓
Form: Select MasterBenefit from card's available benefits
  ↓
Optional: Set custom value, set expiration date
  ↓
Form validation (required fields)
  ↓
Submit POST /api/protected/benefits
  ↓
API validates:
  - Benefit not already claimed
  - Card exists and user owns it
  - Benefit exists in MasterBenefit catalog
  ↓
Database: Create UserBenefit record
  ↓
Return success with new benefit data
  ↓
UI: Close modal, update benefits list, recalculate ROI
```

**Database Records Created:**

For Add Card:
```prisma
UserCard {
  id: string              # Generated CUID
  playerId: string        # From authenticated context
  masterCardId: string    # Selected from form
  customName?: string     # Optional user rename
  actualAnnualFee?: int   # Optional override (null = use default)
  renewalDate: DateTime   # Required
  status: "ACTIVE"
  createdAt: DateTime
}
```

For Add Benefit:
```prisma
UserBenefit {
  id: string              # Generated CUID
  userCardId: string      # From parent card
  playerId: string        # From authenticated context
  name: string            # From MasterBenefit
  type: string            # From MasterBenefit
  stickerValue: int       # From MasterBenefit (in cents)
  resetCadence: string    # From MasterBenefit
  customValue?: int       # Optional override
  expirationDate?: DateTime # Optional
  isUsed: false           # Default unclaimed
  createdAt: DateTime
}
```

---

## User Flows & Workflows

### Flow 1: Signup with Profile Data Persistence

```
START: User visits /signup
  ↓
FORM DISPLAY
  Input fields: First Name, Last Name, Email, Password, Confirm Password
  ↓
USER INPUT
  John Doe | john@example.com | SecurePass123! | SecurePass123!
  ↓
FORM VALIDATION (Client-side)
  ✓ First Name not empty (1-50 chars)
  ✓ Last Name not empty (1-50 chars)
  ✓ Email valid format
  ✓ Password ≥ 8 chars, uppercase, lowercase, number, special char
  ✓ Passwords match
  ↓
SUBMISSION
  POST /api/auth/signup
  {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "SecurePass123!"
  }
  ↓
SERVER VALIDATION
  ✓ Email not already registered
  ✓ Password strength passed
  ↓
DATABASE OPERATION
  1. Hash password with Argon2id
  2. Create User record:
     {
       id: "cuid123",
       email: "john@example.com",
       passwordHash: "argon2id$...",
       firstName: "John",
       lastName: "Doe"
     }
  3. Create default Player record
  4. Create Session record
  5. Sign JWT token
  ↓
RESPONSE
  ✓ 201 Created
  ✓ Set session cookie
  ↓
REDIRECT
  → /dashboard
  ↓
END: User authenticated, profile data saved
```

**Happy Path:**
- All validation passes
- User created successfully
- Session established
- Redirected to dashboard

**Error Paths:**
- Email already registered → 409 Conflict, show error message
- Password too weak → 400 Bad Request, show requirements
- Server error → 500 Internal Error, show generic message
- Network error → Retry dialog or fallback message

---

### Flow 2: Settings Page - Update Profile

```
START: Authenticated user clicks Settings
  ↓
MIDDLEWARE CHECK
  ✓ JWT valid in cookie
  ✓ Session exists in database
  ✓ User not deleted
  ↓
PAGE LOAD
  GET /api/protected/user/profile
  ↓
DATABASE QUERY
  SELECT id, email, firstName, lastName FROM User WHERE id = $userId
  ↓
DISPLAY
  Name field: "John Doe"
  Email field: "john@example.com" (read-only)
  ↓
USER EDITS
  Changes name to "Johnny Doe"
  Clicks "Save Changes"
  ↓
VALIDATION
  ✓ First Name (1-50 chars)
  ✓ Last Name (1-50 chars)
  ↓
SUBMISSION
  PATCH /api/protected/user/profile
  {
    firstName: "Johnny",
    lastName: "Doe"
  }
  ↓
DATABASE UPDATE
  UPDATE User
  SET firstName = "Johnny", lastName = "Doe"
  WHERE id = $userId
  ↓
RESPONSE
  ✓ 200 OK
  ✓ Updated user data returned
  ↓
UI UPDATE
  Show "✓ Profile updated successfully"
  Update display with new values
  ↓
END: Changes saved
```

**Happy Path:**
- User data loads correctly
- Changes validate
- Database updates
- Success message shown

**Error Paths:**
- User not found → 404, redirect to login
- Invalid input → 400, show field errors
- Server error → 500, show generic message
- Concurrent update → 409, show refresh message

---

### Flow 3: Add Card to Wallet

```
START: User on Dashboard
  ↓
USER CLICKS "Add Card" button
  ↓
AddCardModal opens
  ↓
FORM DISPLAY
  Dropdown: Select credit card
    - Chase Sapphire Reserve
    - American Express Platinum
    - Discover It
    - [other MasterCard entries]
  Input: Card Renewal Date (optional)
  Input: Annual Fee Override (optional)
  ↓
USER SELECTS
  Selects "Chase Sapphire Reserve"
  Sets renewal date: 2024-12-15
  Leaves annual fee as default ($550)
  ↓
FORM VALIDATION
  ✓ Card selected (required)
  ✓ Renewal date valid (future date)
  ✓ Annual fee valid (≥ 0)
  ↓
CHECK CONSTRAINT
  Verify card not already in wallet
  ✓ No existing UserCard for this player + masterCard
  ↓
SUBMISSION
  POST /api/protected/cards
  {
    masterCardId: "mastercard123",
    customName: null,
    actualAnnualFee: null,
    renewalDate: "2024-12-15T00:00:00Z"
  }
  ↓
SERVER VALIDATION & AUTHORIZATION
  ✓ User authenticated
  ✓ Player exists and user owns it
  ✓ MasterCard exists
  ✓ No duplicate UserCard for this player
  ↓
DATABASE OPERATION
  INSERT INTO UserCard (playerId, masterCardId, renewalDate, status)
  VALUES ($playerId, $masterCardId, $renewalDate, 'ACTIVE')
  ↓
RESPONSE
  ✓ 201 Created
  {
    id: "usercard456",
    masterCardId: "mastercard123",
    customName: null,
    actualAnnualFee: null,
    renewalDate: "2024-12-15T00:00:00Z",
    status: "ACTIVE",
    createdAt: "2024-04-01T15:30:00Z"
  }
  ↓
UI UPDATE
  ✓ Close modal
  ✓ Add card to visible card list
  ✓ Show "✓ Card added successfully"
  ✓ Update wallet stats (card count, total annual fee)
  ↓
END: Card visible in dashboard
```

**Happy Path:**
- Card selected from available options
- Validation passes
- Card added to database
- UI updates without refresh

**Error Paths:**
- Card already in wallet → 409 Conflict
  ```
  {
    success: false,
    error: "This card is already in your wallet",
    code: "CONFLICT_DUPLICATE"
  }
  ```
- Invalid card selection → 400 Bad Request
- User not owner of player → 403 Forbidden
- Card not in catalog → 404 Not Found

**Edge Cases to Handle:**
1. **Duplicate Card Check:**
   - Query UserCard table: `WHERE playerId = $id AND masterCardId = $cardId`
   - If exists, return 409 Conflict
   - Use unique constraint: `@@unique([playerId, masterCardId])`

2. **Concurrent Adds:**
   - Same card added by multiple requests simultaneously
   - Database constraint prevents duplicates
   - Return 409 with appropriate message

3. **Deleted MasterCard:**
   - User selects card that was deleted from catalog
   - Foreign key constraint prevents orphaned records
   - Show "Card no longer available" error

4. **Invalid Renewal Date:**
   - User enters past date
   - Validation rejects: `renewalDate must be in future`
   - Show field-level error

---

### Flow 4: Add Benefit to Card

```
START: User on Card Details page
  ↓
USER CLICKS "Add Benefit" button
  ↓
AddBenefitModal opens
  ↓
LOAD AVAILABLE BENEFITS
  GET /api/protected/cards/{cardId}/available-benefits
  ↓
SERVER FETCHES
  SELECT mb.* FROM MasterBenefit mb
  JOIN MasterCard mc ON mb.masterCardId = mc.id
  WHERE mc.id = $masterCardId
  AND mb.isActive = true
  AND NOT EXISTS (
    SELECT 1 FROM UserBenefit ub
    WHERE ub.userCardId = $userCardId
    AND ub.masterBenefitId = mb.id
  )
  ↓
FORM DISPLAY
  Dropdown: Select benefit (filtered for this card)
    - Travel Credit ($300)
    - Dining Rebate (50k points)
    - Annual Fee Credit
    - [other available benefits]
  Input: Custom Value (optional override)
  Input: Expiration Date (optional)
  ↓
USER SELECTS
  Selects "Travel Credit ($300)"
  Leaves custom value empty
  Sets expiration date: 2025-04-01
  ↓
FORM VALIDATION
  ✓ Benefit selected (required)
  ✓ Custom value valid (if provided)
  ✓ Expiration date valid (if provided)
  ↓
SUBMISSION
  POST /api/protected/benefits
  {
    userCardId: "usercard456",
    masterBenefitId: "masterbenefit789",
    customValue: null,
    expirationDate: "2025-04-01T00:00:00Z"
  }
  ↓
SERVER VALIDATION & AUTHORIZATION
  ✓ User authenticated
  ✓ Card exists and user owns it
  ✓ MasterBenefit exists and matches card
  ✓ Benefit not already claimed on this card
  ↓
DATABASE OPERATION
  INSERT INTO UserBenefit
  (userCardId, playerId, name, type, stickerValue, resetCadence, expirationDate, isUsed)
  VALUES ($userCardId, $playerId, $name, $type, $value, $cadence, $date, false)
  ↓
RESPONSE
  ✓ 201 Created
  {
    id: "userbenefit999",
    userCardId: "usercard456",
    name: "Travel Credit",
    type: "StatementCredit",
    stickerValue: 30000,
    customValue: null,
    expirationDate: "2025-04-01T00:00:00Z",
    isUsed: false,
    createdAt: "2024-04-01T16:00:00Z"
  }
  ↓
UI UPDATE
  ✓ Close modal
  ✓ Add benefit to benefits table
  ✓ Recalculate card ROI
  ✓ Update wallet stats
  ✓ Show "✓ Benefit added successfully"
  ↓
END: Benefit visible on card details
```

**Happy Path:**
- Available benefits loaded correctly
- Benefit selected
- Validation passes
- Benefit added to database
- Card ROI recalculated

**Error Paths:**
- Benefit already claimed → 409 Conflict
- Invalid card ownership → 403 Forbidden
- Benefit not in catalog → 404 Not Found
- Expired benefit selection → 400 Bad Request

**Edge Cases to Handle:**
1. **Duplicate Benefit on Card:**
   - User tries to add same benefit twice
   - Query existing UserBenefits for card
   - Return 409 if duplicate found

2. **Benefit Expiration:**
   - User selects past expiration date
   - Validation rejects
   - Show "Expiration date must be in future"

3. **Custom Value Validation:**
   - User enters negative or extremely high value
   - Validate: `customValue >= 0 AND customValue <= stickerValue * 10`
   - Show range validation error

4. **Card Status Change:**
   - User adds benefit to ARCHIVED or PAUSED card
   - Allow it but show warning
   - Or restrict: only ACTIVE cards can receive benefits

5. **Concurrent Benefit Add:**
   - Multiple requests add same benefit simultaneously
   - First succeeds, second returns 409
   - Use unique constraint or conditional logic

---

### Flow 5: Dark Mode Toggle

```
START: User anywhere on app
  ↓
USER CLICKS dark mode toggle button
  ↓
CURRENT THEME CHECK
  localStorage.getItem('theme-preference') → 'light'
  ↓
TOGGLE ACTION
  newTheme = 'dark'
  localStorage.setItem('theme-preference', 'dark')
  ↓
CSS VARIABLE UPDATE
  document.documentElement.style.colorScheme = 'dark'
  HTML element receives data-theme="dark" attribute
  ↓
CSS RULES ACTIVATE
  All :root[data-theme="dark"] CSS variables applied
  All components using var(--color-*) update automatically
  ↓
VISUAL UPDATE
  Header background: dark
  Card backgrounds: dark
  Text color: light
  Borders: dark
  Icons: light color
  ↓
PERSISTENCE
  Next page reload:
    localStorage.getItem('theme-preference') → 'dark'
    Apply dark theme on initial render
  ↓
SYSTEM PREFERENCE FALLBACK
  If theme = 'system':
    window.matchMedia('(prefers-color-scheme: dark)').matches
    Apply user's OS theme preference
  ↓
END: Theme persisted across sessions
```

**Happy Path:**
- Toggle clicked
- Theme preference saved
- CSS variables applied globally
- All UI updates automatically
- Preference persists on reload

**Error Paths:**
- localStorage unavailable → Use in-memory state only
- CSS variables undefined → Components use fallback colors
- System theme query fails → Default to light mode

---

## API Routes & Contracts

### Bug #1: User Profile Endpoints

#### GET /api/protected/user/profile
**Purpose:** Retrieve authenticated user's profile data

**Request:**
```http
GET /api/protected/user/profile HTTP/1.1
Authorization: Bearer [JWT in cookie]
Cookie: session=[JWT]
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cuid123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false,
    "createdAt": "2024-04-01T10:00:00Z",
    "updatedAt": "2024-04-01T10:00:00Z"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTH_UNAUTHORIZED"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "User not found",
  "code": "NOT_FOUND_USER"
}
```

---

#### PATCH /api/protected/user/profile
**Purpose:** Update user's profile data (firstName, lastName)

**Request:**
```http
PATCH /api/protected/user/profile HTTP/1.1
Content-Type: application/json
Cookie: session=[JWT]

{
  "firstName": "Johnny",
  "lastName": "Doe"
}
```

**Request Body Schema:**
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| firstName | string | No | 1-50 characters, no special chars |
| lastName | string | No | 1-50 characters, no special chars |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "cuid123",
    "email": "john@example.com",
    "firstName": "Johnny",
    "lastName": "Doe",
    "emailVerified": false,
    "createdAt": "2024-04-01T10:00:00Z",
    "updatedAt": "2024-04-01T16:30:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "fieldErrors": {
    "firstName": ["First name must be 1-50 characters"],
    "lastName": ["Last name must be 1-50 characters"]
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTH_UNAUTHORIZED"
}
```

---

### Bug #5: Card Management Endpoints

#### POST /api/protected/cards
**Purpose:** Add a credit card to user's wallet

**Request:**
```http
POST /api/protected/cards HTTP/1.1
Content-Type: application/json
Cookie: session=[JWT]

{
  "masterCardId": "mastercard123",
  "customName": null,
  "actualAnnualFee": null,
  "renewalDate": "2024-12-15T00:00:00Z"
}
```

**Request Body Schema:**
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| masterCardId | string | Yes | Must exist in MasterCard table |
| customName | string | No | 1-100 characters |
| actualAnnualFee | integer | No | 0-999999 (in cents) |
| renewalDate | ISO 8601 | Yes | Must be future date |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "usercard456",
    "playerId": "player789",
    "masterCardId": "mastercard123",
    "customName": null,
    "actualAnnualFee": null,
    "renewalDate": "2024-12-15T00:00:00Z",
    "status": "ACTIVE",
    "createdAt": "2024-04-01T15:30:00Z",
    "updatedAt": "2024-04-01T15:30:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "fieldErrors": {
    "masterCardId": ["Card ID is required"],
    "renewalDate": ["Renewal date must be a future date"]
  }
}
```

**Response (409 Conflict):**
```json
{
  "success": false,
  "error": "This card is already in your wallet",
  "code": "CONFLICT_DUPLICATE",
  "details": {
    "existingCardId": "usercard456"
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Card not found in catalog",
  "code": "NOT_FOUND_CARD"
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "You do not own this player",
  "code": "AUTHZ_OWNERSHIP"
}
```

---

#### POST /api/protected/benefits
**Purpose:** Add a benefit to an existing card

**Request:**
```http
POST /api/protected/benefits HTTP/1.1
Content-Type: application/json
Cookie: session=[JWT]

{
  "userCardId": "usercard456",
  "masterBenefitId": "masterbenefit789",
  "customValue": null,
  "expirationDate": "2025-04-01T00:00:00Z"
}
```

**Request Body Schema:**
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| userCardId | string | Yes | Must exist and user must own card |
| masterBenefitId | string | Yes | Must exist and match card's benefits |
| customValue | integer | No | 0-999999 (in cents) |
| expirationDate | ISO 8601 | No | Must be future date if provided |

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "userbenefit999",
    "userCardId": "usercard456",
    "playerId": "player789",
    "name": "Travel Credit",
    "type": "StatementCredit",
    "stickerValue": 30000,
    "customValue": null,
    "resetCadence": "CalendarYear",
    "expirationDate": "2025-04-01T00:00:00Z",
    "isUsed": false,
    "createdAt": "2024-04-01T16:00:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "fieldErrors": {
    "userCardId": ["Card ID is required"],
    "masterBenefitId": ["Benefit ID is required"]
  }
}
```

**Response (409 Conflict):**
```json
{
  "success": false,
  "error": "This benefit is already claimed on this card",
  "code": "CONFLICT_DUPLICATE"
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Card or benefit not found",
  "code": "NOT_FOUND_RESOURCE"
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "You do not own this card",
  "code": "AUTHZ_OWNERSHIP"
}
```

---

#### GET /api/protected/cards/{cardId}/available-benefits
**Purpose:** Get list of benefits available to add to a card

**Request:**
```http
GET /api/protected/cards/usercard456/available-benefits HTTP/1.1
Cookie: session=[JWT]
```

**Query Parameters:**
| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| exclude-claimed | boolean | true | Exclude benefits already on card |

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "masterbenefit789",
      "masterCardId": "mastercard123",
      "name": "Travel Credit",
      "type": "StatementCredit",
      "stickerValue": 30000,
      "resetCadence": "CalendarYear",
      "isActive": true
    },
    {
      "id": "masterbenefit790",
      "masterCardId": "mastercard123",
      "name": "Annual Fee Credit",
      "type": "StatementCredit",
      "stickerValue": 55000,
      "resetCadence": "CardmemberYear",
      "isActive": true
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Card not found",
  "code": "NOT_FOUND_CARD"
}
```

**Response (403 Forbidden):**
```json
{
  "success": false,
  "error": "You do not own this card",
  "code": "AUTHZ_OWNERSHIP"
}
```

---

## Edge Cases & Error Handling

### Bug #1: Profile Data Persistence - Edge Cases

1. **Whitespace-Only Names**
   - Input: `"  "`
   - Validation: Reject as empty
   - Message: "Name cannot be blank"
   - Implementation: `trim()` and check length

2. **Very Long Names**
   - Input: `"A".repeat(100)`
   - Validation: Reject, max 50 chars
   - Message: "Name must be 50 characters or less"

3. **Special Characters**
   - Input: `"<script>alert('xss')</script>"`
   - Validation: Reject
   - Implementation: Whitelist alphanumeric + spaces + common punctuation (-, ', .)

4. **Concurrent Profile Updates**
   - Two requests modify profile simultaneously
   - Strategy: Last-write-wins (updated_at timestamp)
   - Response: Show current state to user, prompt refresh if conflict detected

5. **Profile Update Without Auth**
   - User token expired between page load and submit
   - Response: 401 Unauthorized, redirect to login

6. **Email Not Updated**
   - Email field read-only on settings page
   - Ignore any email field in PATCH request
   - Only update firstName/lastName

---

### Bug #2: Chrome Extension Message Error - Edge Cases

1. **Missing Response Handler**
   - Chrome runtime message sent without response callback
   - Solution: Always expect synchronous response or use sendResponse()

2. **Async Listener Timeout**
   - Message listener returns true (async) but sendResponse() never called
   - Solution: Call sendResponse() before listener completes or return false

3. **Extension Disabled/Removed**
   - User disables extension while app running
   - Solution: Wrap chrome API calls in try-catch, gracefully degrade

4. **Content Script Message Channel Closed**
   - Message sent after content script context destroyed
   - Solution: Check for existence before sending, handle errors

5. **Development vs Production**
   - chrome extension APIs may differ between environments
   - Solution: Feature-flag chrome.runtime API usage, test in both

---

### Bug #3: Dark Mode - Edge Cases

1. **CSS Variables Not Supported (IE11)**
   - Browser doesn't support custom properties
   - Solution: Provide fallback colors in component styles
   - Implementation: `color: var(--color-text, #1a1a1a)`

2. **Rapid Theme Toggle**
   - User clicks toggle multiple times rapidly
   - Issue: Race conditions in CSS updates
   - Solution: Debounce toggle handler (100ms)

3. **localStorage Disabled**
   - Browser has localStorage disabled
   - Solution: Fall back to in-memory state
   - On reload: Use system preference instead of saved preference

4. **System Preference Changes**
   - User changes OS theme while app open (e.g., schedules dark mode)
   - Solution: Listen to matchMedia change events
   - Update theme automatically if theme='system'

5. **SSR / Hydration Mismatch**
   - Server renders with default theme, client hydrates with different theme
   - Solution: Mark ThemeProvider as `'use client'` only
   - Use `dynamic: 'force-dynamic'` on pages that need theme

6. **Component Not Using CSS Variables**
   - Some components have hardcoded colors
   - Solution: Audit all components, update to use var(--color-*)
   - Test: Enable dark mode, verify all UI elements change

7. **Image/Icon Colors**
   - SVG icons with hardcoded fill colors
   - Solution: Use `stroke="currentColor"` or apply filters
   - SVG: `<svg fill="none" stroke="currentColor" ...`

8. **Third-Party Component Styles**
   - Shadcn UI components may not respect theme
   - Solution: Update component files to use CSS variables
   - Or wrap with a color wrapper div

---

### Bug #4: Navigation Routing - Edge Cases

1. **Deep Linking to Protected Route Without Auth**
   - User shares `/dashboard` URL, another person visits without login
   - Expected: Middleware blocks, return 401
   - Actual behavior: Should redirect to `/login`
   - Solution: Update middleware to redirect to `/login` instead of 401 response

2. **User Logs Out While on Dashboard**
   - User logs out, session cookie deleted
   - Next request to protected route fails auth
   - Solution: Detect 401 in client, redirect to login

3. **Token Expires During User Session**
   - User on `/dashboard`, token expires
   - Next API call returns 401
   - Solution: Handle 401 in API client wrapper, redirect to login

4. **Rapid Navigation**
   - User clicks multiple navigation links rapidly
   - Multiple route changes in flight
   - Solution: Prevent double navigation, cancel in-flight requests

5. **Navigation on Mobile**
   - Mobile menu navigation should close after selection
   - Links should work on all screen sizes
   - Solution: Ensure mobile hamburger menu closes on link click

6. **Stale Redirect After Login**
   - User logs in, redirected to `/dashboard`
   - But middleware still sees invalid token
   - Solution: Client should wait for cookie before navigation

7. **Auth State Desynchronization**
   - Context says authenticated, but token actually invalid
   - Solution: Validate token state before allowing navigation
   - Or treat 401 as source of truth

---

### Bug #5: Add Card/Benefit - Edge Cases

1. **Card Already Added to Wallet**
   - User tries to add card they already have
   - Validation: Check `UserCard` for duplicate `(playerId, masterCardId)`
   - Response: 409 Conflict with existing card ID

2. **Multiple Players in Same Wallet**
   - User has "Primary" and "Spouse" players
   - Adding card to Primary shouldn't add to Spouse
   - Solution: Always specify playerContext in requests
   - Validation: Verify card added only to selected player

3. **Invalid Card Renewal Date**
   - User enters past date or invalid format
   - Validation: Must be ISO 8601 format and future date
   - Response: 400 with field error

4. **Concurrent Adds of Same Card**
   - Two requests simultaneously add same card to same player
   - Database unique constraint prevents second insert
   - Response: First gets 201, second gets 409

5. **Card Deleted from Catalog**
   - User tries to add card that was removed from MasterCard
   - Query `MasterCard` where `id = masterCardId`
   - Response: 404 if not found

6. **Adding Benefit to Archived Card**
   - User adds benefit to a card they archived
   - Business rule: Should only add to ACTIVE cards
   - Validation: Check card status before allowing add
   - Response: 400 with message "Cannot add benefits to archived cards"

7. **Duplicate Benefit on Same Card**
   - User tries to add same benefit twice
   - Validation: Check `UserBenefit` for `(userCardId, masterBenefitId)`
   - Response: 409 Conflict

8. **Custom Benefit Value Edge Cases**
   - Input: negative number
   - Validation: customValue >= 0
   - Input: extremely high value (9999999 cents = $99,999.99)
   - Validation: customValue <= stickerValue * 10 (allow up to 10x)

9. **Benefit Expiration Before Card Renewal**
   - User sets benefit expiration before card renewal date
   - Business rule: Allowed but might indicate user error
   - UX: Show warning: "Benefit expires before card renewal"
   - Allow proceed but highlight in UI

10. **Missing MasterBenefit Relations**
    - MasterBenefit for card doesn't exist
    - User selects benefit not actually for that card
    - Validation: Verify `MasterBenefit.masterCardId` matches card
    - Response: 404 or 400 "Benefit not available for this card"

11. **Rapid Repeated Adds**
    - User clicks "Add Card" 5 times in 2 seconds
    - Each request creates duplicate submission
    - Solution: Disable button after first click
    - Backend: Unique constraint catches duplicates, returns 409

12. **Custom Name with Special Characters**
    - User names card "Chase & Amex 2024"
    - Allow most characters but sanitize XSS vectors
    - Validation: 1-100 chars, no script tags, etc.

13. **Player Deleted After Card Selected**
    - User selects card, then player deleted
    - Request arrives with deleted playerId
    - Response: 404 "Player not found"

14. **Annual Fee Override Higher Than Default**
    - User sets actualAnnualFee > defaultAnnualFee
    - Allow it (user might negotiate lower rate)
    - Store as override, use in calculations
    - Display: Show both default and actual

15. **Timezone Issues**
    - User in PST enters renewal date "2024-12-31"
    - Server interprets as UTC midnight
    - Solution: Send ISO 8601 timestamps from client
    - Client localizes for display only

---

## Component Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js App Router                      │
│  (Pages, Layouts, Route Handlers, Server Components)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
    ┌────────┐   ┌─────────┐   ┌──────────┐
    │ Pages  │   │ Layouts │   │  API     │
    │(UI)    │   │ (Root)  │   │ Routes   │
    └────────┘   └──┬──────┘   └──────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
         ▼          ▼          ▼
    ┌──────────────────────────────────┐
    │   Providers Layer                 │
    │ ├─ ThemeProvider (CSS variables) │
    │ ├─ AuthProvider (SessionContext) │
    │ └─ QueryProvider (React Query)   │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │   Component Layer                 │
    │ ├─ Layout Components             │
    │ │  (Header, Navbar, Sidebar)     │
    │ ├─ Feature Components            │
    │ │  (CardGrid, AddCardModal, etc) │
    │ ├─ UI Components                 │
    │ │  (Button, Input, Modal, Card)  │
    │ └─ Custom Components             │
    │    (DarkModeToggle, etc)         │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │   Business Logic Layer           │
    │ ├─ Server Actions (auth, cards)  │
    │ ├─ Hooks (useAuth, useTheme)     │
    │ └─ Context (BenefitValueContext) │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │   Data Access Layer              │
    │ ├─ Prisma Client (ORM)           │
    │ ├─ Auth utilities                │
    │ └─ Validation functions          │
    └──────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────┐
    │   External Services              │
    │ ├─ PostgreSQL Database           │
    │ ├─ Authentication (JWT)          │
    │ └─ Third-party APIs              │
    └──────────────────────────────────┘
```

### Component Dependencies

**Bug #1 (Profile Data):**
```
Settings Page
├── useAuth hook
├── GET /api/protected/user/profile (server action)
├── PATCH /api/protected/user/profile (server action)
└── Input components
```

**Bug #2 (Chrome Error):**
```
Settings Page
├── Chrome runtime API calls (identify and remove/fix)
├── Message listeners (fix promise handling)
└── Error boundaries
```

**Bug #3 (Dark Mode):**
```
ThemeProvider
├── CSS variables (define in globals.css)
├── setTheme action
├── localStorage persistence
└── System preference detection

All Components
├── Use var(--color-*) in styles
├── SafeDarkModeToggle button
└── Inherit theme context
```

**Bug #4 (Navigation):**
```
Middleware (middleware.ts)
├── Route classification
├── Auth verification
└── Redirect logic for authenticated users

Navigation Components
├── Header
├── Breadcrumbs
├── Back button
└── Logo link (all point to /dashboard)
```

**Bug #5 (Add Card/Benefit):**
```
Dashboard/CardGrid
├── AddCardModal
│   ├── Card selector dropdown
│   ├── Form inputs (renewal date, fee)
│   └── POST /api/protected/cards
├── Card tile
│   ├── AddBenefitModal
│   │   ├── Benefit selector dropdown
│   │   ├── Form inputs (custom value, expiration)
│   │   └── POST /api/protected/benefits
│   └── Benefits table
└── Dashboard stats (update on add)
```

---

## Implementation Tasks

### Phase 1A: Profile Data Persistence

#### Task 1A-1: Update Signup Form Component
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Signup form has separate firstName and lastName inputs
- [ ] Form displays labels: "First Name", "Last Name"
- [ ] Both fields are optional but recommended
- [ ] Both fields validate: 1-50 characters, alphanumeric + spaces + hyphens
- [ ] Submit payload includes firstName and lastName

**Implementation Notes:**
- File: `src/app/(auth)/signup/page.tsx`
- Change `name: ''` → separate `firstName: ''` and `lastName: ''` fields
- Update validation logic
- Update submit payload to send both fields

---

#### Task 1A-2: Verify createUser() Handles Name Fields
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 0.5  
**Acceptance Criteria:**
- [ ] createUser() function accepts firstName and lastName parameters
- [ ] Parameters are passed to Prisma create operation
- [ ] Database record saves firstName and lastName correctly

**Implementation Notes:**
- File: `src/lib/auth-server.ts`
- Review createUser() signature
- Verify Prisma User.create() receives firstName, lastName
- Run manual test: create user, query DB, verify fields saved

---

#### Task 1A-3: Create GET /api/protected/user/profile Endpoint
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Endpoint returns 200 with user profile data
- [ ] Includes id, email, firstName, lastName, createdAt, updatedAt
- [ ] Returns 401 if user not authenticated
- [ ] Returns 404 if user not found

**Implementation Notes:**
- File: `src/app/api/protected/user/profile/route.ts` (create new)
- Export GET handler
- Authenticate via middleware, extract userId from context
- Query `User` table by id
- Return formatted response

---

#### Task 1A-4: Create PATCH /api/protected/user/profile Endpoint
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1.5  
**Acceptance Criteria:**
- [ ] Endpoint updates firstName and/or lastName
- [ ] Returns 200 with updated profile
- [ ] Validates firstName and lastName (1-50 chars)
- [ ] Returns 400 with field errors on invalid input
- [ ] Returns 401 if not authenticated
- [ ] Ignores email field if provided

**Implementation Notes:**
- File: `src/app/api/protected/user/profile/route.ts`
- Export PATCH handler
- Parse request body, validate fields
- Update User record in database
- Return updated user data

---

#### Task 1A-5: Update Settings Page to Load and Display Profile
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 1.5  
**Acceptance Criteria:**
- [ ] Settings page fetches user profile on load
- [ ] Displays firstName and lastName in form fields
- [ ] Shows actual user data (not placeholder "John Doe")
- [ ] Save button calls PATCH endpoint
- [ ] Shows success message on save
- [ ] Shows error message on failure
- [ ] Handles loading state

**Implementation Notes:**
- File: `src/app/(dashboard)/settings/page.tsx`
- Add useEffect to fetch profile data
- Update state management to show real data
- Connect Save button to PATCH endpoint
- Add error/success message display

---

### Phase 1B: Chrome Extension Message Error

#### Task 1B-1: Identify Source of Chrome Message Error
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] Locate all chrome.runtime API calls in codebase
- [ ] Identify message listeners that return promises
- [ ] Document error reproduction steps
- [ ] Verify error occurs specifically on settings page

**Implementation Notes:**
- Search codebase: `grep -r "chrome.runtime" src/`
- Look for: `chrome.runtime.sendMessage()`, `chrome.runtime.onMessage.addListener()`
- Check settings page component and parent layouts
- Review browser console logs for full error stack
- Check if content script or background script involved

---

#### Task 1B-2: Fix Promise Handling in Message Listeners
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 1.5  
**Acceptance Criteria:**
- [ ] All message listeners that return true have sendResponse() called
- [ ] Listeners that return promises properly resolve
- [ ] No undefined sendResponse behavior
- [ ] Settings page loads without console errors

**Implementation Notes:**
- Pattern 1: If returning true, must call sendResponse()
  ```javascript
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    doAsync().then(() => sendResponse({ status: 'ok' }));
    return true; // Tell Chrome to wait for sendResponse
  });
  ```
- Pattern 2: If returning false, sendResponse not called
  ```javascript
  chrome.runtime.onMessage.addListener((msg) => {
    // synchronous, no sendResponse
    return false;
  });
  ```

---

#### Task 1B-3: Remove Unnecessary Chrome API Calls
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Identify chrome APIs actually needed for app
- [ ] Remove unused chrome message listeners
- [ ] Verify functionality still works
- [ ] No console errors on settings page

**Implementation Notes:**
- Determine: Is chrome API needed for this app?
- If app is web app (not extension), remove chrome.runtime calls
- If extension integration required, ensure proper implementation

---

### Phase 1C: Global Dark/Light Mode

#### Task 1C-1: Define CSS Variables for Light and Dark Modes
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] All CSS variables defined in `:root`
- [ ] Dark mode variants defined in `[data-theme="dark"]`
- [ ] Variables cover: backgrounds, text, borders, accent colors
- [ ] Variables follow naming convention: `--color-*`
- [ ] CSS file compiles without errors

**Implementation Notes:**
- File: `src/styles/globals.css` or new `src/styles/theme-variables.css`
- Include variables from earlier in spec
- Apply to all components via Tailwind config or direct CSS

---

#### Task 1C-2: Update ThemeProvider to Apply CSS Variables Globally
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] ThemeProvider sets `data-theme` attribute on HTML element
- [ ] CSS variables update when theme changes
- [ ] Theme persists across page reloads
- [ ] System preference fallback works
- [ ] No console errors

**Implementation Notes:**
- File: `src/components/providers/ThemeProvider.tsx`
- In `setTheme()`, set: `document.documentElement.setAttribute('data-theme', newTheme)`
- Also apply to document.documentElement.style.colorScheme
- Ensure persistence via localStorage

---

#### Task 1C-3: Audit Components and Update Styles to Use CSS Variables
**Status:** Pending  
**Complexity:** Large  
**Estimated Hours:** 4  
**Acceptance Criteria:**
- [ ] All hardcoded colors replaced with `var(--color-*)`
- [ ] Header component uses CSS variables
- [ ] Card components use CSS variables
- [ ] Input components use CSS variables
- [ ] Buttons use CSS variables
- [ ] Icons respond to theme toggle
- [ ] All pages tested in light and dark mode

**Implementation Notes:**
- Systematically go through each component
- Replace inline styles: `style={{ color: 'hardcoded' }}` → `style={{ color: 'var(--color-text)' }}`
- Replace Tailwind classes using specific colors → use CSS variable equivalent
- Test: Toggle dark mode, verify all UI updates

**Files to Update:**
- `src/components/layout/Header.tsx`
- `src/components/Card.tsx`
- `src/components/ui/Input.tsx`
- `src/components/ui/button.tsx`
- All other components with hardcoded colors

---

#### Task 1C-4: Test Dark Mode on All Pages
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 1.5  
**Acceptance Criteria:**
- [ ] Login page: light/dark theme works
- [ ] Signup page: light/dark theme works
- [ ] Dashboard: light/dark theme works
- [ ] Settings page: light/dark theme works
- [ ] Card detail page: light/dark theme works
- [ ] All UI elements change color appropriately
- [ ] No broken layouts or unreadable text

**Implementation Notes:**
- Manual testing: click toggle on each page
- Verify elements: header, cards, inputs, buttons, icons, text
- Check for any components still using hardcoded colors
- Document any issues found

---

### Phase 1D: Navigation Routing

#### Task 1D-1: Update Middleware to Redirect Authenticated Users from / to /dashboard
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Logged-in users accessing / redirected to /dashboard
- [ ] Non-logged-in users can still access / (landing page)
- [ ] Redirect happens in middleware
- [ ] No redirect loops

**Implementation Notes:**
- File: `src/middleware.ts`
- In PUBLIC_ROUTES handling, add special case for '/'
- If user authenticated and pathname === '/', redirect to /dashboard
- Otherwise proceed normally

```typescript
if (isPublic && pathname === '/') {
  const { valid, userId } = await verifySessionTokenDirect(sessionToken);
  if (valid && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
}
```

---

#### Task 1D-2: Update Header Navigation Links to Use /dashboard
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 0.5  
**Acceptance Criteria:**
- [ ] Logo link goes to /dashboard (not /)
- [ ] "Dashboard" link goes to /dashboard
- [ ] All navigation links verified to use correct route
- [ ] Links work on all pages

**Implementation Notes:**
- File: `src/components/layout/Header.tsx`
- Find all `href="/"` links that should go to /dashboard
- Update links for logged-in users
- Consider: Might need auth context to determine correct link

---

#### Task 1D-3: Update Back Button Links
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 0.5  
**Acceptance Criteria:**
- [ ] Settings page back button goes to /dashboard
- [ ] Card detail page back button goes to /dashboard
- [ ] All back buttons verified
- [ ] Breadcrumbs use correct routes

**Implementation Notes:**
- Find all "Back" buttons or breadcrumbs
- Update to link to /dashboard instead of /
- Test navigation on each page

---

#### Task 1D-4: Test Navigation on All Pages
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Logo link works on all pages
- [ ] Back button goes to correct location
- [ ] Dashboard links work
- [ ] No broken navigation
- [ ] Redirects work correctly (auth → dashboard, not → /)

**Implementation Notes:**
- Manual test: navigate from each page
- Click logo, back button, all navigation links
- Verify redirects work as expected

---

### Phase 1E: Add Card & Add Benefits Functionality

#### Task 1E-1: Create AddCardModal Component UI
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] Modal displays when isOpen = true
- [ ] Card selection dropdown populated from MasterCard table
- [ ] Renewal date input (date picker or text)
- [ ] Annual fee override input (optional)
- [ ] Submit and cancel buttons
- [ ] Form validation client-side
- [ ] Error messages displayed

**Implementation Notes:**
- File: `src/components/card-management/AddCardModal.tsx`
- Replace stub implementation
- Fetch available MasterCards via server action
- Use shadcn UI Modal, Select, Input components
- Implement form validation

---

#### Task 1E-2: Create POST /api/protected/cards Endpoint
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] Accepts POST request with card data
- [ ] Validates all required fields
- [ ] Checks for duplicate card in user's wallet
- [ ] Creates UserCard record in database
- [ ] Returns 201 with new card data
- [ ] Returns appropriate error codes (400, 409, 404, 403)

**Implementation Notes:**
- File: `src/app/api/protected/cards/route.ts` (create new)
- Export POST handler
- Input validation (masterCardId, renewalDate, etc.)
- Check unique constraint: `(playerId, masterCardId)`
- Insert UserCard record
- Return formatted response with card data

---

#### Task 1E-3: Integrate AddCardModal with POST /api/protected/cards
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Form submit calls POST endpoint
- [ ] Success response closes modal
- [ ] Success response triggers card list refresh
- [ ] Error response shows error message
- [ ] Loading state shown during submission

**Implementation Notes:**
- In AddCardModal, add submit handler
- Call server action or fetch POST endpoint
- Handle response (success/error)
- Update parent component (Dashboard) with new card data

---

#### Task 1E-4: Create AddBenefitModal Component UI
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] Modal displays when isOpen = true
- [ ] Benefit selection dropdown shows available benefits for card
- [ ] Custom value input (optional)
- [ ] Expiration date input (optional)
- [ ] Submit and cancel buttons
- [ ] Form validation client-side
- [ ] Error messages displayed
- [ ] Only shows benefits not already on card

**Implementation Notes:**
- File: `src/components/card-management/AddBenefitModal.tsx` (create new)
- Fetch available benefits via GET /api/protected/cards/{cardId}/available-benefits
- Use shadcn UI Modal, Select, Input components
- Filter out already-claimed benefits

---

#### Task 1E-5: Create POST /api/protected/benefits Endpoint
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] Accepts POST request with benefit data
- [ ] Validates all required fields
- [ ] Checks for duplicate benefit on card
- [ ] Creates UserBenefit record in database
- [ ] Returns 201 with new benefit data
- [ ] Returns appropriate error codes (400, 409, 404, 403)

**Implementation Notes:**
- File: `src/app/api/protected/benefits/route.ts` (create new)
- Export POST handler
- Input validation (userCardId, masterBenefitId, etc.)
- Check unique constraint: `(userCardId, masterBenefitId)`
- Insert UserBenefit record
- Return formatted response with benefit data

---

#### Task 1E-6: Create GET /api/protected/cards/{cardId}/available-benefits Endpoint
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1.5  
**Acceptance Criteria:**
- [ ] Returns list of benefits available for a card
- [ ] Excludes benefits already claimed on card
- [ ] Returns benefits from matching MasterCard
- [ ] Returns 404 if card not found
- [ ] Returns 403 if user doesn't own card

**Implementation Notes:**
- File: `src/app/api/protected/cards/[cardId]/available-benefits/route.ts` (create new)
- Export GET handler
- Fetch card, verify user ownership
- Query MasterBenefits for card's MasterCard
- Exclude already-claimed benefits
- Return list of available benefits

---

#### Task 1E-7: Integrate AddBenefitModal with POST /api/protected/benefits
**Status:** Pending  
**Complexity:** Small  
**Estimated Hours:** 1  
**Acceptance Criteria:**
- [ ] Form submit calls POST endpoint
- [ ] Success response closes modal
- [ ] Success response triggers benefits list refresh
- [ ] Card ROI recalculated
- [ ] Error response shows error message
- [ ] Loading state shown during submission

**Implementation Notes:**
- In AddBenefitModal, add submit handler
- Call server action or fetch POST endpoint
- Handle response (success/error)
- Update parent component (CardDetailPanel) with new benefit data
- Trigger ROI recalculation

---

#### Task 1E-8: Integration Testing - Add Card and Benefit Flow
**Status:** Pending  
**Complexity:** Medium  
**Estimated Hours:** 2  
**Acceptance Criteria:**
- [ ] E2E test: add card from dashboard
- [ ] E2E test: add benefit to card
- [ ] Cards appear in list immediately after add
- [ ] Benefits appear in card details immediately after add
- [ ] ROI updates correctly
- [ ] Error cases handled correctly
- [ ] No console errors

**Implementation Notes:**
- Write Playwright tests
- Test full flow: add card → add benefit → verify UI updates
- Test error cases: duplicate card, invalid input, 403 auth error
- Run tests in CI/CD pipeline

---

## Security & Compliance Considerations

### Authentication & Authorization

**User Authentication:**
- JWT tokens stored in HttpOnly cookies (XSS-proof)
- SameSite=Strict prevents CSRF attacks
- Token verification in middleware for all protected routes
- Session database lookup ensures revocation works on logout

**Authorization:**
- All card/benefit operations verify user ownership
- Player-based access control: users can only see/modify own players
- Server-side checks: never trust client to determine ownership

**Profile Data:**
- Email field read-only in settings (prevent account takeover)
- Name fields validated to prevent XSS/injection
- Whitelist allowed characters: alphanumeric + spaces + common punctuation

### Data Protection

**Sensitive Data:**
- Password hashed with Argon2id (memory-hard algorithm)
- No plaintext passwords logged or displayed
- Password reset tokens should be single-use, time-limited

**Data Validation:**
- All user inputs validated server-side
- Type checking for all API requests
- Maximum length limits on all string fields
- Numeric fields validated for range

**Error Handling:**
- Generic error messages to users (don't leak system details)
- Detailed error logging server-side (for debugging)
- No stack traces or sensitive data in API responses

### Audit & Logging

**Logging Requirements:**
- Log authentication events (login, logout, signup)
- Log profile updates with before/after values
- Log card additions/deletions with user and timestamp
- Log benefit claims with user and timestamp

**Retention:**
- Auth logs: 90 days
- Data modification logs: 1 year
- Error logs: 30 days

---

## Performance & Scalability Considerations

### Expected Load

**Assumptions:**
- 10,000 users (MVP phase)
- 2 cards per user on average
- 8 benefits per card on average
- Peak: 100 concurrent users
- API response time target: < 200ms

### Caching Strategies

**MasterCard Catalog (Read-Only):**
- Cache in memory on server (load at startup)
- 24-hour TTL or manual refresh on catalog update
- Reduces database hits for card selection

**User Profile:**
- Cache in browser localStorage (1-hour TTL)
- Invalidate on logout
- Server source-of-truth for concurrent requests

**Theme Preference:**
- Store in localStorage (client-side only)
- No server caching needed

### Database Optimization

**Indexes Required:**
```sql
-- User lookups
CREATE INDEX idx_user_email ON User(email);

-- Session validation
CREATE INDEX idx_session_userId ON Session(userId);
CREATE INDEX idx_session_token ON Session(sessionToken);

-- Card queries
CREATE INDEX idx_usercard_playerId ON UserCard(playerId);
CREATE UNIQUE INDEX idx_usercard_unique ON UserCard(playerId, masterCardId);

-- Benefit queries
CREATE INDEX idx_userbenefit_userCardId ON UserBenefit(userCardId);
CREATE UNIQUE INDEX idx_userbenefit_unique ON UserBenefit(userCardId, masterBenefitId);

-- Dashboard queries
CREATE INDEX idx_userbenefit_playerId ON UserBenefit(playerId);
```

**Query Optimization:**
- Batch load cards with benefits in single query
- Use Prisma `include` to avoid N+1 queries
- Pagination for large lists (20 items per page)

### Rate Limiting

**API Rate Limits:**
- Signup: 5 per hour per IP
- Login: 10 per hour per account
- Profile update: 100 per hour per user
- Add card: 50 per hour per user
- Add benefit: 100 per hour per user

**Implementation:**
- Use Redis for rate limit counters
- Return 429 Too Many Requests when limit exceeded

### Scalability

**Horizontal Scaling:**
- Stateless API servers (JWT doesn't need session affinity)
- Database replication for read capacity
- Redis cluster for rate limiting state

**Vertical Scaling:**
- Database connection pooling
- Optimized queries with indexes
- Background job processing for heavy operations

---

## Quality Control Checklist

### Requirements Coverage
- ✓ All 5 MVP bugs addressed
- ✓ Root causes identified
- ✓ Fix strategy documented for each bug

### Data Schema
- ✓ Database schema supports all requirements
- ✓ Indexes defined for performance
- ✓ Constraints enforce data integrity
- ✓ Relationships properly defined

### API Design
- ✓ RESTful endpoints designed
- ✓ Request/response schemas defined
- ✓ Error codes and messages specified
- ✓ Authentication/authorization clear

### User Flows
- ✓ Happy paths documented
- ✓ Error paths covered
- ✓ All state transitions defined
- ✓ Edge cases identified

### Component Architecture
- ✓ Components modular and reusable
- ✓ Clear dependencies between components
- ✓ Integration points well-defined
- ✓ UI components can be developed in parallel

### Implementation Tasks
- ✓ Tasks specific and measurable
- ✓ Acceptance criteria clear
- ✓ Complexity estimates included
- ✓ Dependencies documented
- ✓ Logical order for execution

### Security
- ✓ Authentication strategy defined
- ✓ Authorization checks specified
- ✓ Data protection measures documented
- ✓ Audit logging requirements specified

### Testing
- ✓ Edge cases documented
- ✓ Error handling strategies specified
- ✓ Integration points tested
- ✓ E2E scenarios covered

---

## Appendix: Quick Reference

### Files to Create
- `src/app/api/protected/user/profile/route.ts` - Profile endpoints
- `src/app/api/protected/cards/route.ts` - Add card endpoint
- `src/app/api/protected/benefits/route.ts` - Add benefit endpoint
- `src/app/api/protected/cards/[cardId]/available-benefits/route.ts` - Available benefits endpoint
- `src/components/card-management/AddBenefitModal.tsx` - Add benefit modal

### Files to Modify
- `src/app/(auth)/signup/page.tsx` - Split name field into firstName/lastName
- `src/app/(dashboard)/settings/page.tsx` - Load/display actual user data
- `src/components/providers/ThemeProvider.tsx` - Enhance with CSS variable application
- `src/styles/globals.css` - Add CSS variables
- `src/middleware.ts` - Add redirect for authenticated users on /
- `src/components/layout/Header.tsx` - Fix navigation links
- `src/components/card-management/AddCardModal.tsx` - Implement full component

### Environment Variables Needed
- None new (existing auth and database setup sufficient)

### Dependencies to Add
- None new (using existing libraries)

---

## Sign-Off

**Specification Version:** 1.0  
**Created:** April 2024  
**Last Updated:** April 2024  
**Status:** Ready for Implementation  

**Next Steps:**
1. Review specification with development team
2. Clarify any ambiguities
3. Begin Phase 1A tasks in priority order
4. Schedule follow-up review after each phase completion
5. Conduct QA testing on each bug fix

---
