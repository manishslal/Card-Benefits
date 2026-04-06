# UI Standards & Design System

This document defines the canonical design standards for CardTrack. All future UI development must follow these patterns to maintain consistency across the application.

**Last Updated:** April 6, 2026
**Status:** Active
**Version:** 1.0.0

---

## Table of Contents

1. [CSS Variables & Theming](#css-variables--theming)
2. [Layout Components](#layout-components)
3. [Button Variants](#button-variants)
4. [Modal Patterns](#modal-patterns)
5. [Dropdown (Select) Patterns](#dropdown-select-patterns)
6. [Form Components](#form-components)
7. [Admin Pages](#admin-pages)
8. [Accessibility Standards](#accessibility-standards)

---

## CSS Variables & Theming

### Color Variables

All colors in CardTrack must use CSS variables defined in the design tokens file. **Never use hardcoded color values like `bg-slate-900` or `text-blue-600`.**

#### Core Color Variables

- **`--color-bg`** — Primary background color (white in light mode, dark slate in dark mode)
- **`--color-bg-secondary`** — Secondary background for cards, sections (slightly lighter/darker)
- **`--color-border`** — Border and divider colors
- **`--color-text`** — Primary text color (black in light, white in dark)
- **`--color-text-secondary`** — Secondary text for hints, metadata, labels
- **`--color-primary`** — Brand primary color (blue, 51, 86, 208)
- **`--color-error`** — Error state color (red)
- **`--color-success`** — Success state color (green)
- **`--color-warning`** — Warning state color (orange/yellow)

#### Usage Examples

```tsx
// ✅ CORRECT - Use CSS variables
<div style={{ backgroundColor: 'var(--color-bg)' }}>
  <p style={{ color: 'var(--color-text)' }}>Hello</p>
</div>

// ✅ CORRECT - Utility class with CSS var
<div className="text-[var(--color-text)]">Content</div>

// ❌ WRONG - Hardcoded Tailwind colors
<div className="bg-slate-900 dark:bg-white">❌ DO NOT DO THIS</div>

// ❌ WRONG - Hardcoded hex/rgb values
<div style={{ backgroundColor: '#1e293b' }}>❌ DO NOT DO THIS</div>
```

---

## Layout Components

### AppHeader Component

The `AppHeader` component (`src/shared/components/layout/AppHeader.tsx`) is the canonical header for all pages.

**Features:**
- Left side: Logo icon + "CardTrack" text (vertically centered, `flex items-center gap-2`)
- Right side: Action button (Settings or Back) + optional `rightSlot`
- Sticky positioning with border
- No dark mode toggle in header (toggle lives only in Preferences tab)

**Usage:**

```tsx
// On dashboard and main pages
<AppHeader />

// On settings or detail pages (with back button)
<AppHeader
  backHref="/dashboard"
  backLabel="Back to Dashboard"
/>

// With additional controls
<AppHeader
  rightSlot={<SomeButton />}
/>
```

**File:** `src/shared/components/layout/AppHeader.tsx`

---

## Button Variants

Use the shared `Button` component (`src/shared/components/ui/button.tsx`) for all interactive buttons.

### Variant Catalog

| Variant | Use Case | Example |
|---------|----------|---------|
| `primary` | Primary call-to-action, form submission | Add Card, Save Changes |
| `secondary` | Secondary action, less emphasis | Add Benefit, View Details |
| `outline` | Tertiary action, default state | Settings, Cancel |
| `danger` | Destructive actions | Delete, Remove |
| `ghost` | Minimal, inline actions | Links within text |

### Size Options

- `sm` — Small buttons (compact)
- `md` — Medium buttons (default)
- `lg` — Large buttons (full-width on mobile)

### Example Usage

```tsx
import Button from '@/shared/components/ui/button';

<Button variant="primary" size="md">Save</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="danger">Delete</Button>
```

---

## Modal Patterns

### Centering (Critical)

All modals must be properly centered on all viewport sizes, including mobile.

**Correct CSS:**
```tsx
className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)]
  translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6
  max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
```

**Critical:** `max-w-[calc(100%-2rem)]` reserves 1rem of padding on each side.
- ❌ **DO NOT** add `mx-4` — it breaks centering on fixed/absolute elements
- ✅ The `max-w-[calc(...)]` already handles mobile edge clearance

### Modal Structure

```tsx
<DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50" />

    <DialogPrimitive.Content
      className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)]
        sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%]
        rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto
        border border-[var(--color-border)]"
      style={{ backgroundColor: 'var(--color-bg)' }}
    >
      <DialogPrimitive.Title className="text-2xl font-bold text-[var(--color-text)]">
        Modal Title
      </DialogPrimitive.Title>

      {/* Content here */}

      <div className="flex gap-3 pt-4">
        <Button variant="primary" type="submit">Submit</Button>
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Cancel</Button>
        </DialogPrimitive.Close>
      </div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
```

---

## Dropdown (Select) Patterns

### Inside Modals

When using a select/dropdown **inside a modal**, always use `position="popper"` to prevent full-viewport-height expansion.

**Correct SelectContent wrapper:**
```tsx
<SelectPrimitive.Content
  position="popper"
  sideOffset={4}
  className="relative z-50 max-h-60 min-w-[8rem] overflow-hidden rounded-md
    bg-[var(--color-bg)] text-[var(--color-text)] shadow-md
    border border-[var(--color-border)] ..."
>
  <SelectPrimitive.Viewport className="h-[var(--radix-select-trigger-height)] max-h-60 p-1">
    {/* Options */}
  </SelectPrimitive.Viewport>
</SelectPrimitive.Content>
```

**Key properties:**
- `position="popper"` — Positions dropdown relative to trigger, not viewport
- `sideOffset={4}` — 4px spacing below the trigger
- `max-h-60` — Hard limit on height
- `SelectViewport` has `max-h-60` for double-safety

**File:** `src/shared/components/ui/select-unified.tsx`

---

## Form Components

### Input Component

Use the shared `Input` component for all text fields:

```tsx
import Input from '@/shared/components/ui/Input';

<Input
  label="Card Name"
  type="text"
  name="cardName"
  placeholder="e.g., Chase Sapphire"
  value={value}
  onChange={handleChange}
  error={errors.cardName}
  required
  hint="Optional: Your custom nickname for this card"
/>
```

### Select Component

Use `UnifiedSelect` for all dropdowns:

```tsx
import { UnifiedSelect } from '@/shared/components/ui/select-unified';

<UnifiedSelect
  label="Select Card"
  options={[
    { value: '1', label: 'Chase Sapphire' },
    { value: '2', label: 'American Express' },
  ]}
  value={selectedValue}
  onChange={handleChange}
  error={errors.masterCardId}
  required
/>
```

---

## Admin Pages

### Color Consistency Rule

**All admin pages must use CSS variables, not hardcoded Tailwind colors.**

#### Color Substitution Map

| Old Pattern | New Pattern |
|-------------|-------------|
| `text-slate-900 dark:text-white` | `text-[var(--color-text)]` |
| `text-slate-600 dark:text-slate-400` | `text-[var(--color-text-secondary)]` |
| `bg-white dark:bg-slate-900` | `style={{ backgroundColor: 'var(--color-bg)' }}` |
| `bg-slate-50 dark:bg-slate-800` | `style={{ backgroundColor: 'var(--color-bg-secondary)' }}` |
| `border-slate-200 dark:border-slate-800` | `style={{ borderColor: 'var(--color-border)' }}` |
| `bg-blue-600 hover:bg-blue-700` | `<Button variant="primary" />` |
| `text-blue-600 dark:text-blue-400` | `style={{ color: 'var(--color-primary)' }}` |
| `hover:text-blue-600` | `hover:text-[var(--color-primary)]` |

### Admin Layout

Files to update:
- `src/app/admin/layout.tsx` ✅ (Complete)
- `src/app/admin/page.tsx` ✅ (Complete)
- `src/app/admin/cards/page.tsx` (Partial)
- `src/app/admin/benefits/page.tsx` (Partial)
- `src/app/admin/users/page.tsx` (Partial)
- `src/app/admin/audit/page.tsx` (Partial)
- `src/app/admin/_components/AdminBreadcrumb.tsx` (Pending)

### Admin Components

**Use shared components where possible:**
- Buttons: Use `<Button variant="primary" />` instead of hardcoded `bg-blue-600`
- Badges: Use `<Badge />` component for role badges, not custom `<span>` with colors
- Cards: Use `bg-[var(--color-bg)]` with `border border-[var(--color-border)]`

**Example Admin Card:**
```tsx
<div
  className="rounded-lg border p-6"
  style={{
    backgroundColor: 'var(--color-bg)',
    borderColor: 'var(--color-border)',
  }}
>
  <h3 className="text-lg font-semibold text-[var(--color-text)]">
    Card Title
  </h3>
  <p className="text-sm text-[var(--color-text-secondary)]">
    Description
  </p>
</div>
```

---

## Accessibility Standards

All components must meet **WCAG 2.1 AA** minimum standards.

### Keyboard Navigation

- ✅ All buttons and links must be keyboard accessible
- ✅ Tab order must be logical
- ✅ Escape key closes modals
- ✅ Focus management: focus moves to first input in modals

### Screen Reader Support

- ✅ Use semantic HTML (`<button>`, `<input>`, `<label>`)
- ✅ Add `aria-label` or `aria-labelledby` for non-text content
- ✅ Use `aria-describedby` for error messages and hints
- ✅ Mark form fields as `required` and `aria-required="true"`

### Focus Indicators

- ✅ All interactive elements must have visible focus states
- ✅ Use `focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]`

### Example Form with A11y

```tsx
<form>
  <label htmlFor="card-name" className="block font-semibold mb-2">
    Card Name <span aria-label="required">*</span>
  </label>
  <input
    id="card-name"
    aria-required="true"
    aria-describedby="card-name-hint"
    className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
  />
  <p id="card-name-hint" className="text-xs text-[var(--color-text-secondary)]">
    Your custom name for this card
  </p>
</form>
```

---

## Migration Checklist

For existing pages not yet updated, use this checklist:

- [ ] All hardcoded color classes replaced with CSS variables
- [ ] All `bg-*`, `text-*`, `border-*` Tailwind colors removed
- [ ] All modals have correct centering CSS (no `mx-4`)
- [ ] All dropdowns use `position="popper"` if inside modals
- [ ] All buttons use shared `<Button>` component
- [ ] All form fields use shared components (`Input`, `UnifiedSelect`)
- [ ] Accessibility: `aria-*` attributes added for non-text content
- [ ] Focus states: `:focus:ring` applied to all interactive elements
- [ ] Dark mode: Tested in light and dark modes
- [ ] Mobile: Tested at 375px viewport width

---

## Design Token Files

- **Main tokens:** `src/styles/design-tokens.css`
- **Component styles:** `src/shared/components/ui/` (individual files)
- **Layout utilities:** `src/shared/components/layout/`

## Related Files

- **Component Library:** `src/shared/components/`
- **Shared Utilities:** `src/shared/lib/`
- **Form Components:** `src/shared/components/forms/`

---

## Future Improvements

- [ ] Document spacing scale (padding, margin)
- [ ] Document typography scale (font sizes, weights)
- [ ] Add animation guidelines
- [ ] Add responsive breakpoint strategy
- [ ] Document date/time formatting rules
- [ ] Add internationalization guidelines

