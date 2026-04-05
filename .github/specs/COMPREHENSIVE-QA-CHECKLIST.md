# QA Issues - Developer Action Checklist

Use this checklist to track fixes for all identified issues. Each item links to the comprehensive report for details.

---

## 🔴 CRITICAL ISSUES (P0) - Must Fix Before Launch

### C1: TypeScript `any` Type Usage (31 Files)
**Report Section**: Critical Issues → C1  
**Effort**: 3 days | **Files**: 31

- [ ] Run type check: `npm run type-check 2>&1 | grep "any" > any-types.log`
- [ ] Review `/src/lib/import/validator.ts` (13 instances)
- [ ] Review `/src/features/import-export/lib/validator.ts` (13 instances)
- [ ] Review `/src/shared/lib/validation.ts` (7 instances)
- [ ] Review `/src/features/cards/components/modals/AddCardModal.tsx` (lines 37, 137)
- [ ] Create proper TypeScript types for import validators
- [ ] Replace `any` with proper types in all files
- [ ] Add eslint rule: `"@typescript-eslint/no-explicit-any": "error"`
- [ ] Run full type check: `npm run type-check` (should pass with zero errors)
- [ ] Run tests: `npm test` (should pass)
- [ ] Code review: Pair review of all changes
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Verification**:
```bash
npm run type-check 2>&1 | grep "any" | wc -l
# Expected output: 0
```

---

### C2: Missing Pagination on List Endpoints
**Report Section**: Critical Issues → C2  
**Effort**: 1 day | **Files**: 2

#### GET /api/cards/master
- [ ] Review current implementation
- [ ] Add pagination parameters: `?page=1&limit=50`
- [ ] Add limit validation: min 1, max 100, default 50
- [ ] Add total count calculation
- [ ] Return response format: `{ success: true, data: [], pagination: { total, page, limit } }`
- [ ] Add database index for pagination if needed
- [ ] Write test cases:
  - [ ] Test default pagination: `GET /api/cards/master`
  - [ ] Test page 2: `GET /api/cards/master?page=2`
  - [ ] Test custom limit: `GET /api/cards/master?limit=100`
  - [ ] Test limit cap: `GET /api/cards/master?limit=1000` (should cap to 100)
  - [ ] Test with 1000+ cards in database
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### GET /api/cards/my-cards
- [ ] Review current implementation
- [ ] Add same pagination as above
- [ ] Test with user having 1000+ cards
- [ ] Verify performance with large dataset
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Verification**:
```bash
# Test pagination
curl "http://localhost:3000/api/cards/master?page=1&limit=10"
# Should return: { success: true, data: [...], pagination: { total: X, page: 1, limit: 10 } }

# Test limit cap
curl "http://localhost:3000/api/cards/master?limit=1000"
# Should return: { pagination: { limit: 100, ... } }
```

---

### C3: Hardcoded Test Secrets in Codebase
**Report Section**: Critical Issues → C3  
**Effort**: 4 hours | **Files**: 3

#### .env.example
- [ ] Review current `.env.example` file
- [ ] Update SESSION_SECRET with descriptive placeholder
- [ ] Update CRON_SECRET with descriptive placeholder
- [ ] Add comment: "Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`"
- [ ] Verify `.gitignore` has: `.env*` and `.env.*.local`
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Test Files
- [ ] Search for hardcoded secrets in `/src/__tests__/`:
  - [ ] `cron-security.test.ts` - remove hardcoded secrets
  - [ ] `edge-runtime-auth-fix.test.ts` - remove hardcoded secrets
- [ ] Replace with: `process.env.SESSION_SECRET || 'default-for-tests'`
- [ ] Update CI/CD to set env vars in test runs
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Git History
- [ ] Run: `git log --oneline -p -- .env* | grep -E "^[+-].*SECRET"`
  - Look for any committed secrets
- [ ] If secrets were committed: rotate them immediately
- [ ] Document in security incident log (if any real secrets exposed)
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Verification**:
```bash
# Verify no secrets in git history
git log --oneline -p -- .env* | grep -i "secret" | head -5

# Verify no hardcoded secrets in test files
grep -r "minimum-32-chars" src/__tests__/ || echo "✅ No hardcoded secrets found"

# Verify .gitignore excludes .env files
grep "\.env" .gitignore | grep -v "\.example"
```

---

## 🟠 HIGH-PRIORITY ISSUES (P1) - Fix in Next Sprint

### H1: Inconsistent Error Response Format (22 Endpoints)
**Report Section**: High-Priority Issues → H1  
**Effort**: 3-4 days | **Files**: 22 API endpoints

#### Phase 1: Create Response Builder
- [ ] Create `/src/shared/lib/api-response.ts`:
  ```typescript
  interface ApiError {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  }
  
  export function errorResponse(code: string, message: string, fieldErrors?: {})
  export function successResponse<T>(data: T)
  export function validationError(fieldErrors: Record<string, string[]>)
  ```
- [ ] Create error code enum: `ERROR_CODES.VALIDATION_ERROR`, `AUTH_INVALID`, etc.
- [ ] Write tests for response builder
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Phase 2: Refactor All Endpoints (by category)

**Auth Endpoints** (4 files):
- [ ] `/api/auth/signup/route.ts`
- [ ] `/api/auth/login/route.ts`
- [ ] `/api/auth/logout/route.ts`
- [ ] `/api/auth/refresh-token/route.ts`
- [ ] Test: `npm test -- auth.test.ts`

**Card Endpoints** (5 files):
- [ ] `/api/cards/add/route.ts`
- [ ] `/api/cards/[id]/route.ts`
- [ ] `/api/cards/my-cards/route.ts`
- [ ] `/api/cards/available/route.ts`
- [ ] `/api/cards/master/route.ts`
- [ ] Test: `npm test -- cards.test.ts`

**Benefit Endpoints** (3 files):
- [ ] `/api/benefits/add/route.ts`
- [ ] `/api/benefits/[id]/route.ts`
- [ ] `/api/benefits/[id]/toggle-used/route.ts`
- [ ] Test: `npm test -- benefits.test.ts`

**Other Endpoints** (10+ files):
- [ ] `/api/user/profile/route.ts`
- [ ] `/api/cron/reset-benefits/route.ts`
- [ ] `/api/health/route.ts`
- [ ] All others...
- [ ] Test: Full test suite passes

#### Phase 3: Update Frontend
- [ ] Review all `fetch()` calls in components
- [ ] Update error handling to use unified format
- [ ] Test: E2E tests pass

- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Verification**:
```bash
npm test -- --run
# All tests should pass with new error format
```

---

### H2: Missing CSRF Protection
**Report Section**: High-Priority Issues → H2  
**Effort**: 2 days | **Files**: 3-5

#### Step 1: Create CSRF Token Utilities
- [ ] Create `/src/shared/lib/csrf.ts`:
  - [ ] `generateCSRFToken()` - creates random token
  - [ ] `storeCSRFToken(token, sessionId)` - stores in database
  - [ ] `verifyCSRFToken(token, sessionId)` - validates token
- [ ] Add `csrf_token` column to `Session` model in Prisma
- [ ] Run migration: `npx prisma migrate dev --name add_csrf_token`
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Step 2: Update Middleware
- [ ] Generate CSRF token after successful auth
- [ ] Store in session record
- [ ] Send to client in response (or meta tag)
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Step 3: Protect All State-Changing Routes
- [ ] Add CSRF validation to:
  - [ ] POST routes: signup, login, card add, benefit add
  - [ ] PATCH routes: card edit, benefit edit, benefit toggle
  - [ ] DELETE routes: card delete, benefit delete
- [ ] Skip CSRF check for: GET, HEAD, OPTIONS
- [ ] Return 403 Forbidden if CSRF validation fails
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Step 4: Update Frontend
- [ ] Fetch CSRF token on app load
- [ ] Send in `X-CSRF-Token` header for all POST/PATCH/DELETE
- [ ] Handle 403 responses appropriately
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Step 5: Test
- [ ] Write CSRF attack scenario test
- [ ] Verify legitimate requests work (with token)
- [ ] Verify attacks fail (without token)
- [ ] Test token expiration/rotation
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### H3: Password Validation Inconsistency
**Report Section**: High-Priority Issues → H3  
**Effort**: 1 day | **Files**: 2

#### Create Single Source of Truth
- [ ] Create `/src/config/auth.ts`:
  ```typescript
  export const PASSWORD_REQUIREMENTS = {
    minLength: 12,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  };
  
  export function getPasswordRequirementsList(password: string) {
    // Returns array of unmet requirements
  }
  ```
- [ ] Update `/src/features/auth/lib/password.ts` to use this config
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Update Signup Page
- [ ] Import new config
- [ ] Show same requirements list that backend will enforce
- [ ] Real-time validation as user types
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Update Login Page
- [ ] Remove 6-character minimum from UI
- [ ] Show actual requirements (same as signup)
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Testing
- [ ] Test signup with password that meets requirements
- [ ] Test login with same password (should succeed)
- [ ] Test password with 11 characters (should fail both)
- [ ] Test password with no uppercase (should fail both)
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### H4: Excessive Debug Logging
**Report Section**: High-Priority Issues → H4  
**Effort**: 1 day | **Files**: 4+

#### Create Logging Utility
- [ ] Create `/src/shared/lib/logger.ts`:
  ```typescript
  export const logger = {
    debug: (msg: string, data?: any) => {
      if (process.env.DEBUG === 'true') console.log(`[DEBUG] ${msg}`, data);
    },
    info: (msg: string, data?: any) => {
      console.log(`[INFO] ${msg}`, data);
    },
    error: (msg: string, error: Error) => {
      console.error(`[ERROR] ${msg}`, { message: error.message });
    }
  };
  ```
- [ ] Test: `DEBUG=true npm test` should show debug logs
- [ ] Test: `DEBUG=false npm test` should hide debug logs
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Replace Console Calls

**Middleware** (27 calls):
- [ ] `/src/middleware.ts` - Replace all 27 `console.log()` calls
- [ ] Remove token preview logging
- [ ] Move debug logs to debug level
- [ ] Test: Middleware logs once per request only
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Cron Handler** (5 calls):
- [ ] `/src/app/api/cron/reset-benefits/route.ts` - Replace all calls
- [ ] Keep important events (start, end, errors)
- [ ] Remove verbose event logging
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Custom Values** (11 calls):
- [ ] `/src/features/custom-values/actions/custom-values.ts` - Replace all calls
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

**Other Files**:
- [ ] Search: `grep -r "console\." src --include="*.ts" --include="*.tsx" | wc -l`
- [ ] Replace all remaining calls
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Verification
- [ ] All console calls replaced with logger
- [ ] No token/IP addresses logged
- [ ] Production deployment has DEBUG=false
- [ ] `npm run build` succeeds
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### H5: Input Validation on Route Parameters
**Report Section**: High-Priority Issues → H5  
**Effort**: 1 day | **Files**: 4

#### Create Validators
- [ ] Create `/src/shared/lib/id-validators.ts`:
  ```typescript
  export function validateCUID(id: unknown): id is string
  export function validateMongoId(id: unknown): id is string
  export function validateUUID(id: unknown): id is string
  ```
- [ ] Add tests for validators
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Update Endpoints
- [ ] `/api/benefits/[id]/route.ts`:
  - [ ] Validate benefitId in GET, PATCH, DELETE
  - [ ] Return 400 if invalid
  - [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

- [ ] `/api/cards/[id]/route.ts`:
  - [ ] Validate cardId
  - [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

- [ ] `/api/cards/master/[id]/route.ts`:
  - [ ] Validate masterCardId
  - [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

- [ ] Other parametrized routes
  - [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Testing
- [ ] Test with valid ID: `GET /api/benefits/c1234567890abcdef1234567`
- [ ] Test with invalid ID: `GET /api/benefits/invalid`
- [ ] Test with injection: `GET /api/benefits/"; DROP TABLE;"`
- [ ] Test with empty: `GET /api/benefits/`
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### H6: Rate Limiting on Public API Endpoints
**Report Section**: High-Priority Issues → H6  
**Effort**: 1 day | **Files**: 1

#### Update /api/cards/available
- [ ] Create rate limiter instance:
  ```typescript
  const cardListRateLimiter = new RateLimiter({
    maxAttempts: 100,
    windowMs: 60 * 60 * 1000,
  });
  ```
- [ ] Add rate limit check at start of handler
- [ ] Return 429 Too Many Requests if exceeded
- [ ] Include `Retry-After` header
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

#### Testing
- [ ] Test normal request succeeds
- [ ] Test with 100+ requests in 1 hour (should get 429)
- [ ] Test Retry-After header present
- [ ] Test different IPs get separate limits
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

## 🟡 MEDIUM-PRIORITY ISSUES (P2) - Post-Launch

### M1: N+1 Query Potential
**Report Section**: Medium-Priority Issues → M1  
**Effort**: 4 hours | **Files**: 1

- [ ] Review `/src/features/auth/lib/server.ts`
- [ ] Check `getUserSessions()` function
- [ ] Add Prisma includes where needed
- [ ] Add database indexes
- [ ] Test with many sessions
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### M2: Missing Database Constraints
**Report Section**: Medium-Priority Issues → M2  
**Effort**: 2 hours | **Files**: 1

- [ ] Review schema for missing constraints
- [ ] Add CHECK constraints for monetary values
- [ ] Add NOT NULL where appropriate
- [ ] Write migration: `npx prisma migrate dev --name add_constraints`
- [ ] Validate existing data doesn't violate constraints
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### M3: Missing Database Indexes
**Report Section**: Medium-Priority Issues → M3  
**Effort**: 2 hours | **Files**: 1

- [ ] Review schema for missing indexes
- [ ] Add compound indexes for common queries
- [ ] Add index on foreign keys
- [ ] Write migration: `npx prisma migrate dev --name add_indexes`
- [ ] Verify index usage with EXPLAIN plans
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### M4: Accessibility Features (WCAG 2.1)
**Report Section**: Medium-Priority Issues → M4  
**Effort**: 3-4 days | **Files**: 15+

- [ ] Add keyboard navigation to dashboard
- [ ] Add ARIA labels to all interactive elements
- [ ] Add alt text to all images
- [ ] Add focus-visible styling to buttons
- [ ] Add skip-to-main-content link
- [ ] Test with screen reader (NVDA/JAWS)
- [ ] Run axe DevTools audit
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### M5: Code Deduplication
**Report Section**: Medium-Priority Issues → M5  
**Effort**: 2 days | **Files**: 15+

- [ ] Extract common validation patterns
- [ ] Extract common error handling
- [ ] Extract common response formatting
- [ ] Update all endpoints to use shared utilities
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### M6: Bulk Operations
**Report Section**: Medium-Priority Issues → M6  
**Effort**: 2 days | **Files**: 2

- [ ] Create `PATCH /api/benefits/bulk` endpoint
- [ ] Create `PATCH /api/cards/bulk` endpoint
- [ ] Support multiple operations in single request
- [ ] Test performance with 100+ items
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

### M7: Comprehensive Test Coverage
**Report Section**: Medium-Priority Issues → M8  
**Effort**: 5-7 days | **Files**: tests/

- [ ] Add unit tests for password validation
- [ ] Add unit tests for rate limiter edge cases
- [ ] Add unit tests for session management
- [ ] Add integration tests for CSRF protection
- [ ] Add integration tests for pagination
- [ ] Add E2E tests for user workflows
- [ ] Achieve 80%+ code coverage on critical paths
- [ ] **Status**: ⬜ Not Started | ⏳ In Progress | ✅ Complete

---

## 📋 SUMMARY

### Status Legend
- ⬜ Not Started
- ⏳ In Progress  
- ✅ Complete
- ⚠️ Blocked

### Progress Tracking

**Critical (P0)**:
- C1: TypeScript `any` types - ⬜
- C2: Missing pagination - ⬜
- C3: Hardcoded secrets - ⬜
**P0 Total**: 0/3 (0%)

**High-Priority (P1)**:
- H1: Error format - ⬜
- H2: CSRF protection - ⬜
- H3: Password validation - ⬜
- H4: Debug logging - ⬜
- H5: Route validation - ⬜
- H6: Rate limiting - ⬜
**P1 Total**: 0/6 (0%)

**Medium-Priority (P2)**:
- M1-M7: Various - ⬜
**P2 Total**: 0/7 (0%)

### Timeline Estimate
- **P0 (Critical)**: 4-5 days
- **P1 (High)**: 1-2 weeks  
- **P2 (Medium)**: 2-3 weeks post-launch
- **Total**: 3-4 weeks to fully address all issues

---

**Last Updated**: 2024-04-05 | **Status**: Ready for Distribution
