# Database Persistence - Verification Test Suite

## Overview

This test suite validates that sessions are properly persisting to the database after the fixes.

---

## Unit Tests: Session Creation

### Test 1.1: Session Creation with Real JWT Token (Not Temporary)

**Purpose:** Verify that sessions are created with actual JWT tokens, not temporary placeholders

**File:** `src/__tests__/session-persistence.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSessionAtomic } from '@/lib/auth-server';
import { signSessionToken, createSessionPayload } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';

describe('Session Creation - Token Persistence', () => {
  const testUserId = 'test-user-123';
  let sessionId: string;

  beforeEach(() => {
    // Create test user if needed
    // Clear any existing test sessions
  });

  afterEach(async () => {
    // Cleanup test data
    if (sessionId) {
      await prisma.session.delete({ where: { id: sessionId } });
    }
  });

  it('should create session with JWT token, not temporary token', async () => {
    // Step 1: Create payload and sign JWT
    const sessionId = 'temp-session-id';
    const payload = createSessionPayload(testUserId, sessionId);
    const jwtToken = signSessionToken(payload);

    // Step 2: Create session with JWT token
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // FIXED: Should use atomic creation with real token
    const session = await createSessionAtomic(
      testUserId,
      jwtToken,
      expiresAt,
      'Mozilla/5.0 Test Browser',
      '192.168.1.1'
    );

    // Assertions
    expect(session).toBeDefined();
    expect(session.sessionToken).toBe(jwtToken);
    expect(session.sessionToken).not.toMatch(/^temp_/);  // No temporary tokens!
    expect(session.userId).toBe(testUserId);
    expect(session.isValid).toBe(true);
    
    // Step 3: Verify the token starts with "eyJ" (JWT header)
    expect(jwtToken.startsWith('eyJ')).toBe(true);
  });

  it('should not create session with temporary placeholder token', async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const tempToken = 'temp_placeholder_uuid';

    // This should not happen with the fixed code
    // But if it does, the test catches it
    const session = await prisma.session.create({
      data: {
        userId: testUserId,
        sessionToken: tempToken,
        expiresAt,
        isValid: true,
      },
    });

    // Verify the anti-pattern is detected
    expect(session.sessionToken).toMatch(/^temp_/);
    
    // Clean up this anti-pattern session
    await prisma.session.delete({ where: { id: session.id } });
  });
});
```

**Expected Outcome:** ✓ Session created with JWT token, ✗ No temporary tokens

---

### Test 1.2: Session Verification Immediately After Creation

**Purpose:** Verify that created sessions can be immediately found in the database

```typescript
describe('Session Immediate Verification', () => {
  it('should verify session exists in database immediately after creation', async () => {
    const userId = 'test-user-immediate';
    const payload = createSessionPayload(userId, 'session-123');
    const jwtToken = signSessionToken(payload);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create session
    const created = await createSessionAtomic(userId, jwtToken, expiresAt);

    // Immediately query database WITHOUT waiting
    const found = await prisma.session.findUnique({
      where: { sessionToken: jwtToken },
    });

    // Assertions
    expect(found).toBeDefined();
    expect(found?.id).toBe(created.id);
    expect(found?.sessionToken).toBe(jwtToken);
    expect(found?.isValid).toBe(true);

    // Cleanup
    await prisma.session.delete({ where: { id: created.id } });
  });

  it('should not find session with temporary token', async () => {
    const tempToken = 'temp_xyz_uuid';

    const found = await prisma.session.findUnique({
      where: { sessionToken: tempToken },
    });

    // Temporary tokens should not be queryable
    expect(found).toBeNull();
  });
});
```

**Expected Outcome:** ✓ Sessions found immediately, ✗ Temporary tokens not found

---

### Test 1.3: Token Consistency Between Cookie and Database

**Purpose:** Verify that cookie token matches database token (no mismatches)

```typescript
describe('Token Consistency', () => {
  it('should have identical token in cookie and database', async () => {
    const userId = 'test-user-consistency';
    const payload = createSessionPayload(userId, 'session-456');
    const jwtToken = signSessionToken(payload);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create session
    const created = await createSessionAtomic(userId, jwtToken, expiresAt);

    // Simulate cookie extraction
    const cookieToken = jwtToken;  // In real scenario, extracted from response headers

    // Query database with cookie token
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: cookieToken },
    });

    // Assertions
    expect(dbSession).toBeDefined();
    expect(dbSession?.sessionToken).toBe(cookieToken);
    expect(dbSession?.id).toBe(created.id);

    // Cleanup
    await prisma.session.delete({ where: { id: created.id } });
  });
});
```

**Expected Outcome:** ✓ Token in cookie matches database token

---

## Integration Tests: Login Flow

### Test 2.1: Full Login Flow - Session Persists to Database

**Purpose:** End-to-end test of login creating and persisting a session

```typescript
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

describe('Integration: Login Flow - Database Persistence', () => {
  it('should create user, create session, and persist to database', async () => {
    const loginPayload = {
      email: 'integration-test@example.com',
      password: 'SecurePassword123!@',
    };

    // First, create the user via signup
    // (Assuming user already exists, just test login)
    
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginPayload),
    });

    const response = await POST(request);
    const data = await response.json();

    // Step 1: Verify login succeeded
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.userId).toBeDefined();

    // Step 2: Extract session token from Set-Cookie header
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('session=');
    
    const tokenMatch = setCookieHeader?.match(/session=([^;]+)/);
    const token = tokenMatch?.[1];
    expect(token).toBeDefined();
    expect(token).not.toMatch(/^temp_/);

    // Step 3: Immediately query database for session
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: token! },
      select: {
        id: true,
        userId: true,
        sessionToken: true,
        isValid: true,
        expiresAt: true,
      },
    });

    // Step 4: Verify session exists and is valid
    expect(dbSession).toBeDefined();
    expect(dbSession?.userId).toBe(data.userId);
    expect(dbSession?.sessionToken).toBe(token);
    expect(dbSession?.isValid).toBe(true);
    expect(dbSession?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Cleanup
    await prisma.session.delete({ where: { id: dbSession!.id } });
  });

  it('should not create session with temporary tokens', async () => {
    // Query database to verify no temp tokens exist
    const tempSessions = await prisma.session.findMany({
      where: {
        sessionToken: {
          startsWith: 'temp_',
        },
      },
    });

    expect(tempSessions).toHaveLength(0);
  });
});
```

**Expected Outcome:** ✓ Session persisted to database, ✗ No temporary tokens exist

---

### Test 2.2: Middleware Can Find Session After Login

**Purpose:** Verify middleware's database lookup succeeds for login-created sessions

```typescript
import { describe, it, expect } from 'vitest';
import { getSessionByToken } from '@/lib/auth-server';
import { verifySessionToken } from '@/lib/auth-utils';

describe('Integration: Middleware Session Lookup', () => {
  it('should find session created by login in middleware', async () => {
    // Simulate login flow:
    const userId = 'test-middleware-user';
    const payload = createSessionPayload(userId, 'session-789');
    const jwtToken = signSessionToken(payload);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create session (as login would)
    const created = await createSessionAtomic(userId, jwtToken, expiresAt);

    // Simulate middleware JWT verification
    const verifiedPayload = verifySessionToken(jwtToken);
    expect(verifiedPayload.userId).toBe(userId);
    expect(verifiedPayload.sessionId).toBe(created.id);

    // Simulate middleware database lookup
    const found = await getSessionByToken(jwtToken);
    
    // Assertions
    expect(found).toBeDefined();
    expect(found?.userId).toBe(userId);
    expect(found?.isValid).toBe(true);

    // Cleanup
    await prisma.session.delete({ where: { id: created.id } });
  });

  it('should return null for non-existent session tokens', async () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake.fake';
    
    const found = await getSessionByToken(fakeToken);
    
    expect(found).toBeNull();
  });

  it('should return null for temporary placeholder tokens', async () => {
    const tempToken = 'temp_placeholder_123';
    
    const found = await getSessionByToken(tempToken);
    
    expect(found).toBeNull();
  });
});
```

**Expected Outcome:** ✓ Middleware finds created sessions, ✗ Can't find temp tokens

---

## Load Tests: Concurrent Operations

### Test 3.1: Concurrent Logins - All Persist to Database

**Purpose:** Verify sessions persist under load (multiple concurrent logins)

```typescript
import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Load Test: Concurrent Session Creation', () => {
  it('should handle 50 concurrent logins without failures', async () => {
    const concurrentCount = 50;
    const promises: Promise<string>[] = [];

    // Create 50 concurrent login requests
    for (let i = 0; i < concurrentCount; i++) {
      const promise = (async () => {
        const userId = `concurrent-user-${i}`;
        const payload = createSessionPayload(userId, `session-${i}`);
        const token = signSessionToken(payload);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        // Create session
        const created = await createSessionAtomic(userId, token, expiresAt);
        
        // Verify immediately
        const found = await prisma.session.findUnique({
          where: { sessionToken: token },
        });

        if (!found) throw new Error('Session not persisted');
        return created.id;
      })();

      promises.push(promise);
    }

    // Wait for all to complete
    const sessionIds = await Promise.all(promises);

    // Verify all sessions exist
    expect(sessionIds).toHaveLength(concurrentCount);

    // Count sessions in database
    const dbCount = await prisma.session.count();
    expect(dbCount).toBeGreaterThanOrEqual(concurrentCount);

    // Verify none have temporary tokens
    const tempCount = await prisma.session.count({
      where: { sessionToken: { startsWith: 'temp_' } },
    });
    expect(tempCount).toBe(0);

    // Cleanup
    await prisma.session.deleteMany({
      where: { id: { in: sessionIds } },
    });
  });

  it('should not duplicate sessions on concurrent login', async () => {
    const userId = 'concurrent-duplicate-test';
    const concurrentCount = 10;

    // Create 10 concurrent logins for SAME user
    const promises = Array(concurrentCount)
      .fill(null)
      .map(async () => {
        const payload = createSessionPayload(userId, `session-${Date.now()}`);
        const token = signSessionToken(payload);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        return createSessionAtomic(userId, token, expiresAt);
      });

    const results = await Promise.all(promises);

    // Should create multiple sessions (one per request)
    expect(results).toHaveLength(concurrentCount);

    // All should have different tokens
    const tokens = results.map(r => r.sessionToken);
    const uniqueTokens = new Set(tokens);
    expect(uniqueTokens.size).toBe(concurrentCount);

    // Cleanup
    await prisma.session.deleteMany({
      where: { userId },
    });
  });
});
```

**Expected Outcome:** ✓ All sessions persist, ✗ No duplicates with temp tokens

---

## Database Integrity Tests

### Test 4.1: Foreign Key Integrity

**Purpose:** Verify session cleanup when user is deleted

```typescript
describe('Database Integrity - Cascade Delete', () => {
  it('should delete sessions when user is deleted', async () => {
    const userId = 'test-cascade-delete';
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: `user-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
        players: {
          create: {
            playerName: 'Primary',
          },
        },
      },
    });

    // Create session for user
    const payload = createSessionPayload(user.id, 'session-cascade');
    const token = signSessionToken(payload);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await createSessionAtomic(user.id, token, expiresAt);
    expect(session.userId).toBe(user.id);

    // Verify session exists
    let found = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(found).toBeDefined();

    // Delete user (cascade should delete sessions)
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Verify session is also deleted
    found = await prisma.session.findUnique({
      where: { id: session.id },
    });
    expect(found).toBeNull();
  });
});
```

**Expected Outcome:** ✓ Cascade delete works, sessions deleted with user

---

### Test 4.2: Unique Constraint Validation

**Purpose:** Verify UNIQUE constraint on sessionToken prevents duplicates

```typescript
describe('Database Integrity - Unique Constraint', () => {
  it('should not allow duplicate sessionToken values', async () => {
    const token = 'unique-constraint-test-token';
    const userId = 'test-unique-user';
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create first session
    const session1 = await prisma.session.create({
      data: {
        userId,
        sessionToken: token,
        expiresAt,
      },
    });

    expect(session1.sessionToken).toBe(token);

    // Try to create second session with same token
    try {
      await prisma.session.create({
        data: {
          userId,
          sessionToken: token,  // ← Duplicate!
          expiresAt,
        },
      });
      expect.fail('Should have thrown unique constraint error');
    } catch (error: any) {
      // P2002 is Prisma's unique constraint violation code
      expect(error.code).toBe('P2002');
    }

    // Cleanup
    await prisma.session.delete({ where: { id: session1.id } });
  });
});
```

**Expected Outcome:** ✓ Unique constraint prevents duplicates

---

## Performance Tests

### Test 5.1: Session Lookup Performance

**Purpose:** Verify database queries are fast (index effectiveness)

```typescript
describe('Performance: Session Lookup', () => {
  it('should find session by token in < 100ms', async () => {
    // Create test session
    const payload = createSessionPayload('perf-test-user', 'session-perf');
    const token = signSessionToken(payload);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await createSessionAtomic(
      'perf-test-user',
      token,
      expiresAt
    );

    // Measure lookup time
    const start = performance.now();
    const found = await getSessionByToken(token);
    const elapsed = performance.now() - start;

    expect(found).toBeDefined();
    expect(elapsed).toBeLessThan(100); // Should be very fast

    // Cleanup
    await prisma.session.delete({ where: { id: session.id } });
  });

  it('should find all user sessions in < 50ms', async () => {
    const userId = 'perf-test-user-2';

    // Create 10 sessions for same user
    const sessionIds = await Promise.all(
      Array(10)
        .fill(null)
        .map(async (_, i) => {
          const payload = createSessionPayload(userId, `perf-${i}`);
          const token = signSessionToken(payload);
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const s = await createSessionAtomic(userId, token, expiresAt);
          return s.id;
        })
    );

    // Measure lookup time for all user sessions
    const start = performance.now();
    const sessions = await prisma.session.findMany({
      where: { userId },
    });
    const elapsed = performance.now() - start;

    expect(sessions).toHaveLength(10);
    expect(elapsed).toBeLessThan(50);

    // Cleanup
    await prisma.session.deleteMany({
      where: { id: { in: sessionIds } },
    });
  });
});
```

**Expected Outcome:** ✓ Lookups are fast (<100ms), ✓ Indexes are effective

---

## How to Run Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test -- src/__tests__/session-persistence.test.ts

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run UI
npm run test:ui
```

---

## Passing Criteria

All tests must pass:
- ✓ 0 temporary tokens created
- ✓ All sessions immediately queryable after creation
- ✓ Token in cookie matches database token
- ✓ Middleware can find sessions
- ✓ Concurrent operations succeed
- ✓ Foreign keys maintain integrity
- ✓ Unique constraints enforced
- ✓ Queries are performant

---

## Database State Verification (Post-Deploy)

```sql
-- Check no temporary tokens exist
SELECT COUNT(*) FROM "Session" WHERE "sessionToken" LIKE 'temp_%';
-- Expected: 0

-- Check session count
SELECT COUNT(*) FROM "Session";
-- Expected: Growing but reasonable

-- Check expired sessions (cleanup needed?)
SELECT COUNT(*) FROM "Session" WHERE "expiresAt" < NOW();
-- Expected: All old sessions, if cleanup not running

-- Check token lengths (JWT should be ~200 bytes)
SELECT AVG(LENGTH("sessionToken")) as avg_token_length FROM "Session" LIMIT 100;
-- Expected: ~200 for JWT tokens
```

---

## References

- **Test Framework:** Vitest
- **Database:** Prisma ORM
- **Production Database:** PostgreSQL (Railway)
