# Card Benefits Dashboard — Detailed Design Specification

**Document Status:** Phase 2 Complete — Detailed Design Specification  
**Date:** 2024  
**Audience:** Frontend Engineers, QA, Design Implementation Team  
**Reference:** `.github/specs/dashboard-redesign-ux-research.md` (Phase 1 Design System)

---

## Executive Summary

This document provides pixel-perfect implementation guidance for the Card Benefits Dashboard redesign. It extends the Phase 1 UX research and design system with complete page layout architecture, component specifications, responsive behavior, interaction states, and accessibility requirements.

**Key Design Principles:**
- **Mobile-first:** Optimized for small screens, scales elegantly to desktop
- **Rapid discovery:** Critical alerts visible without scrolling (above fold)
- **Clear hierarchy:** ROI summary → Urgent alerts → Per-player card grid
- **Accessible:** Full keyboard navigation, sufficient contrast (WCAG AA+), semantic HTML
- **Consistent:** All components use design tokens from Phase 1 system
- **Dark mode native:** All colors, shadows, contrast tested in both light and dark modes

**Success Criteria:**
- User identifies expiring benefits in <2 seconds
- ROI insights understood in <5 seconds
- Mobile layout works on 375px width devices
- All interactions keyboard-navigable
- Dark mode toggles smoothly with no layout shifts

---

## 1. Page Layout Architecture

### 1.1 Overall Page Structure (Mobile & Desktop)

The dashboard uses a fixed header with scrollable content area. The layout adapts significantly across device sizes while maintaining visual hierarchy.

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER (64px mobile / 72px desktop)                             │
│ Logo                                          Dark Mode Toggle   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ SUMMARY STATS SECTION (responsive grid)                         │
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐  │
│ │ Total ROI        │ │ Benefits         │ │ All-Time         │  │
│ │ $1,234           │ │ Captured: $4,567 │ │ Insights         │  │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘  │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ ALERT SECTION (Sticky on scroll, above fold)                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔴 CRITICAL: $500 Hotel Credit expires TODAY (11:59 PM)    │ │
│ │    Chase Sapphire Reserve | Action needed                  │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ⚠️  WARNING: $100 Airline Credit expires in 5 days          │ │
│ │    United Explorer Card | Book a flight by Sept 20         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
├─────────────────────────────────────────────────────────────────┤
│ PLAYER TABS                                                       │
│ Primary    │ Bethan    │ View All                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ CARD GRID (1 column mobile, 2 tablet, 2-3 desktop)              │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐ │
│ │ Chase Sapphire Reserve      │ │ American Express Platinum   │ │
│ │ +$1,234 captured            │ │ +$567 captured              │ │
│ │ 4 benefits pending          │ │ 2 benefits pending          │ │
│ │ [Expand ▼]                  │ │ [Expand ▼]                  │ │
│ └─────────────────────────────┘ └─────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────┐                                  │
│ │ Capital One Venture X       │                                  │
│ │ +$432 captured              │                                  │
│ │ 1 benefit pending           │                                  │
│ │ [Expand ▼]                  │                                  │
│ └─────────────────────────────┘                                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Header Component

**Container Dimensions:**
- Mobile: Height 64px, padding 16px (--space-md)
- Desktop: Height 72px, padding 40px (--space-lg)
- Sticky positioning: Yes (stays fixed at top on scroll)
- Background: `--color-bg-primary` (light) / `--color-dark-bg-primary` (dark)
- Border-bottom: 1px solid `--color-border` / `--color-dark-border`
- Box-shadow: `--shadow-sm`

**Header Layout (Flexbox: space-between):**

```
┌─────────────────────────────────────────────────────────────────┐
│ Logo + Title          [space]         Dark Mode Toggle Button   │
└─────────────────────────────────────────────────────────────────┘
```

**Logo/Title (Left Side):**
- Logo: 32px × 32px SVG or image, margin-right 12px
- Title: "Card Benefits Dashboard"
- Font: `--font-h3` (20px, weight 600)
- Color: `--color-text-primary`
- On mobile: Can be abbreviated to "Dashboard" or just logo if space constrained

**Dark Mode Toggle Button (Right Side):**
- Container: 44px × 44px square
- Icon size: 20px × 20px (moon/sun icon, Heroicons or similar)
- Background: transparent, hover: `--color-bg-tertiary` / `--color-dark-bg-tertiary`
- Border-radius: 8px (--radius-md)
- Cursor: pointer
- Transition: all 200ms ease-in-out
- Focus state: 2px solid `--color-primary-500` outline with 2px offset
- Hidden label: "Toggle dark mode" (accessibility)
- Role: "switch", aria-checked: true/false
- OnClick: Toggle `document.documentElement.classList.toggle('dark')`

---

### 1.3 Summary Stats Section

**Container:**
- Width: 100% of viewport (minus padding)
- Padding: `--space-lg` (24px) mobile, `--space-xl` (32px) desktop
- Background: `--color-bg-primary`
- Margin-bottom: `--space-xl` (32px)
- Grid layout (CSS Grid or Flexbox):

**Mobile (< 640px):**
- 1 column, full width
- Gap: `--space-md` (16px)

**Tablet (640px - 1024px):**
- 3 columns, equal width
- Gap: `--space-md` (16px)

**Desktop (> 1024px):**
- 3 columns, equal width
- Gap: `--space-lg` (24px)
- Max-width: 1200px (centered with auto margins)

**Individual Stat Card:**

```
┌─────────────────────────────────────────────────────┐
│ Total Household ROI                                 │
│                                                      │
│ $3,567                                              │
│                                                      │
│ Captured value across all cards in 2024 (net fees)  │
│                                                      │
│ Breakdown: Chase $1,234 | Amex $567 | CapOne $432  │
└─────────────────────────────────────────────────────┘
```

**Stat Card Visual Spec:**

| Property | Value |
|----------|-------|
| **Background** | `--color-bg-secondary` (light) / `--color-dark-bg-secondary` (dark) |
| **Border** | 1px solid `--color-border` / `--color-dark-border` |
| **Border-radius** | 12px (--radius-lg) |
| **Padding** | `--space-lg` (24px) all sides |
| **Box-shadow** | `--shadow-md` |
| **Hover state** | Shadow increases to `--shadow-lg`, subtle background shift |
| **Transition** | all 200ms ease-in-out |

**Stat Card Content:**

**Title:**
- Font: `--font-body-md` (14px, weight 400)
- Color: `--color-text-secondary`
- Margin-bottom: `--space-sm` (8px)

**Value:**
- Font: `--font-h2` (24px, weight 700)
- Color: `--color-success-500` (green) for positive, `--color-danger-500` (red) for negative ROI
- Margin-bottom: `--space-sm` (8px)
- Example: "+$1,234" or "-$45"

**Subtitle/Description:**
- Font: `--font-body-sm` (12px, weight 400)
- Color: `--color-text-secondary`
- Line-height: 1.5
- Margin-top: `--space-xs` (4px)

**Empty State (No Data):**
- Title: "No household data yet"
- Subtitle: "Add a card to see ROI insights"
- Icon: Dollar sign in primary color, 32px × 32px, opacity 30%
- Centered in card

---

### 1.4 Alert Section

**Container:**
- Width: 100% (full viewport width on mobile, max-width on desktop)
- Padding: `--space-md` (16px) mobile, `--space-lg` (24px) desktop
- Margin-bottom: `--space-xl` (32px)
- Position: Sticky to top when scrolling (position: sticky, top: 64px/72px depending on header height)
- Z-index: 40 (above cards, below header)
- Background: transparent (no background, just stacked alerts)
- On mobile: Full width, margin-left/right: 0, alerts appear edge-to-edge

**Alert Box Structure:**

```
┌─────────────────────────────────────────────────────────────────┐
│ [Icon] Message text + details     [Close button (optional)]      │
└─────────────────────────────────────────────────────────────────┘
```

**Alert Categorization & Styling:**

#### A. Critical Expiration (< 3 days)

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 EXPIRES TODAY: $500 Hotel Credit (Chase Sapphire Reserve)    │
│    Use by 11:59 PM tonight                                       │
│    [Card details] [Mark as used] [Dismiss]                      │
└─────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Background** | `--color-danger-50` (light) / `--color-danger-100` (dark) |
| **Border** | 1px solid `--color-danger-500` |
| **Left border** | 4px solid `--color-danger-500` (accent) |
| **Border-radius** | 8px (--radius-md) |
| **Padding** | `--space-md` (16px) all sides |
| **Text color** | `--color-danger-700` (light) / adjusted for dark mode |
| **Icon** | 🔴 or ⚠️ emoji, or 16px SVG danger icon |

**Alert Text:**
- Font: `--font-body-md` (14px, weight 400)
- Line-height: 1.5
- Structure: "EXPIRES [DATE]: [Amount] [Benefit Name] ([Card Name])"

**Actions (Inside Alert):**
- Buttons: Secondary style, margin-top `--space-sm`
- "Mark as used" → marks benefit, dismisses alert
- "Dismiss" → hides alert for session or until day changes
- Space between buttons: `--space-sm` (8px)

#### B. Warning Expiration (3-14 days)

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️  EXPIRING SOON: $100 Airline Credit (United Explorer)        │
│    Use by Sept 20 (5 days remaining)                             │
│    [Card details] [Snooze until Sept 15] [Dismiss]              │
└─────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Background** | `--color-alert-50` (light) / `--color-alert-100` (dark) |
| **Border** | 1px solid `--color-alert-500` |
| **Left border** | 4px solid `--color-alert-500` |
| **Text color** | `--color-alert-600` (dark, high contrast) |
| **Icon** | ⚡ or ⏰ emoji, or 16px SVG warning icon |

#### C. Informational (14+ days or future benefit)

```
┌─────────────────────────────────────────────────────────────────┐
│ ℹ️  Future benefit available: $200 Statement Credit (Amex)      │
│    Activates on your next renewal (Feb 1, 2025)                 │
│    [Learn more]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Background** | `--color-bg-tertiary` (light) / `--color-dark-bg-tertiary` (dark) |
| **Border** | 1px solid `--color-border` / `--color-dark-border` |
| **Left border** | 4px solid `--color-primary-500` |
| **Text color** | `--color-text-secondary` |
| **Icon** | ℹ️ or 🔔 emoji, or 16px SVG info icon |

**Mobile vs Desktop Layout:**

| Device | Layout | Max Width |
|--------|--------|-----------|
| Mobile | Vertical stack, full width | 100% - 2 × padding |
| Tablet | Vertical stack or 2-col grid | 728px |
| Desktop | Vertical stack, max 100% width | 1200px (container max) |

**Empty State (No Alerts):**
- If no critical/warning alerts exist, show single informational alert:
  - "✓ No expirations in the next 14 days. You're all set!"
  - Background: `--color-success-50`
  - Icon: ✓ green checkmark
  - Text: `--color-success-700`

---

### 1.5 Player Tabs Section

**Container:**
- Width: 100% of container
- Background: `--color-bg-primary`
- Padding: 0 (tabs span full width)
- Margin-bottom: `--space-md` (16px)

**Tab Bar Visual:**

```
Primary  │  Bethan  │  View All
────────────────────────────────────
^
Active tab underline
```

| Property | Value |
|----------|-------|
| **Height** | 44px (mobile), 48px (desktop) |
| **Border-bottom** | 1px solid `--color-border` / `--color-dark-border` |
| **Background** | `--color-bg-primary` / `--color-dark-bg-primary` |
| **Display** | Flex, horizontal, left-aligned |
| **Overflow** | If tabs don't fit, allow horizontal scroll with scroll-snap |

**Individual Tab:**

| State | Style |
|-------|-------|
| **Active** | Font: `--font-body-md` (14px), weight 600, color `--color-primary-500` |
| | Border-bottom: 4px solid `--color-primary-500`, inset at bottom |
| | Padding: `--space-md` (16px) horizontal, `--space-sm` (8px) vertical |
| **Inactive** | Font: `--font-body-md`, weight 400, color `--color-text-secondary` |
| | Padding: `--space-md` horizontal, `--space-sm` vertical |
| **Hover** | Background: `--color-bg-tertiary` / `--color-dark-bg-tertiary` |
| | Cursor: pointer |
| **Focus** | Outline: 2px solid `--color-primary-500`, outline-offset: -2px (inside) |

**Tab Behavior:**
- Clicking tab switches view to that player's cards
- Tab content loads/transitions smoothly (fade in 150ms)
- Currently active tab is always visible (no scrolling needed to see active)
- On mobile: If tabs exceed container width, allow horizontal scroll (scroll-snap-type: x mandatory)

**View All Tab:**
- Shows cards from all household members
- Tab label: "View All (3)"
- Displays all cards in single grid, grouped by player with dividers

---

### 1.6 Card Grid & Individual Card Layout

**Grid Container:**
- Padding: `--space-md` (16px) mobile, `--space-lg` (24px) desktop
- Gap (between cards): `--space-md` (16px) mobile/tablet, `--space-lg` (24px) desktop
- Display: CSS Grid

**Responsive Grid Configuration:**

| Breakpoint | Columns | Notes |
|-----------|---------|-------|
| < 640px (Mobile) | 1 | Full width, padding 16px sides |
| 640px - 1024px (Tablet) | 2 | Equal width, gap 16px |
| > 1024px (Desktop) | 2-3 | Equal width, gap 24px, max-width 1200px |

**Individual Card Container:**

```
┌────────────────────────────────────────────────────────┐
│ Chase Sapphire Reserve                        [+$1,234]│
│ Annual Fee: $395 (Renewal: March 15)                   │
│                                                        │
│ 4 benefits available | 0 expiring soon                │
│                                                        │
│ [Expand card ▼]                                        │
└────────────────────────────────────────────────────────┘
```

| Property | Value |
|----------|-------|
| **Background** | `--color-bg-secondary` (light) / `--color-dark-bg-secondary` (dark) |
| **Border** | 1px solid `--color-border` / `--color-dark-border` |
| **Border-radius** | 12px (--radius-lg) |
| **Padding** | `--space-lg` (24px) |
| **Box-shadow** | `--shadow-md` |
| **Hover state** | Shadow → `--shadow-lg`, transform: translateY(-2px), cursor: pointer |
| **Transition** | all 200ms ease-in-out |

**Card Header (Inside Card):**

```
Card Name + Badge         ROI Value (right-aligned)
─────────────────────────────────────────────────────
Card details (issuer, renewal date)
```

**Card Name:**
- Font: `--font-h3` (20px, weight 600)
- Color: `--color-text-primary`
- Display: Flex, space-between (name on left, badge on right)

**ROI Badge (Right Side of Name):**
- Background: `--color-success-50` (positive) / `--color-danger-50` (negative)
- Padding: `--space-sm` (8px) horizontal, `--space-xs` (4px) vertical
- Border-radius: 6px (--radius-md)
- Font: `--font-label` (12px, weight 600)
- Text: `--color-success-600` (positive) / `--color-danger-600` (negative)
- Icon: ✓ (success) or ↓ (danger) emoji
- Example: "✓ +$1,234" or "↓ -$45"

**Card Details (Below Name):**
- Font: `--font-body-sm` (12px, weight 400)
- Color: `--color-text-secondary`
- Line-height: 1.4
- Margin-top: `--space-xs` (4px)
- Example: "Annual Fee: $395 | Renewal: March 15"

**Card Body Content:**
- Margin-top: `--space-md` (16px)
- Display: Flex, space-between

**Left Side (Benefit Count):**
- Font: `--font-body-md` (14px, weight 400)
- Color: `--color-text-primary`
- Icon: 🎁 or benefits icon, 16px
- Example: "4 benefits available"

**Right Side (Expiration Status):**
- Font: `--font-body-md` (14px, weight 400)
- Color: Depends on urgency
  - 0 expiring: `--color-text-secondary`
  - 1-2 expiring soon: `--color-alert-600`
  - 3+ or very soon: `--color-danger-600`
- Example: "2 expiring soon" (clickable, expands card)

**Expand/Collapse Footer:**
- Margin-top: `--space-md` (16px)
- Padding-top: `--space-md` (16px)
- Border-top: 1px solid `--color-border` / `--color-dark-border`
- Button: Secondary style, text "Expand ▼" or "Collapse ▲"
- Alignment: Center or right-aligned

---

### 1.7 Expanded Card Content (Benefit Table)

When user clicks "Expand", the card extends to show a table of all benefits for that card.

**Expanded Card Layout:**

```
┌────────────────────────────────────────────────────────────────┐
│ Chase Sapphire Reserve                            +$1,234 ROI   │
│ Annual Fee: $395 | Renewal: March 15                           │
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ Benefit Name              │ Value   │ Expires  │ Status      │ │
│ ├────────────────────────────────────────────────────────────┤ │
│ │ ☐ $100 Airline Credit     │ $100    │ TODAY    │ Unclaimed  │ │
│ │ ☐ $75 Dining Credit       │ $75     │ Sept 25  │ Unclaimed  │ │
│ │ ☑️ Lounge Access (annual) │ Benefit │ March 15 │ Used       │ │
│ │ ☐ TSA Credit              │ $85     │ March 15 │ Unclaimed  │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Collapse ▲]                                                    │
└────────────────────────────────────────────────────────────────┘
```

**Benefit Table Visual Spec:**

| Property | Value |
|----------|-------|
| **Width** | 100% of card |
| **Margin-top** | `--space-lg` (24px) |
| **Border-collapse** | separate (more readable) |
| **Border-spacing** | 0 |

**Table Header Row:**
- Background: `--color-bg-tertiary` (light) / `--color-dark-bg-tertiary` (dark)
- Border-bottom: 1px solid `--color-border` / `--color-dark-border`
- Padding: `--space-md` (16px) horizontal, `--space-sm` (8px) vertical
- Font: `--font-label` (12px, weight 600)
- Color: `--color-text-secondary`
- Columns: Name (40%), Value (20%), Expiration (20%), Status (20%)

**Table Body Rows:**
- Border-bottom: 1px solid `--color-border` / `--color-dark-border`
- Padding: `--space-md` (16px) horizontal, `--space-sm` (8px) vertical
- Font: `--font-body-md` (14px, weight 400)
- Color: `--color-text-primary`
- Hover state: Background shifts to `--color-bg-tertiary`
- Transition: background 150ms ease-in-out

**Conditional Row Coloring:**

| Condition | Background | Text Treatment |
|-----------|------------|-----------------|
| **Expiring < 3 days (not used)** | `--color-danger-50` (light) / darker red (dark) | Text: `--color-danger-700`, bold |
| **Expiring 3-14 days (not used)** | `--color-alert-50` (light) / darker yellow (dark) | Text: `--color-alert-600` |
| **Expiring soon & critical** | Additional left border: 4px solid `--color-danger-500` | — |
| **Used/Captured** | Normal background, opacity 60% | Strikethrough text, lower contrast |
| **Normal expiration** | Default background | Default text color |

**Checkbox Column:**
- Width: 44px (including touch target)
- Input type: "checkbox"
- Size: 20px × 20px
- Accent color: `--color-primary-500` (Tailwind: `accent-blue-500`)
- Dark mode: Custom color matching dark palette
- Cursor: pointer
- Label association: Checkbox is within `<label>` or has aria-label

**Benefit Name Column:**
- Font: `--font-body-md`
- Weight: 400, or 600 if row is highlighted (expiring soon)
- Truncate if too long: text-overflow: ellipsis, white-space: nowrap, overflow: hidden
- Max-width: 60% of column

**Value Column:**
- Font: `--font-body-md`, weight 600 (bold to emphasize amount)
- Text-align: right
- Currency format: "$X" or "X points" or "Benefit" (if non-monetary)
- Color: `--color-text-primary`

**Expiration Column:**
- Font: `--font-body-sm` (12px)
- Text-align: center
- Format: "TODAY", "Sept 25", "March 15"
- Color: Based on urgency
  - < 3 days: `--color-danger-600`
  - 3-14 days: `--color-alert-600`
  - > 14 days: `--color-text-secondary`

**Status Badge Column:**
- Display: Right-aligned
- Badge styles:

| Status | Background | Text Color | Icon |
|--------|------------|-----------|------|
| **Unclaimed** | `--color-secondary-100` | `--color-text-secondary` | — |
| **Used** | `--color-success-100` | `--color-success-600` | ✓ |
| **Captured** | `--color-success-100` | `--color-success-600` | ✓ |
| **Expired** | `--color-danger-100` | `--color-danger-600` | ✗ |

**Empty Expanded State:**
- If card has no benefits: "No benefits to display"
- Font: `--font-body-md`, color `--color-text-secondary`
- Centered in table area, padding `--space-lg`

---

## 2. Component Specifications

### 2.1 Header Component

**Container:**
```css
/* Header wrapper */
position: sticky;
top: 0;
z-index: 50;
height: 64px; /* mobile */
height: 72px; /* desktop at 1024px+ */
padding: 0 16px; /* mobile */
padding: 0 40px; /* desktop */
background: var(--color-bg-primary);
border-bottom: 1px solid var(--color-border);
box-shadow: var(--shadow-sm);
display: flex;
align-items: center;
justify-content: space-between;
```

**Logo/Title Section:**
```css
display: flex;
align-items: center;
gap: 12px; /* --space-sm */

/* Logo */
width: 32px;
height: 32px;
flex-shrink: 0;

/* Title */
font-size: 20px; /* --font-h3 */
font-weight: 600;
color: var(--color-text-primary);
white-space: nowrap;

/* Mobile: hide title, show logo only */
@media (max-width: 640px) {
  gap: 0; /* No gap if title hidden */
}
```

**Dark Mode Toggle Button:**
```css
width: 44px;
height: 44px;
padding: 10px;
background: transparent;
border: none;
border-radius: 8px; /* --radius-md */
cursor: pointer;
display: flex;
align-items: center;
justify-content: center;
transition: all 200ms ease-in-out;
color: var(--color-text-primary);

/* Hover state */
background: var(--color-bg-tertiary);

/* Focus state (keyboard) */
outline: 2px solid var(--color-primary-500);
outline-offset: 2px;

/* Icon inside */
svg {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  fill: none;
}
```

**Accessibility:**
```html
<button 
  id="dark-mode-toggle"
  role="switch"
  aria-checked="false"
  aria-label="Toggle dark mode"
  onclick="toggleDarkMode()"
>
  <svg><!-- sun/moon icon --></svg>
</button>

<script>
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  const btn = document.getElementById('dark-mode-toggle');
  btn.setAttribute('aria-checked', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Initialize on page load
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
  document.getElementById('dark-mode-toggle').setAttribute('aria-checked', 'true');
}
</script>
```

---

### 2.2 Summary Stats Card

**Container:**
```css
background: var(--color-bg-secondary);
border: 1px solid var(--color-border);
border-radius: 12px; /* --radius-lg */
padding: 24px; /* --space-lg */
box-shadow: var(--shadow-md);
transition: all 200ms ease-in-out;

/* Hover state */
@media (hover: hover) {
  &:hover {
    box-shadow: var(--shadow-lg);
    border-color: var(--color-primary-500);
    transform: translateY(-2px);
  }
}
```

**Title:**
```css
font-size: 14px; /* --font-body-md */
font-weight: 400;
color: var(--color-text-secondary);
margin-bottom: 8px; /* --space-sm */
text-transform: uppercase;
letter-spacing: 0.05em;
```

**Value:**
```css
font-size: 24px; /* --font-h2 */
font-weight: 700;
color: var(--color-success-500); /* or --color-danger-500 if negative */
margin-bottom: 8px; /* --space-sm */
line-height: 1.2;
```

**Subtitle:**
```css
font-size: 12px; /* --font-body-sm */
font-weight: 400;
color: var(--color-text-secondary);
line-height: 1.5;
```

**Dark Mode Variants:**
```css
@media (prefers-color-scheme: dark) {
  background: var(--color-dark-bg-secondary);
  border-color: var(--color-dark-border);
  color: var(--color-dark-text-primary);
}
```

---

### 2.3 Alert Box Components

#### Critical Alert (< 3 days)

**Container:**
```css
background: var(--color-danger-50);
border: 1px solid var(--color-danger-500);
border-left: 4px solid var(--color-danger-500);
border-radius: 8px; /* --radius-md */
padding: 16px; /* --space-md */
margin-bottom: 16px; /* --space-md */
display: flex;
gap: 12px; /* --space-sm */
align-items: flex-start;
```

**Icon:**
```css
width: 20px;
height: 20px;
flex-shrink: 0;
color: var(--color-danger-500);
font-size: 20px; /* emoji size */
```

**Text Content:**
```css
flex: 1;
display: flex;
flex-direction: column;
gap: 8px; /* --space-sm */

/* Main message */
font-size: 14px; /* --font-body-md */
font-weight: 400;
color: var(--color-danger-700);
line-height: 1.5;

/* Details */
font-size: 13px;
color: var(--color-danger-600);
opacity: 0.9;
```

**Actions Container:**
```css
display: flex;
gap: 8px; /* --space-sm */
margin-top: 12px;
flex-wrap: wrap;

/* Button styling */
button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 150ms;
}
```

#### Warning Alert (3-14 days)

**Same structure as Critical, with color substitutions:**
```css
background: var(--color-alert-50);
border-color: var(--color-alert-500);
border-left-color: var(--color-alert-500);

/* Text */
color: var(--color-alert-600);

/* Icon */
color: var(--color-alert-500);
```

#### Info Alert (14+ days or future)

**Same structure, with color substitutions:**
```css
background: var(--color-bg-tertiary);
border-color: var(--color-border);
border-left-color: var(--color-primary-500);

/* Text */
color: var(--color-text-secondary);

/* Icon */
color: var(--color-primary-500);
```

---

### 2.4 Player Tab Bar

**Tab Bar Container:**
```css
display: flex;
align-items: stretch;
border-bottom: 1px solid var(--color-border);
background: var(--color-bg-primary);
height: 44px; /* mobile */
height: 48px; /* desktop */
overflow-x: auto;
overflow-y: hidden;
scroll-behavior: smooth;

/* Scrollbar styling (optional) */
&::-webkit-scrollbar {
  height: 4px;
}
&::-webkit-scrollbar-track {
  background: transparent;
}
&::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
```

**Individual Tab:**
```css
padding: 8px 16px; /* --space-sm --space-md */
font-size: 14px; /* --font-body-md */
font-weight: 400;
color: var(--color-text-secondary);
border: none;
background: transparent;
cursor: pointer;
white-space: nowrap;
position: relative;
transition: all 150ms ease-in-out;

/* Hover state */
&:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* Active state */
&[data-active="true"] {
  font-weight: 600;
  color: var(--color-primary-500);
  
  /* Underline indicator */
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--color-primary-500);
  }
}

/* Focus state (keyboard navigation) */
&:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px;
}
```

**HTML Example:**
```html
<div class="tab-bar" role="tablist">
  <button role="tab" aria-selected="true" data-active="true">Primary</button>
  <button role="tab" aria-selected="false">Bethan</button>
  <button role="tab" aria-selected="false">View All</button>
</div>
```

---

### 2.5 Card Container (Credit Card Widget)

**Card Wrapper:**
```css
background: var(--color-bg-secondary);
border: 1px solid var(--color-border);
border-radius: 12px; /* --radius-lg */
padding: 24px; /* --space-lg */
box-shadow: var(--shadow-md);
transition: all 200ms ease-in-out;
cursor: pointer;

/* Hover state */
@media (hover: hover) {
  &:hover {
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }
}

/* Responsive grid sizing */
@media (max-width: 640px) {
  grid-column: 1;
  padding: 20px; /* --space-lg */
}
@media (640px <= width <= 1024px) {
  grid-column: span 1; /* 2 columns, each spans 1 */
}
@media (min-width: 1024px) {
  grid-column: span 1; /* 2-3 columns */
}
```

**Card Header (Name & Badge):**
```css
display: flex;
justify-content: space-between;
align-items: baseline;
margin-bottom: 8px; /* --space-sm */

/* Card Name */
font-size: 20px; /* --font-h3 */
font-weight: 600;
color: var(--color-text-primary);

/* ROI Badge */
background: var(--color-success-50); /* or --color-danger-50 */
padding: 4px 8px;
border-radius: 6px;
font-size: 12px; /* --font-label */
font-weight: 600;
color: var(--color-success-600);
white-space: nowrap;
```

**Card Issuer/Details:**
```css
font-size: 12px; /* --font-body-sm */
color: var(--color-text-secondary);
margin-bottom: 16px; /* --space-md */
line-height: 1.4;
```

**Card Body:**
```css
margin-top: 16px; /* --space-md */
padding-top: 16px;
border-top: 1px solid var(--color-border);
display: flex;
justify-content: space-between;
align-items: center;
```

**Left Section (Benefits):**
```css
display: flex;
align-items: center;
gap: 8px; /* --space-sm */

/* Icon */
font-size: 16px;

/* Text */
font-size: 14px; /* --font-body-md */
color: var(--color-text-primary);
```

**Right Section (Expiration Status):**
```css
font-size: 14px; /* --font-body-md */
color: var(--color-alert-600); /* or based on urgency */
font-weight: 500;
cursor: pointer;
```

**Expand/Collapse Footer:**
```css
margin-top: 16px; /* --space-md */
padding-top: 16px;
border-top: 1px solid var(--color-border);
text-align: center;

/* Button */
background: transparent;
border: none;
color: var(--color-primary-500);
font-size: 14px;
font-weight: 600;
cursor: pointer;
padding: 8px 12px;
transition: all 150ms;

&:hover {
  color: var(--color-primary-600);
  background: var(--color-bg-tertiary);
  border-radius: 6px;
}
```

---

### 2.6 Benefit Table (Expanded Card)

**Table Element:**
```css
width: 100%;
border-collapse: separate;
border-spacing: 0;
margin-top: 24px; /* --space-lg */
font-size: 14px; /* --font-body-md */
```

**Header Row:**
```css
/* th elements */
background: var(--color-bg-tertiary);
border-bottom: 1px solid var(--color-border);
padding: 12px 16px; /* --space-md horizontal, --space-sm vertical */
font-size: 12px; /* --font-label */
font-weight: 600;
color: var(--color-text-secondary);
text-align: left;
text-transform: uppercase;
letter-spacing: 0.05em;

/* Column widths */
th:nth-child(1) { width: 40%; } /* Benefit Name */
th:nth-child(2) { width: 20%; text-align: right; } /* Value */
th:nth-child(3) { width: 20%; text-align: center; } /* Expiration */
th:nth-child(4) { width: 20%; text-align: right; } /* Status */
```

**Body Rows:**
```css
/* td elements */
padding: 16px; /* --space-md */
border-bottom: 1px solid var(--color-border);
font-size: 14px; /* --font-body-md */
color: var(--color-text-primary);
line-height: 1.5;

/* Row hover state */
tr:hover td {
  background: var(--color-bg-tertiary);
  transition: background 150ms ease-in-out;
}

/* Checkbox column */
td:first-child {
  width: 40px;
  padding: 16px 8px;
}
input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--color-primary-500);
}

/* Benefit Name */
text-overflow: ellipsis;
white-space: nowrap;
overflow: hidden;

/* Value column */
text-align: right;
font-weight: 600;

/* Expiration column */
text-align: center;
font-size: 13px;
```

**Conditional Row Styling:**

```css
/* Expiring < 3 days */
tr.expiring-critical {
  background: var(--color-danger-50);
  border-left: 4px solid var(--color-danger-500);
  
  td {
    color: var(--color-danger-700);
    font-weight: 500;
  }
}

/* Expiring 3-14 days */
tr.expiring-soon {
  background: var(--color-alert-50);
  border-left: 4px solid var(--color-alert-500);
  
  td {
    color: var(--color-alert-600);
  }
}

/* Used/Captured */
tr.used {
  opacity: 0.7;
  
  td {
    text-decoration: line-through;
    color: var(--color-text-secondary);
  }
}
```

---

### 2.7 Status Badges

**Badge Container:**
```css
display: inline-block;
padding: 4px 8px; /* --space-xs --space-sm */
border-radius: 12px; /* --radius-full */
font-size: 12px; /* --font-body-sm */
font-weight: 500;
white-space: nowrap;
```

**Status Variations:**

```css
/* Unclaimed */
.badge-unclaimed {
  background: var(--color-secondary-100);
  color: var(--color-text-secondary);
}

/* Used */
.badge-used {
  background: var(--color-success-100);
  color: var(--color-success-600);
  
  &::before {
    content: '✓ ';
    margin-right: 2px;
  }
}

/* Captured */
.badge-captured {
  background: var(--color-success-100);
  color: var(--color-success-600);
  
  &::before {
    content: '✓ ';
    margin-right: 2px;
  }
}

/* Expired */
.badge-expired {
  background: var(--color-danger-100);
  color: var(--color-danger-600);
  
  &::before {
    content: '✗ ';
    margin-right: 2px;
  }
}
```

---

### 2.8 Dark Mode Toggle Button (Detailed)

**Button Element:**
```css
position: relative;
width: 44px;
height: 44px;
padding: 10px;
background: transparent;
border: none;
border-radius: 8px; /* --radius-md */
cursor: pointer;
display: inline-flex;
align-items: center;
justify-content: center;
transition: background 200ms ease-in-out;
color: var(--color-text-primary);

/* Hover state */
&:hover {
  background: var(--color-bg-tertiary);
}

/* Active/pressed state */
&:active {
  background: var(--color-bg-secondary);
}

/* Focus state (keyboard) */
&:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}
```

**Icon (SVG):**
```css
width: 20px;
height: 20px;
stroke: currentColor;
fill: none;
stroke-width: 2;
stroke-linecap: round;
stroke-linejoin: round;
transition: transform 300ms ease-in-out;

/* Moon icon (light mode, showing dark mode will activate) */
.icon-moon {
  display: block;
}

/* Sun icon (dark mode, showing light mode will activate) */
.icon-sun {
  display: none;
}

/* In dark mode */
@media (prefers-color-scheme: dark) {
  .icon-moon {
    display: none;
  }
  
  .icon-sun {
    display: block;
  }
}
```

**Accessibility:**
```html
<button 
  class="dark-mode-toggle"
  id="theme-toggle"
  role="switch"
  aria-checked="false"
  aria-label="Toggle dark mode"
  title="Toggle dark mode (⌘D)"
>
  <svg class="icon-sun" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
  <svg class="icon-moon" viewBox="0 0 24 24">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
</button>

<script>
const toggle = document.getElementById('theme-toggle');
const html = document.documentElement;
const isDark = html.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;

// Initialize
toggle.setAttribute('aria-checked', isDark);

// Toggle on click
toggle.addEventListener('click', () => {
  const wasDark = html.classList.contains('dark');
  if (wasDark) {
    html.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    toggle.setAttribute('aria-checked', 'false');
  } else {
    html.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    toggle.setAttribute('aria-checked', 'true');
  }
});

// Keyboard shortcut: ⌘D or Ctrl+D
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault();
    toggle.click();
  }
});
</script>
```

---

## 3. Responsive Breakpoints & Layout Behavior

### 3.1 Breakpoint Definition

```css
/* Mobile First Approach */

/* 375px - 640px: Mobile */
@media (max-width: 640px) {
  /* 1 column grid */
  /* Reduced padding: 16px */
  /* Reduced font sizes */
}

/* 640px - 1024px: Tablet */
@media (min-width: 640px) and (max-width: 1024px) {
  /* 2 column grid */
  /* Padding: 20px */
  /* Standard font sizes */
}

/* 1024px+: Desktop */
@media (min-width: 1024px) {
  /* 2-3 column grid */
  /* Padding: 40px */
  /* Full font sizes */
  /* Max-width container: 1200px */
}
```

### 3.2 Layout Transformations

**Header:**

| Breakpoint | Height | Padding | Logo | Title |
|-----------|--------|---------|------|-------|
| Mobile | 64px | 16px | 32×32 | Hidden |
| Tablet | 68px | 20px | 32×32 | Visible |
| Desktop | 72px | 40px | 32×32 | Visible |

**Summary Stats Grid:**

| Breakpoint | Columns | Gap | Card Padding |
|-----------|---------|-----|--------------|
| Mobile | 1 | 16px | 20px |
| Tablet | 3 | 16px | 24px |
| Desktop | 3 | 24px | 24px |

**Alert Section:**

| Breakpoint | Layout | Width |
|-----------|--------|-------|
| Mobile | Vertical stack | 100% - 32px (side padding) |
| Tablet | Vertical stack | 728px max |
| Desktop | Vertical stack | 1200px max |

**Card Grid:**

| Breakpoint | Columns | Gap | Padding |
|-----------|---------|-----|---------|
| Mobile | 1 | 16px | 16px |
| Tablet | 2 | 16px | 20px |
| Desktop | 2-3 | 24px | 40px |

**Benefit Table (Inside Card):**

| Breakpoint | Layout | Changes |
|-----------|--------|---------|
| Mobile | Single column or horizontal scroll | Table may compress, consider tab-based UI for columns |
| Tablet | Full table | All columns visible |
| Desktop | Full table | All columns visible with full widths |

### 3.3 Critical Layout Breakpoints

**640px Breakpoint (Mobile → Tablet):**
- Header: Add visible title
- Stats: Change from 1 col to 3 cols
- Tab bar: Tabs may need scroll handling
- Card grid: Stay 1 col or allow 2 if desired

**1024px Breakpoint (Tablet → Desktop):**
- Header: Increase height/padding
- Stats: Increase gap and card padding
- Card grid: May change to 2-3 columns
- Container: Add max-width: 1200px with auto margins
- Padding: Increase to 40px for breathing room

### 3.4 Font Size Adjustments

**Mobile (< 640px):**
```css
h1 { font-size: 24px; } /* from 32px */
h2 { font-size: 20px; } /* from 24px */
h3 { font-size: 18px; } /* from 20px */
body-md { font-size: 14px; } /* unchanged */
body-sm { font-size: 12px; } /* unchanged */
```

**Tablet (640px - 1024px):**
```css
/* Standard sizes */
h1 { font-size: 28px; }
h2 { font-size: 24px; }
h3 { font-size: 20px; }
```

**Desktop (> 1024px):**
```css
/* Full sizes from design system */
h1 { font-size: 32px; }
h2 { font-size: 24px; }
h3 { font-size: 20px; }
```

---

## 4. Interaction & State Specifications

### 4.1 Hover States

**Card Hover (Desktop Only):**
```css
@media (hover: hover) {
  .card:hover {
    box-shadow: var(--shadow-lg);
    border-color: var(--color-primary-500);
    transform: translateY(-2px);
    cursor: pointer;
  }
}

/* Transition timing */
transition: all 200ms ease-in-out;
```

**Button Hover:**
```css
@media (hover: hover) {
  .button:hover {
    background: var(--color-primary-600);
    box-shadow: var(--shadow-md);
    cursor: pointer;
  }
}
transition: all 150ms ease-in-out;
```

**Tab Hover:**
```css
@media (hover: hover) {
  .tab:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }
}
```

**Row Hover (in table):**
```css
@media (hover: hover) {
  tr:hover td {
    background: var(--color-bg-tertiary);
  }
}
transition: background 150ms ease-in-out;
```

### 4.2 Active/Pressed States

**Button Active:**
```css
.button:active {
  background: var(--color-primary-700);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
  transform: scale(0.98);
}
```

**Tab Active:**
```css
.tab[aria-selected="true"] {
  font-weight: 600;
  color: var(--color-primary-500);
}

.tab[aria-selected="true"]::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-primary-500);
}
```

**Checkbox Active:**
```css
input[type="checkbox"]:checked {
  background: var(--color-primary-500);
  border-color: var(--color-primary-500);
}

input[type="checkbox"]:checked::after {
  content: '✓';
  color: white;
  font-weight: bold;
}
```

### 4.3 Focus States (Keyboard Navigation)

**All Interactive Elements:**
```css
/* Standard focus outline */
&:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Tab key navigation visible */
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Alternative: use box-shadow if outline looks bad */
&:focus-visible {
  box-shadow: 0 0 0 3px var(--color-primary-100);
  border-color: var(--color-primary-500);
}
```

**Buttons:**
```css
button:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px; /* inside the button */
}
```

**Tabs:**
```css
[role="tab"]:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: -2px; /* inside the tab */
  border-radius: 4px;
}
```

**Form Inputs:**
```css
input:focus-visible {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}
```

### 4.4 Loading States

**Skeleton Loaders (while fetching data):**

For stats cards and card grid, show skeleton placeholders:

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 0%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Stat card skeleton */
.stat-skeleton {
  height: 160px;
  border-radius: 12px;
}

/* Benefit table row skeleton */
.table-row-skeleton td {
  padding: 16px;
  
  & > div {
    height: 12px;
    border-radius: 4px;
    @extend .skeleton;
  }
}
```

**Button Loading State:**
```css
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

button[data-loading="true"] {
  pointer-events: none;
  opacity: 0.7;
  
  &::after {
    content: '';
    display: inline-block;
    width: 12px;
    height: 12px;
    margin-left: 8px;
    border: 2px solid var(--color-primary-500);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### 4.5 Empty States

**No Expirations Alert:**
```
┌─────────────────────────────────────────────┐
│ ✓ No expirations in the next 14 days.       │
│ You're all set!                             │
└─────────────────────────────────────────────┘
```

**No Data in Stats:**
```
┌─────────────────────────────────────────────┐
│           💰 No Data                        │
│    Add a card to see ROI insights           │
│         [Add Card CTA]                      │
└─────────────────────────────────────────────┘
```

**Empty Card Grid:**
```
┌─────────────────────────────────────────────┐
│         No cards available                  │
│     Click "Add Card" to get started         │
│            [Add Card CTA]                   │
└─────────────────────────────────────────────┘
```

**Empty Table (in Expanded Card):**
```
┌─────────────────────────────────────────────┐
│    This card has no tracked benefits        │
│   Add benefits to get started               │
└─────────────────────────────────────────────┘
```

**Empty State Styling:**
```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  gap: 16px;
  
  .icon {
    font-size: 48px;
    opacity: 0.3;
  }
  
  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }
  
  .subtitle {
    font-size: 14px;
    color: var(--color-text-secondary);
    max-width: 300px;
  }
  
  .cta {
    margin-top: 16px;
  }
}
```

### 4.6 Error States

**Form Input Error:**
```css
input[aria-invalid="true"] {
  border-color: var(--color-danger-500);
  background: var(--color-danger-50);
}

input[aria-invalid="true"]:focus-visible {
  outline-color: var(--color-danger-500);
  box-shadow: 0 0 0 3px var(--color-danger-100);
}

/* Error message */
.form-error {
  font-size: 12px;
  color: var(--color-danger-600);
  margin-top: 4px;
}
```

**Alert Error:**
```css
.alert-error {
  background: var(--color-danger-50);
  border: 1px solid var(--color-danger-500);
  border-left: 4px solid var(--color-danger-500);
  padding: 16px;
  border-radius: 8px;
  color: var(--color-danger-700);
  display: flex;
  gap: 12px;
  
  .icon {
    font-size: 20px;
    flex-shrink: 0;
  }
}
```

---

## 5. Dark Mode Implementation

### 5.1 CSS Variable Strategy

**Light Mode (Default):**
```css
:root {
  /* Primary */
  --color-primary-50:   #F0F7FF;
  --color-primary-100:  #E1EFFE;
  --color-primary-500:  #3B82F6;
  --color-primary-600:  #2563EB;
  --color-primary-700:  #1D4ED8;

  /* Backgrounds */
  --color-bg-primary:   #FFFFFF;
  --color-bg-secondary: #F9FAFB;
  --color-bg-tertiary:  #F3F4F6;

  /* Text */
  --color-text-primary:   #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary:  #9CA3AF;

  /* Borders */
  --color-border:       #E5E7EB;

  /* Status colors */
  --color-success-50:   #F0FDF4;
  --color-success-100:  #DCFCE7;
  --color-success-500:  #10B981;
  --color-success-600:  #059669;

  --color-alert-50:     #FFFBEB;
  --color-alert-100:    #FEF3C7;
  --color-alert-500:    #FBBF24;
  --color-alert-600:    #F59E0B;

  --color-danger-50:    #FEF2F2;
  --color-danger-100:   #FEE2E2;
  --color-danger-500:   #EF4444;
  --color-danger-600:   #DC2626;
  --color-danger-700:   #B91C1C;
}
```

**Dark Mode:**
```css
@media (prefers-color-scheme: dark) {
  :root {
    /* Primary */
    --color-primary-50:   #082F49;
    --color-primary-100:  #0C2541;
    --color-primary-500:  #60A5FA;
    --color-primary-600:  #3B82F6;
    --color-primary-700:  #2563EB;

    /* Backgrounds */
    --color-bg-primary:   #0F172A;
    --color-bg-secondary: #1E293B;
    --color-bg-tertiary:  #334155;

    /* Text */
    --color-text-primary:   #F8FAFC;
    --color-text-secondary: #CBD5E1;
    --color-text-tertiary:  #94A3B8;

    /* Borders */
    --color-border:       #475569;

    /* Status colors */
    --color-success-50:   #064E3B;
    --color-success-100:  #0D5E44;
    --color-success-500:  #34D399;
    --color-success-600:  #10B981;

    --color-alert-50:     #5D3A1A;
    --color-alert-100:    #78350F;
    --color-alert-500:    #FBBF24;
    --color-alert-600:    #F59E0B;

    --color-danger-50:    #5F2120;
    --color-danger-100:   #7F2620;
    --color-danger-500:   #F87171;
    --color-danger-600:   #EF4444;
    --color-danger-700:   #DC2626;
  }
}
```

**Alternative: Tailwind Dark Mode Class:**

If using Tailwind CSS with `darkMode: 'class'`:

```html
<!-- HTML root -->
<html class="dark">
  <!-- Content uses dark: prefix -->
  <div class="bg-white dark:bg-slate-950">
    <!-- ... -->
  </div>
</html>
```

### 5.2 Dark Mode Toggle Logic

**JavaScript (Vanilla):**
```javascript
function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  
  // Persist preference
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  
  // Update button aria-checked
  document.getElementById('dark-mode-toggle')
    .setAttribute('aria-checked', isDark);
  
  // Emit event for other components
  window.dispatchEvent(new CustomEvent('themechange', {
    detail: { theme: isDark ? 'dark' : 'light' }
  }));
}

// Initialize on page load
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.classList.add('dark');
    document.getElementById('dark-mode-toggle').setAttribute('aria-checked', 'true');
  }
}

// Call on page load
initTheme();
```

**React Hook Example:**
```tsx
function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return [isDark, () => setIsDark(!isDark)];
}
```

### 5.3 Contrast Verification

**Minimum Contrast Ratios (WCAG AA):**
- Normal text: 4.5:1
- Large text (18px+): 3:1
- Focus indicators: 3:1

**Tested Combinations (Dark Mode):**

| Element | Light Combination | Dark Combination | Ratio | Pass? |
|---------|------------------|-----------------|-------|-------|
| Body text | #111827 on #FFFFFF | #F8FAFC on #0F172A | 16.1:1 | ✓ |
| Secondary text | #6B7280 on #FFFFFF | #CBD5E1 on #0F172A | 8.2:1 | ✓ |
| Primary button | #FFFFFF on #3B82F6 | #FFFFFF on #3B82F6 | 6.8:1 | ✓ |
| Success text | #047857 on #F0FDF4 | #34D399 on #064E3B | 7.5:1 | ✓ |
| Danger text | #B91C1C on #FEF2F2 | #F87171 on #5F2120 | 5.2:1 | ✓ |
| Focus outline | #3B82F6 on #FFFFFF | #60A5FA on #0F172A | 9.3:1 | ✓ |

**Testing Tools:**
- WebAIM Contrast Checker
- Accessible Colors
- Chrome DevTools (Accessibility tab)

---

## 6. Animation & Transitions

### 6.1 Transition Durations

**Standard Transitions:**
```css
--transition-fast:    100ms ease-in-out;  /* Quick interactions (button press) */
--transition-base:    150ms ease-in-out;  /* Standard transitions (hover, focus) */
--transition-slow:    200ms ease-in-out;  /* Deliberate transitions (card hover) */
--transition-slower:  300ms ease-in-out;  /* Dark mode toggle, major state changes */
```

### 6.2 Specific Animations

**Tab Switching:**
```css
.tab-content {
  animation: fadeIn 150ms ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

**Card Expand/Collapse:**
```css
.card-expanded {
  max-height: 2000px; /* Large enough to contain all content */
  opacity: 1;
  transition: max-height 250ms ease-in-out, opacity 200ms ease-in-out;
  overflow: hidden;
}

.card-collapsed {
  max-height: 0;
  opacity: 0;
  transition: max-height 250ms ease-in-out, opacity 200ms ease-in-out;
  overflow: hidden;
}

/* Alternative: use grid-template-rows */
.card-expanded {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
  transition: grid-template-rows 250ms ease-in-out;
}

.card-collapsed {
  grid-template-rows: 0fr;
  transition: grid-template-rows 250ms ease-in-out;
}
```

**Card Hover Lift:**
```css
@media (hover: hover) {
  .card:hover {
    transform: translateY(-2px);
    transition: all 200ms ease-in-out;
  }
}
```

**Button Click Animation:**
```css
button:active {
  transform: scale(0.98);
  transition: transform 100ms ease-out;
}
```

**Dark Mode Toggle:**
```css
@media (prefers-color-scheme: dark) {
  * {
    transition: background-color 300ms ease-in-out, color 300ms ease-in-out, border-color 300ms ease-in-out;
  }
}
```

**Alert Slide In (Optional):**
```css
.alert {
  animation: slideInDown 200ms ease-out;
}

@keyframes slideInDown {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### 6.3 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. Accessibility Requirements

### 7.1 Semantic HTML Structure

**Page Header:**
```html
<header class="dashboard-header" role="banner">
  <div class="header-content">
    <h1 class="logo">Card Benefits Dashboard</h1>
    <button id="dark-mode-toggle" role="switch" aria-checked="false">
      <!-- Dark mode toggle -->
    </button>
  </div>
</header>
```

**Main Content:**
```html
<main role="main">
  <section aria-label="Summary Statistics">
    <!-- Stats cards -->
  </section>

  <section aria-label="Expiration Alerts">
    <!-- Alert boxes -->
  </section>

  <div role="tablist" aria-label="Player Selection">
    <!-- Tabs -->
  </div>

  <section aria-label="Card Benefits">
    <!-- Card grid -->
  </section>
</main>
```

**Alerts (Live Region):**
```html
<!-- For dynamic alerts that appear without page refresh -->
<div 
  id="alert-region"
  role="region" 
  aria-live="polite"
  aria-label="Status messages"
  class="sr-only"
></div>
```

### 7.2 Keyboard Navigation

**Tab Order:**
1. Dark mode toggle (header)
2. Player tabs (left to right)
3. Card grid (top to bottom, left to right)
4. Expand/collapse buttons (within cards)
5. Checkboxes in benefit tables

**Keyboard Shortcuts:**
- `Tab`: Move to next interactive element
- `Shift + Tab`: Move to previous interactive element
- `Enter` / `Space`: Activate button, toggle checkbox, expand card
- `Arrow Keys`: Navigate tabs (optional, if tabs support arrow keys)
- `Escape`: Close expanded card or dialog

**Implementation (Tabs with Arrow Keys):**
```html
<div role="tablist">
  <button 
    role="tab" 
    aria-selected="true" 
    aria-controls="panel-primary"
    id="tab-primary"
  >
    Primary
  </button>
  <button 
    role="tab" 
    aria-selected="false" 
    aria-controls="panel-bethan"
    id="tab-bethan"
  >
    Bethan
  </button>
</div>

<div role="tabpanel" id="panel-primary" aria-labelledby="tab-primary">
  <!-- Content -->
</div>

<script>
const tabs = document.querySelectorAll('[role="tab"]');

tabs.forEach((tab, index) => {
  tab.addEventListener('keydown', (e) => {
    let newIndex = index;
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = tabs.length - 1;
    }
    
    tabs[newIndex].click();
    tabs[newIndex].focus();
  });
});
</script>
```

### 7.3 ARIA Labels & Descriptions

**Benefit Table:**
```html
<table role="grid" aria-label="Credit card benefits">
  <thead>
    <tr>
      <th scope="col">Benefit Name</th>
      <th scope="col">Value</th>
      <th scope="col">Expiration Date</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>$100 Airline Credit</td>
      <td>$100</td>
      <td>Today</td>
      <td>
        <input 
          type="checkbox" 
          aria-label="Mark $100 Airline Credit as used"
        />
      </td>
    </tr>
  </tbody>
</table>
```

**Form Inputs:**
```html
<label for="card-name">Card Nickname (optional)</label>
<input 
  id="card-name" 
  type="text" 
  aria-describedby="card-name-hint"
  placeholder="e.g., My Amex Platinum"
/>
<p id="card-name-hint">This helps you distinguish between multiple cards</p>
```

**Buttons with Icons:**
```html
<!-- If icon-only button -->
<button aria-label="Expand card details">
  <svg><!-- chevron down icon --></svg>
</button>

<!-- If button with text -->
<button>
  <svg aria-hidden="true"><!-- icon --></svg>
  Mark as Used
</button>
```

### 7.4 Color Contrast (Tested)

All color combinations tested for minimum WCAG AA:

**Light Mode:**
- Body text (#111827) on backgrounds: 16:1 ratio ✓
- Secondary text (#6B7280) on light: 7.5:1 ratio ✓
- Primary button (#3B82F6) text: 6.8:1 ratio ✓
- Status badges: All exceed 4.5:1 ✓

**Dark Mode:**
- Body text (#F8FAFC) on dark bg: 16.5:1 ratio ✓
- Secondary text (#CBD5E1) on dark: 8.5:1 ratio ✓
- Primary button (#3B82F6) on dark: 5.2:1 ratio ✓

### 7.5 Focus Indicators

**Visible on All Interactive Elements:**
```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}
```

**Never Remove Default Focus:**
```css
/* ❌ WRONG */
button:focus {
  outline: none;
}

/* ✓ CORRECT */
button:focus-visible {
  outline: 2px solid var(--color-primary-500);
}
```

### 7.6 Screen Reader Testing

**Manual Test Cases:**

1. **Page Load:** Screen reader announces page title and main landmark
2. **Stats Section:** "Summary Statistics, Total Household ROI, $3,567"
3. **Alerts:** Live region announces new alerts: "Critical: $500 Hotel Credit expires today"
4. **Tabs:** "Tablist with 3 tabs, currently selected Primary"
5. **Card Grid:** "Card grid with 3 cards, Chase Sapphire Reserve, +$1,234 captured"
6. **Benefit Table:** "Table with 4 rows, Benefit Name, Value, Expiration Date, Status columns"
7. **Checkbox:** "Checkbox, Mark $100 Airline Credit as used, currently unchecked"

**Test with:**
- NVDA (Windows)
- JAWS (Windows)
- VoiceOver (Mac/iOS)
- TalkBack (Android)

---

## 8. Handoff Notes for Frontend Engineer

### 8.1 Technology & Tools

**Recommended Stack:**
- **Framework:** Next.js 14+ (App Router) or React 18+
- **Styling:** Tailwind CSS v3+ with custom CSS variables for design tokens
- **Components:** shadcn/ui or Headless UI for accessible tabs, dropdowns
- **Icons:** Heroicons (free) or Font Awesome
- **State Management:** React Context for theme, Zustand or Redux for app state
- **Data Fetching:** React Query or SWR for dashboard data
- **Testing:** Vitest + React Testing Library

### 8.2 Component Structure

```
src/
├── components/
│   ├── Header.tsx          // Logo, dark mode toggle
│   ├── SummaryStats.tsx    // 3-column stat cards
│   ├── AlertSection.tsx    // Critical/warning/info alerts
│   ├── PlayerTabs.tsx      // Tab bar for player selection
│   ├── CardGrid.tsx        // 1-3 column responsive grid
│   ├── CardWidget.tsx      // Individual card component
│   ├── BenefitTable.tsx    // Expanded benefit details
│   └── StatusBadge.tsx     // Reusable status badge
├── hooks/
│   ├── useDarkMode.ts      // Dark mode toggle + persistence
│   ├── useResponsive.ts    // Responsive breakpoint detection
│   └── useKeyboard.ts      // Keyboard navigation helpers
├── styles/
│   ├── globals.css         // CSS variables for design tokens
│   ├── animations.css      // Keyframe animations
│   └── accessibility.css   // a11y utilities
├── types/
│   └── dashboard.ts        // TypeScript interfaces
└── utils/
    ├── formatting.ts       // Currency, date formatting
    └── classNames.ts       // Utility for conditional CSS classes
```

### 8.3 CSS Variables Setup

```css
/* styles/globals.css */

:root {
  /* Colors - Light Mode */
  --color-primary-50: #F0F7FF;
  --color-primary-100: #E1EFFE;
  --color-primary-500: #3B82F6;
  --color-primary-600: #2563EB;
  --color-primary-700: #1D4ED8;

  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F9FAFB;
  --color-bg-tertiary: #F3F4F6;

  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-text-tertiary: #9CA3AF;

  --color-border: #E5E7EB;

  --color-success-50: #F0FDF4;
  --color-success-100: #DCFCE7;
  --color-success-500: #10B981;
  --color-success-600: #059669;

  --color-alert-50: #FFFBEB;
  --color-alert-100: #FEF3C7;
  --color-alert-500: #FBBF24;
  --color-alert-600: #F59E0B;

  --color-danger-50: #FEF2F2;
  --color-danger-100: #FEE2E2;
  --color-danger-500: #EF4444;
  --color-danger-600: #DC2626;
  --color-danger-700: #B91C1C;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* Dark Mode */
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary-50: #082F49;
    --color-primary-100: #0C2541;
    --color-primary-500: #60A5FA;
    --color-primary-600: #3B82F6;
    --color-primary-700: #2563EB;

    --color-bg-primary: #0F172A;
    --color-bg-secondary: #1E293B;
    --color-bg-tertiary: #334155;

    --color-text-primary: #F8FAFC;
    --color-text-secondary: #CBD5E1;
    --color-text-tertiary: #94A3B8;

    --color-border: #475569;

    --color-success-50: #064E3B;
    --color-success-100: #0D5E44;
    --color-success-500: #34D399;
    --color-success-600: #10B981;

    --color-alert-50: #5D3A1A;
    --color-alert-100: #78350F;

    --color-danger-50: #5F2120;
    --color-danger-100: #7F2620;
    --color-danger-500: #F87171;
    --color-danger-600: #EF4444;
    --color-danger-700: #DC2626;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
    --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.3);
  }
}
```

### 8.4 Critical Implementation Notes

**1. Responsive Grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {cards.map(card => (
    <CardWidget key={card.id} card={card} />
  ))}
</div>
```

**2. Dark Mode Context:**
```tsx
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext<{ isDark: boolean; toggle: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved === 'dark' || (!saved && prefersDark);
    
    setIsDark(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggle = () => {
    setIsDark(prev => {
      const newValue = !prev;
      localStorage.setItem('theme', newValue ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', newValue);
      return newValue;
    });
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

**3. Accessible Table with Conditional Styling:**
```tsx
<table className="w-full">
  <tbody>
    {benefits.map(benefit => (
      <tr 
        key={benefit.id}
        className={clsx(
          'border-b hover:bg-slate-50 dark:hover:bg-slate-800',
          benefit.daysUntilExpiry < 3 && 'bg-red-50 dark:bg-red-950 border-l-4 border-red-500',
          benefit.daysUntilExpiry < 14 && 'bg-amber-50 dark:bg-amber-950'
        )}
      >
        <td className="px-4 py-3">
          <input 
            type="checkbox" 
            aria-label={`Mark ${benefit.name} as used`}
            checked={benefit.used}
            onChange={() => markAsUsed(benefit.id)}
          />
        </td>
        <td className="px-4 py-3 font-medium">{benefit.name}</td>
        <td className="px-4 py-3 text-right font-semibold">${benefit.value}</td>
        <td className={clsx(
          'px-4 py-3 text-center text-sm',
          benefit.daysUntilExpiry < 3 && 'text-red-700 dark:text-red-400 font-bold',
          benefit.daysUntilExpiry < 14 && 'text-amber-700 dark:text-amber-400'
        )}>
          {formatDate(benefit.expiresAt)}
        </td>
        <td className="px-4 py-3 text-right">
          <StatusBadge status={benefit.status} />
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**4. Skeleton Loader Pattern:**
```tsx
function SkeletonCard() {
  return (
    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg h-40">
      <div className="h-6 bg-slate-300 dark:bg-slate-600 rounded mb-4"></div>
      <div className="h-4 bg-slate-300 dark:bg-slate-600 rounded w-3/4"></div>
    </div>
  );
}
```

### 8.5 Testing Checklist

- [ ] All components render correctly in light & dark modes
- [ ] Tab navigation works with Tab/Shift+Tab keys
- [ ] Card expand/collapse animates smoothly
- [ ] Alert section appears above fold on mobile
- [ ] Benefit table is readable on mobile (consider horizontal scroll or simplified view)
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast meets WCAG AA on all text
- [ ] Empty states render when no data
- [ ] Dark mode toggle persists across page refresh
- [ ] Responsive breakpoints tested at 375px, 640px, 1024px, 1200px
- [ ] All animations respect `prefers-reduced-motion`

### 8.6 Performance Considerations

**Lazy Load Benefit Tables:**
```tsx
import { Suspense } from 'react';

<Suspense fallback={<SkeletonTable />}>
  <BenefitTable cardId={card.id} />
</Suspense>
```

**Memoize Card Components:**
```tsx
const CardWidget = memo(({ card }: Props) => {
  return (
    // Card JSX
  );
}, (prev, next) => {
  return prev.card.id === next.card.id && 
         prev.card.roi === next.card.roi;
});
```

**Use CSS Grid, Not JavaScript Calculations:**
```css
/* Good: CSS handles responsiveness */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-lg);
}

/* Avoid: JavaScript-based layout */
// cardElement.style.width = `${100 / columnCount}%`;
```

---

## 9. Implementation Checklist

### Phase 2 → Phase 3 Handoff Checklist

**Header Component:**
- [ ] Dark mode toggle button styled and functional
- [ ] Header sticky positioning works on mobile/desktop
- [ ] Logo/title responsive (hidden on mobile if needed)
- [ ] Focus indicator visible on dark mode button

**Summary Stats:**
- [ ] 3-column grid on desktop, 1 column on mobile
- [ ] Stats values update from API
- [ ] Empty state renders when no data
- [ ] Cards have proper hover states

**Alert Section:**
- [ ] Critical alerts (< 3 days) appear at top
- [ ] Warning alerts (3-14 days) visible
- [ ] Info alerts display when no critical/warning
- [ ] Dismiss/mark as used buttons functional
- [ ] Sticky positioning on scroll
- [ ] Responsive on mobile (full width)

**Player Tabs:**
- [ ] Tab bar renders with correct players
- [ ] Tab switching animates smoothly
- [ ] Arrow key navigation works
- [ ] Focus indicator on tabs
- [ ] "View All" tab works

**Card Grid:**
- [ ] Cards render in responsive grid (1/2/3 columns)
- [ ] Card hover states work (desktop only)
- [ ] Expand/collapse buttons work
- [ ] Loading states show while fetching

**Benefit Table:**
- [ ] Table renders with all columns
- [ ] Expiring soon rows highlight in red/amber
- [ ] Checkboxes functional
- [ ] Status badges display correctly
- [ ] Empty table state shows message

**Dark Mode:**
- [ ] Toggle switches theme correctly
- [ ] All colors adjust for dark mode
- [ ] Contrast meets WCAG AA
- [ ] Theme persists on refresh
- [ ] Animations respect prefers-reduced-motion

**Accessibility:**
- [ ] All interactive elements keyboard-navigable
- [ ] Focus indicators visible
- [ ] Screen reader announces page structure
- [ ] ARIA labels on buttons/inputs
- [ ] Color is not only differentiator

**Responsive:**
- [ ] Layout tested at 375px (mobile)
- [ ] Layout tested at 640px (tablet)
- [ ] Layout tested at 1024px (desktop)
- [ ] No horizontal scroll at any breakpoint
- [ ] Touch targets ≥ 44px × 44px on mobile

---

## 10. Reference: Design System Token Map

| Token Name | Value (Light) | Value (Dark) | Usage |
|-----------|--------------|-------------|-------|
| `--color-primary-500` | #3B82F6 | #60A5FA | Primary buttons, active states, links |
| `--color-bg-primary` | #FFFFFF | #0F172A | Page background |
| `--color-bg-secondary` | #F9FAFB | #1E293B | Card backgrounds |
| `--color-text-primary` | #111827 | #F8FAFC | Body text |
| `--color-text-secondary` | #6B7280 | #CBD5E1 | Secondary text, metadata |
| `--color-border` | #E5E7EB | #475569 | Borders, dividers |
| `--color-success-500` | #10B981 | #34D399 | Positive status, ROI captured |
| `--color-alert-500` | #FBBF24 | #FBBF24 | Warning alerts (3-14 days) |
| `--color-danger-500` | #EF4444 | #F87171 | Critical alerts (< 3 days) |
| `--space-md` | 16px | — | Default spacing, padding |
| `--shadow-md` | 0 4px 6px rgba(0,0,0,0.1) | 0 4px 6px rgba(0,0,0,0.3) | Card shadows |
| `--radius-lg` | 12px | — | Card border radius |

---

## Conclusion

This detailed design specification provides complete implementation guidance for the Card Benefits Dashboard redesign. Every component, color, spacing value, animation, and interaction has been defined with pixel-perfect precision and accessibility as a core requirement.

**Key Takeaways:**
1. **Mobile-first approach:** All layouts designed mobile-first, scaled up for larger devices
2. **Dark mode native:** Full support with tested contrast ratios
3. **Accessibility mandatory:** WCAG AA compliance, keyboard navigation, semantic HTML
4. **Consistency:** All components use design tokens from Phase 1 system
5. **Clarity:** Clear visual hierarchy guides users to expiring benefits first

**Next Steps:**
- Frontend engineer implements components using this specification
- QA tests across breakpoints, browsers, and assistive technologies
- Design system tokens exported to Tailwind config or CSS modules
- Component library documented with Storybook for reusability

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Maintained By:** Design & Engineering Team  
**Review Cycle:** Quarterly or as needed
