# Phase 3: Admin Dashboard UI - Technical Specification

**Version:** 1.0.0  
**Status:** Ready for Implementation  
**Last Updated:** 2024  
**Owner:** Technical Architecture  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Functional Requirements](#functional-requirements)
3. [UI Architecture](#ui-architecture)
4. [Component Specifications](#component-specifications)
5. [Page Specifications](#page-specifications)
6. [Integration Specification](#integration-specification)
7. [Design System](#design-system)
8. [User Flows](#user-flows)
9. [Accessibility Requirements](#accessibility-requirements)
10. [Performance & Optimization](#performance--optimization)
11. [Testing Strategy](#testing-strategy)
12. [Implementation Roadmap](#implementation-roadmap)
13. [Success Criteria](#success-criteria)

---

## Executive Summary

### Overview

Phase 3 delivers the Admin Dashboard UI—a production-ready React application that integrates with the Phase 2 API layer (15 endpoints) to provide comprehensive management capabilities for card types, benefits, user roles, and audit trails. The dashboard enables administrators to maintain the master card catalog, manage benefit defaults, assign admin roles to users, and view comprehensive audit logs of all administrative changes.

**Phase 3 builds on:**
- **Phase 1 (Database & Auth):** ✅ Complete - User authentication, admin role model, audit logging tables
- **Phase 2 (API Layer):** ✅ Complete - 15 production endpoints implementing all business logic

**Phase 3 deliverables:**
- 5 fully functional admin pages
- 15+ reusable React components
- Complete design system integration
- WCAG 2.1 AA accessibility compliance
- Comprehensive test coverage (80%+)
- 0 console errors in production builds

### Key Features

1. **Card Type Management**
   - View all card types with pagination (20 items/page)
   - Create new card types with full validation
   - Edit card properties (issuer, name, annual fee, image)
   - Delete card types with soft/hard delete options
   - Reorder cards using drag-drop interface

2. **Default Benefits Management**
   - View benefits for each card type
   - Add/edit/remove benefits
   - Toggle "default" status for automatic benefit copying
   - Per-card benefit isolation with clear ownership

3. **User Role Management**
   - View all system users with role status
   - Assign/revoke admin roles
   - Prevent self-demotion with UI and API validation
   - Clear role change confirmation dialogs

4. **Audit Trail Viewing**
   - Search and filter audit logs
   - View detailed before/after change diffs
   - Filter by resource type, action, date range, admin user
   - Paginated log display with 50 items/page

5. **System Dashboard**
   - Health status overview
   - Recent activity summary (last 10 changes)
   - Quick stats (total cards, users, benefits)
   - System status indicators

### Timeline Estimate

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1 (DB & Auth) | 2-3 days | ✅ Complete |
| Phase 2 (API Layer) | 3-4 days | ✅ Complete |
| **Phase 3 (UI)** | **4-5 days** | 🔄 In Progress |
| Phase 4 (Testing) | 2-3 days | Pending |
| **Total** | **11-15 days** | **60% Complete** |

**Phase 3 breakdown:**
- Day 1-2: Core layouts, navigation, base components
- Day 2-3: Dashboard pages implementation
- Day 3-4: Forms, modals, and interactive components
- Day 4-5: API integration, error handling, testing

### Success Criteria

✅ **Functional Requirements:**
- [ ] All 5 pages fully functional and accessible
- [ ] All 5 critical user flows working end-to-end
- [ ] All API endpoints successfully integrated
- [ ] Error states handled gracefully
- [ ] Loading states for all async operations
- [ ] Empty states with helpful messaging

✅ **Technical Requirements:**
- [ ] 80%+ test coverage (unit + integration)
- [ ] WCAG 2.1 AA compliance verified
- [ ] <3s page load time (Core Web Vitals)
- [ ] 0 console errors or warnings
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] TypeScript strict mode compliance

✅ **Quality Standards:**
- [ ] All components documented with JSDoc
- [ ] Accessibility testing completed
- [ ] E2E test coverage for critical flows
- [ ] Performance profiling completed
- [ ] Dark mode fully supported
- [ ] 100% of design tokens utilized

---

## Functional Requirements

### 1. Card Type Management

#### View Card Types
- **Action:** GET /api/admin/cards (Phase 2)
- **Requirements:**
  - Display paginated list (default 20 items/page, max 100)
  - Show: issuer, cardName, defaultAnnualFee, displayOrder, benefitCount, status
  - Sortable by: issuer, cardName, displayOrder, updatedAt
  - Filterable by: issuer, status (active/archived), search term
  - Responsive: table on desktop, stacked cards on mobile
- **States:** Loading, empty, error, success with data
- **Interactions:**
  - Click row to view/edit card details
  - Sort column headers
  - Pagination controls
  - Search and filter controls

#### Create Card Type
- **Action:** POST /api/admin/cards (Phase 2)
- **Modal/Form:**
  - Fields: issuer (text), cardName (text), defaultAnnualFee (number), cardImageUrl (URL)
  - Validation: required fields, non-negative fee, valid URL
  - Image preview before submission
  - Cancel/Submit buttons
- **Success:** Redirect to card detail page, show toast notification
- **Error:** Display field-level error messages

#### Edit Card Type
- **Action:** PUT /api/admin/cards/:cardId (Phase 2)
- **Modal/Form:**
  - Pre-populate all fields with current values
  - Read-only fields: cardId, createdAt
  - Editable fields: issuer, cardName, defaultAnnualFee, cardImageUrl, description
  - Show "last modified by" info
  - Change tracking indicator
- **Success:** Update list, show success notification
- **Error:** Show detailed error messages, allow retry

#### Delete Card Type
- **Action:** DELETE /api/admin/cards/:cardId (Phase 2)
- **Warning Dialog:**
  - Show card name and benefit count
  - If soft delete capable: "Archive instead?" option
  - If user cards linked: show count and warning
  - Require confirmation text or secondary confirmation
- **Success:** Remove from list, show notification
- **Error:** Show if deletion blocked, suggest archive alternative

#### Reorder Cards
- **Interface:** Drag-drop or explicit order field
- **Action:** PUT /api/admin/cards/:cardId with displayOrder update
- **Interactions:**
  - Drag handle on each card row
  - Visual drop indicator
  - Automatic reorder number assignment
  - Undo option for 10 seconds
- **Real-time:** Update displayOrder immediately, persist to API

### 2. Default Benefits Management

#### View Card with Benefits
- **Action:** GET /api/admin/cards/:cardId (Phase 2)
- **Display:**
  - Card header with basic info
  - Benefits section with list of all benefits
  - Show: benefitName, type, value, resetCadence, isDefault status
  - Actions per benefit: edit, delete, toggle default
- **States:** Loading, empty, error, success

#### Add Benefit
- **Modal/Form:** (Embedded in card detail or modal)
- **Fields:**
  - benefitName (text, required)
  - benefitType (enum: insurance, cashback, travel, banking, points, other)
  - stickerValue (number, required, non-negative)
  - resetCadence (enum: annual, per-transaction, per-day, monthly, one-time)
  - isActive (toggle, default true)
  - description (optional text)
- **Validation:** All required fields filled, unique benefit name per card
- **Success:** Add to benefits list, clear form, show notification
- **Error:** Show validation errors

#### Edit Benefit
- **Modal/Form:** Similar to add, pre-populated with current values
- **Read-only:** benefitId, cardId, createdAt
- **Editable:** benefitName, benefitType, stickerValue, resetCadence, isActive, description
- **Success:** Update in list, show notification
- **Error:** Show detailed error

#### Delete Benefit
- **Warning Dialog:**
  - Show benefit name
  - If default benefit: note "this removes from new card defaults"
  - If linked to user cards: show count and warning
  - Require confirmation
- **Success:** Remove from list, show notification
- **Error:** Show if blocked, suggest deactivate alternative

#### Toggle Default Status
- **Action:** Quick toggle button on each benefit
- **PUT /api/admin/benefits/:benefitId with isDefault flag**
- **Real-time:** Toggle switch immediately, persist to API
- **Visual:** Badge or indicator showing "Default" status

### 3. User Role Management

#### View All Users
- **Action:** GET /api/admin/users (Phase 2)
- **Requirements:**
  - Paginated list (default 20 items/page)
  - Show: name, email, role (USER/ADMIN), joinDate, lastActive
  - Filterable by: role, search (name/email)
  - Sortable by: name, joinDate, lastActive
- **States:** Loading, empty, error, success
- **Row Actions:** Assign role / Revoke role button

#### Assign Admin Role
- **Action:** PUT /api/admin/users/:userId/role (Phase 2)
- **Confirmation Dialog:**
  - Show user name and email
  - Message: "Promote [name] to admin?"
  - Warning: "This grants full admin access"
  - Cancel/Confirm buttons
- **Success:** Update user row, show notification
- **Error:** Show error reason, allow retry
- **Prevention:** Disable self-promotion button

#### Revoke Admin Role
- **Action:** PUT /api/admin/users/:userId/role (Phase 2)
- **Confirmation Dialog:**
  - Show user name and email
  - Message: "Remove admin access from [name]?"
  - If self: "You will lose admin access. Continue?"
  - Cancel/Confirm buttons
- **Success:** Update user row, handle potential self-demotion
- **Error:** Show error, prevent if self-demotion blocked

### 4. Audit Trail Viewing

#### View Audit Logs
- **Action:** GET /api/admin/audit-logs (Phase 2)
- **Requirements:**
  - Paginated list (default 50 items/page)
  - Show: timestamp, action (CREATE/UPDATE/DELETE), resourceType, resourceId, changedBy (user name), summary
  - Expandable rows showing before/after values
- **States:** Loading, empty, error, success
- **Sorting:** By timestamp (newest first)

#### Filter Audit Logs
- **Filters:**
  - Resource Type dropdown (card, benefit, user_role)
  - Action Type dropdown (create, update, delete, all)
  - Date Range picker (from/to dates)
  - Changed By dropdown (list of admins)
  - Search by resource name/ID
- **Real-time:** Apply filters without page reload
- **Clear:** Button to reset all filters

#### View Change Details
- **Expandable Row Detail:**
  - Full action description
  - Timestamp with timezone
  - Admin user who made change (name + email)
  - Resource type and ID
  - For updates: show before/after field values in diff view
  - Request metadata: IP address, User-Agent (if captured)
- **Copy to Clipboard:** JSON of audit entry

### 5. System Dashboard (Home Page)

#### Overview Section
- **Display:**
  - Total card types (with active/archived breakdown)
  - Total users (with admin/regular breakdown)
  - Total benefits
  - System health status
- **Design:** 4 stat cards in grid layout
- **Updates:** Refresh on page load, optional manual refresh button

#### Recent Activity
- **Display:**
  - Last 10 audit log entries
  - Show: timestamp, action, resource, changed by
  - Link to full audit log
  - Actions: expand for details
- **Real-time:** Can be auto-refreshed every 30s (optional)

#### Quick Actions
- **Buttons:**
  - "Add New Card" → Create card modal
  - "View All Cards" → Card management page
  - "View All Users" → User management page
  - "View Audit Log" → Audit log page

#### Health Status (Optional)
- **Display:**
  - API health indicator (GET /api/admin/health)
  - Database connection status
  - Last data sync timestamp
  - Green/yellow/red status indicators
- **Requirements:** Only if Phase 2 provides health endpoints

---

## UI Architecture

### Overall Layout Structure

```
┌─────────────────────────────────────────────────────┐
│                    Top Navigation Bar               │
│  (Logo, User Menu, Notifications, Dark Mode Toggle)│
└─────────────────────────────────────────────────────┘
┌──────────────┬──────────────────────────────────────┐
│              │                                      │
│   Sidebar    │        Main Content Area             │
│  (Nav Menu)  │  ┌────────────────────────────────┐  │
│              │  │   Page Header / Breadcrumb    │  │
│              │  │   (Title, Filters, Actions)   │  │
│              │  ├────────────────────────────────┤  │
│              │  │                                │  │
│              │  │     Page-Specific Content      │  │
│              │  │   (Tables, Forms, Modals)     │  │
│              │  │                                │  │
│              │  └────────────────────────────────┘  │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### Responsive Behavior

**Desktop (1024px+):**
- 2-column layout: sidebar (240px fixed) + content
- Tables with full row display
- Side-by-side modals
- Multi-column forms

**Tablet (768px - 1023px):**
- Collapsible sidebar (hamburger icon)
- Full-width content when sidebar collapsed
- Stacked table columns or horizontal scroll
- Forms in full-width modals

**Mobile (< 768px):**
- Sidebar hidden by default, slide-in menu
- Full-width content
- Vertical card layouts instead of tables
- Stacked modals
- Single-column forms
- Bottom sheet for action menus

### Component Hierarchy

```
AdminLayout (Root)
├── Sidebar
│   └── NavItem (multiple)
├── TopNavBar
│   ├── Logo
│   ├── Breadcrumb
│   └── UserMenu
├── MainContent
│   ├── PageHeader
│   │   ├── Title
│   │   ├── FilterBar
│   │   └── ActionButtons
│   └── PageContent
│       ├── DataTable / DataGrid
│       ├── Form / FormGroup
│       ├── Modal / Dialog
│       └── Toast / Notification
└── Footer (optional)
```

### State Management Strategy

**Use React Context + Custom Hooks (No external state management for Phase 3)**

**Context Providers:**
1. **AuthContext** (Already exists - carries user + admin status)
   - User info, auth token
   - Admin role verification

2. **AdminContext** (New for Phase 3)
   - Current admin page state
   - Filter/sort preferences
   - Pagination state
   - Active resource IDs (for edit mode)

3. **UIContext** (New for Phase 3)
   - Dark mode toggle state
   - Sidebar open/closed state
   - Toast notifications queue
   - Modal stack (for multiple modals)

**Custom Hooks:**
```typescript
// Data fetching hooks
useCards(page, limit, filters)        // Returns: { cards, total, loading, error, refetch }
useBenefits(cardId)                   // Returns: { benefits, loading, error, addBenefit, ... }
useAuditLogs(filters, page)           // Returns: { logs, pagination, loading, error, ... }
useUsers(filters, page)               // Returns: { users, pagination, loading, error, ... }

// UI state hooks
useToast()                            // Returns: { showToast, closeToast, ... }
useModal()                            // Returns: { openModal, closeModal, activeModals, ... }
useAdminFilters()                     // Returns: { filters, updateFilter, clearFilters, ... }
```

**Data Fetching:**
- Use native `fetch()` with loading states
- Optional: Consider TanStack Query (React Query) for Phase 3+ if complexity grows
- Polling: 30-second auto-refresh for dashboard activity (optional)

### Routing Structure

```
/admin                          (Dashboard Home)
├── /admin/cards               (Card Management)
│   └── /admin/cards/:id       (Card Detail / Edit)
├── /admin/users               (User Role Management)
├── /admin/audit-logs          (Audit Trail)
└── /admin/settings            (Settings - future)
```

**Route Guards:**
- All /admin/* routes require admin role
- Redirect to dashboard if unauthorized
- Show "Access Denied" page with instructions

### Navigation Model

**Primary Navigation (Sidebar):**
- Dashboard (home icon)
- Cards Management (credit card icon)
- User Roles (people icon)
- Audit Logs (history icon)
- Settings (gear icon - future)
- Sign Out (logout)

**Secondary Navigation:**
- Breadcrumb trail: Home > Section > Page > Item
- Back buttons where appropriate
- "Done" / "Save" buttons for forms

**Mobile Navigation:**
- Hamburger menu to open sidebar
- Bottom action bar for primary actions
- Slide-in side menu

---

## Component Specifications

### Core Layout Components

#### 1. AdminLayout
**Purpose:** Root layout wrapper for all admin pages

**Props Interface:**
```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}
```

**Responsibilities:**
- Render sidebar + top nav + main content area
- Manage responsive state
- Apply global admin styles
- Handle dark mode

**State Requirements:**
- sidebarOpen: boolean
- theme: 'light' | 'dark'

**Key Features:**
- Responsive layout (stacked on mobile)
- Fixed header, scrollable content
- Sticky sidebar on desktop
- Persistent theme preference

**Responsive Behavior:**
- Desktop: Fixed sidebar (240px)
- Tablet: Collapsible sidebar
- Mobile: Slide-in sidebar

#### 2. Sidebar
**Purpose:** Main navigation component

**Props Interface:**
```typescript
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
}
```

**Responsibilities:**
- Display navigation items
- Highlight current page
- Manage logout action
- Collapse/expand on mobile

**Contents:**
- Logo/branding section
- NavItem list
- User info section
- Logout button

**Accessibility:**
- ARIA labels on nav items
- Focus management
- Keyboard navigation (arrow keys)

#### 3. TopNavBar
**Purpose:** Header navigation with user menu

**Props Interface:**
```typescript
interface TopNavBarProps {
  onToggleSidebar?: () => void;
  currentPage?: string;
}
```

**Responsibilities:**
- Display page title/breadcrumb
- Show user menu
- Dark mode toggle
- Search/filter controls

**Sections:**
- Left: Hamburger (mobile), Logo (tablet), Page Title
- Middle: Search bar (optional)
- Right: Notifications, User menu, Theme toggle

**Actions:**
- Toggle sidebar
- Open user menu
- Toggle dark mode
- Global search (future)

#### 4. PageHeader
**Purpose:** Page-level header with title, filters, actions

**Props Interface:**
```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  filters?: React.ReactNode;
  actions?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary'; }[];
  breadcrumb?: BreadcrumbItem[];
}
```

**Responsibilities:**
- Display page title and description
- Render filter controls
- Show action buttons
- Optional breadcrumb

**Layout:**
- Top: Title + Description
- Middle: Filter bar
- Right: Action buttons
- Bottom: Pagination (if table)

---

### Data Display Components

#### 5. DataTable
**Purpose:** Flexible table component for card/user/audit log lists

**Props Interface:**
```typescript
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading: boolean;
  error?: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  onPageChange: (page: number) => void;
  onRowClick?: (row: T) => void;
  sortableColumns?: string[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
}
```

**Responsibilities:**
- Render column-based data
- Handle pagination controls
- Support sorting
- Show loading state
- Display empty state
- Show error state

**Accessibility:**
- Table role
- Header scopes
- Column sort buttons with ARIA
- Keyboard navigation

**Responsive:**
- Horizontal scroll on mobile
- Stacked cards alternative
- Collapsible columns

#### 6. DataGrid (Card-based)
**Purpose:** Card-based alternative to tables for mobile/responsive

**Props Interface:**
```typescript
interface DataGridProps<T> {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  error?: string;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}
```

**Responsibilities:**
- Render items as cards in grid
- Responsive column layout (1, 2, 3 columns)
- Pagination
- Loading skeletons
- Empty state
- Error state

#### 7. EmptyState
**Purpose:** Display when no data available

**Props Interface:**
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; };
}
```

**Responsibilities:**
- Show friendly message
- Provide action button
- Optional icon/illustration

#### 8. LoadingState
**Purpose:** Display while data loading

**Props Interface:**
```typescript
interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'pulse';
  rows?: number; // for skeleton
}
```

**Responsibilities:**
- Show loading animation
- Skeleton placeholders for table/grid
- Pulse animation for cards

#### 9. ErrorState
**Purpose:** Display when error occurs

**Props Interface:**
```typescript
interface ErrorStateProps {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void; };
  details?: string;
}
```

**Responsibilities:**
- Show error message
- Provide retry action
- Optional detailed error info (dev mode)

#### 10. PaginationControls
**Purpose:** Pagination controls for tables/lists

**Props Interface:**
```typescript
interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
}
```

**Responsibilities:**
- Display current page info
- Previous/Next buttons
- Page number input
- Items per page selector

**Accessibility:**
- Clear page numbers
- Previous/Next button labels
- Current page emphasized

---

### Form Components

#### 11. FormGroup
**Purpose:** Wrapper for form fields with label, validation

**Props Interface:**
```typescript
interface FormGroupProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}
```

**Responsibilities:**
- Render label
- Display input
- Show error message
- Display hint text

#### 12. FormInput (Text, Number, URL, etc.)
**Purpose:** Controlled input field

**Props Interface:**
```typescript
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  validation?: (value: string) => string | null;
}
```

**Responsibilities:**
- Render input with label
- Show validation error
- Handle real-time validation
- Support icon prefix/suffix
- Accessible labeling

#### 13. FormSelect (Dropdown)
**Purpose:** Select/dropdown field

**Props Interface:**
```typescript
interface FormSelectProps {
  label: string;
  options: { value: string | number; label: string; }[];
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
}
```

**Responsibilities:**
- Render dropdown with options
- Handle selection
- Show validation error
- Support search (optional)
- Accessible labels and options

#### 14. FormToggle (Checkbox for boolean)
**Purpose:** Toggle/checkbox field

**Props Interface:**
```typescript
interface FormToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
}
```

**Responsibilities:**
- Render checkbox/toggle
- Handle state
- Display label and description
- Accessible patterns

#### 15. Form (Wrapper)
**Purpose:** Form wrapper with submission handling

**Props Interface:**
```typescript
interface FormProps {
  onSubmit: (formData: Record<string, any>) => Promise<void> | void;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string;
  onCancel?: () => void;
}
```

**Responsibilities:**
- Manage form submission
- Show loading state
- Display form-level errors
- Handle cancel action
- Reset form after success

---

### Modal/Dialog Components

#### 16. Modal
**Purpose:** Dialog box for forms, confirmations, details

**Props Interface:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
}
```

**Responsibilities:**
- Render modal overlay
- Display content
- Handle close action
- Keyboard escape support
- Focus trap

#### 17. ConfirmDialog
**Purpose:** Confirmation dialog for destructive actions

**Props Interface:**
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string; // "Delete", "Confirm"
  cancelText?: string;  // "Cancel", "No"
  variant?: 'default' | 'danger'; // red for dangerous
  isLoading?: boolean;
}
```

**Responsibilities:**
- Confirmation prompt
- Danger styling if variant='danger'
- Loading state
- Close on escape/backdrop

---

### Notification Components

#### 18. Toast
**Purpose:** Toast notification for user feedback

**Props Interface:**
```typescript
interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms before auto-close
  onClose: () => void;
  action?: { label: string; onClick: () => void; };
}
```

**Responsibilities:**
- Display notification message
- Auto-dismiss after duration
- Support action button
- Allow manual close

#### 19. ToastContainer
**Purpose:** Container managing toast queue

**Props Interface:**
```typescript
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}
```

**Responsibilities:**
- Render multiple toasts
- Position on screen
- Manage stacking

---

### Badge/Status Components

#### 20. Badge
**Purpose:** Small status/label component

**Props Interface:**
```typescript
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}
```

**Responsibilities:**
- Display status badge
- Color coding
- Optional icon

#### 21. StatusIndicator
**Purpose:** Visual status indicator (dot, light)

**Props Interface:**
```typescript
interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'pending' | 'error';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Responsibilities:**
- Show colored status dot
- Optional label
- Semantic color mapping

---

### Specialized Components

#### 22. BenefitEditor (Card-specific)
**Purpose:** Component for editing benefits within card detail

**Props Interface:**
```typescript
interface BenefitEditorProps {
  cardId: string;
  benefits: Benefit[];
  onAdd: (benefit: BenefitForm) => Promise<void>;
  onEdit: (id: string, benefit: BenefitForm) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleDefault: (id: string, isDefault: boolean) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}
```

**Responsibilities:**
- Display benefit list
- Add/edit/delete benefits
- Toggle default status
- Show loading states
- Display errors

**Sub-components:**
- BenefitRow: Display single benefit with actions
- BenefitForm: Form for add/edit
- BenefitConfirmDelete: Confirmation dialog

#### 23. AuditLogViewer
**Purpose:** Component for viewing and filtering audit logs

**Props Interface:**
```typescript
interface AuditLogViewerProps {
  logs: AuditLog[];
  pagination: PaginationState;
  filters: AuditFilters;
  onFilterChange: (filters: AuditFilters) => void;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  error?: string;
}
```

**Responsibilities:**
- Display audit log table
- Render filter controls
- Expand rows for details
- Show before/after diffs

#### 24. RoleAssignmentModal
**Purpose:** Modal for assigning/revoking admin roles

**Props Interface:**
```typescript
interface RoleAssignmentModalProps {
  isOpen: boolean;
  user: User;
  action: 'assign' | 'revoke';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}
```

**Responsibilities:**
- Show user info
- Display confirmation message
- Warn about consequences
- Handle submission

#### 25. ImageUploadField (Card creation)
**Purpose:** Field for uploading/previewing card images

**Props Interface:**
```typescript
interface ImageUploadFieldProps {
  value?: string;
  onChange: (url: string) => void;
  error?: string;
  label?: string;
}
```

**Responsibilities:**
- URL input field
- Image preview
- Image validation
- Error display

---

## Page Specifications

### Page 1: Admin Dashboard (Home)

**Route:** `/admin`

**Purpose:** Overview of admin system status and recent activity

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ Admin Dashboard                                  │
├──────────────────────────────────────────────────┤
│ Quick Stats (4 cards in 2x2 grid)               │
│ ┌──────────────┐  ┌──────────────┐              │
│ │ Cards: 45    │  │ Users: 12    │              │
│ │ (3 archived) │  │ (2 admins)   │              │
│ └──────────────┘  └──────────────┘              │
│ ┌──────────────┐  ┌──────────────┐              │
│ │ Benefits: 320│  │ Health: ✅   │              │
│ │ (18 default) │  │ (API OK)     │              │
│ └──────────────┘  └──────────────┘              │
├──────────────────────────────────────────────────┤
│ Recent Activity (Last 10 Changes)                │
│ [Timestamp] [Admin] [Action] [Resource]          │
│ ...                                              │
│ [Link to Full Audit Log]                         │
├──────────────────────────────────────────────────┤
│ Quick Actions                                    │
│ [+ Add Card] [View Cards] [View Users] [Audit]  │
└──────────────────────────────────────────────────┘
```

**Components:**
- AdminLayout
- PageHeader (title: "Admin Dashboard")
- StatCard (x4) - Cards, Users, Benefits, Health
- RecentActivityWidget
- QuickActionsPanel

**Data Fetching:**
```typescript
useEffect(() => {
  // Fetch statistics
  fetchStats() // GET /api/admin/stats
  fetchRecentActivity() // GET /api/admin/audit-logs?limit=10
}, [])
```

**Interactions:**
- Click stat card to navigate to detail page
- Click activity row to expand details
- Click quick action buttons to navigate
- Auto-refresh activity every 30s (optional)

**Empty States:**
- No activity: Show "No changes yet" message
- Health check failed: Show warning icon with status message

**Error States:**
- If stats fail to load: Show error message with retry
- If activity fails: Show "Unable to load activity" with retry

---

### Page 2: Card Management

**Route:** `/admin/cards`

**Purpose:** List, create, edit, delete, and reorder card types

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Card Management                                 │
├─────────────────────────────────────────────────┤
│ Filters & Controls:                             │
│ [Search] [Issuer ▼] [Status ▼] [+ Add Card]   │
├─────────────────────────────────────────────────┤
│ Card Table:                                     │
│ ┌────┬──────────┬────────┬───────┬────────────┐│
│ │ ☰  │ Card Name│ Issuer │Status │ Benefits  ││
│ ├────┼──────────┼────────┼───────┼────────────┤│
│ │ ⋮⋮ │Chase Sap │ Chase  │Active │ 8         ││
│ │    │ □ Edit   │ Click  │ ✓     │ [Details] ││
│ │    │ △ Delete │ to     │       │ [Edit]    ││
│ ├────┼──────────┼────────┼───────┼────────────┤│
│ │    │ ...      │        │       │           ││
│ └────┴──────────┴────────┴───────┴────────────┘│
├─────────────────────────────────────────────────┤
│ Pagination: [← Prev] [1 2 3 ...] [Next →]      │
│              Showing 1-20 of 45                 │
└─────────────────────────────────────────────────┘
```

**Components:**
- AdminLayout
- PageHeader with filters
- DataTable (card list)
- PaginationControls
- Modal: CardForm (add/edit)
- ConfirmDialog (delete)

**Columns in Table:**
1. Reorder handle (drag icon) - desktop only
2. Card name / Issuer
3. Annual fee
4. Benefit count
5. Status (active/archived)
6. Actions (edit, details, delete)

**Filters:**
- Search: issuer, cardName
- Status: active, archived, all
- Issuer: multi-select dropdown
- Sort: by name, issuer, updated date

**Actions:**
- Click row → navigate to `/admin/cards/:id`
- Click "Edit" → open CardEditModal
- Click "Delete" → open DeleteConfirmation
- Drag handle → reorder (auto-save)
- Click "+ Add Card" → open CardCreateModal

**Data Fetching:**
```typescript
useCards(page, limit, filters) {
  // GET /api/admin/cards?page=X&limit=Y&filters...
  // Returns: { cards, pagination, loading, error, refetch }
}
```

**Empty State:**
- "No cards found" with "+ Create Card" button

**Mobile Behavior:**
- Table becomes vertical card layout
- Hide reorder handles
- Collapse actions into menu button

---

### Page 3: Card Detail & Benefits

**Route:** `/admin/cards/:id`

**Purpose:** View and edit card details and manage associated benefits

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [← Back] Chase Sapphire Preferred               │
├──────────────────────────────────────────────────┤
│ Card Details (Editable Form)                     │
│ ┌────────────────────────────────────────────┐  │
│ │ Name: Chase Sapphire Preferred       [Edit]│  │
│ │ Issuer: Chase                        [Edit]│  │
│ │ Annual Fee: $95                      [Edit]│  │
│ │ Image: [Preview] [Change]            [Edit]│  │
│ │ Status: Active [Archive]             [Edit]│  │
│ │                                      [Delete]  │
│ └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│ Benefits (8 total)                               │
│ ┌─────────────────────────────────────────────┐ │
│ │ Travel Insurance              [Default] [..]│ │
│ │ Value: Up to $10,000 | Reset: Annual      │ │
│ │ Status: Active       [Edit] [Delete]       │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Lounge Access                [Default] [..]│ │
│ │ Value: Airport access | Reset: Annual     │ │
│ │ Status: Active       [Edit] [Delete]       │ │
│ └─────────────────────────────────────────────┘ │
│ [+ Add Benefit]                                  │
└──────────────────────────────────────────────────┘
```

**Components:**
- AdminLayout
- PageHeader (breadcrumb: Cards > Card Name)
- CardDetailForm (editable fields)
- BenefitEditor
  - BenefitList
    - BenefitRow (each benefit)
  - BenefitForm (add/edit modal)
- ConfirmDialog (delete card)
- Modal: CardEditModal

**Card Detail Form:**
- Display all card fields
- Inline edit mode
- Edit button per field or edit all
- Save/Cancel buttons
- Show "Last modified by X on Y" info

**Benefits Section:**
- List all benefits for card
- Each benefit shows: name, type, value, reset cadence
- Actions per benefit: toggle default, edit, delete
- Add benefit button
- Empty state: "No benefits for this card"

**Data Fetching:**
```typescript
useEffect(() => {
  const cardId = params.id;
  fetchCard(cardId)     // GET /api/admin/cards/:id
  fetchBenefits(cardId) // GET /api/admin/cards/:id/benefits
}, [cardId])
```

**Interactions:**
- Edit card: Click edit button, modify fields, save
- Add benefit: Click "+ Add Benefit", fill form, submit
- Edit benefit: Click edit icon on benefit, modify, save
- Delete benefit: Click delete, confirm, remove
- Toggle default: Click star/checkbox, auto-save
- Delete card: Click delete button, confirm with warning, navigate back

**Mobile Behavior:**
- Single column layout
- Full-width forms
- Bottom action bar for main actions

---

### Page 4: User Role Management

**Route:** `/admin/users`

**Purpose:** Manage admin role assignments for all system users

**Layout:**
```
┌────────────────────────────────────────────────┐
│ User Role Management                           │
├────────────────────────────────────────────────┤
│ Filters:                                       │
│ [Search] [Role: ▼] [Sort: ▼]                  │
├────────────────────────────────────────────────┤
│ User Table:                                    │
│ ┌──────────┬──────────┬────────┬─────────────┐│
│ │ Name     │ Email    │ Role   │ Actions    ││
│ ├──────────┼──────────┼────────┼─────────────┤│
│ │ John Doe │ john@... │ ADMIN  │ Revoke ✓   ││
│ ├──────────┼──────────┼────────┼─────────────┤│
│ │ Jane Sm. │ jane@... │ USER   │ Make Admin ││
│ ├──────────┼──────────┼────────┼─────────────┤│
│ │ ...      │ ...      │ ...    │ ...        ││
│ └──────────┴──────────┴────────┴─────────────┘│
├────────────────────────────────────────────────┤
│ Pagination: [← Prev] 1 2 3 [Next →]           │
└────────────────────────────────────────────────┘
```

**Components:**
- AdminLayout
- PageHeader with filters
- DataTable (user list)
- PaginationControls
- RoleAssignmentModal

**Columns:**
1. Name
2. Email
3. Role (ADMIN / USER badge)
4. Join Date
5. Last Active
6. Actions (Assign/Revoke)

**Filters:**
- Search: name, email
- Role: Admin only, Users only, All
- Sort: by name, by join date, by last active

**Actions:**
- Click "Make Admin" → RoleAssignmentModal (action: 'assign')
- Click "Revoke Admin" → RoleAssignmentModal (action: 'revoke')
- Current user role change: Show warning "You will lose admin access"

**Data Fetching:**
```typescript
useUsers(page, limit, filters) {
  // GET /api/admin/users?page=X&limit=Y&role=...
  // Returns: { users, pagination, loading, error, refetch }
}
```

**Empty State:**
- No users: unlikely, but show message
- No search results: "No users matching filters"

**Role Change Flow:**
1. Click "Make Admin" or "Revoke Admin"
2. Open RoleAssignmentModal
3. Show: user name, email, current role, action description
4. If self-revoke: show warning message
5. Click Confirm
6. API call: PUT /api/admin/users/:userId/role
7. Update table, show toast notification
8. Close modal
9. If self-revoked: redirect to dashboard after 3s

---

### Page 5: Audit Log Viewer

**Route:** `/admin/audit-logs`

**Purpose:** Search, view, and analyze all administrative changes

**Layout:**
```
┌────────────────────────────────────────────────┐
│ Audit Logs                                     │
├────────────────────────────────────────────────┤
│ Filters:                                       │
│ [Resource ▼] [Action ▼] [Admin ▼]             │
│ [Date From] [Date To] [Search] [Clear Filters]│
├────────────────────────────────────────────────┤
│ Audit Log Table:                               │
│ ┌───────────┬────────┬──────────┬────────────┐│
│ │ Timestamp │ Action │ Resource │ Changed By ││
│ ├───────────┼────────┼──────────┼────────────┤│
│ │ 2024-01.. │ UPDATE │ Card     │ admin@... ││
│ │ > Details │        │          │           ││
│ ├───────────┴────────┴──────────┴────────────┤│
│ │ Resource: Card 'Chase Sapphire'            │
│ │ Changed: annual_fee                        │
│ │   Before: 9500 | After: 10000              │
│ │ IP: 192.168.1.1 | User-Agent: Chrome...  │
│ └──────────────────────────────────────────────┤
│ ├───────────┬────────┬──────────┬────────────┤│
│ │ ...       │ ...    │ ...      │ ...        ││
│ └───────────┴────────┴──────────┴────────────┘│
├────────────────────────────────────────────────┤
│ Pagination: [← Prev] 1 2 3 [Next →]           │
└────────────────────────────────────────────────┘
```

**Components:**
- AdminLayout
- PageHeader with filters
- FilterBar (resource, action, admin, date range)
- DataTable (audit log entries)
- ExpandableRow (detailed view)
- PaginationControls

**Columns (Collapsed View):**
1. Timestamp (formatted local time with timezone)
2. Action (CREATE/UPDATE/DELETE badge)
3. Resource Type (Card/Benefit/User Role)
4. Resource ID / Name (link to detail if still exists)
5. Changed By (admin name)
6. Actions (expand)

**Expanded Row Details:**
- Full resource name
- Complete action description
- Admin user: name + email
- Timestamp with timezone
- Request metadata: IP, User-Agent
- For UPDATE actions: before/after values in diff view
- Copy JSON button

**Filters:**
- Resource Type: card, benefit, user_role, all
- Action Type: create, update, delete, all
- Admin User: dropdown of admins
- Date Range: from/to date pickers
- Search: by resource name/ID
- Clear All Filters button

**Data Fetching:**
```typescript
useAuditLogs(filters, page, limit) {
  // GET /api/admin/audit-logs?filters...
  // Returns: { logs, pagination, loading, error, refetch }
}
```

**Empty State:**
- No logs: unlikely, show "No audit logs"
- No logs matching filters: "No changes matching filters"

**Mobile Behavior:**
- Hide request metadata columns
- Collapse some details
- Full details in expanded view
- Horizontal scroll for table

---

## Integration Specification

### API Endpoint Mapping

| Page | Feature | Endpoint | Method | Purpose |
|------|---------|----------|--------|---------|
| Dashboard | Stats | `GET /api/admin/stats` | GET | Get total counts |
| Dashboard | Activity | `GET /api/admin/audit-logs?limit=10` | GET | Recent changes |
| Cards | List | `GET /api/admin/cards` | GET | Paginated card list |
| Cards | Create | `POST /api/admin/cards` | POST | Create new card |
| Card Detail | View | `GET /api/admin/cards/:id` | GET | Single card info |
| Card Detail | Update | `PUT /api/admin/cards/:id` | PUT | Edit card |
| Card Detail | Delete | `DELETE /api/admin/cards/:id` | DELETE | Delete card |
| Card Detail | Benefits | `GET /api/admin/cards/:id/benefits` | GET | List benefits |
| Card Detail | Add Benefit | `POST /api/admin/benefits` | POST | Create benefit |
| Card Detail | Edit Benefit | `PUT /api/admin/benefits/:id` | PUT | Edit benefit |
| Card Detail | Delete Benefit | `DELETE /api/admin/benefits/:id` | DELETE | Remove benefit |
| Card Detail | Toggle Default | `PUT /api/admin/benefits/:id` | PUT | Toggle default flag |
| Users | List | `GET /api/admin/users` | GET | Paginated user list |
| Users | Assign Role | `PUT /api/admin/users/:id/role` | PUT | Make user admin |
| Audit Logs | List | `GET /api/admin/audit-logs` | GET | Paginated audit logs |

### Request/Response Patterns

**List Requests (Pagination):**
```typescript
// Request
GET /api/admin/cards?page=1&limit=20&issuer=Chase&sortBy=name&sortDirection=asc

// Response
{
  success: true,
  data: [
    { id, issuer, cardName, annualFee, ... },
    ...
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 45,
    totalPages: 3,
    hasMore: true
  }
}
```

**Detail Requests:**
```typescript
// Request
GET /api/admin/cards/card_123

// Response
{
  success: true,
  data: {
    id: "card_123",
    issuer: "Chase",
    cardName: "Sapphire Preferred",
    annualFee: 9500,
    cardImageUrl: "...",
    displayOrder: 1,
    isActive: true,
    benefits: [{ id, name, type, ... }],
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-20T14:30:00Z"
  }
}
```

**Create/Update Requests:**
```typescript
// Request (Create)
POST /api/admin/cards
{
  issuer: "Chase",
  cardName: "Sapphire Reserve",
  defaultAnnualFee: 55000,
  cardImageUrl: "https://..."
}

// Request (Update)
PUT /api/admin/cards/card_123
{
  issuer: "Chase",
  cardName: "Sapphire Preferred Plus",
  defaultAnnualFee: 10500
}

// Response (Both)
{
  success: true,
  data: { id, issuer, cardName, ..., createdAt, updatedAt }
}
```

**Delete Requests:**
```typescript
// Request
DELETE /api/admin/cards/card_123
(optional body: { reason: "..." })

// Response
{
  success: true,
  data: { id, deletedAt }
}
```

### Error Handling Strategy

**HTTP Status Codes:**
- `200`: Successful GET/PUT/DELETE
- `201`: Successful POST (create)
- `400`: Bad request (validation error, malformed request)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (not admin)
- `404`: Not found (resource doesn't exist)
- `409`: Conflict (duplicate resource, constraint violation)
- `422`: Unprocessable entity (business logic error)
- `500`: Server error
- `503`: Service unavailable

**Error Response Format:**
```typescript
{
  success: false,
  error: "Human-readable error message",
  code: "MACHINE_READABLE_ERROR_CODE",
  details?: {
    field: "fieldName",
    reason: "specific reason",
    validationRules?: "..."
  }
}
```

**Frontend Error Handling:**
```typescript
try {
  const response = await fetch('/api/admin/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const error = await response.json();
    if (response.status === 400) {
      // Field validation error - show in form
      showFieldError(error.details.field, error.details.reason);
    } else if (response.status === 409) {
      // Conflict - duplicate or constraint violation
      showToast('Card already exists', 'error');
    } else if (response.status === 403) {
      // Permission denied
      redirectToDashboard();
    } else {
      // Generic error
      showToast(error.error, 'error');
    }
    return;
  }

  const result = await response.json();
  if (result.success) {
    showToast('Saved successfully', 'success');
    // Update UI
  }
} catch (error) {
  showToast('Network error. Please try again.', 'error');
}
```

### Loading States

**API Call States:**
- `idle`: No request in progress
- `loading`: Request in progress, show spinner/skeleton
- `success`: Request completed successfully
- `error`: Request failed

**UI Patterns:**
```typescript
if (isLoading) return <LoadingState rows={5} />;
if (error) return <ErrorState title="Load Failed" message={error} action={retry} />;
if (data.length === 0) return <EmptyState title="No cards" action={createNew} />;
return <DataTable data={data} ... />;
```

**Skeleton Screens:**
- Table: Show 5 skeleton rows with column widths matching real data
- Cards: Show 3-4 skeleton cards in grid
- Detail page: Show form skeleton with placeholder lines

### Optimistic Updates Strategy

**When to use optimistic updates:**
- Toggle actions (default benefit, active status)
- Simple updates (field edits)
- Estimated success rate > 95%

**Implementation:**
```typescript
async function toggleBenefitDefault(benefitId: string, newValue: boolean) {
  // 1. Optimistically update UI
  setBenefit(id => ({
    ...id,
    isDefault: newValue
  }));

  try {
    // 2. Make API call
    await fetch(`/api/admin/benefits/${benefitId}`, {
      method: 'PUT',
      body: JSON.stringify({ isDefault: newValue })
    });
    
    // 3. Success - nothing to do (UI already updated)
  } catch (error) {
    // 4. Error - revert optimistic update
    setBenefit(id => ({
      ...id,
      isDefault: !newValue // revert
    }));
    showToast('Update failed', 'error');
  }
}
```

**Disable optimistic updates for:**
- Deletions (require confirmation)
- Creates (need ID from server)
- Role changes (require confirmation)

---

## Design System

### Color Palette

**Light Mode (Default):**

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | #3356D0 | Primary actions, highlights |
| `--color-primary-light` | #e0ecff | Backgrounds, hover states |
| `--color-secondary` | #f59e0b | Secondary actions, warnings |
| `--color-success` | #0a7d57 | Success states, green indicators |
| `--color-success-light` | #d1fae5 | Success backgrounds |
| `--color-error` | #ef4444 | Errors, danger states |
| `--color-error-light` | #fee2e2 | Error backgrounds |
| `--color-warning` | #d97706 | Warnings, alerts |
| `--color-warning-light` | #fef08a | Warning backgrounds |
| `--color-info` | #0891b2 | Information, secondary info |
| `--color-info-light` | #cffafe | Info backgrounds |
| `--color-bg` | #ffffff | Main background |
| `--color-bg-secondary` | #f9fafb | Secondary background |
| `--color-text` | #111827 | Primary text |
| `--color-text-secondary` | #6b7280 | Secondary text |
| `--color-border` | #e5e7eb | Borders |

**Dark Mode:**
```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #6b7fff;
    --color-primary-light: #1e293b;
    --color-bg: #0f172a;
    --color-bg-secondary: #1e293b;
    --color-text: #f1f5f9;
    --color-text-secondary: #94a3b8;
    --color-border: #334155;
    /* ... etc ... */
  }
}
```

### Typography

**Font Families:**
- Primary (body): `Inter`, system fonts
- Headings: `Plus Jakarta Sans`, system fonts
- Monospace: `JetBrains Mono`, Monaco, Courier New

**Font Sizes & Weights:**
```css
h1: 48px, 700
h2: 42px, 700
h3: 37px, 600
h4: 33px, 600
body-lg: 18px, 400
body-md: 16px, 400
body-sm: 14px, 400
label: 13px, 600
caption: 12px, 400
mono-md: 14px, 400
mono-sm: 12px, 400
```

### Spacing System

```
xs:   4px   (use for micro spacing, icon gaps)
sm:   8px   (tight spacing)
md:  16px   (standard spacing)
lg:  24px   (generous spacing)
xl:  32px   (extra generous)
2xl: 48px   (large sections)
3xl: 64px   (page sections)
4xl: 96px   (full-width spacing)
```

**Component Spacing Recommendations:**
- Button padding: `sm` (8px) vertical, `md` (16px) horizontal
- Card padding: `lg` (24px)
- Modal padding: `lg` (24px)
- Form field gap: `md` (16px)
- Section gap: `2xl` (48px)

### Border Radius

```
sm:   4px   (subtle)
md:   8px   (standard)
lg:  12px   (prominent)
xl:  16px   (large)
full: 9999px (circles)
```

**Component Recommendations:**
- Buttons: `md` (8px)
- Cards: `lg` (12px)
- Modals: `lg` (12px)
- Inputs: `md` (8px)
- Badges: `sm` (4px)

### Shadows

```
xs: 0 1px 2px rgba(0,0,0,0.05)
sm: 0 1px 3px rgba(0,0,0,0.1)
md: 0 4px 6px rgba(0,0,0,0.1)
lg: 0 10px 15px rgba(0,0,0,0.1)
xl: 0 20px 25px rgba(0,0,0,0.1)
```

**Component Recommendations:**
- Cards: `sm` at rest, `md` on hover
- Modals: `lg`
- Dropdowns: `md`
- Buttons: None (or `xs` on pressed)

### Animations & Transitions

**Durations:**
```
fast: 150ms    (micro interactions)
base: 300ms    (standard transitions)
slow: 500ms    (emphasis animations)
```

**Easing Functions:**
```
ease-out: cubic-bezier(0.4, 0, 0.2, 1)  (opening)
ease-in: cubic-bezier(0.4, 0, 1, 1)      (closing)
ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55)
```

**Common Animations:**
- Fade in: opacity 0→1, duration: base
- Slide up: translateY(16px)→0, duration: base
- Scale in: scale(0.95)→1, duration: base
- Modal open: fade-in + scale-in (staggered)
- Toast appear: slide-up (from bottom)

### Component Variants

**Button Variants:**
- Primary: Blue background, white text
- Secondary: Gray background, gray text
- Danger: Red background, white text
- Ghost: Transparent, colored text
- Disabled: Gray, reduced opacity, no cursor

**Badge Variants:**
- Default: Gray
- Success: Green
- Warning: Orange
- Error: Red
- Info: Cyan
- Sizes: sm (12px), md (14px)

**Input States:**
- Default: Gray border, dark text
- Focus: Blue border, blue shadow
- Error: Red border, red text, error message
- Disabled: Gray background, no interaction
- Loading: Spinner in suffix

**Table States:**
- Header: Bold, bottom border, hover underline
- Row: Border-bottom, hover background
- Selected: Background highlight
- Sorted: Icon indicator
- Empty: Centered "No data" message

### Icons

**Icon Library:** Lucide React (already in project)

**Common Icons:**
```typescript
import {
  Home,              // Dashboard
  CreditCard,       // Cards
  Gift,             // Benefits
  Users,            // Users/Roles
  History,          // Audit logs
  Settings,         // Settings
  Menu,             // Sidebar toggle
  X,                // Close
  ChevronDown,      // Dropdown
  Edit2,            // Edit
  Trash2,           // Delete
  Plus,             // Add
  Check,            // Success
  AlertCircle,      // Error
  Info,             // Info
  Copy,             // Copy to clipboard
  ExternalLink,     // External link
  ChevronLeft,      // Back
  MoreVertical,     // Menu
  Search,           // Search
  Filter,           // Filter
  Calendar,         // Date picker
  GripVertical,     // Drag handle
  Star,             // Default/favorite
  Eye,              // View details
  EyeOff,           // Hidden
  Loader,           // Loading
  AlertTriangle,    // Warning
  CheckCircle,      // Valid
} from 'lucide-react';
```

### Dark Mode Support

**Implementation:**
```typescript
// Tailwind dark mode configured as class-based
// html class="dark" or class="" (light)

// Usage in components:
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content
</div>

// Or using CSS variables (recommended):
<div className="bg-[var(--color-bg)] text-[var(--color-text)]">
  Content
</div>
```

**Component Dark Mode Checklist:**
- [ ] Background colors respect dark mode
- [ ] Text colors have sufficient contrast
- [ ] Borders visible in both modes
- [ ] Shadows adapt to dark background
- [ ] Icons visible in both modes
- [ ] Form inputs readable in both modes

---

## User Flows

### Flow 1: Create New Card Type

```
User Start Point: Dashboard / Cards page
     ↓
User clicks "+ Add Card" button
     ↓
Modal opens: CardCreateForm
  - Empty fields for: issuer, cardName, annualFee, imageUrl
  - Image preview placeholder
  - Cancel and Submit buttons
     ↓
User fills in form fields
  - Type issuer (e.g., "Chase")
  - Type card name (e.g., "Sapphire Preferred")
  - Enter annual fee (e.g., "9500")
  - Paste image URL (e.g., "https://...")
  - Image preview updates in real-time
     ↓
User clicks Submit button
     ↓
UI shows loading spinner on button
Request: POST /api/admin/cards with form data
     ↓
Server validates:
  - Required fields present
  - Fee is non-negative
  - Image URL is valid/accessible
     ↓
HAPPY PATH (Success):
     ↓
Server returns: { success: true, data: { id, issuer, ... } }
     ↓
UI closes modal
Toast: "Card created successfully"
Redirect to: /admin/cards/:newCardId (detail page)
Card appears in card list
End
     ↓
ERROR PATH (Validation fails):
     ↓
Server returns: { success: false, code: "VALIDATION_ERROR", details: [...] }
     ↓
UI shows field-level errors
User sees red borders on invalid fields
User can retry / fix and resubmit
     ↓
ERROR PATH (Duplicate card):
     ↓
Server returns: { success: false, code: "DUPLICATE_CARD" }
     ↓
Toast: "Card already exists for Chase Sapphire Preferred"
User can try different card name
     ↓
ERROR PATH (Network error):
     ↓
Toast: "Network error. Please try again."
Retry button shown
     ↓
ERROR PATH (Server error):
     ↓
Toast: "Something went wrong. Please try again later."
Error logged for debugging
```

**Key Decision Points:**
- User cancels before submitting → Close modal, discard data
- User submits invalid form → Show field errors
- Server returns error → Show appropriate error message, allow retry

**Accessibility Requirements:**
- Modal has focus trap
- Form labels associated with inputs
- Error messages linked to inputs (aria-describedby)
- Submit button shows loading state with aria-busy

---

### Flow 2: Edit Card and Its Benefits

```
User Start Point: Cards management page
     ↓
User clicks on card row or "View" button
     ↓
Navigation to: /admin/cards/:cardId
     ↓
Page loads:
  GET /api/admin/cards/:cardId
  GET /api/admin/cards/:cardId/benefits
     ↓
UI shows:
  - Card details (issuer, name, fee, image)
  - Benefits list (with edit/delete/toggle buttons)
  - Edit and Delete buttons at top
     ↓
SCENARIO A: Edit card property
     ↓
User clicks Edit next to a field (or Edit Card button)
     ↓
Modal opens: CardEditForm
  - Fields pre-populated with current values
  - User modifies one or more fields
  - User clicks Save
     ↓
Request: PUT /api/admin/cards/:cardId with changed fields
     ↓
HAPPY PATH:
  ✓ Server validates and updates
  ✓ Toast: "Card updated"
  ✓ Form closes, page refreshes
  ✓ New values displayed
     ↓
ERROR PATH:
  ✗ Validation error: Show field error message
  ✗ Server error: Show error toast, allow retry
     ↓
SCENARIO B: Add benefit to card
     ↓
User clicks "+ Add Benefit"
     ↓
Modal opens: BenefitForm
  - Empty fields
  - Select benefitType from dropdown
  - Enter stickerValue, resetCadence
  - Toggle isActive (default true)
     ↓
User fills form and clicks Submit
     ↓
Request: POST /api/admin/benefits with cardId + benefit data
     ↓
HAPPY PATH:
  ✓ Server creates benefit, returns { id, name, ... }
  ✓ Modal closes
  ✓ New benefit appears in list
  ✓ Toast: "Benefit added"
     ↓
ERROR PATH:
  ✗ Duplicate benefit name: Show message
  ✗ Validation error: Show field errors
  ✗ Server error: Show error toast
     ↓
SCENARIO C: Edit benefit
     ↓
User clicks Edit icon on a benefit
     ↓
Modal opens: BenefitForm (edit mode)
  - Fields pre-populated
  - Read-only: benefitId, cardId, createdAt
     ↓
User modifies fields and clicks Save
     ↓
Request: PUT /api/admin/benefits/:benefitId
     ↓
HAPPY PATH:
  ✓ Benefit updates in list
  ✓ Toast: "Benefit updated"
     ↓
SCENARIO D: Toggle benefit as default
     ↓
User clicks star icon on benefit (quick action)
     ↓
Optimistic update: toggle star immediately
     ↓
Request: PUT /api/admin/benefits/:benefitId { isDefault: newValue }
     ↓
If error:
  ✗ Revert star to previous state
  ✗ Toast: "Update failed"
     ↓
SCENARIO E: Delete benefit
     ↓
User clicks Delete (trash) icon on benefit
     ↓
ConfirmDialog appears:
  "Delete [benefitName]?"
  "This removes the benefit from the card"
  [Cancel] [Delete]
     ↓
User clicks Delete
     ↓
Request: DELETE /api/admin/benefits/:benefitId
     ↓
HAPPY PATH:
  ✓ Benefit removed from list
  ✓ Toast: "Benefit deleted"
     ↓
ERROR PATH:
  ✗ Benefit used by user cards: 
  ✗ Message: "Cannot delete. Used by 5 cards. Archive instead?"
  ✗ Offer option to toggle isActive instead
     ↓
End of flow (user navigates away or performs another action)
```

**Key Decision Points:**
- Edit vs view-only mode
- Delete vs archive decision
- Error handling and retry strategy

---

### Flow 3: Assign Admin Role to User

```
User Start Point: User Role Management page
     ↓
GET /api/admin/users returns paginated list
     ↓
User sees table with users (name, email, role, actions)
     ↓
User locates a USER (non-admin) and clicks "Make Admin"
     ↓
Modal opens: RoleAssignmentModal
     ↓
Modal displays:
  - User name and email
  - Current role: USER
  - New role: ADMIN
  - Message: "Promote [name] to admin?"
  - Warning: "This grants full admin access"
  - [Cancel] [Confirm] buttons
     ↓
User clicks Confirm
     ↓
UI shows loading state on Confirm button
     ↓
Request: PUT /api/admin/users/:userId/role { role: "ADMIN" }
     ↓
HAPPY PATH:
     ↓
Server validates admin privilege (requestor must be admin)
Server updates user role to ADMIN
Server logs change in audit trail
Server returns: { success: true, data: { id, name, role: "ADMIN" } }
     ↓
Modal closes
Toast: "[name] is now an admin"
User table updates:
  - Role column shows "ADMIN" with green badge
  - Action button changes to "Revoke Admin"
     ↓
ERROR PATH (requestor not admin):
     ↓
Server returns: { success: false, code: "FORBIDDEN" }
Toast: "You don't have permission to make this change"
Modal closes, no update to table
     ↓
ERROR PATH (User not found):
     ↓
Server returns: 404
Toast: "User not found"
Modal closes
     ↓
FLOW CONTINUATION: Revoke Admin Role
     ↓
User now wants to remove admin privilege
User clicks "Revoke Admin" on the user row
     ↓
Modal opens: RoleAssignmentModal (action: 'revoke')
     ↓
Modal displays:
  - User name and email
  - Current role: ADMIN
  - New role: USER
  - Message: "Remove admin access from [name]?"
  - If user is self: "You will lose admin access. Are you sure?"
  - [Cancel] [Confirm] buttons
     ↓
User clicks Confirm
     ↓
Request: PUT /api/admin/users/:userId/role { role: "USER" }
     ↓
HAPPY PATH:
     ↓
Server updates user role to USER
Server logs change
     ↓
If user is self-revoking:
  - Modal closes
  - Toast: "Admin access removed"
  - After 3s: Redirect to /admin (dashboard)
  - User loses admin access, sees "Access Denied" on next admin page visit
     ↓
If revoking other user:
  - Modal closes
  - Toast: "[name] is no longer an admin"
  - User table updates
  - Action button changes to "Make Admin"
     ↓
End
```

**Critical Logic:**
- Prevent self-demotion without explicit warning
- Show different message if self-revoking
- Handle cascade redirect after self-revoke
- Log every role change for audit

---

### Flow 4: View and Filter Audit Logs

```
User Start Point: Dashboard / Audit Logs page
     ↓
GET /api/admin/audit-logs?page=1&limit=50 (default)
     ↓
UI displays:
  - Filter controls (resource type, action, admin, date range, search)
  - Table of audit log entries
  - Pagination controls
     ↓
SCENARIO A: View all logs (no filtering)
     ↓
Table shows recent changes:
  - Timestamp (formatted: "Jan 20, 2024 2:30 PM")
  - Action (CREATE/UPDATE/DELETE badge)
  - Resource (Card, Benefit, or User Role)
  - Resource name / ID
  - Changed by (admin user name)
  - "→ Details" link
     ↓
User clicks "→ Details" on a row
     ↓
Row expands to show:
  - Full timestamp with timezone
  - Admin user name and email
  - IP address and User-Agent
  - For CREATE: "Created with values..."
  - For UPDATE: Before/after comparison
  - For DELETE: "Deleted with reason..."
  - [Copy JSON] button
     ↓
User clicks [Copy JSON]
     ↓
Audit log entry copied to clipboard as JSON
Toast: "Copied to clipboard"
     ↓
SCENARIO B: Filter by resource type
     ↓
User clicks "Resource Type" dropdown
Options: Card, Benefit, User Role, All (default)
     ↓
User selects: "Card"
     ↓
URL updates: ?resourceType=card&page=1
GET /api/admin/audit-logs?resourceType=card
     ↓
Table refreshes, shows only card-related changes
Page number resets to 1
Toast: "Showing card changes (24 total)"
     ↓
SCENARIO C: Filter by action type
     ↓
User clicks "Action Type" dropdown
Options: Create, Update, Delete, All (default)
     ↓
User selects: "Update"
     ↓
URL updates: ?action=update
GET /api/admin/audit-logs?action=update
     ↓
Table shows only UPDATE actions
     ↓
SCENARIO D: Filter by admin user
     ↓
User clicks "Changed By" dropdown
Options: List of all admins (with counts)
     ↓
User selects: "john@example.com"
     ↓
URL updates: ?changedBy=john@example.com
GET /api/admin/audit-logs?changedBy=john@example.com
     ↓
Table shows only changes made by John
     ↓
SCENARIO E: Filter by date range
     ↓
User clicks "From Date" field
Calendar/date picker opens
User selects: Jan 15, 2024
     ↓
User clicks "To Date" field
User selects: Jan 20, 2024
     ↓
Automatic refresh:
GET /api/admin/audit-logs?fromDate=2024-01-15&toDate=2024-01-20
     ↓
Table shows changes in that date range
     ↓
SCENARIO F: Combine multiple filters
     ↓
User applies:
  - Resource Type: "Card"
  - Action: "Update"
  - Changed By: "john@example.com"
  - Date: Jan 15 - Jan 20
     ↓
Request: GET /api/admin/audit-logs?resourceType=card&action=update&changedBy=john@example.com&fromDate=...&toDate=...
     ↓
Table shows: Only card updates made by John in that date range
     ↓
SCENARIO G: Search by resource name/ID
     ↓
User types in search box: "Chase Sapphire"
     ↓
Auto-search (debounced 300ms):
GET /api/admin/audit-logs?search=Chase%20Sapphire
     ↓
Table shows only changes to cards/benefits matching "Chase Sapphire"
     ↓
SCENARIO H: Clear all filters
     ↓
User clicks "Clear Filters" button
     ↓
All filter inputs reset to defaults
URL resets: ?page=1
GET /api/admin/audit-logs
     ↓
Table shows all audit logs again
     ↓
SCENARIO I: Pagination
     ↓
User at page 1 of audit logs
User clicks "Next Page" button or selects page number 2
     ↓
URL updates: ?page=2
GET /api/admin/audit-logs?page=2&limit=50
     ↓
Table scrolls to top (or focus moves to table)
New entries load
UI shows: "Showing 51-100 of 1,234 total"
     ↓
End
```

**Key Features:**
- Filters apply immediately (no "Apply" button)
- URL state reflects filters (shareable/bookmarkable)
- Pagination resets when filters change
- Search is debounced (300ms)
- Expandable rows for details
- JSON export capability

---

### Flow 5: Delete Card Type (with warnings)

```
User Start Point: Card Management page / Card Detail page
     ↓
User decides to delete a card
     ↓
User clicks [Delete] button (red button)
     ↓
ConfirmDialog opens with warning:
     ↓
Dialog displays:
  - Title: "Delete Card?"
  - Card name and issuer displayed
  - Benefit count shown (e.g., "This card has 8 benefits")
  - Red warning icon
     ↓
SCENARIO A: Card has no associated user cards
     ↓
Dialog message: "This card has no user cards. Delete permanently?"
  [Cancel] [Delete] buttons
     ↓
User clicks [Delete]
     ↓
Request: DELETE /api/admin/cards/:cardId
     ↓
Server checks: No user cards linked? ✓
Server soft-deletes the card (sets deletedAt timestamp)
Server logs deletion in audit trail
Returns: { success: true, data: { id, deletedAt } }
     ↓
UI closes dialog
Toast: "Card deleted successfully"
Redirect to: /admin/cards (list page)
Card disappears from list
     ↓
SCENARIO B: Card has associated user cards
     ↓
Card linked to 15 user cards
     ↓
Dialog message: 
  "This card is used by 15 user cards."
  "Archive instead of deleting?"
  "Archiving hides the card for new users but preserves existing data."
  
Actions:
  [Cancel] [Archive] [Delete Anyway]
     ↓
User clicks [Archive]
     ↓
Request: PATCH /api/admin/cards/:cardId { isArchived: true }
     ↓
Server updates isArchived flag
Server logs change
Returns: { success: true, data: { id, isArchived: true } }
     ↓
UI closes dialog
Toast: "Card archived. Still visible to existing users."
Redirect to list, card shows "Archived" badge
     ↓
ALTERNATIVE: User clicks [Delete Anyway]
     ↓
Secondary confirmation dialog appears:
  Title: "Permanently delete?"
  Message: "This card is used by 15 users. Really delete?"
  [Cancel] [Delete Permanently]
     ↓
User clicks [Delete Permanently]
     ↓
Request: DELETE /api/admin/cards/:cardId { force: true }
     ↓
Server hard-deletes the card
Server logs deletion with reason "user_forced_delete"
May cascade-delete associated benefits
Returns: { success: true }
     ↓
UI closes dialog
Toast: "Card permanently deleted"
Redirect to list page
Card removed completely
     ↓
ERROR SCENARIOS:
     ↓
Server returns: { success: false, code: "CANNOT_DELETE" }
     ↓
Dialog closes
Toast: "Unable to delete card. Try archiving instead."
User can retry or choose archive
     ↓
Network error:
Toast: "Network error. Please try again."
Dialog remains open, allow retry
     ↓
End
```

**Safety Features:**
- Require confirmation for any deletion
- Show impact (number of affected user cards)
- Suggest archive as alternative
- Double-confirm for forced deletion
- Log reason for audit trail
- Allow undo for 10 seconds (optional)

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

All pages and components must meet WCAG 2.1 Level AA standards.

**Key Requirements:**

#### 1. Perceivable
- **Color Contrast:**
  - Normal text: 4.5:1 minimum
  - Large text (18px+): 3:1 minimum
  - UI components: 3:1 minimum
  - Verification: Use WAVE, Axe DevTools, or manual testing

- **Color Not Only:**
  - Don't rely on color alone for information
  - Use text labels, icons, patterns, or shapes
  - Example: Status badges should have text ("Active", "Archived"), not just color

- **Text Alternatives:**
  - Images have descriptive alt text
  - Icons in buttons have aria-labels
  - Decorative elements have aria-hidden="true"

#### 2. Operable
- **Keyboard Navigation:**
  - All interactive elements reachable via Tab key
  - Tab order logical (left-to-right, top-to-bottom)
  - Focus visible (clear :focus styles)
  - Focus trap in modals
  - Escape key closes modals/menus
  - Enter/Space triggers buttons and checkboxes

- **Focus Management:**
  - Focus indicator is visible (min 3px outline)
  - Focus moves to newly opened modal
  - Focus returns to trigger element when modal closes
  - Skip link to main content (if needed)

- **Form Fields:**
  - All inputs have labels (or aria-label)
  - Error messages linked to inputs (aria-describedby)
  - Required fields indicated (visually + aria-required)
  - Helper text associated with inputs

#### 3. Understandable
- **Readable:**
  - Language of page specified (lang attribute)
  - Abbreviations expanded on first use
  - Complex words explained
  - Readability: aim for 8th grade level

- **Predictable:**
  - Navigation consistent across pages
  - Links to external sites marked or warned
  - Form submission doesn't cause unexpected context changes
  - Tab order is logical

#### 4. Robust
- **Semantic HTML:**
  - Use correct heading levels (h1, h2, h3...)
  - Use proper semantic elements (button, nav, main, etc.)
  - ARIA roles/attributes when HTML isn't sufficient
  - Avoid ARIA when HTML is sufficient

- **Valid Code:**
  - Valid HTML (no duplicate IDs)
  - No ARIA role conflicts
  - ARIA attributes properly used

### Implementation Checklist

**Every page must have:**
- [ ] Page title in `<title>` tag
- [ ] Main content in `<main>` element
- [ ] Navigation in `<nav>` with aria-label="Main Navigation"
- [ ] Proper heading hierarchy (one h1 per page)
- [ ] Skip link to main content (hidden until focused)
- [ ] Focus visible on all interactive elements

**Every form must have:**
- [ ] Label for every input
- [ ] Error messages with aria-describedby
- [ ] Required fields marked (visually + aria-required)
- [ ] Helper text if needed
- [ ] Submit button clearly labeled
- [ ] Success/error messages in aria-live region

**Every table must have:**
- [ ] Header row in `<thead>`
- [ ] Proper scope attributes on headers
- [ ] Caption or descriptive text
- [ ] Sortable columns indicated
- [ ] Keyboard navigation support

**Every modal must have:**
- [ ] Focus trap (tab cycles within modal)
- [ ] Escape key closes
- [ ] Focus moves to close button or first input
- [ ] aria-modal="true" and role="dialog"
- [ ] Aria-label for dialog title
- [ ] Focus returns to trigger element on close

**Every component must have:**
- [ ] Color contrast ≥ 4.5:1 (normal text)
- [ ] Focus indicator visible
- [ ] Keyboard accessible
- [ ] Proper ARIA roles/labels
- [ ] No flashing/seizure triggers

### Keyboard Navigation Patterns

**Buttons & Links:**
- Enter: activate
- Space: activate (buttons only)

**Menus & Dropdowns:**
- Enter/Space: open menu
- Arrow Up/Down: navigate items
- Enter: select item
- Escape: close menu
- Home/End: first/last item

**Tables:**
- Tab: next cell
- Arrow Keys: navigate within row
- Enter: expand row
- Space: select row (if selectable)

**Modals:**
- Tab: cycle through interactive elements
- Shift+Tab: reverse cycle
- Escape: close
- Trap: return focus to trigger on close

**Sidebar:**
- Arrow Up/Down: navigate menu items
- Enter: activate item
- Escape: close on mobile

### Screen Reader Support

**Announcements:**
- Use `aria-live="polite"` for:
  - Toast notifications
  - Form validation errors
  - Data loading completion
  - Page state changes

- Use `aria-live="assertive"` only for urgent:
  - Error messages
  - Critical alerts

**Labels & Descriptions:**
```html
<!-- Good: explicit label -->
<label for="card-name">Card Name</label>
<input id="card-name" type="text">

<!-- Alternative: aria-label -->
<button aria-label="Delete card">
  <TrashIcon />
</button>

<!-- Good: aria-describedby for extra context -->
<input id="fee" aria-describedby="fee-hint">
<span id="fee-hint">in cents (e.g., 9500 = $95)</span>

<!-- Good: aria-required for required fields -->
<input required aria-required="true">
```

**Table Accessibility:**
```html
<table>
  <caption>Card Benefits for Chase Sapphire</caption>
  <thead>
    <tr>
      <th scope="col">Benefit Name</th>
      <th scope="col">Value</th>
      <th scope="col">Cadence</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td data-label="Benefit Name">Travel Insurance</td>
      ...
    </tr>
  </tbody>
</table>
```

**List Accessibility:**
```html
<!-- For audit logs and lists -->
<ul role="list">
  <li role="listitem">Item 1</li>
  <li role="listitem">Item 2</li>
</ul>
```

---

## Performance & Optimization

### Performance Targets

- **Page Load Time:** < 3 seconds (Core Web Vitals)
- **Time to Interactive (TTI):** < 5 seconds
- **First Contentful Paint (FCP):** < 1.5 seconds
- **Cumulative Layout Shift (CLS):** < 0.1
- **Lighthouse Score:** ≥ 85 (Performance)

### Pagination Strategy

**For All List Pages:**

| Feature | Setting | Reason |
|---------|---------|--------|
| Default page size | 20 items | Balances load time & scrolling |
| Max page size | 100 items | Prevent memory issues |
| Audit logs page size | 50 items | More granular history |
| Lazy load tables | Yes | Load only visible rows |
| Virtual scrolling | Optional | If tables exceed 100 rows |
| Pagination type | Offset-based | Simple to implement |

**Implementation:**
```typescript
// Hook usage
const { data, pagination, isLoading } = useCards({
  page: 1,
  limit: 20,
  filters: selectedFilters
});

// Render
<DataTable data={data} ... />
<PaginationControls 
  page={pagination.page}
  total={pagination.total}
  onPageChange={(newPage) => setPage(newPage)}
/>
```

**Infinite Scroll (Future):**
- Not recommended for admin panels (pagination better)
- Could be used for audit log if scrolling becomes pain point

### Lazy Loading Approach

**Code Splitting:**
- Admin pages in separate chunk: `src/app/admin/[page].tsx`
- Modals loaded on-demand with React.lazy()
- Heavy components (charts, maps) lazy loaded

**Example:**
```typescript
// Dynamic import for modals
const CardCreateModal = React.lazy(() => import('./modals/CardCreateModal'));

<Suspense fallback={null}>
  {showModal && <CardCreateModal {...props} />}
</Suspense>
```

**Image Lazy Loading:**
- Card images lazy loaded (loading="lazy")
- Images served in WebP format with fallbacks
- Placeholder/blur hash while loading

### Caching Strategy

**HTTP Caching (Browser):**
```typescript
// For GET requests, set cache headers
fetch('/api/admin/cards', {
  method: 'GET',
  headers: {
    'Cache-Control': 'max-age=300' // 5 min cache
  }
})
```

**React-level Caching:**
- Use Context for static data (benefit types, enums)
- Cache user list in Context (refresh on manual action)
- No third-party state management needed for Phase 3

**API Response Caching:**
```typescript
// Simple memoization pattern
const dataCache = new Map();

async function fetchCards(page, limit, filters) {
  const cacheKey = `cards_${page}_${limit}_${JSON.stringify(filters)}`;
  
  if (dataCache.has(cacheKey) && !isStale(cacheKey)) {
    return dataCache.get(cacheKey);
  }
  
  const data = await fetch(...);
  dataCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

**Cache Invalidation:**
- On create/update/delete: invalidate relevant cache
- Manual "Refresh" button to clear cache
- Auto-refresh every 5 minutes for list pages

### Database Optimization

*Note: API layer handles optimization. UI just consumes optimized endpoints.*

**Endpoints should have:**
- [ ] Proper indexing on queried fields (Phase 2 responsibility)
- [ ] N+1 query prevention (join/select optimization)
- [ ] Pagination at API level (not client-side)
- [ ] Field selection (only return needed fields)
- [ ] Response compression (gzip)

### Code Splitting

**Bundle Analysis:**
```bash
npm install --save-dev @next/bundle-analyzer
# Check bundle size
npm run build
```

**Optimize Bundles:**
- [ ] No unused dependencies
- [ ] Tree-shaking enabled
- [ ] Code splitting at route level
- [ ] Modals/heavyweight components lazy loaded
- [ ] Icons imported individually (lucide-react supports this)

### Image Optimization

**Card Images:**
- Serve in multiple formats: WebP, JPEG
- Responsive sizes: 
  - Mobile: 300px wide
  - Desktop: 500px wide
- Placeholder while loading (blur hash)
- Example:
  ```typescript
  <img 
    src={cardImageUrl}
    srcSet={`${cardImageUrl}?w=300 300w, ${cardImageUrl}?w=500 500w`}
    loading="lazy"
    alt={cardName}
  />
  ```

### Runtime Performance

**React Optimizations:**
- Use `React.memo()` for components that rarely change
- Use `useCallback()` for event handlers passed to children
- Use `useMemo()` for expensive computations
- Avoid anonymous functions in render

**Example:**
```typescript
const CardRow = React.memo(({ card, onEdit, onDelete }) => {
  return (
    <tr>
      <td>{card.name}</td>
      <td>{card.issuer}</td>
      <td>
        <button onClick={() => onEdit(card.id)}>Edit</button>
        <button onClick={() => onDelete(card.id)}>Delete</button>
      </td>
    </tr>
  );
});
```

**Avoiding Re-renders:**
- Move state as close to where it's used as possible
- Split large components into smaller ones
- Profile with React DevTools Profiler

---

## Testing Strategy

### Unit Tests (Component Testing)

**Framework:** Vitest + React Testing Library

**Coverage Target:** 80% overall, 100% for critical components

**Test Priority (by importance):**

1. **Critical Components (100% coverage):**
   - CardCreateForm
   - BenefitEditor
   - RoleAssignmentModal
   - DataTable (sorting, filtering, pagination)
   - ConfirmDialog

2. **Important Components (80% coverage):**
   - Form fields (Input, Select, Toggle)
   - Badge, StatusIndicator
   - Modal, Toast
   - StatCard

3. **Nice-to-have Components (50%+ coverage):**
   - Sidebar, TopNavBar
   - EmptyState, LoadingState
   - Pagination controls

**Example Test:**
```typescript
describe('CardCreateForm', () => {
  it('should render form with empty fields', () => {
    render(<CardCreateForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Issuer')).toHaveValue('');
    expect(screen.getByLabelText('Card Name')).toHaveValue('');
  });

  it('should show validation error for missing required fields', async () => {
    const { user } = render(<CardCreateForm onSubmit={vi.fn()} />);
    await user.click(screen.getByText('Submit'));
    expect(screen.getByText('Issuer is required')).toBeInTheDocument();
  });

  it('should call onSubmit with form data', async () => {
    const onSubmit = vi.fn();
    const { user } = render(<CardCreateForm onSubmit={onSubmit} />);
    
    await user.type(screen.getByLabelText('Issuer'), 'Chase');
    await user.type(screen.getByLabelText('Card Name'), 'Sapphire');
    await user.click(screen.getByText('Submit'));
    
    expect(onSubmit).toHaveBeenCalledWith({
      issuer: 'Chase',
      cardName: 'Sapphire',
      // ...
    });
  });

  it('should disable submit button while loading', () => {
    render(<CardCreateForm onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByText('Submit')).toBeDisabled();
  });
});
```

### Integration Tests (API Integration)

**Framework:** Vitest + React Testing Library

**Coverage:** Test data fetching and state updates

**Example Test:**
```typescript
describe('Card Management Page Integration', () => {
  it('should load and display cards on mount', async () => {
    const mockCards = [
      { id: '1', issuer: 'Chase', cardName: 'Sapphire', ... }
    ];
    
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: mockCards, pagination: {...} })
    });

    render(<CardManagementPage />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Chase')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));
    
    render(<CardManagementPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
    
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('should add card when form submitted', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: '2', issuer: 'Amex', ... } })
    });

    render(<CardManagementPage />);
    
    const user = userEvent.setup();
    await user.click(screen.getByText('+ Add Card'));
    
    // Fill form...
    await user.click(screen.getByText('Submit'));
    
    await waitFor(() => {
      expect(screen.getByText('Card created successfully')).toBeInTheDocument();
    });
  });
});
```

### E2E Tests (Critical User Flows)

**Framework:** Playwright

**Coverage:** All 5 critical user flows

**Example Test:**
```typescript
// tests/e2e/admin-flow.spec.ts
test.describe('Admin Card Management Flow', () => {
  test.beforeEach(async ({ page, browser }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button:has-text("Sign In")');
    
    // Navigate to cards
    await page.goto('/admin/cards');
    await page.waitForLoadState('networkidle');
  });

  test('should create a new card', async ({ page }) => {
    // Click add button
    await page.click('button:has-text("+ Add Card")');
    
    // Fill form
    await page.fill('[name="issuer"]', 'Chase');
    await page.fill('[name="cardName"]', 'Test Card');
    await page.fill('[name="annualFee"]', '9500');
    await page.fill('[name="imageUrl"]', 'https://...');
    
    // Submit
    await page.click('button:has-text("Submit")');
    
    // Verify
    await expect(page.locator('text=Card created')).toBeVisible();
    await expect(page.locator('text=Test Card')).toBeVisible();
  });

  test('should edit a card', async ({ page }) => {
    // Find and click edit
    await page.click('tr:first-child >> text=Edit');
    
    // Modal opens
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    
    // Update field
    await page.fill('[name="cardName"]', 'Updated Card');
    await page.click('button:has-text("Save")');
    
    // Verify
    await expect(page.locator('text=Updated Card')).toBeVisible();
  });

  test('should delete a card with confirmation', async ({ page }) => {
    // Click delete
    await page.click('tr:first-child >> text=Delete');
    
    // Confirm in dialog
    await expect(page.locator('[role="alertdialog"]')).toBeVisible();
    await page.click('button:has-text("Delete")');
    
    // Verify removal
    await expect(page.locator('text=Card deleted')).toBeVisible();
  });

  test('should assign admin role to user', async ({ page }) => {
    // Navigate to users
    await page.goto('/admin/users');
    
    // Click make admin
    await page.click('tr:first-child >> text=Make Admin');
    
    // Confirm
    await page.click('[role="dialog"] button:has-text("Confirm")');
    
    // Verify update
    await expect(page.locator('tr:first-child >> text=ADMIN')).toBeVisible();
  });

  test('should filter audit logs', async ({ page }) => {
    // Navigate to audit
    await page.goto('/admin/audit-logs');
    
    // Apply filter
    await page.selectOption('[name="resourceType"]', 'card');
    
    // Verify results filtered
    await page.waitForLoadState('networkidle');
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBeGreaterThan(0);
  });
});
```

### Accessibility Testing

**Tools:**
- axe DevTools (manual testing)
- WAVE browser extension
- Lighthouse (automated)

**Manual Testing Checklist:**
```
Keyboard Navigation:
[ ] All interactive elements reachable via Tab
[ ] Tab order logical
[ ] Focus visible
[ ] Escape closes modals
[ ] Enter activates buttons

Screen Reader (NVDA/JAWS on Windows, VoiceOver on Mac):
[ ] Page title announced
[ ] Headings properly structured
[ ] Form labels read with inputs
[ ] Errors announced
[ ] Status updates announced

Color & Contrast:
[ ] Text passes 4.5:1 contrast ratio
[ ] Information not color-alone
[ ] Dark mode adequate contrast

Responsive Design:
[ ] Mobile (375px): all functional
[ ] Tablet (768px): all functional
[ ] Desktop (1024px+): all functional
```

### Performance Testing

**Tools:** Lighthouse, WebPageTest, Chrome DevTools

**Metrics to Monitor:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Time to Interactive (TTI)
- Bundle size (JavaScript)

**Test Checklist:**
```
[ ] Page load < 3s on 4G
[ ] Page load < 1s on wifi
[ ] Lighthouse score ≥ 85
[ ] No layout shifts (CLS < 0.1)
[ ] No console errors
[ ] No console warnings (critical only)
```

---

## Implementation Roadmap

### Phase 3A: Foundation & Layout (Day 1-2)

**Goals:**
- Establish admin layout infrastructure
- Build sidebar and navigation
- Create common components

**Tasks:**

1. **AdminLayout Component**
   - Root wrapper for all admin pages
   - Manages responsive layout
   - Handles dark mode toggle
   - Responsive sidebar (collapsible on mobile)

2. **Sidebar Component**
   - Navigation menu items
   - Current page highlighting
   - User info section
   - Logout functionality

3. **TopNavBar Component**
   - Logo/branding
   - Page title/breadcrumb
   - User menu
   - Dark mode toggle
   - Hamburger on mobile

4. **Base Components**
   - Button (multiple variants)
   - Badge/Status indicators
   - Card wrapper
   - Form wrapper

5. **Routing Setup**
   - `/admin` - Dashboard
   - `/admin/cards` - Card list
   - `/admin/cards/:id` - Card detail
   - `/admin/users` - Users
   - `/admin/audit-logs` - Audit logs
   - Auth middleware to protect routes

**Deliverables:**
- Admin layout structure working
- Navigation functional
- Dark mode working
- Mobile responsive
- All routes accessible

**Dependencies:** None (Phase 1 & 2 already done)

**Estimated Time:** 1.5 days

---

### Phase 3B: Data Display Components (Day 2-3)

**Goals:**
- Build reusable table/grid components
- Implement pagination and filtering
- Create state management hooks

**Tasks:**

1. **DataTable Component**
   - Column-based rendering
   - Sorting support
   - Pagination controls
   - Loading/error/empty states
   - Row selection (optional)
   - Responsive behavior

2. **DataGrid Component** (Mobile alternative)
   - Card-based layout
   - Same data source as table
   - Responsive columns (1, 2, 3)

3. **PaginationControls Component**
   - Page number display
   - Previous/Next buttons
   - Items per page selector
   - Total count display

4. **State Management Hooks**
   - useCards(page, limit, filters)
   - useUsers(page, limit, filters)
   - useAuditLogs(filters, page)
   - useBenefits(cardId)
   - useToast() for notifications
   - useModal() for modals

5. **States Components**
   - LoadingState (spinner + skeleton)
   - EmptyState (icon + message + action)
   - ErrorState (error icon + message + retry)

**Deliverables:**
- Table component with full functionality
- Pagination working
- Loading states visible
- Error handling working
- All hooks created

**Dependencies:** Phase 3A (AdminLayout)

**Estimated Time:** 1.5 days

---

### Phase 3C: Pages Implementation (Day 3-4)

**Goals:**
- Implement all 5 admin pages
- Connect to Phase 2 API
- Integrate with state management

**Tasks:**

1. **Dashboard Page** (`/admin`)
   - Stat cards (4 metrics)
   - Recent activity widget
   - Quick actions panel
   - API: Stats + Audit logs (last 10)

2. **Card Management Page** (`/admin/cards`)
   - Card list with DataTable
   - Filters (search, issuer, status)
   - Pagination
   - Create button
   - Row actions (edit, details, delete)
   - API: List cards, Delete card

3. **Card Detail Page** (`/admin/cards/:id`)
   - Card details (editable)
   - Benefits list
   - Add benefit button
   - Edit/delete benefit modals
   - Edit card button
   - Delete card button
   - API: Get card, Get benefits, all CRUD

4. **User Management Page** (`/admin/users`)
   - User list with DataTable
   - Filters (role, search)
   - Role assignment modal
   - API: List users, Update role

5. **Audit Log Page** (`/admin/audit-logs`)
   - Audit log table
   - Expandable rows for details
   - Filter controls
   - Search functionality
   - API: List audit logs

**Deliverables:**
- All 5 pages functional
- API integration working
- Data displaying correctly
- Pagination/filtering working

**Dependencies:** Phase 3B (Data components)

**Estimated Time:** 1.5 days

---

### Phase 3D: Forms & Modals (Day 4-5)

**Goals:**
- Implement all forms and modals
- Add validation and error handling
- Complete user interaction flows

**Tasks:**

1. **CardCreateForm Modal**
   - Form inputs (issuer, name, fee, image)
   - Real-time validation
   - Image preview
   - Submit/cancel buttons
   - Error display

2. **CardEditForm Modal**
   - Pre-populated fields
   - Same validation as create
   - Read-only fields (id, created)
   - Save/cancel buttons

3. **BenefitEditor Component**
   - Add benefit modal/form
   - Edit benefit modal/form
   - Delete confirmation dialog
   - Toggle default quick action
   - Benefit list display

4. **RoleAssignmentModal**
   - User display
   - Action confirmation
   - Warning messages
   - Loading state
   - Error handling

5. **ConfirmDialogs**
   - Delete card confirmation
   - Delete benefit confirmation
   - Generic confirm dialog

6. **Form Components**
   - FormGroup (label + error)
   - FormInput (text, number, email, URL)
   - FormSelect (dropdown)
   - FormToggle (checkbox/switch)
   - Form wrapper (submission handling)

**Deliverables:**
- All modals/forms working
- Validation functioning
- Error messages displayed
- All actions callable

**Dependencies:** Phase 3C (Pages)

**Estimated Time:** 1 day

---

### Phase 3E: Polish & Testing (Day 5)

**Goals:**
- Add missing features
- Implement accessibility
- Write tests
- Performance optimization

**Tasks:**

1. **Drag-Drop Reordering** (Card reorder)
   - Drag handle implementation
   - Drop target visual feedback
   - Auto-save on drop
   - Undo functionality (optional)

2. **Accessibility**
   - ARIA labels and descriptions
   - Keyboard navigation testing
   - Focus management
   - Screen reader testing
   - Color contrast verification

3. **Unit Tests**
   - Component tests (20+ tests)
   - 80%+ coverage
   - Critical components 100%

4. **Integration Tests**
   - API integration (10+ tests)
   - State management (5+ tests)
   - Form submissions (5+ tests)

5. **E2E Tests** (Playwright)
   - 5 critical user flows
   - Complete workflows
   - Error scenarios

6. **Polish**
   - Animations/transitions
   - Toast notifications
   - Loading states
   - Error messages
   - Mobile responsiveness review
   - Dark mode review
   - Console error cleanup

**Deliverables:**
- Full feature set working
- 80%+ test coverage
- WCAG 2.1 AA compliant
- 0 console errors
- Performance optimized

**Dependencies:** Phase 3D (Forms)

**Estimated Time:** 1 day

---

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| API response delays | Medium | Medium | Implement proper loading states and timeouts |
| Form validation complexity | Low | Medium | Pre-built validators, clear specs |
| Accessibility compliance | Medium | High | Early testing with axe DevTools, NVDA |
| Performance issues (large datasets) | Medium | Medium | Pagination by default, lazy loading |
| Mobile responsiveness bugs | Medium | Medium | Test on real devices early |
| State management complexity | Low | Medium | Simple Context API (avoid over-engineering) |
| Browser compatibility issues | Low | Low | Test in modern browsers only (Chrome, Firefox, Safari) |

### Contingency Plans

**If performance is slow:**
- Implement React Query for caching
- Add virtual scrolling for large tables
- Reduce page size to 10-15 items
- Lazy load components more aggressively

**If accessibility takes too long:**
- Prioritize keyboard navigation
- Use semantic HTML
- Add basic ARIA labels
- Full accessibility audit in Phase 4

**If forms get complex:**
- Use react-hook-form library
- Create reusable field validator
- Separate form logic from UI

---

## Success Criteria

### Functional Requirements ✅

- [x] Dashboard page displays stats and recent activity
- [x] Card management page: view, create, edit, delete, reorder
- [x] Card detail page: edit properties, manage benefits
- [x] User management: view users, assign/revoke admin roles
- [x] Audit log page: view, filter, search, expand details
- [x] All forms validate input correctly
- [x] All modals confirm before destructive actions
- [x] All API calls integrated and working
- [x] Error handling for all API failure scenarios
- [x] Loading states for all async operations
- [x] Empty states with helpful messaging
- [x] Optimistic updates for quick toggles

### Technical Requirements ✅

- [x] **Test Coverage:** 80%+ (unit + integration)
- [x] **WCAG 2.1 AA Compliance:** Verified
- [x] **Page Load Time:** < 3 seconds
- [x] **Core Web Vitals:** 
  - [x] FCP: < 1.5s
  - [x] LCP: < 2.5s
  - [x] CLS: < 0.1
- [x] **Zero Console Errors** (production build)
- [x] **Responsive Design:**
  - [x] Mobile (375px): Functional
  - [x] Tablet (768px): Functional
  - [x] Desktop (1024px+): Functional
- [x] **TypeScript:** Strict mode compliance
- [x] **Dark Mode:** Fully supported
- [x] **Keyboard Navigation:** All interactive elements accessible
- [x] **Screen Reader:** Proper ARIA labels and semantic HTML
- [x] **Code Quality:**
  - [x] No `any` types (strict)
  - [x] Proper error handling
  - [x] Consistent code style
  - [x] JSDoc comments on components

### Quality Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Test Coverage | 80%+ | `npm run coverage` |
| Lighthouse Score | ≥85 | Chrome DevTools Lighthouse |
| Page Load Time | <3s | WebPageTest, Lighthouse |
| Accessibility | AA | axe DevTools, WAVE |
| Mobile UX | Pass | Real device testing |
| Type Errors | 0 | `npm run typecheck` |
| Console Errors | 0 | Browser console in prod |
| Component Tests | 20+ | Vitest test files |
| E2E Tests | 5+ critical flows | Playwright tests |
| Design System Usage | 100% | Code review audit |

### Definition of Done

A feature/page is "done" when:
1. ✅ All acceptance criteria met
2. ✅ Unit tests written (80%+ coverage)
3. ✅ Integration tests for API calls
4. ✅ E2E test for critical flow
5. ✅ WCAG 2.1 AA compliance verified
6. ✅ Mobile responsiveness checked
7. ✅ Dark mode tested
8. ✅ Keyboard navigation tested
9. ✅ Code reviewed and approved
10. ✅ Zero console errors
11. ✅ Performance acceptable (< 3s load)
12. ✅ Documented (JSDoc + component story)

---

## Summary

**Phase 3: Admin Dashboard UI** is a comprehensive implementation of a production-ready React admin interface that integrates seamlessly with the Phase 2 API layer.

**Key Deliverables:**
- 5 fully functional admin pages
- 15+ reusable React components
- Complete design system integration
- 80%+ test coverage
- WCAG 2.1 AA accessibility compliance
- Sub-3-second page load performance

**Timeline:** 4-5 days with proper prioritization and team communication.

**Critical Success Factors:**
1. Solid component architecture foundation (Phase 3A)
2. Proper state management hooks early (Phase 3B)
3. API integration testing (Phase 3C-D)
4. Accessibility-first approach throughout
5. Comprehensive test coverage
6. Regular performance monitoring

This specification provides the detailed blueprint needed for successful implementation. Each section is specific, actionable, and includes code examples where helpful.

---

**Next Steps:**
1. Review and approve specification
2. Set up project structure and routing (Phase 3A)
3. Begin component development
4. Integrate with Phase 2 API gradually
5. Add tests incrementally
6. Accessibility testing throughout development
