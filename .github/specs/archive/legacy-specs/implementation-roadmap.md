# Implementation Roadmap - Settings & Claims Features

**Project:** Card Benefits Tracker v2.0  
**Date:** April 1, 2024  
**Status:** QA Audit Complete - Ready for Planning Phase

---

## Executive Timeline

```
┌──────────────────────────────────────────────────────────────┐
│ Phase 0: Prerequisites (3-4 days)                            │
├──────────────────────────────────────────────────────────────┤
│ • Authentication System                                       │
│ • Route Protection Middleware                                 │
│ • Database Models (UserSession, UserPreference)              │
│ • Toast Notification Library                                  │
│ • Form Validation Framework                                   │
│ • UI Components Installation                                  │
└──────────────────────────────────────────────────────────────┘
                           ⬇️ (BLOCKER)
┌──────────────────────────────────────────────────────────────┐
│ Phase 1: Feature 1 - TopNav & Settings (2-3 days)           │
├──────────────────────────────────────────────────────────────┤
│ • TopNav Component (modify Header)                            │
│ • ProfileDropdown Component                                   │
│ • Settings Layout                                             │
│ • Settings Forms (Theme, Profile, Preferences)               │
│ • Server Actions (update preferences, logout)                │
│ • Error Handling & Toast Notifications                        │
└──────────────────────────────────────────────────────────────┘
                           ⬇️
┌──────────────────────────────────────────────────────────────┐
│ Phase 2: Feature 2 - Claims History (1-2 days)              │
├──────────────────────────────────────────────────────────────┤
│ • ClaimHistoryModal Component                                 │
│ • ClaimHistoryTabs (All, Used, Expired, Stats)              │
│ • ClaimHistoryTable with Filtering                           │
│ • View History Button on Cards                               │
│ • Server Actions (get history, add notes)                    │
└──────────────────────────────────────────────────────────────┘
                           ⬇️
┌──────────────────────────────────────────────────────────────┐
│ Phase 3: Testing & Polish (2-3 days)                        │
├──────────────────────────────────────────────────────────────┤
│ • Unit Tests (utilities, components)                          │
│ • Integration Tests (server actions, forms)                   │
│ • E2E Tests (user workflows)                                  │
│ • Accessibility Audit (WCAG 2.1 AA)                          │
│ • Performance Testing (Lighthouse)                            │
│ • Bug Fixes & Edge Cases                                      │
└──────────────────────────────────────────────────────────────┘
                           ⬇️
│ TOTAL: 8-12 days │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Prerequisites (CRITICAL - Must Complete First)

### Week 1, Days 1-3: Core Infrastructure

#### Day 1: Authentication Foundation
**Goal:** User identification system in place

Tasks:
- [ ] Choose auth strategy (JWT tokens, sessions, etc.)
- [ ] Set up authentication provider (NextAuth, Clerk, custom)
- [ ] Create `src/middleware.ts` for route protection
- [ ] Add auth server action: `src/actions/auth.ts`
  ```typescript
  export async function loginUser(email: string, password: string)
  export async function logoutUser(userId: string)
  export async function registerUser(email: string, password: string)
  export async function changePassword(userId: string, oldPassword: string, newPassword: string)
  ```
- [ ] Update `src/app/page.tsx` line 70-76 to filter by userId
- [ ] Add `userId` filter to all existing Prisma queries

Testing Checklist:
- [ ] Login works
- [ ] Logout works
- [ ] Protected routes redirect to login
- [ ] Current user data is correctly filtered

#### Day 2: Database Migrations
**Goal:** Add user preference tracking to schema

Tasks:
- [ ] Add `UserSession` model to `prisma/schema.prisma`
  ```prisma
  model UserSession {
    id        String @id @default(cuid())
    userId    String
    user      User @relation(fields: [userId], references: [id], onDelete: Cascade)
    token     String @unique
    expiresAt DateTime
    createdAt DateTime @default(now())
    
    @@index([userId])
    @@index([expiresAt])
  }
  ```
- [ ] Add `UserPreference` model to `prisma/schema.prisma`
  ```prisma
  model UserPreference {
    id              String @id @default(cuid())
    userId          String @unique
    user            User @relation(fields: [userId], references: [id], onDelete: Cascade)
    theme           String @default("light")
    notifications   Boolean @default(true)
    currency        String @default("USD")
    emailNotifications Boolean @default(true)
    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt
    
    @@index([userId])
  }
  ```
- [ ] Add optional `BenefitClaimNote` model for future claim notes
  ```prisma
  model BenefitClaimNote {
    id        String @id @default(cuid())
    benefitId String
    benefit   UserBenefit @relation(fields: [benefitId], references: [id], onDelete: Cascade)
    note      String
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    
    @@index([benefitId])
  }
  ```
- [ ] Run migration: `npm run prisma:migrate`
- [ ] Verify schema with `prisma studio`

Testing Checklist:
- [ ] Migration runs without errors
- [ ] All new models exist in database
- [ ] Relationships are correct

#### Day 3: Dependencies & Utilities
**Goal:** All libraries installed and utilities consolidated

Tasks:
- [ ] Install dependencies:
  ```bash
  npm install sonner
  npm install zod react-hook-form @hookform/resolvers
  ```
- [ ] Add shadcn/ui components:
  ```bash
  npx shadcn-ui@latest add input
  npx shadcn-ui@latest add form
  npx shadcn-ui@latest add select
  npx shadcn-ui@latest add checkbox
  npx shadcn-ui@latest add label
  npx shadcn-ui@latest add scroll-area
  npx shadcn-ui@latest add alert
  ```
- [ ] Create `src/lib/formatting.ts`:
  ```typescript
  export function formatCurrency(cents: number): string {
    const dollars = (cents / 100).toFixed(2);
    const isNegative = cents < 0;
    return isNegative ? `-$${Math.abs(Number(dollars))}` : `$${dollars}`;
  }

  export function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  export function getResolvedValue(benefit: UserBenefit): number {
    return benefit.userDeclaredValue ?? benefit.stickerValue;
  }
  ```
- [ ] Create `src/lib/validationSchemas.ts`:
  ```typescript
  import { z } from 'zod';

  export const UpdatePreferencesSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']),
    notifications: z.boolean(),
    currency: z.enum(['USD', 'EUR', 'GBP']),
  });

  export const UpdateProfileSchema = z.object({
    firstName: z.string().min(1, 'First name required').max(50),
    lastName: z.string().min(1, 'Last name required').max(50),
  });

  export const ChangePasswordSchema = z.object({
    oldPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
  ```
- [ ] Create `src/types/components.ts` with exported interfaces
- [ ] Add `<Toaster />` to `src/app/layout.tsx` (line 82):
  ```tsx
  import { Toaster } from 'sonner';

  export default function RootLayout() {
    return (
      <html>
        <body>
          {children}
          <Toaster position="bottom-right" />
        </body>
      </html>
    );
  }
  ```

Testing Checklist:
- [ ] All dependencies install successfully
- [ ] shadcn components render without errors
- [ ] Validation schemas validate correctly
- [ ] Toast notifications appear in app

---

## Phase 1: Feature 1 - TopNav & Settings (2-3 Days)

### Week 2, Days 1-3: User Navigation & Preferences

#### Day 1: TopNav Component
**Goal:** User can see profile menu in header

Tasks:
- [ ] Update `src/components/Header.tsx` or create `src/components/TopNav.tsx`
  ```tsx
  interface TopNavProps {
    user?: {
      firstName: string | null;
      lastName: string | null;
      email: string;
      id: string;
    };
  }

  export default function TopNav({ user }: TopNavProps) {
    return (
      <header className="sticky top-0 z-50 border-b">
        <div className="flex items-center justify-between">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-sm">
            {/* Existing logo code */}
          </div>
          
          {/* RIGHT: Controls */}
          <div className="flex items-center gap-md">
            {/* Dark Mode Toggle */}
            <button onClick={toggleDarkMode}>
              {isDark ? <Sun /> : <Moon />}
            </button>
            
            {/* Profile Dropdown - NEW */}
            {user && <ProfileDropdown user={user} />}
          </div>
        </div>
      </header>
    );
  }
  ```

- [ ] Create `src/components/ProfileDropdown.tsx`
  ```tsx
  import { DropdownMenu } from '@/components/ui/dropdown-menu';
  import { LogoutButton } from './LogoutButton';

  export default function ProfileDropdown({ user }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm">
              {user.firstName?.charAt(0)}
            </div>
          </div>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent>
          <DropdownMenuLabel>{user.firstName} {user.lastName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem asChild>
            <Link href="/settings">Settings</Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild>
            <Link href="/settings/preferences">Preferences</Link>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem asChild>
            <LogoutButton />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  ```

- [ ] Create `src/components/LogoutButton.tsx`
  ```tsx
  'use client';

  import { logout } from '@/actions/auth';
  import { useRouter } from 'next/navigation';

  export default function LogoutButton() {
    const router = useRouter();

    const handleLogout = async () => {
      await logout();
      router.push('/login');
    };

    return (
      <button onClick={handleLogout}>
        Logout
      </button>
    );
  }
  ```

- [ ] Update `src/app/layout.tsx` to pass user to TopNav
  ```tsx
  import TopNav from '@/components/TopNav';

  export default async function RootLayout({ children }) {
    const user = await getCurrentUser(); // From session/auth

    return (
      <html>
        <body>
          <TopNav user={user} />
          {children}
          <Toaster />
        </body>
      </html>
    );
  }
  ```

Testing Checklist:
- [ ] Profile dropdown shows user name
- [ ] Settings link navigates correctly
- [ ] Logout button works
- [ ] Dropdown closes on click

#### Day 2: Settings Pages Layout
**Goal:** Settings pages structure in place

Tasks:
- [ ] Create `src/app/settings/layout.tsx`
  ```tsx
  export default function SettingsLayout({ children }) {
    return (
      <main className="min-h-screen">
        <div className="max-w-container mx-auto px-md md:px-tablet lg:px-desktop py-2xl">
          <h1 className="text-h1 font-bold mb-lg">Settings</h1>
          {children}
        </div>
      </main>
    );
  }
  ```

- [ ] Create `src/app/settings/page.tsx` (Main settings)
  ```tsx
  import SettingsForm from '@/components/SettingsForm';

  export default async function SettingsPage() {
    const user = await getCurrentUser();
    
    return (
      <div className="max-w-2xl">
        <h2 className="text-h2 mb-md">Profile & Account</h2>
        <SettingsForm user={user} />
      </div>
    );
  }
  ```

- [ ] Create `src/app/settings/preferences/page.tsx` (Preferences)
  ```tsx
  import PreferencesForm from '@/components/PreferencesForm';

  export default async function PreferencesPage() {
    const user = await getCurrentUser();
    const preferences = await getUserPreferences(user.id);
    
    return (
      <div className="max-w-2xl">
        <h2 className="text-h2 mb-md">Preferences</h2>
        <PreferencesForm preferences={preferences} />
      </div>
    );
  }
  ```

Testing Checklist:
- [ ] `/settings` page loads
- [ ] `/settings/preferences` page loads
- [ ] Layout wraps both pages

#### Day 3: Settings Forms & Actions
**Goal:** Users can save profile and preferences

Tasks:
- [ ] Create `src/components/SettingsForm.tsx`
  ```tsx
  'use client';

  import { useState } from 'react';
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { UpdateProfileSchema } from '@/lib/validationSchemas';
  import { updateProfile } from '@/actions/settings';
  import { toast } from 'sonner';

  export default function SettingsForm({ user }) {
    const { register, handleSubmit, formState: { errors } } = useForm({
      resolver: zodResolver(UpdateProfileSchema),
      defaultValues: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    const onSubmit = async (data) => {
      const result = await updateProfile(user.id, data);
      if (result.success) {
        toast.success('Profile updated');
      } else {
        toast.error(result.error);
      }
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label>First Name</label>
          <input {...register('firstName')} type="text" />
          {errors.firstName && <span>{errors.firstName.message}</span>}
        </div>
        
        <div>
          <label>Last Name</label>
          <input {...register('lastName')} type="text" />
          {errors.lastName && <span>{errors.lastName.message}</span>}
        </div>
        
        <button type="submit">Save Profile</button>
      </form>
    );
  }
  ```

- [ ] Create `src/components/PreferencesForm.tsx`
  ```tsx
  'use client';

  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { UpdatePreferencesSchema } from '@/lib/validationSchemas';
  import { updatePreferences } from '@/actions/settings';
  import { toast } from 'sonner';

  export default function PreferencesForm({ preferences }) {
    const { register, handleSubmit } = useForm({
      resolver: zodResolver(UpdatePreferencesSchema),
      defaultValues: preferences,
    });

    const onSubmit = async (data) => {
      const result = await updatePreferences(data);
      if (result.success) {
        toast.success('Preferences saved');
      } else {
        toast.error(result.error);
      }
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label>Theme</label>
          <select {...register('theme')}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
        
        <div>
          <label>
            <input type="checkbox" {...register('notifications')} />
            Enable Notifications
          </label>
        </div>
        
        <div>
          <label>Currency</label>
          <select {...register('currency')}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
        
        <button type="submit">Save Preferences</button>
      </form>
    );
  }
  ```

- [ ] Create `src/actions/settings.ts`
  ```typescript
  'use server';

  import { prisma } from '@/lib/prisma';
  import { UpdateProfileSchema, UpdatePreferencesSchema } from '@/lib/validationSchemas';

  type SettingsResult<T> = 
    | { success: true; data: T }
    | { success: false; error: string };

  export async function updateProfile(
    userId: string,
    input: unknown
  ): Promise<SettingsResult<any>> {
    const parsed = UpdateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return { 
        success: false, 
        error: parsed.error.errors[0].message 
      };
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: parsed.data,
      });
      return { success: true, data: parsed.data };
    } catch (err) {
      console.error('[updateProfile]', err);
      return { success: false, error: 'Failed to update profile' };
    }
  }

  export async function updatePreferences(
    userId: string,
    input: unknown
  ): Promise<SettingsResult<any>> {
    const parsed = UpdatePreferencesSchema.safeParse(input);
    if (!parsed.success) {
      return { 
        success: false, 
        error: parsed.error.errors[0].message 
      };
    }

    try {
      await prisma.userPreference.upsert({
        where: { userId },
        create: { userId, ...parsed.data },
        update: parsed.data,
      });
      return { success: true, data: parsed.data };
    } catch (err) {
      console.error('[updatePreferences]', err);
      return { success: false, error: 'Failed to update preferences' };
    }
  }
  ```

Testing Checklist:
- [ ] Form renders correctly
- [ ] Validation works (required fields, formats)
- [ ] Form submission works
- [ ] Toast notifications appear
- [ ] Data persists in database

---

## Phase 2: Feature 2 - Claims History (1-2 Days)

### Week 2, Days 4-5: Historical Claims Tracking

#### Day 4: Claims History Modal & Components
**Goal:** Users can view claim history

Tasks:
- [ ] Create `src/components/ClaimHistory/ClaimHistoryModal.tsx`
  ```tsx
  'use client';

  import { useState } from 'react';
  import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import ClaimHistoryTabs from './ClaimHistoryTabs';

  export default function ClaimHistoryModal({ 
    isOpen, 
    onClose, 
    cardId 
  }: {
    isOpen: boolean;
    onClose: () => void;
    cardId: string;
  }) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Claim History</DialogTitle>
          </DialogHeader>
          
          <ClaimHistoryTabs cardId={cardId} />
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] Create `src/components/ClaimHistory/ClaimHistoryTabs.tsx`
  ```tsx
  'use client';

  import { useState } from 'react';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import ClaimHistoryTable from './ClaimHistoryTable';
  import ClaimStatistics from './ClaimStatistics';
  import { getClaimHistory } from '@/actions/claims';

  export default function ClaimHistoryTabs({ cardId }: { cardId: string }) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const loadHistory = async () => {
        const result = await getClaimHistory(cardId);
        if (result.success) {
          setHistory(result.data);
        }
        setIsLoading(false);
      };
      loadHistory();
    }, [cardId]);

    return (
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All Claims</TabsTrigger>
          <TabsTrigger value="used">Used</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all">
          <ClaimHistoryTable 
            claims={history} 
            filter="all" 
            isLoading={isLoading} 
          />
        </TabsContent>
        
        <TabsContent value="used">
          <ClaimHistoryTable 
            claims={history.filter(c => c.isUsed)} 
            filter="used" 
            isLoading={isLoading} 
          />
        </TabsContent>
        
        <TabsContent value="expired">
          <ClaimHistoryTable 
            claims={history.filter(c => c.expirationDate < new Date())} 
            filter="expired" 
            isLoading={isLoading} 
          />
        </TabsContent>
        
        <TabsContent value="stats">
          <ClaimStatistics claims={history} />
        </TabsContent>
      </Tabs>
    );
  }
  ```

- [ ] Create `src/components/ClaimHistory/ClaimHistoryTable.tsx`
  - Display claims in table format
  - Columns: Benefit Name, Card, Claimed Date, Value, Status
  - Support sorting & filtering
  - Expandable rows for details

- [ ] Create `src/components/ClaimHistory/ClaimStatistics.tsx`
  - Total claimed value
  - Breakdown by benefit type
  - Breakdown by card
  - Timeline chart (optional)

#### Day 5: Server Actions & View History Button
**Goal:** Complete claims history integration

Tasks:
- [ ] Create `src/actions/claims.ts`
  ```typescript
  'use server';

  import { prisma } from '@/lib/prisma';

  type ClaimsResult<T> = 
    | { success: true; data: T }
    | { success: false; error: string };

  export async function getClaimHistory(
    cardId: string
  ): Promise<ClaimsResult<any[]>> {
    try {
      const benefits = await prisma.userBenefit.findMany({
        where: { userCardId: cardId },
        include: { userCard: { include: { masterCard: true } } },
        orderBy: { claimedAt: 'desc' },
      });

      return { success: true, data: benefits };
    } catch (err) {
      console.error('[getClaimHistory]', err);
      return { success: false, error: 'Failed to load claim history' };
    }
  }

  export async function getClaimStatistics(cardId: string) {
    try {
      const benefits = await prisma.userBenefit.findMany({
        where: { userCardId: cardId, isUsed: true },
      });

      return {
        success: true,
        data: {
          totalClaimed: benefits.reduce((sum, b) => sum + (b.userDeclaredValue || b.stickerValue), 0),
          claimCount: benefits.length,
          byType: {
            StatementCredit: benefits.filter(b => b.type === 'StatementCredit').length,
            UsagePerk: benefits.filter(b => b.type === 'UsagePerk').length,
          },
        },
      };
    } catch (err) {
      console.error('[getClaimStatistics]', err);
      return { success: false, error: 'Failed to load statistics' };
    }
  }
  ```

- [ ] Add "View History" button to `src/components/Card.tsx` (around line 300-315)
  ```tsx
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div>
      {/* Existing card content */}
      
      <button onClick={() => setShowHistory(true)}>
        View History
      </button>
      
      {showHistory && (
        <ClaimHistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          cardId={card.id}
        />
      )}
    </div>
  );
  ```

Testing Checklist:
- [ ] Modal opens/closes
- [ ] History loads correctly
- [ ] Tabs switch content
- [ ] Statistics display correct values
- [ ] Sorting/filtering works

---

## Phase 3: Testing & Polish (2-3 Days)

### Week 3, Days 1-3: Quality Assurance

#### Day 1: Unit Tests
**Goal:** Core utilities and components tested

Tasks:
- [ ] Write tests for `src/lib/formatting.ts`
  ```typescript
  describe('formatCurrency', () => {
    it('should format positive cents', () => {
      expect(formatCurrency(50000)).toBe('$500.00');
    });
    
    it('should format negative cents', () => {
      expect(formatCurrency(-5000)).toBe('-$50.00');
    });
  });
  ```

- [ ] Write tests for validation schemas
- [ ] Write tests for component rendering (ProfileDropdown, ClaimHistoryModal)

#### Day 2: Integration Tests
**Goal:** Server actions tested end-to-end

Tasks:
- [ ] Test updateProfile action
- [ ] Test updatePreferences action
- [ ] Test getClaimHistory action
- [ ] Test logout action

#### Day 3: E2E & Polish
**Goal:** Full user workflows tested

Tasks:
- [ ] E2E: Login → View Settings → Change Theme → Logout
- [ ] E2E: View Card → Open History → See Claims
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance testing (Lighthouse)
- [ ] Bug fixes & edge cases

---

## Success Criteria Checklist

### Feature 1: TopNav & Settings
- [ ] User can see profile dropdown in header
- [ ] User can click Settings link
- [ ] Settings page loads correctly
- [ ] User can update profile name
- [ ] User can change theme preference
- [ ] User can toggle notifications
- [ ] User can change currency preference
- [ ] Changes persist after logout/login
- [ ] Logout button works
- [ ] Toast notifications appear on save
- [ ] Form validation shows errors
- [ ] Keyboard navigation works (Tab, Enter)

### Feature 2: Claims History
- [ ] "View History" button appears on cards
- [ ] Modal opens when button clicked
- [ ] Modal shows all claims in table
- [ ] Tabs filter claims (All, Used, Expired)
- [ ] Statistics tab shows correct values
- [ ] Can sort by date, value, status
- [ ] Modal closes with Escape key
- [ ] Loading state shows while fetching
- [ ] Empty state when no claims
- [ ] Undo claim button works (optional)

### General Quality
- [ ] No console errors
- [ ] No broken links
- [ ] Responsive on mobile/tablet/desktop
- [ ] Dark/light mode works
- [ ] Lighthouse score 90+
- [ ] All tests pass
- [ ] No TypeScript errors

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Auth system complex | Medium | High | Start early, use established provider |
| Database migration fails | Low | High | Test locally, have rollback plan |
| Form validation edge cases | Medium | Medium | Comprehensive test coverage |
| Performance issues | Low | Medium | Lighthouse testing, query optimization |
| Accessibility issues | Medium | Medium | WCAG audit, keyboard testing |

---

## Resource Allocation

### Team Composition (Recommended)
- **Frontend Engineer (1):** TopNav, Settings forms, Components
- **Backend Engineer (1):** Auth system, Server actions, Database
- **QA/Tester (1):** Tests, accessibility, E2E testing
- **DevOps (0.5):** Database migrations, deployment

### Estimated Hours
| Phase | Task | Hours | Dependencies |
|-------|------|-------|--------------|
| 0 | Prerequisites | 24 | None |
| 1 | TopNav & Settings | 20 | Phase 0 |
| 2 | Claims History | 12 | Phase 0 |
| 3 | Testing & Polish | 16 | Phase 1-2 |
| **Total** | | **72 hrs** | |

---

## Deployment Checklist

Before going live:
- [ ] All tests pass (unit, integration, E2E)
- [ ] Code reviewed by team
- [ ] Database migrations tested
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Performance tested (Lighthouse)
- [ ] Accessibility audited
- [ ] Security scan passed
- [ ] Load testing done (optional)
- [ ] Staging environment tested
- [ ] Communication to users planned

---

## Post-Launch Monitoring

Monitor for:
- [ ] Error rate in Sentry/LogRocket
- [ ] Performance metrics (Core Web Vitals)
- [ ] User feedback from support
- [ ] Feature usage analytics
- [ ] Database performance
- [ ] Server logs

---

**Next Steps:**
1. Present roadmap to stakeholders
2. Secure team resources
3. Begin Phase 0 immediately
4. Create Jira/GitHub issues for tracking
5. Schedule daily standups

