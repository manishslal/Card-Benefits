/**
 * Phase 3 Admin Dashboard - Implementation Guide & Quick Reference
 * 
 * This document provides a complete overview of the Phase 3 Admin Dashboard UI
 * and instructions for using all components and hooks.
 */

# Phase 3: Admin Dashboard UI - Complete Implementation

## Overview

Phase 3 delivers a production-ready Admin Dashboard UI for the Card-Benefits application.
It integrates seamlessly with the Phase 2 API endpoints and provides a comprehensive
admin interface for managing cards, benefits, users, and audit logs.

## Architecture

### Directory Structure

```
src/features/admin/
├── styles/                          # Design tokens and global styles
│   ├── design-tokens.css           # CSS variables for colors, typography, spacing
│   └── admin.css                   # Component utilities and layout styles
│
├── types/                          # Complete type definitions
│   ├── admin.ts                   # Main types (cards, benefits, users, audit)
│   ├── api.ts                     # API client types
│   ├── forms.ts                   # Form data types
│   └── index.ts                   # Barrel export
│
├── components/                     # React components (7 layers)
│   ├── layout/                    # Layer 1: Layout structure
│   │   ├── Layout.tsx            # AdminLayout, Sidebar, TopNavBar, PageHeader
│   │   └── index.ts
│   │
│   ├── data-display/             # Layer 2: Data presentation
│   │   ├── DataDisplay.tsx       # Table, pagination, loading, error, empty states
│   │   └── index.ts
│   │
│   ├── forms/                    # Layer 3: Forms and modals
│   │   ├── Forms.tsx             # FormGroup, inputs, selects, toggles, modals
│   │   └── index.ts
│   │
│   ├── notifications/            # Layer 4: Notifications and badges
│   │   ├── Notifications.tsx     # Toast, alerts, badges, indicators, progress
│   │   └── index.ts
│   │
│   ├── benefits/                 # Layer 5: Benefit-specific components
│   │   ├── BenefitEditor.tsx
│   │   ├── BenefitList.tsx
│   │   ├── BenefitForm.tsx
│   │   └── index.ts
│   │
│   ├── audit/                    # Layer 6: Audit-specific components
│   │   ├── AuditLogViewer.tsx
│   │   ├── AuditLogTable.tsx
│   │   ├── DiffView.tsx
│   │   └── index.ts
│   │
│   ├── users/                    # Layer 7: User-specific components
│   │   ├── RoleAssignmentModal.tsx
│   │   └── index.ts
│   │
│   └── index.ts                  # Barrel export all components
│
├── context/                        # State management
│   ├── AdminContext.tsx           # Admin state (cards, benefits, users, audit)
│   ├── UIContext.tsx              # UI state (theme, modals, toasts, sidebar)
│   └── index.ts                   # Barrel export
│
├── hooks/                          # Custom hooks
│   ├── useData.ts                # useCards, useBenefits, useUsers, useAuditLogs
│   ├── useUI.ts                  # useForm, useAsync, useDebounce, useLocalStorage, etc.
│   └── index.ts                  # Barrel export
│
├── lib/                            # Utilities
│   ├── api-client.ts             # Fetch client with caching and retry logic
│   ├── validators.ts             # Form validation with Zod
│   ├── formatting.ts             # Date, currency, enum formatting utilities
│   └── audit.ts                  # (Existing) Audit logging utilities
│
├── validation/                     # (Existing)
│   └── schemas.ts                # Zod schemas from Phase 2
│
└── README.md                       # This file
```

## Component Layers & Usage

### Layer 1: Layout Components

**AdminLayout** - Root wrapper providing context and layout

```tsx
import { AdminLayout } from '@/features/admin/components/layout';

export default function Page() {
  return (
    <AdminLayout>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNavBar title="My Page" />
        <main className="admin-content">
          {/* Page content */}
        </main>
      </div>
    </AdminLayout>
  );
}
```

**Sidebar** - Navigation menu with role-based items

```tsx
<Sidebar 
  collapsed={false} 
  onToggleCollapse={(collapsed) => console.log(collapsed)}
/>
```

**TopNavBar** - Header with user menu and theme toggle

```tsx
<TopNavBar 
  title="Dashboard"
  currentTheme="light"
  onThemeToggle={(theme) => console.log(theme)}
/>
```

**PageHeader** - Per-page header with title, filters, actions

```tsx
<PageHeader
  title="Cards"
  subtitle="Manage the master card catalog"
  actions={<button>+ New Card</button>}
  filters={<SearchInput />}
/>
```

### Layer 2: Data Display Components

**DataTable** - Flexible table with pagination, sorting, filtering

```tsx
import { DataTable } from '@/features/admin/components/data-display';

<DataTable
  columns={[
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => <button onClick={() => edit(row)}>Edit</button>,
    },
  ]}
  rows={users}
  loading={loading}
  error={error}
  sortBy="name"
  sortDirection="asc"
  onSort={(column, direction) => setSortBy(column)}
  selectable={true}
  onSelectionChange={(ids) => setSelectedIds(ids)}
/>
```

**PaginationControls** - Navigation for paginated data

```tsx
<PaginationControls
  page={currentPage}
  pageSize={20}
  total={totalCount}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
/>
```

**LoadingState** - Skeleton loader

```tsx
{loading ? <LoadingState rows={5} /> : <Content />}
```

**ErrorState** - Error display with retry

```tsx
{error && (
  <ErrorState
    title="Failed to load"
    message={error}
    onRetry={refetch}
  />
)}
```

**EmptyState** - Empty data display

```tsx
{cards.length === 0 && (
  <EmptyState
    title="No cards found"
    description="Create a new card to get started"
    action={{ label: 'New Card', onClick: () => setOpen(true) }}
  />
)}
```

### Layer 3: Form Components

**FormGroup** - Label + input + error wrapper

```tsx
<FormGroup
  label="Name"
  required
  error={errors.name}
  help="Full name of the card"
>
  <input value={name} onChange={(e) => setName(e.target.value)} />
</FormGroup>
```

**FormInput** - Text/email/number/URL input

```tsx
<FormInput
  name="issuer"
  label="Card Issuer"
  type="text"
  required
  error={errors.issuer}
  value={values.issuer}
  onChange={handleChange}
/>
```

**FormSelect** - Dropdown with options

```tsx
<FormSelect
  name="type"
  label="Benefit Type"
  required
  options={[
    { label: 'Insurance', value: 'INSURANCE' },
    { label: 'Cashback', value: 'CASHBACK' },
  ]}
  value={values.type}
  onChange={handleChange}
  error={errors.type}
/>
```

**FormToggle** - Checkbox/switch

```tsx
<FormToggle
  name="isDefault"
  label="Mark as default"
  description="This benefit is included by default"
  checked={values.isDefault}
  onChange={handleChange}
/>
```

**Form** - Form wrapper with submission

```tsx
<Form
  onSubmit={async (formData) => {
    const data = Object.fromEntries(formData);
    await createCard(data);
  }}
  loading={isSubmitting}
  error={formError}
  actions={
    <>
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="submit">Save</button>
    </>
  }
>
  {/* Form fields */}
</Form>
```

**Modal** - Dialog component

```tsx
<Modal
  isOpen={showModal}
  title="Create Card"
  onClose={() => setShowModal(false)}
  size="md"
  actions={
    <>
      <button onClick={() => setShowModal(false)}>Cancel</button>
      <button onClick={handleSubmit}>Create</button>
    </>
  }
>
  {/* Modal content */}
</Modal>
```

**ConfirmDialog** - Confirmation modal

```tsx
<ConfirmDialog
  isOpen={showConfirm}
  title="Delete Card"
  message="Are you sure? This cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  danger={true}
  onConfirm={async () => await deleteCard(cardId)}
  onCancel={() => setShowConfirm(false)}
/>
```

### Layer 4: Notification Components

**Toast** - Transient notification (auto-managed by ToastContainer)

**ToastContainer** - Container for stacked toasts

**Badge** - Status badge

```tsx
<Badge variant="primary">ADMIN</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="error">Inactive</Badge>
```

**StatusIndicator** - Visual status indicator

```tsx
<StatusIndicator status="active" label="Active" size="md" />
```

**Alert** - Dismissible alert

```tsx
<Alert
  type="error"
  title="Error"
  message="Something went wrong"
  onDismiss={() => setShowAlert(false)}
/>
```

**Progress** - Progress bar

```tsx
<Progress value={65} max={100} label="Loading" variant="default" />
```

**Tooltip** - Hover tooltip

```tsx
<Tooltip content="This is helpful information" position="top">
  <span>Hover me</span>
</Tooltip>
```

## Hooks & State Management

### Data Fetching Hooks

**useCards** - Fetch and manage cards

```tsx
const { cards, loading, error, pagination, refetch, createCard, updateCard, deleteCard } 
  = useCards({ limit: 20 });
```

**useBenefits** - Fetch and manage benefits

```tsx
const { benefits, loading, error, createBenefit, updateBenefit, toggleDefault, deleteBenefit }
  = useBenefits(cardId);
```

**useUsers** - Fetch and manage users

```tsx
const { users, loading, error, assignRole } = useUsers();
```

**useAuditLogs** - Fetch audit logs

```tsx
const { logs, loading, error, refetch } = useAuditLogs({
  actionType: 'CREATE',
  resourceType: 'CARD',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
});
```

### UI Hooks

**useForm** - Form state and validation

```tsx
const form = useForm({
  initialValues: { name: '', email: '' },
  onSubmit: async (values) => { /* ... */ },
  validate: (values) => {
    const errors = {};
    if (!values.name) errors.name = 'Name is required';
    return errors;
  },
});

// In component:
<input
  name="name"
  value={form.values.name}
  onChange={form.handleChange}
  onBlur={form.handleBlur}
/>
{form.touched.name && form.errors.name && (
  <span>{form.errors.name}</span>
)}
<button onClick={form.handleSubmit} disabled={form.isSubmitting}>
  {form.isSubmitting ? 'Loading...' : 'Submit'}
</button>
```

**useAsyncState** - Async operation state

```tsx
const { data, loading, error, execute } = useAsyncState<Card>();

const handleLoad = () => {
  execute(() => cardApi.get(cardId));
};
```

**useDebounce** - Debounce values (search, etc.)

```tsx
const [searchTerm, setSearchTerm] = useState('');
const debouncedTerm = useDebounce(searchTerm, 500);

useEffect(() => {
  // This runs when debouncedTerm changes (500ms after user stops typing)
  search(debouncedTerm);
}, [debouncedTerm]);
```

**useLocalStorage** - Persist state in localStorage

```tsx
const { value, set, remove } = useLocalStorage('admin-theme', 'light');

// Usage
set('dark');
remove(); // Resets to initial value
```

**useMediaQuery** - Check media query

```tsx
const isMobile = useMediaQuery('(max-width: 768px)');
```

**useOutsideClick** - Handle outside clicks

```tsx
const ref = useRef<HTMLDivElement>(null);
useOutsideClick(ref, () => setShowMenu(false));

return <div ref={ref}>{/* menu content */}</div>;
```

**useToggle** - Simple toggle state

```tsx
const [isOpen, toggle, set] = useToggle(false);

<button onClick={toggle}>{isOpen ? 'Close' : 'Open'}</button>
```

### Context Hooks

**useAdminContext** - Access admin state

```tsx
const adminState = useAdminContext();
// { cards, selectedCard, benefits, users, auditLogs, ... }
```

**useUIContext** - Access UI state

```tsx
const uiState = useUIContext();
// { theme, prefersDark, sidebarCollapsed, modal, toasts, breadcrumb, isLoading }
```

**useTheme** - Get theme info

```tsx
const { theme, prefersDark } = useTheme();
```

**useModal** - Get modal state

```tsx
const { modal } = useModal();
```

**useToast** - Get toasts

```tsx
const { toasts } = useToast();
```

## Utility Functions

### API Client

```tsx
import { cardApi, benefitApi, userApi, auditApi } from '@/features/admin/lib/api-client';

// Cards
const { data: cards, pagination } = await cardApi.list({ page: 1, limit: 20 });
const { data: card } = await cardApi.get(cardId);
const { data: newCard } = await cardApi.create({ issuer, cardName, ... });
await cardApi.update(cardId, { cardName: 'New Name' });
await cardApi.delete(cardId, { force: true });

// Benefits
const { data: benefits } = await benefitApi.list(cardId);
const { data: benefit } = await benefitApi.create(cardId, { name, type, ... });
await benefitApi.update(cardId, benefitId, { stickerValue: 50000 });
await benefitApi.toggleDefault(cardId, benefitId, { isDefault: true });

// Users
const { data: users } = await userApi.list();
await userApi.assignRole(userId, 'ADMIN');

// Audit Logs
const { data: logs } = await auditApi.list({ actionType: 'CREATE' });
```

### Validators

```tsx
import { cardFormSchema, benefitFormSchema, validateForm, fieldValidators } from '@/features/admin/lib/validators';

// Full form validation
const { valid, errors, data } = validateForm(cardFormSchema, formData);

// Field-level validation
const error = fieldValidators.issuer('Chase');
const error = fieldValidators.cardName('');
const error = fieldValidators.defaultAnnualFee(9500);
```

### Formatting

```tsx
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  formatPercentage,
  truncateText,
  capitalize,
  enumToLabel,
  formatBenefitType,
  formatResetCadence,
  formatActionType,
  formatResourceType,
} from '@/features/admin/lib/formatting';

// Usage
formatDate('2024-01-15') // "Jan 15, 2024"
formatDateTime('2024-01-15T10:00:00Z') // "Jan 15, 2024 10:00 AM"
formatRelativeTime('2024-01-15T10:00:00Z') // "2 hours ago"
formatCurrency(9500) // "$95.00"
formatBenefitType('INSURANCE') // "Insurance"
formatActionType('CREATE') // "Created"
```

## Dark Mode Support

Dark mode is fully supported via CSS variables and media queries:

```tsx
// System preference (automatic)
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #111827;
    /* ... other dark colors */
  }
}

// Manual toggle via class
<html className="dark">

// CSS variables automatically update
--color-text: #f9fafb; /* Light mode */
/* In dark mode: --color-text: #f9fafb; */
```

## Responsive Design

Components are fully responsive:

- **Mobile (375px)**: Single column, touch-friendly buttons
- **Tablet (768px)**: Two-column layout, optimized tables
- **Desktop (1440px)**: Multi-column layout, full features

All media queries use CSS variables for consistency:

```css
@media (max-width: 768px) {
  .admin-sidebar {
    flex-direction: row; /* Horizontal on mobile */
  }
}
```

## Accessibility (WCAG 2.1 AA)

All components include:

- Semantic HTML (nav, main, section, etc.)
- ARIA labels and descriptions
- Keyboard navigation support
- Focus visible states
- Screen reader announcements
- Color contrast compliance
- Touch target sizing (44px minimum)

## Type Safety

Full TypeScript support with no `any` types:

```tsx
import type {
  Card,
  Benefit,
  AdminUser,
  AuditLog,
  CardListQuery,
  ModalState,
} from '@/features/admin/types';
```

## Integration Example

Complete example of managing cards:

```tsx
'use client';

import { useState } from 'react';
import {
  PageHeader,
  DataTable,
  PaginationControls,
  Modal,
  FormInput,
  FormSelect,
  ConfirmDialog,
  Badge,
  StatusIndicator,
} from '@/features/admin/components';
import { useCards, useForm } from '@/features/admin/hooks';
import { formatCurrency } from '@/features/admin/lib/formatting';

export default function CardsPage() {
  const { cards, loading, error, pagination, refetch, createCard, updateCard, deleteCard }
    = useCards({ limit: 20 });

  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm({
    initialValues: {
      issuer: selectedCard?.issuer || '',
      cardName: selectedCard?.cardName || '',
      defaultAnnualFee: selectedCard?.defaultAnnualFee || '',
    },
    onSubmit: async (formData) => {
      const data = Object.fromEntries(formData);
      if (selectedCard) {
        await updateCard(selectedCard.id, data);
      } else {
        await createCard(data);
      }
      setShowModal(false);
      form.reset();
      refetch();
    },
  });

  return (
    <>
      <PageHeader
        title="Cards"
        actions={
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Card
          </button>
        }
      />

      <DataTable
        columns={[
          { key: 'issuer', label: 'Issuer', sortable: true },
          { key: 'cardName', label: 'Card Name' },
          { key: 'defaultAnnualFee', label: 'Annual Fee', render: (v) => formatCurrency(v) },
          {
            key: 'isActive',
            label: 'Status',
            render: (v) => <StatusIndicator status={v ? 'active' : 'inactive'} />,
          },
        ]}
        rows={cards}
        loading={loading}
        error={error?.message}
        onSort={(col, dir) => console.log(`Sort by ${col} ${dir}`)}
      />

      <PaginationControls
        page={page}
        pageSize={20}
        total={pagination?.total || 0}
        onPageChange={setPage}
      />

      <Modal
        isOpen={showModal}
        title={selectedCard ? 'Edit Card' : 'Create Card'}
        onClose={() => setShowModal(false)}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => form.handleSubmit({ preventDefault: () => {} } as any)}
              disabled={form.isSubmitting}
            >
              Save
            </button>
          </>
        }
      >
        <FormInput
          name="issuer"
          label="Issuer"
          value={form.values.issuer}
          onChange={form.handleChange}
          error={form.errors.issuer}
        />
        {/* More fields */}
      </Modal>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Delete Card"
        message={`Delete "${selectedCard?.cardName}"?`}
        onConfirm={async () => {
          if (selectedCard) {
            await deleteCard(selectedCard.id);
            setShowConfirm(false);
            refetch();
          }
        }}
        onCancel={() => setShowConfirm(false)}
        danger
      />
    </>
  );
}
```

## Testing

Component tests use Vitest + Playwright:

```bash
npm run test              # Run unit tests
npm run test:e2e         # Run E2E tests
npm run test:coverage    # Check coverage
```

## Best Practices

1. **Always use hooks** - Never access context directly
2. **Validate forms** - Use Zod schemas for validation
3. **Handle errors** - Always show error states to users
4. **Show loading states** - Let users know when data is loading
5. **Use semantic HTML** - Improves accessibility
6. **Test thoroughly** - Target 80%+ coverage
7. **Document components** - Write comments explaining WHY, not WHAT
8. **Mobile-first** - Design for mobile, scale up
9. **Responsive design** - Test at all breakpoints
10. **Dark mode** - Test all components in both modes

## Performance Considerations

- **Caching** - GET requests cached for 5 minutes by default
- **Pagination** - Load 20 items per page by default
- **Debouncing** - Search uses 500ms debounce
- **Lazy loading** - Components load on demand
- **Optimistic updates** - UI updates before server confirmation
- **Memoization** - Callbacks use `useCallback` to prevent re-renders

## Known Limitations

- No third-party state management (Redux) - use Context for now
- No real-time updates - manual refetch only
- Single admin per session - no multi-user coordination
- No file uploads - only URL-based images

## Future Enhancements

- [ ] TanStack Query for advanced caching
- [ ] WebSocket support for real-time updates
- [ ] Advanced filtering and search
- [ ] Batch operations
- [ ] Data export (CSV, PDF)
- [ ] Scheduled tasks
- [ ] Role-based access control (RBAC)
- [ ] Audit log export and analysis
- [ ] Dark mode toggle per user
- [ ] Sidebar customization

## Support & Troubleshooting

### Common Issues

**Q: Getting hydration mismatch?**
A: Add `suppressHydrationWarning` to root element or use `useEffect` to set mounted state.

**Q: Form not submitting?**
A: Check that you're calling `form.handleSubmit()` properly and the form has `onSubmit` handler.

**Q: Modals not showing?**
A: Ensure `isOpen` state is controlled properly and modal is rendered.

**Q: Toast not appearing?**
A: Check that `ToastContainer` is rendered in your layout with `toasts` from context.

**Q: Table sorting not working?**
A: Ensure column has `sortable: true` and you're handling `onSort` callback.

For more help, check component documentation and TypeScript types.
