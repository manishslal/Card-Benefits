# Database Persistence Audit - Quick Reference

## THE CRITICAL BUG (Fix This First)

**File:** `src/lib/prisma.ts:12`

**BROKEN:**
```typescript
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**FIXED:**
```typescript
globalForPrisma.prisma = prisma;  // Always cache, regardless of environment
```

**Why:** In production, every middleware call creates a NEW database connection. This exhausts Railway's connection pool → all database queries fail.

---

## The Two-Phase Session Creation Problem

**Current Flow (BROKEN):**
```
Login Request
  ↓
1. createSession(userId, "temp_uuid_xyz", expiresAt)
   → Database now has: Session { sessionToken: "temp_uuid_xyz" }
  ↓
2. signSessionToken(payload)
   → Generate JWT token
  ↓
3. updateSessionToken(sessionId, "jwt_real_token")
   → Database now has: Session { sessionToken: "jwt_real_token" }
  ↓
4. Set cookie in response: "session=jwt_real_token"
  ↓
Client makes next request
  ↓
5. Middleware extracts "jwt_real_token" from cookie
  ↓
6. Middleware queries: getSessionByToken("jwt_real_token")
   → Finds: Session { sessionToken: "jwt_real_token" } ✓
```

**THE PROBLEM:** Between steps 1 and 3, if middleware queries (or if step 3 fails), the session token doesn't match.

**Solution:** Use atomic transaction:
```typescript
const session = await prisma.$transaction(async (tx) => {
  const s = await tx.session.create({
    data: {
      userId,
      sessionToken: token,  // Use real JWT immediately, not temp token
      expiresAt,
      isValid: true,
    },
  });
  return s;
});
```

---

## Session Creation Files

| File | Function | Purpose | Issue |
|------|----------|---------|-------|
| `src/app/api/auth/login/route.ts` | `POST /api/auth/login` | Login handler | Two-phase creation |
| `src/app/api/auth/signup/route.ts` | `POST /api/auth/signup` | Signup handler | Two-phase creation |
| `src/lib/auth-server.ts` | `createSession()` | Creates session record | Uses temporary token |
| `src/lib/auth-server.ts` | `updateSessionToken()` | Updates with real JWT | No error recovery |
| `src/lib/auth-server.ts` | `getSessionByToken()` | Queries session by token | Fails if token doesn't match |
| `src/middleware.ts` | `verifySessionTokenDirect()` | Validates token in middleware | Calls getSessionByToken() |

---

## Diagnostic Queries

### Check if sessions exist in database:
```sql
SELECT COUNT(*) as total_sessions FROM "Session";
```

### Check for temporary tokens:
```sql
SELECT COUNT(*) as temp_token_count FROM "Session" 
WHERE "sessionToken" LIKE 'temp_%';
```

### Check recent sessions (last 10):
```sql
SELECT 
  id, 
  "userId", 
  substring("sessionToken", 1, 30) as token_preview,
  "isValid",
  "expiresAt",
  "createdAt"
FROM "Session"
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Check PostgreSQL connections (Railway):
```sql
SELECT count(*) as total_connections FROM pg_stat_activity;
SELECT max_conn as max_connections FROM pg_settings WHERE name = 'max_connections';
```

---

## Schema Inspection

**Session Model Fields:**
- `id` - CUID primary key
- `userId` - Foreign key to User
- `sessionToken` - UNIQUE constraint (problematic!)
- `expiresAt` - Expiration timestamp
- `isValid` - Soft revocation flag (logout sets to false)
- `userAgent` - Browser/device identifier
- `ipAddress` - Client IP
- `createdAt`, `updatedAt` - Timestamps

**Indexes:**
- `@@index([userId])` - Query sessions by user
- `@@index([expiresAt])` - Query expired sessions for cleanup

---

## Connection Pooling Info

**Prisma Default Pool Size:** 10 connections

**Railway PostgreSQL Limits:** Varies by plan (check dashboard)

**Current Configuration:** None (using defaults)

**Risk:** If more than 10 concurrent requests hit middleware, they queue. If queue fills, requests timeout → session creation/lookup fails.

---

## Quick Test: Is This The Issue?

**Test 1: Check Prisma singleton**
```bash
grep -n "globalForPrisma.prisma" src/lib/prisma.ts
```
If output shows `if (process.env.NODE_ENV !== 'production')`, that's the bug.

**Test 2: Check Railway connection logs**
- Go to Railway Dashboard
- Select PostgreSQL service
- Look in Logs for "too many connections" errors

**Test 3: Check Production Sessions**
- SSH into Railway container: `railway shell`
- Run: `psql -c "SELECT COUNT(*) FROM \"Session\";"`
- If count is 0 or very low → sessions not being created
- If count is growing but middleware failing → connection/token mismatch issue

---

## Fix Priority

| Priority | Action | Time | Impact |
|----------|--------|------|--------|
| 🔴 P0 | Fix Prisma singleton cache | 5 min | Huge - fixes production connection exhaustion |
| 🔴 P1 | Refactor to atomic transaction | 30 min | High - fixes race conditions |
| 🟠 P2 | Add session creation verification | 15 min | Medium - detects failures early |
| 🟡 P3 | Add Railway pool configuration | 10 min | Medium - optimizes pooling |
| 🟡 P4 | Add automated cleanup cron job | 20 min | Low - prevents table bloat |

---

## Files to Modify

1. **src/lib/prisma.ts** - Fix singleton caching
2. **src/lib/auth-server.ts** - Make createSession atomic
3. **src/app/api/auth/login/route.ts** - Add verification
4. **src/app/api/auth/signup/route.ts** - Add verification
5. **src/app/api/cron/cleanup-sessions/route.ts** (NEW) - Add cleanup

---

## Verification Checklist

After fixes:

- [ ] Prisma singleton is cached globally (line 12 of prisma.ts)
- [ ] Session creation uses $transaction wrapper
- [ ] No temporary tokens in schema (temp_ token removal)
- [ ] Middleware can immediately find created sessions
- [ ] Railway connection count stays stable (not growing)
- [ ] Production logs show no "too many connections" errors
- [ ] Test 10+ concurrent logins - all succeed
- [ ] Check database: no sessions with temp_ tokens
- [ ] Logout properly invalidates sessions (isValid = false)

---

## Emergency Mitigation

If production is down and you need immediate fix:

### Option 1: Bypass Session Validation (TEMPORARY)
In `src/middleware.ts`, comment out database lookup:
```typescript
// TEMPORARY: Comment out for emergency
// const dbSession = await getSessionByToken(token);
// if (!dbSession) return { valid: false };
```

**⚠️ This is INSECURE** - revoked sessions won't be invalidated. Logout won't work. Only use while deploying real fix.

### Option 2: Use Connection Pool Workaround
Set environment variable:
```bash
DATABASE_URL="postgresql://...?connection_limit=5"
```

Reduces pool from 10 to 5, forcing Railway to handle connections more carefully.

---

## References

- **Full Audit:** `.github/specs/AUTH-DATABASE-AUDIT-QA2.md`
- **Prisma Schema:** `prisma/schema.prisma`
- **Prisma Client:** `src/lib/prisma.ts`
- **Auth Functions:** `src/lib/auth-server.ts`
- **Middleware:** `src/middleware.ts`
- **Login API:** `src/app/api/auth/login/route.ts`

---

## Contact & Support

For questions about this audit:
- Check the full audit document for detailed analysis
- Review the SQL diagnostic queries section
- Check Railway service logs for connection errors
- Enable Prisma query logging in development: `log: ['query']`
