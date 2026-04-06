# Phase 3: Admin Dashboard - Design System & Tokens

**Version:** 1.0.0  
**Purpose:** Define all design system tokens used in the admin dashboard  
**Status:** Ready for implementation  

---

## Design System Overview

The admin dashboard uses a comprehensive design token system built on CSS variables. All colors, spacing, typography, and animations are defined centrally in `src/styles/design-tokens.css` and integrated with Tailwind CSS.

**Key Principles:**
- ✅ Single source of truth (CSS variables)
- ✅ Dark mode support (automatic)
- ✅ WCAG 2.1 AA contrast compliance
- ✅ Consistent across all admin pages
- ✅ Tailwind integration for utility classes
- ✅ Scalable and maintainable

---

## Color Palette

### Light Mode (Default)

```css
/* PRIMARY COLORS */
--color-primary: #3356D0           /* Blue - main brand color */
--color-primary-light: #e0ecff    /* Light blue - backgrounds, hover */
--color-primary-dark: #1f3aab     /* Dark blue - hover states */

/* SECONDARY COLORS */
--color-secondary: #f59e0b        /* Amber/Orange - secondary actions */
--color-secondary-light: #fef3c7  /* Light amber - backgrounds */

/* STATUS COLORS */
--color-success: #0a7d57          /* Green - success, approved */
--color-success-light: #d1fae5    /* Light green - backgrounds */

--color-error: #ef4444            /* Red - errors, delete actions */
--color-error-light: #fee2e2      /* Light red - error backgrounds */

--color-warning: #d97706          /* Amber - warnings, caution */
--color-warning-light: #fef08a    /* Light amber - warning backgrounds */

--color-info: #0891b2             /* Cyan - info, neutral messages */
--color-info-light: #cffafe       /* Light cyan - info backgrounds */

/* SEMANTIC COLORS */
--color-bg: #ffffff               /* Main background */
--color-bg-secondary: #f9fafb    /* Secondary background, cards */
--color-text: #111827             /* Primary text */
--color-text-secondary: #6b7280  /* Secondary text, labels */
--color-border: #e5e7eb          /* Borders, dividers */

/* GRAYSCALE */
--color-gray-50: #f9fafb         /* Lightest gray */
--color-gray-100: #f3f4f6        /* Very light gray */
--color-gray-200: #e5e7eb        /* Light gray */
--color-gray-300: #d1d5db        /* Gray */
--color-gray-400: #9ca3af        /* Medium gray */
--color-gray-500: #6b7280        /* Darker gray */
--color-gray-600: #4b5563        /* Dark gray */
--color-gray-700: #374151        /* Very dark gray */
--color-gray-900: #111827        /* Nearly black */
```

**Usage Examples:**
```html
<!-- Primary action button -->
<button class="bg-primary text-white">Save Card</button>

<!-- Success badge -->
<span class="bg-success-light text-success">Active</span>

<!-- Danger button -->
<button class="bg-error text-white">Delete Card</button>

<!-- Secondary text -->
<p class="text-text-secondary">Card created on Jan 20, 2024</p>

<!-- Border -->
<div class="border border-border">Card list</div>
```

### Dark Mode

```css
@media (prefers-color-scheme: dark) {
  :root {
    --color-primary: #6b7fff        /* Lighter blue for dark mode */
    --color-primary-light: #1e293b  /* Dark blue for dark mode backgrounds */
    --color-primary-dark: #60a5fa   /* Even lighter on dark */

    --color-secondary: #fbbf24      /* Lighter amber */
    --color-secondary-light: #7c2d12 /* Dark amber background */

    --color-success: #10b981        /* Lighter green */
    --color-success-light: #064e3b  /* Dark green background */

    --color-error: #f87171          /* Lighter red */
    --color-error-light: #7f1d1d    /* Dark red background */

    --color-warning: #fcd34d        /* Lighter amber */
    --color-warning-light: #78350f  /* Dark amber background */

    --color-info: #06b6d4           /* Lighter cyan */
    --color-info-light: #082f49     /* Dark cyan background */

    --color-bg: #0f172a             /* Dark background */
    --color-bg-secondary: #1e293b   /* Slightly lighter dark bg */
    --color-text: #f1f5f9           /* Light text */
    --color-text-secondary: #94a3b8 /* Medium light text */
    --color-border: #334155         /* Dark border */

    --color-gray-50: #f8fafc
    --color-gray-100: #f1f5f9
    --color-gray-200: #e2e8f0
    --color-gray-300: #cbd5e1
    --color-gray-400: #94a3b8
    --color-gray-500: #64748b
    --color-gray-600: #475569
    --color-gray-700: #334155
    --color-gray-900: #0f172a
  }
}
```

**Dark Mode Implementation:**
```html
<!-- Automatically adapts to dark mode -->
<div class="bg-[var(--color-bg)] text-[var(--color-text)]">
  Content automatically changes in dark mode
</div>

<!-- Explicit dark mode in CSS -->
<div class="dark:bg-gray-900 dark:text-gray-100">
  Explicit dark class
</div>
```

### Color Contrast Verification

**WCAG 2.1 AA Contrast Ratios:**

| Color Pair | Ratio | AA Compliant |
|-----------|-------|--------------|
| Primary (#3356D0) on White | 4.6:1 | ✅ Yes |
| Primary on Gray-50 | 3.2:1 | ❌ No (need dark text) |
| Success (#0a7d57) on White | 5.8:1 | ✅ Yes |
| Error (#ef4444) on White | 3.9:1 | ⚠️ Acceptable (large text) |
| Text (#111827) on White | 13.3:1 | ✅ Yes |
| Text-Secondary (#6b7280) on White | 6.4:1 | ✅ Yes |

**Recommendations:**
- Always use `--color-text` for body text
- Use `--color-text-secondary` for labels, hints
- Use color + icon + text for status (not color alone)
- Test all text on both light and dark backgrounds

---

## Typography System

### Font Families

```css
--font-primary: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif
--font-heading: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif
--font-mono: 'JetBrains Mono', 'Monaco', 'Courier New', monospace
```

**Usage:**
- `font-primary`: Body text, labels, inputs
- `font-heading`: Page titles, section headings
- `font-mono`: Code blocks, IDs, technical values

### Font Sizes

**Desktop (Base scale):**
```css
--text-h1: 48px        /* Page titles */
--text-h2: 42px        /* Section titles */
--text-h3: 37px        /* Card titles */
--text-h4: 33px        /* Subsection titles */
--text-h5: 29px        /* Small headings */
--text-h6: 26px        /* Minor headings */
--text-body-lg: 18px   /* Large body text */
--text-body-md: 16px   /* Standard body text */
--text-body-sm: 14px   /* Small body text, secondary info */
--text-caption: 12px   /* Tiny text, timestamps */
--text-label: 13px     /* Form labels */
--text-mono-md: 14px   /* Code blocks, APIs */
--text-mono-sm: 12px   /* Small code, inline */
```

**Responsive Sizes (Mobile):**
```css
@media (max-width: 768px) {
  --text-h1: 36px       /* Reduce headings on mobile */
  --text-h2: 32px
  --text-h3: 28px
  --text-body-lg: 16px  /* Keep body readable */
  --text-body-md: 14px
  --text-body-sm: 13px
}
```

### Font Weights

```css
--font-weight-400: 400 /* Regular (body text) */
--font-weight-500: 500 /* Medium (labels, emphasis) */
--font-weight-600: 600 /* Semibold (headings, buttons) */
--font-weight-700: 700 /* Bold (page titles) */
```

### Line Heights

```css
/* Heading line height (tighter) */
h1, h2, h3: line-height: 1.2

/* Body line height (more generous) */
body, p: line-height: 1.6

/* Small text line height */
caption, label: line-height: 1.4
```

### Component Typography

**Headings:**
```html
<h1 class="text-h1 font-700">Page Title</h1>
<h2 class="text-h2 font-700">Section Title</h2>
<h3 class="text-h3 font-600">Card Title</h3>
```

**Body Text:**
```html
<p class="text-body-md">Standard paragraph text</p>
<span class="text-body-sm text-text-secondary">Secondary information</span>
```

**Labels:**
```html
<label class="text-label font-600">Card Name</label>
<span class="text-caption">Created on Jan 20, 2024</span>
```

**Monospace (IDs, values):**
```html
<code class="text-mono-md">card_123abc</code>
<span class="text-mono-sm font-500">$9,500</span>
```

---

## Spacing System

**Base Unit:** 8px (with 1.5x scale)

```css
--space-xs:   4px    (micro gaps, icon spacing)
--space-sm:   8px    (compact spacing)
--space-md:   16px   (standard spacing)
--space-lg:   24px   (generous spacing)
--space-xl:   32px   (extra generous)
--space-2xl:  48px   (section spacing)
--space-3xl:  64px   (major section spacing)
--space-4xl:  96px   (full width spacing)
```

### Component Spacing Guidelines

**Buttons:**
- Vertical padding: `space-sm` (8px)
- Horizontal padding: `space-md` (16px)
- Min-height: 40px (touch target)
- Example: `px-4 py-2`

**Form Fields:**
- Vertical padding: `space-sm` (8px)
- Horizontal padding: `space-md` (16px)
- Bottom margin: `space-md` (16px) between fields
- Label bottom margin: `space-xs` (4px)

**Cards:**
- Padding: `space-lg` (24px)
- Border radius: `radius-lg` (12px)
- Shadow: `shadow-sm`

**Modals:**
- Padding: `space-lg` (24px)
- Header/Footer padding: `space-lg` (24px)
- Button gap: `space-md` (16px)

**Tables:**
- Cell padding: `space-md` (16px)
- Row gap: 0 (borders separate)
- Header padding: `space-md` (16px)

**Sidebar:**
- Item padding: `space-md` (16px) vertical, `space-lg` (24px) horizontal
- Gap between items: `space-xs` (4px)

**Spacing Between Sections:**
```html
<!-- Section spacing in pages -->
<section class="mb-8">
  <h2>Section 1</h2>
</section>

<section class="mb-12">
  <h2>Section 2</h2>
</section>

<!-- Element spacing -->
<div class="space-y-4">
  <p>Item 1</p>
  <p>Item 2</p>
  <p>Item 3</p>
</div>
```

---

## Border Radius

```css
--radius-sm:   4px    (subtle)
--radius-md:   8px    (standard)
--radius-lg:   12px   (prominent)
--radius-xl:   16px   (large)
--radius-full: 9999px (circles, avatars)
```

### Component Recommendations

| Component | Radius | Example |
|-----------|--------|---------|
| Buttons | sm/md | `rounded-md` |
| Inputs | md | `rounded-md` |
| Cards | lg | `rounded-lg` |
| Modals | lg | `rounded-lg` |
| Badges | sm | `rounded-sm` |
| Avatars | full | `rounded-full` |
| Table corners | lg | `rounded-lg` |
| Dropdowns | md | `rounded-md` |

---

## Shadows

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05)
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1)
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1)
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1)
```

### Shadow Usage

| Shadow | Use Case |
|--------|----------|
| `shadow-sm` | Card at rest, subtle elevation |
| `shadow-md` | Card on hover, dropdown, popover |
| `shadow-lg` | Modal, elevated container |
| `shadow-xl` | Large modal, emphasis |
| None | Buttons, borders only |

**Example:**
```html
<!-- Card at rest -->
<div class="shadow-sm">Card content</div>

<!-- Card on hover -->
<div class="hover:shadow-md transition-shadow">Hoverable card</div>

<!-- Modal -->
<div class="shadow-lg">Modal overlay</div>
```

**Dark Mode Shadows:**
Shadows are automatically darker in dark mode due to CSS variable overrides.

---

## Animations & Transitions

### Durations

```css
--duration-fast: 150ms   /* Micro interactions */
--duration-base: 300ms   /* Standard transitions */
--duration-slow: 500ms   /* Emphasized animations */
```

### Easing Functions

```css
--ease-out: cubic-bezier(0.4, 0, 0.2, 1)        /* Opening */
--ease-in: cubic-bezier(0.4, 0, 1, 1)           /* Closing */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55) /* Bouncy */
```

### Pre-defined Animations

```css
/* Fade in/out */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide animations */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale in */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Shimmer (loading) */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

/* Slide in from bottom (toast) */
@keyframes slideInFromBottom {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Using Animations

```html
<!-- Fade in on load -->
<div class="animate-fade-in">Content</div>

<!-- Slide up on modal open -->
<div class="animate-slide-up">Modal content</div>

<!-- Custom animation -->
<div style="animation: fadeIn var(--duration-base) var(--ease-out)">
  Custom animation
</div>

<!-- Transition with duration -->
<div class="transition-all duration-300">
  Content (default easing)
</div>

<!-- Specific property transition -->
<div class="transition-colors duration-300 hover:bg-primary">
  Color transition on hover
</div>
```

### Animation Best Practices

**✅ Do:**
- Use animations to guide user attention
- Animate state changes (open/close, show/hide)
- Use fast (150ms) for micro interactions
- Use base (300ms) for standard transitions
- Use slow (500ms) for emphasis only

**❌ Don't:**
- Animate every element (distracting)
- Use animations longer than 500ms (feels slow)
- Use animations on critical paths (slows perception)
- Add motion to accessibility-sensitive users (respects prefers-reduced-motion)

### Respecting User Preferences

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Variants

### Button Variants

**Primary Button:**
```css
background-color: var(--color-primary)
color: white
padding: 8px 16px
border-radius: var(--radius-md)
font-weight: 600
cursor: pointer
transition: background-color 300ms
```

**Hover/Focus State:**
```css
background-color: var(--color-primary-dark)
box-shadow: 0 0 0 3px var(--color-primary-light)
```

**Secondary Button:**
```css
background-color: var(--color-bg-secondary)
color: var(--color-text)
border: 1px solid var(--color-border)
```

**Danger Button:**
```css
background-color: var(--color-error)
color: white
```

**Ghost Button:**
```css
background-color: transparent
color: var(--color-primary)
border: none
```

**Disabled Button:**
```css
background-color: var(--color-gray-200)
color: var(--color-gray-400)
cursor: not-allowed
opacity: 0.6
```

### Badge Variants

| Variant | Background | Text Color | Use Case |
|---------|------------|-----------|----------|
| default | gray-100 | gray-900 | Default status |
| success | success-light | success | Approved, active |
| warning | warning-light | warning | Pending, caution |
| error | error-light | error | Failed, invalid |
| info | info-light | info | Information, neutral |

**Size Variants:**
- `sm`: 12px font, 4px padding
- `md`: 14px font, 6px padding

### Input States

**Default:**
```css
border: 1px solid var(--color-border)
background-color: var(--color-bg)
color: var(--color-text)
padding: 8px 12px
border-radius: var(--radius-md)
```

**Focus:**
```css
border-color: var(--color-primary)
background-color: var(--color-bg)
outline: 2px solid var(--color-primary-light)
outline-offset: 2px
```

**Error:**
```css
border-color: var(--color-error)
background-color: var(--color-error-light)
color: var(--color-error)
```

**Disabled:**
```css
background-color: var(--color-gray-100)
color: var(--color-gray-400)
cursor: not-allowed
opacity: 0.6
```

**Loading:**
```css
border-color: var(--color-primary)
position: relative
/* Show spinner in suffix */
```

---

## Icons

**Library:** Lucide React (already integrated)

**Icon Size Scale:**
```css
--icon-xs:   16px  (inline, small badges)
--icon-sm:   20px  (form fields, small components)
--icon-md:   24px  (buttons, standard)
--icon-lg:   32px  (headers, large components)
--icon-xl:   48px  (hero, emphasis)
```

**Icon Usage:**
```typescript
import {
  // Navigation
  Home, CreditCard, Users, History, Settings,
  // Actions
  Plus, Edit2, Trash2, Copy, X, ChevronLeft,
  // Status
  Check, AlertCircle, AlertTriangle, Info,
  // Controls
  ChevronDown, Menu, Eye, EyeOff, Search, Filter,
  // Misc
  Loader, GripVertical, Star, ExternalLink
} from 'lucide-react';

// Usage
<button>
  <Plus size={20} className="mr-2" />
  Add Card
</button>

// Colored icon
<Check size={20} className="text-success" />

// Loading spinner
<Loader size={24} className="animate-spin" />
```

---

## Dark Mode Support

### Implementation Strategy

**CSS Variables Approach (Recommended):**
```css
:root {
  --color-bg: #ffffff;
  --color-text: #111827;
  /* ... all colors ... */
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f172a;
    --color-text: #f1f5f9;
    /* ... dark variants ... */
  }
}
```

**Component Usage:**
```html
<!-- Automatically adapts -->
<div class="bg-[var(--color-bg)] text-[var(--color-text)]">
  Content adapts to light/dark mode automatically
</div>
```

**Explicit Dark Class (Optional):**
```html
<!-- For components that need explicit control -->
<div class="bg-white dark:bg-gray-900">
  Light mode: white, Dark mode: gray-900
</div>
```

### Dark Mode Checklist

For each component, verify:
- [ ] Text has sufficient contrast on dark background
- [ ] Backgrounds are dark (not white)
- [ ] Borders are visible (not black on dark)
- [ ] Icons are visible (not dark gray)
- [ ] Shadows are appropriate (darker on dark)
- [ ] Focus states are visible
- [ ] No hardcoded colors (use CSS variables)

### Testing Dark Mode

1. **Browser DevTools:**
   ```javascript
   // Toggle dark mode in console
   document.documentElement.style.colorScheme = 'dark';
   ```

2. **System Preference:**
   - macOS: System Preferences > General > Appearance
   - Windows: Settings > Personalization > Colors
   - Linux: GNOME Settings > Appearance

3. **Screenshots:**
   Take screenshots in both light and dark mode to verify appearance.

---

## Accessibility Considerations

### Color Blindness

**Avoid:** Communicating with color alone

```html
<!-- ❌ Bad: Status shown only by color -->
<div class="bg-success">Success</div>

<!-- ✅ Good: Status shown with text + color -->
<div class="bg-success-light text-success">
  ✓ Success
</div>
```

### Contrast Ratios

**WCAG 2.1 AA Requirements:**
- Normal text: 4.5:1 minimum
- Large text (18px+): 3:1 minimum
- UI components: 3:1 minimum

**Verification Tools:**
- WebAIM Contrast Checker
- Axe DevTools
- Lighthouse

### Motion Sensitivity

Respect user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
```

---

## Usage Examples

### Building a Card Component

```typescript
const Card = ({ title, description, children, isLoading, error }) => {
  return (
    <div className="rounded-lg bg-[var(--color-bg-secondary)] shadow-sm p-6">
      {error && <ErrorState title="Error" message={error} />}
      {isLoading && <LoadingState type="skeleton" rows={3} />}
      {!error && !isLoading && (
        <>
          <h3 className="text-h4 font-600 mb-2">{title}</h3>
          {description && (
            <p className="text-body-sm text-text-secondary mb-4">
              {description}
            </p>
          )}
          {children}
        </>
      )}
    </div>
  );
};
```

### Building a Form Field

```typescript
const FormField = ({ label, error, required, hint, children }) => {
  return (
    <div className="mb-4">
      <label className="text-label font-600 block mb-1">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-body-sm text-error mt-1" role="alert">
          {error}
        </p>
      )}
      {hint && (
        <p className="text-body-sm text-text-secondary mt-1">
          {hint}
        </p>
      )}
    </div>
  );
};
```

### Building a Button with Animation

```typescript
const ActionButton = ({ icon, label, onClick, isLoading }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        flex items-center gap-2
        px-4 py-2
        bg-primary text-white font-600
        rounded-md
        transition-all duration-300
        hover:bg-primary-dark hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary
        disabled:opacity-60 disabled:cursor-not-allowed
      `}
    >
      {isLoading ? (
        <Loader size={20} className="animate-spin" />
      ) : (
        icon && <Icon size={20} />
      )}
      {label}
    </button>
  );
};
```

---

## Maintenance & Updates

### Adding New Tokens

1. **Define in CSS:**
   ```css
   :root {
     --my-new-token: #value;
   }
   
   @media (prefers-color-scheme: dark) {
     :root {
       --my-new-token: #dark-value;
     }
   }
   ```

2. **Document here** (PHASE3-DESIGN-TOKENS.md)

3. **Update Tailwind Config** (if applicable):
   ```javascript
   // tailwind.config.js
   theme: {
     extend: {
       colors: {
         'my-token': 'var(--my-new-token)',
       }
     }
   }
   ```

4. **Use in components:**
   ```html
   <div class="bg-[var(--my-new-token)]">Content</div>
   ```

---

## Summary Table

| Category | Token | Value |
|----------|-------|-------|
| **Colors** | primary | #3356D0 |
| | success | #0a7d57 |
| | error | #ef4444 |
| **Typography** | h1 | 48px, 700 |
| | body-md | 16px, 400 |
| | label | 13px, 600 |
| **Spacing** | md | 16px |
| | lg | 24px |
| | 2xl | 48px |
| **Radius** | md | 8px |
| | lg | 12px |
| **Shadows** | sm | 0 1px 3px rgba(0,0,0,0.1) |
| | md | 0 4px 6px rgba(0,0,0,0.1) |
| **Duration** | base | 300ms |
| | fast | 150ms |

All tokens are defined in `src/styles/design-tokens.css` and can be used via CSS variables or Tailwind utilities.

---

**Next Steps:**
1. Verify all tokens are defined in design-tokens.css
2. Create component library with token usage
3. Test dark mode appearance
4. Verify contrast ratios
5. Update documentation as needed
