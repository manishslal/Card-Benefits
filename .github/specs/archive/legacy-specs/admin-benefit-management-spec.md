# Admin Benefit Management System - Technical Specification

**Version:** 1.0  
**Date:** 2024  
**Status:** Ready for Implementation  
**Priority:** High

---

## Executive Summary & Goals

The Admin Benefit Management System extends the Card-Benefits application with comprehensive role-based access control (RBAC) that enables administrators to manage the master card database, including creating, editing, deleting, and deactivating benefits. Currently, the system has 10 master cards with 44 benefits, but no administrative interface or permission system. This specification defines a complete admin management layer with full audit trails, concurrent edit protection, and granular permission controls.

### Primary Objectives

1. **Enable Role-Based Access Control** - Implement admin, editor, and viewer roles with permission inheritance
2. **Provide Benefit Management Interface** - Create API endpoints and UI for CRUD operations on master benefits
3. **Implement Audit Trail System** - Track all changes to benefits with user, timestamp, and change details
4. **Protect Data Integrity** - Prevent concurrent edits, validate all inputs, and provide soft-delete capability
5. **Enable Batch Operations** - Allow bulk updates to multiple benefits with transaction safety
6. **Provide Admin Dashboard** - Build a responsive admin interface for benefit viewing, searching, filtering, and editing

### Success Criteria

- ✓ All admin endpoints require valid JWT token + admin role verification
- ✓ Non-admins receive 403 Forbidden response when accessing admin routes
- ✓ All benefit modifications are audited with complete change history
- ✓ Admin dashboard is fully responsive (desktop, tablet, mobile)
- ✓ Search/filter functionality returns results in <500ms
- ✓ Concurrent edits are detected and handled gracefully
- ✓ All endpoints include proper input validation and error handling
- ✓ Database migrations preserve existing data and allow rollback
- ✓ Test coverage >90% for admin functionality
- ✓ Zero data loss during deployment

---

## Functional Requirements

### Core Features

#### 1. Role Management
- **Admin Role**: Full access to all master cards and benefits; can manage other admins
- **Editor Role**: Can create, read, update, and deactivate benefits (no delete); cannot modify existing admins
- **Viewer Role**: Read-only access to master cards, benefits, and audit logs
- **User Role**: No admin access (existing behavior); limited to their own user cards

#### 2. Benefit Management
- View all master benefits with filters (card, type, reset cadence, status)
- Edit benefit properties: name, type, stickerValue, resetCadence, description
- Create new benefits for existing master cards
- Soft-delete benefits (mark as inactive, preserve history)
- Restore previously deleted benefits
- Bulk operations: update multiple benefits, bulk status changes

#### 3. Audit & Compliance
- Complete audit trail for all benefit modifications
- Track: who, what, when, old value, new value, reason (optional)
- Audit log viewer with filters (user, date range, benefit, action type)
- Export audit logs to CSV

#### 4. Data Integrity & Safety
- Version tracking for all master benefits (for conflict detection)
- Concurrent edit detection with optimistic locking
- Change preview before commit
- Rollback capability to previous versions
- Soft-delete with restore functionality

### User Roles & Permissions Matrix

| Action | Admin | Editor | Viewer | User |
|--------|-------|--------|--------|------|
| View Master Cards | ✓ | ✓ | ✓ | ✗ |
| View Master Benefits | ✓ | ✓ | ✓ | ✗ |
| Create Benefit | ✓ | ✓ | ✗ | ✗ |
| Edit Benefit | ✓ | ✓ | ✗ | ✗ |
| Delete Benefit | ✓ | ✗ | ✗ | ✗ |
| View Audit Log | ✓ | ✓ | ✓ | ✗ |
| Manage Admins | ✓ | ✗ | ✗ | ✗ |
| Export Audit Log | ✓ | ✓ | ✗ | ✗ |
| Manage Ranges/Thresholds | ✓ | ✓ | ✗ | ✗ |

### System Constraints & Limits

- **Max benefit name length**: 255 characters
- **Max benefit description**: 2000 characters
- **Max stickerValue**: 999,999 (in cents)
- **Bulk operation limit**: 500 benefits per request
- **Audit log retention**: 7 years (compliance requirement)
- **Rate limiting**: 100 admin API requests per minute per admin user
- **Concurrent edit timeout**: 5 minutes (after which lock is released)
- **Session timeout**: 1 hour for admin users (30 min inactivity)

---

## Implementation Phases

### Phase 1: Core Data Model & Authentication (Weeks 1-2)
**Objective**: Add role/permission data structures and extend authentication

**Key Deliverables:**
- User table extended with role, permissions, and admin metadata
- AdminAction audit table created with full change tracking
- Permission table for fine-grained access control
- Database migrations for existing data (set all current users to User role)

**Scope**: Data layer foundation, no API or UI yet

**Dependencies**: None (foundation phase)

---

### Phase 2: API Layer - Benefit Management (Weeks 2-3)
**Objective**: Implement all CRUD endpoints and audit logging

**Key Deliverables:**
- Endpoints for benefit CRUD operations
- Audit logging middleware/service
- Permission checking middleware
- Rate limiting for admin routes
- Batch operation endpoints
- Admin analytics endpoints

**Scope**: All API routes, business logic, database operations

**Dependencies**: Phase 1 (data model)

---

### Phase 3: Admin Dashboard Frontend (Weeks 3-4)
**Objective**: Build responsive admin interface

**Key Deliverables:**
- Admin dashboard layout and navigation
- Benefit list view with search/filter
- Benefit edit form with validation
- Audit log viewer
- Responsive design (desktop, tablet, mobile)

**Scope**: React components, forms, state management, UI/UX

**Dependencies**: Phase 2 (API endpoints)

---

### Phase 4: Testing & Quality Assurance (Weeks 4-5)
**Objective**: Comprehensive testing across all layers

**Key Deliverables:**
- Unit tests for permission logic (>95% coverage)
- Integration tests for API endpoints
- End-to-end tests for admin workflows
- Security testing (authorization bypass attempts)
- Performance testing (query optimization)

**Scope**: Test suite, QA verification

**Dependencies**: Phase 2 & 3 (all features complete)

---

### Phase 5: Deployment & Monitoring (Weeks 5-6)
**Objective**: Safely deploy to production with monitoring

**Key Deliverables:**
- Database migration strategy and testing
- Deployment checklist and runbook
- Monitoring dashboards (admin usage, errors)
- Rollback procedures documented

**Scope**: DevOps, monitoring, deployment

**Dependencies**: Phase 4 (testing complete)

---

## Data Schema / State Management

### 1. User Table Extensions

**CURRENT SCHEMA:**
```sql
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  passwordHash    String
  firstName       String?
  lastName        String?
  emailVerified   Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

**NEW FIELDS TO ADD:**

```prisma
model User {
  // ... existing fields ...
  
  // NEW ADMIN FIELDS:
  role            String      @default("USER")          // USER, VIEWER, EDITOR, ADMIN
  permissions     String[]    @default([])              // JSON array of permission codes
  isAdmin         Boolean     @default(false)           // Convenience flag for admins
  adminSince      DateTime?                             // When user became admin
  adminApprovedBy String?                               // User ID of approver
  adminApprovedAt DateTime?                             // Timestamp of approval
  lastAdminAction DateTime?                             // Last time user performed admin action
  isAdminActive   Boolean     @default(true)            // Can be deactivated without deletion
  
  // Relationships:
  adminActions    AdminAction[]                         // Actions this user performed
  approvedAdmins  User[]      @relation("AdminApprovals") // Admins approved by this user
  approvedBy      User?       @relation("AdminApprovals", fields: [adminApprovedBy], references: [id])
  
  @@index([role])
  @@index([isAdmin])
  @@index([lastAdminAction])
}
```

### 2. New Table: AdminAction (Audit Trail)

```prisma
model AdminAction {
  id                String    @id @default(cuid())
  
  // Actor Information
  userId            String                            // User who performed the action
  user              User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  
  // Action Details
  action            String                            // CREATE, UPDATE, DELETE, RESTORE, BULK_UPDATE
  resourceType      String                            // BENEFIT, CARD, RANGE
  resourceId        String                            // ID of affected resource
  
  // Change Tracking
  oldValue          String?                           // Previous state (JSON)
  newValue          String?                           // New state (JSON)
  changedFields     String[]                          // Array of field names that changed
  
  // Metadata
  reason            String?                           // Why the change was made
  ipAddress         String?                           // IP of requesting user
  userAgent         String?                           // Browser/client info
  requestId         String?                           // For correlation with logs
  
  // Status & Timing
  status            String    @default("COMPLETED")  // COMPLETED, FAILED, PENDING_APPROVAL
  errorMessage      String?                           // If status=FAILED
  
  createdAt         DateTime  @default(now())
  
  // Indexes for efficient querying
  @@index([userId])
  @@index([resourceType, resourceId])
  @@index([action])
  @@index([createdAt])
  @@index([userId, createdAt])
  @@index([resourceType, createdAt])
}
```

### 3. New Table: Permission

```prisma
model Permission {
  id                String    @id @default(cuid())
  
  // Permission Definition
  code              String    @unique              // e.g., "ADMIN:READ", "BENEFIT:UPDATE"
  name              String                         // Human-readable name
  description       String?                        // What this permission allows
  category          String                         // ADMIN, BENEFIT, AUDIT, SYSTEM
  
  // Configuration
  requiresApproval  Boolean   @default(false)     // Requires secondary approval
  riskLevel         String    @default("LOW")      // LOW, MEDIUM, HIGH
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([category])
}
```

### 4. Enhanced MasterBenefit Table

```prisma
model MasterBenefit {
  id                  String    @id @default(cuid())
  masterCardId        String
  
  // Existing Fields
  name                String
  type                String
  stickerValue        Int
  resetCadence        String
  isActive            Boolean   @default(true)
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  masterCard          MasterCard @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
  
  // NEW FIELDS FOR ADMIN:
  description         String?                       // Detailed benefit description
  metadata            String?                       // JSON field for custom attributes
  
  // Version Tracking (for conflict detection)
  version             Int       @default(1)         // Incremented on each update
  versionedAt         DateTime? @updatedAt          // When version was created
  
  // Soft Delete Support
  deletedAt           DateTime?                     // NULL = active, SET = soft-deleted
  deletedBy           String?                       // User ID who deleted it
  deleteReason        String?                       // Why it was deleted
  
  // Range/Threshold Metadata
  minValue            Int?                          // For threshold-based benefits
  maxValue            Int?                          // For range-based benefits
  
  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
  @@index([isActive])
  @@index([deletedAt])                              // For active/archived queries
}
```

### 5. New Table: BenefitRange (For threshold-based benefits)

```prisma
model BenefitRange {
  id                String    @id @default(cuid())
  
  benefitId         String
  masterBenefitId   String
  
  // Range Definition
  minValue          Int       @default(0)
  maxValue          Int
  displayValue      String    // E.g., "$100-$500"
  tierLevel         Int       // 1, 2, 3... for progressive benefits
  
  // Relationship
  masterBenefit     MasterBenefit @relation(fields: [masterBenefitId], references: [id], onDelete: Cascade)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@unique([masterBenefitId, tierLevel])
  @@index([masterBenefitId])
}
```

### 6. Complete Schema Migration Example

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ... All previous models ...

model AdminAction {
  id                String    @id @default(cuid())
  userId            String
  action            String                            // CREATE, UPDATE, DELETE, RESTORE
  resourceType      String                            // BENEFIT, CARD
  resourceId        String
  oldValue          String?                           // JSON
  newValue          String?                           // JSON
  changedFields     String[]
  reason            String?
  ipAddress         String?
  userAgent         String?
  requestId         String?
  status            String    @default("COMPLETED")
  errorMessage      String?
  createdAt         DateTime  @default(now())
  user              User      @relation(fields: [userId], references: [id], onDelete: Restrict)
  
  @@index([userId])
  @@index([resourceType, resourceId])
  @@index([action])
  @@index([createdAt])
  @@index([userId, createdAt])
}

model Permission {
  id                String    @id @default(cuid())
  code              String    @unique
  name              String
  description       String?
  category          String
  requiresApproval  Boolean   @default(false)
  riskLevel         String    @default("LOW")
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([category])
}

model BenefitRange {
  id                String    @id @default(cuid())
  masterBenefitId   String
  minValue          Int       @default(0)
  maxValue          Int
  displayValue      String
  tierLevel         Int
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  masterBenefit     MasterBenefit @relation(fields: [masterBenefitId], references: [id], onDelete: Cascade)
  
  @@unique([masterBenefitId, tierLevel])
  @@index([masterBenefitId])
}
```

### 7. Sample Data Structures

**User with Admin Role:**
```json
{
  "id": "user_12345",
  "email": "admin@cardfbenefits.com",
  "firstName": "John",
  "lastName": "Admin",
  "role": "ADMIN",
  "isAdmin": true,
  "adminSince": "2024-01-15T10:30:00Z",
  "adminApprovedBy": "user_founder",
  "adminApprovedAt": "2024-01-15T10:30:00Z",
  "lastAdminAction": "2024-01-22T14:45:00Z",
  "isAdminActive": true,
  "permissions": [
    "ADMIN:READ",
    "ADMIN:WRITE",
    "BENEFIT:CREATE",
    "BENEFIT:UPDATE",
    "BENEFIT:DELETE",
    "BENEFIT:RESTORE",
    "AUDIT:READ",
    "AUDIT:EXPORT"
  ]
}
```

**Admin Action Audit Record:**
```json
{
  "id": "action_67890",
  "userId": "user_12345",
  "action": "UPDATE",
  "resourceType": "BENEFIT",
  "resourceId": "benefit_xyz",
  "oldValue": {
    "name": "Airport Lounge Access",
    "stickerValue": 50,
    "resetCadence": "ANNUAL"
  },
  "newValue": {
    "name": "Priority Pass - Airport Lounge",
    "stickerValue": 75,
    "resetCadence": "ANNUAL"
  },
  "changedFields": ["name", "stickerValue"],
  "reason": "Updated value based on 2024 pricing",
  "ipAddress": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "requestId": "req_abc123",
  "status": "COMPLETED",
  "createdAt": "2024-01-22T14:45:00Z"
}
```

**Benefit with Ranges:**
```json
{
  "id": "benefit_xyz",
  "masterCardId": "card_001",
  "name": "Travel Credit",
  "type": "TRAVEL",
  "stickerValue": 100,
  "resetCadence": "ANNUAL",
  "description": "Annual travel credit towards flights, hotels, or car rentals",
  "metadata": {
    "partner": "Chase Ultimate Rewards",
    "category": "TRAVEL",
    "requiresActivation": false
  },
  "version": 3,
  "versionedAt": "2024-01-22T14:45:00Z",
  "deletedAt": null,
  "minValue": 50,
  "maxValue": 200,
  "ranges": [
    {
      "id": "range_1",
      "minValue": 0,
      "maxValue": 99,
      "displayValue": "Up to $99",
      "tierLevel": 1
    },
    {
      "id": "range_2",
      "minValue": 100,
      "maxValue": 200,
      "displayValue": "$100-$200",
      "tierLevel": 2
    }
  ]
}
```

---

## User Flows & Workflows

### User Flow 1: Admin Views Master Benefits

```
START: Admin visits /admin/benefits
  ↓
[Auth Middleware] Verify JWT token
  ├─ Valid & Admin? → Continue
  └─ Invalid/No admin role? → Redirect to /login (401)
  ↓
[Dashboard] Load page
  ├─ GET /api/admin/benefits?page=1&limit=20
  │  └─ [API] Verify admin role
  │     ├─ Role=ADMIN or EDITOR? → Fetch from DB
  │     └─ Role≠ADMIN/EDITOR? → Return 403
  ├─ Load benefit list
  └─ Display cards with actions (Edit, Delete, View History)
  ↓
[Benefit List] Render with:
  - Name, Type, Value, Reset Cadence
  - Status badge (Active/Inactive)
  - Last modified (date + user)
  - Edit, Delete, History buttons
  ↓
END: List displayed
```

**Alternative Path: Non-admin accesses**
```
START: Non-admin user tries /admin/benefits
  ↓
[Auth Middleware] Check user role
  └─ role ≠ ADMIN/EDITOR/VIEWER? → 403 Forbidden
  ↓
[Dashboard] Display error: "Access Denied"
  └─ Show link to return to /dashboard
  ↓
END: Access blocked
```

### User Flow 2: Admin Edits Benefit

```
START: Admin clicks Edit on benefit
  ↓
[Modal/Page] Open edit form
  ├─ GET /api/admin/benefits/{benefitId}
  │  └─ [API] Verify admin, fetch benefit + version
  │     └─ Lock resource (set timeout=5min)
  ├─ Load benefit data into form
  └─ Display current values + version number
  ↓
[Form] Admin modifies fields
  ├─ User enters new value (e.g., stickerValue: 100 → 150)
  ├─ Form validates in real-time
  └─ "Changed" indicator appears
  ↓
[Action] User clicks "Preview Changes"
  ├─ Show diff view:
  │  ├─ Before: stickerValue: 100
  │  └─ After: stickerValue: 150
  ├─ Show affected user cards count (if applicable)
  └─ Ask for confirmation + optional reason
  ↓
[Confirmation] Admin provides reason (optional)
  └─ "Updated value per Q1 2024 pricing"
  ↓
[Submit] Admin clicks "Save Changes"
  ├─ POST /api/admin/benefits/{benefitId}
  │  └─ [API] Verify admin + version check
  │     ├─ Current version matches form version? → Update
  │     └─ Version mismatch? → Notify "Someone else edited this. Refresh to see changes"
  │        (Optimistic locking prevents overwrites)
  ├─ Update MasterBenefit (increment version)
  ├─ Create AdminAction record
  │  ├─ userId: current user
  │  ├─ action: UPDATE
  │  ├─ oldValue: {stickerValue: 100}
  │  ├─ newValue: {stickerValue: 150}
  │  └─ reason: "Updated value per Q1 2024 pricing"
  └─ Unlock resource (release lock)
  ↓
[Response] Display success message
  └─ "Benefit updated successfully"
  ↓
[Refresh] Return to list or show updated benefit
  ↓
END: Change saved + audited
```

**Edge Case: Concurrent Edit**
```
START: Two admins edit same benefit simultaneously
  ↓
[Admin A] Opens edit form
  └─ Benefit.version = 5 → Form shows version=5
  ↓
[Admin B] Opens edit form (same benefit)
  └─ Benefit.version = 5 → Form shows version=5
  ↓
[Admin A] Saves changes
  ├─ POST /api/admin/benefits/{id} {version: 5, changes...}
  ├─ API checks: DB.version still 5? → YES
  ├─ Update succeeds, version → 6
  └─ Create audit log
  ↓
[Admin B] Saves changes
  ├─ POST /api/admin/benefits/{id} {version: 5, changes...}
  ├─ API checks: DB.version still 5? → NO (it's 6)
  ├─ Update FAILS → Return 409 Conflict
  └─ Message: "This benefit was updated by another user. Your changes were not saved."
  ↓
[Admin B] Action:
  ├─ Option 1: Click "Refresh" → Reload current value (version=6)
  ├─ Option 2: View "Change History" → See what Admin A changed
  └─ Option 3: Reapply changes manually
  ↓
END: Conflict resolved
```

### User Flow 3: Admin Views Audit Log

```
START: Admin visits /admin/audit-log
  ↓
[Auth Middleware] Verify JWT + audit permission
  ├─ role in [ADMIN, EDITOR, VIEWER]? → Continue
  └─ Else → 403 Forbidden
  ↓
[Page Load] GET /api/admin/audit-log?filters...
  └─ [API] Fetch AdminAction records with filters:
     ├─ User ID (optional)
     ├─ Date range (optional)
     ├─ Resource type (optional)
     ├─ Action type (optional)
     └─ Pagination (limit=50, offset=0)
  ↓
[Display] Show audit log table:
  ├─ Date/Time
  ├─ Admin User
  ├─ Action (CREATE, UPDATE, DELETE)
  ├─ Resource (Benefit name)
  ├─ Changes (what changed)
  ├─ Reason
  └─ View Details button
  ↓
[Filters] Admin applies filters:
  ├─ Resource Type = "BENEFIT"
  ├─ Date Range = "Last 30 days"
  └─ Action = "UPDATE"
  ↓
[Results] Table updates showing only matching records
  ↓
[Details] Admin clicks "View Details" on a record
  ├─ Show expanded view:
  │  ├─ Admin: John Admin (user_12345)
  │  ├─ Time: Jan 22, 2024 2:45 PM
  │  ├─ Action: UPDATE
  │  ├─ Resource: Benefit #xyz "Travel Credit"
  │  ├─ Old Value: {stickerValue: 100, name: "Travel"}
  │  ├─ New Value: {stickerValue: 150, name: "Travel Credit"}
  │  ├─ Changed Fields: [stickerValue, name]
  │  ├─ Reason: "Updated per 2024 pricing"
  │  ├─ IP Address: 192.168.1.100
  │  └─ User Agent: Chrome/Firefox/Safari
  ↓
[Export] Admin clicks "Export to CSV"
  ├─ POST /api/admin/audit-log/export
  │  └─ [API] Generate CSV + create audit record
  │     └─ Log: User X exported audit log (filters applied)
  ├─ Browser downloads: audit_log_2024_01_22.csv
  └─ Create AdminAction for export (for meta-audit)
  ↓
END: Audit log viewed/exported
```

### User Flow 4: Admin Creates New Benefit

```
START: Admin clicks "+ New Benefit"
  ↓
[Modal] Open "Create Benefit" form
  └─ Form fields:
     ├─ Card (dropdown) - required
     ├─ Name - required, max 255 chars
     ├─ Type (dropdown) - required
     ├─ Sticker Value - required, positive integer
     ├─ Reset Cadence (dropdown) - required
     ├─ Description - optional, max 2000 chars
     ├─ Metadata (JSON editor) - optional
     ├─ Min/Max Value (for ranges) - optional
     └─ Status - default ACTIVE
  ↓
[Form Validation] Real-time validation:
  ├─ Name: not empty, no special chars (alphanumeric + spaces)
  ├─ Value: number >= 0 && <= 999,999
  ├─ Type: must match allowed enum
  └─ Show inline errors for invalid fields
  ↓
[Admin Fills] Enters all required fields
  ├─ Card: "Chase Sapphire Reserve"
  ├─ Name: "Concierge Services"
  ├─ Type: "CONCIERGE"
  ├─ Value: 500
  ├─ Cadence: "ANNUAL"
  └─ Reason: "New card feature in 2024"
  ↓
[Preview] Click "Create" → Show preview
  ├─ Summary of new benefit
  ├─ Affected card count
  └─ Confirmation required
  ↓
[Submit] Confirmed
  ├─ POST /api/admin/benefits
  │  └─ [API] Verify admin + input validation
  │     ├─ All required fields present? → YES
  │     ├─ Values within limits? → YES
  │     ├─ Name unique for this card? → YES
  │     ├─ Create MasterBenefit record
  │     ├─ Set version = 1
  │     └─ Create AdminAction (action=CREATE)
  ├─ Database transaction ensures atomicity
  └─ Response includes new benefit ID
  ↓
[Success] Display confirmation
  └─ "Benefit created successfully"
  ↓
[Redirect] Return to benefit list
  └─ Show newly created benefit in list
  ↓
END: Benefit created + audited
```

### User Flow 5: Admin Bulk Updates Benefits

```
START: Admin selects multiple benefits
  ↓
[Benefit List] Admin:
  ├─ Check checkboxes for benefits to update (e.g., 5 selected)
  ├─ Click "Bulk Edit"
  └─ Bulk action modal appears
  ↓
[Bulk Edit Modal] Options:
  ├─ Update Status (Active → Inactive)
  ├─ Update Field (e.g., Reset Cadence: ANNUAL → QUARTERLY)
  ├─ Add Tag/Metadata
  └─ Provide reason (required for audit)
  ↓
[Preview] Admin clicks "Preview Changes"
  ├─ Show table with:
  │  ├─ Benefit name
  │  ├─ Current value
  │  ├─ New value
  │  └─ Change indicator
  ├─ Summary: "5 benefits will be updated"
  └─ Confirmation required
  ↓
[Confirm] Admin clicks "Apply Changes"
  ├─ POST /api/admin/benefits/bulk-update
  │  ├─ body: {
  │  │  benefitIds: [id1, id2, id3, id4, id5],
  │  │  updates: {resetCadence: "QUARTERLY"},
  │  │  reason: "Policy change - quarterly reviews"
  │  │}
  │  └─ [API] Verify admin + batch size limit
  │     ├─ Batch size ≤ 500? → YES
  │     ├─ All IDs valid? → YES
  │     ├─ Lock all benefits (prevent concurrent edits)
  │     ├─ For each benefit:
  │     │  ├─ Update record
  │     │  ├─ Increment version
  │     │  └─ Create AdminAction entry
  │     ├─ Unlock all benefits
  │     └─ Return summary (5 updated, 0 failed)
  ├─ All operations in single transaction → all-or-nothing
  └─ Audit trail shows bulk update with reason
  ↓
[Response] Display success
  └─ "5 benefits updated successfully"
  ↓
[Refresh] Return to list
  └─ All 5 benefits show new values
  ↓
END: Bulk update complete + audited
```

---

## API Routes & Contracts

### Authentication & Authorization

All admin endpoints require:
1. **Valid JWT token** in HttpOnly cookie (existing)
2. **User role verification** (new)
3. **Permission check** (new)

**Error Response: 401 Unauthorized**
```json
{
  "error": "Authentication required",
  "code": "AUTH_UNAUTHORIZED",
  "timestamp": "2024-01-22T14:45:00Z"
}
```

**Error Response: 403 Forbidden**
```json
{
  "error": "Insufficient permissions",
  "code": "AUTH_FORBIDDEN",
  "requiredRole": "ADMIN",
  "userRole": "USER",
  "timestamp": "2024-01-22T14:45:00Z"
}
```

### Admin Benefit CRUD Endpoints

#### 1. GET /api/admin/benefits
**Purpose**: List all master benefits with filtering and pagination

**Authentication**: Required (VIEWER, EDITOR, ADMIN)

**Query Parameters**:
```
GET /api/admin/benefits?
  page=1&
  limit=20&
  cardId=card_001&
  type=TRAVEL&
  resetCadence=ANNUAL&
  status=ACTIVE&
  search=lounge
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 20, max: 100) |
| `cardId` | string | No | Filter by master card ID |
| `type` | string | No | Filter by benefit type |
| `resetCadence` | string | No | Filter by reset cadence (ANNUAL, QUARTERLY, etc.) |
| `status` | string | No | Filter by status (ACTIVE, INACTIVE) |
| `search` | string | No | Search benefit name (case-insensitive substring) |
| `sortBy` | string | No | Sort field (name, value, type, createdAt) |
| `sortOrder` | string | No | asc or desc (default: asc) |

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "benefit_001",
      "masterCardId": "card_001",
      "name": "Airport Lounge Access",
      "type": "LOUNGE",
      "stickerValue": 50,
      "resetCadence": "ANNUAL",
      "description": "Access to Priority Pass lounges worldwide",
      "isActive": true,
      "version": 3,
      "lastModifiedAt": "2024-01-22T14:45:00Z",
      "lastModifiedBy": "admin@example.com",
      "deletedAt": null,
      "metadata": {}
    },
    // ... more benefits
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "timestamp": "2024-01-22T14:50:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Database error

---

#### 2. GET /api/admin/benefits/{benefitId}
**Purpose**: Get single benefit with version tracking

**Authentication**: Required (VIEWER, EDITOR, ADMIN)

**URL Parameters**:
```
GET /api/admin/benefits/benefit_001
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "benefit_001",
    "masterCardId": "card_001",
    "name": "Airport Lounge Access",
    "type": "LOUNGE",
    "stickerValue": 50,
    "resetCadence": "ANNUAL",
    "description": "Access to Priority Pass lounges worldwide",
    "isActive": true,
    "version": 3,
    "versionedAt": "2024-01-22T14:45:00Z",
    "lastModifiedAt": "2024-01-22T14:45:00Z",
    "lastModifiedBy": "admin@example.com",
    "lastModifiedByUser": {
      "id": "user_123",
      "email": "admin@example.com",
      "firstName": "John"
    },
    "deletedAt": null,
    "minValue": 0,
    "maxValue": 200,
    "metadata": {},
    "ranges": [
      {
        "id": "range_1",
        "minValue": 0,
        "maxValue": 99,
        "displayValue": "Up to $99",
        "tierLevel": 1
      }
    ]
  },
  "timestamp": "2024-01-22T14:50:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Benefit doesn't exist
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions

---

#### 3. POST /api/admin/benefits
**Purpose**: Create new benefit

**Authentication**: Required (EDITOR, ADMIN)

**Request Body**:
```json
{
  "masterCardId": "card_001",
  "name": "Concierge Services",
  "type": "CONCIERGE",
  "stickerValue": 500,
  "resetCadence": "ANNUAL",
  "description": "24/7 concierge service for travel, dining, etc.",
  "metadata": {
    "partner": "Chase",
    "category": "SERVICE",
    "requiresActivation": false
  },
  "minValue": 0,
  "maxValue": 1000,
  "reason": "New benefit for 2024 card refresh"
}
```

**Validation Rules**:
```
{
  "masterCardId": "required|string|exists:masterCards",
  "name": "required|string|max:255|unique:benefitName",
  "type": "required|in:TRAVEL,LOUNGE,CONCIERGE,CASHBACK,etc.",
  "stickerValue": "required|integer|min:0|max:999999",
  "resetCadence": "required|in:ANNUAL,QUARTERLY,MONTHLY,NONE",
  "description": "nullable|string|max:2000",
  "metadata": "nullable|json",
  "minValue": "nullable|integer|min:0",
  "maxValue": "nullable|integer|min:minValue",
  "reason": "nullable|string|max:500"
}
```

**Success Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "benefit_new_001",
    "masterCardId": "card_001",
    "name": "Concierge Services",
    "type": "CONCIERGE",
    "stickerValue": 500,
    "resetCadence": "ANNUAL",
    "description": "24/7 concierge service for travel, dining, etc.",
    "isActive": true,
    "version": 1,
    "createdAt": "2024-01-22T14:50:00Z",
    "createdBy": "admin@example.com"
  },
  "audit": {
    "id": "action_001",
    "action": "CREATE",
    "timestamp": "2024-01-22T14:50:00Z",
    "userId": "user_123"
  },
  "timestamp": "2024-01-22T14:50:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Validation failed (invalid fields, duplicate name, etc.)
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions (requires EDITOR+)
- `404 Not Found` - Master card doesn't exist
- `409 Conflict` - Benefit name already exists for this card
- `500 Internal Server Error` - Database error

---

#### 4. PUT /api/admin/benefits/{benefitId}
**Purpose**: Update existing benefit (full update with version checking)

**Authentication**: Required (EDITOR, ADMIN)

**URL Parameters**:
```
PUT /api/admin/benefits/benefit_001
```

**Request Body**:
```json
{
  "name": "Priority Pass - Airport Lounge Access",
  "stickerValue": 75,
  "resetCadence": "ANNUAL",
  "description": "Updated description",
  "metadata": {
    "partner": "Chase",
    "premium": true
  },
  "version": 3,
  "reason": "Updated value per 2024 pricing analysis"
}
```

**Validation Rules** (same as POST, plus version requirement):
```
{
  "version": "required|integer|equals:currentDbVersion",
  "name": "nullable|string|max:255",
  "type": "nullable|in:TRAVEL,LOUNGE,CONCIERGE,...",
  "stickerValue": "nullable|integer|min:0|max:999999",
  "resetCadence": "nullable|in:ANNUAL,QUARTERLY,MONTHLY,NONE",
  "reason": "nullable|string|max:500"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "benefit_001",
    "masterCardId": "card_001",
    "name": "Priority Pass - Airport Lounge Access",
    "stickerValue": 75,
    "version": 4,
    "updatedAt": "2024-01-22T14:55:00Z",
    "updatedBy": "admin@example.com"
  },
  "audit": {
    "id": "action_002",
    "action": "UPDATE",
    "oldValue": {
      "name": "Airport Lounge Access",
      "stickerValue": 50
    },
    "newValue": {
      "name": "Priority Pass - Airport Lounge Access",
      "stickerValue": 75
    },
    "changedFields": ["name", "stickerValue"],
    "reason": "Updated value per 2024 pricing analysis",
    "timestamp": "2024-01-22T14:55:00Z"
  },
  "timestamp": "2024-01-22T14:55:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Validation failed
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Benefit doesn't exist
- `409 Conflict` - Version mismatch (someone else edited this benefit)
- `422 Unprocessable Entity` - Benefit locked (edit in progress by another user)

---

#### 5. PATCH /api/admin/benefits/{benefitId}
**Purpose**: Partial update of benefit

**Authentication**: Required (EDITOR, ADMIN)

**Request Body** (partial):
```json
{
  "stickerValue": 100,
  "version": 3,
  "reason": "Updated per Q1 review"
}
```

**Success Response (200 OK)**: Same as PUT

**Difference from PUT**: Only provided fields are updated; omitted fields unchanged.

---

#### 6. DELETE /api/admin/benefits/{benefitId}
**Purpose**: Soft-delete benefit (mark as inactive, preserve history)

**Authentication**: Required (ADMIN only)

**Request Body**:
```json
{
  "reason": "Discontinuing lounge access from 2025",
  "deleteStrategy": "soft"  // 'soft' or 'hard' (hard requires additional confirmation)
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "benefit_001",
    "name": "Airport Lounge Access",
    "status": "DELETED",
    "deletedAt": "2024-01-22T14:55:00Z",
    "deletedBy": "admin@example.com",
    "deleteReason": "Discontinuing lounge access from 2025"
  },
  "audit": {
    "id": "action_003",
    "action": "DELETE",
    "reason": "Discontinuing lounge access from 2025",
    "timestamp": "2024-01-22T14:55:00Z"
  },
  "timestamp": "2024-01-22T14:55:00Z"
}
```

**Error Responses**:
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions (ADMIN only)
- `404 Not Found` - Benefit doesn't exist

---

#### 7. POST /api/admin/benefits/{benefitId}/restore
**Purpose**: Restore soft-deleted benefit

**Authentication**: Required (ADMIN only)

**Request Body**:
```json
{
  "reason": "Restoring lounge access per client request"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "benefit_001",
    "status": "ACTIVE",
    "restoredAt": "2024-01-22T14:55:00Z",
    "restoredBy": "admin@example.com"
  },
  "audit": {
    "action": "RESTORE",
    "reason": "Restoring lounge access per client request"
  }
}
```

---

#### 8. POST /api/admin/benefits/bulk-update
**Purpose**: Update multiple benefits in single transaction

**Authentication**: Required (EDITOR, ADMIN)

**Request Body**:
```json
{
  "benefitIds": [
    "benefit_001",
    "benefit_002",
    "benefit_003"
  ],
  "updates": {
    "resetCadence": "QUARTERLY",
    "metadata": {
      "reviewed": true,
      "reviewDate": "2024-01-22"
    }
  },
  "reason": "Q1 2024 benefit review and reset cadence update"
}
```

**Validation**:
```
{
  "benefitIds": "required|array|min:1|max:500",
  "benefitIds.*": "string|exists:masterBenefits",
  "updates": "required|object|not_empty",
  "reason": "required|string|max:500"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "processed": 3,
    "failed": 0,
    "updated": [
      {
        "id": "benefit_001",
        "oldVersion": 3,
        "newVersion": 4
      },
      {
        "id": "benefit_002",
        "oldVersion": 2,
        "newVersion": 3
      },
      {
        "id": "benefit_003",
        "oldVersion": 1,
        "newVersion": 2
      }
    ],
    "failures": []
  },
  "audit": {
    "id": "action_004",
    "action": "BULK_UPDATE",
    "resourceCount": 3,
    "reason": "Q1 2024 benefit review and reset cadence update",
    "timestamp": "2024-01-22T14:55:00Z"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid benefit IDs or batch size exceeds 500
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions
- `422 Unprocessable Entity` - One or more benefits locked

---

### Audit Log Endpoints

#### 9. GET /api/admin/audit-log
**Purpose**: Retrieve audit trail with filtering

**Authentication**: Required (VIEWER, EDITOR, ADMIN)

**Query Parameters**:
```
GET /api/admin/audit-log?
  page=1&
  limit=50&
  userId=user_123&
  resourceType=BENEFIT&
  action=UPDATE&
  startDate=2024-01-01&
  endDate=2024-01-31&
  search=lounge
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 50, max: 200) |
| `userId` | string | No | Filter by admin user |
| `resourceType` | string | No | BENEFIT, CARD, RANGE |
| `resourceId` | string | No | Filter by specific resource |
| `action` | string | No | CREATE, UPDATE, DELETE, RESTORE, BULK_UPDATE |
| `startDate` | ISO8601 | No | Filter from date (inclusive) |
| `endDate` | ISO8601 | No | Filter to date (inclusive) |
| `search` | string | No | Search in reason field |
| `sortBy` | string | No | createdAt (default), userId, action |
| `sortOrder` | string | No | asc or desc (default: desc) |

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "action_001",
      "userId": "user_123",
      "user": {
        "id": "user_123",
        "email": "admin@example.com",
        "firstName": "John",
        "lastName": "Admin"
      },
      "action": "UPDATE",
      "resourceType": "BENEFIT",
      "resourceId": "benefit_001",
      "resourceName": "Airport Lounge Access",
      "oldValue": {
        "stickerValue": 50,
        "name": "Airport Lounge"
      },
      "newValue": {
        "stickerValue": 75,
        "name": "Airport Lounge Access"
      },
      "changedFields": ["stickerValue", "name"],
      "reason": "Updated per 2024 pricing",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "requestId": "req_abc123",
      "status": "COMPLETED",
      "errorMessage": null,
      "createdAt": "2024-01-22T14:45:00Z"
    },
    // ... more records
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 450,
    "totalPages": 9
  },
  "timestamp": "2024-01-22T14:50:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions

---

#### 10. GET /api/admin/audit-log/{actionId}
**Purpose**: Get detailed audit record

**Authentication**: Required (VIEWER, EDITOR, ADMIN)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "action_001",
    "userId": "user_123",
    "user": {
      "id": "user_123",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Admin"
    },
    "action": "UPDATE",
    "resourceType": "BENEFIT",
    "resourceId": "benefit_001",
    "resourceName": "Airport Lounge Access",
    "oldValue": {
      "id": "benefit_001",
      "name": "Airport Lounge",
      "type": "LOUNGE",
      "stickerValue": 50,
      "resetCadence": "ANNUAL"
    },
    "newValue": {
      "id": "benefit_001",
      "name": "Airport Lounge Access",
      "type": "LOUNGE",
      "stickerValue": 75,
      "resetCadence": "ANNUAL"
    },
    "changedFields": ["name", "stickerValue"],
    "reason": "Updated per 2024 pricing analysis",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
    "requestId": "req_abc123",
    "status": "COMPLETED",
    "errorMessage": null,
    "createdAt": "2024-01-22T14:45:00Z"
  },
  "timestamp": "2024-01-22T14:50:00Z"
}
```

---

#### 11. GET /api/admin/audit-log/export
**Purpose**: Export audit log to CSV

**Authentication**: Required (EDITOR, ADMIN)

**Query Parameters**: Same as audit log list endpoint

**Headers**:
```
Accept: text/csv
```

**Success Response (200 OK)**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit_log_2024_01_22.csv"

ID,Timestamp,User Email,Action,Resource Type,Resource ID,Changed Fields,Reason,IP Address
action_001,2024-01-22T14:45:00Z,admin@example.com,UPDATE,BENEFIT,benefit_001,stickerValue|name,Updated per 2024 pricing,192.168.1.100
action_002,2024-01-22T14:50:00Z,admin@example.com,CREATE,BENEFIT,benefit_002,all,New card benefit,192.168.1.100
...
```

**Error Responses**:
- `401 Unauthorized` - No valid JWT
- `403 Forbidden` - Insufficient permissions (EDITOR+ only)

---

### Role & Permission Management Endpoints

#### 12. GET /api/admin/users
**Purpose**: List users with roles/permissions

**Authentication**: Required (ADMIN only)

**Query Parameters**:
```
GET /api/admin/users?
  page=1&
  limit=20&
  role=EDITOR&
  search=john&
  isAdminActive=true
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "email": "admin@example.com",
      "firstName": "John",
      "lastName": "Admin",
      "role": "ADMIN",
      "isAdmin": true,
      "adminSince": "2024-01-01T10:00:00Z",
      "adminApprovedBy": "user_founder",
      "adminApprovedAt": "2024-01-01T10:00:00Z",
      "isAdminActive": true,
      "lastAdminAction": "2024-01-22T14:45:00Z",
      "permissions": [
        "ADMIN:READ",
        "ADMIN:WRITE",
        "BENEFIT:CREATE",
        "BENEFIT:UPDATE",
        "BENEFIT:DELETE"
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

#### 13. POST /api/admin/users/{userId}/promote
**Purpose**: Promote user to admin

**Authentication**: Required (ADMIN only)

**Request Body**:
```json
{
  "reason": "Promoting John to admin for card catalog management"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "ADMIN",
    "adminSince": "2024-01-22T14:55:00Z",
    "adminApprovedBy": "user_approver",
    "adminApprovedAt": "2024-01-22T14:55:00Z"
  },
  "audit": {
    "action": "ADMIN_PROMOTION",
    "userId": "user_123",
    "reason": "Promoting John to admin for card catalog management"
  }
}
```

---

#### 14. POST /api/admin/users/{userId}/demote
**Purpose**: Remove admin privileges from user

**Authentication**: Required (ADMIN only)

**Request Body**:
```json
{
  "newRole": "EDITOR",
  "reason": "Transition to editor role"
}
```

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "role": "EDITOR",
    "isAdmin": false
  },
  "audit": {
    "action": "ADMIN_DEMOTION",
    "userId": "user_123",
    "newRole": "EDITOR",
    "reason": "Transition to editor role"
  }
}
```

---

### Analytics & Reporting Endpoints

#### 15. GET /api/admin/analytics/benefits
**Purpose**: Get benefit management analytics

**Authentication**: Required (VIEWER, EDITOR, ADMIN)

**Success Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalBenefits": 44,
      "activeBenefits": 42,
      "inactiveBenefits": 2,
      "benefitsCreatedThisMonth": 3,
      "benefitsModifiedThisMonth": 12
    },
    "byType": {
      "TRAVEL": 8,
      "LOUNGE": 6,
      "CASHBACK": 12,
      "CONCIERGE": 5,
      "OTHER": 13
    },
    "byCard": {
      "card_001": 10,
      "card_002": 8,
      "card_003": 12
    },
    "recentChanges": [
      {
        "benefitId": "benefit_001",
        "action": "UPDATE",
        "count": 3,
        "lastModified": "2024-01-22T14:45:00Z"
      }
    ]
  }
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: Concurrent Edit Conflict
**Scenario**: Two admins edit the same benefit simultaneously

**Current State**: Benefit version = 5, stickerValue = 100

**Admin A Timeline**:
1. Opens edit form at 14:45:00 (sees version=5)
2. Changes stickerValue to 150
3. Submits at 14:45:15 with version=5
4. API validates: DB.version == 5? → YES
5. Update succeeds, version increments to 6
6. AdminAction created: {oldValue: {stickerValue: 100}, newValue: {stickerValue: 150}}

**Admin B Timeline**:
1. Opens edit form at 14:45:00 (sees version=5)
2. Changes resetCadence to QUARTERLY
3. Submits at 14:45:20 with version=5
4. API validates: DB.version == 5? → NO (it's 6 now)
5. Update FAILS with 409 Conflict
6. Response: "This benefit was updated by another admin. Your changes were not saved."

**Handling**:
- Return 409 Conflict with clear error message
- Include latest version and current values in response
- Admin refreshes to see latest changes and can reapply if needed
- No data loss or corruption occurs

**Code Example**:
```typescript
// API endpoint
async function updateBenefit(id: string, updates: UpdateInput) {
  const current = await db.masterBenefit.findUnique({id});
  
  if (current.version !== updates.version) {
    return {
      status: 409,
      error: "Version mismatch - benefit was updated by another admin",
      currentVersion: current.version,
      currentValue: current
    };
  }
  
  // Update succeeds
  const updated = await db.masterBenefit.update({
    where: { id },
    data: {
      ...updates,
      version: current.version + 1
    }
  });
}
```

---

### Edge Case 2: Race Condition - Bulk Delete During Bulk Update
**Scenario**: One admin bulk updates 100 benefits while another bulk deletes 10 of them

**Prevention**:
- Lock acquired when bulk operation starts
- Locks prevent concurrent modifications to same benefits
- If lock exists (from another operation), return 422 "Resource locked"
- First operation completes, locks released, second operation proceeds
- Each operation is fully isolated through pessimistic locking

**Timeout**: If operation hangs, lock auto-releases after 5 minutes

---

### Edge Case 3: Benefit Referenced by User Benefits
**Scenario**: Admin tries to delete a benefit that has been assigned to users

**Current State**: MasterBenefit "Travel Credit" (benefit_001) is used by 250 users

**Handling**:
```json
// DELETE response
{
  "success": false,
  "error": "Cannot hard-delete benefit with active user references",
  "suggestion": "Use soft-delete (mark as inactive) instead",
  "affectedUserCount": 250,
  "options": [
    {
      "action": "soft_delete",
      "description": "Mark as inactive - preserves history, users can still see it"
    },
    {
      "action": "hard_delete",
      "description": "Requires explicit confirmation - will orphan 250 user benefits",
      "requiresApproval": true,
      "adminConfirmationRequired": true
    }
  ]
}
```

**Recommended Flow**:
1. Soft-delete by default (mark isActive=false)
2. Hard-delete only with explicit admin confirmation
3. Audit log shows: "Hard-deleted 'Travel Credit' affecting 250 users"

---

### Edge Case 4: Invalid Input Values
**Scenario**: Admin enters invalid data (negative value, missing required field, etc.)

**Validation Layer (Client-side, real-time)**:
```
- Name: Cannot be empty ✓
- Value: Must be between 0 and 999,999 ✓
- Type: Must be from allowed list ✓
- Reset Cadence: Must be ANNUAL, QUARTERLY, MONTHLY, or NONE ✓
- Description: Max 2000 characters ✓
```

**Validation Layer (Server-side, on submit)**:
```typescript
const validationSchema = {
  name: 'required|string|max:255|not_special_chars',
  stickerValue: 'required|integer|min:0|max:999999',
  type: 'required|in:TRAVEL,LOUNGE,CONCIERGE,CASHBACK',
  resetCadence: 'required|in:ANNUAL,QUARTERLY,MONTHLY,NONE'
};

const result = validate(input, validationSchema);
if (!result.isValid) {
  return {
    status: 400,
    error: 'Validation failed',
    details: {
      'stickerValue': 'Must be between 0 and 999,999',
      'type': 'Invalid type selected'
    }
  };
}
```

**Response (400 Bad Request)**:
```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "stickerValue": "Must be a positive integer between 0 and 999,999",
    "name": "Name cannot contain special characters (@#$%^&*)"
  },
  "timestamp": "2024-01-22T14:45:00Z"
}
```

---

### Edge Case 5: Admin Attempts Unauthorized Action
**Scenario**: User with EDITOR role tries to delete a benefit (requires ADMIN)

**Handling**:
```json
{
  "error": "Insufficient permissions",
  "code": "AUTH_FORBIDDEN",
  "requiredRole": "ADMIN",
  "userRole": "EDITOR",
  "action": "DELETE",
  "message": "Only admins can delete benefits. Editors can deactivate instead.",
  "alternatives": [
    {
      "action": "deactivate",
      "endpoint": "PATCH /api/admin/benefits/{id}",
      "body": {"isActive": false}
    }
  ],
  "timestamp": "2024-01-22T14:45:00Z"
}
```

**Status Code**: 403 Forbidden

---

### Edge Case 6: Bulk Operation Exceeds Rate Limit
**Scenario**: Admin submits bulk update for 1000 benefits (exceeds 500 limit)

**Handling**:
```json
{
  "success": false,
  "error": "Batch size exceeds maximum",
  "code": "BATCH_LIMIT_EXCEEDED",
  "batchSize": 1000,
  "maxAllowed": 500,
  "suggestion": "Split into 2 requests of 500 each",
  "timestamp": "2024-01-22T14:45:00Z"
}
```

**Status Code**: 400 Bad Request

---

### Edge Case 7: Admin Rate Limiting (100 requests/minute)
**Scenario**: Admin makes 150 requests in 1 minute

**Handling**:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 12,
  "message": "You have made 100 requests in the last minute. Please wait before making more requests.",
  "timestamp": "2024-01-22T14:45:00Z"
}
```

**Status Code**: 429 Too Many Requests

**Headers**:
```
Retry-After: 12
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-22T14:46:12Z
```

---

### Edge Case 8: Audit Log Retention Compliance
**Scenario**: Audit record older than 7 years is accessed

**Handling**:
- Query restrictions prevent direct deletion of historical records
- Automatic archival to cold storage after 7 years
- Read access still allowed for compliance purposes
- Update/delete access blocked for archived records

```typescript
// Auto-archive logic (daily cron job)
async function archiveOldAuditLogs() {
  const sevenYearsAgo = new Date();
  sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);
  
  const oldRecords = await db.adminAction.findMany({
    where: {
      createdAt: { lt: sevenYearsAgo }
    }
  });
  
  // Archive to S3/cold storage
  await archiveToStorage(oldRecords);
  
  // Mark as archived (but don't delete)
  await db.adminAction.updateMany({
    where: { createdAt: { lt: sevenYearsAgo } },
    data: { archived: true }
  });
}
```

---

### Edge Case 9: Benefit Locked Due to In-Progress Edit
**Scenario**: One admin is editing a benefit, another admin tries to edit same benefit

**Handling**:
- Pessimistic locking acquired when edit starts
- Lock expires after 5 minutes or when user completes/cancels
- Second admin receives response with lock information

```json
{
  "success": false,
  "error": "Resource is locked",
  "code": "RESOURCE_LOCKED",
  "lockedBy": "admin@example.com",
  "lockedSince": "2024-01-22T14:45:00Z",
  "expiresAt": "2024-01-22T14:50:00Z",
  "timeRemaining": 135,
  "message": "This benefit is currently being edited by another admin. Please try again later.",
  "timestamp": "2024-01-22T14:45:30Z"
}
```

**Status Code**: 422 Unprocessable Entity

---

### Edge Case 10: Restore Deleted Benefit, But Card No Longer Exists
**Scenario**: Admin deletes a benefit, then the card is hard-deleted, then tries to restore benefit

**Handling**:
```json
{
  "success": false,
  "error": "Cannot restore benefit",
  "reason": "Parent card no longer exists",
  "benefitId": "benefit_001",
  "benefit": "Airport Lounge Access",
  "cardId": "card_001",
  "suggestion": "Contact database administrator or restore parent card first"
}
```

**Status Code**: 409 Conflict

---

### Edge Case 11: Audit Log Query with Extreme Date Range
**Scenario**: Admin queries audit log for last 50 years (performance impact)

**Handling**:
- Query optimization: max date range = 1 year
- If larger range requested, paginate by month/quarter
- Cache popular queries (last 30 days, last 365 days)

```json
{
  "success": false,
  "error": "Date range too large",
  "code": "INVALID_DATE_RANGE",
  "maxRange": "365 days",
  "requested": "50 years",
  "suggestion": "Query in smaller chunks (e.g., year by year) or use pagination"
}
```

---

### Edge Case 12: Database Connection Failure During Bulk Update
**Scenario**: Database goes down mid-transaction during bulk update of 50 benefits

**Handling**:
- All-or-nothing transaction: rollback on any failure
- No partial updates (either all 50 succeed or all fail)
- Clear error message with transaction ID for debugging
- Automatic retry logic for transient failures

```json
{
  "success": false,
  "error": "Transaction failed",
  "code": "DB_TRANSACTION_FAILED",
  "transactionId": "txn_abc123def456",
  "affectedCount": 0,
  "message": "Database connection lost during bulk update. No benefits were modified.",
  "retry": {
    "automatic": false,
    "manual": true,
    "recommended": "Retry after 30 seconds when database is recovered"
  }
}
```

---

### Edge Case 13: Metadata JSON Invalid Format
**Scenario**: Admin submits metadata with invalid JSON

**Validation**:
```json
// Bad input:
{
  "metadata": "{not valid json}"
}

// Response:
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "metadata": "Invalid JSON format - please use valid JSON"
  },
  "example": {
    "metadata": {
      "partner": "Chase",
      "premium": true,
      "requiresActivation": false
    }
  }
}
```

---

### Edge Case 14: Search Query Performance (Large Dataset)
**Scenario**: Admin searches for "credit" across 10,000 benefits

**Handling**:
- Use database full-text search index (PostgreSQL FTS)
- Cache frequent searches (1 hour TTL)
- Pagination enforced: max 100 results per page
- Add indexed columns for common filters (type, resetCadence, isActive)

**Database Optimization**:
```sql
-- Index for search performance
CREATE INDEX idx_master_benefit_name_trgm 
ON "MasterBenefit" USING GIN (name gin_trgm_ops);

CREATE INDEX idx_master_benefit_type 
ON "MasterBenefit" (type) WHERE "isActive" = true;

CREATE INDEX idx_master_benefit_active 
ON "MasterBenefit" (id) WHERE "isActive" = true;
```

---

### Edge Case 15: Admin Session Expires During Edit
**Scenario**: Admin's session expires while editing a benefit

**Handling**:
- Frontend detects 401 response on save attempt
- Displays modal: "Your session has expired. Please log in again."
- Unsaved changes are preserved in local storage
- After re-login, offer to restore unsaved changes

```json
// API Response on expired session:
{
  "error": "Authentication required",
  "code": "AUTH_UNAUTHORIZED",
  "status": 401,
  "message": "Your session has expired. Please log in again.",
  "redirectUrl": "/login?returnUrl=/admin/benefits/benefit_001"
}
```

---

## Component Architecture

### System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                          │
│  (Next.js React Frontend - Desktop/Tablet/Mobile)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Benefit List    │  │  Benefit Editor  │  │  Audit Log   │  │
│  │  (Search/Filter) │  │  (Form/Preview)  │  │  (View/Exp)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                      │                   │          │
└───────────┼──────────────────────┼───────────────────┼──────────┘
            │                      │                   │
            └──────────────────────┼───────────────────┘
                                   │
        ┌──────────────────────────▼──────────────────────┐
        │         ADMIN API LAYER (Next.js API)          │
        │                                                 │
        │  ┌────────────────────────────────────────┐    │
        │  │  Auth Middleware                       │    │
        │  │  - JWT Verification                    │    │
        │  │  - Role-based Access Control (RBAC)    │    │
        │  │  - Rate Limiting                       │    │
        │  └────────┬──────────────────────────────┘    │
        │           │                                    │
        │  ┌────────▼──────────────────────────────┐    │
        │  │  Permission Checking Middleware       │    │
        │  │  - User role validation                │    │
        │  │  - Action permission checks           │    │
        │  │  - Resource ownership verification    │    │
        │  └────────┬──────────────────────────────┘    │
        │           │                                    │
        │  ┌────────▼──────────────────────────────┐    │
        │  │  Benefit Management Routes            │    │
        │  │  - GET /api/admin/benefits            │    │
        │  │  - POST /api/admin/benefits           │    │
        │  │  - PUT/PATCH /api/admin/benefits/:id  │    │
        │  │  - DELETE /api/admin/benefits/:id     │    │
        │  │  - POST /api/admin/benefits/bulk      │    │
        │  │  - GET /api/admin/audit-log           │    │
        │  │  - GET /api/admin/users               │    │
        │  └────────┬──────────────────────────────┘    │
        │           │                                    │
        │  ┌────────▼──────────────────────────────┐    │
        │  │  Business Logic Layer                 │    │
        │  │  - Validation Service                 │    │
        │  │  - Audit Logging Service              │    │
        │  │  - Conflict Detection (version check) │    │
        │  │  - Transaction Management             │    │
        │  └────────┬──────────────────────────────┘    │
        └───────────┼────────────────────────────────────┘
                    │
        ┌───────────▼─────────────────────────┐
        │    DATABASE LAYER                   │
        │                                     │
        │  PostgreSQL with Prisma ORM        │
        │                                     │
        │  Tables:                            │
        │  - User (with roles/permissions)    │
        │  - MasterCard                       │
        │  - MasterBenefit                    │
        │  - AdminAction (audit trail)        │
        │  - Permission                       │
        │  - BenefitRange                     │
        │  - Session (for auth)               │
        │                                     │
        │  Indexes:                           │
        │  - User(role, isAdmin)              │
        │  - AdminAction(userId, createdAt)   │
        │  - MasterBenefit(masterCardId)      │
        └─────────────────────────────────────┘
```

### Component Decomposition

#### 1. Frontend Components (React)

**Component Tree**:
```
<AdminLayout>
  <Sidebar>
    <NavLink to="/admin/benefits" />
    <NavLink to="/admin/audit-log" />
    <NavLink to="/admin/users" />
  </Sidebar>
  
  <MainContent>
    <BenefitListPage>
      <SearchBar />
      <FilterPanel />
      <BenefitTable>
        <BenefitRow /> × 20
      </BenefitTable>
      <Pagination />
    </BenefitListPage>
    
    OR
    
    <BenefitEditPage>
      <BenefitForm>
        <TextInput name="name" />
        <NumberInput name="stickerValue" />
        <SelectInput name="type" />
        <SubmitButton />
      </BenefitForm>
      <ChangePreview />
      <VersionWarning />
    </BenefitEditPage>
    
    OR
    
    <AuditLogPage>
      <AuditFilterPanel />
      <AuditTable>
        <AuditRow /> × 50
      </AuditTable>
      <ExportButton />
    </AuditLogPage>
  </MainContent>
</AdminLayout>
```

**Reusable Components**:
- `<DataTable />` - Generic table with sorting/filtering/pagination
- `<FormField />` - Generic form input with validation
- `<Modal />` - Confirmation, preview, error modals
- `<LoadingSpinner />` - Loading state indicator
- `<Badge />` - Status badges (Active, Inactive, Locked)
- `<Toast />` - Success/error notifications
- `<Breadcrumb />` - Navigation breadcrumb

---

#### 2. API Middleware Layer

**Authentication Middleware**:
```typescript
// src/middleware/auth.ts
- Verify JWT token in cookie
- Extract userId from token
- Add to request headers (x-user-id)
- If invalid, return 401
```

**Authorization Middleware**:
```typescript
// src/middleware/authorization.ts
- Check user.role against required permission
- Return 403 if insufficient permission
- Log unauthorized access attempt
```

**Rate Limiting Middleware**:
```typescript
// src/middleware/rate-limit.ts
- Track requests per user per minute
- Return 429 if exceeded (100 req/min for admins)
- Use Redis for distributed rate limiting
```

**Audit Logging Middleware**:
```typescript
// src/middleware/audit-logging.ts
- Intercept all write requests (POST, PUT, PATCH, DELETE)
- Extract changes before/after
- Log to AdminAction table
- Include IP, user agent, timestamp
```

---

#### 3. Business Logic Layer

**Permission Service**:
```typescript
// src/services/permission.service.ts
- Check if user has specific permission
- Support role hierarchy (ADMIN > EDITOR > VIEWER)
- Check resource ownership (if applicable)
```

**Benefit Service**:
```typescript
// src/services/benefit.service.ts
- listBenefits(filters, pagination)
- getBenefit(id)
- createBenefit(data)
- updateBenefit(id, data, version)
- deleteBenefit(id)
- restoreBenefit(id)
- bulkUpdateBenefits(ids, updates)
```

**Audit Service**:
```typescript
// src/services/audit.service.ts
- recordAction(userId, action, resourceId, oldValue, newValue, reason)
- getAuditLog(filters, pagination)
- exportAuditLog(filters)
```

**Validation Service**:
```typescript
// src/services/validation.service.ts
- validateBenefit(data)
- validateBenefitUpdate(oldValue, newValue)
- sanitizeInput(data)
- checkUniqueness(field, value)
```

---

#### 4. Data Access Layer (Prisma)

**Repositories**:
```typescript
// src/repositories/benefit.repository.ts
- find(filters, options)
- findById(id)
- create(data)
- update(id, data)
- delete(id)
- batchUpdate(ids, data)
- findWithLock(id) // Pessimistic locking

// src/repositories/audit.repository.ts
- createAction(action)
- findActions(filters)
- findActionById(id)
- exportActions(filters)
```

---

#### 5. Dependency Graph

```
Frontend Components
  ↓
API Routes
  ↓
Auth Middleware → Rate Limit Middleware
  ↓
Authorization Middleware
  ↓
Audit Logging Middleware
  ↓
Business Logic Services
  ├─ Permission Service
  ├─ Benefit Service
  ├─ Audit Service
  └─ Validation Service
  ↓
Data Access Layer (Repositories)
  ↓
Prisma ORM
  ↓
PostgreSQL Database
```

---

## Implementation Tasks

### Phase 1: Data Model (Weeks 1-2)

#### Task 1.1: Create Database Migration - Add User Role Fields
**Complexity**: Small | **Estimated Time**: 4 hours

**Description**: Add role, permissions, adminSince, isAdminActive fields to User table

**Acceptance Criteria**:
- [ ] Migration file created: `prisma/migrations/add_admin_roles_to_user/migration.sql`
- [ ] Prisma schema updated with new User fields
- [ ] All existing users set to role="USER" (default)
- [ ] Migration is idempotent (can run safely)
- [ ] Database tested: `npm run db:migrate`

**Dependencies**: None

**Files to Create/Modify**:
- `prisma/schema.prisma` (modify User model)
- `prisma/migrations/[timestamp]_add_admin_roles/migration.sql` (create)

---

#### Task 1.2: Create AdminAction Audit Table
**Complexity**: Small | **Estimated Time**: 3 hours

**Description**: Create AdminAction table for complete audit trail

**Acceptance Criteria**:
- [ ] AdminAction model added to schema.prisma
- [ ] Migration created and tested
- [ ] Indexes added: userId, resourceType, createdAt, action
- [ ] Foreign key relationship to User established
- [ ] Table tested with sample data

**Dependencies**: Task 1.1

**Files to Create/Modify**:
- `prisma/schema.prisma` (add AdminAction model)
- `prisma/migrations/[timestamp]_create_admin_action_table/migration.sql`

---

#### Task 1.3: Create Permission and BenefitRange Tables
**Complexity**: Small | **Estimated Time**: 3 hours

**Description**: Create Permission and BenefitRange tables for fine-grained access control

**Acceptance Criteria**:
- [ ] Permission model added to schema
- [ ] BenefitRange model added to schema
- [ ] Migrations created and tested
- [ ] Seed Permission table with 20+ permission codes (ADMIN:READ, BENEFIT:CREATE, etc.)
- [ ] Database consistency verified

**Dependencies**: Task 1.1

**Files to Create/Modify**:
- `prisma/schema.prisma` (add Permission, BenefitRange models)
- `prisma/migrations/[timestamp]_create_permission_tables/migration.sql`
- `prisma/seed.ts` (seed Permission records)

---

#### Task 1.4: Enhance MasterBenefit Table
**Complexity**: Small | **Estimated Time**: 2 hours

**Description**: Add description, metadata, version, deletedAt fields to MasterBenefit

**Acceptance Criteria**:
- [ ] New fields added to MasterBenefit model
- [ ] Migration created
- [ ] Index added for deletedAt (soft-delete queries)
- [ ] Version field defaults to 1
- [ ] All existing benefits migrated with deletedAt=null

**Dependencies**: None (separate from Phase 1.1-1.3)

**Files to Create/Modify**:
- `prisma/schema.prisma` (modify MasterBenefit)
- `prisma/migrations/[timestamp]_enhance_master_benefit/migration.sql`

---

#### Task 1.5: Data Migration - Set Default Roles & Permissions
**Complexity**: Small | **Estimated Time**: 2 hours

**Description**: Migrate existing users: set role="USER", founder gets role="ADMIN"

**Acceptance Criteria**:
- [ ] Script created: `scripts/migrate-user-roles.ts`
- [ ] All existing users get role="USER"
- [ ] Founder user (if identifiable) gets role="ADMIN"
- [ ] Script is idempotent (safe to run multiple times)
- [ ] Script tested on dev database
- [ ] Rollback plan documented

**Dependencies**: Task 1.1-1.3

**Files to Create/Modify**:
- `scripts/migrate-user-roles.ts` (create)
- `docs/MIGRATION_GUIDE.md` (create/update)

---

### Phase 2: API Layer (Weeks 2-3)

#### Task 2.1: Implement Authentication/Authorization Middleware
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Create middleware to verify JWT + check user role before API access

**Acceptance Criteria**:
- [ ] Middleware created: `src/middleware/authorization.ts`
- [ ] Checks user role against required permission
- [ ] Returns 403 Forbidden for insufficient permission
- [ ] Returns 401 Unauthorized for missing JWT
- [ ] Logs all authorization failures
- [ ] Unit tested with 90%+ coverage

**Dependencies**: Task 1.1

**Files to Create/Modify**:
- `src/middleware/authorization.ts` (create)
- `src/__tests__/middleware-authorization.test.ts` (create)

---

#### Task 2.2: Implement Rate Limiting for Admin Routes
**Complexity**: Medium | **Estimated Time**: 5 hours

**Description**: Add rate limiting (100 requests/min per admin user) using Redis

**Acceptance Criteria**:
- [ ] Rate limiting middleware created: `src/middleware/rate-limit.ts`
- [ ] Redis key structure: `rate-limit:{userId}:{timestamp}`
- [ ] Admin routes limited to 100 req/min
- [ ] Returns 429 Too Many Requests when exceeded
- [ ] Includes Retry-After header
- [ ] Integration tested with Redis

**Dependencies**: Redis available, Task 2.1

**Files to Create/Modify**:
- `src/middleware/rate-limit.ts` (create)
- `src/__tests__/middleware-rate-limit.test.ts` (create)

---

#### Task 2.3: Create Audit Logging Service
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Service to log all admin actions to AdminAction table

**Acceptance Criteria**:
- [ ] Service created: `src/services/audit.service.ts`
- [ ] recordAction() method logs: userId, action, resourceId, oldValue, newValue, reason
- [ ] Async logging (doesn't block API response)
- [ ] IP address and user agent captured
- [ ] Failed operations logged (status, error message)
- [ ] Unit tested with mocked database

**Dependencies**: Task 1.2

**Files to Create/Modify**:
- `src/services/audit.service.ts` (create)
- `src/__tests__/services/audit.service.test.ts` (create)

---

#### Task 2.4: Create Benefit CRUD API Endpoints
**Complexity**: Large | **Estimated Time**: 12 hours

**Description**: Implement all benefit management endpoints (GET, POST, PUT, PATCH, DELETE)

**Acceptance Criteria**:
- [ ] GET /api/admin/benefits (list with pagination, filters)
- [ ] GET /api/admin/benefits/:id (single benefit)
- [ ] POST /api/admin/benefits (create new)
- [ ] PUT /api/admin/benefits/:id (full update with version check)
- [ ] PATCH /api/admin/benefits/:id (partial update)
- [ ] DELETE /api/admin/benefits/:id (soft delete)
- [ ] POST /api/admin/benefits/:id/restore (restore soft-deleted)
- [ ] All endpoints with proper error handling
- [ ] Authorization checks on all endpoints
- [ ] Audit logging on all write operations

**Endpoints to Implement**:
```
GET    /api/admin/benefits
GET    /api/admin/benefits/:id
POST   /api/admin/benefits
PUT    /api/admin/benefits/:id
PATCH  /api/admin/benefits/:id
DELETE /api/admin/benefits/:id
POST   /api/admin/benefits/:id/restore
POST   /api/admin/benefits/bulk-update
```

**Dependencies**: Task 2.1, 2.3

**Files to Create/Modify**:
- `src/app/api/admin/benefits/route.ts` (list, create)
- `src/app/api/admin/benefits/[id]/route.ts` (get, update, delete)
- `src/app/api/admin/benefits/[id]/restore/route.ts` (restore)
- `src/app/api/admin/benefits/bulk-update/route.ts` (bulk)
- `src/__tests__/api/admin/benefits.test.ts` (all endpoint tests)

---

#### Task 2.5: Create Audit Log API Endpoints
**Complexity**: Medium | **Estimated Time**: 8 hours

**Description**: Implement audit log viewing and export endpoints

**Acceptance Criteria**:
- [ ] GET /api/admin/audit-log (list with filters, pagination)
- [ ] GET /api/admin/audit-log/:actionId (single record)
- [ ] GET /api/admin/audit-log/export (CSV export)
- [ ] Date range filtering (max 1 year)
- [ ] User, action type, resource type filtering
- [ ] CSV export with proper formatting
- [ ] Authorization: VIEWER+ role required
- [ ] Performance: queries return in <500ms

**Dependencies**: Task 2.1, 2.3

**Files to Create/Modify**:
- `src/app/api/admin/audit-log/route.ts` (list)
- `src/app/api/admin/audit-log/[id]/route.ts` (single)
- `src/app/api/admin/audit-log/export/route.ts` (CSV)
- `src/__tests__/api/admin/audit-log.test.ts`

---

#### Task 2.6: Create User Role Management Endpoints
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Implement endpoints for promoting/demoting users to admin roles

**Acceptance Criteria**:
- [ ] GET /api/admin/users (list users with roles)
- [ ] POST /api/admin/users/:userId/promote (make admin)
- [ ] POST /api/admin/users/:userId/demote (remove admin)
- [ ] PATCH /api/admin/users/:userId (update role/permissions)
- [ ] Audit logging for all role changes
- [ ] ADMIN role required for all operations
- [ ] Prevent self-demotion

**Dependencies**: Task 2.1, 2.3

**Files to Create/Modify**:
- `src/app/api/admin/users/route.ts` (list)
- `src/app/api/admin/users/[id]/promote/route.ts` (promote)
- `src/app/api/admin/users/[id]/demote/route.ts` (demote)
- `src/__tests__/api/admin/users.test.ts`

---

#### Task 2.7: Implement Validation & Error Handling
**Complexity**: Medium | **Estimated Time**: 5 hours

**Description**: Create validation service and consistent error responses

**Acceptance Criteria**:
- [ ] Validation service: `src/services/validation.service.ts`
- [ ] validateBenefit() for create/update operations
- [ ] validateBulkUpdate() for bulk operations
- [ ] sanitizeInput() to prevent injection attacks
- [ ] Consistent error response format (400, 401, 403, 409, 422, 500)
- [ ] All endpoints use validation service
- [ ] Unit tests for all validators

**Dependencies**: Task 2.4

**Files to Create/Modify**:
- `src/services/validation.service.ts` (create)
- `src/__tests__/services/validation.service.test.ts` (create)
- Update all API endpoints to use validation

---

### Phase 3: Frontend (Weeks 3-4)

#### Task 3.1: Create Admin Layout & Navigation
**Complexity**: Small | **Estimated Time**: 4 hours

**Description**: Build admin dashboard layout with sidebar navigation

**Acceptance Criteria**:
- [ ] AdminLayout component created
- [ ] Sidebar with links: Benefit List, Audit Log, User Management
- [ ] Responsive (desktop, tablet, mobile)
- [ ] Active link highlighting
- [ ] User info display with logout button
- [ ] Mobile hamburger menu

**Dependencies**: None (can work in parallel with API)

**Files to Create/Modify**:
- `src/components/admin/AdminLayout.tsx` (create)
- `src/components/admin/AdminSidebar.tsx` (create)
- `src/styles/admin.module.css` (create)

---

#### Task 3.2: Create Benefit List View
**Complexity**: Medium | **Estimated Time**: 8 hours

**Description**: Build benefit list page with search, filter, pagination

**Acceptance Criteria**:
- [ ] Table displays: Name, Type, Value, Cadence, Status, Last Modified
- [ ] Search by benefit name (real-time filtering)
- [ ] Filters: Card, Type, Cadence, Status
- [ ] Pagination: 20 items per page
- [ ] Sort by any column
- [ ] Responsive table (desktop/tablet/mobile)
- [ ] Action buttons: Edit, Delete, View History
- [ ] Loading states and error handling
- [ ] No loading delay >500ms

**Dependencies**: Task 2.4 (API endpoint)

**Files to Create/Modify**:
- `src/pages/admin/benefits.tsx` (create)
- `src/components/admin/BenefitTable.tsx` (create)
- `src/components/admin/SearchBar.tsx` (create)
- `src/components/admin/FilterPanel.tsx` (create)
- `src/hooks/useAdminBenefits.ts` (create - API hook)
- `src/__tests__/components/admin/BenefitTable.test.tsx` (create)

---

#### Task 3.3: Create Benefit Edit Form
**Complexity**: Large | **Estimated Time**: 10 hours

**Description**: Build form for creating and editing benefits with preview

**Acceptance Criteria**:
- [ ] Form fields: Card, Name, Type, Value, Cadence, Description, Metadata
- [ ] Real-time validation (show errors on blur)
- [ ] Version tracking (for edit form)
- [ ] Preview modal showing before/after changes
- [ ] Cancel/Save buttons
- [ ] Success/error notifications
- [ ] Handle concurrent edit conflict (409 response)
- [ ] Optimistic locking (version mismatch detection)
- [ ] Responsive form (desktop/mobile)
- [ ] Keyboard navigation support

**Dependencies**: Task 2.4, 3.2

**Files to Create/Modify**:
- `src/pages/admin/benefits/[id]/edit.tsx` (create)
- `src/pages/admin/benefits/new.tsx` (create)
- `src/components/admin/BenefitForm.tsx` (create)
- `src/components/admin/ChangePreview.tsx` (create)
- `src/hooks/useAdminBenefitForm.ts` (create)
- `src/__tests__/components/admin/BenefitForm.test.tsx` (create)

---

#### Task 3.4: Create Audit Log Viewer
**Complexity**: Medium | **Estimated Time**: 8 hours

**Description**: Build audit log page with filters and export

**Acceptance Criteria**:
- [ ] Table displays: Date, User, Action, Resource, Changes, Reason
- [ ] Filters: Date range, User, Action, Resource Type
- [ ] Pagination: 50 items per page
- [ ] Click to expand row and see full details (old/new values)
- [ ] Export to CSV button
- [ ] Date range validation (max 365 days)
- [ ] Responsive table
- [ ] Search in reason field

**Dependencies**: Task 2.5

**Files to Create/Modify**:
- `src/pages/admin/audit-log.tsx` (create)
- `src/components/admin/AuditLogTable.tsx` (create)
- `src/components/admin/AuditLogFilters.tsx` (create)
- `src/hooks/useAuditLog.ts` (create)
- `src/__tests__/components/admin/AuditLogTable.test.tsx` (create)

---

#### Task 3.5: Create User Management Page
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Build user management interface (promote/demote admins)

**Acceptance Criteria**:
- [ ] List users with email, role, admin since date
- [ ] Filter by role
- [ ] Promote user to admin button
- [ ] Demote user from admin button
- [ ] Confirmation dialog before role change
- [ ] Show audit log for user (admins they approved, actions)
- [ ] Responsive table

**Dependencies**: Task 2.6

**Files to Create/Modify**:
- `src/pages/admin/users.tsx` (create)
- `src/components/admin/UserManagementTable.tsx` (create)
- `src/hooks/useAdminUsers.ts` (create)

---

#### Task 3.6: Create Reusable UI Components
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Build shared components used across admin dashboard

**Acceptance Criteria**:
- [ ] DataTable component (sorting, pagination)
- [ ] FormField component (input, validation, error)
- [ ] Modal component (confirm, preview, error)
- [ ] Badge component (status badges)
- [ ] Toast component (notifications)
- [ ] Loading spinner
- [ ] All components responsive
- [ ] Storybook stories for each component

**Dependencies**: None

**Files to Create/Modify**:
- `src/components/admin/shared/DataTable.tsx` (create)
- `src/components/admin/shared/FormField.tsx` (create)
- `src/components/admin/shared/Modal.tsx` (create)
- `src/components/admin/shared/Badge.tsx` (create)
- `src/components/admin/shared/Toast.tsx` (create)

---

#### Task 3.7: Implement Access Control & Role Checking
**Complexity**: Small | **Estimated Time**: 4 hours

**Description**: Add client-side role checks to redirect unauthorized users

**Acceptance Criteria**:
- [ ] Verify user role before rendering admin pages
- [ ] Redirect non-admins from /admin/* routes
- [ ] Show "Access Denied" for insufficient permissions
- [ ] Hook: useAdminCheck() for component-level checks
- [ ] Prevent API calls for unauthorized actions

**Dependencies**: All previous Phase 3 tasks

**Files to Create/Modify**:
- `src/hooks/useAdminCheck.ts` (create)
- `src/components/admin/AdminProtectedRoute.tsx` (create)
- Update all admin pages to use protection

---

### Phase 4: Testing (Weeks 4-5)

#### Task 4.1: Unit Tests - Services
**Complexity**: Medium | **Estimated Time**: 8 hours

**Description**: Unit tests for all business logic services

**Test Coverage**:
- [ ] Benefit Service (90%+ coverage)
  - listBenefits with filters
  - getBenefit
  - createBenefit with validation
  - updateBenefit with version checking
  - deleteBenefit
  - restoreBenefit
  - bulkUpdateBenefits
- [ ] Audit Service (90%+ coverage)
  - recordAction
  - getAuditLog with filters
  - exportAuditLog
- [ ] Validation Service (95%+ coverage)
  - All validators
  - Edge cases

**Dependencies**: Phase 2 complete

**Files to Create/Modify**:
- `src/__tests__/services/benefit.service.test.ts` (create)
- `src/__tests__/services/audit.service.test.ts` (create)
- `src/__tests__/services/validation.service.test.ts` (create)

---

#### Task 4.2: Integration Tests - API Endpoints
**Complexity**: Large | **Estimated Time**: 12 hours

**Description**: Integration tests for all API endpoints with database

**Test Coverage**:
- [ ] Benefit CRUD endpoints (happy path + error cases)
- [ ] Authorization checks (403 for insufficient permission)
- [ ] Version conflict handling (409)
- [ ] Rate limiting (429)
- [ ] Audit logging (verify AdminAction created)
- [ ] Bulk operations (all-or-nothing)
- [ ] Audit log endpoints
- [ ] User management endpoints

**Test Strategy**:
- Setup test database for each test
- Use transactions for test isolation
- Mock external services (Redis)
- Test data seeding

**Dependencies**: Phase 2 complete

**Files to Create/Modify**:
- `src/__tests__/api/admin/benefits.integration.test.ts` (create)
- `src/__tests__/api/admin/audit-log.integration.test.ts` (create)
- `src/__tests__/api/admin/users.integration.test.ts` (create)

---

#### Task 4.3: End-to-End Tests - Admin Workflows
**Complexity**: Large | **Estimated Time**: 10 hours

**Description**: E2E tests for complete admin workflows

**Test Scenarios**:
- [ ] Create benefit flow (form → preview → save)
- [ ] Edit benefit with concurrent edit conflict
- [ ] Soft-delete and restore benefit
- [ ] Bulk update multiple benefits
- [ ] View audit log and export CSV
- [ ] Promote user to admin
- [ ] Search/filter benefits

**Test Framework**: Playwright

**Dependencies**: Phase 3 complete

**Files to Create/Modify**:
- `tests/e2e/admin-benefit-create.spec.ts` (create)
- `tests/e2e/admin-benefit-edit.spec.ts` (create)
- `tests/e2e/admin-audit-log.spec.ts` (create)
- `tests/e2e/admin-user-management.spec.ts` (create)

---

#### Task 4.4: Security Tests - Authorization & Input Validation
**Complexity**: Medium | **Estimated Time**: 8 hours

**Description**: Security-focused testing for authorization and input validation

**Test Coverage**:
- [ ] Unauthorized access (non-admins, expired sessions)
- [ ] SQL injection attempts (via API inputs)
- [ ] XSS prevention (in metadata fields)
- [ ] CSRF protection
- [ ] Rate limiting evasion attempts
- [ ] Privilege escalation (editor → admin)
- [ ] Direct database access (bypassing API)

**Dependencies**: Phase 2 complete

**Files to Create/Modify**:
- `src/__tests__/security/authorization.test.ts` (create)
- `src/__tests__/security/input-validation.test.ts` (create)

---

#### Task 4.5: Performance Tests
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Performance testing for API endpoints and queries

**Test Coverage**:
- [ ] Large dataset queries (10,000+ benefits)
- [ ] Pagination performance
- [ ] Search performance (indexed fields)
- [ ] Audit log queries with filters
- [ ] Bulk update performance (500 benefits)
- [ ] Query N+1 detection

**Performance Targets**:
- List benefits: <500ms
- Search benefits: <500ms
- Get single benefit: <100ms
- Create benefit: <200ms
- Bulk update: <5s (500 items)

**Dependencies**: Phase 2 complete

**Files to Create/Modify**:
- `src/__tests__/performance/api.performance.test.ts` (create)

---

### Phase 5: Deployment (Weeks 5-6)

#### Task 5.1: Database Migration Testing & Execution
**Complexity**: Medium | **Estimated Time**: 6 hours

**Description**: Test migrations on staging, verify rollback, then deploy to production

**Steps**:
- [ ] Run migrations on staging database
- [ ] Verify data integrity (all users have role set)
- [ ] Test rollback procedure (migrate down, then up again)
- [ ] Create pre-production checklist
- [ ] Schedule production migration window
- [ ] Execute on production with backup
- [ ] Verify migration success

**Rollback Plan**:
```bash
# If production migration fails:
npx prisma migrate resolve --rolled-back <migration-name>
npx prisma db pull  # Verify current schema
# Restore from backup if needed
```

**Dependencies**: Task 1.1-1.5 (migrations complete)

**Files to Create/Modify**:
- `docs/MIGRATION_PRODUCTION.md` (create)
- Deployment checklist

---

#### Task 5.2: Create Deployment Checklist & Runbook
**Complexity**: Small | **Estimated Time**: 3 hours

**Description**: Document deployment steps and troubleshooting

**Checklist Items**:
- [ ] All tests passing (unit, integration, E2E)
- [ ] Code review completed
- [ ] Database backup taken
- [ ] Monitoring/alerts configured
- [ ] Rollback procedure tested
- [ ] On-call engineer available
- [ ] Communication plan (notify users?)
- [ ] Post-deployment verification steps

**Dependencies**: All Phase 4 complete

**Files to Create/Modify**:
- `DEPLOYMENT_CHECKLIST.md` (create/update)
- `DEPLOYMENT_RUNBOOK.md` (create)

---

#### Task 5.3: Configure Monitoring & Alerting
**Complexity**: Medium | **Estimated Time**: 5 hours

**Description**: Set up monitoring for admin-related metrics and errors

**Metrics to Monitor**:
- [ ] Admin API endpoint latency (p50, p95, p99)
- [ ] Admin API error rate (4xx, 5xx)
- [ ] Rate limiting hits per admin user
- [ ] Audit log creation lag
- [ ] Database query performance
- [ ] Failed authorization attempts
- [ ] Admin user session timeout rate

**Alerts to Configure**:
- [ ] API error rate >5% (page on-call)
- [ ] Database latency >1s (warning)
- [ ] Audit log lag >10s (investigate)
- [ ] Multiple failed auth attempts (potential attack)

**Dashboards to Create**:
- Admin API Health Dashboard
- Audit Trail Dashboard
- User Role Management Dashboard

**Dependencies**: Phase 2 complete (APIs deployed)

**Files to Create/Modify**:
- `docs/MONITORING.md` (create/update)
- Prometheus/DataDog dashboard configs

---

#### Task 5.4: Write Documentation
**Complexity**: Small | **Estimated Time**: 4 hours

**Description**: Create admin user documentation

**Docs to Create**:
- [ ] Admin User Guide (how to use dashboard)
- [ ] API Reference (for integrations)
- [ ] Architecture Overview
- [ ] Troubleshooting Guide
- [ ] FAQ

**Dependencies**: All phases complete

**Files to Create/Modify**:
- `docs/ADMIN_USER_GUIDE.md` (create)
- `docs/API_REFERENCE.md` (create/update)
- `docs/ARCHITECTURE.md` (create/update)

---

#### Task 5.5: Smoke Tests & Post-Deployment Verification
**Complexity**: Small | **Estimated Time**: 2 hours

**Description**: Run smoke tests after deployment to verify everything works

**Tests to Run**:
- [ ] Admin can log in
- [ ] Admin can view benefit list
- [ ] Admin can create new benefit
- [ ] Admin can edit existing benefit
- [ ] Admin can view audit log
- [ ] Audit logging is working (check AdminAction table)
- [ ] API responds within SLA

**Dependencies**: All phases complete, deployment done

**Files to Create/Modify**:
- `tests/smoke/admin.smoke.test.ts` (create)

---

## Testing Strategy

### Unit Tests (Phase 4.1)

**Coverage Target**: 90%+ for all services

**Test Structure**:
```typescript
describe('BenefitService', () => {
  describe('createBenefit', () => {
    test('should create benefit with valid data', () => {
      // Arrange
      const input = { cardId: 'card_1', name: 'Test', ... };
      
      // Act
      const result = await benefitService.createBenefit(input);
      
      // Assert
      expect(result.id).toBeDefined();
      expect(result.version).toBe(1);
    });
    
    test('should throw error on duplicate name', () => {
      // Arrange
      await benefitService.createBenefit({...});
      
      // Act & Assert
      await expect(() => benefitService.createBenefit({...}))
        .rejects.toThrow('Duplicate benefit name');
    });
  });
});
```

---

### Integration Tests (Phase 4.2)

**Coverage Target**: All API endpoints, happy path + error cases

**Test Structure**:
```typescript
describe('GET /api/admin/benefits', () => {
  test('should return benefits with pagination', async () => {
    // Setup
    const admin = await createTestAdmin();
    await createTestBenefits(25);
    
    // Execute
    const res = await request(app)
      .get('/api/admin/benefits?page=1&limit=20')
      .set('Cookie', `session=${admin.sessionToken}`);
    
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(20);
    expect(res.body.pagination.total).toBe(25);
  });
});
```

---

### E2E Tests (Phase 4.3)

**Coverage Target**: Complete user workflows

**Test Structure**:
```typescript
describe('Admin Benefit Creation Workflow', () => {
  test('should create benefit from form to save', async () => {
    // Login as admin
    await page.goto('/admin/benefits');
    
    // Click "New Benefit"
    await page.click('[data-testid="new-benefit-btn"]');
    
    // Fill form
    await page.fill('[data-testid="benefit-name"]', 'Concierge');
    await page.fill('[data-testid="benefit-value"]', '500');
    
    // Click preview
    await page.click('[data-testid="preview-btn"]');
    
    // Verify preview modal
    expect(await page.textContent('[data-testid="preview-name"]')).toBe('Concierge');
    
    // Confirm and save
    await page.click('[data-testid="confirm-btn"]');
    
    // Verify success
    expect(await page.textContent('[data-testid="success-msg"]')).toContain('created');
  });
});
```

---

## Security & Compliance Considerations

### Authentication & Authorization Strategy

**JWT + Database Session Validation** (Existing):
- JWT stored in HttpOnly cookie (prevents XSS)
- Signature verified in middleware
- Database session lookup catches token revocation
- Session timeout: 1 hour (30 min inactivity for admins)

**New: Role-Based Access Control**:
```typescript
// Middleware checks
1. Extract user.role from database
2. Check against required permission
3. Return 403 if insufficient
4. Log all authorization failures

// Permission structure:
{
  code: "BENEFIT:UPDATE",
  category: "BENEFIT",
  requiresApproval: false,
  riskLevel: "MEDIUM"
}
```

**Admin Permission Hierarchy**:
```
ADMIN
├─ All permissions
└─ Can manage other admins

EDITOR
├─ BENEFIT:CREATE
├─ BENEFIT:UPDATE
├─ BENEFIT:READ (via VIEWER)
└─ AUDIT:READ

VIEWER
├─ BENEFIT:READ
└─ AUDIT:READ

USER
└─ No admin permissions
```

---

### Data Protection & Privacy

**Sensitive Fields**:
- User passwords: Hashed with bcrypt (already implemented)
- Session tokens: Stored only in HttpOnly cookies
- Audit logs: Full history preserved (7 years minimum)
- IP addresses: Logged but not exposed in public responses

**Data Redaction**:
```typescript
// User object in responses - exclude sensitive fields
{
  id: "user_123",
  email: "admin@example.com",
  firstName: "John",
  role: "ADMIN",
  // Never expose: passwordHash, passwordResetToken
}
```

**Access Control**:
- Audit logs viewable by VIEWER+ role only
- IP addresses visible only to ADMIN role
- User email addresses visible only to ADMIN role

---

### Input Validation & Sanitization

**Server-Side Validation** (Required):
```typescript
// All user inputs validated before database insertion
const validationRules = {
  name: 'required|string|max:255|no_special_chars',
  stickerValue: 'required|integer|min:0|max:999999',
  metadata: 'nullable|valid_json',
  reason: 'nullable|string|max:500'
};

// Sanitization
const sanitize = (input: string) => {
  return input
    .trim()
    .replace(/[<>]/g, '')  // XSS prevention
    .substring(0, maxLength);
};
```

**Prevention Measures**:
- [ ] SQL Injection: Parameterized queries (Prisma ORM prevents this)
- [ ] XSS: Input sanitization, output encoding
- [ ] CSRF: SameSite=Strict cookies (already in place)
- [ ] Rate Limiting: 100 req/min per admin user

---

### Audit & Logging Requirements

**What Gets Logged**:
- ✓ All create/update/delete operations on master benefits
- ✓ User role changes (promote/demote)
- ✓ Failed authorization attempts
- ✓ Failed authentication attempts
- ✓ Rate limit violations
- ✓ Admin session creation/termination

**Audit Trail Contents**:
```json
{
  "id": "action_001",
  "timestamp": "2024-01-22T14:45:00Z",
  "userId": "admin_user_id",
  "action": "UPDATE",
  "resourceType": "BENEFIT",
  "resourceId": "benefit_001",
  "oldValue": {...},
  "newValue": {...},
  "changedFields": ["name", "value"],
  "reason": "Updated per Q1 pricing",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "status": "COMPLETED"
}
```

**Retention Policy**:
- Audit logs kept for 7 years (compliance requirement)
- Auto-archived to cold storage after 1 year
- Read access always available
- Update/delete blocked for archived records

---

## Performance & Scalability Considerations

### Expected Load

**Admin Users**: ~5-10 (at launch)
**Admin API Requests**: ~500/day initially, scaling to ~5000/day
**Benefit Management Frequency**: ~2-3 updates/day per admin
**Audit Log Queries**: ~10-20/day

### Database Optimization

**Indexes Created**:
```sql
-- User table indexes
CREATE INDEX idx_user_role ON "User"(role) WHERE "isAdmin" = true;
CREATE INDEX idx_user_admin_since ON "User"("adminSince");

-- AdminAction indexes
CREATE INDEX idx_admin_action_user ON "AdminAction"("userId");
CREATE INDEX idx_admin_action_resource ON "AdminAction"("resourceType", "resourceId");
CREATE INDEX idx_admin_action_created ON "AdminAction"("createdAt" DESC);
CREATE INDEX idx_admin_action_action ON "AdminAction"("action");

-- MasterBenefit indexes
CREATE INDEX idx_master_benefit_card ON "MasterBenefit"("masterCardId");
CREATE INDEX idx_master_benefit_type ON "MasterBenefit"("type") WHERE "isActive" = true;
CREATE INDEX idx_master_benefit_active ON "MasterBenefit"("isActive");
CREATE INDEX idx_master_benefit_deleted ON "MasterBenefit"("deletedAt") WHERE "deletedAt" IS NULL;
```

**Query Optimization**:
- Use pagination (max 100 items per page)
- Lazy-load related data (benefits loaded separately)
- Cache frequent queries (last 30 days audit log, active benefits)
- Denormalize commonly accessed fields (lastModifiedBy in response)

---

### Caching Strategy

**In-Memory Cache (Redis)**:
- Rate limit counters (1 min TTL)
- Session validation cache (15 min TTL)
- Active benefits list (1 hour TTL, invalidate on write)
- User permissions cache (30 min TTL)

**Browser Cache**:
- Benefit list: 5 min (revalidate on user action)
- Audit log: 2 min
- User profile: 1 hour

---

### Scalability Path

**Phase 1 (Current)**: 5-10 admins, ~500 API req/day
- Single PostgreSQL instance sufficient
- No caching needed

**Phase 2 (6 months)**: 50-100 admins, ~5000 API req/day
- Add Redis for rate limiting & caching
- Add read replicas for audit log queries

**Phase 3 (1 year)**: 200+ admins, ~20k API req/day
- Implement query partitioning by card
- Archive old audit logs to S3
- Add API gateway with caching

---

## Timeline Estimate

### Phase 1: Data Model (Weeks 1-2, 32 hours)
- Task 1.1: 4h
- Task 1.2: 3h
- Task 1.3: 3h
- Task 1.4: 2h
- Task 1.5: 2h
- **Subtotal**: 14 hours actual, 32 hours with testing/review

### Phase 2: API Layer (Weeks 2-3, 48 hours)
- Task 2.1: 6h
- Task 2.2: 5h
- Task 2.3: 6h
- Task 2.4: 12h
- Task 2.5: 8h
- Task 2.6: 6h
- Task 2.7: 5h
- **Subtotal**: 48 hours

### Phase 3: Frontend (Weeks 3-4, 46 hours)
- Task 3.1: 4h
- Task 3.2: 8h
- Task 3.3: 10h
- Task 3.4: 8h
- Task 3.5: 6h
- Task 3.6: 6h
- Task 3.7: 4h
- **Subtotal**: 46 hours

### Phase 4: Testing (Weeks 4-5, 44 hours)
- Task 4.1: 8h
- Task 4.2: 12h
- Task 4.3: 10h
- Task 4.4: 8h
- Task 4.5: 6h
- **Subtotal**: 44 hours

### Phase 5: Deployment (Weeks 5-6, 20 hours)
- Task 5.1: 6h
- Task 5.2: 3h
- Task 5.3: 5h
- Task 5.4: 4h
- Task 5.5: 2h
- **Subtotal**: 20 hours

---

## Summary

| Phase | Duration | Effort | Status |
|-------|----------|--------|--------|
| Phase 1: Data Model | 2 weeks | 32h | Ready |
| Phase 2: API Layer | 2 weeks | 48h | Ready |
| Phase 3: Frontend | 2 weeks | 46h | Ready |
| Phase 4: Testing | 2 weeks | 44h | Ready |
| Phase 5: Deployment | 2 weeks | 20h | Ready |
| **TOTAL** | **10 weeks** | **190h** | **Ready for Implementation** |

**Team Composition** (Recommended):
- 1 Backend Engineer (Phase 1-2, 4 weeks)
- 1 Frontend Engineer (Phase 3, 2 weeks + Phase 3.1 for 1 week)
- 1 QA Engineer (Phase 4, 2 weeks + Phase 5 smoke tests)
- 1 DevOps Engineer (Phase 5, 1 week)

**Risk Mitigation**:
- ✓ Database migration tested on staging first
- ✓ Rollback procedure documented and tested
- ✓ Feature flags for gradual rollout
- ✓ Rate limiting prevents accidental bulk operations
- ✓ Audit trail enables compliance and debugging
- ✓ Version tracking prevents data overwrites

---

**Document Status**: ✅ Complete and Ready for Implementation

**Next Steps**:
1. Review specification with team
2. Get stakeholder approval
3. Create GitHub issues from implementation tasks
4. Assign tasks to engineers
5. Begin Phase 1 (Data Model)

