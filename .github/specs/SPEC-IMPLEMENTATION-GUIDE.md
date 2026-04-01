# Settings & Claims Feature Specification - Implementation Guide

**Document:** `.github/specs/settings-claims-feature-spec.md`  
**Size:** 52 KB | **Lines:** 1,832  
**Status:** ✅ FINAL - READY FOR IMPLEMENTATION

---

## Quick Navigation

### For Project Managers
- **Total Effort:** 13-17 days (~2-3 weeks)
- **Phase Breakdown:**
  - Phase 0 (Prerequisites): 2-3 days
  - Phase 1 (TopNav & Settings): 4-5 days
  - Phase 2 (Claims Modal): 4-5 days
  - Phase 3 (Testing & Polish): 3-4 days

### For Developers
Read these sections in order:

1. **Section 1: Functional Requirements** (What to build)
2. **Section 3: Database Schema Design** (Database changes)
3. **Section 4: Server Actions** (Backend API)
4. **Section 6: UI Components** (Frontend components)
5. **Section 11: Implementation Checklist** (Step-by-step tasks)

### For Architects/Tech Leads
- **Section 2:** Implementation phases and dependencies
- **Section 7:** Authentication & middleware architecture
- **Section 9:** Performance considerations
- **Section 10:** Testing strategy
- **Section 12:** Deployment procedures

---

## Critical Prerequisites (Phase 0 - MUST COMPLETE FIRST)

### Dependencies to Install
```bash
npm install sonner react-hook-form zod @hookform/resolvers
npx shadcn-ui@latest add input form select checkbox label alert scroll-area table
```

### Database Models to Add
1. `UserSession` - Store authentication tokens
2. `UserPreference` - Store user settings (theme, notifications, currency)
3. `BenefitClaimNote` - Optional: Store manual notes on claims

### Middleware to Create
- `src/middleware.ts` - Protect routes requiring authentication

### Validation Schemas to Create
- `src/lib/validationSchemas.ts` - Zod schemas for all forms

---

## Feature 1: TopNav & Settings (Phase 1 - 4-5 Days)

### Components to Build
1. **TopNav** (`src/components/TopNav.tsx`)
   - Fixed header with logo, dark toggle, profile dropdown
   - Props: user (optional), onLogout callback
   - 60px height, z-index 50, responsive

2. **ProfileDropdown** (`src/components/TopNav/ProfileDropdown.tsx`)
   - shadcn DropdownMenu with user email header
   - Menu items: Profile, Preferences, Logout
   - Icons from lucide-react

### Pages to Create
- `/settings` - Profile editor (firstName, lastName, read-only email)
- `/settings/preferences` - Theme/notification/currency settings

### Server Actions to Implement
- `registerUser()` - Create account with bcrypt password hashing
- `loginUser()` - Validate credentials and create session token
- `logoutUser()` - Invalidate session token
- `updateUserProfile()` - Edit first/last name
- `updateUserPreferences()` - Save theme, notifications, currency

### Integration Points
- Modify `src/app/layout.tsx` - Add TopNav and Toaster
- Add middleware.ts for route protection

---

## Feature 2: Claims History Modal (Phase 2 - 4-5 Days)

### Components to Build
1. **ClaimHistoryModal** - shadcn Dialog wrapper
2. **ClaimHistoryTabs** - Filter tabs (All, Used, Pending, Expired)
3. **ClaimHistoryTable** - Table with Date, Benefit, Value, Notes, Actions
4. **ClaimStatistics** - Summary cards (Total, Count, Average, by Type)

### Server Actions to Implement
- `getClaimHistory()` - Fetch claims with filtering/sorting
- `updateClaimValue()` - Edit value and notes
- `undoClaim()` - Delete claim (revert isUsed to false)
- `addClaimNote()` - Optional: Add manual notes

### Integration Points
- Add "View History" button to `src/components/Card.tsx`
- Manage modal state in `PlayerTabsContainer`

---

## Key Patterns to Follow

### Server Action Error Handling
```typescript
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> };

// Usage
const result = await someAction(input);
if (result.success) {
  toast.success('Success message');
} else {
  toast.error(result.error);
}
```

### Form Validation Pattern
```typescript
// Use react-hook-form + Zod
const form = useForm({
  resolver: zodResolver(SomeSchema),
  defaultValues: { ... }
});

// Display errors
{errors.fieldName && <span className="text-red-500">{errors.fieldName.message}</span>}
```

### Toast Notifications Pattern
```typescript
import { toast } from 'sonner';

// Success
toast.success('Profile updated');

// Error
toast.error(result.error);

// With field errors
Object.entries(fieldErrors).forEach(([field, error]) => {
  toast.error(`${field}: ${error}`);
});
```

---

## Database Schema Summary

### UserSession (New)
- `id`, `userId`, `token` (unique), `expiresAt`, `createdAt`
- Indexes: token (unique), expiresAt
- Purpose: Authentication token storage

### UserPreference (New)
- `id`, `userId` (unique), `theme`, `emailNotifications`, `inAppNotifications`, `currency`, `language`, `createdAt`, `updatedAt`
- Purpose: User preferences storage

### BenefitClaimNote (Optional)
- `id`, `benefitId`, `note`, `createdAt`, `updatedAt`
- Indexes: benefitId, createdAt
- Purpose: Manual notes on benefit claims

### User (Modified)
- Add relations: `sessions: UserSession[]`, `preferences: UserPreference?`

### UserBenefit (No Changes)
- Already contains: isUsed, claimedAt, timesUsed, expirationDate
- These fields form the claims ledger - just query and filter

---

## Validation Rules Checklist

### Authentication
- [ ] Email must be valid RFC 5322 format
- [ ] Email must be unique (no duplicates)
- [ ] Password minimum 8 characters
- [ ] Password hashed with bcrypt (rounds: 10)

### Profile
- [ ] firstName max 100 characters
- [ ] lastName max 100 characters
- [ ] Email read-only (not editable)

### Preferences
- [ ] Theme: 'light' | 'dark' | 'system'
- [ ] Currency: 'USD' | 'EUR' | 'GBP'
- [ ] Notifications: boolean

### Claims
- [ ] Claim value: 0-999999 cents (~$0-9999.99)
- [ ] Notes max 500 characters
- [ ] Cannot edit claimedAt timestamp
- [ ] Cannot view other users' claims

---

## Testing Checklist

### Unit Tests
- [ ] Validation schemas (RegisterSchema, UpdateProfileSchema, etc.)
- [ ] Statistics calculations (totalClaimed, average, byType, utilization)
- [ ] Formatting utilities (formatCurrency, formatDate)

### Integration Tests
- [ ] registerUser with valid/invalid inputs
- [ ] loginUser with correct/incorrect password
- [ ] updateUserProfile with authorization check
- [ ] getClaimHistory with filtering and sorting
- [ ] undoClaim with claim status revert

### E2E Tests
- [ ] Register → Login → Access /settings → Logout
- [ ] View card → Click history → Filter claims → Edit value → See toast
- [ ] Edit claim → Undo claim → See claim removed from table

### Accessibility Tests
- [ ] Modal closes with Escape key
- [ ] Tab order is logical
- [ ] Color contrast >= 4.5:1
- [ ] Form labels associated with inputs
- [ ] Error messages announced to screen readers

---

## Deployment Checklist

### Pre-Deployment
```bash
[ ] npm run type-check         # No TypeScript errors
[ ] npm run lint               # No linting errors
[ ] npm test                   # All tests pass
[ ] npm run build              # Build succeeds
```

### Database Migration
```bash
[ ] npx prisma migrate dev --name add_auth_and_settings
[ ] Verify tables created in database
[ ] Verify indexes created
[ ] Test rollback procedure
```

### Smoke Tests (Post-Deploy)
```
[ ] Create test account via /register
[ ] Login via /login
[ ] Navigate to /settings
[ ] Change theme, verify dark mode applies
[ ] Navigate to /settings/preferences
[ ] Open claims history modal
[ ] Verify no console errors
[ ] Logout and verify redirect to /login
```

---

## File Structure After Implementation

```
src/
├── actions/
│   ├── auth.ts              ← NEW
│   ├── settings.ts          ← NEW
│   ├── claims.ts            ← NEW
│   ├── benefits.ts          ← Existing
│   └── wallet.ts            ← Existing
├── components/
│   ├── TopNav.tsx           ← NEW
│   ├── TopNav/
│   │   ├── ProfileDropdown.tsx  ← NEW
│   │   └── LogoutButton.tsx     ← NEW
│   ├── ClaimHistory/
│   │   ├── ClaimHistoryModal.tsx
│   │   ├── ClaimHistoryTable.tsx
│   │   ├── ClaimStatistics.tsx
│   │   └── ClaimDetailRow.tsx
│   └── [existing components]
├── app/
│   ├── layout.tsx           ← MODIFY: Add TopNav, Toaster
│   ├── page.tsx             ← MODIFY: Add history callback
│   ├── settings/            ← NEW folder
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── preferences/page.tsx
│   └── [existing pages]
├── lib/
│   ├── validationSchemas.ts ← NEW
│   ├── formatting.ts        ← NEW (consolidate utilities)
│   └── [existing files]
├── middleware.ts            ← NEW
└── types/
    ├── index.ts             ← MODIFY: Add types
    └── components.ts        ← NEW
```

---

## Common Questions

**Q: When should Phase 0 be completed?**  
A: Before starting Phase 1 or 2. It's a blocker - all other work depends on it.

**Q: What if the database migration fails?**  
A: Run `npx prisma migrate resolve --rolled-back "add_auth_and_settings"` to rollback.

**Q: How do I handle theme switching without page reload?**  
A: Update localStorage + HTML class + Component state simultaneously:
```typescript
localStorage.setItem('theme', 'dark');
document.documentElement.classList.add('dark');
setTheme('dark');
```

**Q: Should I create a separate BenefitClaim model?**  
A: NO - UserBenefit IS the claims ledger. Just query it with filters.

**Q: How do I prevent users from viewing other users' claims?**  
A: Every server action queries claims with `player.userId === currentUserId` filter.

**Q: What about password reset?**  
A: Not in this spec (Phase 4 future enhancement). Current MVP: Register + Login only.

**Q: Can users delete their account?**  
A: Not in this spec. Future enhancement.

---

## Success Criteria Checklist

- [ ] User can register with email/password
- [ ] User can login with email/password
- [ ] User can update profile (first/last name)
- [ ] User can change theme preference
- [ ] User can toggle notifications
- [ ] User can change currency
- [ ] User can view claims history for any card
- [ ] User can filter claims by status (all, used, pending, expired)
- [ ] User can edit claim value and notes
- [ ] User can undo/delete claims
- [ ] User can view claim statistics
- [ ] All forms show validation errors
- [ ] All operations show toast notifications
- [ ] Protected routes redirect to /login if unauthenticated
- [ ] Dark mode preference persists across sessions
- [ ] No TypeScript errors
- [ ] No console warnings/errors
- [ ] Lighthouse score >= 90
- [ ] WCAG 2.1 Level AA accessibility

---

## Next Steps

1. **Start Phase 0:**
   - Install dependencies
   - Create Prisma models
   - Create middleware
   - Create validation schemas

2. **Start Phase 1 (after Phase 0):**
   - Create TopNav component
   - Create auth server actions
   - Create settings pages
   - Integrate Toaster

3. **Start Phase 2 (after Phase 1):**
   - Create claims modal
   - Create claims server actions
   - Integrate with Card component

4. **Start Phase 3:**
   - Write tests
   - Run accessibility audit
   - Performance testing
   - Final polish

---

**For detailed specifications, refer to:** `.github/specs/settings-claims-feature-spec.md`

**Total Document:**
- 52 KB file size
- 1,832 lines
- 15 major sections
- Complete implementation guide for expert developers

**Status:** ✅ APPROVED FOR IMPLEMENTATION

