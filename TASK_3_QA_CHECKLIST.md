# Task #3: Authorization Verification - QA Checklist

**Task:** Add authorization checks to server actions
**Status:** ✅ READY FOR QA REVIEW
**Implementation Date:** April 1, 2026

---

## Code Review Checklist

### Authentication Enforcement

- [ ] **wallet.ts: addCardToWallet()**
  - [ ] Function starts with `getAuthUserIdOrThrow()`
  - [ ] Wrapped in try/catch
  - [ ] Returns error object on failure
  - [ ] Error message is "Not authenticated"

- [ ] **benefits.ts: toggleBenefit()**
  - [ ] Function starts with `getAuthUserIdOrThrow()`
  - [ ] Wrapped in try/catch
  - [ ] Returns error object with `code: 'UNAUTHORIZED'`
  - [ ] Error message is "Not authenticated"

- [ ] **benefits.ts: updateUserDeclaredValue()**
  - [ ] Function starts with `getAuthUserIdOrThrow()`
  - [ ] Wrapped in try/catch
  - [ ] Returns error object with `code: 'UNAUTHORIZED'`
  - [ ] Error message is "Not authenticated"

### Authorization Enforcement

- [ ] **wallet.ts: addCardToWallet()**
  - [ ] Calls `verifyPlayerOwnership(playerId, userId)`
  - [ ] Checks `ownership.isOwner` before mutation
  - [ ] Returns error if ownership fails
  - [ ] Error message contains "permission"

- [ ] **benefits.ts: toggleBenefit()**
  - [ ] Calls `verifyBenefitOwnership(benefitId, userId)`
  - [ ] Checks `ownership.isOwner` before mutation
  - [ ] Returns error with `code: 'UNAUTHORIZED'` if ownership fails
  - [ ] Error message contains "permission"

- [ ] **benefits.ts: updateUserDeclaredValue()**
  - [ ] Calls `verifyBenefitOwnership(benefitId, userId)`
  - [ ] Checks `ownership.isOwner` before mutation
  - [ ] Returns error with `code: 'UNAUTHORIZED'` if ownership fails
  - [ ] Error message contains "permission"

### Race Condition Prevention

- [ ] **benefits.ts: toggleBenefit()**
  - [ ] WHERE clause includes `isUsed: currentIsUsed`
  - [ ] Conditional update check is in place
  - [ ] Catches P2025 error (Prisma record not found)
  - [ ] Returns error with `code: 'ALREADY_CLAIMED'`
  - [ ] Error message suggests user to refresh

### Import Statements

- [ ] **wallet.ts imports:**
  - [ ] `getAuthUserIdOrThrow` from `@/lib/auth-server`
  - [ ] `verifyPlayerOwnership` from `@/lib/auth-server`

- [ ] **benefits.ts imports:**
  - [ ] `getAuthUserIdOrThrow` from `@/lib/auth-server`
  - [ ] `verifyBenefitOwnership` from `@/lib/auth-server`
  - [ ] `Prisma` from `@prisma/client` (for P2025)

### Documentation

- [ ] **Code Comments**
  - [ ] Functions document authorization requirements
  - [ ] Comments explain *why*, not just *what*
  - [ ] Race condition logic is documented
  - [ ] Error handling is documented

- [ ] **Function JSDoc**
  - [ ] `addCardToWallet()` mentions AUTHORIZATION
  - [ ] `toggleBenefit()` mentions AUTHORIZATION and race conditions
  - [ ] `updateUserDeclaredValue()` mentions AUTHORIZATION

### Code Quality

- [ ] No hardcoded user IDs or permissions
- [ ] No TODO or FIXME comments
- [ ] Consistent error handling pattern
- [ ] DRY principle followed (no duplicated ownership checks)
- [ ] No console.log in production code (only console.error for debugging)

---

## Type Safety Checklist

### TypeScript Compilation

- [ ] Run: `npm run type-check`
- [ ] Result: 0 errors
- [ ] No type: any used in auth code
- [ ] Return types are properly typed:
  - [ ] `Promise<AddCardResult>` for addCardToWallet
  - [ ] `Promise<BenefitActionResult>` for toggleBenefit
  - [ ] `Promise<BenefitActionResult>` for updateUserDeclaredValue

### Type Definitions

- [ ] `OwnershipCheckResult` used consistently
- [ ] Error objects match type signatures
- [ ] No implicit any types

---

## Test Coverage Checklist

### Test Files Exist

- [ ] `/tests/security/authorization.test.ts` exists
- [ ] `/tests/security/authorization.manual.test.ts` exists

### Vitest Suite (authorization.test.ts)

- [ ] Test file uses Vitest syntax
- [ ] Tests describe blocks organized by function
- [ ] 19+ test cases present
- [ ] Tests for Player ownership verification
- [ ] Tests for Card ownership verification
- [ ] Tests for Benefit ownership verification
- [ ] Tests for cross-user access prevention
- [ ] Tests for data isolation

### Manual Test Runner (authorization.manual.test.ts)

- [ ] Can run without Vitest: `npx tsx ...`
- [ ] Custom test runner utilities present (assert, test, section)
- [ ] Same test coverage as Vitest version
- [ ] Setup/cleanup functions present
- [ ] Test data creation is isolated

### Test Scenarios

- [ ] Test: User A owns player A
- [ ] Test: User B cannot access User A's player
- [ ] Test: Non-existent player returns error
- [ ] Test: User A owns card A
- [ ] Test: User B cannot access User A's card
- [ ] Test: Non-existent card returns error
- [ ] Test: User A owns benefit A
- [ ] Test: User B cannot access User A's benefit
- [ ] Test: Non-existent benefit returns error
- [ ] Test: User A's players isolated from User B
- [ ] Test: User A's cards isolated from User B
- [ ] Test: User A's benefits isolated from User B
- [ ] Test: Ownership chains work (User → Player → Card)
- [ ] Test: Ownership chains work (User → Player → Benefit)
- [ ] Test: Different users break ownership chains

---

## Security Testing Checklist

### Manual Security Testing

#### Setup
- [ ] Create test User A account
- [ ] Create test User B account
- [ ] User A adds card X to their player
- [ ] User B adds card Y to their player

#### Cross-User Card Access Test
- [ ] User A tries to access User B's card Y via API
- [ ] Expected: 403 Forbidden or error response
- [ ] Actual: ✓ Error returned with proper message

#### Cross-User Card Mutation Test
- [ ] User A tries to add card to User B's player via API
- [ ] Expected: 403 Forbidden or error response
- [ ] Actual: ✓ Error returned with proper message

#### Cross-User Benefit Access Test
- [ ] User A tries to toggle User B's benefit via API
- [ ] Expected: 403 Forbidden or error response
- [ ] Actual: ✓ Error returned with proper message

#### Race Condition Test
- [ ] Send two concurrent toggleBenefit requests for same benefit
- [ ] Expected: First succeeds, second fails with ALREADY_CLAIMED
- [ ] Actual: ✓ Race condition properly handled

#### Unauthenticated Request Test
- [ ] Send request without session cookie
- [ ] Expected: Not authenticated error
- [ ] Actual: ✓ Error returned

#### Invalid Session Test
- [ ] Send request with invalid/expired session
- [ ] Expected: Not authenticated error
- [ ] Actual: ✓ Error returned

### Cron Endpoint Security Testing

- [ ] Verify CRON_SECRET uses timing-safe comparison
- [ ] Verify rate limiting (10/hour per IP)
- [ ] Verify environment variable validation
- [ ] Verify logging includes IP address
- [ ] Verify 429 status on rate limit
- [ ] Verify 401 status on auth failure
- [ ] Verify 500 status on env error

---

## Performance Checklist

### Database Query Performance

- [ ] Ownership verification uses indexed columns (id)
- [ ] No N+1 queries in ownership checks
- [ ] Conditional updates in toggleBenefit don't cause extra queries
- [ ] Joins to Player table are efficient

### Response Time

- [ ] Authorization checks add <10ms per request
- [ ] No noticeable delay in UI
- [ ] Cron endpoint still completes quickly

---

## Documentation Checklist

### Implementation Summary
- [ ] `/TASK_3_IMPLEMENTATION_SUMMARY.md` exists
- [ ] Contains overview of changes
- [ ] Lists all modified files
- [ ] Explains authorization flow
- [ ] Documents technical decisions
- [ ] Lists acceptance criteria

### Verification Report
- [ ] `/TASK_3_VERIFICATION_REPORT.md` exists
- [ ] Contains verification details
- [ ] Lists all tests and results
- [ ] QA review instructions included
- [ ] Deployment checklist present

### Before/After Comparison
- [ ] `/TASK_3_BEFORE_AFTER_COMPARISON.md` exists
- [ ] Shows code before changes
- [ ] Shows code after changes
- [ ] Explains each change
- [ ] Documents security improvements

### QA Checklist
- [ ] This file (`TASK_3_QA_CHECKLIST.md`)

---

## Acceptance Criteria Verification

### From SPECIFICATION_AUTHENTICATION.md - Task 2.3 onwards

#### Authorization Verification Requirements

- [ ] Get userId at start of each server action using `getAuthUserIdOrThrow()`
- [ ] Verify ownership before any mutations
- [ ] Return error objects with proper status codes
- [ ] All server actions verify userId and ownership

#### For wallet.ts - addCardToWallet

- [ ] Get userId from context
- [ ] Verify user owns the player (player.userId === userId)
- [ ] Return `{ success: false, error: 'Unauthorized' }` if ownership fails

#### For benefits.ts - toggleBenefit

- [ ] Get userId from context
- [ ] Verify user owns the benefit (through player relationship)
- [ ] Use conditional update to handle race condition
- [ ] Return ALREADY_CLAIMED error code on P2025 Prisma errors

#### Testing Requirements

- [ ] Tests prove User A cannot modify User B's data
- [ ] Test cross-user card addition is blocked
- [ ] Test cross-user benefit modification is blocked
- [ ] All tests pass
- [ ] Zero TypeScript errors

---

## Regression Testing Checklist

### Existing Functionality

- [ ] Valid user can still add cards
- [ ] Valid user can still toggle benefits
- [ ] Valid user can still update declared values
- [ ] Legitimate requests still succeed
- [ ] Benefits still reset on cron execution

### Error Cases

- [ ] Not authenticated still returns appropriate error
- [ ] Invalid data still returns validation error
- [ ] Database errors still return generic error message
- [ ] Missing resources return not found error

---

## Deployment Readiness Checklist

- [ ] Code review approved: ___________
- [ ] Tests passing: ___________
- [ ] TypeScript clean: ___________
- [ ] Security review approved: ___________
- [ ] Performance acceptable: ___________
- [ ] Documentation complete: ___________
- [ ] QA testing complete: ___________

### Pre-Deployment

- [ ] All tests pass on staging
- [ ] No warnings in test output
- [ ] No console errors in dev tools
- [ ] Database migrations applied
- [ ] Environment variables configured

### Post-Deployment Monitoring

- [ ] Check error logs for UNAUTHORIZED messages
- [ ] Verify cron runs successfully
- [ ] Monitor database query performance
- [ ] Check for rate limit errors (should be 0)
- [ ] Verify no cross-user data leakage

---

## Bug Tracking

### Known Issues
- [ ] None

### Deferred Items
- [ ] None

### Questions/Clarifications
- [ ] None

---

## Sign-Off

### QA Review

- [ ] Code review completed: __________
- [ ] Date: __________
- [ ] Reviewer: __________
- [ ] Result: ✅ APPROVED / ❌ FAILED

### Security Review

- [ ] Security review completed: __________
- [ ] Date: __________
- [ ] Reviewer: __________
- [ ] Result: ✅ APPROVED / ❌ FAILED

### Final Approval

- [ ] All checks passed
- [ ] Ready for production deployment
- [ ] Known issues documented
- [ ] Final sign-off: __________

---

## How to Use This Checklist

1. **Code Review Phase:**
   - Go through "Code Review Checklist"
   - Verify all items are checked
   - Note any issues found

2. **Type Safety Phase:**
   - Run `npm run type-check`
   - Verify zero errors
   - Check TypeScript configuration

3. **Test Verification Phase:**
   - Review test files
   - Run test suite
   - Verify all tests pass

4. **Security Testing Phase:**
   - Follow manual security tests
   - Test each scenario
   - Document results

5. **Performance Phase:**
   - Check query performance
   - Measure response times
   - Verify no regressions

6. **Final Phase:**
   - Fill out sign-off section
   - Get approvals
   - Document final status

---

## Quick Reference

### Key Files Modified
```
src/actions/wallet.ts          (Authentication + Authorization)
src/actions/benefits.ts        (Authentication + Authorization + Race conditions)
src/app/api/cron/reset-benefits/route.ts (Timing-safe + Rate limiting)
```

### Key Functions Added
```
getAuthUserIdOrThrow()      - Get user from context, throw if missing
verifyPlayerOwnership()     - Check if user owns player
verifyBenefitOwnership()    - Check if user owns benefit
```

### Key Tests Added
```
tests/security/authorization.test.ts           (Vitest)
tests/security/authorization.manual.test.ts    (Manual runner)
```

### Error Codes to Expect
```
"Not authenticated"       - No session or invalid token
"Unauthorized"           - User doesn't own resource
"UNAUTHORIZED"           - Error code for auth failures
"ALREADY_CLAIMED"        - Race condition detected
```

---

## Contact

For questions about this implementation:
- See: `/TASK_3_IMPLEMENTATION_SUMMARY.md`
- See: `/TASK_3_BEFORE_AFTER_COMPARISON.md`
- See: `/TASK_3_VERIFICATION_REPORT.md`

---

**END OF QA CHECKLIST**

Use this checklist to verify Task #3 implementation before approving for production.
