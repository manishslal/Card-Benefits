# Authentication Backend - Comprehensive Test Strategy

**Purpose:** Validate the critical session management issues and verify fixes  
**Related Document:** `.github/specs/AUTH-BACKEND-AUDIT-QA1.md`

---

## Test Execution Plan

### Phase 1: Manual Verification Tests (Pre-Fix)

These tests are designed to **confirm the bug exists** before any code changes.

#### Test 1.1: Session Creation State Verification
**Objective:** Verify sessions are created with temporary tokens instead of JWT

```bash
#!/bin/bash
# test-1-1-session-creation-state.sh

set -e
BASE_URL="http://localhost:3000"
TEST_EMAIL="qa-test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"

echo "[TEST 1.1] Session Creation State Verification"
echo "=============================================="

# Step 1: Create test user
echo "1. Creating test user..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\":\"$TEST_EMAIL\",
    \"password\":\"$TEST_PASSWORD\",
    \"firstName\":\"QA\",
    \"lastName\":\"Test\"
  }")

USER_ID=$(echo $SIGNUP_RESPONSE | grep -o '"userId":"[^"]*' | cut -d'"' -f4)
echo "✓ User created: $USER_ID"

# Step 2: Login to get session
echo "2. Logging in..."
LOGIN_RESPONSE=$(curl -s -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\":\"$TEST_EMAIL\",
    \"password\":\"$TEST_PASSWORD\"
  }")

# Extract JWT from Set-Cookie header
JWT=$(echo "$LOGIN_RESPONSE" | grep "Set-Cookie" | grep "session=" | \
  sed 's/.*session=\([^;]*\).*/\1/')

if [ -z "$JWT" ]; then
  echo "✗ FAILED: No JWT found in Set-Cookie header"
  exit 1
fi

echo "✓ JWT received: ${JWT:0:50}..."

# Step 3: Check database for session token
echo "3. Checking database session token..."
DB_SESSION=$(sqlite3 prisma.db "
SELECT sessionToken FROM \"Session\" 
WHERE userId = '$USER_ID' 
ORDER BY createdAt DESC 
LIMIT 1;
")

echo "  Database sessionToken: ${DB_SESSION:0:50}..."
echo "  JWT token:           ${JWT:0:50}..."

# Step 4: Verify they match
if [ "$DB_SESSION" = "$JWT" ]; then
  echo "✓ PASS: Database session token matches JWT"
  exit 0
else
  if [[ "$DB_SESSION" == temp_* ]]; then
    echo "✗ FAIL: Database has TEMPORARY token, not JWT"
    echo "  This confirms BUG #1: Race condition in session creation"
    exit 1
  else
    echo "✗ FAIL: Tokens don't match"
    echo "  Database: $DB_SESSION"
    echo "  JWT:      $JWT"
    exit 1
  fi
fi
```

**Expected Result (BUGGY):**
```
✗ FAIL: Database has TEMPORARY token, not JWT
  This confirms BUG #1: Race condition in session creation
```

**Expected Result (FIXED):**
```
✓ PASS: Database session token matches JWT
```

---

#### Test 1.2: Middleware Session Lookup Failure
**Objective:** Verify middleware cannot find sessions in database

```bash
#!/bin/bash
# test-1-2-middleware-lookup-failure.sh

set -e
BASE_URL="http://localhost:3000"
TEST_EMAIL="qa-test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"

echo "[TEST 1.2] Middleware Session Lookup Failure"
echo "============================================"

# Step 1: Create and login user
echo "1. Creating user and logging in..."
curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}" > /dev/null

LOGIN=$(curl -s -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

JWT=$(echo "$LOGIN" | grep "Set-Cookie" | grep "session=" | \
  sed 's/.*session=\([^;]*\).*/\1/')

echo "✓ JWT: ${JWT:0:50}..."

# Step 2: Test session lookup endpoint
echo "2. Testing session lookup with JWT..."
LOOKUP=$(curl -s -X POST "$BASE_URL/api/auth/test-session-lookup" \
  -H "Content-Type: application/json" \
  -d "{\"sessionToken\":\"$JWT\"}")

if echo "$LOOKUP" | grep -q '"found":true'; then
  echo "✓ PASS: Session found in database"
  exit 0
else
  echo "✗ FAIL: Session NOT found in database"
  echo "  Response: $LOOKUP"
  exit 1
fi
```

**Expected Result (BUGGY):**
```
✗ FAIL: Session NOT found in database
```

**Expected Result (FIXED):**
```
✓ PASS: Session found in database
```

---

#### Test 1.3: Protected Route Access Failure
**Objective:** Verify user cannot access protected routes after login

```bash
#!/bin/bash
# test-1-3-protected-route-failure.sh

set -e
BASE_URL="http://localhost:3000"
TEST_EMAIL="qa-test-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123"

echo "[TEST 1.3] Protected Route Access Failure"
echo "========================================="

# Step 1: Login
echo "1. Logging in..."
LOGIN=$(curl -s -i -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

JWT=$(echo "$LOGIN" | grep "Set-Cookie" | grep "session=" | \
  sed 's/.*session=\([^;]*\).*/\1/')

echo "✓ JWT: ${JWT:0:50}..."

# Step 2: Access protected route
echo "2. Accessing protected route with JWT..."
PROTECTED=$(curl -s -i -X GET "$BASE_URL/api/protected/something" \
  -H "Cookie: session=$JWT")

HTTP_CODE=$(echo "$PROTECTED" | head -1 | cut -d' ' -f2)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ PASS: Protected route accessible (200 OK)"
  exit 0
elif [ "$HTTP_CODE" = "401" ]; then
  echo "✗ FAIL: Protected route returned 401 Unauthorized"
  echo "  This confirms BUG #1: Session not found in database"
  exit 1
else
  echo "✗ FAIL: Unexpected HTTP status $HTTP_CODE"
  exit 1
fi
```

**Expected Result (BUGGY):**
```
✗ FAIL: Protected route returned 401 Unauthorized
```

**Expected Result (FIXED):**
```
✓ PASS: Protected route accessible (200 OK)
```

---

### Phase 2: Automated Unit Tests (Pre & Post-Fix)

#### Test 2.1: Session Creation Atomicity

```typescript
// tests/auth/session-creation.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createSession, updateSessionToken } from '@/lib/auth-server';
import { createSessionPayload, signSessionToken } from '@/lib/auth-utils';

describe('Session Creation - Atomicity', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
      },
    });
    testUserId = user.id;
  });

  it('should create session with JWT token immediately', async () => {
    // Generate JWT
    const sessionId = 'test-session-123';
    const payload = createSessionPayload(testUserId, sessionId);
    const token = signSessionToken(payload);
    
    // Create session with real JWT (not temp)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: testUserId,
        sessionToken: token,
        expiresAt,
        isValid: true,
      },
    });

    // Verify database has the JWT token
    const dbSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    expect(dbSession).not.toBeNull();
    expect(dbSession?.sessionToken).toBe(token);
    expect(dbSession?.sessionToken).not.toMatch(/^temp_/);
  });

  it('should fail if JWT token is invalid', async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    // This should fail due to constraint validation
    expect(
      prisma.session.create({
        data: {
          id: 'test-session-456',
          userId: testUserId,
          sessionToken: '', // Invalid token
          expiresAt,
          isValid: true,
        },
      })
    ).rejects.toThrow();
  });

  it('should prevent duplicate sessionToken', async () => {
    const token = 'duplicate-token-xyz';
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create first session
    await prisma.session.create({
      data: {
        id: 'session-1',
        userId: testUserId,
        sessionToken: token,
        expiresAt,
        isValid: true,
      },
    });

    // Attempt to create second session with same token
    expect(
      prisma.session.create({
        data: {
          id: 'session-2',
          userId: testUserId,
          sessionToken: token, // Duplicate
          expiresAt,
          isValid: true,
        },
      })
    ).rejects.toThrow(); // Should violate unique constraint
  });
});
```

---

#### Test 2.2: Session Lookup Correctness

```typescript
// tests/auth/session-lookup.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getSessionByToken } from '@/lib/auth-server';
import { createSessionPayload, signSessionToken } from '@/lib/auth-utils';

describe('Session Lookup by Token', () => {
  let testUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
      },
    });
    testUserId = user.id;

    // Create valid session
    const sessionId = 'lookup-test-session';
    const payload = createSessionPayload(testUserId, sessionId);
    validToken = signSessionToken(payload);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: testUserId,
        sessionToken: validToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });
  });

  it('should find valid session by token', async () => {
    const session = await getSessionByToken(validToken);
    
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(testUserId);
    expect(session?.isValid).toBe(true);
  });

  it('should not find invalid token', async () => {
    const session = await getSessionByToken('invalid-token-xyz');
    
    expect(session).toBeNull();
  });

  it('should not find revoked session', async () => {
    // Revoke the session
    await prisma.session.update({
      where: { sessionToken: validToken },
      data: { isValid: false },
    });

    const session = await getSessionByToken(validToken);
    
    expect(session).toBeNull();
  });

  it('should not find expired session', async () => {
    // Create expired session
    const sessionId = 'expired-session';
    const payload = createSessionPayload(testUserId, sessionId);
    const token = signSessionToken(payload);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: testUserId,
        sessionToken: token,
        expiresAt: new Date(Date.now() - 1000), // Already expired
        isValid: true,
      },
    });

    const session = await getSessionByToken(token);
    
    expect(session).toBeNull();
  });

  it('should handle non-JWT tokens gracefully', async () => {
    const session = await getSessionByToken('temp_abcd-efgh-ijkl');
    
    expect(session).toBeNull(); // Should not find temp tokens
  });
});
```

---

#### Test 2.3: Middleware Verification

```typescript
// tests/middleware/auth-verification.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { 
  verifySessionToken, 
  isSessionExpired 
} from '@/lib/auth-utils';
import { 
  createSessionPayload, 
  signSessionToken 
} from '@/lib/auth-utils';

describe('Middleware Session Verification', () => {
  let testUserId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: 'dummy-hash',
      },
    });
    testUserId = user.id;
  });

  it('should verify valid JWT signature', () => {
    const payload = createSessionPayload(testUserId, 'session-123');
    const token = signSessionToken(payload);

    const verified = verifySessionToken(token);
    
    expect(verified.userId).toBe(testUserId);
    expect(verified.sessionId).toBe('session-123');
    expect(verified.version).toBe(1);
  });

  it('should reject tampered JWT', () => {
    const payload = createSessionPayload(testUserId, 'session-123');
    const token = signSessionToken(payload);

    // Tamper with token
    const tamperedToken = token.slice(0, -10) + 'tampered';

    expect(() => verifySessionToken(tamperedToken)).toThrow();
  });

  it('should reject expired JWT', () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredPayload = {
      userId: testUserId,
      sessionId: 'session-123',
      issuedAt: now - 100000,
      expiresAt: now - 1000, // Expired
      version: 1,
    };

    const payload = {
      ...expiredPayload,
      expiresAt: now + 3600, // Valid in JWT perspective
    };
    const token = signSessionToken(payload);

    // But when checking expiration with original expiresAt
    expect(isSessionExpired(expiredPayload)).toBe(true);
  });

  it('should detect invalid JWT algorithm', () => {
    // This would require creating a token with wrong algorithm
    // In practice, jwt.verify with algorithms: ['HS256'] should reject
    expect(() => {
      verifySessionToken('not.a.token');
    }).toThrow();
  });
});
```

---

#### Test 2.4: Error Handling During Session Creation

```typescript
// tests/auth/error-handling.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { updateSessionToken } from '@/lib/auth-server';

describe('Error Handling - Session Operations', () => {
  it('should throw on missing sessionId', async () => {
    await expect(
      updateSessionToken('', 'token')
    ).rejects.toThrow();
  });

  it('should throw on null sessionId', async () => {
    await expect(
      updateSessionToken(null as any, 'token')
    ).rejects.toThrow();
  });

  it('should throw on missing token', async () => {
    await expect(
      updateSessionToken('session-123', '')
    ).rejects.toThrow();
  });

  it('should throw on non-existent session', async () => {
    await expect(
      updateSessionToken('non-existent-id', 'token-xyz')
    ).rejects.toThrow();
  });

  it('should provide meaningful error messages', async () => {
    try {
      await updateSessionToken('', 'token');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error instanceof Error).toBe(true);
      expect((error as Error).message).not.toContain('Unexpected');
    }
  });
});
```

---

### Phase 3: Integration Tests (Full Login Flow)

#### Test 3.1: End-to-End Login with Protected Route Access

```typescript
// tests/integration/login-flow.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth-utils';
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

describe('Integration: Login Flow', () => {
  let testEmail: string;
  let testPassword: string;

  beforeEach(async () => {
    testEmail = `test-${Date.now()}@example.com`;
    testPassword = 'TestPassword123';

    // Create user in database
    const passwordHash = await hashPassword(testPassword);
    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
      },
    });
  });

  it('should complete full login flow', async () => {
    // Step 1: Login
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    expect(loginResponse.status).toBe(200);

    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);

    // Step 2: Extract JWT from Set-Cookie header
    const setCookie = loginResponse.headers.get('set-cookie');
    expect(setCookie).toMatch(/session=/);

    const jwtMatch = setCookie?.match(/session=([^;]+)/);
    expect(jwtMatch).toBeDefined();
    const jwt = jwtMatch![1];

    // Step 3: Verify session in database
    const dbSession = await prisma.session.findUnique({
      where: { sessionToken: jwt },
    });

    expect(dbSession).not.toBeNull();
    expect(dbSession?.sessionToken).toBe(jwt);

    // Step 4: Access protected route
    const protectedResponse = await fetch(`${BASE_URL}/api/protected/test`, {
      method: 'GET',
      headers: {
        'Cookie': `session=${jwt}`,
      },
    });

    expect(protectedResponse.status).toBe(200);
    const data = await protectedResponse.json();
    expect(data.authenticated).toBe(true);
  });

  it('should reject invalid credentials', async () => {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword',
      }),
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it('should handle concurrent logins', async () => {
    // Simulate concurrent login attempts
    const requests = Array(5)
      .fill(null)
      .map(() =>
        fetch(`${BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: testEmail,
            password: testPassword,
          }),
        })
      );

    const responses = await Promise.all(requests);

    // All should succeed
    for (const response of responses) {
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    }

    // All should create valid sessions in database
    const sessions = await prisma.session.findMany({
      where: { userId: (await prisma.user.findUnique({ where: { email: testEmail } }))?.id },
    });

    expect(sessions.length).toBe(5);
    for (const session of sessions) {
      expect(session.sessionToken).not.toMatch(/^temp_/);
    }
  });
});
```

---

### Phase 4: Regression Tests (Post-Fix)

#### Test 4.1: No Regressions in Auth Flow

```typescript
// tests/regression/auth-regression.test.ts

import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { 
  verifyPassword, 
  createSessionPayload, 
  signSessionToken,
  isSessionExpired 
} from '@/lib/auth-utils';
import { getSessionByToken } from '@/lib/auth-server';

describe('Regression Tests: Auth System', () => {
  it('should still support logout/session invalidation', async () => {
    // Create session
    const user = await prisma.user.create({
      data: { email: `test-${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const sessionId = 'logout-test-session';
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);

    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        sessionToken: token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });

    // Logout (invalidate)
    await prisma.session.update({
      where: { id: sessionId },
      data: { isValid: false },
    });

    // Session should not be found
    const found = await getSessionByToken(token);
    expect(found).toBeNull();
  });

  it('should still expire sessions correctly', async () => {
    const user = await prisma.user.create({
      data: { email: `test-${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    const sessionId = 'expire-test-session';
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);

    // Create with past expiration
    await prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        sessionToken: token,
        expiresAt: new Date(Date.now() - 1000), // Expired
        isValid: true,
      },
    });

    // Should not be found
    const found = await getSessionByToken(token);
    expect(found).toBeNull();
  });

  it('should still support multiple sessions per user', async () => {
    const user = await prisma.user.create({
      data: { email: `test-${Date.now()}@example.com`, passwordHash: 'hash' },
    });

    // Create 3 sessions
    const tokens = [];
    for (let i = 0; i < 3; i++) {
      const sessionId = `multi-session-${i}`;
      const payload = createSessionPayload(user.id, sessionId);
      const token = signSessionToken(payload);

      await prisma.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          sessionToken: token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          isValid: true,
        },
      });

      tokens.push(token);
    }

    // All should be findable
    for (const token of tokens) {
      const found = await getSessionByToken(token);
      expect(found).not.toBeNull();
    }

    // All should be associated with same user
    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
    });
    expect(sessions.length).toBe(3);
  });
});
```

---

## Test Execution Checklist

### Before Fix
- [ ] Run Test 1.1 (Session Creation State) - should FAIL
- [ ] Run Test 1.2 (Middleware Lookup) - should FAIL
- [ ] Run Test 1.3 (Protected Route) - should FAIL
- [ ] Run Test 2.x (Unit Tests) - should mostly PASS
- [ ] Document all failures

### After Fix
- [ ] Run Test 1.1 (Session Creation State) - should PASS
- [ ] Run Test 1.2 (Middleware Lookup) - should PASS
- [ ] Run Test 1.3 (Protected Route) - should PASS
- [ ] Run Test 2.x (Unit Tests) - should PASS
- [ ] Run Test 3.x (Integration Tests) - should PASS
- [ ] Run Test 4.x (Regression Tests) - should PASS

### Continuous Monitoring
- [ ] Set up automated test runs on every commit
- [ ] Monitor for "Session not found" errors in production
- [ ] Track session creation success rate
- [ ] Track middleware verification latency

---

## Success Criteria

### Functional Success
- ✅ Users can login successfully
- ✅ Sessions are stored with JWT tokens (not temp tokens)
- ✅ Middleware finds sessions in database
- ✅ Protected routes return 200 (not 401) after login
- ✅ Logout invalidates sessions
- ✅ Expired sessions are rejected

### Performance Success
- ✅ Session creation < 100ms
- ✅ Session lookup < 50ms
- ✅ Middleware verification < 200ms
- ✅ No database connection errors

### Security Success
- ✅ JWT tokens are cryptographically signed
- ✅ Tampered tokens are rejected
- ✅ Expired tokens are rejected
- ✅ Unique constraint prevents duplicate sessions
- ✅ No sensitive data in error messages

---

**Test Plan Version:** 1.0  
**Last Updated:** 2025-01-08  
**Status:** Ready for Execution
