# Card-Benefits Admin Management Feature - Technical Specification

## Executive Summary & Goals

The Admin Management feature enables designated users with administrative privileges to manage the core catalog of credit card types, their associated benefits, and other admin users. This feature provides a comprehensive web-based interface for maintaining master card data, ensuring data consistency across the application, and establishing role-based access control (RBAC) for administrative operations.

**Business Value:**
- Centralized management of card catalog without direct database access
- Reduced data entry errors through form validation and UI controls
- Audit trail of all administrative changes for compliance and debugging
- Delegation of administrative tasks through admin role assignment
- Better control over card visibility and benefit defaults for end users

**Primary Objectives:**
1. Enable admins to create, read, update, and delete master card types with all properties
2. Provide granular benefit management (add/edit/remove benefits per card type)
3. Implement role-based access control with admin role assignment capability
4. Create comprehensive audit logging for all administrative changes
5. Build an intuitive, responsive admin dashboard with proper error handling
6. Ensure data consistency and prevent accidental deletions with safety confirmations

**Timeline & Scope Estimate:** 
- Phase 1 (Database & Auth): 2-3 days
- Phase 2 (API Layer): 3-4 days
- Phase 3 (Admin UI): 4-5 days
- Phase 4 (Testing & Polish): 2-3 days
- **Total: 11-15 days**

---

## Functional Requirements

### Core Features

#### 1. Admin Role Management
- **Role Assignment:** Super admins can assign/remove the "admin" role to any user
- **Access Control:** Only users with the "admin" role can access the admin dashboard
- **Role Verification:** Every admin endpoint checks for valid admin role at request time
- **Admin Actions:** 
  - View all users in the system with their current role status
  - Assign admin role to users (promote to admin)
  - Remove admin role from users (demote from admin)
  - Prevent self-demotion at UI level (warning) and API level (validation)
  - Track which admin made each role change with timestamp

#### 2. Card Type Management
- **Card Catalog Viewing:**
  - Display all master card types with complete information
  - Show card properties: issuer, card name, annual fee, image URL
  - Display count of associated benefits for each card
  - Pagination support for large catalogs (default 20 cards per page)
  
- **Card Creation:**
  - Create new master card types with:
    * Card issuer name (required, string)
    * Card name (required, string)
    * Annual fee in cents (required, integer ≥ 0)
    * Card image URL (required, valid URL format)
    * Optional: description, features, notes
  - Validation:
    * Unique combination of (issuer, cardName)
    * Annual fee must be non-negative
    * Card image URL must be accessible/valid
  - Auto-populate with default timestamp
  
- **Card Editing:**
  - Modify any card property except card ID
  - Edit history is tracked in audit log
  - Cannot rename existing card if new name would create duplicate
  - Benefits remain associated during card edits
  
- **Card Deletion:**
  - Delete master card types with confirmation dialog
  - Soft delete approach: check for associated user cards before deletion
  - If user cards exist: show warning with count, option to archive instead
  - If no user cards: allow direct deletion
  - Archive flag available as alternative to deletion
  - Log deletion reason and admin who performed deletion
  
- **Card Reordering:**
  - Drag-and-drop interface or explicit order field
  - Store displayOrder field for priority ranking
  - Affects order in public card catalog for users

#### 3. Benefit Management (Per Card Type)
- **View Benefits:**
  - Display all benefits for a specific card type
  - Show benefit properties: name, type, value, reset cadence
  - Show active/inactive status
  - Display creation date and last modified date
  
- **Create Benefit:**
  - Add new benefit to a card type with:
    * Benefit name (required, e.g., "Travel Insurance", "Lounge Access")
    * Benefit type (required, enum: insurance, cashback, travel, banking, points, other)
    * Sticker value (required, integer ≥ 0, in cents or points)
    * Reset cadence (required, enum: annual, per-transaction, per-day, monthly, one-time)
    * Is active flag (default: true)
    * Optional: description, notes, category
  - Validation:
    * Unique benefit name per card type
    * Value must be non-negative
    * Type and cadence must be from predefined enums
  
- **Edit Benefit:**
  - Modify benefit properties (all except benefit ID)
  - Preserve creation timestamp
  - Update modified timestamp
  - Log changes in audit trail
  
- **Delete Benefit:**
  - Remove benefit from card type
  - Check if benefit is used by any user cards
  - If used: show warning with count of user cards, option to deactivate instead
  - If unused: allow direct deletion
  - Log deletion with reason
  
- **Set Default Benefits:**
  - Mark which benefits should be automatically created for new user cards
  - Toggle default status for each benefit
  - When user adds card: automatically copy benefits marked as default

#### 4. Audit Logging
- **Log Every Change:**
  - All CRUD operations on cards, benefits, and user roles
  - Store: action type, resource type, resource ID, old values, new values, admin user ID, timestamp, IP address
  
- **Audit Trail Query:**
  - View audit log with filtering by:
    * Resource type (card, benefit, user_role)
    * Action type (create, update, delete)
    * Date range
    * Admin user who made the change
  - Pagination support
  
- **Audit Display:**
  - Show recent changes on admin dashboard
  - Detailed audit view accessible from each resource

### User Roles & Permissions

**Admin Role:**
- Can access /admin/* routes
- Can perform all CRUD operations on cards and benefits
- Can assign/remove admin roles from other users
- Can view audit logs

**Super Admin (future):** 
- All admin privileges
- Can delete other admins
- Can access system-wide settings

**Regular User:**
- Cannot access admin routes
- Can only view master cards
- Cannot make any modifications

### System Constraints & Limits

| Constraint | Value | Reason |
|-----------|-------|--------|
| Max card types in system | 1,000 | Memory/performance limit |
| Max benefits per card | 50 | UI usability limit |
| Max audit log retention | 2 years | Storage/compliance |
| API rate limit (admin) | 100 req/min | Prevent abuse |
| File upload size (card image) | 5 MB | Server resource limit |
| Card name length | 200 chars | Database field limit |
| Benefit description length | 1,000 chars | Database field limit |
| Admin dashboard page size | 20 items | Performance/UX |
| Concurrent admin users | Unlimited | PostgreSQL connection pool |

---

## Implementation Phases

### Phase 1: Database Schema & Authentication (Days 1-3)

**Objectives:**
- Add admin role capability to User model
- Create audit logging tables
- Implement admin role checks in middleware
- Set up admin guard for protected routes

**Key Deliverables:**
1. Prisma schema updates:
   - Add `role` field to User model (enum: USER, ADMIN)
   - Create AdminAuditLog table with comprehensive logging
   - Create AuditLogEntry table for historical records
2. Database migrations for new tables
3. Auth context extensions to carry admin role
4. Middleware protection for /admin/* routes
5. Helper functions for role checking and audit logging

**Dependencies:** None

**Complexity:** Medium

---

### Phase 2: API Layer - Core Endpoints (Days 4-7)

**Objectives:**
- Implement all REST API endpoints for card management
- Implement all endpoints for benefit management
- Implement admin role management endpoints
- Implement audit logging endpoints
- Add comprehensive validation and error handling

**Key Deliverables:**
1. Card Management APIs:
   - GET /api/admin/cards (list with pagination, filtering)
   - GET /api/admin/cards/[id] (single card detail)
   - POST /api/admin/cards (create)
   - PATCH /api/admin/cards/[id] (update)
   - DELETE /api/admin/cards/[id] (delete with safety checks)
   - PATCH /api/admin/cards/reorder (bulk reorder)
   
2. Benefit Management APIs:
   - GET /api/admin/cards/[id]/benefits (list benefits for card)
   - POST /api/admin/cards/[id]/benefits (create benefit)
   - PATCH /api/admin/cards/[id]/benefits/[benefitId] (update)
   - DELETE /api/admin/cards/[id]/benefits/[benefitId] (delete)
   - PATCH /api/admin/cards/[id]/benefits/[benefitId]/toggle-default (set as default)
   
3. Admin Role APIs:
   - GET /api/admin/users (list users with role info)
   - PATCH /api/admin/users/[userId]/role (assign/remove admin role)
   - GET /api/admin/users/[userId] (user details)
   
4. Audit Log APIs:
   - GET /api/admin/audit-logs (list with filtering)
   - GET /api/admin/audit-logs/[id] (single log detail)

2. Request/response validation schemas
3. Error handling with proper HTTP status codes
4. Transaction handling for data consistency
5. Unit tests for all endpoints (minimum 80% coverage)

**Dependencies:** Phase 1 (database & auth)

**Complexity:** Large

---

### Phase 3: Admin Dashboard UI (Days 8-12)

**Objectives:**
- Build responsive admin dashboard with card and benefit management interfaces
- Implement role assignment UI
- Create audit log viewer
- Add confirmation dialogs for destructive operations
- Implement search, filter, and pagination

**Key Deliverables:**
1. Admin Dashboard Layout:
   - Sidebar navigation with sections: Dashboard, Cards, Users, Audit Logs
   - Header with user info and logout
   - Responsive design (mobile, tablet, desktop)
   
2. Cards Management Interface:
   - Table/list view of all cards with pagination
   - Card search and filter by issuer
   - Quick action buttons: edit, delete, manage benefits, view details
   - "Create New Card" button with form modal
   - Edit card modal with validation
   - Delete confirmation dialog with safety checks
   - Card detail view showing all properties + benefits
   
3. Benefits Management Interface:
   - Per-card benefits view/edit
   - Benefits table with inline actions
   - Create benefit modal with form
   - Edit benefit modal
   - Delete confirmation with impact assessment
   - Toggle default status via checkbox
   - Sort/filter benefits within card
   
4. User Management Interface:
   - User list with role column
   - Search users by email/name
   - Role assignment: dropdown/button to change role
   - Confirm role change dialog
   - Prevent self-demotion with UI warning
   - Recent role changes visible
   
5. Audit Log Viewer:
   - Timeline view of recent changes
   - Filter by resource type, action, admin, date range
   - Search by card name, benefit name, user email
   - Details modal showing before/after values
   - Export audit log to CSV (future)
   
6. Common Components:
   - Confirmation dialog component
   - Form validation with error display
   - Loading states and spinners
   - Error toast notifications
   - Success toast notifications
   - Pagination controls
   - Search/filter bar

2. TypeScript type definitions for all API responses
3. React hooks for API calls and state management
4. Error boundary components
5. Accessibility: ARIA labels, keyboard navigation
6. E2E tests for critical user flows (create card, edit, delete)

**Dependencies:** Phase 2 (APIs)

**Complexity:** Large

---

### Phase 4: Testing, Validation & Polish (Days 13-15)

**Objectives:**
- Comprehensive testing of all features
- Security audit of admin endpoints
- Performance optimization
- Documentation and deployment preparation

**Key Deliverables:**
1. Testing:
   - Unit tests for utility functions (80%+ coverage)
   - API integration tests for all endpoints
   - E2E tests for critical flows (add card, edit card, assign admin)
   - Load testing for admin dashboard with large datasets
   - Security testing: SQL injection, XSS, CSRF, authorization bypass
   
2. Validation:
   - Field-level validation on all forms
   - API-level validation on all endpoints
   - Database-level constraints match API validation
   - Error messages are user-friendly and helpful
   
3. Polish:
   - UI refinement based on user feedback
   - Performance optimization (lazy loading, pagination)
   - Mobile responsiveness testing
   - Accessibility compliance (WCAG 2.1 Level AA)
   - Empty states and error states for all views
   
4. Documentation:
   - API documentation (OpenAPI/Swagger format)
   - Admin user guide (how to manage cards/benefits)
   - Deployment runbook
   - Code comments for complex logic

**Dependencies:** Phase 3 (UI)

**Complexity:** Medium

---

## Data Schema / State Management

### Database Schema Updates

#### 1. User Model Extension
```prisma
model User {
  id             String          @id @default(cuid())
  email          String          @unique
  passwordHash   String
  firstName      String?
  lastName       String?
  emailVerified  Boolean         @default(false)

  // Admin fields (NEW)
  role           UserRole        @default(USER)  // USER, ADMIN
  isActive       Boolean         @default(true)

  // Password Reset Fields
  passwordResetToken  String?    @unique @db.VarChar(255)
  passwordResetExpiry DateTime?

  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  
  // Relations
  importJobs     ImportJob[]
  players        Player[]
  sessions       Session[]
  importProfiles UserImportProfile[]
  auditLogs      AdminAuditLog[]      // Admin who performed actions

  @@index([email])
  @@index([role])
  @@index([isActive])
}

enum UserRole {
  USER
  ADMIN
}
```

#### 2. AdminAuditLog Table (NEW)
```prisma
model AdminAuditLog {
  id              String          @id @default(cuid())
  
  // Who performed the action
  adminUserId     String
  adminUser       User            @relation(fields: [adminUserId], references: [id], onDelete: Cascade)
  
  // What was changed
  actionType      AuditActionType // CREATE, UPDATE, DELETE
  resourceType    ResourceType    // CARD, BENEFIT, USER_ROLE, etc.
  resourceId      String
  resourceName    String?
  
  // Change details
  oldValues       String?         // JSON string of previous values
  newValues       String?         // JSON string of new values
  
  // Request context
  ipAddress       String?
  userAgent       String?
  
  // Timestamp
  timestamp       DateTime        @default(now())
  
  @@index([adminUserId])
  @@index([actionType])
  @@index([resourceType])
  @@index([resourceId])
  @@index([timestamp])
  @@index([adminUserId, timestamp])
}

enum AuditActionType {
  CREATE
  UPDATE
  DELETE
}

enum ResourceType {
  CARD
  BENEFIT
  USER_ROLE
  SYSTEM_SETTING
}
```

#### 3. MasterCard Model Extension
```prisma
model MasterCard {
  id               String          @id @default(cuid())
  issuer           String
  cardName         String
  defaultAnnualFee Int
  cardImageUrl     String
  
  // Display properties (NEW)
  displayOrder     Int             @default(0)  // For catalog ordering
  isActive         Boolean         @default(true)
  isArchived       Boolean         @default(false)
  
  // Audit fields (NEW)
  createdByAdminId String?
  archivedByAdminId String?
  archivedAt       DateTime?
  archivedReason   String?
  
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  
  masterBenefits   MasterBenefit[]
  userCards        UserCard[]

  @@unique([issuer, cardName])
  @@index([issuer])
  @@index([cardName])
  @@index([displayOrder])
  @@index([isActive])
  @@index([isArchived])
}
```

#### 4. MasterBenefit Model Extension
```prisma
model MasterBenefit {
  id              String          @id @default(cuid())
  masterCardId    String
  
  name            String
  type            BenefitType
  stickerValue    Int
  resetCadence    ResetCadence
  
  // Default behavior (NEW)
  isDefault       Boolean         @default(true)  // Auto-created for new user cards
  isActive        Boolean         @default(true)
  
  // Audit fields (NEW)
  createdByAdminId String?
  
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  
  masterCard      MasterCard      @relation(fields: [masterCardId], references: [id], onDelete: Cascade)

  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
  @@index([isDefault])
  @@index([isActive])
}

enum BenefitType {
  INSURANCE
  CASHBACK
  TRAVEL
  BANKING
  POINTS
  OTHER
}

enum ResetCadence {
  ANNUAL
  PER_TRANSACTION
  PER_DAY
  MONTHLY
  ONE_TIME
}
```

### Relationships & Constraints

```
User (role=ADMIN)
├── can create/edit/delete MasterCard
│   ├── triggers AdminAuditLog entry
│   └── MasterCard
│       ├── can have many MasterBenefit
│       │   └── triggers AdminAuditLog entry on change
│       └── can have many UserCard (user's cards using this template)
│
└── can assign/remove role to other User
    ├── triggers AdminAuditLog entry
    └── User gets updated role
```

### Performance Indexing Strategy

| Table | Indexes | Purpose |
|-------|---------|---------|
| User | email, role, isActive | Fast auth lookup, admin filtering, user enumeration |
| AdminAuditLog | adminUserId, actionType, resourceType, resourceId, timestamp, (adminUserId, timestamp) | Fast filtering by admin, action type, resource, date range |
| MasterCard | issuer, cardName, displayOrder, isActive, isArchived | Catalog listing, duplicate prevention, quick retrieval |
| MasterBenefit | masterCardId, type, resetCadence, isDefault, isActive | Benefit queries per card, type filtering, default benefit retrieval |

### Data Consistency Strategies

1. **Foreign Key Constraints:**
   - AdminAuditLog.adminUserId → User.id (CASCADE on delete)
   - MasterBenefit.masterCardId → MasterCard.id (CASCADE on delete)
   - Prevents orphaned records

2. **Transaction-Based Updates:**
   - Card edit: wrap update + audit log in transaction
   - Benefit delete: verify no user cards use it, then delete + log in transaction
   - Admin role assignment: update role + log in transaction

3. **Soft Deletes:**
   - Add `isArchived` flag to MasterCard instead of hard delete
   - Archive preserves referential integrity with existing UserCards
   - Prevents data loss

4. **Conflict Prevention:**
   - Unique constraint on (issuer, cardName) prevents duplicate cards
   - Unique constraint on (masterCardId, name) prevents duplicate benefits
   - Index on displayOrder for efficient sorting

---

## User Flows & Workflows

### Flow 1: Admin Creates New Credit Card

**Happy Path:**
```
1. Admin navigates to Admin Dashboard → Cards section
2. Clicks "Add New Card" button
3. Form modal opens with fields:
   - Issuer (dropdown or text)
   - Card Name
   - Annual Fee (number in cents)
   - Card Image URL (with preview)
   - Description (optional)
4. Admin fills in all required fields
5. Form validates fields on blur
   - Issuer: required, string max 100 chars
   - Card Name: required, string max 200 chars
   - Annual Fee: required, non-negative integer
   - Card Image URL: required, valid URL format
6. Admin clicks "Create Card" button
7. API call: POST /api/admin/cards with validation
8. Server-side validation:
   - Check unique (issuer, cardName)
   - Verify URL accessibility
   - Check admin role
9. Success: Card created, AdminAuditLog entry logged
10. UI: Toast notification, redirect to card detail view
11. Admin can now add benefits to this card
```

**Error Paths:**
- Missing required field → Form shows validation error, disable submit button
- Duplicate card (same issuer + name) → API returns 409, show error modal with suggestion
- Invalid URL → Form validation fails, show error message
- Admin role revoked mid-action → API returns 403, redirect to login
- Server error → API returns 500, show generic error, option to retry

---

### Flow 2: Admin Edits Card Properties

**Happy Path:**
```
1. Admin views card in Cards list
2. Clicks "Edit" button or card row to view detail
3. Card detail view shows all properties
4. Admin clicks "Edit Card" button
5. Modal opens with pre-filled form:
   - Card Issuer (readonly, cannot change)
   - Card Name (editable)
   - Annual Fee (editable)
   - Card Image URL (editable with preview)
   - Description (editable)
6. Admin makes changes
7. Form validates on blur
8. Admin clicks "Save Changes"
9. API call: PATCH /api/admin/cards/[id] with only changed fields
10. Server validation:
    - Check if new name would create duplicate (skip if same as current)
    - Check admin role
    - Store old values for audit log
11. Success: Card updated, AdminAuditLog entry created with before/after
12. UI: Toast "Card updated", show updated timestamp
13. Audit log shows this change with old/new values visible
```

**Conflict Scenarios:**
- Another admin edits same card concurrently → Last-write-wins (can add optimistic locking later)
- User tries to rename card to existing name → API returns 400, show error

---

### Flow 3: Admin Manages Benefits for a Card

**Subflow 3a: Add Benefit**
```
1. Admin opens card detail view
2. Scrolls to "Benefits" section (list of current benefits)
3. Clicks "Add Benefit" button
4. Modal opens with form:
   - Benefit Name (required, unique per card)
   - Benefit Type (dropdown: Insurance, Cashback, Travel, Banking, Points, Other)
   - Sticker Value (required, non-negative integer, in cents or points)
   - Reset Cadence (dropdown: Annual, Per-Transaction, Per-Day, Monthly, One-Time)
   - Is Default (checkbox, checked by default)
   - Description (optional)
5. Admin fills form
6. Form validation on blur
7. Admin clicks "Add Benefit"
8. API: POST /api/admin/cards/[cardId]/benefits
9. Server validates:
    - Check unique (cardId, name)
    - Check admin role
    - Verify type enum value
    - Verify cadence enum value
10. Success: Benefit created, AdminAuditLog entry logged
11. UI: Toast "Benefit added", refresh benefits list in card detail
```

**Subflow 3b: Edit Benefit**
```
1. Admin views benefits list in card detail
2. Clicks "Edit" on benefit row
3. Modal opens with current benefit values pre-filled
4. Admin makes changes (can change all except benefit ID)
5. Form validates
6. Clicks "Save Benefit"
7. API: PATCH /api/admin/cards/[cardId]/benefits/[benefitId]
8. Server validates and stores audit log
9. Success: Toast, refresh list
```

**Subflow 3c: Delete Benefit**
```
1. Admin clicks "Delete" on benefit row
2. Confirmation dialog appears:
   - "Are you sure?" message
   - If benefit is used by user cards:
     * Shows: "This benefit is used by X user cards"
     * Options: "Deactivate instead" or "Delete anyway"
   - If unused:
     * Options: "Cancel" or "Delete"
3. Admin confirms deletion
4. API: DELETE /api/admin/cards/[cardId]/benefits/[benefitId]
5. Server-side:
    - Check if any UserBenefit uses this benefit
    - If yes and not forced: return 409 with user count
    - Validate admin role
    - Create audit log with deletion reason
6. Success: Benefit deleted/deactivated, toast notification
```

**Subflow 3d: Toggle Default Status**
```
1. Admin views benefits list for a card
2. Each benefit has a checkbox "Default for new cards"
3. Admin toggles checkbox
4. API: PATCH /api/admin/cards/[cardId]/benefits/[benefitId]/toggle-default
5. Server: Updates isDefault flag, logs audit entry
6. UI: Checkbox state updates immediately, toast confirmation
```

---

### Flow 4: Admin Assigns Admin Role to User

**Happy Path:**
```
1. Admin navigates to Admin Dashboard → Users section
2. User list displayed with columns: Email, Name, Role, Actions
3. Admin searches for user by email or scrolls list
4. Finds target user
5. Clicks "Assign Admin Role" button on user row
6. Confirmation dialog appears:
   - "Make [email] an admin?"
   - Explanation: "Admins can manage cards, benefits, and other admins"
7. Admin clicks "Confirm"
8. API: PATCH /api/admin/users/[userId]/role with role=ADMIN
9. Server validation:
    - Check calling admin role
    - Check target user exists
    - Create AdminAuditLog: USER_ROLE, UPDATE, old=USER, new=ADMIN
10. Success: User role updated, AdminAuditLog entry created
11. UI: Toast "User promoted to admin"
12. User list refreshed, role column shows "ADMIN" for this user
```

**Removal Flow:**
```
1. Admin views user with role="ADMIN"
2. Clicks "Remove Admin Role"
3. Dialog: "Remove admin privileges from [email]?"
4. If user is calling admin (self):
   - Extra confirmation: "You are about to remove your own admin privileges"
5. Admin confirms
6. API: PATCH /api/admin/users/[userId]/role with role=USER
7. Server validates and logs
8. Success: Role downgraded, audit entry created
```

---

### Flow 5: Admin Views Audit Log

**Happy Path:**
```
1. Admin navigates to Admin Dashboard → Audit Logs
2. Timeline/log list view appears showing recent changes:
   - Timestamp (most recent first)
   - Admin who made change
   - Action (Created, Updated, Deleted)
   - Resource (Card, Benefit, User Role)
   - Resource name/details
3. Admin can filter by:
   - Date range (from/to date pickers)
   - Action type (dropdown filter)
   - Resource type (dropdown filter)
   - Admin user (searchable dropdown)
   - Search box for resource name
4. Admin clicks log entry to view details
5. Detail modal shows:
   - Who: Admin user email
   - When: Timestamp with relative time
   - Where: IP address, user agent
   - What: Resource name, full resource ID
   - Before: Old values (JSON object displayed as table)
   - After: New values (JSON object displayed as table)
   - Diff view highlighting what changed
6. Admin can:
   - Export log to CSV (future)
   - Close detail view
```

---

### Flow 6: Data Deletion Safety

**Card Deletion Scenario:**
```
1. Admin clicks "Delete" on card
2. System checks: Are there UserCard records for this MasterCard?
3. If no user cards:
   - Confirmation: "Delete card [name]? This cannot be undone."
   - Options: "Cancel" or "Delete"
   - If confirm: DELETE executes, card removed, log created
4. If user cards exist:
   - Warning: "This card is used by X user(s). Delete anyway?"
   - Show list of users (if reasonable number)
   - Options: "Archive instead" or "Delete anyway"
   - If archive: isArchived=true, card hidden from catalog
   - If delete: Hard delete + log entry (data loss warning)
```

**Benefit Deletion Scenario:**
```
1. Admin clicks "Delete" on benefit
2. System checks: Are there UserBenefit records using this?
3. If no user benefits:
   - Simple confirmation: "Delete benefit?"
   - DELETE proceeds
4. If user benefits exist:
   - Warning: "This benefit is used by X benefit(s) on user cards"
   - Options: "Deactivate instead" or "Delete anyway"
   - If deactivate: isActive=false, benefit hidden from UI
   - If delete: Hard delete (will orphan UserBenefit records - add CASCADE)
```

---

## API Routes & Contracts

### Authentication & Authorization

All endpoints require:
1. Valid session token in secure cookie (verified by middleware)
2. User role = ADMIN (checked at route level)
3. All requests include audit context: IP address, user agent

**Unauthorized Response (401):**
```json
{
  "success": false,
  "error": "Not authenticated",
  "code": "AUTH_UNAUTHORIZED"
}
```

**Forbidden Response (403):**
```json
{
  "success": false,
  "error": "Admin access required",
  "code": "FORBIDDEN_ADMIN_REQUIRED"
}
```

---

### Card Management Endpoints

#### **GET /api/admin/cards** - List All Cards
```
Method: GET
Authentication: Required (Admin)
Rate Limit: 100 requests/minute per user

Query Parameters:
- page: number (default: 1, min: 1)
- limit: number (default: 20, min: 1, max: 100)
- issuer?: string (filter by issuer, case-insensitive)
- search?: string (search in cardName, issuer)
- isActive?: boolean (filter by active status)
- sortBy?: 'issuer' | 'cardName' | 'displayOrder' | 'updatedAt' (default: 'displayOrder')
- sortDirection?: 'asc' | 'desc' (default: 'asc')

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "card_123",
      "issuer": "Chase",
      "cardName": "Chase Sapphire Preferred",
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://cdn.example.com/cards/chase-sapphire.png",
      "displayOrder": 1,
      "isActive": true,
      "isArchived": false,
      "benefitCount": 8,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-20T14:30:00Z"
    },
    // ... more cards
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasMore": true
  }
}

Error 400:
{
  "success": false,
  "error": "Invalid pagination parameters",
  "code": "INVALID_PAGINATION"
}

Error 500:
{
  "success": false,
  "error": "Failed to fetch cards",
  "code": "SERVER_ERROR"
}
```

---

#### **GET /api/admin/cards/[id]** - Get Card Detail
```
Method: GET
Path: /api/admin/cards/:cardId
Authentication: Required (Admin)

Response 200:
{
  "success": true,
  "data": {
    "id": "card_123",
    "issuer": "Chase",
    "cardName": "Chase Sapphire Preferred",
    "defaultAnnualFee": 9500,
    "cardImageUrl": "https://cdn.example.com/cards/chase-sapphire.png",
    "displayOrder": 1,
    "isActive": true,
    "isArchived": false,
    "description": "Premium travel card with excellent benefits",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-20T14:30:00Z",
    "createdByAdminId": "admin_001",
    "benefits": [
      {
        "id": "benefit_123",
        "name": "Travel Insurance",
        "type": "INSURANCE",
        "stickerValue": 50000,
        "resetCadence": "ANNUAL",
        "isDefault": true,
        "isActive": true,
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      },
      // ... more benefits
    ],
    "userCardCount": 234  // How many users have this card
  }
}

Error 404:
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to fetch card",
  "code": "SERVER_ERROR"
}
```

---

#### **POST /api/admin/cards** - Create New Card
```
Method: POST
Authentication: Required (Admin)

Request Body:
{
  "issuer": "Amex",                    // required, string, max 100 chars
  "cardName": "American Express Gold", // required, string, max 200 chars
  "defaultAnnualFee": 29900,           // required, integer >= 0, cents
  "cardImageUrl": "https://cdn.example.com/cards/amex-gold.png", // required, valid URL
  "description": "Premium Gold card"   // optional, string, max 1000 chars
}

Response 201:
{
  "success": true,
  "data": {
    "id": "card_456",
    "issuer": "Amex",
    "cardName": "American Express Gold",
    "defaultAnnualFee": 29900,
    "cardImageUrl": "https://cdn.example.com/cards/amex-gold.png",
    "displayOrder": 0,
    "isActive": true,
    "isArchived": false,
    "createdAt": "2024-02-01T12:00:00Z",
    "updatedAt": "2024-02-01T12:00:00Z",
    "createdByAdminId": "admin_001"
  },
  "message": "Card created successfully"
}

Error 400 (Validation):
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "issuer",
      "message": "Issuer is required and must be a string"
    },
    {
      "field": "defaultAnnualFee",
      "message": "Annual fee must be a non-negative integer"
    }
  ]
}

Error 409 (Duplicate):
{
  "success": false,
  "error": "A card with this issuer and name already exists",
  "code": "DUPLICATE_CARD",
  "existingCardId": "card_123"
}

Error 400 (Invalid URL):
{
  "success": false,
  "error": "Card image URL is not accessible or invalid",
  "code": "INVALID_URL"
}

Error 500:
{
  "success": false,
  "error": "Failed to create card",
  "code": "SERVER_ERROR"
}
```

---

#### **PATCH /api/admin/cards/[id]** - Update Card
```
Method: PATCH
Path: /api/admin/cards/:cardId
Authentication: Required (Admin)

Request Body (all fields optional, only send what needs updating):
{
  "cardName": "Updated Card Name",     // optional
  "defaultAnnualFee": 15000,           // optional, >= 0
  "cardImageUrl": "https://...",       // optional, valid URL
  "description": "Updated description" // optional
  // Note: issuer cannot be changed (immutable)
}

Response 200:
{
  "success": true,
  "data": {
    "id": "card_123",
    "issuer": "Chase",
    "cardName": "Updated Card Name",
    "defaultAnnualFee": 15000,
    "cardImageUrl": "https://...",
    "displayOrder": 1,
    "isActive": true,
    "isArchived": false,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "Card updated successfully",
  "changes": {
    "cardName": {
      "old": "Chase Sapphire Preferred",
      "new": "Updated Card Name"
    },
    "defaultAnnualFee": {
      "old": 9500,
      "new": 15000
    }
  }
}

Error 400 (Validation):
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [...]
}

Error 409 (Duplicate Name):
{
  "success": false,
  "error": "A card with this issuer and name already exists",
  "code": "DUPLICATE_CARD"
}

Error 404:
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to update card",
  "code": "SERVER_ERROR"
}
```

---

#### **DELETE /api/admin/cards/[id]** - Delete Card
```
Method: DELETE
Path: /api/admin/cards/:cardId
Authentication: Required (Admin)

Query Parameters:
- force?: boolean (default: false, force delete even if user cards exist)
- archiveInstead?: boolean (default: false, soft delete)

Response 200 (Success):
{
  "success": true,
  "message": "Card deleted successfully",
  "data": {
    "id": "card_123",
    "issuer": "Chase",
    "cardName": "Chase Sapphire Preferred"
  }
}

Error 409 (Card in Use - if not forced):
{
  "success": false,
  "error": "Card cannot be deleted: it is used by X user(s)",
  "code": "CARD_IN_USE",
  "userCardCount": 42,
  "suggestion": "Archive the card instead or use force=true to delete anyway"
}

Error 404:
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to delete card",
  "code": "SERVER_ERROR"
}
```

---

### Benefit Management Endpoints

#### **GET /api/admin/cards/[id]/benefits** - List Benefits for Card
```
Method: GET
Path: /api/admin/cards/:cardId/benefits
Authentication: Required (Admin)

Query Parameters:
- page?: number (default: 1)
- limit?: number (default: 50)
- isActive?: boolean (filter)

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "benefit_123",
      "masterCardId": "card_123",
      "name": "Travel Insurance",
      "type": "INSURANCE",
      "stickerValue": 50000,
      "resetCadence": "ANNUAL",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z",
      "userBenefitCount": 234
    },
    // ... more benefits
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "limit": 50,
    "totalPages": 1,
    "hasMore": false
  }
}

Error 404:
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to fetch benefits",
  "code": "SERVER_ERROR"
}
```

---

#### **POST /api/admin/cards/[id]/benefits** - Create Benefit
```
Method: POST
Path: /api/admin/cards/:cardId/benefits
Authentication: Required (Admin)

Request Body:
{
  "name": "Travel Insurance",          // required, string, max 200 chars, unique per card
  "type": "INSURANCE",                 // required, enum: INSURANCE, CASHBACK, TRAVEL, BANKING, POINTS, OTHER
  "stickerValue": 50000,               // required, integer >= 0
  "resetCadence": "ANNUAL",            // required, enum: ANNUAL, PER_TRANSACTION, PER_DAY, MONTHLY, ONE_TIME
  "isDefault": true,                   // optional, boolean, default: true
  "description": "Trip protection"     // optional, string, max 1000 chars
}

Response 201:
{
  "success": true,
  "data": {
    "id": "benefit_456",
    "masterCardId": "card_123",
    "name": "Travel Insurance",
    "type": "INSURANCE",
    "stickerValue": 50000,
    "resetCadence": "ANNUAL",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2024-02-01T12:00:00Z",
    "updatedAt": "2024-02-01T12:00:00Z"
  },
  "message": "Benefit created successfully"
}

Error 400 (Validation):
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [...]
}

Error 409 (Duplicate Name):
{
  "success": false,
  "error": "A benefit with this name already exists for this card",
  "code": "DUPLICATE_BENEFIT"
}

Error 404:
{
  "success": false,
  "error": "Card not found",
  "code": "CARD_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to create benefit",
  "code": "SERVER_ERROR"
}
```

---

#### **PATCH /api/admin/cards/[id]/benefits/[benefitId]** - Update Benefit
```
Method: PATCH
Path: /api/admin/cards/:cardId/benefits/:benefitId
Authentication: Required (Admin)

Request Body (all optional):
{
  "name": "Updated Benefit Name",
  "type": "TRAVEL",
  "stickerValue": 75000,
  "resetCadence": "PER_TRANSACTION",
  "isDefault": false,
  "description": "Updated description"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "benefit_123",
    "masterCardId": "card_123",
    "name": "Updated Benefit Name",
    "type": "TRAVEL",
    "stickerValue": 75000,
    "resetCadence": "PER_TRANSACTION",
    "isDefault": false,
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "Benefit updated successfully",
  "changes": {
    "stickerValue": { "old": 50000, "new": 75000 },
    "isDefault": { "old": true, "new": false }
  }
}

Error 400, 404, 409, 500: Similar to POST endpoint
```

---

#### **DELETE /api/admin/cards/[id]/benefits/[benefitId]** - Delete Benefit
```
Method: DELETE
Path: /api/admin/cards/:cardId/benefits/:benefitId
Authentication: Required (Admin)

Query Parameters:
- force?: boolean (default: false)
- deactivateInstead?: boolean (default: false, soft delete)

Response 200:
{
  "success": true,
  "message": "Benefit deleted successfully"
}

Error 409 (In Use):
{
  "success": false,
  "error": "Benefit cannot be deleted: it is used by X user(s)",
  "code": "BENEFIT_IN_USE",
  "userBenefitCount": 15,
  "suggestion": "Deactivate instead or use force=true"
}

Error 404, 500: Similar to other endpoints
```

---

#### **PATCH /api/admin/cards/[id]/benefits/[benefitId]/toggle-default** - Toggle Default
```
Method: PATCH
Path: /api/admin/cards/:cardId/benefits/:benefitId/toggle-default
Authentication: Required (Admin)

Request Body:
{
  "isDefault": true  // Set to true or false
}

Response 200:
{
  "success": true,
  "data": {
    "id": "benefit_123",
    "isDefault": true,
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "Benefit default status updated"
}
```

---

### User & Role Management Endpoints

#### **GET /api/admin/users** - List Users
```
Method: GET
Authentication: Required (Admin)

Query Parameters:
- page?: number (default: 1)
- limit?: number (default: 50, max: 100)
- role?: 'USER' | 'ADMIN' (filter)
- search?: string (search by email/name)
- isActive?: boolean (filter)

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2024-01-01T10:00:00Z",
      "lastLoginAt": "2024-02-01T15:00:00Z"
    },
    {
      "id": "user_456",
      "email": "regular@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "role": "USER",
      "isActive": true,
      "createdAt": "2024-01-10T10:00:00Z",
      "lastLoginAt": "2024-01-29T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 1250,
    "page": 1,
    "limit": 50,
    "totalPages": 25,
    "hasMore": true
  }
}

Error 500:
{
  "success": false,
  "error": "Failed to fetch users",
  "code": "SERVER_ERROR"
}
```

---

#### **PATCH /api/admin/users/[userId]/role** - Assign/Remove Admin Role
```
Method: PATCH
Path: /api/admin/users/:userId/role
Authentication: Required (Admin)

Request Body:
{
  "role": "ADMIN"  // or "USER" to remove admin
}

Response 200:
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "ADMIN",
    "updatedAt": "2024-02-01T15:00:00Z"
  },
  "message": "User role updated to ADMIN"
}

Error 400 (Self-Demotion):
{
  "success": false,
  "error": "Cannot remove your own admin role",
  "code": "CANNOT_SELF_DEMOTE"
}

Error 404:
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to update user role",
  "code": "SERVER_ERROR"
}
```

---

### Audit Log Endpoints

#### **GET /api/admin/audit-logs** - List Audit Logs
```
Method: GET
Authentication: Required (Admin)

Query Parameters:
- page?: number (default: 1)
- limit?: number (default: 50, max: 100)
- actionType?: 'CREATE' | 'UPDATE' | 'DELETE' (filter)
- resourceType?: 'CARD' | 'BENEFIT' | 'USER_ROLE' (filter)
- adminUserId?: string (filter by admin who made change)
- resourceId?: string (filter by specific resource)
- startDate?: ISO 8601 (filter by date range)
- endDate?: ISO 8601
- search?: string (search resource names)

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "log_123",
      "actionType": "CREATE",
      "resourceType": "CARD",
      "resourceId": "card_456",
      "resourceName": "American Express Gold",
      "adminUserId": "admin_001",
      "adminEmail": "admin@example.com",
      "timestamp": "2024-02-01T12:00:00Z",
      "ipAddress": "192.168.1.1",
      "oldValues": null,
      "newValues": {
        "issuer": "Amex",
        "cardName": "American Express Gold",
        "defaultAnnualFee": 29900
      }
    },
    {
      "id": "log_124",
      "actionType": "UPDATE",
      "resourceType": "BENEFIT",
      "resourceId": "benefit_789",
      "resourceName": "Travel Insurance",
      "adminUserId": "admin_002",
      "adminEmail": "another@example.com",
      "timestamp": "2024-02-01T14:30:00Z",
      "ipAddress": "192.168.1.50",
      "oldValues": {
        "stickerValue": 50000,
        "isDefault": true
      },
      "newValues": {
        "stickerValue": 75000,
        "isDefault": false
      }
    }
  ],
  "pagination": {
    "total": 5432,
    "page": 1,
    "limit": 50,
    "totalPages": 109,
    "hasMore": true
  }
}

Error 400:
{
  "success": false,
  "error": "Invalid date format",
  "code": "INVALID_DATE_FORMAT"
}

Error 500:
{
  "success": false,
  "error": "Failed to fetch audit logs",
  "code": "SERVER_ERROR"
}
```

---

#### **GET /api/admin/audit-logs/[id]** - Get Audit Log Detail
```
Method: GET
Path: /api/admin/audit-logs/:logId
Authentication: Required (Admin)

Response 200:
{
  "success": true,
  "data": {
    "id": "log_123",
    "actionType": "UPDATE",
    "resourceType": "CARD",
    "resourceId": "card_123",
    "resourceName": "Chase Sapphire Preferred",
    "adminUserId": "admin_001",
    "adminUser": {
      "id": "admin_001",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "timestamp": "2024-02-01T15:00:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "oldValues": {
      "defaultAnnualFee": 9500,
      "cardImageUrl": "https://old-url.com/card.png"
    },
    "newValues": {
      "defaultAnnualFee": 15000,
      "cardImageUrl": "https://new-url.com/card.png"
    },
    "changes": [
      {
        "field": "defaultAnnualFee",
        "old": 9500,
        "new": 15000
      },
      {
        "field": "cardImageUrl",
        "old": "https://old-url.com/card.png",
        "new": "https://new-url.com/card.png"
      }
    ]
  }
}

Error 404:
{
  "success": false,
  "error": "Audit log not found",
  "code": "AUDIT_LOG_NOT_FOUND"
}

Error 500:
{
  "success": false,
  "error": "Failed to fetch audit log",
  "code": "SERVER_ERROR"
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: Concurrent Card Edits
**Scenario:** Two admins edit the same card simultaneously
- **Current Behavior:** Last-write-wins (simple, acceptable for now)
- **Better Approach (Future):** Optimistic locking with version numbers
- **Implementation:** Add `version` field to MasterCard, check in PATCH, return 409 if stale
- **UI Handling:** Show "This card was updated. Please reload." message

---

### Edge Case 2: Deleting Card Used by Many Users
**Scenario:** Admin attempts to delete a master card used by 500+ users
- **Current Handling:** Return 409 with user count
- **UI Shows:** "This card is used by 523 users. Archive instead?"
- **Best Practice:** Provide archive option (soft delete) instead of hard deletion
- **Implementation:** Set `isArchived=true`, card hidden from new adds but existing user cards persist

---

### Edge Case 3: Benefit Default Flag Change Impact
**Scenario:** Admin removes "is default" flag from popular benefit
- **Impact:** Only new user cards added after change will not have this benefit
- **Existing Cards:** Unaffected, users keep the benefit
- **Implementation:** Flag only affects benefit creation, not existing benefits

---

### Edge Case 4: Admin Role Revocation Mid-Request
**Scenario:** Admin's role is removed while they're in the middle of editing a card
- **Detection:** Middleware checks role on every request
- **Handling:** Return 403 "Admin access required"
- **UI Behavior:** Redirect to dashboard, show "Your admin access was revoked"

---

### Edge Case 5: Invalid Card Image URL
**Scenario:** Admin provides URL that returns 404 or is unreachable
- **Detection:** Validate URL accessibility during card creation
- **Options:**
  1. Strict: Reject card creation with error message
  2. Lenient: Warn but allow creation
  3. Deferred: Create card, periodically check URL health
- **Recommended:** Strict approach with helpful error message

---

### Edge Case 6: Duplicate Benefit Names Within Same Card
**Scenario:** Admin tries to create benefit with name that already exists for card
- **Detection:** Unique constraint on (masterCardId, name)
- **Handling:** Return 409 with existing benefit ID
- **UI:** Show "This benefit already exists: [link to edit]"

---

### Edge Case 7: Race Condition on Card Unique Constraint
**Scenario:** Two admins simultaneously create cards with same (issuer, cardName)
- **Detection:** Database unique constraint catches this
- **Handling:** Second request returns 409
- **Mitigation:** First-write-wins, check on client before submit

---

### Edge Case 8: Admin User Lists Are Very Large
**Scenario:** System has 100,000+ users, admin searches for user by email
- **Handling:** Pagination with search index on email
- **Implementation:** 
  - Pagination enforced (max 100 per page)
  - Search queries use indexed columns
  - Consider full-text search for larger deployments

---

### Edge Case 9: Circular Dependency Prevention
**Scenario:** Hypothetical future where benefits could reference other benefits
- **Prevention:** Don't implement complex relationships without explicit design
- **Current State:** Benefits are independent per card, no circular deps possible

---

### Edge Case 10: Audit Log Storage Limits
**Scenario:** Audit logs grow to millions of records
- **Handling:** Implement retention policy (e.g., 2 years)
- **Implementation:**
  - Archive old logs to separate table or storage
  - Cron job to archive logs older than 2 years
  - Keep recent logs (< 2 years) in primary table for fast queries

---

### Edge Case 11: Self-Demotion Prevention
**Scenario:** Admin tries to remove their own admin role
- **Prevention Level 1 (UI):** Disable "Remove Admin" button for self
- **Prevention Level 2 (API):** Return 400 error "Cannot demote yourself"
- **Implementation:** Check if `userId === adminUserId` before allowing demotion

---

### Edge Case 12: Bulk Operations & Performance
**Scenario:** Admin wants to update 50 cards at once
- **Current Implementation:** Single updates only (one-by-one API calls)
- **Future Enhancement:** Batch update endpoint
- **For Now:** Accept individual updates, optimize UI with loading states

---

## Component Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Admin Dashboard UI                          │
│  (React Components + Tailwind CSS + shadcn/ui)                 │
├─────────────────────────────────────────────────────────────────┤
│ - AdminLayout (sidebar navigation)                              │
│ - CardsSection (list, create, edit, delete)                    │
│ - BenefitsSection (per-card benefit mgmt)                       │
│ - UsersSection (role assignment)                                │
│ - AuditLogsSection (view audit trail)                           │
│ - Modals (forms, confirmations)                                 │
│ - Notifications (toasts)                                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   API Layer (Next.js Routes)                    │
│  /api/admin/cards                                               │
│  /api/admin/cards/[id]                                          │
│  /api/admin/cards/[id]/benefits                                 │
│  /api/admin/users                                               │
│  /api/admin/users/[id]/role                                     │
│  /api/admin/audit-logs                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Business Logic Layer                           │
│ - Validation (schema validation)                                │
│ - Authorization (admin role checking)                           │
│ - Audit Logging (create audit entries)                          │
│ - Transaction Handling (multi-step operations)                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Data Access Layer (Prisma)                     │
│ - MasterCard CRUD                                               │
│ - MasterBenefit CRUD                                            │
│ - User role updates                                             │
│ - AdminAuditLog writes                                          │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                            │
│ - User (role: ADMIN)                                            │
│ - MasterCard (with displayOrder, isArchived)                    │
│ - MasterBenefit (with isDefault, isActive)                      │
│ - AdminAuditLog (comprehensive audit trail)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### Component Breakdown

#### 1. **AdminLayout Component**
- **Purpose:** Provide consistent navigation and layout for all admin pages
- **Props:** `{ children: React.ReactNode }`
- **Features:**
  - Sidebar with nav links (Dashboard, Cards, Users, Audit Logs, Settings)
  - Header with user info and logout button
  - Main content area for page content
  - Mobile responsive (hamburger menu on small screens)

#### 2. **CardsListSection Component**
- **Purpose:** Display, search, and manage master cards
- **Props:** None (uses React Query for data fetching)
- **Features:**
  - Table view with columns: Issuer, Card Name, Annual Fee, Benefits Count, Actions
  - Pagination controls
  - Search/filter by issuer or card name
  - Action buttons: View Details, Edit, Delete
  - "Create New Card" button
  - Loading and error states

#### 3. **CardFormModal Component**
- **Purpose:** Modal form for creating/editing cards
- **Props:** `{ card?: MasterCard, isOpen: boolean, onClose: () => void, onSubmit: (data) => Promise<void> }`
- **Features:**
  - Form fields: Issuer, Card Name, Annual Fee, Image URL, Description
  - Real-time validation
  - Submit button disabled until valid
  - Loading state during submission
  - Error display inline

#### 4. **DeleteCardModal Component**
- **Purpose:** Confirmation dialog for card deletion
- **Props:** `{ card: MasterCard, isOpen: boolean, onConfirm: () => Promise<void>, onCancel: () => void }`
- **Features:**
  - Shows card details
  - If card in use: shows user count, offers archive option
  - If not in use: simple confirmation
  - Cancel and Confirm buttons

#### 5. **CardDetailView Component**
- **Purpose:** Show complete card details including benefits
- **Props:** `{ cardId: string }`
- **Features:**
  - Card information display
  - Benefits list with actions
  - Edit/Delete buttons
  - Add Benefit button
  - Back to list navigation

#### 6. **BenefitsTable Component**
- **Purpose:** Display and manage benefits for a card
- **Props:** `{ cardId: string, benefits: MasterBenefit[] }`
- **Features:**
  - Table with columns: Name, Type, Value, Cadence, Default, Actions
  - Add Benefit button
  - Edit and Delete buttons for each benefit
  - Default checkbox toggle
  - Loading states

#### 7. **BenefitFormModal Component**
- **Purpose:** Modal form for creating/editing benefits
- **Props:** `{ cardId: string, benefit?: MasterBenefit, isOpen: boolean, onClose: () => void }`
- **Features:**
  - Form fields: Name, Type (dropdown), Value, Cadence (dropdown), Default checkbox, Description
  - Validation
  - Submit button states

#### 8. **UsersListSection Component**
- **Purpose:** Display users and manage admin roles
- **Props:** None (uses React Query)
- **Features:**
  - User table with columns: Email, Name, Role, Last Login, Actions
  - Search by email/name
  - Pagination
  - Role assignment dropdown or button
  - "Promote to Admin" / "Remove Admin" buttons

#### 9. **AuditLogSection Component**
- **Purpose:** View comprehensive audit trail of all admin actions
- **Props:** None
- **Features:**
  - Timeline/list of audit log entries
  - Filter by: Date range, Action type, Resource type, Admin user
  - Search by resource name
  - Click to view full details
  - Pagination

#### 10. **AuditLogDetailModal Component**
- **Purpose:** Show detailed view of single audit log entry
- **Props:** `{ log: AdminAuditLog, isOpen: boolean, onClose: () => void }`
- **Features:**
  - Admin who made change
  - Timestamp and IP address
  - What changed (before/after values)
  - Diff highlighting

---

### Middleware & Hooks

#### **useAdminAuth Hook**
- **Purpose:** Check admin status and handle unauthorized access
- **Usage:** `const { isAdmin, userId, logout } = useAdminAuth()`
- **Behavior:** Redirects to login if not authenticated, redirects to dashboard if not admin

#### **useAdminCards Hook**
- **Purpose:** Fetch and manage master cards
- **Usage:** `const { cards, loading, error, createCard, updateCard, deleteCard } = useAdminCards()`
- **Features:** Caching, mutation handling, error states

#### **usePagination Hook**
- **Purpose:** Handle pagination state for lists
- **Usage:** `const { page, limit, setPage, totalPages } = usePagination()`

---

### Middleware Protection

#### **Admin Route Guard Middleware**
- **Purpose:** Protect /admin/* routes from non-admin access
- **Implementation:**
  1. Middleware extracts JWT from cookie
  2. Verifies JWT signature
  3. Checks user role in database
  4. If role !== ADMIN: return 401/403
  5. If valid: sets x-user-id header, allows request

---

## Implementation Tasks

### Phase 1: Database & Authentication (2-3 days)

| Task ID | Title | Description | Complexity | Dependencies |
|---------|-------|-------------|-----------|--------------|
| DB-1 | Add role field to User model | Update Prisma schema: add `role` enum field (default: USER) and `isActive` field | Small | None |
| DB-2 | Create AdminAuditLog table | Create new Prisma model with all audit fields (admin, action, resource, changes) | Medium | DB-1 |
| DB-3 | Run migrations | Execute `prisma migrate dev` and seed test data | Small | DB-2 |
| AUTH-1 | Extend auth context | Add admin role to AuthContext, make available to route handlers | Small | DB-1 |
| AUTH-2 | Create admin role check utility | Build `requireAdminRole()` helper function | Small | AUTH-1 |
| AUTH-3 | Update middleware for admin routes | Modify middleware to protect /admin/* routes with role check | Medium | AUTH-2 |
| MIDDLEWARE-1 | Add audit logging helper | Create `logAdminAction()` function to record changes | Medium | DB-2 |

---

### Phase 2: API Layer (3-4 days)

| Task ID | Title | Description | Complexity | Dependencies |
|---------|-------|-------------|-----------|--------------|
| API-CARDS-1 | GET /api/admin/cards | List all cards with pagination, search, filtering | Medium | AUTH-3 |
| API-CARDS-2 | GET /api/admin/cards/[id] | Get card detail with benefits included | Small | AUTH-3 |
| API-CARDS-3 | POST /api/admin/cards | Create new card with validation, unique constraint check, audit log | Medium | AUTH-3, MIDDLEWARE-1 |
| API-CARDS-4 | PATCH /api/admin/cards/[id] | Update card properties, track changes for audit log | Medium | AUTH-3, MIDDLEWARE-1 |
| API-CARDS-5 | DELETE /api/admin/cards/[id] | Delete card with user count check, soft/hard delete options | Medium | AUTH-3, MIDDLEWARE-1 |
| API-CARDS-6 | PATCH /api/admin/cards/reorder | Bulk reorder cards by displayOrder | Small | AUTH-3 |
| API-BENEFITS-1 | GET /api/admin/cards/[id]/benefits | List benefits for card with pagination | Small | AUTH-3 |
| API-BENEFITS-2 | POST /api/admin/cards/[id]/benefits | Create benefit with unique name check | Medium | AUTH-3, MIDDLEWARE-1 |
| API-BENEFITS-3 | PATCH /api/admin/cards/[id]/benefits/[id] | Update benefit properties | Small | AUTH-3, MIDDLEWARE-1 |
| API-BENEFITS-4 | DELETE /api/admin/cards/[id]/benefits/[id] | Delete benefit with usage check | Small | AUTH-3, MIDDLEWARE-1 |
| API-BENEFITS-5 | PATCH /api/admin/cards/[id]/benefits/[id]/toggle-default | Toggle default flag | Small | AUTH-3, MIDDLEWARE-1 |
| API-USERS-1 | GET /api/admin/users | List users with role, pagination, search | Medium | AUTH-3 |
| API-USERS-2 | PATCH /api/admin/users/[id]/role | Assign/remove admin role, prevent self-demotion | Medium | AUTH-3, MIDDLEWARE-1 |
| API-AUDIT-1 | GET /api/admin/audit-logs | List audit logs with filtering by date, action, resource, admin | Large | AUTH-3 |
| API-AUDIT-2 | GET /api/admin/audit-logs/[id] | Get audit log detail with before/after values | Small | AUTH-3 |
| TEST-API | Unit/integration tests for all API endpoints | Minimum 80% code coverage | Large | All API tasks |

---

### Phase 3: Admin Dashboard UI (4-5 days)

| Task ID | Title | Description | Complexity | Dependencies |
|---------|-------|-------------|-----------|--------------|
| UI-LAYOUT-1 | Create AdminLayout component | Sidebar nav, header, main content area | Medium | API-CARDS-1, AUTH-1 |
| UI-LAYOUT-2 | Build admin page structure | Dashboard, Cards page, Users page, Audit page | Small | UI-LAYOUT-1 |
| UI-CARDS-1 | Create CardsListSection component | Table view, pagination, search, action buttons | Large | API-CARDS-1 |
| UI-CARDS-2 | Build CardFormModal component | Create/edit form with validation | Medium | API-CARDS-3, API-CARDS-4 |
| UI-CARDS-3 | Build DeleteCardModal component | Delete confirmation with safety checks | Medium | API-CARDS-5 |
| UI-CARDS-4 | Create CardDetailView component | Detail page showing card + benefits | Medium | API-CARDS-2, API-BENEFITS-1 |
| UI-BENEFITS-1 | Build BenefitsTable component | Benefits list with add/edit/delete actions | Large | API-BENEFITS-1 |
| UI-BENEFITS-2 | Create BenefitFormModal component | Create/edit benefit form | Medium | API-BENEFITS-2, API-BENEFITS-3 |
| UI-BENEFITS-3 | Build DeleteBenefitModal component | Delete benefit confirmation | Small | API-BENEFITS-4 |
| UI-USERS-1 | Create UsersListSection component | User table with role column, search, pagination | Medium | API-USERS-1 |
| UI-USERS-2 | Build RoleAssignmentDialog component | Confirm role change, prevent self-demotion | Small | API-USERS-2 |
| UI-AUDIT-1 | Create AuditLogSection component | Timeline/list of audit entries, filters | Large | API-AUDIT-1 |
| UI-AUDIT-2 | Build AuditLogDetailModal component | Detail view with before/after, diff | Medium | API-AUDIT-2 |
| UI-COMMON-1 | Create reusable components | Confirmation dialog, form validation, toasts, spinners | Medium | None |
| UI-HOOKS-1 | Build custom React hooks | useAdminAuth, useAdminCards, usePagination, useFetch | Medium | None |
| UI-E2E-1 | E2E tests for critical flows | Create card, edit card, assign admin role | Medium | All UI components |
| UI-POLISH-1 | Responsive design & accessibility | Mobile testing, ARIA labels, keyboard nav | Medium | All UI components |

---

### Phase 4: Testing, Validation & Polish (2-3 days)

| Task ID | Title | Description | Complexity | Dependencies |
|---------|-------|-------------|-----------|--------------|
| TEST-UNIT-1 | Write utility function tests | Test validation, audit logging, role checks | Medium | All Phase 2 tasks |
| TEST-SECURITY-1 | Security testing | SQL injection, XSS, CSRF, unauthorized access | Large | All APIs, UI |
| TEST-PERF-1 | Performance testing | Load test with large datasets | Medium | All APIs |
| TEST-EDGE-1 | Edge case testing | Concurrent edits, race conditions, data consistency | Medium | All APIs |
| DOC-API-1 | API documentation | OpenAPI/Swagger format for all endpoints | Small | All APIs |
| DOC-USER-1 | Admin user guide | How-to guide for managing cards and benefits | Small | All UI |
| DOC-DEPLOY-1 | Deployment runbook | Steps to deploy feature to production | Small | All tasks |
| POLISH-1 | UI refinement | Visual improvements, error state handling | Small | All UI |
| POLISH-2 | Performance optimization | Lazy loading, pagination, caching | Medium | All UI |
| REVIEW-1 | Code review & feedback | Full feature code review | Medium | All tasks |

---

## Security & Compliance Considerations

### Authentication & Authorization

1. **Admin Route Protection:**
   - All `/admin/*` routes require valid JWT session
   - Middleware verifies: JWT signature, session validity, user role = ADMIN
   - Failed checks return 401 (auth) or 403 (forbidden)
   - Session revocation effective immediately

2. **Role-Based Access Control (RBAC):**
   - User model includes `role` enum (USER or ADMIN)
   - Every admin endpoint checks: `getAdminRole() === ADMIN`
   - Super admin role reserved for future use
   - Regular users cannot see admin pages or endpoints

3. **Session Management:**
   - HttpOnly cookies prevent XSS token theft
   - SameSite=Strict prevents CSRF
   - Tokens expire after set duration
   - Database check on every request enables revocation

### Data Protection & Privacy

1. **Sensitive Data in Audit Logs:**
   - Audit logs store old/new values (JSON format)
   - Do NOT log passwords or sensitive user data
   - Limit audit log access to admins only
   - Implement retention policy (2-year archive)

2. **Admin Action Tracking:**
   - Every data change attributed to specific admin
   - IP address and user agent logged for forensics
   - Timestamp recorded for timeline reconstruction

3. **Immutable Audit Trail:**
   - Audit logs cannot be modified or deleted
   - Write-once to prevent tampering
   - Implement database-level write protection

### Input Validation & Sanitization

1. **API-Level Validation:**
   - All inputs validated against schema before database write
   - Reject oversized inputs (field length limits)
   - Validate enum values strictly
   - Sanitize URLs before storage

2. **Database-Level Constraints:**
   - Unique constraints on (issuer, cardName)
   - Unique constraints on (cardId, benefitName)
   - Foreign key constraints with CASCADE delete
   - NOT NULL constraints on required fields

3. **Output Sanitization:**
   - No sensitive data in error messages
   - Pagination params sanitized
   - Search terms escaped to prevent injection

### Audit & Compliance

1. **Comprehensive Audit Logging:**
   - Every CRUD operation logged
   - Action type: CREATE, UPDATE, DELETE
   - Resource type: CARD, BENEFIT, USER_ROLE
   - Before/after values for change tracking
   - Admin user, timestamp, IP address

2. **Audit Log Retention:**
   - Keep recent logs in hot storage (2 years)
   - Archive older logs to cold storage
   - Cron job to automate archival
   - Prevent accidental/malicious log deletion

3. **Compliance Reports:**
   - Admin action report (who changed what when)
   - Change audit trail (before/after values)
   - User role change history
   - Future: Export audit logs for compliance audits

---

## Performance & Scalability Considerations

### Expected Load & Growth

| Metric | Value | Rationale |
|--------|-------|-----------|
| Concurrent Admins | 1-10 | Typically 1-5 at any time |
| Admin Requests/Sec | 5-20 | CRUD operations, not high frequency |
| Data Size | 1000 cards, 50k benefits, 100k users | Reasonable for credit card catalog |
| Audit Log Growth | 100-500 entries/day | Modest rate, easily archivable |

### Caching Strategies

1. **Card Catalog Caching:**
   - Cache master card list at application startup
   - 5-minute TTL, invalidate on any change
   - Use React Query for client-side caching
   - CDN cache for card images (separate concern)

2. **User Role Caching:**
   - Cache user role in JWT or session
   - Verify role on every request (not from cache)
   - Role changes take effect immediately

3. **Audit Log Caching:**
   - No caching for audit logs (consistency critical)
   - Query database directly every time
   - Use indexes for fast queries

### Database Optimization

1. **Indexing Strategy:**
   - User: email, role, isActive (auth lookups)
   - AdminAuditLog: adminUserId, actionType, resourceType, timestamp (filter queries)
   - MasterCard: issuer, cardName, displayOrder, isActive (catalog queries)
   - MasterBenefit: masterCardId, type, isDefault (benefit queries)

2. **Query Optimization:**
   - Use `findMany()` with `include` to fetch related data in single query
   - Pagination for large result sets (max 100 per page)
   - Use database-level filtering before application code
   - Avoid N+1 queries with proper eager loading

3. **Connection Pooling:**
   - Prisma manages connection pool
   - Max pool size: 5 (production), adjust based on load
   - Monitor connection usage via metrics

### Rate Limiting

1. **Admin API Rate Limits:**
   - 100 requests/minute per admin user
   - Per-endpoint limits for sensitive operations:
     - DELETE endpoints: 10 req/min (prevent accidental mass deletion)
     - POST endpoints: 30 req/min (prevent spam creation)
   - Use Redis for distributed rate limiting

2. **Implementation:**
   - Apply rate limiting middleware to all /api/admin/* routes
   - Return 429 (Too Many Requests) when limit exceeded
   - Include retry-after header in response

---

## Success Criteria

### Feature Completeness
- ✅ All CRUD operations for cards, benefits, users working
- ✅ Admin dashboard UI is responsive and intuitive
- ✅ Role-based access control functional and tested
- ✅ Audit logging comprehensive and accurate

### Performance Targets
- ✅ Card list loads in < 500ms (p95)
- ✅ Card creation completes in < 1000ms (p95)
- ✅ Audit log search returns results in < 1000ms (p95)
- ✅ Admin dashboard renders in < 2000ms (p95)

### Code Quality
- ✅ Minimum 80% test coverage for APIs
- ✅ No TypeScript errors or warnings
- ✅ All code follows project style guide
- ✅ Zero security vulnerabilities in dependency scan

### Verification Checklist

**Database:**
- [ ] Prisma migrations executed successfully
- [ ] AdminAuditLog table created with all fields
- [ ] User table includes role field with default
- [ ] Test data seeded for development

**API Layer:**
- [ ] All GET endpoints return correct data structures
- [ ] All POST endpoints create records and log audit entries
- [ ] All PATCH endpoints update and log changes
- [ ] All DELETE endpoints handle safety checks
- [ ] All endpoints validate inputs and return proper error codes
- [ ] Admin role checked on every request
- [ ] Audit logs created for every change

**UI/UX:**
- [ ] Admin dashboard accessible at /admin
- [ ] Cards management section functional (CRUD)
- [ ] Benefits management section functional (CRUD)
- [ ] Users section shows all users, role assignment works
- [ ] Audit log viewer shows filtered logs with details
- [ ] Forms validate inputs before submission
- [ ] Confirmation dialogs prevent accidental deletion
- [ ] Error and success notifications display correctly
- [ ] Mobile responsive design working
- [ ] Accessibility: ARIA labels, keyboard navigation

**Security:**
- [ ] Non-admins cannot access /admin routes (401)
- [ ] Non-admins cannot call admin APIs (403)
- [ ] Audit logs cannot be modified by anyone
- [ ] Session invalidation revokes access immediately
- [ ] CSRF protection active on all state-changing operations
- [ ] XSS prevention in form inputs and display
- [ ] SQL injection prevention through parameterized queries

**Operations:**
- [ ] Deployment runbook completed
- [ ] API documentation generated (Swagger/OpenAPI)
- [ ] Admin user guide created
- [ ] Error handling covers edge cases
- [ ] Monitoring/alerting configured for admin operations

---

## Technical Debt & Future Enhancements

### Potential Future Improvements

1. **Optimistic Locking:** Add version numbers to prevent concurrent update conflicts
2. **Bulk Operations:** Batch create/update/delete for multiple cards/benefits
3. **Scheduled Tasks:** Auto-archive old audit logs, health checks
4. **Advanced Filtering:** Full-text search on card descriptions, benefits
5. **Export Functionality:** Download audit logs as CSV, card catalog as spreadsheet
6. **Webhooks:** Notify external systems when card data changes
7. **Two-Factor Authentication:** Require 2FA for admin accounts
8. **Admin Activity Dashboard:** Analytics on admin usage patterns
9. **Card Image Gallery:** Upload and manage card images through UI
10. **Benefit Templates:** Reusable benefit templates for common types

---

## Conclusion

This technical specification provides a comprehensive blueprint for implementing the Admin Management feature in the Card-Benefits application. The design prioritizes:

- **Security:** Role-based access control, comprehensive audit logging, input validation
- **Data Integrity:** Unique constraints, transactions, soft deletes, referential integrity
- **User Experience:** Intuitive UI, clear error messages, safety confirmations
- **Scalability:** Proper indexing, pagination, caching strategies
- **Maintainability:** Clear component architecture, documented APIs, test coverage

The implementation can proceed in phases, with each phase building on the previous one. The modular architecture allows parallel development of API and UI components. All edge cases have been identified and documented with handling strategies.

---

**Document Version:** 1.0  
**Last Updated:** February 2024  
**Status:** Ready for Implementation
