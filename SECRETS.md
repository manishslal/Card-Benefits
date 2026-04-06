# Secrets Management & Credential Rotation Guide

## Overview

This document describes how to manage sensitive credentials (database passwords, session secrets, API keys) securely throughout the Card Benefits application lifecycle.

**CRITICAL**: Secrets should NEVER be committed to version control. They must be managed through environment variables only.

---

## Environment Variables (Required)

### SESSION_SECRET

**Purpose**: JWT signing key for session tokens and authentication

**Format**: 256-bit random hex string (64 characters)

**Length requirement**: Minimum 32 bytes (= 64 hex characters)

**Generation**:
```bash
# Linux/Mac
openssl rand -hex 32

# Windows PowerShell
[System.Convert]::ToBase64String([byte[]]32 | ForEach-Object {[Math]::Floor([Math]::Random() * 256)})
```

**Storage**:
- **Development**: `.env.local` (local machine only, never committed)
- **Testing**: `.env.test` (generated with proper length)
- **Production**: Railway Dashboard Environment Variables (never committed)

**Rotation Schedule**: Every 90 days minimum
- **Impact**: All active sessions become invalid (users must re-login)
- **Procedure**: Generate new value → Update in deployment platform → Restart application

**Example value**: `97836b354529a66ccb1d8792a45769530f3dff2dd44a550bb431931366da0ace`

### CRON_SECRET

**Purpose**: Bearer token for authenticating `/api/cron/reset-benefits` endpoint

**Format**: 256-bit random hex string (64 characters)

**Length requirement**: Minimum 32 bytes (= 64 hex characters)

**Generation**: Same as SESSION_SECRET
```bash
openssl rand -hex 32
```

**Storage**:
- **Development**: `.env.local`
- **Testing**: `.env.test`
- **Production**: Railway Dashboard Environment Variables

**Rotation Schedule**: Every 90 days minimum
- **Impact**: Cron job scheduler must be updated with new secret
- **Procedure**: Generate new value → Update in railway.json or CI/CD → Verify cron jobs continue

**Example value**: `614f7dac39db6fe571d76c610d392a52df31c1f55eb1f7979a6482372cbd9a4d`

### DATABASE_URL

**Purpose**: PostgreSQL connection string

**Format**: `postgresql://[user]:[password]@[host]:[port]/[database]`

**Example**: `postgresql://postgres:securepassword@junction.proxy.rlwy.net:57123/railway`

**Storage**:
- **Development**: `.env.local` (local SQLite or dev PostgreSQL)
- **Testing**: `.env.test` (local SQLite test database)
- **Production**: Railway Dashboard (automatically provided when PostgreSQL is added)

**Rotation Schedule**: As needed
- **Triggers**: After security breach, quarterly, when team member leaves
- **Procedure**:
  1. Go to Railway Dashboard → PostgreSQL service
  2. Click on "Details" → "Users"
  3. Select `postgres` user → Change password
  4. Copy new DATABASE_URL
  5. Update in Railway environment variables
  6. Restart application
  7. Verify connectivity with: `npm run prisma:generate && npm run prisma:validate`

---

## When to Rotate Credentials

### IMMEDIATE Rotation (Today)
- ❌ Security breach or data leak
- ❌ Credentials exposed in code or logs
- ❌ Unauthorized access detected
- ❌ Team member with access leaves suddenly

### Regular Rotation (Quarterly - Every 90 Days)
- Scheduled rotation as security best practice
- Part of regular security maintenance
- Documented in rotation log

### Triggered Rotation (As Needed)
- After team member leaves organization
- After accidental exposure to logs
- After suspected unauthorized access
- When upgrading to new version of service

---

## Credential Rotation Procedures

### Step 1: Generate New Credentials

```bash
# For SESSION_SECRET and CRON_SECRET (256-bit hex strings)
openssl rand -hex 32

# For DATABASE_URL, use Railway dashboard to rotate password
# Railway provides the new connection string automatically
```

### Step 2: Update Deployment Configuration

#### For Railway.com (Recommended)
1. Go to https://railway.app
2. Select your Card Benefits project
3. Click on "Variables" tab
4. Update `SESSION_SECRET` with new value
5. Update `CRON_SECRET` with new value
6. For DATABASE: Click PostgreSQL service → Details → Change password
7. Copy new DATABASE_URL and update

#### For GitHub Actions (if using CI/CD secrets)
1. Go to repository Settings → Secrets and variables → Actions
2. Update each secret:
   - `SESSION_SECRET`
   - `CRON_SECRET`
   - `DATABASE_URL`

### Step 3: Deploy Application

```bash
# Railway will pick up new environment variables automatically on next deploy
# Force deployment if needed:
git push  # Triggers deploy if set up with GitHub integration

# OR restart manually on Railway dashboard
```

### Step 4: Verify Deployment

```bash
# Check application is running
curl https://your-app.railway.app/api/health

# Verify expected response (no 500 errors)
# Check logs for environment variable configuration

# Test core functionality
# 1. Test login (uses SESSION_SECRET)
# 2. Test cron endpoint (uses CRON_SECRET)
# 3. Test card operations (uses DATABASE_URL)
```

### Step 5: Document Rotation

In `.github/docs/ROTATION_LOG.md`:

```markdown
## Rotation Log

| Date | Secret | Reason | Status |
|------|--------|--------|--------|
| 2026-04-05 | SESSION_SECRET, CRON_SECRET | Quarterly rotation | ✅ Complete |
| 2026-04-05 | DATABASE_URL | Password change (annual) | ✅ Complete |
```

---

## Accessing Secrets in Code

### Development Environment

Create `.env.local` in project root (NOT committed to git):

```bash
# .env.local
DATABASE_URL="postgresql://localhost/card_benefits"
SESSION_SECRET="your-generated-256-bit-hex-string"
CRON_SECRET="your-generated-256-bit-hex-string"
NODE_ENV=development
```

### Accessing in TypeScript

```typescript
// ✅ CORRECT: Get from environment
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required');
}

// ❌ WRONG: Hardcoded fallback
const sessionSecret = process.env.SESSION_SECRET || 'default-secret';

// ❌ WRONG: Hardcoded in code
const sessionSecret = 'my-secret-key';
```

### Accessing in Next.js Routes

```typescript
// src/app/api/auth/login/route.ts
export async function POST(request: Request) {
  const sessionSecret = process.env.SESSION_SECRET;
  
  if (!sessionSecret) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  // Use sessionSecret for JWT operations
  // ... rest of login logic
}
```

---

## File Structure & .gitignore

### What Gets Committed ✅

```
.env.example          # ✅ COMMIT - Template with placeholders, no values
.env.production.template  # ✅ COMMIT - Template with instructions, no real values
.env.test             # ✅ COMMIT - Test environment, test-only values
```

### What Gets Ignored ❌

```
.env                  # ❌ IGNORE - Local development (has real credentials)
.env.local            # ❌ IGNORE - Local overrides
.env.*.local          # ❌ IGNORE - Local environment overrides
```

**Verify .gitignore**:
```bash
cat .gitignore | grep "\.env"
# Should show:
# .env
# .env.local
# .env.*.local
```

**Verify .env is ignored**:
```bash
git check-ignore .env
# Should output: .env
```

---

## Git History Cleanup

### If Credentials Were Accidentally Committed

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .env from all git history
cd /path/to/repository
git filter-repo --invert-paths --path .env --force

# CRITICAL: After filtering, must force-push to remote
# This requires admin/force-push permissions
git push origin --force --all
git push origin --force --tags

# Notify team: Repository history changed, re-clone required
# Team members must:
# 1. Delete local repository
# 2. Clone fresh: git clone [url]
# 3. Create new .env.local with new credentials
```

### Verify Cleanup

```bash
# Confirm .env is no longer in history
git log -p --all -- .env
# Should output: "fatal: Path '.env' does not exist"

# Confirm specific secret is not in history
git log -p --all | grep "oldcredentialvalue"
# Should return: (no results) or results only in documentation files
```

---

## Testing with Secrets

### Unit Tests (.env.test)

Tests use `.env.test` which is committed with TEST-ONLY values:

```bash
# Run tests
npm test

# Tests automatically load .env.test
# Uses safe test database and dummy secrets
```

### Integration Tests

```bash
# Set temporary test credentials
CRON_SECRET="test-value-from-env" npm test -- cron-endpoint.integration.test.ts

# OR use .env.test which already has values
npm test
```

### Do NOT Hardcode Secrets in Tests

```typescript
// ❌ WRONG: Hardcoded test secret
const testSecret = 'test-secret-hardcoded';

// ✅ CORRECT: Get from environment
const testSecret = process.env.CRON_SECRET;
if (!testSecret) {
  throw new Error('CRON_SECRET required for tests');
}
```

---

## Emergency: Suspected Compromise

If you suspect credentials have been compromised:

### Immediate Actions (Within 1 Hour)

1. **Lock down access**:
   ```bash
   # Stop application if compromised (critical)
   # Go to Railway dashboard → Stop service
   ```

2. **Rotate all credentials**:
   ```bash
   openssl rand -hex 32  # New SESSION_SECRET
   openssl rand -hex 32  # New CRON_SECRET
   # Get new DATABASE_URL from Railway PostgreSQL
   ```

3. **Update deployment**:
   - Add new values to Railway dashboard
   - Restart application
   - Verify startup logs show no errors

4. **Verify integrity**:
   ```bash
   curl https://your-app.railway.app/api/health
   ```

5. **Audit logs** (if available):
   - Check Railway logs for unauthorized access
   - Check database logs for suspicious queries
   - Document timeline of compromise

### Short-term Follow-up (Next 24 Hours)

1. **Investigation**:
   - Review git history for accidental commits
   - Check logs for unauthorized access attempts
   - Determine scope of exposure

2. **Communication**:
   - Notify team of credential rotation
   - Inform users if data might be compromised
   - Document incident timeline

3. **Prevention**:
   - Add pre-commit hook to prevent .env commits
   - Review access controls
   - Plan rotation schedule updates

---

## Security Best Practices

### ✅ DO

- ✅ Generate secrets with `openssl rand -hex 32`
- ✅ Store in `.env.local` or environment variables only
- ✅ Rotate quarterly (every 90 days)
- ✅ Use different values for each environment
- ✅ Use timing-safe comparison for secret validation
- ✅ Log authentication failures without exposing secrets
- ✅ Require env vars at startup (fail fast)

### ❌ DON'T

- ❌ Commit `.env` or `.env.local` to git
- ❌ Hardcode secrets in source code
- ❌ Use predictable fallback values (`'default-secret'`, `'test-secret'`)
- ❌ Log or expose secrets in error messages
- ❌ Use same secret for different environments
- ❌ Share credentials via email or chat
- ❌ Keep old credentials in code comments

---

## Monitoring & Alerts

### What to Monitor

- **Application Health**: Check `/api/health` endpoint regularly
- **Authentication Failures**: Monitor login failure rates
- **Database Connectivity**: Verify DATABASE_URL is accessible
- **Cron Job Execution**: Verify `/api/cron/reset-benefits` runs successfully

### Set Up Alerts For

- More than 5 failed login attempts from single IP in 15 minutes
- Database connection failures
- Cron job not executing for 24+ hours
- Unusual API activity patterns

### Check Logs

```bash
# Railway logs
# Go to Railway dashboard → Service → Logs

# Check for environment variable errors
grep "SECRET" logs/production.log
grep "DATABASE_URL" logs/production.log

# Check for authentication failures
grep "Unauthorized" logs/production.log
```

---

## FAQ

### Q: How often should I rotate credentials?

**A**: Minimum quarterly (every 90 days). Rotate immediately if:
- Suspected compromise
- Team member leaves
- After accidental exposure
- As part of security audit

### Q: What happens when I rotate SESSION_SECRET?

**A**: All active sessions become invalid. Users must log in again with their password.

### Q: What happens when I rotate CRON_SECRET?

**A**: Cron job scheduler (CI/CD, external service) must be updated with new secret, or cron jobs will fail with 401 Unauthorized.

### Q: How do I test my new credentials?

**A**:
```bash
# After updating credentials in Railway:

# 1. Test application health
curl https://your-app.railway.app/api/health

# 2. Test login (uses SESSION_SECRET)
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"..."}'

# 3. Test cron endpoint (uses CRON_SECRET)
curl -X POST https://your-app.railway.app/api/cron/reset-benefits \
  -H "Authorization: Bearer <new-CRON_SECRET>"

# 4. Test database (uses DATABASE_URL)
npm run prisma:db push
```

### Q: What if I accidentally expose a secret?

**A**:
1. Rotate the credential immediately
2. Run `git filter-repo` to remove from history (requires force-push)
3. Audit logs for unauthorized access
4. Document the incident
5. Review access controls and prevention measures

### Q: Can I use the same secret for all environments?

**A**: **NO**. Use different secrets for:
- Development (`SESSION_SECRET`, `CRON_SECRET`)
- Testing (`SESSION_SECRET`, `CRON_SECRET` in .env.test)
- Production (unique values in Railway)

This limits blast radius if one environment is compromised.

---

## References

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- [NIST: Recommendations for Password-Based Key Derivation](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf)
- [git-filter-repo Documentation](https://github.com/newren/git-filter-repo)

---

## Document Version & History

- **Version**: 1.0.0
- **Last Updated**: 2026-04-05
- **Updated By**: Security Audit
- **Next Review**: 2026-07-05 (quarterly)

---

## Contacts

For credential rotation or security concerns:
1. Contact repository admin
2. Create issue with `[SECURITY]` label
3. Email: security@example.com (if available)

**DO NOT**: Share credentials in GitHub issues, pull requests, or public channels
