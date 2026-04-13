# Admin Dashboard UI Alignment — Tiered Implementation Spec

> **Purpose:** Bring the admin dashboard into visual and structural parity with the user-facing dashboard.  
> **Source:** Consolidated findings from UX Designer agent (19 issues) and Frontend Engineer agent (13 issues).  
> **Total scope:** ~12 files modified, ~3 files deleted, ~235 hardcoded `dark:` class replacements, ~25 emoji replacements.  
> **Each tier is independently deployable and testable.**

---

## Table of Contents

1. [Tier 1: Foundation & Cleanup](#tier-1-foundation--cleanup)
2. [Tier 2: Header & Navigation Alignment](#tier-2-header--navigation-alignment)
3. [Tier 3: Color System Migration](#tier-3-color-system-migration)
4. [Tier 4: Component Alignment](#tier-4-component-alignment)
5. [Tier 5: Polish & UX](#tier-5-polish--ux)
6. [Appendix A: Design Token Mapping Reference](#appendix-a-design-token-mapping-reference)
7. [Appendix B: Lucide Icon Mapping Reference](#appendix-b-lucide-icon-mapping-reference)

---

## Tier 1: Foundation & Cleanup

**Goal:** Remove dead code and conflicting files that create confusion and could silently break theming if ever imported.

**Estimated scope:** 0 files modified, 3 files deleted, 4 directories cleaned

### 1.1 Delete Conflicting Admin Design Tokens

The file `src/features/admin/styles/design-tokens.css` defines a **complete parallel design token system** with different values for `--color-secondary`, `--color-success`, `--color-info`, `--font-primary`, `--radius-lg`, `--shadow-sm`, etc. It is **never imported anywhere** (verified via grep). If it were ever imported, it would silently override the canonical tokens from `src/styles/design-tokens.css`.

**Action:** Delete file.

```
DELETE: src/features/admin/styles/design-tokens.css
```

### 1.2 Delete Unused Admin CSS

The file `src/features/admin/styles/admin.css` defines CSS classes (`.admin-container`, `.admin-sidebar`, `.admin-table`, `.btn`, `.card`, `.modal-overlay`, `.skeleton`, etc.) that are **never referenced by any component** (verified via grep). The actual admin layout uses Tailwind classes exclusively.

**Action:** Delete file.

```
DELETE: src/features/admin/styles/admin.css
```

### 1.3 Delete Unused Feature Components

The following directory contains components that are **never imported** by any file in the codebase:

```
src/features/admin/components/
├── forms/Forms.tsx          — unused
├── forms/index.ts           — unused
├── layout/Layout.tsx        — unused
├── layout/index.ts          — unused
├── notifications/Notifications.tsx — unused
├── notifications/index.ts   — unused
├── data-display/DataDisplay.tsx — unused
├── data-display/index.ts    — unused
├── index.ts                 — barrel export, only re-exports unused components
```

**Action:** Delete the entire directory and its barrel export.

```
DELETE: src/features/admin/components/  (entire directory)
```

### 1.4 Verification Steps

```bash
# 1. Confirm no imports reference deleted files
grep -rn "features/admin/styles" src/ --include="*.tsx" --include="*.ts" --include="*.css"
# Expected: 0 results

grep -rn "features/admin/components" src/ --include="*.tsx" --include="*.ts"
# Expected: 0 results

# 2. Build still succeeds
npm run build

# 3. App still runs
npm run dev
# Navigate to /admin — everything renders normally
```

---

## Tier 2: Header & Navigation Alignment

**Goal:** Make admin header, logo, branding, and icons consistent with the user dashboard.

**Estimated scope:** 3 files modified, ~60 lines changed

### 2.1 Fix Sidebar Logo/Branding (layout.tsx)

**File:** `src/app/admin/layout.tsx`

The admin sidebar shows a "CB" text block + "Admin" label. The user dashboard uses a `CreditCard` lucide icon + "CardTrack" text.

**Before (lines 53-59):**
```tsx
<div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
  CB
</div>
<h1 className="text-lg font-bold text-[var(--color-text)]">
  Admin
</h1>
```

**After:**
```tsx
<div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
  <CreditCard size={20} />
</div>
<h1 className="text-lg font-bold text-[var(--color-text)]">
  CardTrack <span className="text-xs font-normal text-[var(--color-text-secondary)]">Admin</span>
</h1>
```

**Required import (add to top of file):**
```tsx
import { CreditCard, LayoutDashboard, CreditCard as CreditCardIcon, Gift, Users, FileText, ArrowLeft } from 'lucide-react';
```

### 2.2 Replace Sidebar Emoji Icons with Lucide (layout.tsx)

**File:** `src/app/admin/layout.tsx`

**Before (lines 63-69):**
```tsx
{[
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/cards', label: 'Cards', icon: '💳' },
  { href: '/admin/benefits', label: 'Benefits', icon: '🎁' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/audit', label: 'Audit Log', icon: '📋' },
].map((item) => (
```

**After:**
```tsx
{[
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cards', label: 'Cards', icon: CreditCardIcon },
  { href: '/admin/benefits', label: 'Benefits', icon: Gift },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit Log', icon: FileText },
].map((item) => (
```

And update the icon rendering inside the `.map()`:

**Before (line 75):**
```tsx
<span className="text-lg">{item.icon}</span>
```

**After:**
```tsx
<item.icon size={20} />
```

### 2.3 Replace "←" Text with ArrowLeft Icon (layout.tsx)

**File:** `src/app/admin/layout.tsx`

**Location 1 — Sidebar footer "Back to Dashboard" (line 102-103):**

**Before:**
```tsx
<span>←</span>
<span>Back to Dashboard</span>
```

**After:**
```tsx
<ArrowLeft size={16} />
<span>Back to Dashboard</span>
```

**Location 2 — Mobile back button (line 127):**

**Before:**
```tsx
← Back
```

**After:**
```tsx
<span className="flex items-center gap-1"><ArrowLeft size={14} /> Back</span>
```

### 2.4 Make Admin Header Sticky with Frosted Glass Effect (layout.tsx)

**File:** `src/app/admin/layout.tsx`

The user dashboard's `AppHeader` uses sticky positioning, frosted glass `backdrop-filter`, `color-mix` for semi-transparent bg, and `--header-shadow`. The admin header has none of these.

**Before (line 111):**
```tsx
<header className="border-b px-4 py-4" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
```

**After:**
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

### 2.5 Verification Steps

```bash
# 1. Visual check: Sidebar icons are lucide SVGs, not emoji characters
# 2. Logo shows CreditCard icon + "CardTrack Admin"
# 3. Header is sticky and has frosted glass blur on scroll
# 4. "← Back" uses ArrowLeft lucide icon
# 5. Build still succeeds
npm run build
```

---

## Tier 3: Color System Migration

**Goal:** Convert ALL hardcoded Tailwind `dark:` classes and `text-slate-*` / `bg-slate-*` / `border-slate-*` patterns to CSS custom property equivalents. This eliminates the "dual dark mode system" bug where the main page uses CSS variables but sub-pages use Tailwind `dark:` classes.

**Estimated scope:** 9 files modified, ~235 class replacements

### Master Replacement Table

| Hardcoded Pattern | CSS Variable Replacement |
|---|---|
| `text-slate-900 dark:text-white` | `text-[var(--color-text)]` |
| `text-slate-600 dark:text-slate-400` | `text-[var(--color-text-secondary)]` |
| `text-slate-600 dark:text-slate-300` | `text-[var(--color-text-secondary)]` |
| `text-slate-500 dark:text-slate-400` | `text-[var(--color-text-secondary)]` |
| `text-slate-700 dark:text-slate-300` | `text-[var(--color-text-secondary)]` |
| `text-slate-400 dark:text-slate-600` | `text-[var(--color-text-tertiary)]` |
| `bg-white dark:bg-slate-900` | `bg-[var(--color-bg)]` |
| `bg-white dark:bg-slate-800` | `bg-[var(--color-bg)]` |
| `bg-slate-50 dark:bg-slate-800/50` | `bg-[var(--color-bg-secondary)]` |
| `border-slate-200 dark:border-slate-800` | `border-[var(--color-border)]` |
| `border-slate-100 dark:border-slate-800/50` | `border-[var(--color-border)]` |
| `divide-slate-200 dark:divide-slate-800` | `divide-[var(--color-border)]` |
| `hover:bg-slate-50 dark:hover:bg-slate-800/50` | `hover:bg-[var(--color-bg-secondary)]` |
| `hover:bg-slate-50 dark:hover:bg-slate-800` | `hover:bg-[var(--color-bg-secondary)]` |
| `hover:text-blue-600 dark:hover:text-blue-400` | `hover:text-[var(--color-primary)]` |
| `focus:ring-blue-500` | `focus:ring-[var(--color-primary)]` |
| `focus:ring-blue-500 dark:focus:ring-blue-400` | `focus:ring-[var(--color-primary)]` |
| `placeholder-slate-500 dark:placeholder-slate-400` | `placeholder-[var(--color-text-secondary)]` |
| `bg-slate-200 dark:bg-slate-800` | `bg-[var(--color-bg-secondary)]` |
| `bg-slate-200 dark:bg-slate-700` | `bg-[var(--color-bg-secondary)]` |
| `hover:bg-slate-300 dark:hover:bg-slate-600` | `hover:bg-[var(--color-bg-tertiary)]` |
| `bg-slate-100 dark:bg-slate-800` | `bg-[var(--color-bg-secondary)]` |
| `hover:bg-slate-200 dark:hover:bg-slate-700` | `hover:bg-[var(--color-bg-tertiary)]` |

**Error/Success Banner Pattern:**

| Hardcoded Pattern | CSS Variable Replacement |
|---|---|
| `bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800` | `bg-[var(--color-error-light)] text-[var(--color-error)] border border-[var(--color-error)]` |
| `bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800` | `bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success)]` |

**Button Color Patterns:**

| Hardcoded Pattern | CSS Variable Replacement |
|---|---|
| `bg-blue-600 text-white hover:bg-blue-700` | Use `style={{ backgroundColor: 'var(--color-primary)' }}` + `text-white hover:opacity-90` |
| `bg-red-600 text-white hover:bg-red-700` | Use `style={{ backgroundColor: 'var(--color-error)' }}` + `text-white hover:opacity-90` |
| `bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40` | Use `style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}` + `hover:opacity-80` |
| `bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30` | Use `style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}` + `hover:opacity-80` |

**Role Badge Patterns (users/page.tsx):**

| Hardcoded Pattern | CSS Variable Replacement |
|---|---|
| `bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300` | Use inline `style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}` |
| `bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300` | Use inline `style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }}` |
| `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300` | Use inline `style={{ backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}` |

**Cadence Badge Patterns (cards/[id]/page.tsx):**

Replace the `CADENCE_COLORS` constant object at the top of the file:

**Before (lines 26-32):**
```tsx
const CADENCE_COLORS: Record<string, string> = {
  MONTHLY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  QUARTERLY: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  SEMI_ANNUAL: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  FLEXIBLE_ANNUAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  ONE_TIME: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
};
```

**After:** Remove this constant and use inline styles for cadence badges (see Tier 3.6 for detail).

### 3.1 File: `src/app/admin/benefits/page.tsx` (~32 replacements)

Process every hardcoded color in this file. Key patterns:

**Page title (line 298):**
```tsx
// Before:
<h1 className="text-3xl font-bold text-slate-900 dark:text-white">Benefits</h1>
// After:
<h1 className="text-3xl font-bold text-[var(--color-text)]">Benefits</h1>
```

**Subtitle (line 299):**
```tsx
// Before:
<p className="text-slate-600 dark:text-slate-400 mt-2">Manage benefit types</p>
// After:
<p className="text-[var(--color-text-secondary)] mt-2">Manage benefit types</p>
```

**Error banner (line 304):**
```tsx
// Before:
<div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
// After:
<div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}>
```

**Success banner (line 310):**
```tsx
// Before:
<div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
// After:
<div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
```

**Form labels (lines 318, 329):**
```tsx
// Before:
<label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
// After:
<label className="block text-sm font-medium text-[var(--color-text)] mb-2">
```

**Search input (line 341):**
```tsx
// Before:
className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
// After:
className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
```

**Table container (line 347):**
```tsx
// Before:
<div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
// After:
<div className="bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] overflow-hidden">
```

**Loading spinner — replace emoji (line 350):**
```tsx
// Before:
<div className="inline-block animate-spin">⏳</div>
// After:
<Loader2 className="inline-block animate-spin" size={20} />
```
*(Requires adding `Loader2` to lucide-react import)*

**Loading text (line 351):**
```tsx
// Before:
<p className="text-slate-600 dark:text-slate-400 mt-2">Loading benefits...</p>
// After:
<p className="text-[var(--color-text-secondary)] mt-2">Loading benefits...</p>
```

**Table header row (line 362):**
```tsx
// Before:
<tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
// After:
<tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
```

**Table header cells (lines 364, 377, 389, 401, 413):**
```tsx
// Before:
<th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">
// After:
<th className="px-6 py-3 text-left text-sm font-semibold text-[var(--color-text)]">
```

**Sort button hover (lines 367, 380, 392, 404):**
```tsx
// Before:
className="group flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
// After:
className="group flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors"
```

**Table body divider (line 418):**
```tsx
// Before:
<tbody className="divide-y divide-slate-200 dark:divide-slate-800">
// After:
<tbody className="divide-y divide-[var(--color-border)]">
```

**Table row hover (line 420):**
```tsx
// Before:
<tr key={benefit.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
// After:
<tr key={benefit.id} className="hover:bg-[var(--color-bg-secondary)]">
```

**Table cell text (lines 421, 425, 428, 432):**
```tsx
// Before:
<td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
// After:
<td className="px-6 py-4 text-sm font-medium text-[var(--color-text)]">

// Before:
<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
// After:
<td className="px-6 py-4 text-sm text-[var(--color-text-secondary)]">
```

**Action buttons (lines 440-448):**
```tsx
// Before (Edit button):
className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
// After:
className="px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors hover:opacity-80"
style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}

// Before (Delete button):
className="px-3 py-1 rounded text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
// After:
className="px-3 py-1 rounded text-sm disabled:opacity-50 transition-colors hover:opacity-80"
style={{ backgroundColor: 'var(--color-error-bg-muted)', color: 'var(--color-error)' }}
```

**Pagination section (lines 459-478):**
```tsx
// Before:
<div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
  <span className="text-sm text-slate-600 dark:text-slate-400">
// After:
<div className="border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
  <span className="text-sm text-[var(--color-text-secondary)]">

// Before (pagination buttons):
className="px-4 py-2 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
// After:
className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
```

### 3.2 File: `src/app/admin/users/page.tsx` (~28 replacements)

Apply the same pattern substitutions as 3.1. Key additional patterns:

**Role badges (lines 282-288):** Replace the ternary with inline styles:

```tsx
// Before:
<span className={`px-3 py-1 rounded-full text-xs font-medium ${
  user.role === 'SUPER_ADMIN'
    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
    : user.role === 'ADMIN'
    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
}`}>
  {user.role}
</span>

// After:
<span
  className="px-3 py-1 rounded-full text-xs font-medium"
  style={
    user.role === 'SUPER_ADMIN'
      ? { backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }
      : user.role === 'ADMIN'
      ? { backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' }
      : { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }
  }
>
  {user.role}
</span>
```

**Edit button (line 298):**
```tsx
// Before:
className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
// After:
className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors"
style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
```

**Loading spinner — replace ⏳ emoji (line 217):**
```tsx
// Before:
<div className="inline-block animate-spin">⏳</div>
// After:
<Loader2 className="inline-block animate-spin" size={20} />
```
*(Add `import { Loader2 } from 'lucide-react';` to top of file)*

### 3.3 File: `src/app/admin/cards/page.tsx` (~48 replacements)

Apply the same master replacement patterns. Additional specific patterns:

**"+ Add Card" button (line 403):**
```tsx
// Before:
<button
  onClick={() => setShowCreateModal(true)}
  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
>
  + Add Card
</button>

// After:
<button
  onClick={() => setShowCreateModal(true)}
  className="px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors flex items-center gap-1"
  style={{ backgroundColor: 'var(--color-primary)' }}
>
  <Plus size={16} /> Add Card
</button>
```
*(Add `import { Loader2, Plus } from 'lucide-react';` to imports)*

**Status filter buttons (lines 444-476):**
```tsx
// Before (active state):
'bg-blue-600 text-white'
// After:
// Use inline style for the active state
style={activeFilter === 'all' ? { backgroundColor: 'var(--color-primary)', color: 'white' } : undefined}

// Before (inactive state):
'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600'
// After (inactive state className):
'bg-[var(--color-bg-secondary)] text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
```

**View link (line 569):**
```tsx
// Before:
<a href={`/admin/cards/${card.id}`} className="px-3 py-1 rounded text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30">
// After:
<a href={`/admin/cards/${card.id}`} className="px-3 py-1 rounded text-sm hover:opacity-80 transition-colors" style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}>
```

**All ⏳ spinners** in the modals (lines 706, 747):
```tsx
// Before:
{isSubmitting && <span className="animate-spin">⏳</span>}
// After:
{isSubmitting && <Loader2 className="animate-spin" size={16} />}
```

**Create/Delete modal containers:**
```tsx
// Before:
<div className="bg-white dark:bg-slate-900 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-800">
// After:
<div className="bg-[var(--color-bg)] rounded-lg max-w-md w-full p-6 border border-[var(--color-border)]">
```

**Modal headings:**
```tsx
// Before:
<h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
// After:
<h2 className="text-xl font-bold text-[var(--color-text)] mb-4">
```

**Form labels in modals:**
```tsx
// Before:
<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
// After:
<label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
```

**Form inputs in modals:**
```tsx
// Before:
className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
// After:
className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
```

**Cancel buttons in modals:**
```tsx
// Before:
className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
// After:
className="flex-1 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
```

**Submit buttons in modals:**
```tsx
// Before:
className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 ..."
// After:
className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors disabled:opacity-50 ..."
style={{ backgroundColor: 'var(--color-primary)' }}

// Before (delete confirm):
className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors disabled:opacity-50 ..."
// After:
className="flex-1 px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium transition-colors disabled:opacity-50 ..."
style={{ backgroundColor: 'var(--color-error)' }}
```

### 3.4 File: `src/app/admin/audit/page.tsx` (~34 replacements)

Apply the same master patterns. Additionally:

**Filter select inputs (lines 151, 161, 175):**
```tsx
// Before:
className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
// After:
className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
```

**Action badge in expandable row (line 238):**
```tsx
// Before:
<span className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
// After:
<span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0" style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}>
```

**Expanded detail section (line 263):**
```tsx
// Before:
<div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
// After:
<div className="px-6 py-4 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)]">
```

**Detail labels and values:**
```tsx
// Before:
<p className="text-slate-600 dark:text-slate-400 font-medium">User</p>
<p className="text-slate-900 dark:text-white">{log.adminUserEmail || 'Unknown'}</p>
// After:
<p className="text-[var(--color-text-secondary)] font-medium">User</p>
<p className="text-[var(--color-text)]">{log.adminUserEmail || 'Unknown'}</p>
```

**Pre/code blocks (lines 276, 284):**
```tsx
// Before:
<pre className="text-xs bg-white dark:bg-slate-900 p-2 rounded overflow-auto max-h-40">
// After:
<pre className="text-xs bg-[var(--color-bg)] p-2 rounded overflow-auto max-h-40">
```

**Expand/collapse indicators (line 257):**
```tsx
// Before:
<span className="text-slate-400 dark:text-slate-600">
// After:
<span className="text-[var(--color-text-tertiary)]">
```

### 3.5 File: `src/app/admin/cards/[id]/page.tsx` (~50 replacements)

Apply all master patterns. Additional specific patterns:

**Remove CADENCE_COLORS constant** (lines 26-32) and replace with a function:

```tsx
// Add this helper function:
const getCadenceStyle = (cadence: string): React.CSSProperties => {
  switch (cadence) {
    case 'MONTHLY':
      return { backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' };
    case 'QUARTERLY':
      return { backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)' };
    case 'SEMI_ANNUAL':
      return { backgroundColor: 'var(--color-primary-bg-muted)', color: 'var(--color-primary)' };
    case 'FLEXIBLE_ANNUAL':
      return { backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' };
    case 'ONE_TIME':
    default:
      return { backgroundColor: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' };
  }
};
```

**Usage of cadence badge (line 395-400):**
```tsx
// Before:
<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
  CADENCE_COLORS[benefit.claimingCadence] ||
  'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
}`}>

// After:
<span
  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
  style={getCadenceStyle(benefit.claimingCadence || '')}
>
```

**Inactive badge (line 378):**
```tsx
// Before:
<span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
// After:
<span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
```

**Warning icon (line 403):**
```tsx
// Before:
<span className="text-amber-500 dark:text-amber-400" title="Claiming cadence not set">
// After:
<span className="text-[var(--color-warning)]" title="Claiming cadence not set">
```

**Dash placeholders (lines 407, 413):**
```tsx
// Before:
<span className="text-slate-400 dark:text-slate-600">—</span>
// After:
<span className="text-[var(--color-text-tertiary)]">—</span>
```

**Edit button (line 419):**
```tsx
// Before:
className="px-3 py-1 rounded text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
// After:
className="px-3 py-1 rounded text-sm bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
```

**⏳ spinner in delete button (line 428):**
```tsx
// Before:
{isDeleting === benefit.id && <span className="animate-spin text-xs">⏳</span>}
// After:
{isDeleting === benefit.id && <Loader2 className="animate-spin" size={12} />}
```
*(Add `import { Loader2, Plus, ArrowLeft } from 'lucide-react';`)*

**"← Back" link (line 300):**
```tsx
// Before:
<a href="/admin/cards" className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
  ← Back
</a>
// After:
<a href="/admin/cards" className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] flex items-center gap-1">
  <ArrowLeft size={16} /> Back
</a>
```

**"+ Add Benefit" button (line 324):**
```tsx
// Before:
<button onClick={() => setShowBenefitModal(true)} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm">
  + Add Benefit
</button>
// After:
<button onClick={() => setShowBenefitModal(true)} className="px-4 py-2 rounded-lg text-white hover:opacity-90 font-medium text-sm flex items-center gap-1" style={{ backgroundColor: 'var(--color-primary)' }}>
  <Plus size={16} /> Add Benefit
</button>
```

**Loading skeleton (line 336):**
```tsx
// Before:
<div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
// After:
<div className="h-16 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />
```

### 3.6 File: `src/app/admin/_components/AdminBreadcrumb.tsx` (~4 replacements)

```tsx
// Before (line 31):
<div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-6">
// After:
<div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] mb-6">

// Before (line 33-35):
className="hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
// After:
className="hover:text-[var(--color-primary)] flex items-center gap-1 transition-colors"

// Replace "←" text with lucide ArrowLeft icon:
// Before:
← Back to Admin
// After:
<ArrowLeft size={14} /> Back to Admin

// Before (line 39):
<span className="text-slate-900 dark:text-white font-medium">
// After:
<span className="text-[var(--color-text)] font-medium">
```

Add import: `import { ArrowLeft } from 'lucide-react';`

### 3.7 File: `src/app/admin/_components/CardFilterDropdown.tsx` (~1 replacement)

```tsx
// Before (line 31):
className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
// After:
className="w-full px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
```

### 3.8 File: `src/app/admin/_components/EditUserModal.tsx` (~22 replacements)

Apply master patterns to all form inputs, labels, modal containers, and buttons within this file. Same substitutions as detailed above for modal containers, form inputs, labels, buttons. Replace any remaining `dark:` classes.

### 3.9 File: `src/app/admin/_components/EditBenefitModal.tsx` (~16 replacements)

Apply master patterns. Note: This file already uses `lucide-react` icons (`X`, `Plus`, `Trash2`) and `@radix-ui/react-dialog`, so it is partially aligned. Focus on:
- Form input classes
- Label text color classes
- Any remaining `dark:` Tailwind classes

### 3.10 File: `src/app/admin/page.tsx` — Fix Hardcoded rgba Values

**Before (line 193):**
```tsx
style={{ backgroundColor: 'rgba(51, 86, 208, 0.1)', color: 'var(--color-primary)' }}
```

**After:**
```tsx
style={{ backgroundColor: 'var(--color-primary-bg-subtle)', color: 'var(--color-primary)' }}
```

**Before (line 238):**
```tsx
style={{ backgroundColor: 'rgba(51, 86, 208, 0.15)', color: 'var(--color-primary)' }}
```

**After:**
```tsx
style={{ backgroundColor: 'var(--color-primary-bg-muted)', color: 'var(--color-primary)' }}
```

**Stat card emojis (lines 129, 133, 137, 141):**
Replace with lucide-react icons:

```tsx
// Before:
{ label: 'Total Cards', value: ..., icon: '💳', ... },
{ label: 'Users', value: ..., icon: '👥', ... },
{ label: 'Benefits', value: ..., icon: '🎁', ... },
{ label: 'Audit Logs', value: ..., icon: '📋', ... },

// After:
{ label: 'Total Cards', value: ..., icon: CreditCard, ... },
{ label: 'Users', value: ..., icon: UsersIcon, ... },
{ label: 'Benefits', value: ..., icon: Gift, ... },
{ label: 'Audit Logs', value: ..., icon: FileText, ... },
```

And update the rendering:
```tsx
// Before (line 170):
<span className="text-2xl">{stat.icon}</span>
// After:
<stat.icon size={24} className="text-[var(--color-primary)]" />
```

Add import: `import { CreditCard, Users as UsersIcon, Gift, FileText, Loader2 } from 'lucide-react';`

### 3.11 Verification Steps

```bash
# 1. No remaining dark: classes in admin pages
grep -c "dark:" src/app/admin/cards/page.tsx src/app/admin/benefits/page.tsx src/app/admin/users/page.tsx src/app/admin/audit/page.tsx src/app/admin/cards/\[id\]/page.tsx src/app/admin/_components/*.tsx
# Expected: 0 for each file

# 2. No remaining text-slate or bg-slate in admin pages
grep -c "text-slate\|bg-slate\|border-slate\|divide-slate" src/app/admin/cards/page.tsx src/app/admin/benefits/page.tsx src/app/admin/users/page.tsx src/app/admin/audit/page.tsx src/app/admin/cards/\[id\]/page.tsx src/app/admin/_components/*.tsx
# Expected: 0 for each file

# 3. No remaining emoji icons
grep -c "📊\|💳\|🎁\|👥\|📋\|⏳" src/app/admin/**/*.tsx src/app/admin/_components/*.tsx
# Expected: 0 for each file

# 4. No hardcoded rgba(51, 86, 208) values
grep -rn "rgba(51" src/app/admin/ --include="*.tsx"
# Expected: 0 results

# 5. Build still succeeds
npm run build

# 6. Toggle dark mode — all admin pages theme correctly via CSS variables
```

---

## Tier 4: Component Alignment

**Goal:** Bring admin UI components into functional parity with user dashboard patterns.

**Estimated scope:** 6 files modified, ~40 lines changed

### 4.1 Stat Cards: Add Shadow and Hover Effect (page.tsx)

**File:** `src/app/admin/page.tsx`

The user dashboard stat/benefit cards have `--shadow-sm` and a hover lift. Admin stat cards have no shadow and no hover effect.

**Before (lines 153-160):**
```tsx
<div
  key={idx}
  className={`rounded-lg border p-6 ${stat.loading ? 'animate-pulse' : ''}`}
  style={{
    backgroundColor: 'var(--color-bg)',
    borderColor: 'var(--color-border)',
  }}
>
```

**After:**
```tsx
<div
  key={idx}
  className={`rounded-lg border p-6 transition-all duration-200 ${
    stat.loading ? 'animate-pulse' : 'hover:-translate-y-0.5'
  }`}
  style={{
    backgroundColor: 'var(--color-bg)',
    borderColor: 'var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  }}
>
```

### 4.2 Pagination: Extract to Reusable Pattern

The identical pagination block is copy-pasted 4× (cards, benefits, users, audit). While extracting it into a shared component is ideal, a minimum-viable fix is to ensure all 4 copies use consistent token-based styling. After Tier 3 completes the color migration, all 4 copies will already be aligned. If desired, create a shared component:

**Optional: Create `src/app/admin/_components/AdminPagination.tsx`:**

```tsx
'use client';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  hasMore: boolean;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

export function AdminPagination({ page, totalPages, hasMore, isLoading, onPageChange }: AdminPaginationProps) {
  return (
    <div className="border-t border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
      <span className="text-sm text-[var(--color-text-secondary)]">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1 || isLoading}
          className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore || isLoading}
          className="px-4 py-2 rounded border border-[var(--color-border)] text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

Then replace all 4 pagination blocks with:
```tsx
<AdminPagination
  page={page}
  totalPages={pagination.totalPages}
  hasMore={pagination.hasMore}
  isLoading={isLoading}
  onPageChange={setPage}
/>
```

### 4.3 Modal Standardization

Currently there are **two different modal implementations:**
1. **Raw div overlay** — used in `cards/page.tsx` (create + delete modals) and `cards/[id]/page.tsx` (add benefit modal)
2. **Radix Dialog** — used in `EditBenefitModal.tsx` and `EditUserModal.tsx`

**Minimum fix (Tier 4):** Standardize the raw div modals to follow the same visual pattern as the Radix modals. After Tier 3 colors are migrated, ensure both patterns use `bg-[var(--color-bg)]` and `border-[var(--color-border)]`. The raw div modals should at minimum:
- Use `role="dialog"` and `aria-modal="true"` for accessibility
- Use consistent border radius and shadow

Add to the raw div modal overlays:
```tsx
// Add to the overlay div:
role="dialog"
aria-modal="true"
aria-labelledby="modal-title"
```

### 4.4 Form Input Alignment

After Tier 3, all form inputs will already use `border-[var(--color-border)]`, `bg-[var(--color-bg)]`, etc. No additional work needed beyond what Tier 3 covers.

### 4.5 Verification Steps

```bash
# 1. Stat cards have visible shadow and hover lift
# 2. Pagination is consistent across all 4 pages
# 3. Modals have consistent styling
# 4. Build succeeds
npm run build
```

---

## Tier 5: Polish & UX

**Goal:** Address remaining visual polish items and minor UX improvements.

**Estimated scope:** 4-5 files modified, ~30 lines changed

### 5.1 Content Max-Width Container

The admin main content area uses full-width while the user dashboard constrains to `max-w-6xl mx-auto`.

**File:** `src/app/admin/layout.tsx`

**Before (line 132):**
```tsx
<div className="p-6">
  {children}
</div>
```

**After:**
```tsx
<div className="p-6 max-w-6xl mx-auto">
  {children}
</div>
```

### 5.2 `<a href>` → Next.js `<Link>` Conversion

Multiple places use raw `<a href>` instead of Next.js `<Link>`, causing full page reloads instead of client-side navigation.

**File: `src/app/admin/page.tsx`**

```tsx
// Quick Actions (line 188):
// Before:
<a key={idx} href={action.href} ...>
// After:
<Link key={idx} href={action.href} ...>

// "View all activity" link (line 261):
// Before:
<a href="/admin/audit" ...>View all activity →</a>
// After:
<Link href="/admin/audit" ...>View all activity →</Link>
```
*(Add `import Link from 'next/link';` — already imported in some files)*

**File: `src/app/admin/cards/page.tsx`**

```tsx
// "View" link (line 569):
// Before:
<a href={`/admin/cards/${card.id}`} ...>View</a>
// After:
<Link href={`/admin/cards/${card.id}`} ...>View</Link>
```
*(Already imports `Link` via AdminBreadcrumb)*

Add `import Link from 'next/link';` to the page if not already present.

**File: `src/app/admin/cards/[id]/page.tsx`**

```tsx
// "← Back" link (line 297-302):
// Before:
<a href="/admin/cards" ...>
// After:
<Link href="/admin/cards" ...>
```

Add `import Link from 'next/link';` to the file.

### 5.3 Shimmer Skeleton Loading

The admin dashboard uses `animate-pulse` (opacity flash) for skeleton loading. The user dashboard uses a shimmer gradient animation. After Tier 1 deletes the admin CSS file, the `.skeleton` class is no longer available. Add a simple shimmer via Tailwind:

**Optional enhancement:** Add a shimmer utility class to `src/styles/globals.css`:

```css
/* Shimmer skeleton for loading states */
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--color-bg-secondary) 0%,
    var(--color-bg-tertiary) 50%,
    var(--color-bg-secondary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Then replace `animate-pulse` on skeleton loading divs:
```tsx
// Before:
<div className="h-16 bg-[var(--color-bg-secondary)] rounded-lg animate-pulse" />
// After:
<div className="h-16 rounded-lg skeleton-shimmer" />
```

### 5.4 Card Detail Page: Add Breadcrumb

**File:** `src/app/admin/cards/[id]/page.tsx`

The card detail page is the only sub-page without a breadcrumb. Add one at the top of the return JSX.

**Before (line 291):**
```tsx
<div className="space-y-6">
  <div className="flex items-start justify-between">
```

**After:**
```tsx
<div className="space-y-6">
  <AdminBreadcrumb currentPage="card-detail" cardName={card.cardName} />
  <div className="flex items-start justify-between">
```

Add import: `import { AdminBreadcrumb } from '../../_components/AdminBreadcrumb';`

This replaces the standalone "← Back" `<a>` link (line 297-302) — **remove that element** after adding the breadcrumb.

### 5.5 Mobile Navigation Consideration

The sidebar is hidden on mobile (`hidden md:flex`). The only mobile navigation is a small "← Back" button in the header. This is a known limitation.

**Minimum viable fix:** Add a collapsible mobile navigation drawer triggered by a hamburger icon in the header. This is a larger scope change and may be deferred to a future sprint. For now, document the limitation.

**Quick fix (small scope):** Ensure the mobile back button is clearly styled and accessible:

**File:** `src/app/admin/layout.tsx` (already done by Tier 2 — the ArrowLeft icon replacement).

### 5.6 Verification Steps

```bash
# 1. All pages have max-w-6xl constraint on content
# 2. Clicking "View" on cards table does client-side navigation (no full reload)
# 3. "View all activity" link does client-side navigation
# 4. Card detail page has breadcrumb at top
# 5. Loading skeletons use shimmer animation (if 5.3 applied)
# 6. Build succeeds
npm run build
```

---

## Appendix A: Design Token Mapping Reference

### Canonical Source: `src/styles/design-tokens.css`

| Token | Light Mode Value | Dark Mode Value |
|---|---|---|
| `--color-primary` | `#2563EB` | `#4F94FF` |
| `--color-secondary` | `#B45309` | `#fbbf24` |
| `--color-success` | `#0a7d57` | `#10b981` |
| `--color-error` | `#ef4444` | `#f87171` |
| `--color-warning` | `#B45309` | `#fb923c` |
| `--color-info` | `#0d9488` | `#2dd4bf` |
| `--color-bg` | `#ffffff` | `#0f172a` |
| `--color-bg-secondary` | `#F8FAFC` | `#1e293b` |
| `--color-bg-tertiary` | `#F1F5F9` | `#253347` |
| `--color-text` | `#111827` | `#f1f5f9` |
| `--color-text-secondary` | `#6b7280` | `#a8b5c8` |
| `--color-text-tertiary` | `#9ca3af` | `#64748b` |
| `--color-border` | `#e5e7eb` | `#334155` |
| `--color-error-light` | `#fee2e2` | `#7f1d1d` |
| `--color-success-light` | `#d1fae5` | `#064e3b` |
| `--color-warning-light` | `#fef08a` | `#713f12` |
| `--color-info-light` | `#ccfbf1` | `#134e4a` |
| `--color-primary-bg-subtle` | `rgba(37, 99, 235, 0.08)` | `rgba(79, 148, 255, 0.1)` |
| `--color-primary-bg-muted` | `rgba(37, 99, 235, 0.12)` | `rgba(79, 148, 255, 0.15)` |
| `--color-error-bg-muted` | `rgba(239, 68, 68, 0.1)` | `rgba(248, 113, 113, 0.12)` |
| `--shadow-sm` | `0 2px 4px rgba(0, 0, 0, 0.08)` | `0 2px 4px rgba(0, 0, 0, 0.4)` |
| `--header-shadow` | `0 1px 0 var(--color-border), 0 4px 12px rgba(0, 0, 0, 0.05)` | `0 1px 0 var(--color-border), 0 4px 12px rgba(0, 0, 0, 0.3)` |

### Conflicting Admin Tokens (DELETED in Tier 1)

These were in `src/features/admin/styles/design-tokens.css` and had different values:

| Token | Admin Value | Canonical Value | Difference |
|---|---|---|---|
| `--color-secondary` | `#7c3aed` (purple) | `#B45309` (amber) | Wrong color entirely |
| `--color-success` | `#10b981` | `#0a7d57` | Different shade |
| `--color-info` | `#0ea5e9` (sky blue) | `#0d9488` (teal) | Wrong hue |
| `--font-primary` | System stack only | `'Inter', system-ui, ...` | Missing Inter font |
| `--radius-lg` | `0.5rem` (8px) | `12px` | Different radius |
| `--shadow-sm` | Multi-shadow value | `0 2px 4px rgba(0,0,0,0.08)` | Different shadow |

---

## Appendix B: Lucide Icon Mapping Reference

| Context | Emoji / Text | Lucide Icon | Import Name |
|---|---|---|---|
| Sidebar: Dashboard | 📊 | `<LayoutDashboard />` | `LayoutDashboard` |
| Sidebar: Cards | 💳 | `<CreditCard />` | `CreditCard` |
| Sidebar: Benefits | 🎁 | `<Gift />` | `Gift` |
| Sidebar: Users | 👥 | `<Users />` | `Users` |
| Sidebar: Audit Log | 📋 | `<FileText />` | `FileText` |
| Loading spinner | ⏳ | `<Loader2 className="animate-spin" />` | `Loader2` |
| Back arrow | ← | `<ArrowLeft />` | `ArrowLeft` |
| Add button | + | `<Plus />` | `Plus` |
| Logo | CB (text) | `<CreditCard />` | `CreditCard` |

---

## Implementation Order Summary

```
Tier 1: Foundation & Cleanup          → 0 files modified, 3+ files/dirs deleted
Tier 2: Header & Navigation           → 1 file modified (layout.tsx)
Tier 3: Color System Migration         → 9 files modified (~235 replacements)
Tier 4: Component Alignment            → 2-6 files modified
Tier 5: Polish & UX                    → 4-5 files modified
```

**Total: ~12 unique files modified, ~3 files/dirs deleted, ~300 individual changes**

Each tier can be deployed and tested independently. Tier 1 MUST go first as it removes conflicting files. Tier 2 and Tier 3 can be done in parallel if desired, but Tier 3 is the largest and most impactful change. Tier 4 and Tier 5 depend on Tier 3 being complete for consistent styling.
