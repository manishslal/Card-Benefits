# P0-3: Hardcoded Secrets Audit

## Executive Summary

**Status**: ⚠️ CRITICAL - Real secrets exposed in `.env` file  
**Impact**: Database credentials and sensitive keys visible in repository  
**Risk**: HIGH - potential unauthorized access if repository is compromised  
**Scope**: Hardcoded values in code and committed `.env` files  

---

## Critical Findings

### 🚨 SEVERITY: CRITICAL

#### Finding 1: Database Credentials Exposed in `.env`

**File**: `.env` (at repository root)  
**Status**: ❌ **COMMITTED TO GIT** (should never be committed)  
**Content**:
```
DATABASE_URL="postgresql://postgres:tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb@junction.proxy.rlwy.net:57123/railway"
SESSION_SECRET = ed28d17436a88268a95ce1f5604ded44d13aa2d7e01045da8a860c9bbee2c8c8
CRON_SECRET = your-local-test-cron-secret-here
NODE_ENV=development
```

**Issues**:
- 🔴 **PostgreSQL password exposed**: `tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb`
- 🔴 **Session secret exposed**: 64-character hex key visible
- 🔴 **Database host exposed**: `junction.proxy.rlwy.net` (Railway internal network)
- 🔴 **Database name exposed**: `railway` (production database)
- ⚠️ **User account exposed**: `postgres` (superuser)
- ⚠️ **Port exposed**: `57123`

**Severity**: 🚨 **IMMEDIATE ACTION REQUIRED**
- This is a production Railway PostgreSQL instance
- Any person with this file has full database access
- Credentials should be rotated IMMEDIATELY in Railway dashboard
- This file must be removed from git history

---

#### Finding 2: Fallback Secret in Source Code

**File**: `src/middleware-redis-example.ts`  
**Line**: 24-25  
**Status**: ⚠️ Hardcoded fallback in code (not used in production but poor practice)

```typescript
const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key'  // ⚠️ FALLBACK VALUE
);
```

**Issue**: 
- If `SESSION_SECRET` env var is not set, falls back to `'your-secret-key'`
- This string is weak and predictable
- Used in production if env var is missing

**Severity**: 🟡 MEDIUM - Low risk because:
- This is in `*-example.ts` file (not integrated in production middleware)
- Production uses `src/middleware.ts` instead
- But problematic pattern if copied to main middleware

---

### ⚠️ SEVERITY: HIGH

#### Finding 3: Test Secrets Hardcoded in `.env.test`

**File**: `.env.test`  
**Status**: ⚠️ Test credentials hardcoded (acceptable for test but should be generated)

```env
DATABASE_URL="file:./prisma/test.db"
CRON_SECRET="test-secret-12345-for-testing-only-long-enough"
SESSION_SECRET="test-session-secret-for-testing-must-be-32-bytes-minimum-length"
NODE_ENV="test"
```

**Issue**:
- Test secrets are hardcoded and predictable
- While test environment is less critical, they should be:
  - Generated at runtime OR
  - Different from any production-like values OR
  - At minimum, clearly marked as test-only

**Severity**: 🟡 MEDIUM - Test data, but:
- Should NOT be committed to version control
- Could be used as reference for attacks
- Not a production threat but poor practice

---

#### Finding 4: Test Secrets Hardcoded in Tests

**File**: `src/__tests__/cron-endpoint.integration.test.ts`  
**Line**: 31  
**Status**: ⚠️ Fallback test secret hardcoded

```typescript
const testSecret = process.env.CRON_SECRET || 'test-secret-minimum-32-chars-value';
const authHeader = `Bearer ${testSecret}`;
```

**Issue**:
- Fallback secret `'test-secret-minimum-32-chars-value'` is hardcoded
- If `CRON_SECRET` env var not set, uses predictable fallback
- Tests shouldn't depend on secrets at all (should mock/stub)

**Severity**: 🟡 MEDIUM - Test code but:
- Should use mocking instead of real secrets
- Hardcoded fallbacks are anti-pattern

---

### 🟢 SEVERITY: LOW

#### Finding 5: Placeholder Comments (Safe, Informational Only)

**File**: `.env.example`  
**Status**: ✅ SAFE - Template with instructions, no real values

```env
DATABASE_URL="file:./dev.db"
# Comment: DATABASE_URL="postgresql://user:password@host:5432/card_benefits"
SESSION_SECRET=""  # Placeholder - empty
CRON_SECRET=""     # Placeholder - empty
NODE_ENV=development
```

**Assessment**: ✅ Good - No actual secrets, only placeholders and comments

---

#### Finding 6: Password Validation (NOT a secret)

**File**: Multiple validation files  
**Lines**: Various (password.ts, passwordValidator.ts, etc.)

```typescript
// Examples in src/features/auth/lib/password.ts
if (!/[A-Z]/.test(password)) { ... }
if (!/[a-z]/.test(password)) { ... }
if (!/\d/.test(password)) { ... }
```

**Assessment**: ✅ SAFE - These are password validation patterns, not actual passwords

---

## Gitignore Status

**File**: `.gitignore`

```
# Environment variables
.env
.env.local
.env.*.local
```

**Assessment**: ✅ CORRECT
- `.env` is properly listed in `.gitignore`
- `.env.local` is properly ignored
- `.env.*.local` pattern covers all local variants

**Issue**: ❌ **BUT `.env` is ALREADY COMMITTED to git history**
- File was committed before being added to `.gitignore`
- Just adding to `.gitignore` doesn't remove it from git history
- Must use `git rm --cached .env` and `git filter-repo` to remove

---

## .env Files Summary

| File | Location | Status | Issue | Action |
|------|----------|--------|-------|--------|
| `.env` | Root | ❌ CRITICAL | Production secrets committed | **ROTATE + GIT FILTER** |
| `.env.example` | Root | ✅ SAFE | Template only | No action needed |
| `.env.test` | Root | ⚠️ HIGH | Test secrets hardcoded | Review if committed |
| `.env.local` | Not found | ✅ SAFE | Properly ignored | Confirm in .gitignore |
| `.env.production.template` | Root | ⚠️ Check | Template for production | Review contents |

---

## `.env.production.template` Review

**File**: `.env.production.template`  
**Status**: Need to verify contents (not examined in detail)

This file should be safe (template), but should:
- ✅ Contain no actual secrets
- ✅ Have clear instructions for setting production values
- ✅ Use placeholder values like empty strings or `YOUR_VALUE_HERE`

**Action**: Review to confirm it contains no real credentials

---

## Hardcoded Secrets Index

| Secret Type | Location | Value | Severity | Status |
|------------|----------|-------|----------|--------|
| PostgreSQL password | `.env` | `tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb` | 🔴 CRITICAL | Exposed |
| Session secret (hex) | `.env` | `ed28d17436a88268a95ce1f5604ded44d13aa2d7e01045da8a860c9bbee2c8c8` | 🔴 CRITICAL | Exposed |
| Database host | `.env` | `junction.proxy.rlwy.net` | 🔴 CRITICAL | Exposed |
| Database name | `.env` | `railway` | 🔴 CRITICAL | Exposed |
| CRON_SECRET test | `.env.test` | `test-secret-12345-for-testing-only-long-enough` | 🟡 MEDIUM | Low risk |
| SESSION_SECRET test | `.env.test` | `test-session-secret-for-testing-must-be-32-bytes-minimum-length` | 🟡 MEDIUM | Low risk |
| JWT fallback | `middleware-redis-example.ts` | `your-secret-key` | 🟡 MEDIUM | Low risk (example file) |
| CRON_SECRET fallback | `cron-endpoint.integration.test.ts` | `test-secret-minimum-32-chars-value` | 🟡 MEDIUM | Test code |

---

## Fix Implementation Checklist

### Immediate Actions (DO NOW)

- [ ] **STOP: Rotate all exposed credentials**
  - [ ] Go to Railway dashboard
  - [ ] Rotate PostgreSQL `postgres` user password
  - [ ] Generate new DATABASE_URL
  - [ ] Generate new SESSION_SECRET (256-bit = 32 hex chars)
  - [ ] Generate new CRON_SECRET (256-bit = 32 hex chars)
  - [ ] Document new values (store in Railway secrets, not git)

- [ ] **Remove `.env` from git history** (⚠️ MUST DO THIS)
  ```bash
  # Option 1: Using git-filter-repo (RECOMMENDED)
  pip install git-filter-repo
  git filter-repo --invert-paths --paths .env
  
  # Option 2: Using BFG repo cleaner
  bfg --delete-files .env
  
  # Option 3: Manual git-filter-branch (slower)
  git filter-branch --tree-filter 'rm -f .env' HEAD
  
  # After filtering, force push (⚠️ requires force push permission)
  git push origin --force --all
  git push origin --force --tags
  ```

- [ ] **Create `.env` locally (NOT committed)**
  ```bash
  # Only on your local machine
  cp .env.example .env
  # Edit with YOUR new credentials from Railway
  nano .env
  # Verify it's in .gitignore
  grep ".env" .gitignore
  ```

### Short-term Actions (This Week)

- [ ] **Remove hardcoded fallback from `middleware-redis-example.ts`**
  ```typescript
  // BEFORE:
  process.env.SESSION_SECRET || 'your-secret-key'
  
  // AFTER:
  process.env.SESSION_SECRET || (() => {
    throw new Error('SESSION_SECRET environment variable is required');
  })()
  ```

- [ ] **Update `src/__tests__/cron-endpoint.integration.test.ts`**
  ```typescript
  // BEFORE:
  const testSecret = process.env.CRON_SECRET || 'test-secret-minimum-32-chars-value';
  
  // AFTER:
  const testSecret = process.env.CRON_SECRET || (() => {
    throw new Error('CRON_SECRET environment variable is required for tests');
  })();
  ```

- [ ] **Move test secrets from `.env.test` to test setup**
  ```typescript
  // Create src/__tests__/setup.ts or update existing setup
  beforeAll(() => {
    if (!process.env.CRON_SECRET) {
      process.env.CRON_SECRET = 'test-secret-12345-for-testing-only-long-enough';
    }
    if (!process.env.SESSION_SECRET) {
      process.env.SESSION_SECRET = 'test-session-secret-for-testing-must-be-32-bytes-minimum-length';
    }
  });
  ```

- [ ] **Regenerate `.env.test` with fresh values**
  ```bash
  openssl rand -hex 32  # Generate SESSION_SECRET
  openssl rand -hex 32  # Generate CRON_SECRET
  # Update .env.test with new values
  ```

- [ ] **Review `.env.production.template`**
  - [ ] Open and scan for any real values
  - [ ] Confirm only placeholders/examples
  - [ ] Add clear instructions in comments

### Documentation Updates

- [ ] **Update README.md**
  ```markdown
  ## Environment Setup
  
  ### Local Development
  1. Copy `.env.example` to `.env.local`
  2. Fill in development values:
     - DATABASE_URL: Use local SQLite or dev PostgreSQL
     - SESSION_SECRET: Generate with `openssl rand -hex 32`
     - CRON_SECRET: Generate with `openssl rand -hex 32`
  3. NEVER commit `.env.local` or `.env`
  
  ### Production
  1. Use Railway dashboard or CI/CD secrets management
  2. Set these environment variables:
     - DATABASE_URL
     - SESSION_SECRET
     - CRON_SECRET
     - NODE_ENV=production
  ```

- [ ] **Create SECRETS.md**
  ```markdown
  # Secrets Management
  
  ## Environment Variables (Required)
  
  ### SESSION_SECRET
  - **Description**: JWT signing key for session tokens
  - **Length**: 256 bits (32 bytes hex = 64 chars)
  - **Generation**: `openssl rand -hex 32`
  - **Location**: Environment variable only (never committed)
  
  ### CRON_SECRET
  - **Description**: Bearer token for cron job authentication
  - **Length**: 256 bits (32 bytes hex = 64 chars)
  - **Generation**: `openssl rand -hex 32`
  - **Location**: Environment variable only (never committed)
  
  ### DATABASE_URL
  - **Description**: PostgreSQL connection string
  - **Format**: `postgresql://user:password@host:port/database`
  - **Location**: Environment variable only (never committed)
  - **Rotation**: When credentials are compromised
  
  ## Rotation Procedures
  
  ### When to Rotate
  - After any security breach
  - Quarterly as security best practice
  - When team member leaves
  - After accidental exposure
  
  ### How to Rotate
  1. Generate new credentials
  2. Update in Railway dashboard
  3. Update in CI/CD secrets
  4. Restart applications to pick up new values
  5. Monitor for errors
  6. Document rotation date
  ```

### CI/CD Security

- [ ] **Verify GitHub Actions doesn't log secrets**
  - [ ] Check workflow files for `run: echo $SECRET`
  - [ ] Add `secrets.REDACTED` masking where needed
  - [ ] Review action logs on GitHub (verify secrets not printed)

- [ ] **Verify Railway deployment secrets are set**
  - [ ] Go to Railway dashboard
  - [ ] Confirm DATABASE_URL is in variables
  - [ ] Confirm SESSION_SECRET is in variables
  - [ ] Confirm CRON_SECRET is in variables

---

## Validation Checklist

After implementing fixes:

- [ ] **Verify `.env` is no longer in git history**
  ```bash
  git log -p -- .env | head -20
  # Should show: "fatal: Path '.env' does not exist"
  ```

- [ ] **Verify `.env` is in `.gitignore`**
  ```bash
  git check-ignore .env
  # Should output: .env
  ```

- [ ] **Verify local `.env` is not tracked**
  ```bash
  git status
  # Should NOT show: .env
  ```

- [ ] **Verify no secrets in source code**
  ```bash
  grep -r "password123\|secret-key\|test-secret" src/ --include="*.ts"
  # Should return: No results
  
  grep -r "ed28d1743\|tsfINxw\|junction.proxy" src/
  # Should return: No results (old secrets)
  ```

- [ ] **Verify new Railway credentials work**
  ```bash
  npm run prisma:generate
  npm run prisma:migrate
  # Should connect successfully with new DATABASE_URL
  ```

- [ ] **Verify tests pass with new CRON_SECRET**
  ```bash
  npm test -- cron-endpoint.integration.test.ts
  # Should pass without errors
  ```

---

## Summary

| Category | Count | Severity | Status |
|----------|-------|----------|--------|
| **Critical Issues** | 1 | 🔴 CRITICAL | `.env` with real secrets committed |
| **High Issues** | 2 | 🟡 HIGH | Test hardcoded values |
| **Medium Issues** | 2 | 🟡 MEDIUM | Fallback secrets in code |
| **Low Issues** | 0 | 🟢 LOW | None |
| **Safe Configs** | 1 | ✅ SAFE | `.env.example` properly templated |

---

## Risk Assessment

**Current Risk**: 🔴 **CRITICAL**
- Production database credentials exposed in committed `.env`
- Any person with access to this repository has database access
- Could be used to modify/delete production data
- Could be used for data exfiltration

**Risk Mitigation Priority**:
1. **Immediate** (Today): Rotate all credentials in Railway
2. **Urgent** (This week): Remove `.env` from git history
3. **Soon** (Next sprint): Code review for other hardcoded secrets

---

## References

- **Git History Cleaning**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- **git-filter-repo**: https://github.com/newren/git-filter-repo
- **OWASP: Secrets Management**: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **Railway: Environment Variables**: https://docs.railway.app/develop/variables

---

## Post-Implementation Verification

Once all fixes are complete, run:

```bash
#!/bin/bash
# secrets-audit.sh

echo "=== Secrets Audit ==="

# 1. Check for exposed credentials in git history
echo "1. Checking git history for exposed credentials..."
git log -p -S "tsfINxwNmjUZwrXtrZzxxbKTDLbAmZKb" -- | grep -q "password" && \
  echo "❌ FOUND: Old PostgreSQL password in history" || \
  echo "✅ CLEAR: No old password in history"

# 2. Verify .env is ignored
echo "2. Checking .gitignore..."
git check-ignore .env > /dev/null && \
  echo "✅ .env is properly ignored" || \
  echo "❌ .env is not in .gitignore"

# 3. Search for hardcoded secrets in source
echo "3. Searching source code for secrets..."
FOUND=0
for pattern in "password123" "secret-key" "test-secret" "Bearer test"; do
  grep -r "$pattern" src/ --include="*.ts" && FOUND=1
done
[ $FOUND -eq 0 ] && echo "✅ No hardcoded secrets found" || \
  echo "❌ Hardcoded secrets found in source"

# 4. Verify environment variables are set
echo "4. Checking environment variables..."
[ -n "$DATABASE_URL" ] && echo "✅ DATABASE_URL is set" || \
  echo "⚠️  DATABASE_URL not set (required for runtime)"
[ -n "$SESSION_SECRET" ] && echo "✅ SESSION_SECRET is set" || \
  echo "⚠️  SESSION_SECRET not set (required for runtime)"
[ -n "$CRON_SECRET" ] && echo "✅ CRON_SECRET is set" || \
  echo "⚠️  CRON_SECRET not set (required for cron jobs)"

echo "=== Audit Complete ==="
```

Save as `.github/scripts/secrets-audit.sh` and run before deployments.
