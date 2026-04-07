# Phase 5 Additional Fixes - Technical Specification

## Executive Summary & Goals

This specification addresses two critical issues in the Card-Benefits admin dashboard Phase 5 features:

1. **FIX #1 (CRITICAL)**: Edit Benefit Modal Type field pre-fill broken due to hardcoded VALID_TYPES enum mismatch
2. **FIX #2 (HIGH)**: Users page lacks comprehensive user editing—currently limited to "Change Role" button

### Primary Objectives
- ✅ Fix type field in EditBenefitModal to correctly pre-fill with actual database values (StatementCredit, UsagePerk)
- ✅ Replace "Change Role" button with full "Edit" functionality supporting all user fields
- ✅ Create EditUserModal component for comprehensive user editing
- ✅ Implement PATCH /api/admin/users/{userId} endpoint for full user updates
- ✅ Maintain backward compatibility with existing functionality
- ✅ Ensure dark mode and mobile responsiveness

### Success Criteria
- ✓ Type field pre-fills correctly with StatementCredit and UsagePerk values
- ✓ EditUserModal allows editing all user fields: firstName, lastName, email, isActive, role
- ✓ Email uniqueness validation prevents duplicate accounts
- ✓ All form validations work correctly with clear error messages
- ✓ No regressions in existing features
- ✓ Full test coverage for all user interactions
- ✓ Production deployment with zero downtime

---

## Functional Requirements

### FIX #1: Edit Benefit Modal Type Field

#### Current Behavior (Broken)
- EditBenefitModal has hardcoded `VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER']`
- Database actually contains benefits with type values: `'StatementCredit'` and `'UsagePerk'`
- When editing benefit with type='StatementCredit', pre-fill validation fails
- Form displays "Select a Type" placeholder instead of showing current value
- User cannot see which type is currently set

#### Root Cause Analysis
**Location**: `src/app/admin/_components/EditBenefitModal.tsx`

**Evidence**:
- Line 49: `const VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];`
- Line 55: Pre-fill logic: `const typeValue = benefit.type && VALID_TYPES.includes(benefit.type) ? benefit.type : '';`
- Line 78: Validation logic duplicates VALID_TYPES with same incorrect values

**Why It Fails**:
```
User opens EditBenefitModal with benefit.type = 'StatementCredit'
  ↓
Pre-fill logic: VALID_TYPES.includes('StatementCredit') → FALSE
  ↓
typeValue = '' (defaults to empty)
  ↓
SELECT element shows "Select a type" placeholder
  ↓
User cannot edit; sees no current value
  ↓
Actual database values used everywhere else:
  - src/types/index.ts: type: 'StatementCredit' | 'UsagePerk'
  - src/app/api/benefits/add/route.ts: ['StatementCredit', 'UsagePerk'].includes(body.type)
```

#### Requirements
- Update VALID_TYPES constant to match actual database enum values
- Create TYPE_OPTIONS for dropdown rendering with human-readable labels
- Update SELECT element to render correct options
- Ensure validation passes for actual benefit type values
- No API changes needed; benefits already stored with correct types

---

### FIX #2: Users Page - Edit User Modal

#### Current Behavior (Limited)
- Users page only has "Change Role" button (single-field edit)
- Cannot edit firstName, lastName, email, or isActive status
- Modal uses custom inline dialog (not component-based)
- No way to manage user activation/deactivation
- No way to correct user email or name information

#### Required Changes
Replace "Change Role" button with "Edit" button that opens EditUserModal allowing editing of:
- **firstName** (optional, text input, max 50 chars)
- **lastName** (optional, text input, max 50 chars)
- **email** (required, text input, email format, must be unique)
- **isActive** (boolean toggle: Enabled/Disabled)
- **role** (required, dropdown: USER | ADMIN | SUPER_ADMIN)

#### Database Schema Context
```typescript
model User {
  id              String          @id @default(cuid())
  email           String          @unique
  passwordHash    String
  firstName       String?         // Nullable
  lastName        String?         // Nullable
  emailVerified   Boolean         @default(false)
  role            UserRole        @default(USER)  // USER | ADMIN | SUPER_ADMIN
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}
```

#### User Roles & Permissions
- **USER**: Standard user account (cannot access admin functions)
- **ADMIN**: Can manage cards, benefits, and user roles
- **SUPER_ADMIN**: Full system access including user management and admin operations

#### System Constraints
- Email is UNIQUE in database; duplicate emails must be rejected (409 Conflict)
- firstName and lastName are optional but max 50 chars each if provided
- role must be one of the three valid enum values
- isActive can be toggled to deactivate users without deletion
- Session-based auth prevents self-demotion from admin role (existing pattern)
- Admin context verification required for all user operations

---

## Implementation Phases

### Phase 1: Data Schema & API Contract Validation (0.5 hours)
**Objectives**:
- Confirm VALID_TYPES discrepancy with actual database values
- Verify User schema supports all required fields
- Document API contract for new PATCH endpoint

**Deliverables**:
- Root cause analysis document with code evidence
- API contract specifications
- Type definitions for EditUserModal

**Dependencies**: None

---

### Phase 2: Type Field Fix (0.75 hours)
**Objectives**:
- Update VALID_TYPES to match actual database values
- Create TYPE_OPTIONS for dropdown rendering
- Update SELECT element to use TYPE_OPTIONS
- Test pre-fill logic with actual benefits

**Deliverables**:
- Updated EditBenefitModal.tsx with correct enums
- Verified pre-fill functionality
- No API changes needed

**Dependencies**: None (isolated component fix)

---

### Phase 3: New API Endpoint - PATCH /api/admin/users/{userId} (1.5 hours)
**Objectives**:
- Create new PATCH endpoint for comprehensive user updates
- Implement full validation (email uniqueness, role validation, field lengths)
- Add audit logging for user updates
- Handle all error cases with proper status codes

**Deliverables**:
- `src/app/api/admin/users/[id]/route.ts` (new file)
- PATCH handler with validation
- Audit log integration
- Error response types

**Dependencies**: Phase 1 (API contract)

---

### Phase 4: EditUserModal Component (1.25 hours)
**Objectives**:
- Create EditUserModal component based on EditBenefitModal pattern
- Implement form pre-fill, validation, and submission
- Add field-specific error handling
- Integrate with FormError component

**Deliverables**:
- `src/app/admin/_components/EditUserModal.tsx` (new file)
- Component props interface
- Form state management
- API integration

**Dependencies**: Phase 3 (API endpoint)

---

### Phase 5: Users Page Integration (0.75 hours)
**Objectives**:
- Import and wire EditUserModal into users page
- Replace "Change Role" button with "Edit" button
- Add modal state management (selectedUser, isEditModalOpen)
- Implement onClose and onSaved callbacks
- Remove old changeRole modal logic

**Deliverables**:
- Updated `src/app/admin/users/page.tsx`
- Modal state management
- Callback handlers

**Dependencies**: Phases 3 & 4 (API endpoint and component)

---

### Phase 6: Testing & QA (1 hour)
**Objectives**:
- Test type field pre-fill with StatementCredit and UsagePerk
- Test all user edit scenarios
- Verify form validation and error handling
- Test dark mode and responsive design
- Verify no console errors or regressions

**Deliverables**:
- Test execution report
- QA sign-off

**Dependencies**: All phases

---

## Data Schema / State Management

### FIX #1: Type Field Constants

**Location**: `src/app/admin/_components/EditBenefitModal.tsx`

**Current (WRONG)**:
```typescript
const VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];
```

**Corrected**:
```typescript
// Database enum values - actual benefit types in system
const VALID_TYPES = ['StatementCredit', 'UsagePerk'];

// Dropdown options with human-readable labels for UI
const TYPE_OPTIONS = [
  { value: 'StatementCredit', label: 'Statement Credit' },
  { value: 'UsagePerk', label: 'Usage Perk' },
];
```

**Changes Required**:
- Line 49: Replace VALID_TYPES array
- Line 78: Replace VALID_TYPES in validateForm()
- Add TYPE_OPTIONS constant
- Update SELECT element (lines 211-225) to render TYPE_OPTIONS instead of hardcoded options

---

### FIX #2: EditUserModal Form State

**Component State**:
```typescript
interface EditUserModalProps {
  user: AdminUser | null;      // Current user being edited
  isOpen: boolean;              // Modal visibility
  onClose: () => void;          // Close callback (user cancelled)
  onSaved: () => void;          // Save callback (user updated, refresh list)
}

interface FormData {
  firstName: string;            // Optional, max 50 chars
  lastName: string;             // Optional, max 50 chars
  email: string;                // Required, unique
  isActive: boolean;            // Required, toggle
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';  // Required
}

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  form?: string;  // General form error (e.g., server error)
}

interface ComponentState {
  formData: FormData;
  isSubmitting: boolean;
  formError: string | null;
  fieldErrors: Record<string, string>;
}
```

**Pre-Fill Logic**:
```typescript
useEffect(() => {
  if (isOpen && user) {
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email,
      isActive: user.isActive,
      role: user.role,
    });
    setFieldErrors({});
    setFormError(null);
  }
}, [isOpen, user]);
```

---

## User Flows & Workflows

### FIX #1: Type Field Pre-Fill Flow

**Happy Path**:
```
Admin Opens Edit Benefit Modal
  │
  ├─ Modal receives benefit with type='StatementCredit'
  │
  ├─ useEffect fires with isOpen=true
  │
  ├─ Pre-fill logic executes:
  │   VALID_TYPES = ['StatementCredit', 'UsagePerk']
  │   typeValue = VALID_TYPES.includes('StatementCredit') ? 'StatementCredit' : ''
  │   → typeValue = 'StatementCredit' ✓ (FIXED)
  │
  ├─ Form initializes with type='StatementCredit'
  │
  ├─ SELECT element renders TYPE_OPTIONS:
  │   <option value="">Select a type</option>
  │   <option value="StatementCredit">Statement Credit</option>
  │   <option value="UsagePerk">Usage Perk</option>
  │
  ├─ SELECT shows "Statement Credit" as selected value
  │
  ├─ Admin can:
  │   - Keep StatementCredit and save (no change)
  │   - Select UsagePerk and save (change type)
  │
  └─ Success: Benefit updated with correct type
```

**Error Path - Invalid Type in Database**:
```
Benefit has type='InvalidType' (data corruption)
  │
  ├─ Pre-fill: VALID_TYPES.includes('InvalidType') → FALSE
  │
  ├─ typeValue = '' (defaults to empty)
  │
  ├─ SELECT shows "Select a type" placeholder
  │
  ├─ Admin sees missing type, can fix by selecting valid type
  │
  └─ Validation on submit ensures valid type saved
```

---

### FIX #2: Edit User Modal Flow

**Happy Path - Full Edit**:
```
Admin Clicks "Edit" on Users Page
  │
  ├─ setSelectedUser(user)
  ├─ setIsEditModalOpen(true)
  │
  ├─ EditUserModal renders
  │
  ├─ useEffect pre-fills form:
  │   {
  │     firstName: user.firstName || '',
  │     lastName: user.lastName || '',
  │     email: user.email,
  │     isActive: user.isActive,
  │     role: user.role
  │   }
  │
  ├─ Admin edits fields:
  │   - firstName: 'John' → 'Jane'
  │   - email: 'old@example.com' → 'new@example.com'
  │   - isActive: true → false (deactivate)
  │   - role: 'USER' → 'ADMIN'
  │
  ├─ Admin clicks "Save"
  │
  ├─ Form validation:
  │   ✓ firstName length ≤ 50
  │   ✓ lastName length ≤ 50
  │   ✓ email is valid format
  │   ✓ role is valid enum
  │   → All pass
  │
  ├─ PATCH /api/admin/users/{user.id}
  │   Request:
  │   {
  │     firstName: 'Jane',
  │     lastName: user.lastName,
  │     email: 'new@example.com',
  │     isActive: false,
  │     role: 'ADMIN'
  │   }
  │
  ├─ Server validates & updates
  │
  ├─ Response 200:
  │   {
  │     user: { id, firstName, lastName, email, role, isActive, createdAt, updatedAt },
  │     message: 'User updated successfully'
  │   }
  │
  ├─ onSaved() callback
  │   - Close modal
  │   - Refresh user list (mutate SWR)
  │
  └─ Success: Users page shows updated data
```

**Error Path - Duplicate Email**:
```
Admin tries to change email to existing email
  │
  ├─ Form validation passes (email format is valid)
  │
  ├─ PATCH request sent
  │
  ├─ Server validates uniqueness:
  │   Email already exists in database
  │
  ├─ Response 409 Conflict:
  │   {
  │     success: false,
  │     error: 'Email already exists',
  │     code: 'EMAIL_DUPLICATE'
  │   }
  │
  ├─ Modal catches error
  │
  ├─ FormError component displays:
  │   "Email already exists"
  │
  ├─ Form stays open, user can fix email
  │
  └─ User fixes and retries
```

**Error Path - Invalid Email Format**:
```
Admin enters 'not-an-email'
  │
  ├─ User clicks Save
  │
  ├─ Client-side validation:
  │   email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) → false
  │
  ├─ fieldErrors.email = 'Invalid email format'
  │
  ├─ Form does NOT submit
  │
  ├─ Error message displays below email field
  │
  └─ User fixes and retries
```

**Error Path - Field Too Long**:
```
Admin enters firstName with 75 characters
  │
  ├─ User clicks Save
  │
  ├─ Client validation:
  │   firstName.length > 50 → true
  │
  ├─ fieldErrors.firstName = 'First name must be 50 characters or less'
  │
  ├─ Form does NOT submit
  │
  └─ Error message displays
```

**Cancellation Flow**:
```
Admin opens EditUserModal
  │
  ├─ Edits some fields
  │
  ├─ Decides to cancel
  │
  ├─ Clicks "Cancel" button
  │
  ├─ onClose() callback
  │
  ├─ Modal closes
  │
  ├─ Changes discarded
  │
  └─ Users page unaffected
```

---

## API Routes & Contracts

### FIX #1: No API Changes
Type field fix is purely frontend; no API changes needed.

---

### FIX #2: New PATCH Endpoint

#### Endpoint: `PATCH /api/admin/users/{userId}`

**Purpose**: Update user profile information (name, email, status, role)

**Authentication**: Required - Admin role (USER or higher cannot access)

**Path Parameters**:
```
userId: string (required)
  Description: Unique identifier of user to update
  Example: "cuid_12345678"
```

**Request Body Schema**:
```typescript
interface PatchUserRequest {
  firstName?: string | null;      // Optional, max 50 chars, can be null/empty
  lastName?: string | null;       // Optional, max 50 chars, can be null/empty
  email: string;                  // Required, must be unique, valid email format
  isActive: boolean;              // Required
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';  // Required, valid enum
}
```

**Request Example**:
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane.smith@company.com",
  "isActive": true,
  "role": "ADMIN"
}
```

**Request Example (Optional Fields Empty)**:
```json
{
  "firstName": null,
  "lastName": null,
  "email": "john@company.com",
  "isActive": true,
  "role": "USER"
}
```

---

#### Success Response: `200 OK`

```typescript
interface PatchUserResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    isActive: boolean;
    createdAt: string;              // ISO 8601 datetime
    updatedAt: string;              // ISO 8601 datetime
  };
  message: string;
}
```

**Response Example**:
```json
{
  "user": {
    "id": "cuid_12345678",
    "email": "jane.smith@company.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:30.000Z"
  },
  "message": "User updated successfully"
}
```

---

#### Error Responses

**400 Bad Request - Validation Error**:
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**400 Bad Request - Field Length**:
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "firstName",
      "message": "First name must be 50 characters or less"
    }
  ]
}
```

**400 Bad Request - Invalid Role**:
```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "role",
      "message": "Role must be USER, ADMIN, or SUPER_ADMIN"
    }
  ]
}
```

**401 Unauthorized - Not Authenticated**:
```json
{
  "success": false,
  "error": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

**403 Forbidden - Not Admin**:
```json
{
  "success": false,
  "error": "Admin role required",
  "code": "ADMIN_ROLE_REQUIRED"
}
```

**404 Not Found - User Does Not Exist**:
```json
{
  "success": false,
  "error": "User not found",
  "code": "USER_NOT_FOUND"
}
```

**409 Conflict - Email Already Exists**:
```json
{
  "success": false,
  "error": "Email already exists",
  "code": "EMAIL_DUPLICATE"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": "Failed to update user",
  "code": "SERVER_ERROR"
}
```

---

#### Validation Rules

**firstName**:
- Optional field (can be null or empty string)
- If provided: 1-50 characters
- Allowed characters: letters, numbers, spaces, hyphens, apostrophes
- Trimmed before storage

**lastName**:
- Optional field (can be null or empty string)
- If provided: 1-50 characters
- Allowed characters: letters, numbers, spaces, hyphens, apostrophes
- Trimmed before storage

**email**:
- Required
- Must match RFC 5322 email format pattern
- Must be UNIQUE in database (case-insensitive comparison)
- Max 255 characters
- Trimmed before storage
- Lowercase comparison for uniqueness check

**isActive**:
- Required boolean
- true = user can access system
- false = user deactivated, cannot log in

**role**:
- Required enum
- Valid values: 'USER', 'ADMIN', 'SUPER_ADMIN'
- Must be exactly one of these values
- Cannot self-demote (admin cannot remove own admin role) - handled by existing role endpoint

---

#### Audit Logging

On successful update, log to AdminAuditLog:
```typescript
{
  actionType: 'UPDATE',
  resourceType: 'USER_ROLE',
  resourceId: user.id,
  resourceName: user.email,
  oldValues: {
    firstName: previousFirstName,
    lastName: previousLastName,
    email: previousEmail,
    isActive: previousIsActive,
    role: previousRole
  },
  newValues: {
    firstName: newFirstName,
    lastName: newLastName,
    email: newEmail,
    isActive: newIsActive,
    role: newRole
  },
  ipAddress: extractedFromRequest,
  userAgent: extractedFromRequest
}
```

---

## Component Architecture

### Component Hierarchy

```
Admin Dashboard
  ├─ UsersPage (src/app/admin/users/page.tsx)
  │   ├─ AdminBreadcrumb (existing)
  │   ├─ Search Input
  │   ├─ Users Table
  │   │   └─ Edit Button (NEW - replaces Change Role)
  │   ├─ Pagination Controls
  │   └─ EditUserModal (NEW) ← Opens on Edit click
  │
  └─ AdminBenefitsPage (existing)
      └─ EditBenefitModal (UPDATED)
          └─ Type SELECT (FIXED - correct VALID_TYPES)
```

---

### EditUserModal Component Specification

**Location**: `src/app/admin/_components/EditUserModal.tsx`

**Purpose**: Modal dialog for editing user profile (name, email, status, role)

**Props**:
```typescript
interface EditUserModalProps {
  user: AdminUser | null;         // User data to edit (null when closed)
  isOpen: boolean;                // Modal visibility
  onClose: () => void;            // Callback when user cancels
  onSaved: () => void;            // Callback when user successfully saved
}
```

**Component Structure**:
```
EditUserModal
├─ Radix DialogPrimitive.Root
│   ├─ DialogPrimitive.Overlay (semi-transparent background)
│   └─ DialogPrimitive.Content (modal card)
│       ├─ Header
│       │   ├─ Title: "Edit User"
│       │   └─ Close Button (X icon)
│       │
│       ├─ Body
│       │   ├─ FormError (displays general form errors)
│       │   └─ Form
│       │       ├─ firstName Input
│       │       │   └─ Field Error (if validation fails)
│       │       ├─ lastName Input
│       │       │   └─ Field Error
│       │       ├─ email Input
│       │       │   └─ Field Error
│       │       ├─ isActive Checkbox/Toggle
│       │       │   └─ Field Error
│       │       ├─ role SELECT
│       │       │   └─ Field Error
│       │       │
│       │       └─ Action Buttons
│       │           ├─ Cancel Button
│       │           └─ Save Button (disabled while submitting)
```

**Form Fields**:

1. **firstName** (Text Input)
   - Max length: 50 characters
   - Optional (can be empty)
   - Placeholder: "John"
   - Real-time validation on blur
   - Display count: "0/50 characters"

2. **lastName** (Text Input)
   - Max length: 50 characters
   - Optional (can be empty)
   - Placeholder: "Doe"
   - Real-time validation on blur

3. **email** (Text Input)
   - Required field
   - Type: "email"
   - Real-time format validation
   - Placeholder: "user@example.com"
   - Help text: "Must be unique"

4. **isActive** (Checkbox/Toggle)
   - Label: "Enabled" when true, "Disabled" when false
   - Toggle with immediate visual feedback
   - Help text: "Unchecking prevents user login"

5. **role** (SELECT Dropdown)
   - Options: 
     - USER
     - ADMIN
     - SUPER_ADMIN
   - Required field
   - Default to current user's role

**Form Behavior**:

- **Pre-fill**: On modal open, populate all fields from `user` prop
- **Field Errors**: Display below each field on validation failure
- **Form Error**: Display above form for general errors (server errors, duplicate email)
- **Submit Disabled**: While `isSubmitting` is true
- **Input Disabled**: All inputs disabled during submission
- **On Cancel**: Close modal without saving changes
- **On Save**: 
  1. Validate all fields client-side
  2. If errors, display them and return
  3. If valid, set `isSubmitting = true`
  4. POST to `/api/admin/users/{user.id}` with form data
  5. On success: call `onSaved()` callback
  6. On error: display error message and allow retry

**Styling**:
- Dark mode support (use dark: prefixes)
- Responsive: mobile-first, works on 320px+ screens
- Matches existing admin components (borders, colors, spacing)
- Radix Dialog styling consistent with EditBenefitModal
- Form inputs use same classes as other admin forms

**API Integration**:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  setFormError(null);
  setFieldErrors({});

  try {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    const response = await apiClient.patch(`/users/${user.id}`, {
      firstName: formData.firstName || null,
      lastName: formData.lastName || null,
      email: formData.email.trim(),
      isActive: formData.isActive,
      role: formData.role,
    });

    if (response.success) {
      onSaved();
    } else {
      setFormError(response.error || 'Failed to update user');
    }
  } catch (err) {
    const message = getErrorMessage(err);
    setFormError(message);
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### UsersPage Updates

**Location**: `src/app/admin/users/page.tsx`

**Changes Required**:

1. **Import EditUserModal**:
   ```typescript
   import { EditUserModal } from '../_components/EditUserModal';
   ```

2. **Add State**:
   ```typescript
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [selectedUserForEdit, setSelectedUserForEdit] = useState<AdminUser | null>(null);
   ```

3. **Replace Change Role Button** (line 330-339):
   - Remove: "Change Role" button and associated logic
   - Add: "Edit" button that triggers:
     ```typescript
     const handleEditClick = (user: AdminUser) => {
       setSelectedUserForEdit(user);
       setIsEditModalOpen(true);
     };
     ```

4. **Add Modal to JSX** (after role modal, before closing div):
   ```typescript
   <EditUserModal
     user={selectedUserForEdit}
     isOpen={isEditModalOpen}
     onClose={() => setIsEditModalOpen(false)}
     onSaved={() => {
       setIsEditModalOpen(false);
       mutate();  // Refresh user list via SWR
     }}
   />
   ```

5. **Remove Old Role Modal Code**:
   - Remove `roleModalOpen` state if only used for "Change Role"
   - Remove `selectedUser` and `newRole` states if only used for role change
   - Remove `handleRoleChange` function
   - Remove inline role change modal JSX (lines 373-422)

---

### EditBenefitModal Updates

**Location**: `src/app/admin/_components/EditBenefitModal.tsx`

**Changes Required**:

1. **Replace Line 49** (VALID_TYPES):
   ```typescript
   // Before:
   const VALID_TYPES = ['INSURANCE', 'CASHBACK', 'TRAVEL', 'BANKING', 'POINTS', 'OTHER'];

   // After:
   const VALID_TYPES = ['StatementCredit', 'UsagePerk'];
   ```

2. **Add TYPE_OPTIONS** (after VALID_TYPES):
   ```typescript
   const TYPE_OPTIONS = [
     { value: 'StatementCredit', label: 'Statement Credit' },
     { value: 'UsagePerk', label: 'Usage Perk' },
   ];
   ```

3. **Replace Line 78** (validateForm VALID_TYPES):
   ```typescript
   // Change from hardcoded array to use constant:
   if (!VALID_TYPES.includes(formData.type)) {
   ```

4. **Update SELECT Element** (lines 211-225):
   ```typescript
   // Before:
   <select>
     <option value="">Select a type</option>
     <option value="INSURANCE">Insurance</option>
     <option value="CASHBACK">Cashback</option>
     {/* ... etc */}
   </select>

   // After:
   <select>
     <option value="">Select a type</option>
     {TYPE_OPTIONS.map((opt) => (
       <option key={opt.value} value={opt.value}>
         {opt.label}
       </option>
     ))}
   </select>
   ```

---

## Implementation Tasks

### Task 1.1: Fix EditBenefitModal Type Field
**Phase**: 2  
**Complexity**: Small  
**Estimated Time**: 30 minutes  
**Dependencies**: None

**Description**:
Update VALID_TYPES constant in EditBenefitModal to match actual database values, and create TYPE_OPTIONS for rendering.

**Acceptance Criteria**:
- [ ] VALID_TYPES updated to ['StatementCredit', 'UsagePerk']
- [ ] TYPE_OPTIONS created with correct labels
- [ ] SELECT element renders only 2 options
- [ ] Pre-fill works: edit benefit with type='StatementCredit' shows "Statement Credit" selected
- [ ] Pre-fill works: edit benefit with type='UsagePerk' shows "Usage Perk" selected
- [ ] Validation accepts both valid types
- [ ] Validation rejects invalid types
- [ ] No TypeScript errors
- [ ] Component renders without console errors

---

### Task 2.1: Create PATCH /api/admin/users/{userId} Endpoint
**Phase**: 3  
**Complexity**: Medium  
**Estimated Time**: 60 minutes  
**Dependencies**: None

**Description**:
Create new PATCH endpoint at `src/app/api/admin/users/[id]/route.ts` for comprehensive user updates.

**Acceptance Criteria**:
- [ ] File created: `src/app/api/admin/users/[id]/route.ts`
- [ ] PATCH handler implemented
- [ ] Admin role verification with proper error handling
- [ ] Request body validation:
  - [ ] firstName: optional, max 50 chars if provided
  - [ ] lastName: optional, max 50 chars if provided
  - [ ] email: required, valid format, unique check
  - [ ] isActive: required boolean
  - [ ] role: required, valid enum (USER | ADMIN | SUPER_ADMIN)
- [ ] Database update executes correctly
- [ ] Response includes updated user object with all fields
- [ ] Email uniqueness constraint checked (409 on duplicate)
- [ ] Audit logging implemented for update
- [ ] Error responses match specification:
  - [ ] 400 for validation errors with field details
  - [ ] 401 for missing authentication
  - [ ] 403 for insufficient permissions
  - [ ] 404 for user not found
  - [ ] 409 for duplicate email
  - [ ] 500 for server errors
- [ ] Console logging on errors
- [ ] No TypeScript errors

---

### Task 2.2: Create EditUserModal Component
**Phase**: 4  
**Complexity**: Medium  
**Estimated Time**: 75 minutes  
**Dependencies**: Task 2.1

**Description**:
Create EditUserModal component for editing user profile information.

**Acceptance Criteria**:
- [ ] File created: `src/app/admin/_components/EditUserModal.tsx`
- [ ] Component accepts required props: user, isOpen, onClose, onSaved
- [ ] Form pre-fill on modal open with all user fields
- [ ] Form state management for firstName, lastName, email, isActive, role
- [ ] Field-level error display
- [ ] Form-level error display
- [ ] Client-side validation:
  - [ ] firstName: max 50 chars
  - [ ] lastName: max 50 chars
  - [ ] email: required, valid format
  - [ ] role: required, valid enum
- [ ] Submit disabled while loading
- [ ] PATCH request to `/api/admin/users/{user.id}`
- [ ] Success: call onSaved() callback
- [ ] Error: display FormError component
- [ ] Cancel button closes modal without saving
- [ ] Dark mode support (all elements styled correctly)
- [ ] Mobile responsive (works on 320px screens)
- [ ] Radix Dialog integration
- [ ] No console errors
- [ ] No TypeScript errors

---

### Task 2.3: Update Users Page Integration
**Phase**: 5  
**Complexity**: Small  
**Estimated Time**: 45 minutes  
**Dependencies**: Tasks 2.1 & 2.2

**Description**:
Integrate EditUserModal into users page and replace "Change Role" button.

**Acceptance Criteria**:
- [ ] EditUserModal imported
- [ ] State added: isEditModalOpen, selectedUserForEdit
- [ ] "Edit" button renders for each user
- [ ] Edit button click sets selectedUser and opens modal
- [ ] Modal callbacks implemented:
  - [ ] onClose: closes modal
  - [ ] onSaved: closes modal and calls mutate() to refresh list
- [ ] Old "Change Role" button removed
- [ ] Old roleModalOpen state removed (if no longer used)
- [ ] Old role change modal HTML removed
- [ ] EditUserModal renders correctly
- [ ] Page displays updated users after save
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Pagination still works
- [ ] Search still works
- [ ] Sorting still works

---

### Task 3.1: Test Type Field Fix
**Phase**: 6  
**Complexity**: Small  
**Estimated Time**: 20 minutes  
**Dependencies**: Task 1.1

**Description**:
Test EditBenefitModal type field pre-fill and dropdown functionality.

**Acceptance Criteria**:
- [ ] Test: Edit benefit with type='StatementCredit' pre-fills correctly
- [ ] Test: Edit benefit with type='UsagePerk' pre-fills correctly
- [ ] Test: Dropdown shows exactly 2 options
- [ ] Test: Can select StatementCredit option without errors
- [ ] Test: Can select UsagePerk option without errors
- [ ] Test: Can submit form with each valid type
- [ ] Test: Dark mode displays correctly
- [ ] Test: Mobile view responsive
- [ ] No console errors during test
- [ ] Test results documented

---

### Task 3.2: Test EditUserModal & PATCH Endpoint
**Phase**: 6  
**Complexity**: Medium  
**Estimated Time**: 40 minutes  
**Dependencies**: Tasks 2.1, 2.2, 2.3

**Description**:
Comprehensive testing of user edit functionality.

**Acceptance Criteria**:
- [ ] Test: Modal opens when Edit clicked
- [ ] Test: Form pre-fills with user data
- [ ] Test: Edit firstName and save updates correctly
- [ ] Test: Edit lastName and save updates correctly
- [ ] Test: Edit email and save updates correctly
- [ ] Test: Edit isActive toggle and save updates correctly
- [ ] Test: Edit role and save updates correctly
- [ ] Test: Edit multiple fields together and all update
- [ ] Test: Cancel button closes without saving
- [ ] Test: Empty firstName allowed (optional)
- [ ] Test: Empty lastName allowed (optional)
- [ ] Test: firstName > 50 chars shows validation error
- [ ] Test: lastName > 50 chars shows validation error
- [ ] Test: Invalid email format shows validation error
- [ ] Test: Duplicate email shows 409 error
- [ ] Test: Invalid role shows validation error
- [ ] Test: Form submission disabled while loading
- [ ] Test: Server errors display with retry capability
- [ ] Test: Dark mode displays correctly
- [ ] Test: Mobile responsive (320px+)
- [ ] Test: No console errors
- [ ] Test results documented

---

### Task 3.3: Regression Testing
**Phase**: 6  
**Complexity**: Small  
**Estimated Time**: 20 minutes  
**Dependencies**: All implementation tasks

**Description**:
Verify no regressions in existing features.

**Acceptance Criteria**:
- [ ] Existing benefits edit still works
- [ ] Card management still works
- [ ] User list pagination still works
- [ ] User list search still works
- [ ] User list sorting still works
- [ ] Audit logging still working
- [ ] Dark mode theme toggle still works
- [ ] No TypeScript build errors
- [ ] No runtime console errors
- [ ] All existing tests pass

---

## Edge Cases & Error Handling

### FIX #1: Type Field Edge Cases

**Edge Case 1.1**: Benefit with null type
- **Scenario**: Database has benefit with type=null
- **Current Behavior**: Fails validation
- **Expected Handling**: 
  - Pre-fill: typeValue = '' (shows "Select a type")
  - User must select a type before saving
  - Submit validation: type required error

**Edge Case 1.2**: Benefit with invalid/deprecated type
- **Scenario**: Old data with type='INSURANCE' from legacy system
- **Current Behavior**: Pre-fill fails, shows "Select a type"
- **Expected Handling**:
  - Pre-fill: typeValue = ''
  - User sees "Select a type" placeholder
  - User can select StatementCredit or UsagePerk
  - Data migration handled separately
  - Validation prevents saving old types

**Edge Case 1.3**: Type field with leading/trailing spaces
- **Scenario**: benefit.type = ' StatementCredit '
- **Current Behavior**: VALID_TYPES.includes() fails
- **Expected Handling**:
  - Add trim() to comparison: benefit.type?.trim()
  - Pre-fill correctly
  - Validation handles trimmed values

**Edge Case 1.4**: Case sensitivity
- **Scenario**: benefit.type = 'statementcredit' (lowercase)
- **Current Behavior**: Case-sensitive comparison fails
- **Expected Handling**:
  - Database should use exact case
  - No case variation expected if schema enforced
  - Assume database is consistent
  - If needed: use case-insensitive comparison

---

### FIX #2: Edit User Modal Edge Cases

**Edge Case 2.1**: User email matches another user's email
- **Scenario**: Admin tries to change user1@ex.com to user2@ex.com (already exists)
- **Handling**:
  - Client-side: passes email format validation
  - Server validates uniqueness
  - Response: 409 Conflict with `{ error: 'Email already exists', code: 'EMAIL_DUPLICATE' }`
  - Modal displays error message
  - Form stays open for correction

**Edge Case 2.2**: Email changed to current email (no actual change)
- **Scenario**: User currently has "john@ex.com", admin "changes" to "john@ex.com"
- **Handling**:
  - No unique constraint violation (same user)
  - Database UPDATE executes
  - Returns 200 success
  - No error displayed

**Edge Case 2.3**: Empty firstName and lastName
- **Scenario**: Admin clears both name fields (both null)
- **Handling**:
  - Client validation: optional fields pass
  - Server accepts: firstName=null, lastName=null
  - formatUserName() utility handles gracefully → 'N/A'
  - User list displays 'N/A' for name

**Edge Case 2.4**: Admin deactivates own account
- **Scenario**: Admin user deactivates themselves (isActive: true → false)
- **Handling**:
  - No technical prevention (unlike role self-demotion)
  - Server allows deactivation
  - User can no longer log in on next session
  - Another admin must reactivate
  - Warning: Could add client-side confirmation modal later

**Edge Case 2.5**: Field length validation - exactly at limit
- **Scenario**: firstName = 'A'.repeat(50) (exactly 50 chars)
- **Handling**:
  - Client validation: firstName.length <= 50 → TRUE
  - Server validation: same check passes
  - Update succeeds

**Edge Case 2.6**: Field length validation - one char over
- **Scenario**: firstName = 'A'.repeat(51) (51 chars)
- **Handling**:
  - Client validation: firstName.length <= 50 → FALSE
  - fieldErrors.firstName = 'First name must be 50 characters or less'
  - Form does NOT submit
  - Error displays below field

**Edge Case 2.7**: Invalid email format variations
- **Scenario**: Admin enters various invalid emails
  - 'notanemail' (no @)
  - '@example.com' (no local part)
  - 'user@' (no domain)
  - 'user @example.com' (space in local)
- **Handling**:
  - Client regex validation fails for all
  - fieldErrors.email = 'Invalid email format'
  - Form does NOT submit

**Edge Case 2.8**: Email with special valid characters
- **Scenario**: Admin enters 'user+tag@example.co.uk'
- **Handling**:
  - Email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` matches
  - Server-side validation: RFC 5322 compatible
  - Accepts email
  - Update succeeds

**Edge Case 2.9**: Role enum mismatch
- **Scenario**: Frontend somehow sends role='SUPERUSER' (typo)
- **Handling**:
  - Client validation: SELECT only allows USER | ADMIN | SUPER_ADMIN
  - Cannot select invalid role
  - Server validation: validates against enum
  - If somehow received: 400 error with `{ field: 'role', message: 'Invalid role' }`

**Edge Case 2.10**: Concurrent updates (race condition)
- **Scenario**: Two admins edit same user simultaneously
  - Admin1 changes email
  - Admin2 changes role
  - Both submit before either completes
- **Handling**:
  - Database: Last write wins (PostgreSQL default)
  - No transaction/versioning in spec
  - Both updates could overwrite each other
  - Refresh list shows final state
  - Current implementation acceptable for low-concurrency admin use

**Edge Case 2.11**: Network timeout during PATCH
- **Scenario**: Request to PATCH endpoint hangs/timeout
- **Handling**:
  - After ~30s: request timeout
  - catch() block catches error
  - setFormError() displays: "Network timeout, please try again"
  - isSubmitting = false
  - User can retry

**Edge Case 2.12**: Server returns unexpected error format
- **Scenario**: API returns non-standard error response
- **Handling**:
  - getErrorMessage() helper parses response
  - Falls back to generic message if needed
  - Displays in FormError component
  - Error message shown, user can retry

**Edge Case 2.13**: User deleted during edit modal open
- **Scenario**: User edits admin opens EditUserModal
- **Scenario**: Different admin deletes that user
- **Scenario**: First admin tries to save changes
- **Handling**:
  - PATCH endpoint checks if user exists
  - Returns 404: User not found
  - Modal displays error
  - User can close modal and refresh list

**Edge Case 2.14**: Page loses auth/session expires
- **Scenario**: Session expires while form open
- **Scenario**: User submits form
- **Handling**:
  - PATCH endpoint: verifyAdminRole() fails
  - Returns 401 Unauthorized
  - Modal displays error
  - Redirect to login (handled by auth middleware)

**Edge Case 2.15**: Modal rapidly opened/closed
- **Scenario**: User clicks Edit, immediately closes, clicks Edit again
- **Handling**:
  - State updates handled correctly
  - formData cleared on close
  - Pre-fill runs on next open
  - No stale data

---

## Security & Compliance Considerations

### Authentication & Authorization

**Authentication Strategy**:
- Existing session-based auth via cookies
- Verified by `verifyAdminRole()` middleware
- Session expires per existing policy

**Authorization Strategy**:
- Admin role required for both endpoints
- verifyAdminRole() enforces on all operations
- USER role cannot access: cannot view other users, cannot edit other users
- ADMIN role: can edit all users except cannot demote self from ADMIN
- SUPER_ADMIN role: full access

**Current Implementation Pattern** (existing role endpoint):
```typescript
try {
  adminContext = await verifyAdminRole(request);
} catch (error) {
  const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
  return createAuthErrorResponse(code);
}
```

**To Apply to New Endpoint**:
- Use same `verifyAdminRole()` pattern
- Extract adminContext for audit logging
- Return createAuthErrorResponse() on auth failure

### Data Protection & Privacy

**Email Privacy**:
- Email is unique identifier; visible only to authenticated admins
- Stored as-is in database
- No hashing (used for login verification elsewhere)
- Transmitted over HTTPS only (Next.js enforces)

**Name Information**:
- firstName/lastName optional; not PII for system
- No encryption needed; accessible by admins
- Audit logs record changes

**isActive Field**:
- Deactivation is soft-delete equivalent
- No personal data deleted
- Historical records preserved
- Can be reactivated

**Role Information**:
- Access control; visible to admins only
- Logged in audit trail

### Audit & Logging Requirements

**All User Updates Must Log**:
- adminUserId: who made the change
- actionType: 'UPDATE'
- resourceType: 'USER_ROLE' (or new 'USER' type)
- resourceId: target user ID
- resourceName: target user email
- oldValues: previous firstName, lastName, email, role, isActive
- newValues: new firstName, lastName, email, role, isActive
- ipAddress: from request
- userAgent: from request headers
- timestamp: now()

**Audit Log Response**:
See existing pattern in role endpoint (lines 150-159):
```typescript
await logResourceUpdate(
  adminContext,
  'USER_ROLE',
  updatedUser.id,
  updatedUser.email,
  { role: targetUser.role },
  { role: updatedUser.role },
  ipAddress,
  userAgent
);
```

### Input Validation & Sanitization

**firstName / lastName**:
- Trim whitespace
- Enforce 50-char max (prevents database issues)
- Allow alphanumeric + spaces + hyphens + apostrophes
- No validation against injection (stored as text, used as display only)

**Email**:
- Trim whitespace
- Validate RFC 5322 format
- Lowercase for case-insensitive comparison
- Max 255 chars (database column size)
- Unique constraint enforced by database

**role**:
- Enum validation: must be USER | ADMIN | SUPER_ADMIN
- No string manipulation

**isActive**:
- Boolean type; no injection risk

**Client-Side XSS Prevention**:
- All form inputs rendered as controlled components
- No dangerouslySetInnerHTML usage
- User data displayed via React (auto-escaped)
- FormError uses pre-escaped messages

---

## Performance & Scalability Considerations

### Expected Load

**User Management Operations**:
- Typical admin user: manages 5-50 user accounts
- Burst: admin bulk-edits 10 users in quick succession
- Concurrent admins: 2-10 simultaneous sessions

**Database Impact**:
- Each PATCH: 1 SELECT (find user) + 1 UPDATE + 1 INSERT (audit log)
- With indexes on User.id, User.email: queries < 10ms
- Audit log append: < 5ms
- Total per operation: ~20ms expected

### Caching Strategies

**Frontend**:
- SWR cache: users list cached with stale-while-revalidate
- On successful save: call mutate() to refresh
- No need for aggressive caching (admins accept slight delay)

**Backend**:
- No caching needed; user data changes infrequently
- Each request fresh from database

**Email Uniqueness Check**:
- Database constraint handles
- No need for Redis/cache for uniqueness

### Database Optimization

**Indexes** (all exist in schema):
```
User.id (primary key index)
User.email (unique index) - used for duplicate check
User.role (index) - used for filtering
User.isActive (index) - used for filtering
```

**Query Optimization**:
- PATCH endpoint: 1 SELECT by ID (index hit) + 1 UPDATE by ID + 1 INSERT
- No joins needed
- Minimal data transfer

**No Need For**:
- Sharding (user count < 100k typical)
- Read replicas (admin operations infrequent)
- Query pagination (PATCH single user, not list)

### Rate Limiting & Throttling

**Existing Pattern**:
- Admin endpoints rate-limited: 100 requests/minute per admin
- Applied to GET /api/admin/users
- Should apply to PATCH too (use same pattern)

**Expected Impact**:
- Negligible; even 100 edits/min = normal
- Could lower to 50/min for edit operations if needed
- Current 100/min sufficient

### Load Handling

**Light Load** (typical):
- 1-2 users edited per minute
- No performance issues

**Heavy Load** (unlikely):
- 50 users edited per minute
- 20ms per operation = 1 second cumulative per minute
- Well within capacity

**Scaling Future**:
- If > 1000 users: consider read-only replica for GET /api/admin/users
- If > 100k users: consider pagination optimization (already paginated)
- Current impl scales easily to 10k+ users

---

## Quality Control Checklist

### Specification Quality
- ✅ All user requirements addressed
- ✅ Root cause analysis with code evidence provided
- ✅ Data schema fully documented
- ✅ API contract complete with all error cases
- ✅ Component specifications precise and testable
- ✅ Implementation tasks specific and measurable
- ✅ Edge cases identified and handling documented
- ✅ Security considerations addressed
- ✅ Performance implications analyzed

### Implementation Readiness
- ✅ Clear file locations and existing patterns documented
- ✅ API request/response schemas with examples
- ✅ Form validation rules explicit
- ✅ Error handling strategy defined
- ✅ Audit logging requirements clear
- ✅ Database schema confirmed compatible
- ✅ No ambiguous requirements

### Testing Coverage
- ✅ Type field: pre-fill, dropdown, validation
- ✅ User edit: all fields, validation, error cases
- ✅ API: success and error paths
- ✅ Integration: page to modal to API to list refresh
- ✅ Dark mode and responsive design
- ✅ Regression testing specified

### Deployment Readiness
- ✅ No breaking changes to existing APIs
- ✅ Backward compatible with existing features
- ✅ Database changes: none (schema already compatible)
- ✅ No migration scripts needed
- ✅ Feature flags: not needed for phased rollout
- ✅ Rollback: simple code revert if needed

---

## Next Steps

### Handoff to Full-Stack Engineer
1. Review specification for clarity
2. Ask for clarifications on ambiguous requirements
3. Implement Phase 2 (Type Field Fix) - 30 min
4. Implement Phase 3 (PATCH Endpoint) - 60 min
5. Implement Phase 4 (EditUserModal) - 75 min
6. Implement Phase 5 (Integration) - 45 min
7. Test & QA - 60 min
8. Deploy to production

**Total Estimated Time**: ~3.5 hours implementation + testing

---

## References

### Existing Patterns in Codebase

**EditBenefitModal Pattern**:
- Location: `src/app/admin/_components/EditBenefitModal.tsx`
- Use as template for EditUserModal structure
- Pre-fill logic, form handling, API integration

**Role Endpoint Pattern**:
- Location: `src/app/api/admin/users/[id]/role/route.ts`
- Use for PATCH endpoint structure
- Auth verification, request parsing, audit logging

**Admin Validation**:
- Location: `src/features/admin/validation/schemas.ts`
- Use for form schema definitions
- Zod integration

**API Client**:
- Location: `src/features/admin/lib/api-client.ts`
- Use for PATCH calls: `apiClient.patch('/users/{id}', data)`
- Error handling via getErrorMessage()

**Audit Logging**:
- Location: `src/features/admin/lib/audit.ts`
- logResourceUpdate() function
- Inject into PATCH endpoint

---

## Appendix: Related Files

```
Key Files to Modify:
- src/app/admin/_components/EditBenefitModal.tsx (FIX #1)
- src/app/admin/_components/EditUserModal.tsx (NEW - FIX #2)
- src/app/admin/users/page.tsx (UPDATE - FIX #2)
- src/app/api/admin/users/[id]/route.ts (NEW - FIX #2)

Reference Files (patterns):
- src/app/api/admin/users/[id]/role/route.ts
- src/app/api/admin/benefits/[id]/route.ts
- src/features/admin/types/admin.ts
- src/features/admin/validation/schemas.ts
- src/features/admin/lib/api-client.ts
- src/features/admin/lib/audit.ts

Database Schema:
- prisma/schema.prisma (User model, UserRole enum)
```

---

**Specification Status**: READY FOR IMPLEMENTATION  
**Last Updated**: 2024-01-20  
**Version**: 1.0
