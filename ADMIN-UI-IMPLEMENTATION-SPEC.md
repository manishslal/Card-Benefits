# Admin Dashboard UI Consolidation — Implementation Spec

> **Generated from**: 2 independent discovery agents (45 + 27 findings)
> **Total raw buttons found**: 47 across 7 files
> **Buttons to convert**: 33 (14 are semantic sort-header/row-toggle buttons — keep raw, enhance with ARIA)
> **Shared components available**: `Button`, `Skeleton`, `EmptyState` at `@/shared/components/ui/`

---

## Button Component API Reference

**Import**: `import { Button } from '@/shared/components/ui/button';`

| Prop | Values | Notes |
|------|--------|-------|
| `variant` | `primary` `secondary` `tertiary` `accent` `danger` `ghost` `outline` | Default: `primary` |
| `size` | `xs` `sm` `md` `lg` `icon-xs` `icon-sm` `icon` `icon-lg` | Default: `md` |
| `isLoading` | boolean | Shows spinner, disables button |
| `fullWidth` | boolean | `w-full` |
| `leftIcon` | ReactNode | Icon before text |
| `rightIcon` | ReactNode | Icon after text |
| `disabled` | boolean | Standard HTML disabled |

**Key behaviors built in**: gradient background on `primary`, hover lift (`-translate-y-0.5`), focus-visible ring (`outline-3 outline-[var(--color-primary)]`), proper disabled states, min touch targets.

---

## Sprint 1: Foundation & Biggest Visual Wins

**Goal**: Replace all 33 raw action buttons with the shared `Button` component + fix layout/navigation fundamentals. This sprint alone will fix ~60% of all reported issues.

### 1.1 — Add `Button` import to all admin files

Every file that will receive Button replacements needs the import. Add this to each file's import block:

**Files requiring new import**:
```
src/app/admin/cards/page.tsx
src/app/admin/cards/[id]/page.tsx
src/app/admin/benefits/page.tsx
src/app/admin/users/page.tsx
src/app/admin/audit/page.tsx
src/app/admin/_components/EditUserModal.tsx
src/app/admin/_components/EditBenefitModal.tsx
```

**Import line** (add alongside existing imports):
```tsx
import { Button } from '@/shared/components/ui/button';
```

---

### 1.2 — Replace CTA / Primary Action Buttons

These are the most visually impactful changes. They go from flat unstyled to gradient+shadow+hover-lift.

#### 1.2.1 — Cards page "Add Card" button

**File**: `src/app/admin/cards/page.tsx` ~line 403

**BEFORE**:
```tsx
<button
  onClick={() => setShowCreateModal(true)}
  className="px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors flex items-center gap-1"
  style={{ backgroundColor: 'var(--color-primary)' }}
>
  <Plus size={16} /> Add Card
</button>
```

**AFTER**:
```tsx
<Button
  variant="primary"
  size="sm"
  leftIcon={<Plus size={16} />}
  onClick={() => setShowCreateModal(true)}
>
  Add Card
</Button>
```

#### 1.2.2 — Card detail "Add Benefit" button

**File**: `src/app/admin/cards/[id]/page.tsx` ~line 328

**BEFORE**:
```tsx
<button
  onClick={() => setShowBenefitModal(true)}
  className="px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium text-sm"
  style={{ backgroundColor: 'var(--color-primary)' }}
>
  + Add Benefit
</button>
```

**AFTER**:
```tsx
<Button
  variant="primary"
  size="sm"
  leftIcon={<Plus size={16} />}
  onClick={() => setShowBenefitModal(true)}
>
  Add Benefit
</Button>
```

> Note: Add `Plus` to the lucide-react import for `cards/[id]/page.tsx` if not already imported.

---

### 1.3 — Replace Inline Table Action Buttons (Edit / Delete / View)

All table row action buttons follow a consistent pattern. Convert them all to:
- **Edit** → `variant="ghost" size="xs"`
- **Delete** → `variant="danger" size="xs"` (with `isLoading` for delete-in-progress)
- **View** (Link) → stays as `<Link>` but wrap with `<Button asChild variant="ghost" size="xs">`

#### 1.3.1 — Benefits page Edit/Delete

**File**: `src/app/admin/benefits/page.tsx` ~lines 437-454

**BEFORE**:
```tsx
<td className="px-6 py-4 text-right flex gap-2 justify-end">
  <button
    onClick={() => handleEdit(benefit)}
    disabled={isLoading}
    className="px-3 py-1 rounded text-sm hover:opacity-80 disabled:opacity-50 transition-colors"
    style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
  >
    Edit
  </button>
  <button
    onClick={() => handleDeleteBenefit(benefit.id)}
    disabled={isLoading}
    className="px-3 py-1 rounded text-sm hover:opacity-80 disabled:opacity-50 transition-colors"
    style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}
  >
    Delete
  </button>
</td>
```

**AFTER**:
```tsx
<td className="px-6 py-4 text-right">
  <div className="flex gap-2 justify-end">
    <Button
      variant="ghost"
      size="xs"
      onClick={() => handleEdit(benefit)}
      disabled={isLoading}
    >
      Edit
    </Button>
    <Button
      variant="danger"
      size="xs"
      onClick={() => handleDeleteBenefit(benefit.id)}
      disabled={isLoading}
    >
      Delete
    </Button>
  </div>
</td>
```

#### 1.3.2 — Users page Edit button

**File**: `src/app/admin/users/page.tsx` ~line 296

**BEFORE**:
```tsx
<td className="px-6 py-4 text-right">
  <button
    onClick={() => {
      setSelectedUserForEdit(user);
      setIsEditModalOpen(true);
    }}
    className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
    style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
  >
    Edit
  </button>
</td>
```

**AFTER**:
```tsx
<td className="px-6 py-4 text-right">
  <Button
    variant="ghost"
    size="xs"
    onClick={() => {
      setSelectedUserForEdit(user);
      setIsEditModalOpen(true);
    }}
  >
    Edit
  </Button>
</td>
```

#### 1.3.3 — Cards page View link + Delete row action

**File**: `src/app/admin/cards/page.tsx` ~lines 573-589

**BEFORE**:
```tsx
{!card.id.startsWith('temp-') && (
  <Link
    href={`/admin/cards/${card.id}`}
    className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
    style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
  >
    View
  </Link>
)}
<button
  onClick={() => handleDeleteCard(card.id)}
  className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
  style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}
>
  Delete
</button>
```

**AFTER**:
```tsx
{!card.id.startsWith('temp-') && (
  <Button asChild variant="ghost" size="xs">
    <Link href={`/admin/cards/${card.id}`}>
      View
    </Link>
  </Button>
)}
<Button
  variant="danger"
  size="xs"
  onClick={() => handleDeleteCard(card.id)}
>
  Delete
</Button>
```

#### 1.3.4 — Card detail page Edit/Delete

**File**: `src/app/admin/cards/[id]/page.tsx` ~lines 425-440

**BEFORE**:
```tsx
<button
  onClick={() => setEditingBenefit(benefit)}
  className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
  style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
>
  Edit
</button>
<button
  onClick={() => handleDeleteBenefit(benefit.id)}
  disabled={isDeleting === benefit.id}
  className="px-3 py-1 rounded text-sm hover:opacity-80 disabled:opacity-50 flex items-center gap-1 transition-colors"
  style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}
>
  {isDeleting === benefit.id && <Loader2 className="animate-spin" size={14} />}
  Delete
</button>
```

**AFTER**:
```tsx
<Button
  variant="ghost"
  size="xs"
  onClick={() => setEditingBenefit(benefit)}
>
  Edit
</Button>
<Button
  variant="danger"
  size="xs"
  onClick={() => handleDeleteBenefit(benefit.id)}
  isLoading={isDeleting === benefit.id}
>
  Delete
</Button>
```

---

### 1.4 — Replace Pagination Buttons (4 pages × 2 buttons = 8 total)

All four list pages have identical pagination button pairs. Apply the same pattern to all.

**Pattern — BEFORE** (identical in all 4 pages):
```tsx
<button
  onClick={() => setPage(Math.max(1, page - 1))}
  disabled={page === 1 || isLoading}
  className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
>
  Previous
</button>
<button
  onClick={() => setPage(page + 1)}
  disabled={!pagination.hasMore || isLoading}
  className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
>
  Next
</button>
```

**Pattern — AFTER**:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setPage(Math.max(1, page - 1))}
  disabled={page === 1 || isLoading}
>
  Previous
</Button>
<Button
  variant="outline"
  size="sm"
  onClick={() => setPage(page + 1)}
  disabled={!pagination.hasMore || isLoading}
>
  Next
</Button>
```

**Apply to these files (exact line numbers for "Previous" button)**:
- `src/app/admin/cards/page.tsx` ~line 603
- `src/app/admin/benefits/page.tsx` ~line 467
- `src/app/admin/users/page.tsx` ~line 320
- `src/app/admin/audit/page.tsx` ~line 309

---

### 1.5 — Replace Modal Action Buttons

#### 1.5.1 — Cards page Create Modal (Cancel + Create)

**File**: `src/app/admin/cards/page.tsx` ~lines 700-718

**BEFORE**:
```tsx
<div className="flex gap-3 pt-4">
  <button
    type="button"
    onClick={() => setShowCreateModal(false)}
    disabled={isSubmitting}
    className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
  >
    Cancel
  </button>
  <button
    type="submit"
    disabled={isSubmitting}
    className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    style={{ backgroundColor: 'var(--color-primary)' }}
  >
    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
    {isSubmitting ? 'Creating...' : 'Create Card'}
  </button>
</div>
```

**AFTER**:
```tsx
<div className="flex gap-3 pt-4">
  <Button
    type="button"
    variant="outline"
    fullWidth
    onClick={() => setShowCreateModal(false)}
    disabled={isSubmitting}
  >
    Cancel
  </Button>
  <Button
    type="submit"
    variant="primary"
    fullWidth
    isLoading={isSubmitting}
  >
    {isSubmitting ? 'Creating...' : 'Create Card'}
  </Button>
</div>
```

#### 1.5.2 — Cards page Delete Modal (Cancel + Delete)

**File**: `src/app/admin/cards/page.tsx` ~lines 743-759

**BEFORE**:
```tsx
<div className="flex gap-3">
  <button
    onClick={() => setShowDeleteModal(false)}
    disabled={isDeleting}
    className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
  >
    Cancel
  </button>
  <button
    onClick={handleDeleteCardConfirm}
    disabled={isDeleting}
    className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
    style={{ backgroundColor: 'var(--color-error)' }}
  >
    {isDeleting && <Loader2 className="animate-spin" size={16} />}
    {isDeleting ? 'Deleting...' : 'Delete'}
  </button>
</div>
```

**AFTER**:
```tsx
<div className="flex gap-3">
  <Button
    variant="outline"
    fullWidth
    onClick={() => setShowDeleteModal(false)}
    disabled={isDeleting}
  >
    Cancel
  </Button>
  <Button
    variant="danger"
    fullWidth
    onClick={handleDeleteCardConfirm}
    isLoading={isDeleting}
  >
    {isDeleting ? 'Deleting...' : 'Delete'}
  </Button>
</div>
```

#### 1.5.3 — Card detail Add Benefit Modal (Cancel + Add)

**File**: `src/app/admin/cards/[id]/page.tsx` ~lines 539-557

**BEFORE**:
```tsx
<div className="flex gap-3 pt-4">
  <button
    type="button"
    onClick={() => setShowBenefitModal(false)}
    disabled={isSubmitting}
    className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 transition-colors"
  >
    Cancel
  </button>
  <button
    type="submit"
    disabled={isSubmitting}
    className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
    style={{ backgroundColor: 'var(--color-primary)' }}
  >
    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
    {isSubmitting ? 'Adding...' : 'Add'}
  </button>
</div>
```

**AFTER**:
```tsx
<div className="flex gap-3 pt-4">
  <Button
    type="button"
    variant="outline"
    fullWidth
    onClick={() => setShowBenefitModal(false)}
    disabled={isSubmitting}
  >
    Cancel
  </Button>
  <Button
    type="submit"
    variant="primary"
    fullWidth
    isLoading={isSubmitting}
  >
    {isSubmitting ? 'Adding...' : 'Add'}
  </Button>
</div>
```

#### 1.5.4 — EditUserModal (Cancel + Save)

**File**: `src/app/admin/_components/EditUserModal.tsx` ~lines 289-305

**BEFORE**:
```tsx
<div className="flex gap-3 justify-end mt-6">
  <button
    type="button"
    onClick={onClose}
    disabled={isSubmitting}
    className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 transition-colors"
  >
    Cancel
  </button>
  <button
    type="submit"
    disabled={isSubmitting}
    className="px-4 py-2 rounded text-white hover:opacity-90 disabled:opacity-50 transition-colors"
    style={{ backgroundColor: 'var(--color-primary)' }}
  >
    {isSubmitting ? 'Saving...' : 'Save'}
  </button>
</div>
```

**AFTER**:
```tsx
<div className="flex gap-3 justify-end mt-6">
  <Button
    type="button"
    variant="outline"
    onClick={onClose}
    disabled={isSubmitting}
  >
    Cancel
  </Button>
  <Button
    type="submit"
    variant="primary"
    isLoading={isSubmitting}
  >
    {isSubmitting ? 'Saving...' : 'Save'}
  </Button>
</div>
```

#### 1.5.5 — EditUserModal Close (X) button

**File**: `src/app/admin/_components/EditUserModal.tsx` ~lines 164-171

**BEFORE**:
```tsx
<DialogPrimitive.Close asChild>
  <button
    aria-label="Close dialog"
    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors p-2 rounded-md hover:bg-[var(--color-bg-secondary)]"
  >
    <X size={24} />
  </button>
</DialogPrimitive.Close>
```

**AFTER**:
```tsx
<DialogPrimitive.Close asChild>
  <Button
    variant="ghost"
    size="icon-xs"
    aria-label="Close dialog"
  >
    <X size={20} />
  </Button>
</DialogPrimitive.Close>
```

#### 1.5.6 — EditBenefitModal (Cancel + Save)

**File**: `src/app/admin/_components/EditBenefitModal.tsx` ~lines 594-611

**BEFORE**:
```tsx
<div className="flex gap-3 justify-end mt-6">
  <button
    type="button"
    onClick={onClose}
    disabled={isSubmitting}
    className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 transition-colors"
  >
    Cancel
  </button>
  <button
    type="submit"
    disabled={isSubmitting}
    className="px-4 py-2 rounded text-white hover:opacity-90 disabled:opacity-50 transition-colors"
    style={{ backgroundColor: 'var(--color-primary)' }}
  >
    {isSubmitting ? 'Saving...' : 'Save'}
  </button>
</div>
```

**AFTER**:
```tsx
<div className="flex gap-3 justify-end mt-6">
  <Button
    type="button"
    variant="outline"
    onClick={onClose}
    disabled={isSubmitting}
  >
    Cancel
  </Button>
  <Button
    type="submit"
    variant="primary"
    isLoading={isSubmitting}
  >
    {isSubmitting ? 'Saving...' : 'Save'}
  </Button>
</div>
```

#### 1.5.7 — EditBenefitModal Close (X) button

**File**: `src/app/admin/_components/EditBenefitModal.tsx` ~line 337

Same pattern as EditUserModal close button (1.5.5 above).

#### 1.5.8 — EditBenefitModal "Add Override" button

**File**: `src/app/admin/_components/EditBenefitModal.tsx` ~line 501

**BEFORE**:
```tsx
<button
  type="button"
  onClick={handleAddOverride}
  disabled={isSubmitting || usedMonths.size >= 12}
  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded hover:opacity-80 disabled:opacity-50 transition-colors"
  style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
>
  <Plus size={14} />
  Add Override
</button>
```

**AFTER**:
```tsx
<Button
  type="button"
  variant="ghost"
  size="xs"
  leftIcon={<Plus size={14} />}
  onClick={handleAddOverride}
  disabled={isSubmitting || usedMonths.size >= 12}
>
  Add Override
</Button>
```

#### 1.5.9 — EditBenefitModal "Remove Override" trash button

**File**: `src/app/admin/_components/EditBenefitModal.tsx` ~line 548

**BEFORE**:
```tsx
<button
  type="button"
  onClick={() => handleRemoveOverride(idx)}
  disabled={isSubmitting}
  className="p-2 hover:opacity-80 rounded-lg disabled:opacity-50 transition-colors"
  style={{ color: 'var(--color-error)' }}
  aria-label={`Remove ${MONTH_NAMES[Number(entry.month) - 1]} override`}
>
  <Trash2 size={16} />
</button>
```

**AFTER**:
```tsx
<Button
  type="button"
  variant="ghost"
  size="icon-xs"
  onClick={() => handleRemoveOverride(idx)}
  disabled={isSubmitting}
  aria-label={`Remove ${MONTH_NAMES[Number(entry.month) - 1]} override`}
  className="text-[var(--color-error)]"
>
  <Trash2 size={16} />
</Button>
```

---

### 1.6 — Replace Filter Toggle Buttons (Cards page)

**File**: `src/app/admin/cards/page.tsx` ~lines 441-484

**BEFORE** (example for "All Cards" — same pattern for all 3):
```tsx
<button
  onClick={() => {
    setActiveFilter('all');
    setPage(1);
  }}
  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
    activeFilter === 'all'
      ? 'text-white'
      : 'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:opacity-80'
  }`}
  style={activeFilter === 'all' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : undefined}
>
  All Cards
</button>
```

**AFTER** (for all 3 filter buttons):
```tsx
<Button
  variant={activeFilter === 'all' ? 'primary' : 'ghost'}
  size="xs"
  onClick={() => {
    setActiveFilter('all');
    setPage(1);
  }}
>
  All Cards
</Button>
<Button
  variant={activeFilter === 'active' ? 'primary' : 'ghost'}
  size="xs"
  onClick={() => {
    setActiveFilter('active');
    setPage(1);
  }}
>
  Active Only
</Button>
<Button
  variant={activeFilter === 'archived' ? 'primary' : 'ghost'}
  size="xs"
  onClick={() => {
    setActiveFilter('archived');
    setPage(1);
  }}
>
  Archived Only
</Button>
```

---

### 1.7 — Fix Dashboard Quick Action Link Hovers

**File**: `src/app/admin/page.tsx` ~line 193

The dashboard quick action Links also use `hover:opacity-80` instead of proper hover states.

**BEFORE**:
```tsx
<Link
  key={idx}
  href={action.href}
  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors hover:opacity-80"
  style={{
    backgroundColor: 'var(--color-primary-bg-subtle)',
    color: 'var(--color-primary)',
  }}
>
```

**AFTER**:
```tsx
<Link
  key={idx}
  href={action.href}
  className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all hover:-translate-y-0.5 hover:shadow-md"
  style={{
    backgroundColor: 'var(--color-primary-bg-subtle)',
    color: 'var(--color-primary)',
  }}
>
```

This gives the quick action cards the same hover-lift effect as the primary Button variant.

---

### 1.8 — Fix Admin Body Background Color

**File**: `src/app/admin/layout.tsx` line 52

**BEFORE**:
```tsx
<div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
```

**AFTER**:
```tsx
<div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
```

**Rationale**: User dashboard uses `--color-bg` as the page background. Using `--color-bg-secondary` makes the admin look darker/grayer and inconsistent.

---

### 1.9 — Add Sidebar Active State with `usePathname()`

**File**: `src/app/admin/layout.tsx`

**Step 1**: Add import at top of file:
```tsx
import { usePathname } from 'next/navigation';
```

**Step 2**: Add inside the component function (after `useState` hooks):
```tsx
const pathname = usePathname();
```

**Step 3**: Replace the sidebar nav link rendering.

**BEFORE** (~line 72-79):
```tsx
<Link
  key={item.href}
  href={item.href}
  className="flex items-center gap-3 px-4 py-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors hover:opacity-80"
>
  <item.icon size={20} />
  <span>{item.label}</span>
</Link>
```

**AFTER**:
```tsx
{(() => {
  const isActive = item.href === '/admin'
    ? pathname === '/admin'
    : pathname.startsWith(item.href);
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)] font-semibold'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
      }`}
    >
      <item.icon size={20} />
      <span>{item.label}</span>
    </Link>
  );
})()}
```

**Alternative cleaner approach** — extract the `isActive` computation into the `.map()` callback:

```tsx
{([
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cards', label: 'Cards', icon: CreditCard },
  { href: '/admin/benefits', label: 'Benefits', icon: Gift },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit Log', icon: FileText },
] as { href: string; label: string; icon: LucideIcon }[]).map((item) => {
  const isActive = item.href === '/admin'
    ? pathname === '/admin'
    : pathname.startsWith(item.href);
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary)] font-semibold'
          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)]'
      }`}
      aria-current={isActive ? 'page' : undefined}
    >
      <item.icon size={20} />
      <span>{item.label}</span>
    </Link>
  );
})}
```

This fixes **two issues at once**:
- ✅ Sidebar active state indicator (Discovery Agent 1 #5, Agent 2 #4)
- ✅ Sidebar hover uses `hover:bg-[var(--color-bg-secondary)]` instead of `hover:opacity-80` (Discovery Agent 1 #6)
- ✅ Adds `aria-current="page"` for accessibility

---

### 1.10 — Fix Admin Header (safe-area + remove border-b)

**File**: `src/app/admin/layout.tsx` ~lines 113-120

**BEFORE**:
```tsx
<header
  className="sticky top-0 z-30 border-b px-4 py-4"
  style={{
    backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
    backdropFilter: 'blur(12px) saturate(180%)',
    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
    borderColor: 'var(--color-border)',
    boxShadow: 'var(--header-shadow)',
  }}
>
```

**AFTER**:
```tsx
<header
  className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] px-[max(1rem,env(safe-area-inset-right))] py-4"
  style={{
    backgroundColor: 'color-mix(in srgb, var(--color-bg) 80%, transparent)',
    backdropFilter: 'blur(12px) saturate(180%)',
    WebkitBackdropFilter: 'blur(12px) saturate(180%)',
    boxShadow: 'var(--header-shadow)',
  }}
>
```

**Changes**:
- Removed `border-b` class and `borderColor` style (user dashboard uses only shadow)
- Added `pt-[env(safe-area-inset-top)]` for notch/island safe area
- Changed `px-4` to `px-[max(1rem,env(safe-area-inset-right))]` for horizontal safe area

---

### 1.11 — Fix Sidebar "Back to Dashboard" hover

**File**: `src/app/admin/layout.tsx` ~lines 96-107

**BEFORE**:
```tsx
<Link
  href="/dashboard"
  className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:opacity-80"
  style={{
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
  }}
>
```

**AFTER**:
```tsx
<Link
  href="/dashboard"
  className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg transition-colors text-sm font-medium hover:bg-[var(--color-bg-secondary)]"
  style={{
    color: 'var(--color-text-secondary)',
  }}
>
```

---

### Sprint 1 Verification Commands

After completing Sprint 1, run these to confirm no raw action buttons remain (sort headers are expected raw buttons):

```bash
# Count remaining raw <button> elements (should be ~14: sort headers + audit row toggle)
grep -rn '<button' src/app/admin/ | grep -v 'handleSort\|getSortIndicator\|expandedId' | wc -l

# Verify Button import was added to all files
grep -rn "import.*Button.*from.*shared/components/ui/button" src/app/admin/

# Verify no hover:opacity-80 remains on sidebar links
grep -rn 'hover:opacity-80' src/app/admin/layout.tsx

# Verify border-b was removed from admin header
grep -n 'border-b' src/app/admin/layout.tsx

# Verify background color fix
grep -n 'color-bg-secondary' src/app/admin/layout.tsx
# Should only appear inside sidebar/elements, NOT on the root div
```

---

## Sprint 2: Loading States & Empty States

**Goal**: Replace all Loader2 spinner patterns with skeleton shimmer and upgrade empty states to use the shared EmptyState component.

### 2.1 — Replace Loading Spinners with Skeleton Shimmer

The `Skeleton` component is already available at `@/shared/components/ui/Skeleton` with `variant` (text/circular/rectangular/card) and `animation` (pulse/shimmer/none).

**Import** (add to files that have loading states):
```tsx
import Skeleton from '@/shared/components/ui/Skeleton';
```

**Files to modify**:
- `src/app/admin/cards/page.tsx`
- `src/app/admin/benefits/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/audit/page.tsx`

#### 2.1.1 — Table loading skeleton pattern

All 4 list pages currently show this:
```tsx
<div className="p-8 text-center">
  <Loader2 className="inline-block animate-spin" size={20} />
  <p className="text-[var(--color-text-secondary)] mt-2">Loading cards...</p>
</div>
```

**Replace with table skeleton** (same pattern for all 4 pages, adjust column count):

For cards page (5 columns):
```tsx
<div className="p-4 space-y-0">
  {/* Skeleton table header */}
  <div className="flex gap-4 px-6 py-3 border-b border-[var(--color-border)]">
    <Skeleton variant="text" width="15%" height={16} />
    <Skeleton variant="text" width="20%" height={16} />
    <Skeleton variant="text" width="12%" height={16} />
    <Skeleton variant="text" width="10%" height={16} />
    <Skeleton variant="text" width="10%" height={16} />
  </div>
  {/* Skeleton rows */}
  {[...Array(5)].map((_, idx) => (
    <div key={idx} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)] last:border-0">
      <Skeleton variant="text" width="15%" height={14} />
      <Skeleton variant="text" width="20%" height={14} />
      <Skeleton variant="text" width="12%" height={14} />
      <Skeleton variant="text" width="10%" height={14} />
      <Skeleton variant="text" width="10%" height={14} />
    </div>
  ))}
</div>
```

For benefits page (5 columns):
```tsx
<div className="p-4 space-y-0">
  <div className="flex gap-4 px-6 py-3 border-b border-[var(--color-border)]">
    <Skeleton variant="text" width="25%" height={16} />
    <Skeleton variant="text" width="20%" height={16} />
    <Skeleton variant="text" width="15%" height={16} />
    <Skeleton variant="text" width="12%" height={16} />
    <Skeleton variant="text" width="10%" height={16} />
  </div>
  {[...Array(5)].map((_, idx) => (
    <div key={idx} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)] last:border-0">
      <Skeleton variant="text" width="25%" height={14} />
      <Skeleton variant="text" width="20%" height={14} />
      <Skeleton variant="text" width="15%" height={14} />
      <Skeleton variant="text" width="12%" height={14} />
      <Skeleton variant="text" width="10%" height={14} />
    </div>
  ))}
</div>
```

For users page (4 columns):
```tsx
<div className="p-4 space-y-0">
  <div className="flex gap-4 px-6 py-3 border-b border-[var(--color-border)]">
    <Skeleton variant="text" width="25%" height={16} />
    <Skeleton variant="text" width="30%" height={16} />
    <Skeleton variant="text" width="15%" height={16} />
    <Skeleton variant="text" width="10%" height={16} />
  </div>
  {[...Array(5)].map((_, idx) => (
    <div key={idx} className="flex items-center gap-4 px-6 py-4 border-b border-[var(--color-border)] last:border-0">
      <Skeleton variant="text" width="25%" height={14} />
      <Skeleton variant="text" width="30%" height={14} />
      <Skeleton variant="text" width="15%" height={14} />
      <Skeleton variant="text" width="10%" height={14} />
    </div>
  ))}
</div>
```

For audit page (3-column grid):
```tsx
<div className="p-4 space-y-0">
  <div className="grid grid-cols-3 gap-4 px-6 py-3 border-b border-[var(--color-border)]">
    <Skeleton variant="text" width="60%" height={16} />
    <Skeleton variant="text" width="40%" height={16} />
    <Skeleton variant="text" width="50%" height={16} />
  </div>
  {[...Array(5)].map((_, idx) => (
    <div key={idx} className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-[var(--color-border)] last:border-0">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={32} height={32} />
        <Skeleton variant="text" width="60%" height={14} />
      </div>
      <Skeleton variant="text" width="40%" height={14} />
      <Skeleton variant="text" width="50%" height={14} />
    </div>
  ))}
</div>
```

**Also remove `Loader2` import** from files once all usages are replaced. Check if `Loader2` is used elsewhere in the file first (e.g., modal submit buttons). If it is, keep the import; if Sprint 1 already replaced all modal spinner usages with `isLoading` prop, remove `Loader2`.

- `src/app/admin/benefits/page.tsx`: Remove `Loader2` from imports (not used elsewhere after Sprint 1)
- `src/app/admin/users/page.tsx`: Remove `Loader2` from imports
- `src/app/admin/audit/page.tsx`: Remove `Loader2` from imports
- `src/app/admin/cards/page.tsx`: Keep `Loader2` if still used in create modal submit (check if Sprint 1 replaced it)
- `src/app/admin/cards/[id]/page.tsx`: Keep `Loader2` if still used

After Sprint 1, the `isLoading` prop on `Button` handles the spinner internally, so `Loader2` can likely be removed from most files. Verify each file before removing.

#### 2.1.2 — Dashboard page loading (stat cards)

**File**: `src/app/admin/page.tsx` ~lines 152-175

The stat cards already use `shimmer` class when loading which is good. No change needed here.

#### 2.1.3 — Card detail benefits loading

**File**: `src/app/admin/cards/[id]/page.tsx` ~lines 338-345

Already uses shimmer divs. No change needed.

---

### 2.2 — Replace Empty States with Shared `EmptyState` Component

**Import** (add to all pages with empty states):
```tsx
import EmptyState from '@/shared/components/ui/EmptyState';
```

**Also import relevant icons for empty state illustrations:**
```tsx
import { CreditCard, Gift, Users, FileText, Search, Inbox } from 'lucide-react';
```

#### 2.2.1 — Cards page empty state

**File**: `src/app/admin/cards/page.tsx` ~line 494-497

**BEFORE**:
```tsx
<div className="p-8 text-center">
  <p className="text-[var(--color-text-secondary)]">No cards found</p>
</div>
```

**AFTER**:
```tsx
<EmptyState
  icon={<CreditCard size={32} />}
  title="No cards found"
  description={search ? 'Try adjusting your search or filters' : 'Get started by adding your first card'}
  actionLabel={!search ? 'Add Card' : undefined}
  onAction={!search ? () => setShowCreateModal(true) : undefined}
/>
```

#### 2.2.2 — Benefits page empty state

**File**: `src/app/admin/benefits/page.tsx` ~line 355-357

**BEFORE**:
```tsx
<div className="p-8 text-center">
  <p className="text-[var(--color-text-secondary)]">No benefits found</p>
</div>
```

**AFTER**:
```tsx
<EmptyState
  icon={<Gift size={32} />}
  title="No benefits found"
  description={debouncedSearch || selectedCard ? 'Try adjusting your search or card filter' : 'Benefits will appear here once cards have benefits assigned'}
/>
```

> Add `Gift` to lucide-react imports if not already imported.

#### 2.2.3 — Users page empty state

**File**: `src/app/admin/users/page.tsx` ~line 222-224

**BEFORE**:
```tsx
<div className="p-8 text-center">
  <p className="text-[var(--color-text-secondary)]">No users found</p>
</div>
```

**AFTER**:
```tsx
<EmptyState
  icon={<Users size={32} />}
  title="No users found"
  description={search ? 'Try adjusting your search terms' : 'No users have registered yet'}
/>
```

#### 2.2.4 — Audit page empty state

**File**: `src/app/admin/audit/page.tsx` ~line 191-193

**BEFORE**:
```tsx
<div className="p-8 text-center">
  <p className="text-[var(--color-text-secondary)]">No audit logs found</p>
</div>
```

**AFTER**:
```tsx
<EmptyState
  icon={<FileText size={32} />}
  title="No audit logs found"
  description={search || actionFilter || resourceFilter ? 'Try adjusting your filters' : 'Activity will be recorded here as changes are made'}
/>
```

#### 2.2.5 — Card detail empty benefits

**File**: `src/app/admin/cards/[id]/page.tsx` ~line 348-349

**BEFORE**:
```tsx
<p className="text-[var(--color-text-secondary)] text-center py-8">
  No benefits added yet
</p>
```

**AFTER**:
```tsx
<EmptyState
  icon={<Gift size={32} />}
  title="No benefits added yet"
  description="Add benefits to this card to start tracking value"
  actionLabel="Add Benefit"
  onAction={() => setShowBenefitModal(true)}
/>
```

#### 2.2.6 — Dashboard recent activity empty state

**File**: `src/app/admin/page.tsx` ~line 223-225

**BEFORE**:
```tsx
<p className="text-[var(--color-text-secondary)] text-center py-8">
  No recent activity
</p>
```

**AFTER**:
```tsx
<EmptyState
  icon={<FileText size={32} />}
  title="No recent activity"
  description="Activity will appear here as changes are made to the system"
/>
```

> Add `EmptyState` import and `FileText` to the dashboard page.

---

### 2.3 — Fix Audit Log Conflicting CSS (flex + grid)

**File**: `src/app/admin/audit/page.tsx` ~line 237

**BEFORE**:
```tsx
<button
  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
  className="w-full px-6 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors text-left flex items-center justify-between grid grid-cols-3 gap-4"
>
```

**AFTER** (remove `flex items-center justify-between`, keep `grid`):
```tsx
<button
  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
  className="w-full px-6 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors text-left grid grid-cols-3 gap-4 items-center"
>
```

---

### 2.4 — Fix Mobile Back Button Alignment

**File**: `src/app/admin/layout.tsx` ~lines 128-137

**BEFORE**:
```tsx
<Link
  href="/dashboard"
  className="md:hidden px-3 py-2 rounded-lg transition-colors text-sm hover:opacity-80"
  style={{
    backgroundColor: 'var(--color-bg-secondary)',
    color: 'var(--color-text-secondary)',
  }}
>
  <ArrowLeft size={14} /> Back
</Link>
```

**AFTER**:
```tsx
<Link
  href="/dashboard"
  className="md:hidden flex items-center gap-1 px-3 py-2 rounded-lg transition-colors text-sm hover:bg-[var(--color-bg-secondary)]"
  style={{
    color: 'var(--color-text-secondary)',
  }}
>
  <ArrowLeft size={14} />
  <span>Back</span>
</Link>
```

**Changes**:
- Added `flex items-center gap-1` for proper icon/text alignment
- Changed `hover:opacity-80` to `hover:bg-[var(--color-bg-secondary)]`
- Wrapped "Back" in `<span>` for proper flex alignment
- Removed inline background color (was always visible, now only shows on hover)

---

### Sprint 2 Verification Commands

```bash
# Verify no Loader2 spinners in loading states (only in Button isLoading)
grep -rn 'Loader2' src/app/admin/ --include='*.tsx'

# Verify EmptyState imports
grep -rn "import.*EmptyState" src/app/admin/

# Verify Skeleton imports
grep -rn "import.*Skeleton" src/app/admin/

# Verify audit log button no longer has flex+grid conflict
grep -n 'flex.*grid\|grid.*flex' src/app/admin/audit/page.tsx
```

---

## Sprint 3: Header & Navigation Polish

### 3.1 — Dynamic Admin Header Title

**File**: `src/app/admin/layout.tsx`

**Step 1**: Import `usePathname` (already done in Sprint 1 for sidebar active state).

**Step 2**: Create a title mapping function inside the component:

```tsx
const getPageTitle = (path: string): string => {
  if (path === '/admin') return 'Dashboard';
  if (path.startsWith('/admin/cards/')) return 'Card Detail';
  if (path === '/admin/cards') return 'Cards';
  if (path === '/admin/benefits') return 'Benefits';
  if (path === '/admin/users') return 'Users';
  if (path === '/admin/audit') return 'Audit Log';
  return 'Admin';
};
```

**Step 3**: Replace static title.

**BEFORE** (~line 124):
```tsx
<h1 className="text-xl font-bold text-[var(--color-text)]">
  Admin Dashboard
</h1>
```

**AFTER**:
```tsx
<h1 className="text-xl font-bold text-[var(--color-text)]">
  {getPageTitle(pathname)}
</h1>
```

---

### 3.2 — Add Max-Width Constraint to Header Content

**File**: `src/app/admin/layout.tsx` ~line 123

**BEFORE**:
```tsx
<div className="flex items-center justify-between">
```

**AFTER**:
```tsx
<div className="flex items-center justify-between max-w-7xl mx-auto w-full">
```

This matches the `max-w-7xl mx-auto` constraint used in the main content area (line 143).

---

### 3.3 — Fix Content Padding Consistency

**File**: `src/app/admin/layout.tsx` ~line 143

**BEFORE**:
```tsx
<div className="max-w-7xl mx-auto p-6">
```

**AFTER**:
```tsx
<div className="max-w-7xl mx-auto px-4 py-6 md:px-8">
```

This matches the user dashboard's responsive padding pattern (`px-4 md:px-8`).

---

### 3.4 — Fix Breadcrumb Spacing

**File**: `src/app/admin/_components/AdminBreadcrumb.tsx` ~line 32

The breadcrumb has `mb-6` which creates a double margin inside pages that use `space-y-6`. Remove the bottom margin from the breadcrumb and let the parent's `space-y-6` handle spacing.

**BEFORE**:
```tsx
<div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-6">
```

**AFTER**:
```tsx
<div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
```

---

### Sprint 3 Verification Commands

```bash
# Verify dynamic title function exists
grep -n 'getPageTitle' src/app/admin/layout.tsx

# Verify max-width on header
grep -n 'max-w-7xl' src/app/admin/layout.tsx

# Verify responsive padding
grep -n 'px-4.*md:px-8\|md:px-8' src/app/admin/layout.tsx

# Verify breadcrumb margin removed
grep -n 'mb-6' src/app/admin/_components/AdminBreadcrumb.tsx
# Should return 0 matches
```

---

## Sprint 4: Accessibility & Advanced

### 4.1 — Add ARIA Landmarks to Layout

**File**: `src/app/admin/layout.tsx`

#### 4.1.1 — Main content landmark

**BEFORE** (~line 142):
```tsx
<main className="flex-1 overflow-auto">
```

**AFTER**:
```tsx
<main className="flex-1 overflow-auto" id="main-content" role="main">
```

#### 4.1.2 — Sidebar nav landmark

**BEFORE** (~line 54):
```tsx
<aside className="hidden md:flex md:w-64 flex-col border-r" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
```

**AFTER**:
```tsx
<aside className="hidden md:flex md:w-64 flex-col border-r" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }} role="complementary" aria-label="Admin navigation">
```

#### 4.1.3 — Nav element

**BEFORE** (~line 64):
```tsx
<nav className="flex-1 px-4 py-6 space-y-2">
```

**AFTER**:
```tsx
<nav className="flex-1 px-4 py-6 space-y-2" aria-label="Admin pages">
```

---

### 4.2 — Add Skip-to-Content Link

**File**: `src/app/admin/layout.tsx`

Add this as the very first child inside the root `<div>`:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--color-primary)] focus:text-white focus:outline-none"
>
  Skip to main content
</a>
```

**Location**: immediately after `<div className="flex h-screen" ...>`:

```tsx
<div className="flex h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
  {/* Skip-to-content link */}
  <a
    href="#main-content"
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[var(--color-primary)] focus:text-white focus:outline-none"
  >
    Skip to main content
  </a>

  {/* Sidebar Navigation */}
  <aside ...>
```

---

### 4.3 — Add `aria-sort` to Sort Header Buttons

These 13 sort-header buttons remain as raw `<button>` elements (correct for semantics), but need `aria-sort` attributes on their parent `<th>` elements.

**Pattern** — For every sortable `<th>` across all 4 list pages:

**BEFORE**:
```tsx
<th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
  <button
    onClick={() => handleSort('name')}
    className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
    title="Click to sort by name"
  >
```

**AFTER**:
```tsx
<th
  className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]"
  aria-sort={sortBy === 'name' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
>
  <button
    onClick={() => handleSort('name')}
    className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
    title="Click to sort by name"
  >
```

**Apply to all sortable `<th>` elements (13 total across 4 files)**:

| File | Columns | Line refs |
|------|---------|-----------|
| `cards/page.tsx` | `issuer`, `cardName`, `defaultAnnualFee` | ~505, ~517, ~529 |
| `benefits/page.tsx` | `name`, `card`, `type`, `stickerValue` | ~365, ~378, ~390, ~402 |
| `users/page.tsx` | `name`, `email`, `role` | ~232, ~244, ~256 |
| `audit/page.tsx` | `timestamp`, `action`, `resource` | ~199, ~209, ~219 |

For the **audit page**, the column headers use a `<div>` with `grid` layout instead of `<th>`. Add `role="columnheader"` and `aria-sort`:

**BEFORE** (audit page ~line 199):
```tsx
<div className="bg-[var(--color-bg-secondary)] px-6 py-3 grid grid-cols-3 gap-4 text-sm font-semibold text-[var(--color-text)]">
  <button
    onClick={() => handleSort('timestamp')}
```

**AFTER**:
```tsx
<div className="bg-[var(--color-bg-secondary)] px-6 py-3 grid grid-cols-3 gap-4 text-sm font-semibold text-[var(--color-text)]" role="row">
  <div role="columnheader" aria-sort={sortBy === 'timestamp' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button
      onClick={() => handleSort('timestamp')}
```

(Repeat for all 3 audit columns, adding closing `</div>` after each button.)

---

### 4.4 — Add `role="search"` to Search Inputs

**Pattern** — Wrap each search input in a form with `role="search"`:

**BEFORE** (example from users page):
```tsx
<div className="flex gap-4">
  <input
    type="text"
    placeholder="Search users..."
```

**AFTER**:
```tsx
<div className="flex gap-4" role="search" aria-label="Search users">
  <input
    type="text"
    placeholder="Search users..."
```

**Apply to**:
- `src/app/admin/cards/page.tsx` — search input container
- `src/app/admin/benefits/page.tsx` — search input container
- `src/app/admin/users/page.tsx` — search input container
- `src/app/admin/audit/page.tsx` — search input container

---

### 4.5 — Add Focus-Visible to Remaining Non-Button Interactive Elements

After Sprint 1, the only remaining raw buttons are sort headers and the audit row toggle. Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] focus:outline-none` to:

1. **All sort header buttons** (13 buttons across 4 files):

**BEFORE**:
```tsx
className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
```

**AFTER**:
```tsx
className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] rounded"
```

2. **Audit row toggle button**:

**BEFORE**:
```tsx
className="w-full px-6 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors text-left grid grid-cols-3 gap-4 items-center"
```

**AFTER**:
```tsx
className="w-full px-6 py-4 hover:bg-[var(--color-bg-secondary)] transition-colors text-left grid grid-cols-3 gap-4 items-center focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
```

---

### 4.6 — Add Close Button to Error/Success Alert Divs

All admin pages use auto-dismissing error/success divs. Add a close button to allow manual dismissal.

**Pattern** — For every error/success alert across all pages:

**BEFORE** (example error):
```tsx
{error && (
  <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
    {error}
  </div>
)}
```

**AFTER**:
```tsx
{error && (
  <div className="p-4 rounded-lg border flex items-start justify-between gap-2" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
    <span>{error}</span>
    <button
      onClick={() => setError(null)}
      className="shrink-0 p-1 rounded hover:opacity-70 transition-opacity focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-error)]"
      aria-label="Dismiss error"
    >
      <X size={16} />
    </button>
  </div>
)}
```

**AFTER** (success variant):
```tsx
{success && (
  <div className="p-4 rounded-lg border flex items-start justify-between gap-2" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
    <span>{success}</span>
    <button
      onClick={() => setSuccess(null)}
      className="shrink-0 p-1 rounded hover:opacity-70 transition-opacity focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--color-success)]"
      aria-label="Dismiss notification"
    >
      <X size={16} />
    </button>
  </div>
)}
```

> Add `X` to lucide-react imports in each page file that gets this change:
> - `src/app/admin/cards/page.tsx`
> - `src/app/admin/cards/[id]/page.tsx`
> - `src/app/admin/benefits/page.tsx`
> - `src/app/admin/users/page.tsx`
> - `src/app/admin/page.tsx` (dashboard error alert only)

---

### Sprint 4 Verification Commands

```bash
# Verify ARIA landmarks
grep -rn 'id="main-content"\|role="main"\|role="complementary"\|aria-label="Admin' src/app/admin/layout.tsx

# Verify skip-to-content link
grep -n 'Skip to main content' src/app/admin/layout.tsx

# Verify aria-sort on th elements
grep -rn 'aria-sort' src/app/admin/ --include='*.tsx'

# Verify role="search" on search containers
grep -rn 'role="search"' src/app/admin/ --include='*.tsx'

# Verify focus-visible on sort buttons
grep -rn 'focus-visible:outline' src/app/admin/audit/page.tsx

# Verify close buttons on alerts
grep -rn 'Dismiss error\|Dismiss notification' src/app/admin/ --include='*.tsx'
```

---

## Complete File Change Matrix

| File | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|------|----------|----------|----------|----------|
| `layout.tsx` | bg-color, sidebar active, header safe-area/border, hover fixes | mobile back btn | dynamic title, max-width, padding | ARIA landmarks, skip-to-content |
| `page.tsx` (dashboard) | quick action link hovers | empty state (activity) | — | error alert close btn |
| `cards/page.tsx` | 11 buttons → Button | loading skeleton, empty state | — | aria-sort, role="search", alert close btns |
| `cards/[id]/page.tsx` | 5 buttons → Button | empty state | — | alert close btns |
| `benefits/page.tsx` | 4 buttons → Button | loading skeleton, empty state | — | aria-sort, role="search", alert close btns |
| `users/page.tsx` | 3 buttons → Button | loading skeleton, empty state | — | aria-sort, role="search", alert close btns |
| `audit/page.tsx` | 2 buttons → Button | loading skeleton, empty state, fix CSS conflict | — | aria-sort, focus-visible, role="search" |
| `EditUserModal.tsx` | 3 buttons → Button | — | — | — |
| `EditBenefitModal.tsx` | 5 buttons → Button | — | — | — |
| `AdminBreadcrumb.tsx` | — | — | remove mb-6 | — |

---

## Summary Metrics

| Sprint | Changes | Files | Issues Resolved |
|--------|---------|-------|-----------------|
| Sprint 1 | 33 Button conversions + 6 layout/hover fixes | 9 files | ~19 issues |
| Sprint 2 | 4 skeleton replacements + 6 empty states + 2 CSS fixes | 7 files | ~8 issues |
| Sprint 3 | 4 polish changes | 3 files | ~5 issues |
| Sprint 4 | 13 aria-sort + landmarks + skip-link + alert close btns | 8 files | ~10 issues |
| **Total** | **~70 changes** | **10 unique files** | **~41 issues** |
