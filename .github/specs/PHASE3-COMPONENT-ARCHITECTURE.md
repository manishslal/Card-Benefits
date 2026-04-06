# Phase 3: Admin Dashboard - Component Architecture

**Version:** 1.0.0  
**Purpose:** Define component hierarchy, dependencies, and integration patterns  
**Audience:** Frontend developers, component library maintainers  

---

## Component Hierarchy Map

```
AdminApp (Root)
├── AdminLayout (Container)
│   ├── Sidebar
│   │   ├── Logo
│   │   ├── NavItem (× N)
│   │   ├── Divider
│   │   └── UserSection
│   │       └── UserMenu
│   ├── TopNavBar
│   │   ├── HamburgerToggle (mobile)
│   │   ├── Breadcrumb
│   │   ├── SearchBar (optional)
│   │   └── RightSection
│   │       ├── NotificationBell
│   │       ├── ThemeToggle
│   │       └── UserDropdown
│   └── MainContent
│       ├── PageHeader
│       │   ├── Title
│       │   ├── Description
│       │   ├── FilterBar (per-page)
│       │   └── ActionButtons
│       ├── PageContent
│       │   └── [Page-Specific Components]
│       └── Toast (Portal)
├── Modal (Portal)
│   └── [Modal-Specific Content]
└── Tooltip (Portal)
    └── [Tooltip Content]
```

---

## Layer 1: Layout Components (Structural)

These components define the overall page structure and aren't dependent on page-specific data.

### Component: AdminLayout

**Purpose:** Root layout wrapper for entire admin dashboard

**File Location:** `src/features/admin/components/layout/AdminLayout.tsx`

**Props:**
```typescript
interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}
```

**Responsibilities:**
- Render sidebar + top nav + main content
- Manage responsive state (mobile sidebar collapse)
- Handle dark mode
- Apply global admin styles

**Sub-components used:**
- Sidebar
- TopNavBar
- MainContent wrapper

**State:**
```typescript
const [sidebarOpen, setSidebarOpen] = useState(false);
const [theme, setTheme] = useState<'light' | 'dark'>('light');
```

**Example:**
```typescript
<AdminLayout title="Card Management">
  <CardManagementPage />
</AdminLayout>
```

---

### Component: Sidebar

**Purpose:** Navigation menu and branding

**File Location:** `src/features/admin/components/layout/Sidebar.tsx`

**Props:**
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
- Show user info
- Handle logout

**Children:**
- NavItem (map over routes)
- Divider
- UserSection

**State:**
- isOpen (from parent)
- currentPath (from useRouter)

**Key Features:**
- Active state highlighting
- Collapsible on mobile
- Fixed position on desktop
- Smooth animations

---

### Component: TopNavBar

**Purpose:** Header with user controls and page title

**File Location:** `src/features/admin/components/layout/TopNavBar.tsx`

**Props:**
```typescript
interface TopNavBarProps {
  onToggleSidebar?: () => void;
  currentPage?: string;
  breadcrumb?: BreadcrumbItem[];
}
```

**Children:**
- HamburgerToggle (mobile)
- Breadcrumb
- UserDropdown
- ThemeToggle

**Responsibilities:**
- Display page title/breadcrumb
- Show user menu with logout
- Dark mode toggle
- Sidebar toggle (mobile)

---

### Component: PageHeader

**Purpose:** Per-page header with title, filters, and actions

**File Location:** `src/features/admin/components/layout/PageHeader.tsx`

**Props:**
```typescript
interface PageHeaderProps {
  title: string;
  description?: string;
  filters?: React.ReactNode;
  actions?: ActionButton[];
  breadcrumb?: BreadcrumbItem[];
  showDivider?: boolean;
}

interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
  icon?: React.ReactNode;
  isLoading?: boolean;
  disabled?: boolean;
}
```

**Responsibilities:**
- Display consistent page header
- Render filter controls
- Show action buttons
- Optional breadcrumb

**Used By:**
- Dashboard page
- Cards page
- Users page
- Audit logs page

---

## Layer 2: Data Display Components (Views)

These components display data and support pagination/filtering.

### Component: DataTable

**Purpose:** Flexible table for displaying paginated data

**File Location:** `src/features/admin/components/data/DataTable.tsx`

**Props:**
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
  rowKey: keyof T;
  emptyStateMessage?: string;
}

interface ColumnDef<T> {
  key: keyof T;
  label: string;
  width?: string; // CSS width
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  cellClassName?: string;
}
```

**Sub-components:**
- DataTableHeader (column headers)
- DataTableRow (individual rows)
- LoadingState (skeleton rows)
- EmptyState (no data)
- PaginationControls (below table)

**State:**
```typescript
const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
const [sortColumn, setSortColumn] = useState<string | null>(null);
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
```

**Key Features:**
- Custom column rendering
- Sortable columns
- Row selection
- Responsive horizontal scroll (mobile)
- Keyboard navigation

**Example Usage:**
```typescript
<DataTable
  columns={[
    { key: 'cardName', label: 'Card Name', sortable: true },
    { key: 'issuer', label: 'Issuer', sortable: true },
    {
      key: 'benefits',
      label: 'Benefits',
      render: (value: number) => <Badge>{value} benefits</Badge>
    }
  ]}
  data={cards}
  pagination={pagination}
  onPageChange={setPage}
  rowKey="id"
/>
```

---

### Component: DataGrid

**Purpose:** Card-based responsive alternative to tables

**File Location:** `src/features/admin/components/data/DataGrid.tsx`

**Props:**
```typescript
interface DataGridProps<T> {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  isLoading: boolean;
  isEmpty: boolean;
  error?: string;
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  columns?: number; // 1, 2, or 3 per row
}
```

**Responsibilities:**
- Render items as cards
- Responsive grid layout
- Pagination support
- Loading/empty/error states

**Key Features:**
- Auto-responsive (1 col mobile, 2 col tablet, 3 col desktop)
- Customizable columns prop
- Same data as table (can switch between)

---

### Component: PaginationControls

**Purpose:** Pagination UI controls

**File Location:** `src/features/admin/components/data/PaginationControls.tsx`

**Props:**
```typescript
interface PaginationControlsProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  isLoading?: boolean;
  showPageNumbers?: boolean; // Show 1 2 3 or just Prev/Next
}
```

**Renders:**
- Previous button
- Page numbers (optional)
- Next button
- Items per page selector (optional)
- Current range display (e.g., "Showing 1-20 of 100")

---

### Component: LoadingState

**Purpose:** Display while data is loading

**File Location:** `src/features/admin/components/states/LoadingState.tsx`

**Props:**
```typescript
interface LoadingStateProps {
  type?: 'spinner' | 'skeleton' | 'pulse';
  rows?: number; // For skeleton type
  height?: string; // Height of skeleton rows
}
```

**Renders:**
- Spinner (default): Centered loading spinner
- Skeleton: Placeholder rows matching table structure
- Pulse: Pulsing background (subtle loading)

---

### Component: EmptyState

**Purpose:** Display when no data available

**File Location:** `src/features/admin/components/states/EmptyState.tsx`

**Props:**
```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; };
  actionVariant?: 'primary' | 'secondary';
}
```

**Renders:**
- Icon (optional)
- Title and description
- Action button (optional)

**Examples:**
- No cards: "No cards found. Create one to get started."
- No audit logs: "No audit activity yet."

---

### Component: ErrorState

**Purpose:** Display when error occurs

**File Location:** `src/features/admin/components/states/ErrorState.tsx`

**Props:**
```typescript
interface ErrorStateProps {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void; };
  details?: string;
  icon?: React.ReactNode;
}
```

**Renders:**
- Error icon
- Title and message
- Optional detailed error (dev mode only)
- Retry/action button

---

## Layer 3: Form Components (Input)

Reusable form field components with validation support.

### Component: FormGroup

**Purpose:** Label + input + error wrapper

**File Location:** `src/features/admin/components/form/FormGroup.tsx`

**Props:**
```typescript
interface FormGroupProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  htmlFor?: string; // Link label to input via id
}
```

**Responsibilities:**
- Render label
- Display error message
- Show hint text
- Associate label with input (accessibility)

---

### Component: FormInput

**Purpose:** Text/number/email/URL input with validation

**File Location:** `src/features/admin/components/form/FormInput.tsx`

**Props:**
```typescript
interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode; // Icon prefix/suffix
  isLoading?: boolean;
  validation?: (value: string) => string | null; // Custom validator
  type?: 'text' | 'email' | 'number' | 'url' | 'password';
}
```

**Responsibilities:**
- Render input field
- Show label, error, hint
- Real-time validation (optional)
- Display loading/validating state

**Key Features:**
- Type-specific: email, URL validation
- Custom validator support
- Icon support (search, check, etc.)
- Accessible labeling

---

### Component: FormSelect

**Purpose:** Dropdown/select field

**File Location:** `src/features/admin/components/form/FormSelect.tsx`

**Props:**
```typescript
interface FormSelectProps {
  label: string;
  name: string;
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  placeholder?: string;
  multiple?: boolean;
}

interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}
```

**Responsibilities:**
- Render dropdown
- Handle selection
- Support search (optional)
- Show error

**Used By:**
- Card filters (Issuer, Status)
- User filters (Role)
- Audit log filters (Resource Type, Action)

---

### Component: FormToggle

**Purpose:** Checkbox/switch for boolean fields

**File Location:** `src/features/admin/components/form/FormToggle.tsx`

**Props:**
```typescript
interface FormToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
  disabled?: boolean;
  name?: string;
}
```

**Responsibilities:**
- Render checkbox or switch
- Handle state
- Display label and description

---

### Component: Form

**Purpose:** Form wrapper with submission handling

**File Location:** `src/features/admin/components/form/Form.tsx`

**Props:**
```typescript
interface FormProps {
  onSubmit: (formData: Record<string, any>) => Promise<void> | void;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
}
```

**Responsibilities:**
- Collect form data from children
- Handle submission
- Show loading state
- Display form-level errors
- Handle cancel action

---

## Layer 4: Modal/Dialog Components (Overlays)

Overlay components for modals, confirmations, and drawers.

### Component: Modal

**Purpose:** Dialog box for forms, details, confirmations

**File Location:** `src/features/admin/components/modal/Modal.tsx`

**Props:**
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode; // Custom footer with buttons
}
```

**Responsibilities:**
- Render modal overlay
- Display content
- Handle close (ESC, backdrop, button)
- Focus trap
- Scroll prevention (body)

**Key Features:**
- Backdrop click to close
- Escape key support
- Customizable footer
- Centered on screen
- Smooth animations

---

### Component: ConfirmDialog

**Purpose:** Confirmation dialog for destructive actions

**File Location:** `src/features/admin/components/modal/ConfirmDialog.tsx`

**Props:**
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger'; // Red styling for danger
  isLoading?: boolean;
  confirmButtonDisabled?: boolean;
}
```

**Responsibilities:**
- Show confirmation prompt
- Handle confirm/cancel
- Red styling for dangerous actions
- Loading state on confirm button

**Used By:**
- Delete card
- Delete benefit
- Revoke admin role
- Delete audit log entry

---

## Layer 5: Notification Components

Components for user feedback and alerts.

### Component: Toast

**Purpose:** Transient notification message

**File Location:** `src/features/admin/components/notification/Toast.tsx`

**Props:**
```typescript
interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // ms before auto-close
  onClose: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

**Renders:**
- Icon (colored by type)
- Message
- Optional action button
- Close button
- Auto-dismiss after duration

**Example:**
```typescript
showToast('Card created successfully', 'success');
showToast('Error saving card', 'error', { label: 'Retry', onClick: retry });
```

---

### Component: ToastContainer

**Purpose:** Container for multiple toasts

**File Location:** `src/features/admin/components/notification/ToastContainer.tsx`

**Props:**
```typescript
interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}
```

**Responsibilities:**
- Stack multiple toasts
- Position on screen (bottom-right)
- Remove toast on close
- Auto-dismiss handling

---

### Component: Badge

**Purpose:** Small status/label component

**File Location:** `src/features/admin/components/badge/Badge.tsx`

**Props:**
```typescript
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}
```

**Color Mapping:**
- default: Gray
- success: Green (#0a7d57)
- warning: Orange (#d97706)
- error: Red (#ef4444)
- info: Cyan (#0891b2)

**Usage:**
```typescript
<Badge variant="success">8 Benefits</Badge>
<Badge variant="warning">Active</Badge>
```

---

### Component: StatusIndicator

**Purpose:** Visual status dot/light

**File Location:** `src/features/admin/components/badge/StatusIndicator.tsx`

**Props:**
```typescript
interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'pending' | 'error';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}
```

**Status Colors:**
- active: Green
- inactive: Gray
- pending: Yellow
- error: Red

---

## Layer 6: Specialized Components (Domain-Specific)

Components specific to admin features.

### Component: BenefitEditor

**Purpose:** Manage benefits for a card

**File Location:** `src/features/admin/components/benefits/BenefitEditor.tsx`

**Props:**
```typescript
interface BenefitEditorProps {
  cardId: string;
  benefits: Benefit[];
  onAdd: (benefit: BenefitFormData) => Promise<void>;
  onEdit: (id: string, benefit: BenefitFormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleDefault: (id: string, isDefault: boolean) => Promise<void>;
  isLoading?: boolean;
  error?: string;
}
```

**Sub-components:**
- BenefitList
  - BenefitRow (× N)
    - BenefitActions (Edit, Delete, Toggle Default)
- BenefitForm (Modal - Add/Edit)
- BenefitDeleteConfirm (Modal)

**Responsibilities:**
- Display list of benefits
- Add new benefit
- Edit existing benefit
- Delete benefit (with confirmation)
- Toggle default status

**Key Features:**
- Optimistic toggle for default
- Inline editing (optional)
- Drag-to-reorder (optional)
- Loading states

---

### Component: AuditLogViewer

**Purpose:** Display and filter audit logs

**File Location:** `src/features/admin/components/audit/AuditLogViewer.tsx`

**Props:**
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

interface AuditFilters {
  resourceType?: 'card' | 'benefit' | 'user_role' | 'all';
  action?: 'create' | 'update' | 'delete' | 'all';
  changedBy?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}
```

**Sub-components:**
- AuditFilterBar
- AuditLogTable
  - AuditLogRow (expandable)
    - AuditLogDetails (expanded view)
      - DiffView (for updates)
      - CopyButton (JSON)

**Key Features:**
- Filter by resource, action, admin, date, search
- Expandable rows for full details
- Before/after diff for updates
- JSON export
- Pagination

---

### Component: RoleAssignmentModal

**Purpose:** Assign or revoke admin role

**File Location:** `src/features/admin/components/users/RoleAssignmentModal.tsx`

**Props:**
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

**Renders:**
- User name and email
- Current/new role display
- Action-specific message
- Warning if self-revoke
- Confirm/Cancel buttons

---

## Layer 7: Page Components (Containers)

High-level page components that compose lower-level components.

### Component: DashboardPage

**File Location:** `src/app/admin/page.tsx`

**Composes:**
- AdminLayout
- PageHeader
- StatCard (× 4)
- RecentActivityWidget
  - AuditLogViewer (limit: 10)
- QuickActionsPanel

**Data Fetching:**
- useStats()
- useAuditLogs({ limit: 10 })

---

### Component: CardManagementPage

**File Location:** `src/app/admin/cards/page.tsx`

**Composes:**
- AdminLayout
- PageHeader (with filters)
- FilterBar (issuer, status, search, sort)
- DataTable
- PaginationControls
- Modal: CardCreateForm

**Data Fetching:**
- useCards(page, limit, filters)

**State:**
- page, limit
- filters (issuer, status, search, sort)
- selectedCard (for edit modal)

---

### Component: CardDetailPage

**File Location:** `src/app/admin/cards/[id]/page.tsx`

**Composes:**
- AdminLayout
- PageHeader (breadcrumb: Cards > Card Name)
- CardDetailForm (read-only or edit mode)
- BenefitEditor
- Modal: CardEditForm
- ConfirmDialog: Delete Card

**Data Fetching:**
- useCard(cardId)
- useBenefits(cardId)

---

### Component: UserManagementPage

**File Location:** `src/app/admin/users/page.tsx`

**Composes:**
- AdminLayout
- PageHeader (with filters)
- FilterBar (role, search)
- DataTable
- PaginationControls
- Modal: RoleAssignmentModal

**Data Fetching:**
- useUsers(page, limit, filters)

---

### Component: AuditLogPage

**File Location:** `src/app/admin/audit-logs/page.tsx`

**Composes:**
- AdminLayout
- PageHeader
- FilterBar (resource, action, admin, dates)
- AuditLogViewer
- PaginationControls

**Data Fetching:**
- useAuditLogs(filters, page, limit)

---

## Context & State Management

### Context: AdminContext

**Purpose:** Share admin-wide state

**File Location:** `src/features/admin/context/AdminContext.tsx`

```typescript
interface AdminContextValue {
  // Pagination state
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  setItemsPerPage: (limit: number) => void;

  // Filter state
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  clearFilters: () => void;

  // Modal state
  activeModal: string | null;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const AdminProvider: React.FC<{ children: React.ReactNode }> = (props) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [filters, setFilters] = useState({});
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // ...
};
```

---

### Context: UIContext

**Purpose:** Global UI state (theme, sidebar, toasts)

**File Location:** `src/features/admin/context/UIContext.tsx`

```typescript
interface UIContextValue {
  // Theme
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  removeToast: (id: string) => void;
}

export const useUI = () => useContext(UIContext);
```

---

## Custom Hooks

### Hook: useCards

**Purpose:** Fetch and manage card list

**File Location:** `src/features/admin/hooks/useCards.ts`

```typescript
interface UseCardsOptions {
  page: number;
  limit: number;
  filters?: {
    issuer?: string;
    status?: 'active' | 'archived';
    search?: string;
    sortBy?: 'issuer' | 'cardName' | 'updatedAt';
    sortDirection?: 'asc' | 'desc';
  };
}

function useCards(options: UseCardsOptions) {
  const [cards, setCards] = useState<Card[]>([]);
  const [pagination, setPagination] = useState({...});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCards();
  }, [options.page, options.limit, options.filters]);

  const refetch = useCallback(() => fetchCards(), []);

  return { cards, pagination, isLoading, error, refetch };
}
```

---

### Hook: useBenefits

**Purpose:** Fetch and manage benefits for a card

**File Location:** `src/features/admin/hooks/useBenefits.ts`

```typescript
function useBenefits(cardId: string) {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cardId) {
      fetchBenefits(cardId);
    }
  }, [cardId]);

  const addBenefit = useCallback(async (data: BenefitFormData) => {
    // POST /api/admin/benefits
  }, [cardId]);

  const updateBenefit = useCallback(async (id: string, data: BenefitFormData) => {
    // PUT /api/admin/benefits/:id
  }, []);

  const deleteBenefit = useCallback(async (id: string) => {
    // DELETE /api/admin/benefits/:id
  }, []);

  const toggleDefault = useCallback(async (id: string, isDefault: boolean) => {
    // PUT /api/admin/benefits/:id { isDefault }
  }, []);

  return {
    benefits,
    isLoading,
    error,
    addBenefit,
    updateBenefit,
    deleteBenefit,
    toggleDefault,
  };
}
```

---

### Hook: useToast

**Purpose:** Show toast notifications

**File Location:** `src/features/admin/hooks/useToast.ts`

```typescript
function useToast() {
  const { addToast, removeToast, toasts } = useUI();

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning', duration = 4000) => {
      const id = generateId();
      addToast(message, type);
      
      if (duration) {
        setTimeout(() => removeToast(id), duration);
      }

      return id;
    },
    [addToast, removeToast]
  );

  return { showToast, toasts, removeToast };
}
```

---

### Hook: useModal

**Purpose:** Manage modal open/close

**File Location:** `src/features/admin/hooks/useModal.ts`

```typescript
function useModal(modalId: string) {
  const { activeModal, openModal, closeModal } = useUI();

  const isOpen = activeModal === modalId;

  const open = useCallback(() => openModal(modalId), []);
  const close = useCallback(() => closeModal(), []);

  return { isOpen, open, close };
}
```

---

## Dependency Graph

```
Layer 1 (Layout):
  AdminLayout
  ├─ Sidebar
  ├─ TopNavBar
  └─ MainContent

Layer 2 (Data):
  DataTable ─┬─ LoadingState
             ├─ EmptyState
             └─ PaginationControls
  
  DataGrid ──┬─ LoadingState
             └─ PaginationControls

Layer 3 (Forms):
  Form ──┬─ FormGroup
         ├─ FormInput
         ├─ FormSelect
         └─ FormToggle

Layer 4 (Modals):
  Modal ───────── [Content]
  ConfirmDialog ─ Modal

Layer 5 (Notifications):
  ToastContainer ─┬─ Toast
                  └─ [Multiple Toasts]
  
  Badge
  StatusIndicator

Layer 6 (Specialized):
  BenefitEditor ────┬─ BenefitList ──┬─ BenefitRow
                    ├─ BenefitForm ─ Form
                    └─ Modal
  
  AuditLogViewer ───┬─ FilterBar
                    ├─ DataTable
                    └─ ExpandableRow
  
  RoleAssignmentModal ─ Modal

Layer 7 (Pages):
  DashboardPage ──────┬─ AdminLayout
                      ├─ PageHeader
                      ├─ StatCard (×4)
                      ├─ RecentActivityWidget
                      └─ QuickActionsPanel
  
  CardManagementPage ─┬─ AdminLayout
                      ├─ PageHeader
                      ├─ FilterBar
                      ├─ DataTable
                      ├─ Modal
                      └─ ConfirmDialog
  
  CardDetailPage ─────┬─ AdminLayout
                      ├─ PageHeader
                      ├─ CardDetailForm
                      ├─ BenefitEditor
                      └─ Modals
  
  UserManagementPage ─┬─ AdminLayout
                      ├─ PageHeader
                      ├─ DataTable
                      ├─ Modal
  
  AuditLogPage ───────┬─ AdminLayout
                      ├─ PageHeader
                      ├─ AuditLogViewer
```

---

## Component Development Order

**Recommended build sequence** (respecting dependencies):

### Sprint 1: Foundation (Day 1-2)
1. ✅ AdminLayout, Sidebar, TopNavBar (must be first)
2. ✅ PageHeader, Button, Badge basics
3. ✅ LoadingState, EmptyState, ErrorState
4. ✅ PaginationControls
5. ✅ AdminContext, UIContext

### Sprint 2: Data Display (Day 2-3)
6. ✅ DataTable (depends on LoadingState)
7. ✅ DataGrid (same data as table)
8. ✅ Hooks: useCards, useAuditLogs, useUsers, useBenefits

### Sprint 3: Forms (Day 3-4)
9. ✅ Form, FormGroup, FormInput, FormSelect, FormToggle
10. ✅ Modal, ConfirmDialog (depends on Form)

### Sprint 4: Notifications (Day 4)
11. ✅ Toast, ToastContainer
12. ✅ useToast, useModal hooks

### Sprint 5: Pages (Day 4-5)
13. ✅ DashboardPage (simplest)
14. ✅ CardManagementPage (depends on DataTable, Form, Modal)
15. ✅ UserManagementPage (similar to Cards)
16. ✅ AuditLogPage (depends on DataTable)
17. ✅ CardDetailPage (most complex, depends on BenefitEditor)

### Sprint 6: Specialized (Day 5)
18. ✅ BenefitEditor (depends on Modal, Form)
19. ✅ AuditLogViewer (depends on DataTable)
20. ✅ RoleAssignmentModal (depends on Modal)

### Sprint 7: Polish & Testing
21. ✅ Integration tests
22. ✅ Accessibility audit
23. ✅ Performance optimization
24. ✅ Dark mode verification
25. ✅ Mobile responsiveness review

---

## File Structure

```
src/
├── features/
│   └── admin/
│       ├── components/
│       │   ├── layout/
│       │   │   ├── AdminLayout.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── TopNavBar.tsx
│       │   │   └── PageHeader.tsx
│       │   ├── data/
│       │   │   ├── DataTable.tsx
│       │   │   ├── DataGrid.tsx
│       │   │   └── PaginationControls.tsx
│       │   ├── states/
│       │   │   ├── LoadingState.tsx
│       │   │   ├── EmptyState.tsx
│       │   │   └── ErrorState.tsx
│       │   ├── form/
│       │   │   ├── FormGroup.tsx
│       │   │   ├── FormInput.tsx
│       │   │   ├── FormSelect.tsx
│       │   │   ├── FormToggle.tsx
│       │   │   └── Form.tsx
│       │   ├── modal/
│       │   │   ├── Modal.tsx
│       │   │   └── ConfirmDialog.tsx
│       │   ├── notification/
│       │   │   ├── Toast.tsx
│       │   │   └── ToastContainer.tsx
│       │   ├── badge/
│       │   │   ├── Badge.tsx
│       │   │   └── StatusIndicator.tsx
│       │   ├── benefits/
│       │   │   ├── BenefitEditor.tsx
│       │   │   ├── BenefitList.tsx
│       │   │   ├── BenefitRow.tsx
│       │   │   └── BenefitForm.tsx
│       │   ├── audit/
│       │   │   ├── AuditLogViewer.tsx
│       │   │   ├── AuditLogTable.tsx
│       │   │   ├── AuditLogRow.tsx
│       │   │   └── DiffView.tsx
│       │   ├── users/
│       │   │   └── RoleAssignmentModal.tsx
│       │   └── __tests__/
│       │       ├── AdminLayout.test.tsx
│       │       ├── DataTable.test.tsx
│       │       ├── FormInput.test.tsx
│       │       └── ... (one test per component)
│       ├── context/
│       │   ├── AdminContext.tsx
│       │   └── UIContext.tsx
│       ├── hooks/
│       │   ├── useCards.ts
│       │   ├── useUsers.ts
│       │   ├── useAuditLogs.ts
│       │   ├── useBenefits.ts
│       │   ├── useToast.ts
│       │   └── useModal.ts
│       └── types/
│           └── admin.ts (TypeScript interfaces)
└── app/
    └── admin/
        ├── page.tsx (Dashboard)
        ├── cards/
        │   ├── page.tsx (Card list)
        │   ├── [id]/
        │   │   └── page.tsx (Card detail)
        ├── users/
        │   └── page.tsx (User management)
        └── audit-logs/
            └── page.tsx (Audit log viewer)
```

---

## Integration Points

### With Phase 2 API

Each hook connects to Phase 2 endpoints:

```typescript
// useCards.ts
async function fetchCards(options) {
  const response = await fetch('/api/admin/cards?page=...&limit=...');
  return response.json();
}

// useBenefits.ts
async function fetchBenefits(cardId) {
  const response = await fetch(`/api/admin/cards/${cardId}/benefits`);
  return response.json();
}

// Similar for users, audit logs, etc.
```

### With Authentication (Phase 1)

AdminLayout checks user role:

```typescript
const { user } = useAuth();
if (user?.role !== 'ADMIN') {
  return <AccessDenied />;
}
```

### With Design Tokens

All colors use CSS variables:

```typescript
className="bg-[var(--color-bg)] text-[var(--color-text)]"
```

---

## Reusability & Composability

**Highly Reusable Components:**
- DataTable (any data type)
- Form components (any fields)
- Modal (any content)
- Toast (any message)
- Badge (any status)

**Page-Specific Components:**
- BenefitEditor (benefits only)
- AuditLogViewer (audit only)
- RoleAssignmentModal (users only)

**Share Components Across Pages:**
- All pages use DataTable with different data
- All pages use Modal for different purposes
- All pages use Toast for notifications

This design promotes reusability and consistency across the admin dashboard.

---

## Summary

The component architecture is organized in 7 layers:
1. **Layout** - Page structure (AdminLayout, Sidebar, TopNav)
2. **Data Display** - Tables, grids, pagination
3. **Forms** - Input fields, form wrapper
4. **Modals** - Dialog overlays, confirmations
5. **Notifications** - Toasts, badges, status
6. **Specialized** - Domain-specific (BenefitEditor, etc.)
7. **Pages** - High-level containers (DashboardPage, etc.)

Each layer builds on lower layers with clear dependencies. Custom hooks manage state and data fetching. Context provides shared state. Components are highly composable and reusable.

This architecture enables:
- ✅ Parallel development
- ✅ Clear separation of concerns
- ✅ Easy testing
- ✅ Maintainability
- ✅ Consistency across dashboard
- ✅ Code reuse
- ✅ Scalability for future features
