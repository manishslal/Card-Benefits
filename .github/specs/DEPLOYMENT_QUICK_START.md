# Edge Runtime Auth Fix - Deployment Quick Start

## 🚀 One-Page Deployment Guide

### Pre-Deployment Checklist (5 minutes)

```bash
# 1. Verify build succeeds
npm run build
# Expected: "Compiled successfully in ~1400ms"

# 2. Check middleware is clean (no crypto)
grep "jsonwebtoken\|crypto" src/middleware.ts
# Expected: No output (clean)

# 3. Verify verify endpoint exists
test -f src/app/api/auth/verify/route.ts && echo "✅ Ready"
# Expected: ✅ Ready

# 4. Verify health endpoint
test -f src/app/api/health/route.ts && echo "✅ Ready"
# Expected: ✅ Ready
```

### Railway Environment Setup

**CRITICAL: Must set these before deploying**

1. Go to: https://railway.app/dashboard
2. Select: Card-Benefits service
3. Click: Variables tab
4. Add these variables:

| Name | Value | Example |
|------|-------|---------|
| `SESSION_SECRET` | 32+ char random secret | `hd9$k@mL!pQ2wR7xT3nB*vC5yM8jK0gF` |
| `CRON_SECRET` | 32+ char random secret | `aB$cD%eF&gH*jK!lM@nO#pQ$rS%tU^vW` |
| `NODE_ENV` | `production` | `production` |

(DATABASE_URL is auto-provided by PostgreSQL service)

### Deploy (2 minutes)

```bash
# Push to GitHub (if changes exist)
git push origin main

# Go to: https://railway.app/dashboard
# Click: Card-Benefits project
# Click: Deploy button
# Wait for build & release (watch logs)
```

### Post-Deploy Verification (5 minutes)

```bash
# 1. Check health
curl https://card-benefits-production.up.railway.app/api/health
# Expected: 200 OK, { "status": "ok" }

# 2. Check logs for errors
railway logs -n 50 | grep -i "error\|crypto"
# Expected: No crypto-related errors

# 3. Test signup (browser)
# Go to: https://card-benefits-production.up.railway.app/signup
# Create account with test@example.com
# Expected: Success, no errors

# 4. Test login (browser)
# Go to: https://card-benefits-production.up.railway.app/login
# Login with test@example.com
# Expected: Logged in, redirected to dashboard

# 5. Test dashboard (browser)
# Visit: /dashboard
# Expected: Loads successfully (not 401)
```

### ✅ Deployment Success

All tests pass = Deployment successful ✓

### ❌ Deployment Rollback (if needed)

```bash
# If crypto errors appear:
git revert HEAD
git push
# Railway auto-redeploys previous version
```

---

## What Changed

**Before:** Middleware tried to verify JWT → crypto error in Edge Runtime  
**After:** Middleware calls /api/auth/verify → Node.js runtime handles crypto safely

**Security:** All checks still in place (JWT + database validation)

---

## Documentation

- Full details: `.github/specs/edge-runtime-auth-fix-deployment.md`
- QA Report: `.github/specs/auth-cookie-fix-qa-report.md`
- Architecture: See middleware comments in `src/middleware.ts`
