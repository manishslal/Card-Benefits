# PHASE 1: CRITICAL SECURITY FIXES - READY TO START

**Status:** ✅ Approved for Implementation
**Phase Duration:** 3 days (8-10 hours of work)
**Start Date:** April 1, 2026
**End Date:** April 4, 2026

---

## 🎯 Phase 1 Overview

**Objective:** Fix critical security vulnerabilities that prevent any production deployment.

**What's Being Fixed:**
1. ❌ **Missing Authentication** → ✅ Users must login
2. ❌ **No Authorization** → ✅ Users can only access their own data
3. ❌ **Cron Endpoint Vulnerable** → ✅ Timing-safe secret comparison
4. ❌ **Component Crashes** → ✅ Prop mismatch fixed

**Why This Phase:**
- Without auth, anyone can steal user data
- Cron endpoint can trigger DoS attacks
- App crashes when displaying benefits
- Must fix before ANY user can access the app

---

## 📋 Phase 1 Tasks (5 Total)

### Task #1: ✅ COMPLETE
**Authentication System - Specification**
- Status: ✅ Approved by QA
- Deliverable: SPECIFICATION_AUTHENTICATION.md (2,907 lines)
- Contains: 33 implementation tasks, security design, testing strategy

### Task #2: 🟡 IN PROGRESS
**Authentication System - Implementation**
- Effort: 4-5 hours development + 2 hours QA review
- What: Build signup, login, logout, session management
- Files: `/src/actions/auth.ts`, `/src/app/api/auth/*`, `/src/middleware.ts`
- QA: Critical issues to fix first (see below)

### Task #3: 🟡 IN PROGRESS
**Add Authorization to Server Actions**
- Effort: 1-2 hours development + 1 hour QA review
- What: Add ownership checks to `/src/actions/wallet.ts` and `/src/actions/benefits.ts`
- Prevents: Users accessing other users' data
- QA: Must verify all server actions check userId

### Task #4: 🟡 IN PROGRESS
**Fix Cron Endpoint Security**
- Effort: 1-2 hours development + 1 hour QA review
- What: Update `/src/app/api/cron/reset-benefits/route.ts`
- Prevents: Timing attacks, DoS attacks, missing env vars
- QA: Verify timing-safe comparison, rate limiting

### Task #5: 🟡 IN PROGRESS
**Fix Component Prop Mismatch**
- Effort: 0.5-1 hour development + 0.5 hour QA review
- What: Fix PlayerTabsContainer → CardTrackerPanel prop names
- Prevents: App crashing when displaying benefits
- QA: Verify TypeScript errors resolved, rendering works

---

## 🚨 CRITICAL FIXES REQUIRED (Before Implementation)

### FIX #1: Session Revocation Enforcement

**What to Add to Task #2 (Task 1.8 in spec):**

Create `/src/lib/auth-context.ts`:
```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export const authContext = new AsyncLocalStorage<AuthContext>();

export function getAuthContext() {
  return authContext.getStore();
}
```

Update `/src/middleware.ts`:
```typescript
import { authContext } from '@/lib/auth-context';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('sessionToken')?.value;

  if (token) {
    try {
      const payload = verifyJWT(token);

      // CRITICAL: Check if session is still valid (not revoked)
      const session = await prisma.session.findUnique({
        where: { sessionToken: token },
        select: { isValid: true, userId: true }
      });

      if (!session || !session.isValid) {
        // Session revoked, redirect to login
        response.cookies.set('sessionToken', '', { maxAge: 0 });
        return NextResponse.redirect(new URL('/login', request.url));
      }

      // Store userId in async context for server actions
      return authContext.run(
        { userId: session.userId, sessionId: token },
        () => response
      );
    } catch (error) {
      // Invalid token, clear cookie
      response.cookies.set('sessionToken', '', { maxAge: 0 });
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return response;
}
```

**Acceptance Criteria for Task #2:**
- [ ] AsyncLocalStorage initialized and exported
- [ ] Middleware checks Session.isValid in database
- [ ] Invalid sessions are immediately revoked
- [ ] Request context contains userId
- [ ] Server actions can access userId from context
- [ ] Tests verify: logout → token no longer works

---

### FIX #2: Context Injection in Server Actions

**What to Add to Task #2 (Task 1.10 in spec):**

Create `/src/lib/auth-server.ts`:
```typescript
import { authContext } from './auth-context';

export function getAuthUserId(): string {
  const context = authContext.getStore();
  if (!context?.userId) {
    throw new Error('Not authenticated: Missing userId in context');
  }
  return context.userId;
}

export async function verifyOwnership(userId: string, targetUserId: string) {
  if (userId !== targetUserId) {
    throw new Error('Unauthorized: You do not own this resource');
  }
}
```

Update `/src/actions/wallet.ts`:
```typescript
'use server';

import { getAuthUserId, verifyOwnership } from '@/lib/auth-server';

export async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date
): Promise<AddCardResult> {
  try {
    const userId = getAuthUserId(); // Get from context

    // Verify user owns this player
    const player = await prisma.player.findUnique({
      where: { id: playerId }
    });

    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    await verifyOwnership(userId, player.userId);

    // ... rest of action
  } catch (error) {
    if (error.message.includes('Unauthorized')) {
      return { success: false, error: 'Unauthorized' };
    }
    return { success: false, error: 'Failed to add card' };
  }
}
```

**Acceptance Criteria for Task #2:**
- [ ] getAuthUserId() works in all server actions
- [ ] verifyOwnership() prevents cross-user access
- [ ] All mutations verify ownership
- [ ] Error handling is graceful
- [ ] Tests verify: User A cannot modify User B's data

---

### FIX #3: Error Handling for toggleBenefit Race Condition

**What to Add to Task #3 (Task 2.5 in spec):**

```typescript
export async function toggleBenefit(
  benefitId: string,
  currentIsUsed: boolean
): Promise<BenefitActionResult> {
  try {
    const userId = getAuthUserId();

    // Verify ownership first
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: { player: true }
    });

    if (!benefit) {
      return { success: false, error: 'Benefit not found' };
    }

    await verifyOwnership(userId, benefit.player.userId);

    // Use conditional update to handle race condition
    const updated = await prisma.userBenefit.update({
      where: {
        id: benefitId,
        isUsed: currentIsUsed // Only update if state matches
      },
      data: {
        isUsed: !currentIsUsed,
        claimedAt: !currentIsUsed ? new Date() : null,
        timesUsed: !currentIsUsed ? { increment: 1 } : undefined
      }
    });

    return { success: true, benefit: updated };
  } catch (error) {
    // Prisma throws if update affects 0 rows (race condition)
    if (error.code === 'P2025') {
      return {
        success: false,
        error: 'Benefit already claimed. Please refresh to see changes.',
        code: 'ALREADY_CLAIMED'
      };
    }
    return { success: false, error: 'Failed to update benefit' };
  }
}
```

**Acceptance Criteria for Task #3:**
- [ ] Concurrent toggleBenefit calls only first succeeds
- [ ] Second call returns ALREADY_CLAIMED error
- [ ] Client can refresh to sync state
- [ ] Tests verify race condition is handled
- [ ] No data corruption on concurrent requests

---

## 📅 Phase 1 Schedule

```
Day 1 (Monday):
  - Task #2 Part A: Auth infrastructure & database schema (2h)
  - Task #2 Part B: Signup API route (1h)
  - Task #2 Part C: Login API route (1h)
  - QA Review of Task #2 (1h)

Day 2 (Tuesday):
  - Task #2 Part D: Logout & session management (1h)
  - Task #2 Part E: Middleware + context (1.5h)
  - Task #3: Authorization checks (1.5h)
  - QA Review Task #3 (1h)

Day 3 (Wednesday):
  - Task #4: Cron security (1.5h)
  - Task #5: Component prop fix (0.5h)
  - QA Review Tasks #4, #5 (1h)
  - Full testing & regression (2h)
```

---

## 🧪 Testing Requirements

### Task #2 Tests (Authentication)
```typescript
// tests/unit/auth.test.ts
- [ ] Password hashing with Argon2
- [ ] JWT signing and verification
- [ ] Session creation and validation
- [ ] Session revocation (critical!)
- [ ] Rate limiting for login
- [ ] Email validation
- [ ] Password strength validation
- [ ] Concurrent session handling

// tests/integration/auth.test.ts
- [ ] Signup flow end-to-end
- [ ] Login flow with valid/invalid credentials
- [ ] Session persistence across requests
- [ ] Logout revokes token
- [ ] Expired session rejection
- [ ] Multiple users independent sessions
```

### Task #3 Tests (Authorization)
```typescript
// tests/security/authorization.test.ts
- [ ] User cannot access other user's players
- [ ] User cannot modify other user's cards
- [ ] User cannot toggle other user's benefits
- [ ] Ownership check prevents data leakage
- [ ] 403 returned on unauthorized access
- [ ] Admin cannot bypass ownership checks
- [ ] Cross-user card addition blocked
- [ ] Cross-user benefit modification blocked
```

### Task #4 Tests (Cron)
```typescript
// tests/security/cron.test.ts
- [ ] Valid CRON_SECRET allows execution
- [ ] Invalid secret returns 401
- [ ] Timing attack resistance verified
- [ ] Rate limiting prevents spam
- [ ] Missing env var throws error
- [ ] Benefits actually reset on execution
```

### Task #5 Tests (Component)
```typescript
// tests/components/PlayerTabsContainer.test.tsx
- [ ] Cards render without crashing
- [ ] Prop names match (userCard)
- [ ] Tab filtering works
- [ ] No TypeScript errors
```

---

## ✅ Acceptance Criteria - Phase 1 Complete

### Authentication Works
- [ ] Users can signup with email/password
- [ ] Users can login with credentials
- [ ] Session cookie is created and persisted
- [ ] Session is validated on protected routes
- [ ] Users can logout and token is revoked

### Authorization Works
- [ ] Users can only access their own data
- [ ] Server actions verify ownership
- [ ] Cross-user access returns 403 Forbidden
- [ ] Cron endpoint is secured
- [ ] All mutations require valid session

### Security Verified
- [ ] No timing attacks possible
- [ ] Session revocation enforced
- [ ] CSRF protection via SameSite=Strict
- [ ] XSS protection via HTTP-only cookies
- [ ] Passwords hashed with Argon2
- [ ] Rate limiting prevents brute force

### App Stability
- [ ] Component prop mismatch fixed
- [ ] No crashes when displaying benefits
- [ ] TypeScript has zero errors
- [ ] All tests passing (80%+ coverage)

### QA Sign-Off
- [ ] Code review approved
- [ ] Security audit passed
- [ ] No known vulnerabilities
- [ ] All critical/high issues resolved

---

## 📚 Key Documents

### For Implementation:
1. **SPECIFICATION_AUTHENTICATION.md** - Full 33-task spec (read before coding)
2. **QA_REVIEW_PROCESS.md** - How to get code reviewed
3. **IMPLEMENTATION_PLAN.md** - Overall 6-phase plan

### For Reference:
4. **MASTER_WORKFLOW.md** - Daily workflow and process
5. **QA_SPECIFICATION_REVIEW_SUMMARY.md** - QA feedback (read critical issues!)

---

## 🚀 Getting Started NOW

### Step 1: Read & Understand (30 min)
```bash
# Read in this order:
1. This file (PHASE_1_READY_TO_START.md)
2. QA_SPECIFICATION_REVIEW_SUMMARY.md (critical issues)
3. SPECIFICATION_AUTHENTICATION.md (implementation details)
```

### Step 2: Set Up Development (20 min)
```bash
# Ensure environment is ready
node --version              # Should be 18+
npm --version               # Should be 9+

# Install/update dependencies
npm install

# Copy .env template
cp .env.example .env        # Edit with SESSION_SECRET, DATABASE_URL

# Set up database
npm run db:reset
npm run db:generate

# Verify app starts
npm run dev
# Should see: ready - started server on 0.0.0.0:3000
```

### Step 3: Start Implementation (Task #2)
```bash
# Begin Task #2 - Authentication System Implementation
# Follow the 5 task steps in this Phase 1 schedule

# For each task:
1. Write code following specification
2. Commit with clear message: "Task #2: Authentication system"
3. Submit for QA review with qa-code-reviewer agent
4. Address feedback from QA
5. Get approval before moving to next task
```

### Step 4: Each Day - Run Tests
```bash
npm run test                # Run all tests
npm run test:coverage       # Check coverage (target >80%)
npm run type-check          # Zero TypeScript errors
npm run lint                # Clean code quality
```

---

## 🎯 Success Metrics

**By end of Phase 1, we should have:**

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Auth System Complete | 100% | All signup/login/logout works |
| Authorization Enforced | 100% | No cross-user data access possible |
| Cron Security Fixed | 100% | Timing-safe comparison used |
| Component Stability | 100% | No crashes, TypeScript clean |
| Test Coverage | 80%+ | npm run test:coverage shows 80%+ |
| QA Approvals | 100% | All 5 tasks QA-reviewed and approved |
| No Critical Issues | 0 | Security audit shows zero vulns |

---

## 📞 Get Help

### If Stuck on Implementation:
1. Check the specification (SPECIFICATION_AUTHENTICATION.md)
2. Look at the acceptance criteria for your task
3. Check the code examples in this file
4. Ask in the daily standup

### If QA Review Fails:
1. Read the feedback carefully
2. Understand what the issue is
3. Make the fix
4. Re-submit for review
5. Do NOT skip to next task until approved

### If Tests Are Failing:
1. Run test in watch mode: `npm run test -- --watch`
2. Debug the failure
3. Check what the test expects
4. Fix the code
5. Re-run test

---

## ✨ Phase 1 Completion Checklist

### Before Declaring Phase 1 Complete:

**Code Quality:**
- [ ] All 5 tasks implemented
- [ ] All QA reviews passed
- [ ] Zero TypeScript errors
- [ ] No linting errors
- [ ] Code follows conventions

**Testing:**
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Security tests passing
- [ ] All tests combined >80% coverage
- [ ] No failing tests

**Security:**
- [ ] Authentication working (signup → login → logout)
- [ ] Authorization enforced (users can't access each other's data)
- [ ] Cron endpoint secured
- [ ] No timing attacks possible
- [ ] Session revocation working

**Functionality:**
- [ ] App doesn't crash on benefits display
- [ ] Components render without errors
- [ ] All server actions require auth
- [ ] All mutations check ownership

**Documentation:**
- [ ] Code comments for complex logic
- [ ] Commit messages explain changes
- [ ] Any blockers documented
- [ ] Lessons learned noted

---

## 🎉 What's Next After Phase 1

Once Phase 1 is complete and approved:

✅ **Phase 2** (Days 4-6): Fix high-priority bugs
- Centralize ROI logic
- Fix timezone handling
- Add input validation

✅ **Phase 3** (Days 7-10): Comprehensive testing
- Unit tests
- Integration tests
- Security tests

✅ **Phase 4** (Days 11-15): Missing features
- Import/Export
- Custom benefit values UI
- Card management
- Email alerts

✅ **Phase 5** (Days 16-18): UI Polish
- Modern design
- Loading states
- Accessibility

✅ **Phase 6** (Days 19-20): Documentation & Deploy
- Technical docs
- Deployment setup

---

**🚀 YOU ARE READY TO START PHASE 1 IMPLEMENTATION 🚀**

**Next Action:** Begin Task #2 - Authentication System Implementation

**Deadline:** 3 days (by April 4, 2026)

**Good luck!**

