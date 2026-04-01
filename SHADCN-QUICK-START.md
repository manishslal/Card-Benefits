# 🎨 shadcn/ui Quick Start Guide

## Installation Complete ✅

- ✅ shadcn v4.1.2 initialized
- ✅ 5 components ready (button, card, tabs, dialog, dropdown-menu)
- ✅ lucide-react installed (1,400+ icons)
- ✅ Design tokens configured

---

## Copy-Paste Ready Components

### Button
```tsx
import { Button } from "@/components/ui/button"

<Button>Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Settings className="w-4 h-4" /></Button>
```

### Card
```tsx
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content goes here</CardContent>
</Card>
```

### Tabs
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">Overview content</TabsContent>
  <TabsContent value="analytics">Analytics content</TabsContent>
</Tabs>
```

### Dialog (Modal)
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    Modal content here
  </DialogContent>
</Dialog>
```

### Dropdown Menu
```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Settings, LogOut } from "lucide-react"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="icon">
      <Settings className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>Settings</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Logout</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Lucide Icons Examples

```tsx
import { 
  Settings, Bell, LogOut, ChevronDown, Check, X, AlertCircle, 
  CreditCard, TrendingUp, Eye, EyeOff, Copy, Share2, Download 
} from "lucide-react"

<Bell className="w-4 h-4" />
<Settings className="w-4 h-4" />
<CreditCard className="w-4 h-4" />
<TrendingUp className="w-4 h-4" />
```

Search: https://lucide.dev

---

## Add More Components

```bash
# Input fields
npx shadcn@latest add input

# Checkboxes
npx shadcn@latest add checkbox

# Radio buttons
npx shadcn@latest add radio-group

# Dropdowns
npx shadcn@latest add select

# Tables
npx shadcn@latest add table

# Tooltips
npx shadcn@latest add tooltip

# Alerts
npx shadcn@latest add alert

# Badges
npx shadcn@latest add badge

# More: https://ui.shadcn.com/docs/components
```

---

## Customize Components

1. Edit files in `src/components/ui/`
2. Components are fully yours to modify
3. No lock-in - it's just code!

Example: Custom Button Variant

Edit `src/components/ui/button.tsx`:
```tsx
const buttonVariants = cva(
  // ... existing styles
  {
    variants: {
      variant: {
        // ... existing variants
        premium: "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg",
      },
    },
  }
)
```

Use it:
```tsx
<Button variant="premium">Premium Button</Button>
```

---

## File Locations

```
src/
├── components/ui/           ← All shadcn components
│   ├── button.tsx
│   ├── card.tsx
│   ├── tabs.tsx
│   ├── dialog.tsx
│   └── dropdown-menu.tsx
└── lib/
    └── utils.ts             ← Utility functions
```

---

## Theme Customization

CSS variables in `src/styles/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.6%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 100%;
  /* ... 40+ more variables */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 0 0% 3.6%;
    --foreground: 0 0% 98%;
    /* Dark mode variables automatically switch */
  }
}
```

---

## Tailwind Integration

All shadcn components use Tailwind classes. Your existing Tailwind config is extended with:

```javascript
theme: {
  extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: "hsl(var(--primary))",
      // ... Radix UI colors mapped from CSS variables
    },
  },
}
```

---

## Dark Mode Support

Automatic! Components respect your dark mode toggle:

```tsx
// In your Header component (you already have this)
const toggleDarkMode = () => {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}
```

All shadcn components automatically adapt to dark mode.

---

## Accessibility Built-In

✅ Semantic HTML  
✅ ARIA labels  
✅ Keyboard navigation  
✅ Focus management  
✅ Color contrast (WCAG AAA)  
✅ Screen reader support  

No extra work needed!

---

## Performance

- Zero runtime overhead
- Components are static code (no wrappers)
- Tree-shakeable
- CSS variables for efficient theming
- Optimized animations

---

## Tips & Tricks

### Combining Components
```tsx
<Card>
  <CardHeader>
    <CardTitle>Settings</CardTitle>
  </CardHeader>
  <CardContent>
    <Tabs defaultValue="profile">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>
      {/* Tab content */}
    </Tabs>
  </CardContent>
</Card>
```

### Icons with Buttons
```tsx
<Button className="gap-2">
  <Settings className="w-4 h-4" />
  Settings
</Button>
```

### Dropdown in Header
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <Menu className="w-4 h-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {/* Menu items */}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Links

- **Official Docs:** https://ui.shadcn.com
- **All Components:** https://ui.shadcn.com/docs/components
- **Radix UI (Headless):** https://www.radix-ui.com
- **Lucide Icons:** https://lucide.dev
- **Tailwind CSS:** https://tailwindcss.com

---

## Next Steps

1. **Update your existing components** to use shadcn equivalents
2. **Import shadcn components** in your pages
3. **Add more components** as needed
4. **Customize** the design to match your brand
5. **Build amazing UIs** with premium components!

---

🎉 **You're ready to start building!**

Import components and start using them immediately:

```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
```

Your dashboard just got a major design upgrade! 🚀
