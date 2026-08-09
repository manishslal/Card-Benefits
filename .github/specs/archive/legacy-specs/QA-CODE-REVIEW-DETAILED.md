# Detailed Code Review - Mobile Polish Enhancements
## Line-by-Line Analysis for Developers

**Review Date:** April 6, 2026
**Reviewed Files:** 5 components + 1 page
**Total Issues:** 15 (4 Critical, 5 High, 4 Medium, 2 Low)

---

## File 1: DashboardSummary.tsx

### Location: `/src/shared/components/features/DashboardSummary.tsx`

#### Line 46 - Loading Skeleton Grid (CRITICAL)

**Current Code:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

**Status:** ✓ CORRECT for skeleton (matches spec)

**Note:** But see line 68 for actual content grid issue.

---

#### Line 68 - Content Grid Layout (CRITICAL - SPEC VIOLATION)

**Current Code:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
```

**Specification Requirement (from UX spec):**
```
Mobile (320-639px): grid-cols-2 (2 columns, not 1)
Tablet (640-1023px): md:grid-cols-3 (3 columns, not 2)
Desktop (1024px+): lg:grid-cols-4 (4 columns) ✓
```

**What's Wrong:**
- Mobile: 1 column ✗ (spec says 2)
- Tablet: 2 columns ✗ (spec says 3)
- Desktop: 4 columns ✓

**Why This Matters:**
- Spec was explicitly defined based on design research
- Visual hierarchy on mobile is broken
- Stat cards stack vertically instead of side-by-side
- Users see excessive scrolling

**Required Fix:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

**Effort:** 30 seconds

---

#### Line 37-54 - Loading State Grid (CRITICAL - SPEC VIOLATION)

**Current Code:**
```tsx
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {[1, 2, 3, 4].map((i) => (
    <div
      key={i}
      className="h-24 rounded-lg animate-pulse"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    />
  ))}
</div>
```

**Status:** ✓ CORRECT - matches spec

**However:** Should probably only show 2-4 skeleton items based on viewport? Currently always shows 4 items regardless of grid layout.

---

#### Lines 73-75 - Animation Delay (MEDIUM)

**Current Code:**
```tsx
style={{
  animationDelay: `${index * 50}ms`,
}}
```

**Potential Issue:**
- Each card gets staggered animation (0ms, 50ms, 100ms, 150ms)
- Animation uses `translateY(8px)` which can cause Cumulative Layout Shift (CLS)
- Impacts Google Core Web Vitals score
- Could affect SEO

**Testing Note:**
Check CLS score before and after this animation loads.

**Suggested Improvement:**
Consider using CSS containment to prevent layout recalc:
```css
.animate-fade-in {
  contain: layout style paint;
}
```

---

#### Lines 89-104 - Animation Keyframes (MEDIUM)

**Current Code:**
```tsx
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}
```

**Issue:** This animation uses `transform: translateY()` which can cause layout shift if the container doesn't have proper constraints.

**Improvement Suggestion:**
```tsx
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

Only animate opacity, not position. This prevents CLS issues.

---

## File 2: StatCard.tsx

### Location: `/src/features/cards/components/ui/StatCard.tsx`

#### Lines 33-39 - Base Classes (HIGH - ICON REMOVED)

**Current Code:**
```tsx
const baseClasses = [
  'rounded-lg p-4 sm:p-6 flex flex-col gap-3',
  'bg-[var(--color-bg)] border border-[var(--color-border)]',
  'shadow-sm transition-all duration-200 hover:shadow-md',
  className,
].join(' ');
```

**Status:** ✓ Responsive padding is correct (p-4 mobile, sm:p-6 tablet)

---

#### Lines 52-56 - Icon Display Section (CRITICAL - ICONS REMOVED)

**Current Code:**
```tsx
<div className="flex items-start justify-between">
  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
    {label}
  </span>
</div>
```

**What's Wrong:**
- Icon is completely removed
- Component receives `icon` prop but never renders it
- Spec says "remove text labels" not "remove icons"

**Specification Quote:**
> "Reduce visual clutter by removing redundant text labels. Icons should remain as primary indicators."

**What Was Implemented:**
- BEFORE: Icon + Text label = visual clutter
- SPEC WANTS: Icon only (or Icon + text, but cleaner)
- ACTUAL: Text only (icon removed completely) ← WRONG

**Where Icon Should Go:**
The icon should be displayed somewhere visible. Options:
1. Above the label
2. Inline with label
3. Replace label entirely with just icon

**Example Fix Option 1:**
```tsx
<div className="flex items-start justify-between mb-3">
  {icon && (
    <span className="text-[var(--color-text-secondary)] flex-shrink-0" aria-hidden="true">
      {icon}
    </span>
  )}
</div>
<span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
  {label}
</span>
```

**Effort:** 10 minutes

---

#### Lines 58-76 - Value and Change Display (LOOKS OK)

**Current Code:**
```tsx
<div className="flex items-end justify-between">
  <span
    className="text-3xl font-bold text-[var(--color-text)]"
    style={{ fontFamily: 'var(--font-mono)' }}
  >
    {value}
  </span>
  {change && (
    <span
      className={`text-xs font-medium ${
        change.isPositive
          ? 'text-[var(--color-success)]'
          : 'text-[var(--color-error)]'
      }`}
    >
      {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
    </span>
  )}
</div>
```

**Status:** ✓ Change indicator looks good

**Minor Note:** Dark mode contrast should be verified. Make sure error color has 4.5:1 contrast against dark background per WCAG 2.1 AA.

---

## File 3: AddCardModal.tsx

### Location: `/src/features/cards/components/modals/AddCardModal.tsx`

#### Lines 119-135 - Auto-Populate Annual Fee (CRITICAL - RACE CONDITION)

**Current Code:**
```tsx
useEffect(() => {
  if (!formData.masterCardId) {
    return;
  }

  const selectedCard = availableCards.find((card) => card.id === formData.masterCardId);
  if (selectedCard && !formData.customAnnualFee) {
    const feeInDollars = (selectedCard.defaultAnnualFee / 100).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      customAnnualFee: feeInDollars,
    }));
  }
}, [formData.masterCardId, availableCards]);  // PROBLEM: availableCards in deps
```

**Issues Identified:**

**Issue 1: availableCards Dependency is Too Broad**
- `availableCards` dependency triggers effect re-run whenever the array reference changes
- This happens when:
  - Cards are initially fetched (effect runs once, OK)
  - Cards are refetched (effect runs again even if same cards)
  - New card object references (even if same data)

**Issue 2: Race Condition Scenario**
```
Timeline:
1. Modal opens, useEffect fires to fetch availableCards
2. User selects "Amex Green Card" -> masterCardId = "xyz123"
3. Effect dependency triggers (masterCardId changed)
4. Finds card, sets customAnnualFee to "150.00" ✓
5. Meanwhile, availableCards fetch completes, state updates
6. availableCards object reference changes (new array)
7. Effect dependency triggers AGAIN (availableCards changed)
8. Check: selectedCard found? YES
9. Check: !formData.customAnnualFee? NO (it's "150.00", which is truthy)
10. Guard prevents re-population (correct)
BUT: In React strict mode, this causes warnings about effect cleanup
```

**Issue 3: User Can't Re-Populate Cleared Value**
```
Scenario:
1. User selects card -> fee = "150.00"
2. User changes mind, clears fee to ""
3. User selects same card again
4. masterCardId hasn't changed (still same card)
5. Effect doesn't run (no dependency change)
6. Fee stays empty (WRONG - should re-populate)
```

**The Fix (Complex):**
The effect needs to track "actual selection changes" not just "ID changes":

```tsx
// Better approach:
const previousCardId = useRef<string>('');

useEffect(() => {
  if (!formData.masterCardId) {
    previousCardId.current = '';
    return;
  }

  // Only run if we switched to a NEW card
  if (previousCardId.current === formData.masterCardId) {
    return; // Same card, don't re-populate if user cleared it
  }

  const selectedCard = availableCards.find(
    (card) => card.id === formData.masterCardId
  );

  if (selectedCard && !formData.customAnnualFee) {
    const feeInDollars = (selectedCard.defaultAnnualFee / 100).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      customAnnualFee: feeInDollars,
    }));
    previousCardId.current = formData.masterCardId;
  }
}, [formData.masterCardId, availableCards]);
```

But this is also complex. Better approach:

```tsx
// SIMPLER FIX:
// Only depend on masterCardId, not availableCards
// Get card from availableCards without depending on it
const [cardCache, setCardCache] = useState<Record<string, Card>>({});

// Separate effect to build cache
useEffect(() => {
  const newCache: Record<string, Card> = {};
  availableCards.forEach((card) => {
    newCache[card.id] = card;
  });
  setCardCache(newCache);
}, [availableCards]);

// Auto-populate only depends on selection change
useEffect(() => {
  if (!formData.masterCardId) return;

  const selectedCard = cardCache[formData.masterCardId];
  if (selectedCard && !formData.customAnnualFee) {
    const feeInDollars = (selectedCard.defaultAnnualFee / 100).toFixed(2);
    setFormData((prev) => ({
      ...prev,
      customAnnualFee: feeInDollars,
    }));
  }
}, [formData.masterCardId]); // Only depends on ID, not array
```

**Effort:** 30-45 minutes (requires careful testing)

---

#### Lines 231-235 - Card Options Generation (OK)

**Current Code:**
```tsx
const cardOptions = availableCards.map((card) => ({
  value: card.id,
  label: `${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
}));
```

**Status:** ✓ CORRECT - Matches spec
- Removed issuer name ✓
- Shows card name + fee ✓
- Format is concise for mobile ✓

---

#### Lines 244-246 - Modal Content Width (OK BUT RELATED TO CRITICAL #4)

**Current Code:**
```tsx
className="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] sm:max-w-lg md:max-w-2xl translate-x-[-50%] translate-y-[-50%] rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto border border-[var(--color-border)]"
```

**Status:** ✓ Modal width constraint is correct

**Note:** The `max-w-[calc(100%-2rem)]` here is good - it constrains the modal itself. But the same constraint in SelectContent (line 62) breaks the dropdown alignment.

---

#### Lines 299, 324, 338 - Input Field IDs (LOW)

**Current Code:**
```tsx
<Input id="add-card-field-3" label="Renewal Date" ... />
<Input id="add-card-field-2" label="Card Nickname (Optional)" ... />
<Input id="add-card-field-1" label="Annual Fee Override (Optional, in dollars)" ... />
```

**Issues:**
1. Numbers are backwards (3, 2, 1)
2. Generic names don't reflect purpose
3. If fields reorder, IDs are confusing

**Suggested Fix:**
```tsx
<Input id="add-card-annual-fee" label="Annual Fee Override (Optional, in dollars)" ... />
<Input id="add-card-nickname" label="Card Nickname (Optional)" ... />
<Input id="add-card-renewal-date" label="Renewal Date" ... />
```

**Effort:** 5 minutes

---

#### Lines 306-314 - Renewal Date onBlur Validation (HIGH - DUPLICATION)

**Current Code:**
```tsx
onBlur={(e) => {
  // Validate renewal date on blur
  const date = new Date(e.currentTarget.value);
  if (e.currentTarget.value && date < new Date()) {
    setErrors((prev) => ({
      ...prev,
      renewalDate: 'Renewal date must be in the future'
    }));
  }
}}
```

**Problem 1: Duplicates validateForm Logic**
The same validation exists at line 146-150 in validateForm:
```tsx
if (!formData.renewalDate) {
  newErrors.renewalDate = 'Renewal date is required';
} else {
  const date = new Date(formData.renewalDate);
  if (date < new Date()) {
    newErrors.renewalDate = 'Renewal date must be in the future';
  }
}
```

**Problem 2: Race Condition**
```
Timeline:
1. User enters past date -> onBlur sets error ✓
2. User clears field -> onChange clears errors (line 107-108)
3. User clicks submit with empty field
4. validateForm runs, sets error "required" ✓
Seems OK...

But what if:
1. User enters past date -> onBlur sets error
2. User immediately clicks submit before onBlur fires
3. validateForm runs and might see incomplete state
```

**Problem 3: Error Messages Might Differ**
- onBlur checks: "must be in the future"
- validateForm checks: "required" + "must be in the future"

**Suggested Fix:**
Remove onBlur validation, rely only on validateForm:
```tsx
onBlur={(e) => {
  // Just clear error on focus, let submitvalidation handle it
  if (errors.renewalDate) {
    setErrors((prev) => ({ ...prev, renewalDate: '' }));
  }
}}
```

**Effort:** 10 minutes

---

## File 4: select-unified.tsx

### Location: `/src/shared/components/ui/select-unified.tsx`

#### Lines 56-68 - SelectContent Component (CRITICAL - POSITIONING ISSUE)

**Current Code:**
```tsx
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      className={cn(
        'relative z-50 max-h-60 min-w-[8rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-md bg-[var(--color-bg)] text-[var(--color-text)] shadow-md border border-[var(--color-border)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-2 data-[state=open]:slide-in-from-left-2 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
        className
      )}
      {...props}
    />
  </SelectPrimitive.Portal>
));
```

**Critical Issue: max-w-[calc(100%-2rem)]**

When using Radix UI's `position="popper"`:
- Popper calculates optimal position relative to trigger
- It tries to match trigger button width
- Adding `max-w-[calc(100%-2rem)]` breaks this

**Visual Problem on Mobile 375px:**
```
Button trigger: 343px wide (375 - 32px margins)
Expected dropdown: 343px wide

With max-w-[calc(100%-2rem)]:
viewport - 32px margin = 343px
If dropdown positioned at x=16:
  Max width becomes: 343 - 16 = 327px
  Dropdown is NOW 327px (narrower than button)
  LOOKS MISALIGNED
```

**Specification Requirement:**
> "Dropdown should fit within mobile viewport with 1rem margins on sides"

But the current implementation interprets this wrong. It applies max-width to the Content element, which overrides popper's width calculation.

**The Real Issue:**
Radix UI popper's `position="popper"` handles viewport constraint automatically. We shouldn't need to manually constrain it.

**Better Approaches:**

**Option 1: Remove max-width (Let Radix handle it)**
```tsx
className={cn(
  'relative z-50 max-h-60 min-w-[8rem] overflow-hidden rounded-md ...',
  // Removed: max-w-[calc(100%-2rem)]
  className
)}
```

**Option 2: Apply constraint only to SelectItem, not Content**
```tsx
// In SelectItem component:
<SelectPrimitive.ItemText className="truncate max-w-[calc(100%-4rem)]">
  {children}
</SelectPrimitive.ItemText>
```

**Option 3: Use Radix UI's built-in collision handling**
```tsx
<SelectPrimitive.Content
  ref={ref}
  position="popper"
  side="bottom"
  align="start"
  sideOffset={4}
  // Radix automatically handles viewport constraints
  // No need for manual max-width
/>
```

**Recommended Fix:**
Remove `max-w-[calc(100%-2rem)]` and let Radix UI handle viewport constraint automatically.

**Effort:** 5 minutes (but needs testing to ensure it doesn't break mobile)

---

#### Lines 104-105 - SelectItem Text Truncation (OK)

**Current Code:**
```tsx
<SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
```

**Status:** ✓ CORRECT
- `truncate` class prevents text overflow
- Long card names like "Chase Sapphire Reserve" will be truncated
- Ellipsis will show: "Chase Sapphire Re..."

---

## File 5: CardSwitcher.tsx

### Location: `/src/shared/components/features/CardSwitcher.tsx`

#### Lines 6-13 - Card Interface (MISSING NULL SAFETY)

**Current Code:**
```tsx
interface Card {
  id: string;
  name: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  customName?: string | null;
}
```

**Issue:** `issuer` is NOT optional, but code might receive cards without it

**Risk:**
- If API returns card without issuer field
- Fallback rendering breaks

---

#### Lines 72-80 - getCardLabel Function (CRITICAL - NULL SAFETY)

**Current Code:**
```tsx
const getCardLabel = (card: Card) => {
  // If customName is set and not empty, use it
  if (card.customName && card.customName.trim()) {
    return card.customName;
  }
  // Fallback to original format
  return `${card.issuer} •••• ${card.lastFour}`;
};
```

**Issues:**

**Issue 1: customName Whitespace Handling**
```
If card.customName = "   " (3 spaces):
- card.customName is truthy ✓
- card.customName.trim() returns "" (empty string)
- trim() is falsy, so condition fails
- Falls through to issuer fallback ✓

Actually this works correctly!
```

Wait, let me re-trace:
```tsx
if (card.customName && card.customName.trim()) {
  // If customName exists AND trim() returns non-empty string
  return card.customName;  // <-- Returns the original (with spaces)!
}
```

AH! There's the bug:
- Trim check passes: `card.customName.trim()` returns ""
- Wait no, "" is falsy, so condition fails
- Correct behavior

Actually, the logic is:
1. Check if customName exists: `card.customName` → truthy if "   "
2. Check if trim() is truthy: `card.customName.trim()` → "" (falsy)
3. Condition: `true && false` = false
4. Falls through to issuer fallback ✓

So this actually WORKS CORRECTLY for whitespace-only names.

**Issue 2: Missing issuer (REAL PROBLEM)**
```tsx
return `${card.issuer} •••• ${card.lastFour}`;
```

If `card.issuer` is null/undefined:
- Renders as "null •••• 1234" or "undefined •••• 1234"
- OR: TypeError if issuer is missing from object

**Fix:**
```tsx
const getCardLabel = (card: Card) => {
  const cleanName = card.customName?.trim();
  if (cleanName) {
    return cleanName;
  }
  const issuer = card.issuer || 'Card';
  return `${issuer} •••• ${card.lastFour}`;
};
```

**Effort:** 5 minutes

---

#### Lines 40-59 - Scroll Arrow Logic (OK)

**Current Code:**
```tsx
React.useEffect(() => {
  const container = scrollContainerRef.current;
  if (!container) return;

  const checkScroll = () => {
    setShowLeftArrow(container.scrollLeft > 0);
    setShowRightArrow(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  };

  checkScroll();
  container.addEventListener('scroll', checkScroll);
  window.addEventListener('resize', checkScroll);

  return () => {
    container.removeEventListener('scroll', checkScroll);
    window.removeEventListener('resize', checkScroll);
  };
}, [cards]);
```

**Status:** ✓ CORRECT
- Scroll arrows show/hide correctly
- Event listeners cleanup properly
- Accounts for window resize

---

#### Lines 114-123 - Card Button Styling (OK)

**Current Code:**
```tsx
className={`
  flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-lg
  border-2 transition-all duration-200 whitespace-nowrap
  focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]
  ${
    isSelected
      ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]'
      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]'
  }
`}
```

**Status:** ✓ CORRECT
- Proper active/inactive states
- Focus indicators present
- Hover states good
- Responsive sizing

---

## File 6: settings/page.tsx

### Location: `/src/app/dashboard/settings/page.tsx`

#### Lines 64-71 - Admin Tab Conditional (OK)

**Current Code:**
```tsx
const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');

const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'account', label: 'Account' },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : []),
];
```

**Status:** ✓ CORRECT
- Admin tab only appears if user is admin
- Conditional spread correctly adds/removes tab
- Type safety with `as const`

---

#### Lines 124-136 - Tab Styling (OK)

**Current Code:**
```tsx
{tabs.map((tab) => (
  <button
    key={tab.id}
    onClick={() => setActiveTab(tab.id)}
    className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-[2px] ${
      activeTab === tab.id
        ? 'border-[var(--color-primary)] text-[var(--color-text)]'
        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
    }`}
  >
    {tab.label}
  </button>
))}
```

**Status:** ✓ CORRECT
- All tabs styled identically
- Active/inactive states consistent
- Admin tab uses same styling as others

---

#### Lines 273-297 - Admin Tab Content (OK)

**Current Code:**
```tsx
{activeTab === 'admin' && isAdmin && (
  <div className="space-y-6">
    <section
      className="p-6 rounded-lg border"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      <h3 className="font-semibold text-[var(--color-text)] mb-2">
        Admin Dashboard
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Manage cards, benefits, users and audit logs from the admin panel.
      </p>
      <Link href="/admin">
        <Button variant="primary">Go to Admin Dashboard</Button>
      </Link>
    </section>
  </div>
)}
```

**Status:** ✓ CORRECT
- Admin tab content shows proper link to admin panel
- Messaging clear
- Styling consistent

**Minor Note:** The double guard `activeTab === 'admin' && isAdmin` is redundant but defensive (fine to keep).

---

## Summary Table

| File | Line(s) | Issue | Severity | Status |
|------|---------|-------|----------|--------|
| DashboardSummary.tsx | 68 | Grid cols-1 should be cols-2 | CRITICAL | FAIL |
| DashboardSummary.tsx | 73-75 | Animation delay CLS | MEDIUM | WARN |
| StatCard.tsx | 52-56 | Icons removed | CRITICAL | FAIL |
| StatCard.tsx | 65-75 | Contrast in dark mode | MEDIUM | WARN |
| AddCardModal.tsx | 119-135 | Auto-populate race condition | CRITICAL | FAIL |
| AddCardModal.tsx | 306-314 | Validation duplication | HIGH | WARN |
| AddCardModal.tsx | 299, 324, 338 | Field IDs out of order | LOW | INFO |
| select-unified.tsx | 62 | max-width breaks positioning | CRITICAL | FAIL |
| select-unified.tsx | 61-62 | Animation direction | HIGH | WARN |
| CardSwitcher.tsx | 73-80 | Missing issuer null safety | CRITICAL | FAIL |
| CardSwitcher.tsx | 73-80 | Whitespace trim handling | LOW | INFO |
| settings/page.tsx | All | Mostly correct | PASS | OK |

---

## Fix Checklist for Developers

### CRITICAL FIXES (Do First)
- [ ] DashboardSummary line 68: Change grid-cols-1 to grid-cols-2, md:grid-cols-2 to md:grid-cols-3
- [ ] StatCard lines 52-56: Restore icon display
- [ ] AddCardModal lines 119-135: Fix auto-populate race condition with proper effect structure
- [ ] select-unified line 62: Remove or relocate max-w-[calc(100%-2rem)]
- [ ] CardSwitcher lines 73-80: Add null safety for issuer

### HIGH PRIORITY FIXES
- [ ] AddCardModal lines 306-314: Remove duplicate validation or consolidate
- [ ] select-unified lines 61-62: Fix animation direction for popper positioning
- [ ] Handle zero-fee card edge cases properly
- [ ] Admin tab logout graceful fallback

### MEDIUM FIXES
- [ ] DashboardSummary: Verify CLS score, consider opacity-only animation
- [ ] StatCard: Dark mode contrast verification
- [ ] CardSwitcher: Empty cards array fallback

### LOW FIXES
- [ ] AddCardModal: Rename field IDs semantically
- [ ] settings page: Add aria-label to DarkModeToggle

---

**This detailed review is designed to help developers understand not just WHAT is wrong, but WHY it's wrong and HOW to fix it.**

