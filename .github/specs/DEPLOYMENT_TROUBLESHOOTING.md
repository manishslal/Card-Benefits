# Edge Runtime Auth Fix - Deployment Troubleshooting Guide

## Deployment Issues & Solutions

---

## Issue 1: Build Fails with TypeScript Errors

### Symptoms
```
Error: Type 'X' is not assignable to type 'Y'
Build failed
```

### Diagnosis
```bash
# Check specific error
railway logs -n 50 | grep -A 5 "error TS"
```

### Solution

**Option A: Type Import Issues**
```typescript
// If error is about type imports, ensure using 'import type'
import type { NextRequest } from 'next/server';  // ✓ Correct
import { NextRequest } from 'next/server';       // ✗ Can cause issues
```

**Option B: Prisma Type Issues**
```bash
# Regenerate Prisma types
npm run prisma:generate  # or check package.json for correct command
```

**Option C: Rollback**
```bash
git revert b4787bb
git push
```

---

## Issue 2: Build Succeeds But Deployment Hangs

### Symptoms
- Build shows "Compiled successfully"
- But deployment doesn't complete
- Health check never passes

### Diagnosis
```bash
# Check release phase logs
railway logs -n 100 | grep "release\|prisma\|db"
```

### Solution

**Issue: prisma db push hangs**
```
This usually means database connection issue

1. Verify DATABASE_URL is set:
   railway env | grep DATABASE_URL
   
2. Check if database is running:
   railway status
   
3. If not running, restart:
   railway redeploy --refresh
```

**Issue: Database schema conflict**
```bash
# If prisma db push has conflicts:

1. Check what migrations are pending:
   npx prisma migrate status

2. Reset (DESTRUCTIVE - only for dev!):
   npx prisma migrate reset

3. For production, manually review:
   npx prisma migrate dev --name migration_name
```

---

## Issue 3: Crypto Errors in Logs

### Symptoms
```
Error: crypto module not available in Edge Runtime
ReferenceError: crypto is not defined
Cannot read property 'randomBytes' of undefined
```

### Root Cause
- Middleware or public route is importing crypto
- jsonwebtoken is being imported in Edge Runtime context

### Diagnosis
```bash
# Search middleware for crypto imports
grep -n "crypto\|jsonwebtoken" src/middleware.ts

# Search for other edge runtime violations
grep -r "import.*crypto" src/ --include="*.ts" --include="*.tsx"
```

### Solution

**Ensure Only Node.js API Uses Crypto:**
```typescript
// ✓ CORRECT: In /api/auth/verify/route.ts
import jwt from 'jsonwebtoken';  // Safe in Node.js runtime

// ✗ WRONG: In middleware.ts
import jwt from 'jsonwebtoken';  // Not safe in Edge Runtime
```

**Fix the Issue:**
1. Remove crypto imports from middleware
2. Keep them only in API routes
3. Rebuild and redeploy

```bash
npm run build
railway redeploy
```

---

## Issue 4: 401 Errors on Protected Routes

### Symptoms
```
GET /dashboard 401 Unauthorized
GET /settings 401 Unauthorized
Cannot access protected routes after login
```

### Root Cause
- JWT verification failing
- SESSION_SECRET not set
- Database session check failing

### Diagnosis

**Check 1: SESSION_SECRET is set**
```bash
railway env | grep SESSION_SECRET
# Should show: SESSION_SECRET=<value>
```

**Check 2: JWT endpoint works**
```bash
# From browser console or curl:
fetch('/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    token: document.cookie.match(/session=([^;]+)/)?.[1] 
  })
})
.then(r => r.json())
.then(console.log)

# Expected: { valid: true, userId: "..." }
# Actual: { valid: false, error: "..." }
```

**Check 3: Cookie exists**
```bash
# Browser DevTools > Application > Cookies
# Should see: session=<token> (httpOnly, Secure, SameSite=Strict)
```

**Check 4: Database session valid**
```bash
# In Railway PostgreSQL terminal:
SELECT * FROM "Session" WHERE token LIKE '%<last-chars-of-token>%';
# Should show: isValid = true
```

### Solution

**If SESSION_SECRET not set:**
```bash
# Generate random secret
SESSION_SECRET=$(openssl rand -hex 32)

# Set in Railway
railway env set SESSION_SECRET "$SESSION_SECRET"

# Redeploy (users will need to re-login with new secret)
railway redeploy
```

**If JWT verification fails:**
```bash
# Check logs for JWT errors
railway logs -n 100 | grep "JWT\|verify\|invalid"

# Redeploy to refresh secrets
railway redeploy

# Users will need to log in again
```

**If database connection fails:**
```bash
# Restart PostgreSQL service
railway restart --service=postgres

# Check connection in app
railway logs | grep "database\|connection"
```

---

## Issue 5: Database Connection Errors

### Symptoms
```
Error: connect ECONNREFUSED 127.0.0.1:5432
PrismaClientInitializationError: Can't reach database server
Error: Database URL is not set
```

### Root Cause
- DATABASE_URL not set in environment
- PostgreSQL service not running
- Network connectivity issue

### Diagnosis
```bash
# Check if DATABASE_URL is set
railway env | grep DATABASE_URL

# Check PostgreSQL service status
railway status

# Verify connection string format
echo $DATABASE_URL | head -c 50  # Show first 50 chars safely
```

### Solution

**If DATABASE_URL not set:**
```bash
# PostgreSQL service must be running
# Go to: railway.app/dashboard
# Select Card-Benefits project
# Verify "Postgres" service exists

# If not, create it:
# Click "Add Service" > "Database" > "PostgreSQL"

# Then redeploy
railway redeploy
```

**If PostgreSQL not running:**
```bash
# Restart service
railway restart --service=postgres

# Wait ~10 seconds
sleep 10

# Verify running
railway status
```

**If connection timeout:**
```bash
# Check network
railway logs | grep "timeout\|TIMEOUT\|connection"

# Increase timeout in DATABASE_URL
# Current format: postgresql://user:pass@host:5432/db
# Add: ?connect_timeout=10

# Example:
railway env set DATABASE_URL \
  "postgresql://user:pass@host:5432/db?connect_timeout=10"
```

---

## Issue 6: Health Check Endpoint Returns 500

### Symptoms
```
GET /api/health 500 Internal Server Error
Health check failing continuously
```

### Root Cause
- /api/health endpoint has error
- Database not accessible from health check
- Unhandled exception in health endpoint

### Solution

**Check health endpoint code:**
```typescript
// src/app/api/health/route.ts
// Should be simple:
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
```

**If it's checking database:**
```bash
# Check logs for which query is failing
railway logs -n 50 | grep "health\|query\|SELECT"

# Simplify health check to not hit database
# Then redeploy
```

**Verify endpoint exists:**
```bash
# Locally
curl http://localhost:3000/api/health

# In production
curl https://card-benefits-production.up.railway.app/api/health
```

---

## Issue 7: Signup/Login Form Doesn't Work

### Symptoms
```
Form submission doesn't respond
No confirmation email sent
Session not created
```

### Root Cause
- API endpoint timeout
- Email service not configured
- Session token not created

### Diagnosis
```bash
# Check API logs
railway logs -n 100 | grep "POST /api/auth/signup\|POST /api/auth/login"

# Check for errors in auth endpoints
railway logs -n 100 | grep "error\|Error\|ERROR"

# Test endpoint directly
curl -X POST https://card-benefits-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

### Solution

**If timeout:**
```bash
# Increase Railway timeout (default 30s)
# railway.json: timeoutSeconds

# Or optimize slow queries in auth endpoints
```

**If no email sent:**
```bash
# Check if email service is configured
railway env | grep -i email

# If not configured, add:
railway env set EMAIL_FROM "noreply@example.com"
railway env set SMTP_SERVER "smtp.example.com"
```

**If session not created:**
```bash
# Check database writes
railway logs | grep "INSERT.*Session"

# Verify SESSION_SECRET is set
railway env | grep SESSION_SECRET
```

---

## Issue 8: Can't Connect to Railway PostgreSQL

### Symptoms
```
psql: could not connect to server
connection refused
```

### Solution

**Using Railway CLI:**
```bash
# SSH into database
railway connect --service=postgres

# Or check connection string
railway env | grep DATABASE_URL
```

**Using psql directly:**
```bash
# Get connection string
CONN=$(railway env | grep DATABASE_URL | cut -d= -f2-)

# Connect
psql "$CONN"

# List tables
\dt

# Check sessions
SELECT * FROM "Session" LIMIT 5;
```

---

## Issue 9: Memory or CPU Limits Hit

### Symptoms
```
Service restarting repeatedly
Out of memory errors
CPU throttling
```

### Diagnosis
```bash
# Check Railway resource usage
railway env | grep -i memory
railway env | grep -i cpu

# Check process memory
ps aux | grep node
```

### Solution

**Increase resources in railway.json:**
```json
{
  "deploy": {
    "numReplicas": 1,
    "environmentVariables": {
      "NODE_OPTIONS": "--max-old-space-size=512"
    }
  }
}
```

**Or via Railway dashboard:**
1. Go to: railway.app/dashboard
2. Select: Card-Benefits service
3. Settings > Memory
4. Increase (default: 512MB)

---

## Issue 10: Rollback Needed - How to Revert

### Quick Rollback
```bash
# Revert the deployment commit
git revert b4787bb

# Push to main
git push origin main

# Railway auto-redeploys
# Takes ~50 seconds total

# Verify success
curl https://card-benefits-production.up.railway.app/api/health
```

### Full Rollback with Previous State
```bash
# Reset to previous working commit
git reset --hard 231773d

# Force push (if needed)
git push --force origin main

# Railway redeploys
```

---

## Emergency Contact

If stuck and nothing works:

1. **Check logs first**
   ```bash
   railway logs -n 200 > /tmp/debug.log
   ```

2. **Take screenshot of error**

3. **Revert to previous version**
   ```bash
   git revert HEAD
   git push
   ```

4. **Contact DevOps team** with:
   - Error message
   - Command that failed
   - Full logs output

---

## Testing Commands Reference

```bash
# Health check
curl https://card-benefits-production.up.railway.app/api/health

# JWT verification
curl -X POST https://card-benefits-production.up.railway.app/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<jwt-token>"}'

# Check logs
railway logs -n 100

# Follow logs
railway logs -f

# View environment
railway env

# Service status
railway status

# Restart service
railway restart

# SSH into service
railway shell

# Database connection
railway connect --service=postgres
```

---

## Success Indicators

After deployment, you should see:
- ✅ `GET /api/health 200`
- ✅ `POST /api/auth/signup 201`
- ✅ `POST /api/auth/login 200`
- ✅ `POST /api/auth/verify 200`
- ✅ `GET /dashboard 200` (after login)
- ✅ No crypto-related errors in logs
- ✅ No database connection errors
- ✅ Health checks passing consistently

---

**Document Version:** 1.0  
**Last Updated:** April 3, 2026  
**Keep this guide handy during deployment!**
