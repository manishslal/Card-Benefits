# Card-Benefits Quick Reference Guide
## April 2026 - At a Glance

---

## 🎯 Key Numbers

| Metric | Value |
|--------|-------|
| **Total Phase Progress** | 60-65% complete |
| **Phases Completed** | 2 (Phase 1 security, Phase 2A fixes) |
| **Current Phase** | Phase 2B (30% done) |
| **Database Models** | 14 (with 100+ fields) |
| **API Endpoints** | 40+ |
| **React Components** | 50+ |
| **Test Suites** | 25+ |
| **Credit Cards in Catalog** | 87 |
| **Benefits Tracked** | 87 |
| **Test Coverage** | 80%+ of critical paths |
| **Documentation Files** | 271 (includes 350+ page spec docs) |
| **Time to MVP Completion** | 5-8 weeks |

---

## 🚀 Current Status

**Last Deploy**: April 8, 2026 ✅
- Benefit engine enabled (case-insensitive fix deployed)
- All Phase 1 security fixes in production
- Phase 2A bug fixes live
- Phase 2B feature work in progress

**Live Features**:
- ✅ User authentication (email/password + sessions)
- ✅ Card management (add/edit/archive)
- ✅ Benefit tracking (mark used, ROI calculation)
- ✅ Data import (XLSX/CSV with conflict resolution)
- ✅ Admin tools (card/benefit editing, audit logs)
- ✅ API (40+ endpoints with auth)

**In Development**:
- 🔄 Benefit usage analytics
- 🔄 Smart recommendations
- 🔄 Onboarding flow
- 🔄 Offline sync

---

## 📁 File Locations (Absolute Paths)

### Quick Access
```
Project Root:
  /Users/manishslal/Desktop/Coding-Projects/Card-Benefits/

Source Code:
  /Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/

Database:
  /Users/manishslal/Desktop/Coding-Projects/Card-Benefits/prisma/schema.prisma

Tests:
  /Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/__tests__/

Config:
  /Users/manishslal/Desktop/Coding-Projects/Card-Benefits/.env
```

### Key Source Files
```
Auth:
  /src/features/auth/lib/session.ts          ← Session management
  /src/features/auth/lib/server.ts           ← Server auth helpers
  /src/middleware.ts                         ← Route protection

Benefits:
  /src/features/benefits/lib/                ← Calculation logic
  /src/features/benefits/actions/            ← Server actions
  /src/features/benefits/hooks/              ← Custom hooks

Cards:
  /src/features/cards/lib/roi-calculator.ts  ← ROI logic
  /src/actions/wallet.ts                     ← Card actions

Admin:
  /src/features/admin/                       ← Admin tools
  /src/lib/admin/                            ← Admin utilities
```

### Database
```
Schema:      /prisma/schema.prisma
Seed:        /prisma/seed.ts
Migrations:  /prisma/migrations/
```

---

## 💻 Common Commands

### Development
```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Check code quality
npm run type-check       # Verify TypeScript
```

### Testing
```bash
npm run test             # Run all unit tests
npm run test:watch       # Watch mode
npm run test:ui          # Visual test dashboard
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E tests
npm run test:all         # Unit + E2E
```

### Database
```bash
npm run db:reset         # Full reset + reseed
npm run db:generate      # Generate Prisma types
npm run prisma:migrate   # Create migration
npm run prisma:studio    # GUI browser (http://localhost:5555)
```

---

## 🗂️ Code Organization

### Directory Structure
```
src/
├── app/                 # Next.js pages & API routes
│   ├── api/            # 40+ REST endpoints
│   ├── auth/           # Login, signup, password reset
│   ├── admin/          # Admin dashboard
│   └── page.tsx        # Main dashboard
│
├── features/           # Feature modules
│   ├── auth/           # Authentication (COMPLETE)
│   ├── benefits/       # Benefit tracking (Phase 2B)
│   ├── cards/          # Card management (COMPLETE)
│   ├── custom-values/  # Variable amounts (COMPLETE)
│   ├── import-export/  # Data import (COMPLETE)
│   └── admin/          # Admin tools (IN PROGRESS)
│
├── lib/                # Utilities & helpers
│   ├── auth/           # Auth functions
│   ├── roi-calculator/ # ROI computation
│   ├── benefit-*/      # Benefit helpers
│   ├── claiming-*      # Phase 6C utilities (NOT YET)
│   └── ...
│
├── shared/             # Reusable code
│   ├── components/     # UI library (50+)
│   ├── hooks/          # Custom hooks (15+)
│   ├── lib/            # Shared utilities
│   └── types/          # Shared types
│
├── __tests__/          # Test suites (25+)
└── types/              # Global types
```

---

## 🔑 Key Types & Interfaces

### User & Auth
```typescript
// User with roles
interface User {
  id: string
  email: string
  role: "USER" | "ADMIN" | "SUPER_ADMIN"
  firstName?: string
  lastName?: string
  emailVerified: boolean
}

// Session (30-day expiry)
interface Session {
  id: string
  userId: string
  expiresAt: Date
  isValid: boolean
}
```

### Cards & Benefits
```typescript
// Master template
interface MasterCard {
  id: string
  issuer: string
  cardName: string
  defaultAnnualFee: number
  masterBenefits: MasterBenefit[]
}

// User's card instance
interface UserCard {
  id: string
  playerId: string
  masterCardId: string
  renewalDate: Date
  userBenefits: UserBenefit[]
}

// Individual benefit tracking
interface UserBenefit {
  id: string
  userCardId: string
  masterBenefitId?: string
  name: string
  stickerValue: number  // in cents
  resetCadence: string  // "MONTHLY", "QUARTERLY", "ANNUAL"
  isUsed: boolean
  claimedAt?: Date
}
```

### Phase 2B (New)
```typescript
interface BenefitUsageRecord {
  id: string
  userId: string
  benefitId: string
  usageAmount: Decimal
  usageDate: Date
  category?: string
}

interface BenefitRecommendation {
  id: string
  userId: string
  benefitId: string
  score: number  // 0.0 to 1.0
  reason: string
  dismissedAt?: Date
}

interface OnboardingSession {
  id: string
  playerId: string
  currentStep: number  // 1-6
  isCompleted: boolean
}
```

---

## 🔐 Authentication Flow

### Session-Based (30 days)
```
User Login
  ↓
Validate credentials (argon2)
  ↓
Create Session record
  ↓
Issue HTTP-only session cookie
  ↓
Middleware validates cookie on each request
  ↓
AsyncLocalStorage provides userId to handlers
```

### Password Reset
```
User requests reset
  ↓
Email sent with unique token (10 min expiry)
  ↓
User clicks link, enters new password
  ↓
Token validated & password updated (argon2)
  ↓
User can login with new password
```

### Authorization (All APIs)
```
Every API endpoint:
  1. Validates session in middleware
  2. Gets userId from AsyncLocalStorage
  3. Checks if user owns the resource
  4. Returns 401/403 if unauthorized
```

---

## 🛡️ Security Features

| Feature | Implementation |
|---------|-----------------|
| **Passwords** | argon2 hashing (not bcrypt) |
| **Sessions** | HTTP-only SameSite cookies, 30-day expiry |
| **JWT** | Refresh tokens, 15-min expiry |
| **CSRF** | Automatic with same-site cookies |
| **XSS** | React escaping, no dangerouslySetInnerHTML |
| **SQL Injection** | Prisma parameterization |
| **Rate Limiting** | Implemented on auth endpoints |
| **Cron Security** | CRON_SECRET header validation |
| **Data Access** | User verification on all queries |
| **Audit Logging** | All admin actions tracked |

---

## 📊 Database Schema Overview

### 14 Core Models
1. **User** - Authentication & roles
2. **Session** - Session management (30-day)
3. **Player** - Household member
4. **UserCard** - User's credit card instance
5. **UserBenefit** - Individual benefit tracking
6. **MasterCard** - Card template (87 cards)
7. **MasterBenefit** - Benefit template (87 benefits)
8. **ImportJob** - Bulk import tracking
9. **ImportRecord** - Individual import rows
10. **UserImportProfile** - Saved import configurations
11. **AdminAuditLog** - Compliance logging
12. **BenefitPeriod** - Usage period tracking (Phase 2A)
13. **BenefitUsageRecord** - Individual usage events (Phase 2A)
14. **BenefitRecommendation** - Smart recommendations (Phase 2A)
15. **OnboardingSession** - Onboarding progress (Phase 2B)
16. **OnboardingStep** - Step-by-step tracking (Phase 2B)

### Key Relationships
```
User
  ├─ 1:N Sessions (for device tracking)
  ├─ 1:N Players (household members)
  │   ├─ 1:N UserCards (their cards)
  │   │   ├─ 1:N UserBenefits (tracking)
  │   │   │   ├─ 1:N BenefitPeriods
  │   │   │   ├─ 1:N BenefitUsageRecords
  │   │   │   └─ 1:N BenefitRecommendations
  │   │   └─ References MasterCard (template)
  │   └─ OnboardingSession (first-time setup)
  ├─ 1:N ImportJobs (bulk uploads)
  └─ 1:N AuditLogs (if admin)

MasterCard (Catalog)
  └─ 1:N MasterBenefits (87 benefits total)
      └─ 1:N UserBenefits (links to tracking)
```

---

## 🧪 Testing Guide

### Test Categories
```
1. Authentication       → src/__tests__/auth*.test.ts
2. Authorization       → src/__tests__/authorization*.test.ts
3. Data Validation     → src/__tests__/validation.test.ts
4. Business Logic      → src/__tests__/calculations*.test.ts
5. API Integration     → src/__tests__/*integration*.test.ts
6. Security            → src/__tests__/security*.test.ts
7. Edge Cases          → src/__tests__/timezone*.test.ts
```

### Running Tests
```bash
# All tests
npm run test

# Specific file
npm run test -- auth-complete.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Visual dashboard
npm run test:ui
```

### Coverage Targets
- **Critical paths**: 80%+ (auth, benefits, ROI)
- **API endpoints**: 70%+ (functional testing)
- **Utilities**: 90%+ (math & calculations)
- **Components**: 50%+ (visual regression)

---

## 🚢 Deployment Process

### Production Deployment (Railway)
```
1. Commit to main branch
   ↓
2. GitHub Actions runs tests
   ↓
3. Railway detects push
   ↓
4. Automatic build & deploy
   ↓
5. Database migrations applied
   ↓
6. Health checks verify
   ↓
7. Live on production
```

### Environment Variables (Prod)
```
DATABASE_URL=postgresql://...
NODE_ENV=production
SESSION_SECRET=<random>
JWT_SECRET=<random>
CRON_SECRET=<random>
BENEFIT_ENGINE_ENABLED=True
EMAIL_PROVIDER=SendGrid
```

### Rollback Procedure
1. Revert commit: `git revert <commit>`
2. Push to main
3. Railway auto-deploys previous version
4. Check health endpoint

---

## 📚 Documentation by Phase

### Phase 1: Security (✅ COMPLETE)
- Location: `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/`
- Files: `PHASE1-QA-DOCUMENTATION-INDEX.md` + others
- What: Authentication, authorization, cron security

### Phase 2A: Bugfixes (✅ COMPLETE)
- Files: `PHASE2A_IMPLEMENTATION_COMPLETE.md` + others
- What: ROI calc, timezone fixes, data integrity

### Phase 2B: Features (🔄 30% DONE)
- Start: `00-PHASE2B-START-HERE.md`
- Progress: `PHASE2B_STATUS_REPORT.md`
- Details: `PHASE2B_QUICK_START.md`
- What: Usage tracking, recommendations, onboarding

### Phase 6C: Claiming Limits (📋 SPEC READY)
- Spec: `PHASE6C-FINAL-TECHNICAL-SPECIFICATION.md` (965 lines)
- Quick: `PHASE6C-QUICK-REFERENCE.md`
- What: Help users never miss benefit windows

---

## ⚡ Performance Tips

### Database
```typescript
// ❌ Avoid N+1 queries
const cards = await prisma.userCard.findMany()
const benefits = await Promise.all(
  cards.map(c => prisma.userBenefit.findMany({ where: { userCardId: c.id } }))
)

// ✅ Use relations
const cards = await prisma.userCard.findMany({
  include: { userBenefits: true }
})
```

### Caching
```typescript
// Use SWR for API calls
const { data, error } = useSWR('/api/benefits', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000
})
```

### Components
```typescript
// ✅ Server components by default
export default function Card() { /* server */ }

// Use 'use client' only when needed
'use client'
export default function InteractiveCard() { /* client */ }
```

---

## 🐛 Debugging Checklist

### Can't Login?
1. Check environment: `echo $DATABASE_URL`
2. Verify user exists: `prisma studio` → User table
3. Check password hash: Should not be plain text
4. Verify session: Session table should have entry

### Benefits Not Showing?
1. Verify card added: `prisma studio` → UserCard
2. Check benefits seeded: `prisma studio` → UserBenefit
3. Validate reset cadence: Should be non-empty
4. Check benefit engine: `BENEFIT_ENGINE_ENABLED=True` in .env

### Import Failing?
1. Check file format: Must be XLSX or CSV
2. Verify headers: Column names must match
3. Check duplicates: ImportRecord.isDuplicate
4. View errors: ImportJob.errorLog field

### Tests Failing?
1. Run type-check: `npm run type-check`
2. Run linter: `npm run lint`
3. Check dependencies: `npm install`
4. Reset DB: `npm run db:reset`

---

## 💡 Pro Tips

### Development
- Use `prisma studio` to browse/edit data graphically
- Use `test:ui` to run tests in visual dashboard
- Use `dev` with browser console open for React errors
- Keep `.env` with local DATABASE_URL for development

### Git
- Always work from `main` branch (it's always deployable)
- Commit messages describe "why", not "what"
- Create PRs even for solo work (good practice)
- Review own code before asking for QA

### Code
- Use TypeScript types heavily (catch bugs early)
- Add tests for new features (80%+ target)
- Follow existing code patterns (consistency)
- Document edge cases in comments

---

## 📞 Getting Help

### Documentation
1. Start with `PROJECT_OVERVIEW_APRIL_2026.md` (comprehensive)
2. Read `00-PHASE2B-START-HERE.md` (current work)
3. Check `PHASE6C-QUICK-REFERENCE.md` (next phase)

### Code Examples
1. Look at similar existing features
2. Check test files for usage patterns
3. Review hook implementations
4. Examine component props

### Debugging
1. Check `.env` configuration
2. Verify database connection
3. Run type-check & lint
4. Reset database if needed

---

## 📈 Velocity Metrics

| Metric | Phase 1 | Phase 2A | Phase 2B | Avg |
|--------|---------|----------|----------|-----|
| Tasks/day | 1.67 | 4.0 | 0.3 | 2.0 |
| Complexity | High | Med | High | - |
| Tests/feature | 4 | 3 | 8+ | - |
| Lines/feature | 500+ | 200 | 800+ | - |

---

## 🎓 Learning Resources

### TypeScript
- Official docs: https://www.typescriptlang.org/
- Strict mode guide: https://www.typescriptlang.org/docs/handbook/

### React 19
- Docs: https://react.dev/
- Server components: https://react.dev/learn/server-components
- Hooks: https://react.dev/reference/react/hooks

### Next.js 15
- Docs: https://nextjs.org/
- App Router: https://nextjs.org/docs/app
- API Routes: https://nextjs.org/docs/app/building-your-application/routing/route-handlers

### Prisma
- Docs: https://www.prisma.io/docs/
- Schema: https://www.prisma.io/docs/concepts/components/prisma-schema
- Queries: https://www.prisma.io/docs/concepts/components/prisma-client

---

**Last Updated**: April 10, 2026
**Maintained by**: Manish S.
**Status**: Active Development
**Next Review**: April 15, 2026
