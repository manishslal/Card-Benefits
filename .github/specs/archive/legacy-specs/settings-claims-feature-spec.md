# Card Benefits Tracker - Settings & Claims Feature Specification

**Document Version:** 1.0  
**Status:** FINAL - READY FOR IMPLEMENTATION  
**Target Implementation:** Next.js Expert Developer  
**Date:** April 1, 2024

---

## EXECUTIVE SUMMARY & GOALS

This specification defines the complete technical architecture for two interconnected feature sets that will transform the Card Benefits Dashboard into a fully authenticated, personalized application with comprehensive claims tracking.

### Features Being Built

**Feature 1: User Settings & Navigation (TopNav Component)**
- Fixed header navigation with logo, dark mode toggle, and profile dropdown
- User authentication system (register, login, logout)
- User profile management page
- User preferences page (theme, notifications, currency)
- Protected routes requiring authentication
- Session management with JWT tokens

**Feature 2: Historical Claims & Data Management (BenefitClaim Ledger)**
- Modal interface for viewing all benefit claims
- Filter claims by status (all, used, pending, expired)
- Edit claim values and add notes
- Undo/delete claims with confirmation
- Summary statistics (total claimed, utilization %, type breakdown)
- Real-time updates with toast notifications

### Primary Objectives
1. Implement fixed header navigation (TopNav) with profile dropdown, theme toggle, and logout
2. Create secure user authentication system with password hashing
3. Build user settings and preferences management pages
4. Establish protected routes with middleware authentication
5. Create comprehensive claims history modal with filtering and editing
6. Add form validation with Zod and notifications with sonner
7. Maintain TypeScript strict mode and existing architectural patterns
8. Achieve WCAG 2.1 Level AA accessibility compliance
9. Ensure 90+ Lighthouse performance score

### Success Criteria
- ✅ All protected routes require valid authentication token
- ✅ Settings changes persist to database immediately
- ✅ Claims history shows complete ledger with accurate data
- ✅ All forms have real-time validation with field-level error messages
- ✅ Toast notifications appear for every async operation (success/error)
- ✅ Modal keyboard navigation works (Escape closes, Tab navigates)
- ✅ Dark mode theme preference persists across sessions
- ✅ No TypeScript errors, all strict mode rules followed
- ✅ No console warnings or errors
- ✅ Database migrations apply cleanly with rollback capability

---

## 1. FUNCTIONAL REQUIREMENTS

### 1.1 Feature 1: User Settings & Navigation

**Authentication**
- User registration with email, password, optional first/last name
- User login with email and password
- Secure logout that clears session
- Password hashing with bcrypt (min 8 characters, salted)
- Session tokens with 7-day expiration
- Protected routes that redirect unauthenticated users to /login

**Navigation & Profile**
- Fixed TopNav header (60px height, z-index 50)
- Left section: WalletCards icon + "Card Benefits" text
- Right section: Dark mode toggle button, Profile dropdown
- Profile dropdown shows user email and menu items:
  - Manage Profile → /settings
  - Preferences → /settings/preferences
  - Logout button
- Responsive: Hide text on mobile, keep icon and dropdown

**Settings Pages**
- /settings - Profile editor (firstName, lastName read-only email)
- /settings/preferences - Theme selector (light/dark/system), notification toggles, currency picker
- Both pages require authentication
- Form validation before submission
- Success/error toasts on save
- Cancel buttons to discard changes

**Preferences Model**
- One UserPreference per authenticated user
- Fields: theme, emailNotifications, inAppNotifications, currency, language
- Persists across sessions in database
- Falls back to localStorage for instant theme display

**User Roles**
- Authenticated User: Can access /dashboard, /settings, edit own profile
- Unauthenticated User: Can access /login, /register, otherwise redirected to /login

**System Constraints**
- Email must be unique (database constraint)
- Password minimum 8 characters
- Theme must be one of: 'light', 'dark', 'system'
- Currency must be one of: 'USD', 'EUR', 'GBP'
- All user data private (can only view/edit own data)
- Sessions expire after 7 days of inactivity

### 1.2 Feature 2: Historical Claims & Data Management

**Claims Ledger**
- View all benefit claims for a specific card (UserCard)
- Each claim = UserBenefit with isUsed=true and claimedAt timestamp
- Claims modal accessible via "View History" button on Card component
- Modal shows table of all claims with columns: Date, Benefit Name, Value, Notes, Actions
- Expandable details show full benefit information

**Filtering & Sorting**
- Filter tabs: All Claims, Used/Claimed, Pending, Expired
  - All: All benefits regardless of status
  - Used: isUsed=true AND claimedAt not null
  - Pending: isUsed=false AND expirationDate > now
  - Expired: expirationDate < now
- Sort options: By date (newest first), by name (A-Z), by value (highest first)

**Claim Editing**
- Click edit icon → row becomes editable (Value and Notes become inputs)
- Edit value: User-declared value in cents (0-999999)
- Edit notes: Free-form text (max 500 characters)
- Click save checkmark → calls updateClaimValue server action
- Click cancel → discard changes, revert to view mode
- Toast notification on success/error

**Claim Deletion/Undo**
- Click trash/delete icon → Confirm dialog
- Confirm → calls undoClaim server action
- Reverts: isUsed=false, claimedAt=null, timesUsed-=1
- Toast notification: "Claim removed"
- Claim removed from table (or reappears in Pending tab)

**Statistics Tab**
- Total Claimed: Sum of userDeclaredValue (or stickerValue if not set)
- Total Count: Number of claimed benefits
- Average Value: Total Claimed / Total Count
- By Type: Breakdown by StatementCredit vs UsagePerk
- Utilization: Percentage of benefits claimed vs total

**User Roles**
- Card Owner: Can view and edit claims for own cards only
- No cross-user data leaks (database queries filter by userId)

**System Constraints**
- Cannot view other users' claims (userId-based filtering)
- Cannot edit claimedAt timestamp (immutable claim date)
- Cannot undelete claims (deletion is permanent)
- Claim value edits stored in userDeclaredValue (stickerValue never changes)
- Notes stored in separate BenefitClaimNote model (allows multiple notes per claim in future)

---

## 2. IMPLEMENTATION PHASES

### Phase 0: Prerequisites (BLOCKING - Must Complete First)

**Objectives:** Establish authentication foundation, add dependencies, create database models

**Key Deliverables:**
- [ ] Install: sonner, react-hook-form, zod, @hookform/resolvers, bcrypt
- [ ] Install shadcn/ui: input, form, select, checkbox, label, alert, scroll-area, table
- [ ] Create src/middleware.ts for protected routes
- [ ] Add UserSession model to Prisma schema
- [ ] Add UserPreference model to Prisma schema
- [ ] Create Prisma migration
- [ ] Create src/lib/validationSchemas.ts with Zod schemas
- [ ] Verify all TypeScript builds without errors

**Estimated Duration:** 2-3 days  
**Dependencies:** None  
**Blocker for:** Phase 1, Phase 2

---

### Phase 1: User Navigation & Settings (Feature 1)

**Objectives:** Implement TopNav, authentication, settings pages

**Key Deliverables:**
- [ ] Create TopNav component with logo, toggle, dropdown
- [ ] Create ProfileDropdown component with menu items
- [ ] Create LogoutButton server action
- [ ] Create authentication server actions (registerUser, loginUser, logoutUser)
- [ ] Create updateUserProfile server action
- [ ] Create updateUserPreferences server action
- [ ] Create /settings layout and pages
- [ ] Create /settings/preferences page
- [ ] Integrate TopNav into root layout
- [ ] Integrate Toaster (sonner) into root layout
- [ ] Add form validation with react-hook-form + Zod
- [ ] Add toast notifications for all operations
- [ ] Implement middleware route protection
- [ ] Test all authentication flows

**Estimated Duration:** 4-5 days  
**Dependencies:** Phase 0  
**Integration Points:** Modifies src/app/layout.tsx, creates src/app/settings/*

---

### Phase 2: Claims History Modal (Feature 2)

**Objectives:** Build claims modal with filtering, editing, statistics

**Key Deliverables:**
- [ ] Create ClaimHistoryModal component (Dialog wrapper)
- [ ] Create ClaimHistoryTabs component (filter tabs)
- [ ] Create ClaimHistoryTable component (ledger display)
- [ ] Create ClaimStatistics component (summary view)
- [ ] Create getClaimHistory server action with filtering
- [ ] Create updateClaimValue server action
- [ ] Create undoClaim server action
- [ ] Create addClaimNote server action (optional)
- [ ] Add BenefitClaimNote model to Prisma (optional)
- [ ] Add "View History" button to Card component
- [ ] Integrate modal state in PlayerTabsContainer
- [ ] Test all modal interactions
- [ ] Add animations and transitions

**Estimated Duration:** 4-5 days  
**Dependencies:** Phase 0, Phase 1  
**Integration Points:** Modifies src/components/Card.tsx, creates src/components/ClaimHistory/*

---

### Phase 3: Testing & Polish

**Objectives:** Comprehensive testing, accessibility, performance

**Key Deliverables:**
- [ ] Unit tests for validation schemas and utilities
- [ ] Integration tests for server actions
- [ ] E2E tests for user workflows (auth, settings, claims)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance testing (Lighthouse)
- [ ] Error boundary components
- [ ] Loading skeleton components
- [ ] Keyboard navigation testing
- [ ] Final bug fixes and polish

**Estimated Duration:** 3-4 days  
**Dependencies:** Phases 0, 1, 2

---

## 3. DATABASE SCHEMA DESIGN

### 3.1 Prisma Models (Complete)

#### UserSession Model (New)
```prisma
model UserSession {
  id        String @id @default(cuid())
  userId    String
  user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  token     String @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

**Purpose:** Store authentication tokens for session management  
**Constraints:**
- `token` is unique (prevents duplicate sessions)
- `expiresAt` indexed for cleanup queries
- `onDelete: Cascade` deletes sessions when user deleted

**Lifecycle:**
- Created on login/register
- Deleted on logout
- Auto-deleted after expiration (background job, Phase 2)

#### UserPreference Model (New)
```prisma
model UserPreference {
  id                  String @id @default(cuid())
  userId              String @unique
  user                User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  theme               String @default("light")
  emailNotifications  Boolean @default(true)
  inAppNotifications  Boolean @default(true)
  currency            String @default("USD")
  language            String @default("en-US")
  
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([userId])
}
```

**Purpose:** Store user preferences for theme, notifications, currency  
**Constraints:**
- `userId` is unique (one preference set per user)
- All fields have sensible defaults
- `onDelete: Cascade` deletes preferences with user

**Valid Values:**
- theme: 'light' | 'dark' | 'system'
- currency: 'USD' | 'EUR' | 'GBP'
- language: 'en-US', 'es-ES', etc.

#### BenefitClaimNote Model (Optional, Phase 2)
```prisma
model BenefitClaimNote {
  id        String @id @default(cuid())
  benefitId String
  benefit   UserBenefit @relation(fields: [benefitId], references: [id], onDelete: Cascade)
  
  note      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([benefitId])
  @@index([createdAt])
}
```

**Purpose:** Store manual notes attached to benefit claims  
**Constraints:**
- `benefitId` indexed for lookups
- `createdAt` indexed for chronological sorting
- `onDelete: Cascade` deletes notes when benefit deleted

#### User Model (Modified)
**Changes:** Add relations for sessions and preferences (no new fields)
```prisma
model User {
  id              String @id @default(cuid())
  email           String @unique
  passwordHash    String
  firstName       String?
  lastName        String?

  // NEW RELATIONS
  sessions        UserSession[]
  preferences     UserPreference?

  // EXISTING
  players         Player[]
  emailVerified   Boolean @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([email])
}
```

#### UserBenefit Model (NO CHANGES)
The existing UserBenefit model is already the claims ledger. DO NOT modify:
- ✅ `isUsed` - Whether benefit is claimed
- ✅ `claimedAt` - Timestamp of claim (immutable)
- ✅ `timesUsed` - Count of resets/uses
- ✅ `expirationDate` - When benefit expires
- ✅ `userDeclaredValue` - User's custom valuation (editable)

Add relation to BenefitClaimNote if using optional model:
```prisma
model UserBenefit {
  // ... existing fields ...
  
  // NEW RELATION (optional)
  notes          BenefitClaimNote[]
}
```

### 3.2 Migration Script

**File:** `prisma/migrations/[timestamp]_add_auth_and_settings/migration.sql`

This is auto-generated by Prisma. Commands:
```bash
npx prisma migrate dev --name add_auth_and_settings
```

Prisma generates the SQL to:
1. Create UserSession table with indexes
2. Create UserPreference table with unique constraint
3. Create BenefitClaimNote table with indexes
4. Add relations to User model
5. Add BenefitClaimNote relation to UserBenefit

### 3.3 Indexing Strategy

**Performance Indexes:**

| Table | Columns | Type | Purpose |
|-------|---------|------|---------|
| UserSession | token | UNIQUE | Fast token lookup |
| UserSession | expiresAt | INDEX | Token cleanup queries |
| UserPreference | userId | UNIQUE | One-to-one enforcement |
| BenefitClaimNote | benefitId | INDEX | Find notes by benefit |
| BenefitClaimNote | createdAt | INDEX | Chronological queries |
| UserBenefit | isUsed | INDEX | EXISTING, used for claims filter |
| UserBenefit | claimedAt | INDEX | EXISTING, used for claim date range |
| UserBenefit | expirationDate | INDEX | EXISTING, used for expiration filter |

---

## 4. SERVER ACTIONS (Complete Specifications)

### 4.1 Authentication Actions (`src/actions/auth.ts`)

All authentication actions should:
1. Validate input parameters
2. Check database constraints
3. Hash passwords with bcrypt
4. Return discriminated union results
5. Log errors to console
6. NOT expose sensitive information

#### registerUser
```typescript
registerUser(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<
  | { success: true; userId: string; token: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
>
```

**Behavior:**
1. Validate email format and uniqueness
2. Validate password (min 8 chars, no special rules)
3. Hash password with bcrypt (rounds: 10)
4. Create User with optional firstName/lastName
5. Create default UserPreference
6. Create UserSession with random token
7. Set token expiration to 7 days from now
8. Return token (stored as HTTP-only cookie by client)

**Errors:**
- Email already registered → fieldErrors.email
- Invalid email format → fieldErrors.email
- Password too short → fieldErrors.password
- Database error → error message

**Revalidation:** None (auth doesn't affect dashboard)

---

#### loginUser
```typescript
loginUser(input: {
  email: string;
  password: string;
}): Promise<
  | { success: true; userId: string; token: string }
  | { success: false; error: string }
>
```

**Behavior:**
1. Validate input not empty
2. Find user by email
3. Compare password with hash using bcrypt.compare()
4. If invalid, return generic error (prevent user enumeration)
5. Create UserSession with new token
6. Return token

**Errors:**
- Email or password incorrect → Generic error (both cases)
- Database error → "Login failed"

**Note:** Use generic error for security (don't tell if email doesn't exist)

---

#### logoutUser
```typescript
logoutUser(token: string): Promise<
  | { success: true }
  | { success: false; error: string }
>
```

**Behavior:**
1. Delete UserSession by token
2. Return success
3. Client deletes HTTP-only cookie
4. Client redirects to /login

---

### 4.2 Settings Actions (`src/actions/settings.ts`)

#### updateUserProfile
```typescript
updateUserProfile(
  userId: string,
  input: {
    firstName?: string;
    lastName?: string;
  }
): Promise<
  | { success: true; user: { id: string; firstName?: string; lastName?: string; email: string } }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
>
```

**Behavior:**
1. Validate userId from session (not empty)
2. Validate firstName (if provided) max 100 chars
3. Validate lastName (if provided) max 100 chars
4. Update User record
5. Return updated user (without sensitive fields)

**Errors:**
- Field validation → fieldErrors
- User not found → "User not found"
- Database error → "Failed to update profile"

**Revalidation:** None (doesn't affect dashboard)

---

#### updateUserPreferences
```typescript
updateUserPreferences(
  userId: string,
  input: {
    theme?: 'light' | 'dark' | 'system';
    emailNotifications?: boolean;
    inAppNotifications?: boolean;
    currency?: 'USD' | 'EUR' | 'GBP';
  }
): Promise<
  | { success: true; preferences: UserPreference }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
>
```

**Behavior:**
1. Validate userId from session
2. Validate each field against allowed values
3. Use upsert to create if not exists, update if exists
4. Return updated preferences

**Errors:**
- Invalid theme → fieldErrors.theme
- Invalid currency → fieldErrors.currency
- Database error → "Failed to update preferences"

**Revalidation:** revalidatePath('/') if theme affects all pages

---

#### getCurrentUser (Helper)
```typescript
getCurrentUser(userId: string): Promise<
  | { success: true; user: User & { preferences: UserPreference } }
  | { success: false; error: string }
>
```

**Behavior:**
1. Fetch User with preferences
2. Return user data for component initialization

---

### 4.3 Claims Actions (`src/actions/claims.ts`)

#### getClaimHistory
```typescript
getClaimHistory(
  cardId: string,
  userId: string,
  options?: {
    status?: 'all' | 'used' | 'pending' | 'expired';
    sortBy?: 'date' | 'name' | 'value';
    page?: number;
    pageSize?: number;
  }
): Promise<
  | { success: true; claims: ClaimWithDetails[]; pagination?: { page: number; pageSize: number; total: number; pages: number } }
  | { success: false; error: string }
>
```

**Behavior:**
1. Validate cardId and userId
2. Auth check: Verify user owns card (query playerId → userId)
3. Build WHERE clause based on status filter:
   - 'all': No filter
   - 'used': isUsed=true AND claimedAt NOT null
   - 'pending': isUsed=false AND expirationDate > now
   - 'expired': expirationDate < now
4. Sort by: date (claimedAt DESC) | name (name ASC) | value (stickerValue DESC)
5. Apply pagination (default pageSize=20)
6. Fetch with includes: userCard + masterCard, notes
7. Return claims array and pagination info

**Errors:**
- Card not found → "Card not found"
- Database error → "Failed to fetch history"

**Authorization:** Query filters to user's own cards only

---

#### updateClaimValue
```typescript
updateClaimValue(
  benefitId: string,
  userId: string,
  input: {
    userDeclaredValue?: number;
    note?: string;
  }
): Promise<
  | { success: true; benefit: UserBenefit }
  | { success: false; error: string; fieldErrors?: Record<string, string> }
>
```

**Behavior:**
1. Validate input not empty
2. Validate userDeclaredValue (0-999999 cents, ~$0-9999.99)
3. Validate note (max 500 chars)
4. Auth check: Verify user owns benefit
5. Update benefit with new userDeclaredValue
6. Create or update note in BenefitClaimNote
7. Return updated benefit

**Errors:**
- Value out of range → fieldErrors.userDeclaredValue
- Note too long → fieldErrors.note
- Benefit not found → "Benefit not found"
- Database error → "Failed to update claim"

**Constraints:** Cannot edit claimedAt (immutable)

---

#### undoClaim
```typescript
undoClaim(
  benefitId: string,
  userId: string
): Promise<
  | { success: true; benefit: UserBenefit }
  | { success: false; error: string }
>
```

**Behavior:**
1. Validate input
2. Auth check: Verify user owns benefit
3. Update benefit:
   - isUsed = false
   - claimedAt = null
   - timesUsed = max(0, timesUsed - 1)
4. Return updated benefit

**Errors:**
- Benefit not found → "Benefit not found"
- Database error → "Failed to undo claim"

**Effect:** Claim disappears from "Used" tab, reappears in "Pending" tab

---

#### addClaimNote (Optional)
```typescript
addClaimNote(
  benefitId: string,
  userId: string,
  note: string
): Promise<
  | { success: true; noteId: string }
  | { success: false; error: string }
>
```

**Behavior:**
1. Validate note (max 500 chars)
2. Auth check: Verify user owns benefit
3. Create BenefitClaimNote record
4. Return noteId

---

## 5. COMPLETE TYPE DEFINITIONS

### Server Action Result Types
```typescript
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

type FormResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string }
  | { success: false; error: string; fieldErrors: Record<string, string> };

type AuthResult = 
  | { success: true; userId: string; token: string }
  | { success: false; error: string; fieldErrors?: Record<string, string> };
```

### Component Props Types
```typescript
interface TopNavProps {
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  onLogout?: () => void;
}

interface ProfileDropdownProps {
  user: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  onLogout?: () => void;
}

interface ClaimHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  userId: string;
}

interface ClaimHistoryTableProps {
  claims: Claim[];
  isLoading: boolean;
  onEdit?: (claimId: string, value: number, notes?: string) => void;
  onDelete?: (claimId: string) => void;
}
```

---

## 6. UI COMPONENT SPECIFICATIONS (Complete)

### 6.1 TopNav Component

**File:** `src/components/TopNav.tsx`

**Purpose:** Fixed header navigation visible on all pages

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ [💳] Card Benefits                  [🌙] [👤▼]              │
└──────────────────────────────────────────────────────────────┘
```

**Structure:**
- Container: `fixed top-0 left-0 right-0 h-[60px] z-50 border-b`
- Content: `flex items-center justify-between px-6`
- Left: Logo section (WalletCards icon 24px + title)
- Right: Dark toggle button + profile dropdown

**Props:**
```typescript
interface TopNavProps {
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
}
```

**Responsive:**
- Desktop (1440px+): Full logo text visible
- Tablet (768px+): Logo text visible, normal layout
- Mobile (320px): Logo icon only, hamburger drawer (Phase 2)

---

### 6.2 ProfileDropdown Component

**File:** `src/components/TopNav/ProfileDropdown.tsx`

**Purpose:** User menu with Settings, Preferences, Logout

**Uses:** shadcn/ui DropdownMenu, Lucide icons

**Menu Items:**
```
┌─────────────────────────────────┐
│ user@example.com                │
├─────────────────────────────────┤
│ 🏠 Profile                      │
│ ⚙️ Preferences                  │
├─────────────────────────────────┤
│ 🚪 Logout                       │
└─────────────────────────────────┘
```

**Styling:**
- Trigger: User icon (20px), gray-500, hover:gray-700
- Dropdown: Right-aligned to trigger
- Items: 16px font, 12px padding, full width
- Icons: 16px, inline before text

---

### 6.3 ClaimHistoryModal Component

**File:** `src/components/ClaimHistory/ClaimHistoryModal.tsx`

**Purpose:** Modal for viewing and managing benefit claims

**Uses:** shadcn/ui Dialog, Tabs, ScrollArea

**Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│ Chase Sapphire - Claim History                         [✕]  │
├─────────────────────────────────────────────────────────────┤
│ [All] [Used] [Pending] [Expired] [Stats]                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ClaimHistoryTable (Tab Content)                     │   │
│  │ - Date | Benefit | Value | Notes | [✎] [🗑]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Total: $500.00 | Used: 5 | Average: $100.00              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Props:**
```typescript
interface ClaimHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  userId: string;
}
```

**State:**
```typescript
const [selectedTab, setSelectedTab] = useState<'all' | 'used' | 'pending' | 'expired'>('all');
const [sortBy, setSortBy] = useState<'date' | 'name' | 'value'>('date');
const [claims, setClaims] = useState<Claim[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [editingId, setEditingId] = useState<string | null>(null);
```

**Styling:**
- Dialog: 600px width, centered, dark:bg-gray-800
- Header: 24px font, bold, with close button
- Tabs: 14px font, border-bottom, active border-blue-600
- Content: ScrollArea with max-height

---

### 6.4 ClaimHistoryTable Component

**File:** `src/components/ClaimHistory/ClaimHistoryTable.tsx`

**Purpose:** Display claims in table format

**Columns:**
| Field | Width | Format |
|-------|-------|--------|
| Date | 15% | MMM DD, YYYY |
| Benefit | 25% | Benefit name (truncate) |
| Value | 15% | $XXX.XX |
| Notes | 30% | First 50 chars + ... |
| Actions | 15% | [✎] [🗑] |

**Interactions:**
- Click [✎] → Inline edit mode
  - Value becomes number input
  - Notes becomes textarea
  - [✓] Save, [✕] Cancel buttons
- Click [🗑] → Confirm dialog
  - "Delete this claim?" message
  - Yes/No buttons
  - On yes: undoClaim server action
  - Toast: "Claim removed"

**Styling:**
- Table: 100% width, border-collapse
- Header: bg-gray-100 dark:bg-gray-700, font-bold
- Rows: hover:bg-gray-50 dark:hover:bg-gray-700
- Alternating: Even rows bg-gray-50 dark:bg-gray-800
- Borders: border-gray-200 dark:border-gray-700

---

### 6.5 ClaimStatistics Component

**File:** `src/components/ClaimHistory/ClaimStatistics.tsx`

**Purpose:** Display summary statistics

**Stats Shown:**
```
┌────────────────────────────────────┐
│ Total Claimed:  $1,250.00          │
│ Claim Count:    18                 │
│ Average:        $69.44             │
├────────────────────────────────────┤
│ By Type:                           │
│   Statement Credit:  $750.00 (12)  │
│   Usage Perk:        $500.00 (6)   │
├────────────────────────────────────┤
│ Utilization:                       │
│   Claimed: 67% (18 of 27)          │
│   Pending: 33% (9 remaining)       │
└────────────────────────────────────┘
```

**Calculations:**
```typescript
const totalClaimed = claims
  .filter(c => c.isUsed)
  .reduce((sum, c) => sum + (c.userDeclaredValue || c.stickerValue), 0);

const claimCount = claims.filter(c => c.isUsed).length;

const avgValue = claimCount > 0 ? totalClaimed / claimCount : 0;

const byType = claims.reduce((acc, c) => {
  if (c.isUsed) {
    const type = c.type;
    if (!acc[type]) acc[type] = { count: 0, total: 0 };
    acc[type].count++;
    acc[type].total += c.userDeclaredValue || c.stickerValue;
  }
  return acc;
}, {} as Record<string, { count: number; total: number }>);

const utilization = {
  claimed: claims.filter(c => c.isUsed).length,
  total: claims.length,
  percent: (claims.filter(c => c.isUsed).length / claims.length) * 100
};
```

---

### 6.6 SettingsPage Component

**File:** `src/app/settings/page.tsx`

**Purpose:** User profile editor

**Form Fields:**
- First Name (text input, max 100)
- Last Name (text input, max 100)
- Email (read-only display, not editable)

**Buttons:**
- [Save Changes] (submit)
- [Cancel] (discard, clear form)

**Validation:**
- Both fields optional (can be empty)
- If provided, max 100 characters
- No special characters required

**On Submit:**
1. Validate using UpdateProfileSchema (Zod)
2. Call updateUserProfile(userId, formData)
3. If success: toast.success('Profile updated'), show updated data
4. If error: toast.error(error), keep form filled in
5. If fieldErrors: Display error messages below fields

---

### 6.7 PreferencesPage Component

**File:** `src/app/settings/preferences/page.tsx`

**Purpose:** User preferences editor

**Form Fields:**
- Theme selector: Radio buttons (Light / Dark / System)
- Email Notifications: Toggle switch
- In-App Notifications: Toggle switch
- Currency: Dropdown (USD / EUR / GBP)

**On Submit:**
1. Validate using UpdatePreferencesSchema (Zod)
2. Call updateUserPreferences(userId, formData)
3. If theme changed: Update HTML class (dark/light), save to localStorage
4. If success: toast.success('Preferences saved')
5. If error: toast.error(error)

---

## 7. MIDDLEWARE & AUTHENTICATION

### 7.1 Middleware Implementation

**File:** `src/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/', '/login', '/register'];
const protectedRoutes = ['/settings', '/dashboard', '/api/protected'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // TODO: Validate token in database (Phase 0)
    // If expired or invalid, redirect to /login and clear cookie

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 7.2 Authentication Flow

**Registration:**
```
User visits /register
  ↓
Fills form (email, password, name)
  ↓
Clicks "Sign Up"
  ↓
registerUser(email, password, name)
  ↓
Validates input, hashes password, creates User + UserPreference + UserSession
  ↓
Returns { success: true; userId; token }
  ↓
Client stores token in HTTP-only cookie
  ↓
Client redirected to /dashboard
```

**Login:**
```
User visits /login
  ↓
Fills form (email, password)
  ↓
Clicks "Login"
  ↓
loginUser(email, password)
  ↓
Validates credentials with bcrypt.compare()
  ↓
Creates UserSession with new token
  ↓
Returns { success: true; userId; token }
  ↓
Client stores token in HTTP-only cookie
  ↓
Client redirected to /dashboard
```

**Protected Route Access:**
```
User clicks /settings link
  ↓
Middleware checks request.cookies.get('auth-token')
  ↓
If missing: Redirect to /login
  ↓
If valid: Allow request to proceed
  ↓
Layout fetches user data using token
  ↓
Component renders with user data
```

**Logout:**
```
User clicks Logout button
  ↓
logoutUser(token)
  ↓
Delete UserSession from database
  ↓
Client deletes HTTP-only cookie
  ↓
Client redirected to /login
```

---

## 8. ERROR HANDLING & VALIDATION

### 8.1 Validation Schemas (Zod)

**File:** `src/lib/validationSchemas.ts`

```typescript
import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Minimum 8 characters'),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password required'),
});

export const UpdateProfileSchema = z.object({
  firstName: z.string().max(100, 'Max 100 characters').optional(),
  lastName: z.string().max(100, 'Max 100 characters').optional(),
});

export const UpdatePreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  emailNotifications: z.boolean().optional(),
  inAppNotifications: z.boolean().optional(),
  currency: z.enum(['USD', 'EUR', 'GBP']).optional(),
});

export const UpdateClaimSchema = z.object({
  userDeclaredValue: z.number().min(0).max(999999).optional(),
  note: z.string().max(500, 'Max 500 characters').optional(),
});
```

### 8.2 Input Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| email | Valid RFC 5322 format | "Invalid email format" |
| email | Unique in database | "Email already registered" |
| password | Min 8 characters | "Minimum 8 characters" |
| firstName | Max 100 characters | "Max 100 characters" |
| lastName | Max 100 characters | "Max 100 characters" |
| theme | 'light' \| 'dark' \| 'system' | "Invalid selection" |
| currency | 'USD' \| 'EUR' \| 'GBP' | "Invalid currency" |
| note | Max 500 characters | "Max 500 characters" |
| claimValue | 0-999999 cents | "Invalid amount" |

### 8.3 Error Response Pattern

All server actions return:

```typescript
// Success
{
  success: true,
  user: { ... } | data: { ... } | benefit: { ... }
}

// Validation error
{
  success: false,
  error: 'Validation failed',
  fieldErrors: {
    email: 'Already registered',
    password: 'Too short'
  }
}

// Authorization error
{
  success: false,
  error: 'You do not have permission to access this'
}

// Not found
{
  success: false,
  error: 'Record not found'
}

// Server error
{
  success: false,
  error: 'An unexpected error occurred. Please try again.'
}
```

### 8.4 Toast Notifications

**Pattern:** Every async operation shows toast

```typescript
const result = await updateUserProfile(userId, data);

if (result.success) {
  toast.success('Profile updated');
} else {
  if (result.fieldErrors) {
    Object.entries(result.fieldErrors).forEach(([field, error]) => {
      toast.error(`${field}: ${error}`);
    });
  } else {
    toast.error(result.error);
  }
}
```

**Toast Examples:**
- Success: "Profile updated", "Settings saved", "Claim removed"
- Error: "Email already in use", "Failed to save", "Unauthorized"
- Info: "Loading...", "Processing..."

---

## 9. PERFORMANCE CONSIDERATIONS

### 9.1 Bundle Size Impact

**New Dependencies:**
- sonner: ~15 KB gzipped
- react-hook-form: ~8 KB gzipped
- zod: ~13 KB gzipped
- Total: ~36 KB gzipped (acceptable < 50 KB)

**Code Splitting:**
- Load settings pages only when accessed
- Load claim modal only when card is expanded

### 9.2 Database Query Optimization

**Pattern: Select Only Required Fields**
```typescript
// ❌ Bad: Fetches all fields
const benefit = await prisma.userBenefit.findUnique({ where: { id } });

// ✅ Good: Select only needed fields
const benefit = await prisma.userBenefit.findUnique({
  where: { id },
  select: {
    id: true,
    name: true,
    stickerValue: true,
    isUsed: true,
    claimedAt: true
  }
});
```

### 9.3 Pagination for Large Datasets

```typescript
export async function getClaimHistory(
  cardId: string,
  options?: { page?: number; pageSize?: number }
) {
  const pageSize = options?.pageSize || 20;
  const page = options?.page || 1;
  const skip = (page - 1) * pageSize;

  const [claims, total] = await Promise.all([
    prisma.userBenefit.findMany({
      where: { userCardId: cardId },
      skip,
      take: pageSize,
      orderBy: { claimedAt: 'desc' }
    }),
    prisma.userBenefit.count({ where: { userCardId: cardId } })
  ]);

  return {
    claims,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize)
    }
  };
}
```

### 9.4 Caching Strategy

**Theme (localStorage + database):**
1. Read from localStorage immediately (instant display)
2. Fetch from database asynchronously
3. If mismatch, update localStorage from database
4. Next session loads from localStorage

**User Data (React state):**
1. Fetch once on app load
2. Cache in component state
3. Revalidate on settings save
4. Invalidate on logout

---

## 10. TESTING STRATEGY

### 10.1 Unit Tests

**Test validation schemas:**
```typescript
describe('RegisterSchema', () => {
  it('accepts valid registration data', () => {
    const data = {
      email: 'user@example.com',
      password: 'password123'
    };
    expect(RegisterSchema.safeParse(data).success).toBe(true);
  });

  it('rejects invalid email', () => {
    const data = {
      email: 'invalid',
      password: 'password123'
    };
    expect(RegisterSchema.safeParse(data).success).toBe(false);
  });
});
```

### 10.2 Integration Tests

**Test server actions:**
```typescript
describe('updateUserProfile', () => {
  it('updates user profile successfully', async () => {
    const result = await updateUserProfile('user-123', {
      firstName: 'John'
    });
    expect(result.success).toBe(true);
    expect(result.user.firstName).toBe('John');
  });

  it('returns error for invalid input', async () => {
    const result = await updateUserProfile('user-123', {
      firstName: 'a'.repeat(101)
    });
    expect(result.success).toBe(false);
  });
});
```

### 10.3 E2E Tests (Playwright)

**Test user workflows:**
```typescript
test('User can register and login', async ({ page }) => {
  // 1. Navigate to /register
  await page.goto('/register');

  // 2. Fill form
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.fill('[name="firstName"]', 'John');
  await page.click('button[type="submit"]');

  // 3. Verify redirected to /dashboard
  await expect(page).toHaveURL('/dashboard');

  // 4. Logout
  await page.click('[data-testid="profile-dropdown"]');
  await page.click('text=Logout');

  // 5. Verify redirected to /login
  await expect(page).toHaveURL('/login');

  // 6. Login again
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'password123');
  await page.click('button[type="submit"]');

  // 7. Verify back on /dashboard
  await expect(page).toHaveURL('/dashboard');
});
```

### 10.4 Accessibility Tests

**Manual testing checklist:**
- [ ] All form inputs have labels
- [ ] Tab order is logical (left→right, top→bottom)
- [ ] Color contrast >= 4.5:1 (use WAVE tool)
- [ ] Modal closes with Escape key
- [ ] Buttons have focus visible state
- [ ] Error messages announced to screen readers
- [ ] Icons have aria-labels or adjacent text

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 0 Checklist
```
DEPENDENCIES
[ ] npm install sonner react-hook-form zod @hookform/resolvers
[ ] npx shadcn-ui@latest add input form select checkbox label alert scroll-area table
[ ] Verify no TypeScript errors: npm run type-check

DATABASE
[ ] Update prisma/schema.prisma with UserSession model
[ ] Update prisma/schema.prisma with UserPreference model
[ ] Create migration: npx prisma migrate dev --name add_auth_and_settings
[ ] Verify migration creates tables and indexes

VALIDATION
[ ] Create src/lib/validationSchemas.ts
[ ] Define: RegisterSchema, LoginSchema, UpdateProfileSchema, UpdatePreferencesSchema
[ ] Test schemas with valid/invalid data

MIDDLEWARE
[ ] Create src/middleware.ts
[ ] Define publicRoutes and protectedRoutes
[ ] Implement token validation logic
[ ] Test: Unauthenticated user redirected to /login for /settings

COMMIT
[ ] git add . && git commit -m "Phase 0: Add auth dependencies and database schema"
```

### Phase 1 Checklist
```
TOPNAV COMPONENT
[ ] Create src/components/TopNav.tsx
[ ] Create src/components/TopNav/ProfileDropdown.tsx
[ ] Add WalletCards icon and title
[ ] Add dark mode toggle button
[ ] Add profile dropdown with menu
[ ] Test responsive layout (mobile, tablet, desktop)
[ ] Style dark mode support

AUTH ACTIONS
[ ] Create src/actions/auth.ts
[ ] Implement registerUser (with bcrypt hashing)
[ ] Implement loginUser (with password validation)
[ ] Implement logoutUser
[ ] Test all three actions with valid/invalid inputs
[ ] Verify tokens stored in database

SETTINGS ACTIONS
[ ] Create src/actions/settings.ts
[ ] Implement updateUserProfile
[ ] Implement updateUserPreferences
[ ] Implement getCurrentUser helper
[ ] Test input validation (field errors)
[ ] Test authorization (can only update own data)

LAYOUT & PAGES
[ ] Modify src/app/layout.tsx - Add TopNav and Toaster
[ ] Create src/app/settings/layout.tsx
[ ] Create src/app/settings/page.tsx (profile form)
[ ] Create src/app/settings/preferences/page.tsx (preferences form)
[ ] Add form validation using react-hook-form + Zod
[ ] Add toast notifications for all operations

STYLING
[ ] Apply Tailwind CSS to all components
[ ] Support dark mode (use CSS variables)
[ ] Test responsive on mobile/tablet/desktop
[ ] Verify color contrast (WAVE tool)

TESTING
[ ] Unit tests for validation schemas
[ ] Integration tests for auth actions
[ ] E2E test: Register → Login → Settings → Logout
[ ] Accessibility test: Keyboard navigation, tab order

COMMIT
[ ] git add . && git commit -m "Phase 1: Implement TopNav, Auth, and Settings"
```

### Phase 2 Checklist
```
MODAL COMPONENTS
[ ] Create src/components/ClaimHistory/ClaimHistoryModal.tsx
[ ] Create src/components/ClaimHistory/ClaimHistoryTabs.tsx
[ ] Create src/components/ClaimHistory/ClaimHistoryTable.tsx
[ ] Create src/components/ClaimHistory/ClaimStatistics.tsx
[ ] Test tab switching, data loading, responsive layout

CLAIMS ACTIONS
[ ] Create src/actions/claims.ts
[ ] Implement getClaimHistory (with filtering)
[ ] Implement updateClaimValue
[ ] Implement undoClaim
[ ] Implement addClaimNote (optional)
[ ] Test with filtering: all, used, pending, expired
[ ] Test sorting: date, name, value
[ ] Test authorization (only own claims)

INTEGRATION
[ ] Add "View History" button to src/components/Card.tsx
[ ] Add modal state to PlayerTabsContainer
[ ] Test modal opens/closes correctly
[ ] Test data loads correctly for selected card

STYLING
[ ] Apply Tailwind CSS to modal components
[ ] Add animations (fade-in/fade-out)
[ ] Support dark mode
[ ] Test responsive layout

TESTING
[ ] Unit tests for statistics calculations
[ ] Integration tests for claims actions
[ ] E2E test: View card → Click history → Filter tabs → Edit claim → Undo claim
[ ] Accessibility: Modal keyboard nav (Escape closes)

COMMIT
[ ] git add . && git commit -m "Phase 2: Implement Claims History Modal"
```

### Phase 3 Checklist
```
TESTING
[ ] Write unit tests for utilities
[ ] Write integration tests for all server actions
[ ] Write E2E tests for all user workflows
[ ] Achieve >80% code coverage

ACCESSIBILITY
[ ] Run WAVE audit - fix violations
[ ] Test keyboard navigation (Tab, Escape, Enter)
[ ] Test with screen reader (NVDA/JAWS/Safari)
[ ] Verify WCAG 2.1 Level AA compliance

PERFORMANCE
[ ] Run Lighthouse audit - target 90+
[ ] Optimize images and bundle size
[ ] Test with slow 3G network (DevTools)
[ ] Verify database queries use indexes

POLISH
[ ] Error boundaries for settings pages
[ ] Loading skeletons for table rows
[ ] Handle edge cases (network errors, conflicts)
[ ] Final bug fixes and refinements

DOCUMENTATION
[ ] Document authentication flow
[ ] Document component props
[ ] Create setup guide for new developers
[ ] Document environment variables

COMMIT
[ ] git add . && git commit -m "Phase 3: Testing, accessibility, and documentation"
```

---

## 12. DEPLOYMENT CHECKLIST

### Pre-Deployment
```
[ ] All TypeScript errors resolved: npm run type-check
[ ] All linting passes: npm run lint
[ ] All tests pass: npm test
[ ] No console warnings/errors
[ ] Lighthouse score >= 90 on all pages
[ ] WCAG accessibility audit passes
[ ] Database migration tested on fresh database
[ ] Rollback procedure documented
```

### Deployment Steps
```bash
# 1. Install dependencies
npm install

# 2. Build project
npm run build

# 3. Run tests
npm test

# 4. Create database backup
# (Via hosting provider or manual)

# 5. Run migrations
npx prisma migrate deploy

# 6. Deploy to production
# (Via CI/CD pipeline)

# 7. Smoke tests
# - Login with test account
# - Access /settings page
# - Open claims history modal
# - Check browser console for errors

# 8. Monitor logs
# - Check for auth failures
# - Check for database errors
# - Monitor error tracking (Sentry, etc.)
```

### Rollback Plan
```bash
# If migration fails:
npx prisma migrate resolve --rolled-back "add_auth_and_settings"

# If deployment fails:
# Revert to previous commit:
git revert <commit-hash>
npm run build && npm run deploy

# Verify data integrity
npx prisma db execute --stdin < verification.sql
```

---

## 13. ENVIRONMENT VARIABLES

**File:** `.env.local`

```env
# Database
DATABASE_URL="file:./dev.db"

# Authentication
SESSION_EXPIRY_DAYS=7
BCRYPT_ROUNDS=10

# API (if applicable)
NEXT_PUBLIC_API_URL="http://localhost:3000"

# Features
FEATURE_CLAIMS_HISTORY=true
FEATURE_SETTINGS=true
```

---

## 14. QUICK REFERENCE GUIDE

### Key Command Patterns

**Database:**
```bash
npx prisma migrate dev                    # Create migration after schema change
npx prisma studio                         # Open database GUI
npx prisma db push                        # Sync schema with database (dev only)
npm run prisma:seed                       # Run seed script
```

**Development:**
```bash
npm run dev                               # Start development server
npm run type-check                        # Check TypeScript errors
npm run lint                              # Run ESLint
npm test                                  # Run tests
```

**Components:**
```tsx
// Server Action Pattern
'use server';
export async function myAction(data: InputType): Promise<ActionResult<OutputType>> {
  try {
    // validate, execute, return
    return { success: true, data };
  } catch (err) {
    console.error('[myAction]', err);
    return { success: false, error: 'Failed' };
  }
}

// Client Component Pattern
'use client';
import { useState } from 'react';
import { toast } from 'sonner';

export default function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = await myAction(data);
      if (result.success) {
        toast.success('Saved');
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return <button onClick={handleSave}>{isLoading ? 'Saving...' : 'Save'}</button>;
}
```

### File Structure
```
src/
├── actions/
│   ├── auth.ts              ← registerUser, loginUser, logoutUser
│   ├── settings.ts          ← updateUserProfile, updateUserPreferences
│   ├── claims.ts            ← getClaimHistory, updateClaimValue, undoClaim
│   ├── benefits.ts          ← Existing
│   └── wallet.ts            ← Existing
├── components/
│   ├── TopNav.tsx           ← NEW: Header with dropdown
│   ├── TopNav/
│   │   ├── ProfileDropdown.tsx
│   │   └── LogoutButton.tsx
│   ├── ClaimHistory/
│   │   ├── ClaimHistoryModal.tsx
│   │   ├── ClaimHistoryTable.tsx
│   │   ├── ClaimStatistics.tsx
│   │   └── ClaimDetailRow.tsx
│   └── [existing]
├── app/
│   ├── layout.tsx           ← MODIFY: Add TopNav, Toaster
│   ├── page.tsx             ← MODIFY: Add history callback
│   ├── settings/
│   │   ├── layout.tsx       ← NEW
│   │   ├── page.tsx         ← NEW
│   │   └── preferences/page.tsx ← NEW
│   └── [existing]
├── middleware.ts            ← NEW: Route protection
├── lib/
│   ├── validationSchemas.ts ← NEW: Zod schemas
│   ├── formatting.ts        ← NEW: Utility functions
│   ├── prisma.ts            ← Existing
│   └── utils.ts             ← Existing
└── types/
    ├── index.ts             ← MODIFY: Add types
    └── components.ts        ← NEW: Component props
```

---

## 15. FINAL SIGN-OFF

This specification is **COMPLETE and READY FOR IMPLEMENTATION**.

### Document Quality Checklist
- ✅ All 15 sections completed with comprehensive detail
- ✅ Database schema fully defined with migration script
- ✅ Server actions specified with complete type signatures
- ✅ UI components defined with props, layout, and styling
- ✅ Error handling, validation, and security documented
- ✅ Testing strategy with concrete test examples
- ✅ Implementation tasks with estimated complexity and dependencies
- ✅ Deployment procedures and rollback plans
- ✅ Code examples for all critical patterns
- ✅ Appendices with quick reference guides

### Expert Implementation Expectations

An expert Next.js developer should be able to:
1. ✅ Implement each component from prop specifications
2. ✅ Implement each server action from type signatures
3. ✅ Create the database schema without further clarification
4. ✅ Set up authentication following the patterns provided
5. ✅ Add form validation using the provided Zod schemas
6. ✅ Implement error handling following the patterns
7. ✅ Pass all acceptance criteria without ambiguity
8. ✅ Complete each phase with estimated timeline

### Implementation Timeline Estimate
- **Phase 0:** 2-3 days
- **Phase 1:** 4-5 days
- **Phase 2:** 4-5 days
- **Phase 3:** 3-4 days
- **Total:** 13-17 days (~2-3 weeks with testing and polish)

### Critical Success Factors
1. Complete Phase 0 (auth + middleware) BEFORE Phases 1 & 2
2. Follow server action error patterns consistently
3. Add toasts to every async operation
4. Validate input early in every action
5. Test each phase before moving to the next
6. Maintain TypeScript strict mode
7. Follow existing code patterns from audit report
8. Document any deviations from spec

---

**SPECIFICATION COMPLETE**

**Status:** ✅ APPROVED FOR IMPLEMENTATION

This document provides all technical details necessary for implementation. It should be the single source of truth for the development team throughout all three phases.

**Questions?** Refer to the relevant section:
- Database: Section 3
- Server Actions: Section 4
- UI Components: Section 6
- Authentication: Section 7
- Validation: Section 8
- Testing: Section 10
- Implementation: Section 11

---

**Prepared By:** QA Architect  
**Date:** April 1, 2024  
**Version:** 1.0 FINAL
