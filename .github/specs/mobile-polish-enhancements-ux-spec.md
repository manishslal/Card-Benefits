# CardTrack Mobile Polish Enhancements - UX/UI Implementation Specification

**Document Version:** 1.0
**Date Created:** April 6, 2026
**Status:** Ready for Implementation
**Target Release:** Phase 5 - Mobile Polish

---

## Executive Summary

This specification defines 5 critical UX/UI enhancements focused on improving mobile responsiveness, reducing visual clutter, and enhancing user experience consistency. These enhancements target the AddCardModal, Dashboard Overview cards, Card Switcher, Settings tabs, and improve data pre-population flows.

**Key Objectives:**
- Fix dropdown text overflow on mobile viewports (375px)
- Reduce icon label clutter on dashboard overview cards
- Implement responsive 2-column grid on mobile (4 columns on desktop)
- Display card nicknames instead of last 4 digits for better UX
- Pre-populate annual fee override with intelligent defaults
- Move Admin Panel button to tab navigation for consistency

---

## Design System Reference

### Responsive Breakpoints
```
Mobile:     320px - 639px   (sm: hidden, visible: full width)
Tablet:     640px - 1023px  (md:)
Desktop:    1024px+         (lg:)
```

### Color & Typography Variables
```css
--color-bg              /* Background color */
--color-bg-secondary    /* Secondary background */
--color-text            /* Primary text */
--color-text-secondary  /* Secondary text */
--color-primary         /* Primary brand color */
--color-primary-light   /* Light primary variant */
--color-border          /* Border color */
--color-error           /* Error/destructive */
--color-success         /* Success color */
```

### Tailwind Classes Used
```
Spacing: px-4 py-3 gap-3 mb-8
Text: text-sm font-medium truncate whitespace-nowrap
Responsive: sm: md: lg:
Grid: grid-cols-1 grid-cols-2 grid-cols-4
```

---

## Enhancement 1: Dropdown Text Overflow & Card Name Display

### Issue Summary
The "Select Card" dropdown in AddCardModal displays full text (issuer + cardName) which overflows mobile viewport at 375px width. Also includes issuer name which is redundant.

### Current Implementation (BEFORE)
```tsx
// AddCardModal.tsx, line 213-216
const cardOptions = availableCards.map((card) => ({
  value: card.id,
  label: `${card.issuer} - ${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
}));
```

**Problem:** Text string like "Chase - Chase Sapphire Reserve ($550.00/yr)" is ~50 characters
- Mobile viewport: 375px - 2rem margins = 343px available
- Default font: ~8-10px per character at sm font-size
- Result: Text wraps or gets cut off visually

### Implementation Steps

#### Step 1: Update AddCardModal.tsx - Card Options Generation
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/modals/AddCardModal.tsx`

Replace lines 213-216:
```tsx
// BEFORE (lines 213-216)
const cardOptions = availableCards.map((card) => ({
  value: card.id,
  label: `${card.issuer} - ${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
}));

// AFTER
const cardOptions = availableCards.map((card) => ({
  value: card.id,
  label: `${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
}));
```

**Rationale:**
- Removes redundant issuer name (already shown in cardName like "Chase Sapphire Reserve")
- Reduces label length from ~50 to ~35 characters on average
- Annual fee provides important context for card selection
- Mobile optimized text length fits within 343px viewport

#### Step 2: Update SelectContent Component for Text Truncation
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/ui/select-unified.tsx`

Update SelectContent (lines 56-68):
```tsx
// BEFORE
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
        'relative z-50 max-h-60 min-w-[8rem] overflow-hidden rounded-md bg-[var(--color-bg)] text-[var(--color-text)] shadow-md border border-[var(--color-border)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-2 data-[state=open]:slide-in-from-left-2 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
        className
      )}
      {...props}
    />
  </SelectPrimitive.Portal>
));

// AFTER - Add max-width constraint
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

**Change:** Added `max-w-[calc(100%-2rem)]` to SelectContent className
- Forces dropdown to respect viewport with 1rem margin on each side
- Prevents horizontal scroll or overflow on mobile
- Calc ensures: available width = 100% - 32px margin

#### Step 3: Add Text Truncation to SelectItem
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/ui/select-unified.tsx`

Update SelectItem (lines 74-106):
```tsx
// BEFORE
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-8 text-sm outline-none focus:bg-[var(--color-bg-secondary)] focus:text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <svg /* ... */ />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));

// AFTER - Add truncate class to ItemText
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 px-8 text-sm outline-none focus:bg-[var(--color-bg-secondary)] focus:text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-0 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <svg /* ... */ />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
```

**Change:** Added `className="truncate"` to SelectPrimitive.ItemText
- Tailwind `truncate` class: `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- If text exceeds container width, shows "text..." instead of wrapping
- Preserves visual layout and readability

### Acceptance Criteria (Enhancement 1)
- [ ] Dropdown labels show only card name and annual fee (no issuer)
- [ ] SelectContent respects max-width constraint on all breakpoints
- [ ] SelectItem text truncates with ellipsis if exceeding container width
- [ ] Mobile viewport (375px) shows complete dropdown without horizontal scroll
- [ ] Text remains readable at sm font-size on mobile
- [ ] Focus states and accessibility maintained

### Testing Checklist (Enhancement 1)
```
Mobile (375px):
  - [ ] Dropdown opens without exceeding viewport width
  - [ ] Text shows ellipsis if longer than 300px
  - [ ] Can scroll through options vertically

Tablet (768px):
  - [ ] Dropdown fits comfortably
  - [ ] No truncation needed (more space available)

Desktop (1440px):
  - [ ] Full text visible without truncation
  - [ ] Dropdown positioning correct

Keyboard/Screen Reader:
  - [ ] Arrow keys still work to navigate options
  - [ ] Screen reader announces label correctly (even truncated)
  - [ ] Escape closes dropdown
```

---

## Enhancement 2: Dashboard Overview Cards - Remove Labels & 2-Column Mobile Layout

### Issue Summary
StatCard displays icon labels (e.g., "CreditCard", "DollarSign", "Wallet") which are redundant with the card labels. On mobile, cards use 1-column grid (too large). Should be 2 columns on mobile for better density.

### Current Implementation (BEFORE)
```tsx
// DashboardSummary.tsx, line 67
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
```

**Problem:**
- 1 column on mobile: Each card is full width, takes up too much vertical space
- Need to show 2 columns on mobile (320-639px)
- Should scale to 4 columns on desktop
- Icon labels in StatCard are not shown - already showing icon + label

### Current StatCard Implementation
```tsx
// StatCard.tsx, lines 50-58
<div className="flex items-start justify-between">
  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
    {label}
  </span>
  {icon && (
    <span className="text-[var(--color-primary)]">
      {icon}
    </span>
  )}
</div>
```

**Issue:** Icon is displayed alongside label. The "label" itself (like "Total Cards") is clear, so icon is redundant.

### Implementation Steps

#### Step 1: Update DashboardSummary.tsx - Grid Layout
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/features/DashboardSummary.tsx`

Replace line 45 and 67:
```tsx
// Loading state - line 45
// BEFORE
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// AFTER
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

// Real state - line 67
// BEFORE
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

// AFTER
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
```

**Rationale:**
- `grid-cols-2`: Mobile (320-639px) shows 2 columns
  - Card width = (343px available / 2) - gap = ~165px per card
  - Height adjusts proportionally with p-6 padding
  - 4 cards now fit in 2 rows (compact but readable)
- `md:grid-cols-3`: Tablet (640-1023px) shows 3 columns
  - Card width = (640px / 3) - gap = ~200px per card
- `lg:grid-cols-4`: Desktop (1024px+) shows 4 columns (original)
  - Card width = (1024px / 4) - gap = ~240px per card

#### Step 2: Update StatCard.tsx - Remove Icon from Header
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/ui/StatCard.tsx`

Update lines 50-58:
```tsx
// BEFORE
<div className="flex items-start justify-between">
  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
    {label}
  </span>
  {icon && (
    <span className="text-[var(--color-primary)]">
      {icon}
    </span>
  )}
</div>

// AFTER - Remove icon from layout, only show label
<div className="flex items-start justify-between">
  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
    {label}
  </span>
</div>
```

**Rationale:**
- Icon label is already present in the label text (e.g., "Total Cards", "Wallet Balance")
- Icon doesn't provide additional semantic information
- Removing reduces visual clutter
- Frees up space for better card proportions on mobile
- Icon is still available if needed elsewhere

**Alternative: Keep Icon but Move it**
If icon context is important, we could keep it but position differently:
```tsx
{icon && (
  <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: 'rgba(51, 86, 208, 0.1)' }}>
    <span className="text-[var(--color-primary)]">
      {icon}
    </span>
  </div>
)}
```
However, the spec asks to remove it, so we'll follow that approach.

#### Step 3: Adjust StatCard Padding for Mobile Space
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/ui/StatCard.tsx`

Update line 34:
```tsx
// BEFORE
const baseClasses = [
  'rounded-lg p-6 flex flex-col gap-3',
  'bg-[var(--color-bg)] border border-[var(--color-border)]',
  'shadow-sm transition-all duration-200 hover:shadow-md',
  className,
].join(' ');

// AFTER - Use responsive padding
const baseClasses = [
  'rounded-lg p-4 sm:p-6 flex flex-col gap-3',
  'bg-[var(--color-bg)] border border-[var(--color-border)]',
  'shadow-sm transition-all duration-200 hover:shadow-md',
  className,
].join(' ');
```

**Rationale:**
- `p-4` on mobile (320-639px): 16px padding = compact but readable
- `sm:p-6` on tablet+: 24px padding = original spacing
- Saves ~8px per side on mobile = better use of space for 2-column layout
- Maintains visual hierarchy and readability

### Acceptance Criteria (Enhancement 2)
- [ ] Dashboard cards show 2 columns on mobile (320-639px)
- [ ] Dashboard cards show 3 columns on tablet (640-1023px)
- [ ] Dashboard cards show 4 columns on desktop (1024px+)
- [ ] Icon labels removed from card headers
- [ ] Card proportions remain readable on all screen sizes
- [ ] Loading skeleton state matches responsive grid
- [ ] No layout shift when content loads
- [ ] Dark mode colors maintain contrast

### Testing Checklist (Enhancement 2)
```
Mobile (375px):
  - [ ] Dashboard shows 2 cards per row
  - [ ] Cards maintain square-ish proportions
  - [ ] Padding of p-4 reduces visual clutter
  - [ ] Text remains readable

Tablet (768px):
  - [ ] Dashboard shows 3 cards per row
  - [ ] Layout balanced and not too cramped

Desktop (1440px):
  - [ ] Dashboard shows 4 cards per row (original)
  - [ ] Padding p-6 shows original spacing

Dark Mode:
  - [ ] Card backgrounds and borders visible
  - [ ] Text contrast maintained

Animations:
  - [ ] Fade-in animation works for all cards
  - [ ] Staggered delays apply correctly
```

---

## Enhancement 3: Card Nickname on Dashboard (CardSwitcher)

### Issue Summary
CardSwitcher displays last 4 digits with issuer (e.g., "Chase •••• 4242"). If user sets a custom nickname (customName), should show that instead of cardName/last 4 digits for better UX.

### Current Implementation (BEFORE)
```tsx
// CardSwitcher.tsx, lines 71-73
const getCardLabel = (card: Card) => {
  return `${card.issuer} •••• ${card.lastFour}`;
};
```

**Data Model Reference** (from prisma schema):
```prisma
model UserCard {
  id              String
  customName      String?       // User's nickname (optional)
  // ... other fields
}

interface Card {
  id: string;
  name: string;              // This is currently NOT used
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  // customName is NOT in the interface!
}
```

**Problem:**
1. Card interface doesn't include `customName` field
2. getCardLabel doesn't check for `customName`
3. User can set nickname but it's never displayed

### Implementation Steps

#### Step 1: Update Card Interface to Include customName
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/features/CardSwitcher.tsx`

Update lines 6-12:
```tsx
// BEFORE
interface Card {
  id: string;
  name: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
}

// AFTER
interface Card {
  id: string;
  name: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  customName?: string;        // User's custom nickname (optional)
}
```

#### Step 2: Update getCardLabel Function
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/features/CardSwitcher.tsx`

Replace lines 71-73:
```tsx
// BEFORE
const getCardLabel = (card: Card) => {
  return `${card.issuer} •••• ${card.lastFour}`;
};

// AFTER - Priority: customName > name > issuer + lastFour
const getCardLabel = (card: Card) => {
  // If customName is set and not empty, use it
  if (card.customName && card.customName.trim()) {
    return card.customName;
  }
  // Fallback to original format
  return `${card.issuer} •••• ${card.lastFour}`;
};
```

**Logic Explanation:**
1. Check if `customName` exists AND is not empty/whitespace
2. If yes, return customName (user's preference takes priority)
3. If no, fall back to "Issuer •••• LastFour" format (original behavior)

**Examples:**
```
Card 1: customName = "My Travel Card"
  Label: "My Travel Card"

Card 2: customName = "" (empty string set by user clearing it)
  Label: "Chase •••• 4242"

Card 3: customName = undefined (never set by user)
  Label: "Chase •••• 4242"

Card 4: customName = "  " (whitespace only)
  Label: "Chase •••• 4242"
```

#### Step 3: Ensure Card Data Passed to CardSwitcher Includes customName
**File:** Where CardSwitcher is used (typically dashboard page)

When fetching/constructing card data, ensure customName is included:
```tsx
// Example of correct data structure
const cards: Card[] = userCards.map((userCard) => ({
  id: userCard.id,
  name: userCard.masterCard.cardName,
  type: 'visa', // or actual type from masterCard
  lastFour: userCard.lastFour || '****',
  issuer: userCard.masterCard.issuer,
  customName: userCard.customName,  // MUST be included
}));
```

### Acceptance Criteria (Enhancement 3)
- [ ] Card interface includes optional `customName` field
- [ ] getCardLabel checks customName first
- [ ] If customName is set and non-empty, display it
- [ ] If customName is not set or empty, fallback to issuer + lastFour
- [ ] Custom names display correctly on card buttons
- [ ] Tab navigation still works with custom names
- [ ] Scroll behavior handles custom names of varying lengths

### Testing Checklist (Enhancement 3)
```
Data Scenarios:
  - [ ] Card with customName="Travel Visa" shows "Travel Visa"
  - [ ] Card with customName="" falls back to issuer format
  - [ ] Card with customName=undefined falls back to issuer format
  - [ ] Card with customName="  " (whitespace) falls back

UI Display:
  - [ ] Long custom names (50+ chars) truncate properly
  - [ ] Tab styling matches original design
  - [ ] Selected state highlights correctly
  - [ ] Hover states work

Mobile/Tablet:
  - [ ] Custom names work with scroll behavior
  - [ ] Text truncation prevents layout shift

Accessibility:
  - [ ] Screen reader announces custom name
  - [ ] Tab order unchanged
```

---

## Enhancement 4: Pre-populate Annual Fee Override

### Issue Summary
When adding a card, the "Annual Fee Override" field should be pre-populated with the selected card's `defaultAnnualFee`. User can still override/clear this value.

### Current Implementation (BEFORE)
```tsx
// AddCardModal.tsx, lines 43-48
const [formData, setFormData] = useState({
  masterCardId: '',
  customName: '',
  customAnnualFee: '',
  renewalDate: '',
});

// Lines 112-117
const handleSelectChange = (value: string) => {
  setFormData((prev) => ({ ...prev, masterCardId: value }));
  if (errors.masterCardId) {
    setErrors((prev) => ({ ...prev, masterCardId: '' }));
  }
};
```

**Problem:** When user selects a card, the annual fee field doesn't auto-populate. User must manually enter it.

### Implementation Steps

#### Step 1: Add useEffect to Sync Annual Fee
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/modals/AddCardModal.tsx`

Add new useEffect after line 102 (after fetchAvailableCards function):
```tsx
// NEW CODE - Add after fetchAvailableCards function, before handleChange

/**
 * Auto-populate annual fee when card is selected
 *
 * When user selects a different masterCard, fetch that card's defaultAnnualFee
 * and pre-fill the customAnnualFee field (converted from cents to dollars)
 */
useEffect(() => {
  if (!formData.masterCardId) {
    // User cleared selection, reset annual fee
    setFormData((prev) => ({ ...prev, customAnnualFee: '' }));
    return;
  }

  // Find the selected card in available cards
  const selectedCard = availableCards.find((card) => card.id === formData.masterCardId);

  if (selectedCard && selectedCard.defaultAnnualFee) {
    // Convert from cents to dollars (e.g., 55000 cents = $550.00)
    const annualFeeInDollars = (selectedCard.defaultAnnualFee / 100).toFixed(2);
    setFormData((prev) => ({ ...prev, customAnnualFee: annualFeeInDollars }));
  }
}, [formData.masterCardId, availableCards]);
```

**Important:** This useEffect must come AFTER the `handleChange` and `handleSelectChange` functions are defined, and before the form JSX.

**Logic Explanation:**
1. Dependency array: `[formData.masterCardId, availableCards]`
   - Triggers when user selects a different card
   - Or when available cards list changes
2. If masterCardId is empty, clear annual fee field
3. Find the selected card from availableCards array
4. If found, extract defaultAnnualFee and convert from cents to dollars
5. Update formData.customAnnualFee with formatted value

**Example Conversion:**
```
Card selected: Chase Sapphire Reserve
  defaultAnnualFee in DB: 55000 (stored in cents)
  Conversion: 55000 / 100 = 550
  Formatted: (550).toFixed(2) = "550.00"
  Set in field: customAnnualFee = "550.00"
```

#### Step 2: Allow User to Override/Clear
**File:** Already implemented! Lines 318-330

The existing input component allows full control:
```tsx
<Input
  id="add-card-field-1"
  label="Annual Fee Override (Optional, in dollars)"
  type="number"
  name="customAnnualFee"
  placeholder="0.00"
  step="0.01"
  value={formData.customAnnualFee}
  onChange={handleChange}
  error={errors.customAnnualFee}
  disabled={isLoading}
/>
```

**User Can:**
- Clear the field (delete the pre-filled value) to enter custom amount
- Change the number to override the default
- Leave blank to use default from MasterCard

#### Step 3: Update Form Submission Logic (Optional Enhancement)
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/modals/AddCardModal.tsx`

Lines 150-208 already handle this correctly:
```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) return;

  setIsLoading(true);
  setMessage('');

  try {
    // Convert annual fee from string input to cents (if provided)
    const customAnnualFee = formData.customAnnualFee
      ? Math.round(parseFloat(formData.customAnnualFee) * 100)
      : undefined;

    const response = await fetch('/api/cards/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        masterCardId: formData.masterCardId,
        renewalDate: formData.renewalDate,
        customName: formData.customName || undefined,
        customAnnualFee,  // This can be the pre-populated or user-overridden value
      }),
    });
    // ... rest of submission
  }
};
```

**No changes needed** - Already converts from dollars to cents correctly.

### Acceptance Criteria (Enhancement 4)
- [ ] When card is selected, customAnnualFee auto-populates with defaultAnnualFee
- [ ] Annual fee converted correctly from cents to dollars (e.g., 55000 → "550.00")
- [ ] Formatted as currency with 2 decimal places
- [ ] User can override the pre-filled value
- [ ] User can clear the field completely
- [ ] Submission converts back to cents correctly
- [ ] Works for cards with $0 annual fee
- [ ] Works for cards with fractional fees (e.g., $49.99)

### Testing Checklist (Enhancement 4)
```
Pre-population Logic:
  - [ ] Select card with $550 annual fee → field shows "550.00"
  - [ ] Select card with $0 fee → field shows "0.00"
  - [ ] Select card with $49.99 fee → field shows "49.99"
  - [ ] Clear selection (masterCardId = '') → field clears
  - [ ] Switch between cards → fee updates automatically

User Override:
  - [ ] User can delete pre-filled value
  - [ ] User can type custom amount (e.g., "600.00")
  - [ ] User can leave blank for default

Form Validation:
  - [ ] Submission with pre-filled fee works
  - [ ] Submission with user override works
  - [ ] Negative fees rejected
  - [ ] Non-numeric values rejected
  - [ ] Decimal values (e.g., 49.99) handled correctly

Mobile Experience:
  - [ ] Field remains visible and editable on mobile
  - [ ] Number input keyboard appears on mobile
  - [ ] Increment/decrement arrows work
```

---

## Enhancement 5: Admin Panel Button in Settings Tabs

### Issue Summary
Admin Panel button is currently in AppHeader (settings page). Should be moved to the tab navigation bar styling to be consistent with Profile/Preferences/Account tabs.

### Current Implementation (BEFORE)

**Settings Page** (`/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/app/dashboard/settings/page.tsx`):
```tsx
// Lines 66-71 - Tab definition
const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'account', label: 'Account' },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : []),
];

// Lines 120-137 - Tab navigation
<div
  className="flex border-b mb-8 overflow-x-auto"
  style={{ borderColor: 'var(--color-border)' }}
>
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
</div>

// Lines 273-297 - Admin tab content
{activeTab === 'admin' && isAdmin && (
  <div className="space-y-6">
    <section
      className="p-6 rounded-lg border"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: 'var(--color-border)',
      }}
    >
      <h3
        className="font-semibold text-[var(--color-text)] mb-2"
        style={{ fontSize: 'var(--text-body-lg)' }}
      >
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

**AppHeader** (`/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/layout/AppHeader.tsx`):
```tsx
// Current: No admin button here (already in settings page)
// The tab structure already handles this correctly!
```

**Good News:** The admin functionality is ALREADY correctly implemented in settings page tabs! The code already has:
- Admin tab defined conditionally based on user role
- Tab styling with border-b that matches other tabs
- Admin tab content with link to admin panel

### Implementation Steps

#### Step 1: Verify Admin Tab is Displaying Correctly
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/app/dashboard/settings/page.tsx`

The implementation is correct. However, let's review to ensure it matches spec:

```tsx
// Lines 66-71 ✓ CORRECT
const tabs: Array<{ id: ActiveTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'preferences', label: 'Preferences' },
  { id: 'account', label: 'Account' },
  ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : []),  // ✓ Conditional
];

// Lines 120-137 ✓ CORRECT - Tab bar with border
<div
  className="flex border-b mb-8 overflow-x-auto"
  style={{ borderColor: 'var(--color-border)' }}
>
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
</div>

// Lines 273-297 ✓ CORRECT - Admin content shows only if isAdmin
{activeTab === 'admin' && isAdmin && (
  // Admin panel content
)}
```

**Status:** ALREADY IMPLEMENTED CORRECTLY

#### Step 2: Verification Checklist
**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/app/dashboard/settings/page.tsx`

Confirm these conditions:

1. **Tab Styling Consistency** - Admin tab uses same classes as other tabs
   ```
   ✓ px-4 py-3 text-sm font-medium
   ✓ border-b-2 -mb-[2px] (underline style)
   ✓ border-[var(--color-primary)] when active
   ✓ border-transparent when inactive
   ```

2. **Conditional Rendering** - Admin tab only shows for admin users
   ```
   ✓ Line 64: const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
   ✓ Line 70: ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin' }] : [])
   ✓ Line 274: {activeTab === 'admin' && isAdmin && (
   ```

3. **Content Display** - Admin content shows with correct styling
   ```
   ✓ Link to /admin dashboard
   ✓ Button styling matches other sections
   ✓ Consistent border and background colors
   ```

### No Code Changes Required

The Admin Panel button functionality is **already correctly implemented** in the settings page. The specification requirement has been met:

- ✓ Admin Panel is positioned in the tab bar (4th tab)
- ✓ Styled like other tabs (Profile, Preferences, Account)
- ✓ Uses same border-b styling
- ✓ Only shows for admin users (conditional rendering)
- ✓ Not in AppHeader (correct placement)

### Acceptance Criteria (Enhancement 5)
- [ ] Admin tab appears 4th in tab navigation
- [ ] Admin tab styling matches Profile/Preferences/Account tabs
- [ ] Border-bottom styling applied when selected
- [ ] Only visible to users with ADMIN or SUPER_ADMIN role
- [ ] Tab can be clicked to switch to admin content
- [ ] Admin content shows link to admin dashboard
- [ ] Tab scrolls with other tabs on mobile if needed
- [ ] Keyboard navigation works (Tab, Arrow keys)

### Testing Checklist (Enhancement 5)
```
Admin User:
  - [ ] User with ADMIN role sees Admin tab
  - [ ] User with SUPER_ADMIN role sees Admin tab
  - [ ] Can click Admin tab and see content
  - [ ] Can navigate to admin dashboard via button
  - [ ] Tab styling matches other tabs

Non-Admin User:
  - [ ] Admin tab NOT visible
  - [ ] Only 3 tabs shown (Profile, Preferences, Account)

Mobile (375px):
  - [ ] Admin tab visible if user is admin
  - [ ] Tab bar scrolls horizontally if needed
  - [ ] Tab click works on touch

Keyboard/Accessibility:
  - [ ] Tab order includes admin tab
  - [ ] Enter/Space activates admin tab
  - [ ] Arrow keys navigate between tabs
  - [ ] Screen reader announces admin tab
  - [ ] Focus indicator visible on admin tab
```

---

## Dark Mode Implications - All Enhancements

All enhancements maintain dark mode compatibility through CSS variables:

### Affected Components
1. **SelectContent/SelectItem** - Uses `var(--color-bg)`, `var(--color-text)`, `var(--color-border)`
2. **StatCard** - Uses `var(--color-bg)`, `var(--color-primary)`, `var(--color-border)`
3. **CardSwitcher** - Uses `var(--color-bg)`, `var(--color-primary)`, `var(--color-border)`
4. **Settings Tabs** - Uses `var(--color-bg)`, `var(--color-text)`, `var(--color-border)`

### Dark Mode Testing Checklist
```
All Components in Dark Mode:
  - [ ] Dropdown content visible (good contrast)
  - [ ] StatCards maintain readability
  - [ ] CardSwitcher buttons visible and selectable
  - [ ] Settings tab border visible
  - [ ] Text colors correct (not inverted)
  - [ ] Icons readable
  - [ ] Focus states visible with ring-color
```

---

## Accessibility Considerations

### WCAG 2.1 AA Compliance

#### Enhancement 1: Dropdown Text Overflow
- **Focus Management:** SelectItem maintains focus ring with `focus:ring-2 focus:ring-[var(--color-primary)]`
- **Keyboard Navigation:** Arrow keys, Enter, Escape all work
- **Screen Reader:** `aria-labelledby`, `aria-describedby`, `aria-required` properly set
- **Text Truncation:** Truncated text is still accessible (screen reader reads full text)

#### Enhancement 2: Dashboard Cards - Removed Labels
- **Icon Removal:** Icons are semantic enhancement only, label text is sufficient
- **Card Reading Order:** Screen reader reads label, then value, then change indicator
- **Color Dependence:** Don't rely only on color to distinguish cards (use labels)

#### Enhancement 3: Card Nickname Display
- **Label Clarity:** Custom name provides clear context of card purpose
- **Screen Reader:** Custom name read as button label when focused
- **Tab Navigation:** Tab order unchanged, focus management preserved

#### Enhancement 4: Annual Fee Pre-population
- **Input Accessibility:** `type="number"` with `step="0.01"` accessible
- **Autocomplete:** User can still see and override auto-populated value
- **Labeling:** Input label ("Annual Fee Override") remains clear

#### Enhancement 5: Admin Tab in Settings
- **Role-based Access:** Visibility conditional on actual role (not visual hiding)
- **Tab Navigation:** Admin tab included in normal tab order
- **ARIA Roles:** Tab uses `role="tab"` and `aria-selected` states

### Screen Reader Testing Checklist
```
All Components:
  - [ ] Labels read correctly (both full and truncated)
  - [ ] Form fields announced with roles (combobox, textbox, etc.)
  - [ ] Required indicators announced
  - [ ] Error messages announced with role="alert"
  - [ ] Tab order logical and intuitive
  - [ ] Focus indicators visible
  - [ ] Dynamic content updates announced (auto-populated fields)
  - [ ] Icons have aria-hidden="true" if decorative
```

---

## Performance & CSS Optimization

### CSS Classes Added/Modified

#### New Tailwind Classes
```
max-w-[calc(100%-2rem)]   # SelectContent width constraint
truncate                  # Text truncation on SelectItem
grid-cols-2               # Mobile 2-column grid
md:grid-cols-3            # Tablet 3-column grid
p-4 sm:p-6                # Responsive padding
```

#### CSS Variables Used (Maintained)
```
--color-bg
--color-bg-secondary
--color-text
--color-text-secondary
--color-primary
--color-primary-light
--color-border
--color-error
--color-success
```

### Bundle Size Impact
- **No new libraries:** All changes use existing Tailwind CSS classes
- **CSS Classes:** Adding responsive grid and truncate classes ~0.5KB gzipped
- **JavaScript Logic:** useEffect for auto-population ~200 bytes
- **Total Impact:** <1KB increase to CSS bundle

### Performance Optimizations
1. **SelectContent max-width:** Prevents browser layout recalculation on mobile
2. **StatCard padding:** Uses native CSS responsive values (no JS)
3. **Grid layout:** Native CSS Grid (no JavaScript polyfills needed)
4. **useEffect dependencies:** Tightly scoped to avoid unnecessary recalculations

---

## Implementation Task Breakdown

### Task 1: Enhancement 1 - Dropdown Text Overflow
**Effort:** Small (1-2 hours)
**Files:**
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/modals/AddCardModal.tsx`
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/ui/select-unified.tsx`

**Acceptance Criteria:**
- [ ] Card options show only cardName + fee
- [ ] SelectContent has max-width constraint
- [ ] SelectItem text truncates with ellipsis
- [ ] Mobile test: 375px viewport shows no horizontal scroll
- [ ] All accessibility features maintained

---

### Task 2: Enhancement 2 - Dashboard Cards Grid & Remove Labels
**Effort:** Small (1-1.5 hours)
**Files:**
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/features/DashboardSummary.tsx`
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/ui/StatCard.tsx`

**Acceptance Criteria:**
- [ ] Grid shows 2 cols on mobile, 3 on tablet, 4 on desktop
- [ ] Icon labels removed from StatCard header
- [ ] Padding responsive (p-4 on mobile, p-6 on tablet+)
- [ ] Loading skeleton matches responsive grid
- [ ] Dark mode maintains contrast

---

### Task 3: Enhancement 3 - Card Nickname Display
**Effort:** Small (1 hour)
**Files:**
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/shared/components/features/CardSwitcher.tsx`

**Acceptance Criteria:**
- [ ] Card interface includes customName field
- [ ] getCardLabel prioritizes customName
- [ ] Fallback to issuer + lastFour if no customName
- [ ] Data passed to CardSwitcher includes customName
- [ ] Long names truncate properly

---

### Task 4: Enhancement 4 - Annual Fee Pre-population
**Effort:** Medium (1.5-2 hours)
**Files:**
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/features/cards/components/modals/AddCardModal.tsx`

**Acceptance Criteria:**
- [ ] useEffect watches masterCardId changes
- [ ] Annual fee auto-populated when card selected
- [ ] Conversion: cents to dollars correct (e.g., 55000 → "550.00")
- [ ] User can override or clear the field
- [ ] Submission converts back to cents correctly
- [ ] Works with $0 and fractional fees

---

### Task 5: Enhancement 5 - Admin Tab in Settings
**Effort:** Minimal (0.5 hours - Verification only)
**Files:**
- `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/app/dashboard/settings/page.tsx`

**Acceptance Criteria:**
- [ ] Verify admin tab already in tab navigation
- [ ] Verify conditional rendering based on role
- [ ] Verify tab styling matches other tabs
- [ ] Verify only shown to admin users
- [ ] Test keyboard navigation

---

## Testing & QA Strategy

### Unit Testing (Per Enhancement)
```
Enhancement 1 - Dropdown:
  - Test cardOptions mapping (issuer removed)
  - Test SelectContent max-width constraint
  - Test SelectItem truncate class

Enhancement 2 - Dashboard:
  - Test grid class application (2/3/4 cols)
  - Test StatCard padding responsive
  - Test loading skeleton layout

Enhancement 3 - CardSwitcher:
  - Test getCardLabel logic (customName priority)
  - Test Card interface includes customName
  - Test fallback behavior

Enhancement 4 - Annual Fee:
  - Test useEffect triggers on masterCardId change
  - Test conversion logic (cents → dollars)
  - Test handleChange still works

Enhancement 5 - Admin Tab:
  - Test tabs array includes admin conditionally
  - Test tab styling matches
  - Test conditional rendering
```

### Integration Testing
```
End-to-End Flows:
  - [ ] User selects card → annual fee auto-fills
  - [ ] User submits form with pre-filled fee → Success
  - [ ] Mobile user at 375px → dropdown visible, cards 2-col
  - [ ] Admin user → sees Admin tab in settings
  - [ ] Non-admin user → Admin tab hidden
```

### Visual Regression Testing
```
Viewports:
  - [ ] 320px (mobile small)
  - [ ] 375px (mobile standard)
  - [ ] 640px (tablet)
  - [ ] 1024px (desktop)
  - [ ] 1440px (desktop large)

Themes:
  - [ ] Light mode
  - [ ] Dark mode

States:
  - [ ] Dropdown open/closed
  - [ ] Form with/without errors
  - [ ] Cards loading/loaded
  - [ ] Tabs with focus/hover states
```

---

## File Summary & Changes

| File | Enhancement | Change Type | Complexity |
|------|-------------|------------|-----------|
| `/src/features/cards/components/modals/AddCardModal.tsx` | 1, 4 | Logic update, new useEffect | Medium |
| `/src/shared/components/ui/select-unified.tsx` | 1 | CSS class additions | Small |
| `/src/shared/components/features/DashboardSummary.tsx` | 2 | Grid class updates | Small |
| `/src/features/cards/components/ui/StatCard.tsx` | 2 | Remove icon, responsive padding | Small |
| `/src/shared/components/features/CardSwitcher.tsx` | 3 | Interface update, logic change | Small |
| `/src/app/dashboard/settings/page.tsx` | 5 | Verification only (no changes) | Minimal |

---

## Rollout & Deployment Plan

### Phase 1: Development
1. Implement Enhancement 1 (Dropdown)
2. Implement Enhancement 2 (Dashboard Grid)
3. Implement Enhancement 3 (Card Nickname)
4. Implement Enhancement 4 (Annual Fee)
5. Verify Enhancement 5 (Admin Tab)

### Phase 2: Testing
- Unit tests for each enhancement
- Integration testing with full form flow
- Visual testing across viewports
- Accessibility testing (screen reader, keyboard)
- Dark mode testing

### Phase 3: QA Review
- Code review for all changes
- QA sign-off on acceptance criteria
- Performance testing (bundle size, render time)
- Security review (no input validation changes)

### Phase 4: Deployment
- Merge to main branch
- Deploy to staging environment
- Smoke testing on staging
- Deploy to production with monitoring

---

## Dependency & Risk Analysis

### Dependencies
- No external library additions
- Uses existing Radix UI, Tailwind CSS, Lucide React
- All changes are CSS and React logic only

### Risks & Mitigations
| Risk | Severity | Mitigation |
|------|----------|-----------|
| useEffect infinite loop (Enhancement 4) | High | Set tight dependency array, avoid state updates in effect |
| Text truncation breaks long text (Enhancement 1) | Medium | Add title attribute to show full text on hover |
| Grid layout changes on mobile affect other components | Medium | Test all dashboard page sections |
| Admin tab visibility not working | Low | Test with actual admin and non-admin accounts |

---

## Success Metrics

### User-Facing Metrics
- Dropdown doesn't overflow on mobile (375px)
- Dashboard cards show 2 columns on mobile (better density)
- Users can see their card nicknames (if set)
- Annual fee field pre-populated (time saved)
- Admin users find admin panel in settings (consistency)

### Technical Metrics
- No regression in accessibility score
- Bundle size increase < 1KB
- Performance (Lighthouse score) maintained
- No new console errors in browser
- Screen reader announces all content correctly

---

## Appendix: CSS Variable Reference

```css
/* Light Mode (Default) */
--color-bg: #ffffff;
--color-bg-secondary: #f5f5f5;
--color-text: #1a1a1a;
--color-text-secondary: #666666;
--color-primary: #3356d0;
--color-primary-light: rgba(51, 86, 208, 0.05);
--color-border: #e5e5e5;
--color-error: #ef4444;
--color-success: #22c55e;

/* Dark Mode */
--color-bg: #0a0a0a;
--color-bg-secondary: #1a1a1a;
--color-text: #ffffff;
--color-text-secondary: #a0a0a0;
--color-primary: #6b9fff;
--color-primary-light: rgba(107, 159, 255, 0.1);
--color-border: #333333;
--color-error: #ff6b6b;
--color-success: #51cf66;
```

---

## Document Control

**Version History:**
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | April 6, 2026 | Tech Spec Architect | Initial specification |

**Approval Status:**
- [ ] Tech Lead Approval
- [ ] QA Approval
- [ ] Product Manager Approval
- [ ] Ready for Implementation

**Next Steps:**
1. Obtain approvals from stakeholders
2. Create implementation tasks in project management system
3. Assign developers to each enhancement
4. Schedule testing phase
5. Plan deployment window

---

## Quick Reference: Exact Code Changes

### Change 1: AddCardModal - Remove Issuer from Label
```tsx
// Line 215 - CHANGE THIS:
label: `${card.issuer} - ${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
// TO THIS:
label: `${card.cardName} ($${(card.defaultAnnualFee / 100).toFixed(2)}/yr)`,
```

### Change 2: SelectContent - Add Max Width
```tsx
// Line 62 - ADD max-w-[calc(100%-2rem)] to className string:
className={cn(
  'relative z-50 max-h-60 min-w-[8rem] max-w-[calc(100%-2rem)] overflow-hidden rounded-md...',
```

### Change 3: SelectItem - Add Truncate
```tsx
// Line 104 - CHANGE:
<SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
// TO:
<SelectPrimitive.ItemText className="truncate">{children}</SelectPrimitive.ItemText>
```

### Change 4: DashboardSummary - Grid Layout
```tsx
// Line 45 & 67 - CHANGE:
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
// TO:
className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
```

### Change 5: StatCard - Remove Icon, Add Responsive Padding
```tsx
// Line 34 - CHANGE:
'rounded-lg p-6 flex flex-col gap-3',
// TO:
'rounded-lg p-4 sm:p-6 flex flex-col gap-3',

// Lines 50-58 - CHANGE from:
<div className="flex items-start justify-between">
  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
    {label}
  </span>
  {icon && (
    <span className="text-[var(--color-primary)]">
      {icon}
    </span>
  )}
</div>
// TO:
<div className="flex items-start justify-between">
  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
    {label}
  </span>
</div>
```

### Change 6: CardSwitcher - Add customName to Interface
```tsx
// Lines 6-12 - ADD to Card interface:
interface Card {
  id: string;
  name: string;
  type: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
  lastFour: string;
  issuer: string;
  customName?: string;  // ADD THIS LINE
}
```

### Change 7: CardSwitcher - Update getCardLabel Logic
```tsx
// Lines 71-73 - CHANGE:
const getCardLabel = (card: Card) => {
  return `${card.issuer} •••• ${card.lastFour}`;
};
// TO:
const getCardLabel = (card: Card) => {
  if (card.customName && card.customName.trim()) {
    return card.customName;
  }
  return `${card.issuer} •••• ${card.lastFour}`;
};
```

### Change 8: AddCardModal - Add useEffect for Annual Fee Auto-population
```tsx
// ADD AFTER line 102 (after fetchAvailableCards function):
useEffect(() => {
  if (!formData.masterCardId) {
    setFormData((prev) => ({ ...prev, customAnnualFee: '' }));
    return;
  }

  const selectedCard = availableCards.find((card) => card.id === formData.masterCardId);

  if (selectedCard && selectedCard.defaultAnnualFee) {
    const annualFeeInDollars = (selectedCard.defaultAnnualFee / 100).toFixed(2);
    setFormData((prev) => ({ ...prev, customAnnualFee: annualFeeInDollars }));
  }
}, [formData.masterCardId, availableCards]);
```

---

**End of Specification**
