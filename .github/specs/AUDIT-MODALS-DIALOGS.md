# AUDIT: Modal, Dialog, and Button Wiring Issues

**Date:** 2025-07-15
**Auditor:** QA Code Review Agent
**Scope:** All modal/dialog components, button handlers, and accessibility compliance in `src/`

---

## Executive Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 2 | "Mark Used" button wired to wrong handler; `ui/Modal.tsx` missing all ARIA semantics |
| 🟠 High | 2 | Form modals overflow on mobile (no responsive max-width); delete dialogs missing overflow scroll |
| 🟡 Medium | 3 | Duplicate dialog primitive pattern (wrapper never used); fixed padding on mobile; inconsistent architecture |
| 🟢 Low | 1 | Custom `ui/Modal.tsx` is dead code (not imported anywhere) |

**Verdict:** NOT READY for production on mobile devices. The "Mark Used" button is entirely broken—it opens the Edit modal instead of toggling usage. Four modals will overflow on phones (< 672px screens). The `ui/dialog.tsx` wrapper component was built but is never consumed by any feature modal.

---

## Components Audited

| # | Component | File | Pattern | Status |
|---|-----------|------|---------|--------|
| 1 | Dialog UI Wrapper | `src/components/ui/dialog.tsx` | Radix wrapper | ✅ Well-built but **unused** |
| 2 | Custom Modal | `src/components/ui/Modal.tsx` | Custom div-based | ⚠️ Non-compliant, **dead code** |
| 3 | AddBenefitModal | `src/components/AddBenefitModal.tsx` | Radix direct | 🟠 Mobile overflow |
| 4 | AddCardModal | `src/components/AddCardModal.tsx` | Radix direct | 🟠 Mobile overflow |
| 5 | EditBenefitModal | `src/components/EditBenefitModal.tsx` | Radix direct | 🟠 Mobile overflow |
| 6 | EditCardModal | `src/components/EditCardModal.tsx` | Radix direct | 🟠 Mobile overflow |
| 7 | DeleteBenefitConfirmationDialog | `src/components/DeleteBenefitConfirmationDialog.tsx` | Radix direct | 🟡 Missing overflow |
| 8 | DeleteCardConfirmationDialog | `src/components/DeleteCardConfirmationDialog.tsx` | Radix direct | 🟡 Missing overflow |

---

## Issue 1: Modals Overflow Viewport on Mobile

### Root Cause

All four form modals (`AddBenefitModal`, `AddCardModal`, `EditBenefitModal`, `EditCardModal`) use a fixed `max-w-2xl` (672px) with **no responsive breakpoint**. On any device narrower than ~704px (672px + 32px of `mx-4`), the modal content is wider than the screen.

The `w-full max-w-2xl` class means: "be full width, but never wider than 672px." On a 375px iPhone, `w-full` would limit to 375px, but the `mx-4` (16px margin each side) means the modal tries to be 375px inside a space of 375px—PLUS the `max-w-2xl` provides no mobile override. The real problem is **`mx-4` is additive to `w-full`**, so the computed box is `100% + 32px margin`, which can exceed the viewport in edge cases when combined with `p-6` internal padding. On phones where the modal content is taller than the screen, `max-h-[90vh]` helps but the width is still problematic.

Additionally, both delete confirmation dialogs (`DeleteBenefitConfirmationDialog`, `DeleteCardConfirmationDialog`) lack `max-h-*` and `overflow-y-auto` entirely, so error messages can push content off-screen.

### Bug 1A: Form Modals – No Responsive Max-Width

**Affected Files (identical pattern in all four):**

#### `src/components/AddBenefitModal.tsx` — Line 195
```tsx
// CURRENT (buggy):
className="fixed left-[50%] top-[50%] z-50 w-full max-w-2xl translate-x-[-50%] translate-y-[-50%] ... p-6 mx-4 max-h-[90vh] overflow-y-auto"
```

#### `src/components/AddCardModal.tsx` — Line 224
```tsx
// CURRENT (buggy): Same pattern
className="... w-full max-w-2xl ... p-6 mx-4 max-h-[90vh] overflow-y-auto"
```

#### `src/components/EditBenefitModal.tsx` — Line 213
```tsx
// CURRENT (buggy): Same pattern
className="... w-full max-w-2xl ... p-6 mx-4 max-h-[90vh] overflow-y-auto"
```

#### `src/components/EditCardModal.tsx` — Line 172
```tsx
// CURRENT (buggy): Same pattern
className="... w-full max-w-2xl ... p-6 mx-4 max-h-[90vh] overflow-y-auto"
```

**Fix Pattern for all four:**
```tsx
// FIXED: Add responsive max-width breakpoints and mobile-safe max-height
className="fixed left-[50%] top-[50%] z-50 w-[calc(100%-2rem)] max-w-lg sm:max-w-xl md:max-w-2xl translate-x-[-50%] translate-y-[-50%] ... p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto"
```

**Key changes:**
1. `w-full mx-4` → `w-[calc(100%-2rem)]` (safer: margin is built into the width calculation)
2. `max-w-2xl` → `max-w-lg sm:max-w-xl md:max-w-2xl` (responsive breakpoints)
3. `p-6` → `p-4 sm:p-6` (tighter padding on mobile)
4. `max-h-[90vh]` → `max-h-[calc(100vh-2rem)]` (safer on mobile browsers with address bars)

### Bug 1B: Delete Confirmation Dialogs – No Overflow Handling

#### `src/components/DeleteBenefitConfirmationDialog.tsx` — Line 84
```tsx
// CURRENT (buggy): No max-h or overflow-y
className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] ... p-6 mx-4"
//                                                                                                        ^^^ NO max-h, NO overflow-y
```

#### `src/components/DeleteCardConfirmationDialog.tsx` — Line 86
```tsx
// CURRENT (buggy): Same issue
className="fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%] ... p-6 mx-4"
```

**Fix Pattern:**
```tsx
className="... w-[calc(100%-2rem)] max-w-sm ... p-4 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto"
```

### Bug 1C: `ui/dialog.tsx` DialogContent – No Max-Height or Overflow

#### `src/components/ui/dialog.tsx` — Line 64
```tsx
// CURRENT: No max-height or overflow
className="fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-6 ... sm:max-w-sm ..."
```

**Fix Pattern:**
```tsx
className="... max-h-[calc(100vh-2rem)] overflow-y-auto ..."
```

> Note: This wrapper component is currently NOT consumed by any feature modal (they all use `DialogPrimitive.*` directly), but it should be fixed for when it is eventually used.

---

## Issue 2: "Edit" and "Mark Used" Buttons Open the SAME Modal

### Root Cause

This is a confirmed **button wiring bug**. Both the `onEdit` and `onMarkUsed` callbacks in the dashboard and card detail pages call the exact same function: `handleEditBenefitClick`, which opens the `EditBenefitModal`. There is NO `handleMarkUsed` function implemented anywhere in the frontend despite a working API endpoint existing at `PATCH /api/benefits/[id]/toggle-used`.

### Bug 2A: Dashboard Page — `onMarkUsed` Wired to Edit Handler

#### `src/app/(dashboard)/page.tsx` — Lines 601–607
```tsx
// CURRENT (buggy):
<BenefitsGrid
  benefits={mockBenefits as any}
  onEdit={handleEditBenefitClick}        // ← Opens EditBenefitModal
  onDelete={handleDeleteBenefitClick}
  onMarkUsed={handleEditBenefitClick}    // ← BUG: ALSO opens EditBenefitModal!
  gridColumns={3}
/>
```

The `handleEditBenefitClick` function (lines 208–214) does:
```tsx
const handleEditBenefitClick = (benefitId: string) => {
  const benefit = benefits.find((b) => b.id === benefitId);
  if (benefit) {
    setSelectedBenefit(benefit);
    setIsEditBenefitOpen(true);  // ← Opens EditBenefitModal for BOTH buttons
  }
};
```

### Bug 2B: Card Detail Page — `onMarkUsed` Wired to Edit Handler (Both Views)

#### `src/app/(dashboard)/card/[id]/page.tsx` — Lines 609–613 (List View)
```tsx
// CURRENT (buggy):
<BenefitsList
  benefits={filteredBenefits}
  onEdit={handleEditBenefitClick}
  onDelete={handleDeleteBenefitClick}
  onMarkUsed={(id) => {
    // Mark as used can be handled via the EditBenefitModal or via a direct API call
    // For now, we open the edit modal to allow marking as used
    handleEditBenefitClick(id);   // ← BUG: Opens Edit modal instead of marking used
  }}
/>
```

#### `src/app/(dashboard)/card/[id]/page.tsx` — Lines 620–624 (Grid View)
```tsx
// CURRENT (buggy):
<BenefitsGrid
  benefits={filteredBenefits}
  onEdit={handleEditBenefitClick}
  onDelete={handleDeleteBenefitClick}
  onMarkUsed={(id) => {
    // Mark as used can be handled via the EditBenefitModal or via a direct API call
    // For now, we open the edit modal to allow marking as used
    handleEditBenefitClick(id);   // ← BUG: Same issue
  }}
  gridColumns={3}
/>
```

### Fix Pattern

**Step 1:** Create a `handleMarkUsed` function in both pages:
```tsx
const handleMarkUsed = async (benefitId: string) => {
  try {
    const res = await fetch(`/api/benefits/${benefitId}/toggle-used`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isUsed: true }),
    });
    if (!res.ok) throw new Error('Failed to mark benefit as used');
    const data = await res.json();
    if (data.success) {
      // Update local state to reflect the change
      setBenefits(benefits.map((b) =>
        b.id === benefitId
          ? { ...b, isUsed: true, timesUsed: (b.timesUsed || 0) + 1 }
          : b
      ));
    }
  } catch (error) {
    console.error('Error marking benefit as used:', error);
    // Show toast notification for error
  }
};
```

**Step 2:** Wire the buttons correctly:
```tsx
// Dashboard page (line 605):
onMarkUsed={handleMarkUsed}    // NOT handleEditBenefitClick

// Card detail page (lines 612, 623):
onMarkUsed={handleMarkUsed}    // NOT handleEditBenefitClick
```

### Supporting Evidence: API Endpoint Exists and Works

The backend is already implemented at `src/app/api/benefits/[id]/toggle-used/route.ts` (102 lines). It:
- Accepts `PATCH` with `{ isUsed: boolean }` body
- Validates authentication and authorization
- Updates `isUsed`, `timesUsed`, and `claimedAt` in the database
- Returns the updated benefit data

The frontend simply never calls it.

---

## Issue 3: DialogTitle Accessibility Warning

### Findings

After auditing all 8 modal/dialog components:

| Component | DialogTitle | DialogDescription | Compliant? |
|-----------|:-----------:|:-----------------:|:----------:|
| AddBenefitModal.tsx (line 201) | ✅ | ✅ (line 207) | Yes |
| AddCardModal.tsx (line 239) | ✅ | ✅ (line 245) | Yes |
| EditBenefitModal.tsx (line 219) | ✅ | ✅ (line 225) | Yes |
| EditCardModal.tsx (line 178) | ✅ | ✅ (line 184) | Yes |
| DeleteBenefitConfirmationDialog.tsx (line 89) | ✅ | ✅ (line 107) | Yes |
| DeleteCardConfirmationDialog.tsx (line 91) | ✅ | ✅ (line 109) | Yes |
| **ui/dialog.tsx — DialogContent wrapper (line 50)** | **❌** | **❌** | **NO** |
| **ui/Modal.tsx (line 82)** | **❌** | **❌** | **NO** |

### Bug 3A: `ui/dialog.tsx` DialogContent Does Not Include or Require DialogTitle

#### `src/components/ui/dialog.tsx` — Lines 50–86

The `DialogContent` wrapper component renders `DialogPrimitive.Content` with children and an optional close button, but does NOT include `DialogTitle` in its output. This means:

1. Any consumer of `<DialogContent>` who forgets to include `<DialogTitle>` will trigger the Radix accessibility warning.
2. There is no TypeScript enforcement (no required `title` prop) to prevent this.

```tsx
// CURRENT: DialogContent has no title enforcement
function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content ...>
        {children}                    {/* ← Consumer must remember to add DialogTitle */}
        {showCloseButton && ( ... )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
```

**Impact:** Currently LOW because no feature component actually imports from `ui/dialog.tsx`. But if anyone does use it in the future without adding `<DialogTitle>`, they'll get the Radix warning.

**Fix Pattern:** Add a required `title` prop or document that `<DialogTitle>` must be included:
```tsx
function DialogContent({
  className,
  children,
  title,              // ← Add required title prop
  description,        // ← Optional description prop
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content ...>
        {title && <DialogTitle>{title}</DialogTitle>}
        {description && <DialogDescription>{description}</DialogDescription>}
        {children}
        ...
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
```

### Bug 3B: `ui/Modal.tsx` Has No ARIA Dialog Semantics At All

#### `src/components/ui/Modal.tsx` — Lines 53–113

This custom modal component uses plain `<div>` elements with no ARIA roles, no `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby`, and no `aria-describedby`. It uses `<h2>` (line 82) instead of `DialogPrimitive.Title`.

```tsx
// CURRENT (non-compliant):
<div className="fixed inset-0 z-40 ..." onClick={onClose} role="presentation" />
<div className="fixed inset-0 z-50 ...">         {/* ← No role="dialog" */}
  <div className="bg-[var(--color-bg)] ...">      {/* ← No aria-modal="true" */}
    <h2 className="text-2xl font-bold ...">       {/* ← Not DialogPrimitive.Title */}
      {title}
    </h2>
```

**Missing ARIA attributes:**
- `role="dialog"` on the modal container
- `aria-modal="true"` on the modal container
- `aria-labelledby` referencing the title element
- `aria-describedby` for description
- Focus trapping (only handles Escape key, no Tab key trapping)

**Impact:** Currently LOW because `ui/Modal.tsx` is **dead code** — no component imports it. But it should either be deleted or refactored.

**Fix Pattern:** Delete the file entirely and use the Radix-based `ui/dialog.tsx` wrapper instead. Or refactor to use Radix:
```tsx
// Better: Just delete ui/Modal.tsx and use ui/dialog.tsx
```

---

## Issue 4: Modal Architecture — Radix Dialog Compliance

### Finding: All Feature Modals Bypass the `ui/dialog.tsx` Wrapper

Every feature modal/dialog imports `@radix-ui/react-dialog` directly:

```tsx
// Pattern used by ALL 6 feature modals:
import * as DialogPrimitive from '@radix-ui/react-dialog';
```

None import from the project's own wrapper:
```tsx
// This import exists NOWHERE in the codebase:
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
```

**Grep results confirming this:**
- `import.*from.*@/components/ui/dialog` → **0 matches** in entire `src/`
- `import.*from.*ui/Modal` → **0 matches** in entire `src/`

### Impact Analysis

| Issue | Severity | Impact |
|-------|----------|--------|
| Duplicated CSS across 6 files | 🟡 Medium | Each modal independently defines the same animation classes, positioning, and overlay styles — 15+ lines duplicated per file |
| Inconsistent with ui/ pattern | 🟡 Medium | The project has a well-built `ui/dialog.tsx` wrapper that's never used, creating confusion for new developers |
| ui/Modal.tsx is dead code | 🟢 Low | 120 lines of non-compliant code that's never imported |

### Structural Compliance Check (All 6 Feature Modals)

| Radix Element | Required? | AddBenefit | AddCard | EditBenefit | EditCard | DeleteBenefit | DeleteCard |
|---------------|-----------|:---:|:---:|:---:|:---:|:---:|:---:|
| `DialogPrimitive.Root` | Yes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Portal` | Yes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Overlay` | Yes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Content` | Yes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Title` | Yes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Description` | Recommended | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Close` | Recommended | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `DialogPrimitive.Trigger` | Optional | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> All 6 feature modals are **structurally compliant** with Radix Dialog. The `Trigger` is not used because open/close state is managed externally via `isOpen`/`onClose` props. This is a valid pattern.

### Recommendation: Consolidate to Use `ui/dialog.tsx` Wrapper

The existing `ui/dialog.tsx` wrapper is well-built (168 lines) and provides:
- Consistent animation classes
- Built-in close button with aria-label
- `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` layout helpers
- Proper `data-slot` attributes for testing

All 6 feature modals should be refactored to use it, eliminating ~90 lines of duplicated CSS per modal. Example migration:

```tsx
// BEFORE (current — each modal duplicates this):
import * as DialogPrimitive from '@radix-ui/react-dialog';
// ... 20+ lines of positioning/animation CSS on DialogPrimitive.Content

// AFTER (recommended):
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
  <DialogContent className="sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>Add Benefit</DialogTitle>
      <DialogDescription>Add a new benefit to this card</DialogDescription>
    </DialogHeader>
    {/* form content */}
  </DialogContent>
</Dialog>
```

---

## Summary of All Bugs Found

| # | Severity | Issue | File(s) | Line(s) |
|---|----------|-------|---------|---------|
| 2A | 🔴 Critical | `onMarkUsed` calls `handleEditBenefitClick` (opens Edit modal) | `src/app/(dashboard)/page.tsx` | 605 |
| 2B | 🔴 Critical | `onMarkUsed` calls `handleEditBenefitClick` (both list & grid) | `src/app/(dashboard)/card/[id]/page.tsx` | 612, 623 |
| 3B | 🔴 Critical | `ui/Modal.tsx` has no ARIA dialog semantics (role, aria-modal, aria-labelledby) | `src/components/ui/Modal.tsx` | 53–113 |
| 1A | 🟠 High | Form modals use `max-w-2xl` with no responsive breakpoint | `AddBenefitModal.tsx`, `AddCardModal.tsx`, `EditBenefitModal.tsx`, `EditCardModal.tsx` | 195, 224, 213, 172 |
| 1B | 🟠 High | Delete dialogs missing `max-h` and `overflow-y-auto` | `DeleteBenefitConfirmationDialog.tsx`, `DeleteCardConfirmationDialog.tsx` | 84, 86 |
| 1C | 🟡 Medium | `ui/dialog.tsx` DialogContent missing max-height/overflow | `src/components/ui/dialog.tsx` | 64 |
| 3A | 🟡 Medium | `ui/dialog.tsx` DialogContent doesn't enforce/include DialogTitle | `src/components/ui/dialog.tsx` | 50–86 |
| 4 | 🟡 Medium | All 6 feature modals bypass `ui/dialog.tsx` wrapper (duplicated CSS) | All modal components | N/A |
| — | 🟢 Low | `ui/Modal.tsx` is dead code (not imported anywhere) | `src/components/ui/Modal.tsx` | All |

---

## Test Coverage Recommendations

### Priority 1: Button Wiring Tests
```
TEST: "Mark Used" button should call toggle-used API, not open Edit modal
TEST: "Edit" button should open EditBenefitModal
TEST: "Mark Used" and "Edit" should produce different UI outcomes
TEST: After "Mark Used", benefit.isUsed should be true in UI state
TEST: After "Mark Used", benefit.timesUsed should increment
```

### Priority 2: Mobile Viewport Tests
```
TEST: Modal fits within 320px viewport width without horizontal scroll
TEST: Modal fits within 375px viewport width (iPhone SE)
TEST: Modal content scrolls vertically when form exceeds viewport height
TEST: Delete dialog shows error messages without overflow on 375px viewport
TEST: Modal close button is accessible (not clipped) on small screens
```

### Priority 3: Accessibility Tests
```
TEST: All modals announce their title to screen readers
TEST: Focus is trapped within open modal (Tab key cycles within modal)
TEST: Escape key closes the modal
TEST: Focus returns to trigger element after modal closes
TEST: No Radix "missing DialogTitle" console warnings
```

---

## Appendix: File-by-File Quick Reference

### Files with Bugs
| File | Lines to Fix |
|------|-------------|
| `src/app/(dashboard)/page.tsx` | Line 605: change `handleEditBenefitClick` → new `handleMarkUsed` |
| `src/app/(dashboard)/card/[id]/page.tsx` | Lines 612, 623: same fix |
| `src/components/AddBenefitModal.tsx` | Line 195: add responsive max-w breakpoints |
| `src/components/AddCardModal.tsx` | Line 224: add responsive max-w breakpoints |
| `src/components/EditBenefitModal.tsx` | Line 213: add responsive max-w breakpoints |
| `src/components/EditCardModal.tsx` | Line 172: add responsive max-w breakpoints |
| `src/components/DeleteBenefitConfirmationDialog.tsx` | Line 84: add max-h + overflow-y-auto |
| `src/components/DeleteCardConfirmationDialog.tsx` | Line 86: add max-h + overflow-y-auto |

### Files That Are Clean
| File | Status |
|------|--------|
| `src/components/features/BenefitsList.tsx` | ✅ Correctly propagates onEdit/onMarkUsed as separate callbacks |
| `src/components/features/BenefitsGrid.tsx` | ✅ Correctly propagates onEdit/onMarkUsed as separate callbacks |
| `src/app/api/benefits/[id]/toggle-used/route.ts` | ✅ API works correctly, just never called by frontend |

### Files to Consider Deleting
| File | Reason |
|------|--------|
| `src/components/ui/Modal.tsx` | Dead code. Not imported anywhere. Non-compliant with ARIA. Replace with `ui/dialog.tsx`. |
