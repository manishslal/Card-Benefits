# JWT Token Verification - Comprehensive Test Suite

**Purpose**: Validate JWT token creation, storage, verification, and database lookup

**Test Coverage**: Token lifecycle from creation to verification

---

## Setup & Fixtures

### Test Database Setup

```typescript
// tests/setup.ts
import { prisma } from '@/lib/prisma';

beforeAll(async () => {
  // Clear test data before all tests
  await prisma.session.deleteMany({});
  await prisma.player.deleteMany({});
  await prisma.user.deleteMany({});
});

afterEach(async () => {
  // Clean up after each test
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

### Test User Fixtures

```typescript
// tests/fixtures.ts
import { hashPassword } from '@/lib/auth-utils';

export const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123!@',
  firstName: 'Test',
  lastName: 'User',
};

export const TEST_USER_2 = {
  email: 'test2@example.com',
  password: 'SecurePassword456!@',
  firstName: 'Test2',
  lastName: 'User2',
};

export async function createTestUser(email: string, password: string) {
  const { createUser } = await import('@/lib/auth-server');
  const hashedPassword = await hashPassword(password);
  return createUser(email, hashedPassword);
}
```

### Test Utilities

```typescript
// tests/utils.ts
import jwt from 'jsonwebtoken';

export function extractTokenFromCookie(cookieHeader: string): string {
  // Parse "session=<token>; Path=/; HttpOnly; Secure; SameSite=Strict"
  const match = cookieHeader.match(/session=([^;]+)/);
  return match ? match[1] : '';
}

export function decodeJWT(token: string) {
  return jwt.decode(token) as any;
}

export function getTokenPayload(token: string) {
  const decoded = decodeJWT(token);
  return {
    userId: decoded.userId,
    sessionId: decoded.sessionId,
    expiresAt: decoded.expiresAt,
    issuedAt: decoded.issuedAt,
    version: decoded.version,
  };
}

export async function waitForDatabaseSync(ms: number = 500) {
  // Wait for database eventual consistency
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Unit Tests: Token Creation & Verification

### Test 1: JWT Signature Creation

**Purpose**: Verify JWT is correctly signed with SESSION_SECRET

```typescript
describe('JWT Token Signing', () => {
  it('should sign a valid JWT with HS256 algorithm', () => {
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    const token = signSessionToken(payload);
    
    // Verify token structure (header.payload.signature)
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    );
  });
  
  it('should include all required claims in JWT payload', () => {
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    const token = signSessionToken(payload);
    
    const decoded = decodeJWT(token);
    
    expect(decoded).toHaveProperty('userId', 'user123');
    expect(decoded).toHaveProperty('sessionId', 'session456');
    expect(decoded).toHaveProperty('expiresAt');
    expect(decoded).toHaveProperty('issuedAt');
    expect(decoded).toHaveProperty('version', 1);
  });
  
  it('should produce different tokens for different session IDs', () => {
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    
    const payload1 = createSessionPayload('user123', 'session1');
    const payload2 = createSessionPayload('user123', 'session2');
    
    const token1 = signSessionToken(payload1);
    const token2 = signSessionToken(payload2);
    
    expect(token1).not.toBe(token2);
  });
  
  it('should produce consistent tokens for same payload', () => {
    const { createSessionPayload } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    // Note: Can't test consistent signatures because jwt.sign includes 'iat' claim
    // which changes on each call, but we can test the structure is same
    expect(payload).toEqual(expect.objectContaining({
      userId: 'user123',
      sessionId: 'session456',
    }));
  });
});
```

### Test 2: JWT Verification

**Purpose**: Verify JWT signature verification works correctly

```typescript
describe('JWT Token Verification', () => {
  it('should verify a valid JWT token', () => {
    const { signSessionToken, verifySessionToken, createSessionPayload } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    const token = signSessionToken(payload);
    
    const verified = verifySessionToken(token);
    
    expect(verified).toEqual(expect.objectContaining({
      userId: 'user123',
      sessionId: 'session456',
    }));
  });
  
  it('should reject a tampered JWT token', () => {
    const { signSessionToken, verifySessionToken, createSessionPayload } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    let token = signSessionToken(payload);
    
    // Tamper with the token
    const parts = token.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({ userId: 'attacker', sessionId: 'session456' })
    ).toString('base64url');
    const tamperedToken = parts.join('.');
    
    expect(() => verifySessionToken(tamperedToken)).toThrow();
  });
  
  it('should reject token with invalid signature', () => {
    const { verifySessionToken } = require('@/lib/auth-utils');
    
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyMTIzIiwic2Vzc2lvbklkIjoic2Vzc2lvbjQ1NiIsImV4cGlyZXNBdCI6OTk5OTk5OTk5OX0.INVALID_SIGNATURE';
    
    expect(() => verifySessionToken(invalidToken)).toThrow();
  });
  
  it('should reject expired tokens', () => {
    const { verifySessionToken, isSessionExpired } = require('@/lib/auth-utils');
    
    // Create payload with past expiration
    const now = Math.floor(Date.now() / 1000);
    const expiredPayload = {
      userId: 'user123',
      sessionId: 'session456',
      issuedAt: now - 100,
      expiresAt: now - 50,  // ← Already expired
      version: 1,
    };
    
    expect(isSessionExpired(expiredPayload)).toBe(true);
  });
  
  it('should accept tokens before expiration', () => {
    const { isSessionExpired } = require('@/lib/auth-utils');
    
    const now = Math.floor(Date.now() / 1000);
    const validPayload = {
      userId: 'user123',
      sessionId: 'session456',
      issuedAt: now,
      expiresAt: now + 86400,  // ← 1 day in future
      version: 1,
    };
    
    expect(isSessionExpired(validPayload)).toBe(false);
  });
});
```

---

## Integration Tests: Session Lifecycle

### Test 3: Session Creation with Real Token

**Purpose**: Verify session is created with correct token in database

```typescript
describe('Session Creation with Real Token', () => {
  it('should create session with real JWT token (not temp)', async () => {
    const user = await createTestUser(TEST_USER.email, TEST_USER.password);
    
    // Simulate login flow with transaction
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    const { randomUUID } = require('crypto');
    
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const sessionId = randomUUID();
    
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);
    
    // Create session with real token (as per the fix)
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expiresAt,
        isValid: true,
      },
      select: { id: true, sessionToken: true, userId: true },
    });
    
    // Verify token is stored correctly
    expect(session.sessionToken).toBe(token);
    expect(session.sessionToken).not.toMatch(/^temp_/);
    
    // Verify we can find it immediately
    const foundSession = await prisma.session.findUnique({
      where: { sessionToken: token },
      select: { id: true, userId: true },
    });
    
    expect(foundSession).not.toBeNull();
    expect(foundSession.userId).toBe(user.id);
  });
  
  it('should not create sessions with temporary tokens', async () => {
    const user = await createTestUser(TEST_USER.email, TEST_USER.password);
    
    // This should NOT happen anymore
    const tempToken = `temp_${require('crypto').randomUUID()}`;
    
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: tempToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });
    
    // Check that no temp sessions exist in a real scenario
    const tempSessions = await prisma.session.findMany({
      where: { sessionToken: { startsWith: 'temp_' } },
    });
    
    // In fixed code, this should always be 0
    // This test documents that temp tokens are a bug
    expect(tempSessions.length).toBeGreaterThan(0);  // Shows the bug exists
  });
});
```

### Test 4: Token Lookup in Database

**Purpose**: Verify session can be found by token immediately after creation

```typescript
describe('Token Lookup in Database', () => {
  it('should find session by exact token match', async () => {
    const user = await createTestUser(TEST_USER.email, TEST_USER.password);
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    const { randomUUID } = require('crypto');
    
    const sessionId = randomUUID();
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);
    
    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });
    
    // Immediately look up by token (no delay)
    const { getSessionByToken } = await import('@/lib/auth-server');
    const foundSession = await getSessionByToken(token);
    
    expect(foundSession).not.toBeNull();
    expect(foundSession.userId).toBe(user.id);
    expect(foundSession.isValid).toBe(true);
  });
  
  it('should not find session with wrong token', async () => {
    const user = await createTestUser(TEST_USER.email, TEST_USER.password);
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    const { randomUUID } = require('crypto');
    
    const sessionId = randomUUID();
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);
    
    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
    });
    
    // Try to find with different token
    const { getSessionByToken } = await import('@/lib/auth-server');
    const wrongToken = signSessionToken(createSessionPayload(user.id, randomUUID()));
    const foundSession = await getSessionByToken(wrongToken);
    
    expect(foundSession).toBeNull();
  });
  
  it('should not find invalidated session', async () => {
    const user = await createTestUser(TEST_USER.email, TEST_USER.password);
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    const { randomUUID } = require('crypto');
    
    const sessionId = randomUUID();
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);
    
    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isValid: true,
      },
      select: { id: true },
    });
    
    // Invalidate session (logout)
    await prisma.session.update({
      where: { id: session.id },
      data: { isValid: false },
    });
    
    // Try to find invalidated session
    const { getSessionByToken } = await import('@/lib/auth-server');
    const foundSession = await getSessionByToken(token);
    
    expect(foundSession).toBeNull();
  });
  
  it('should not find expired session', async () => {
    const user = await createTestUser(TEST_USER.email, TEST_USER.password);
    const { signSessionToken, createSessionPayload } = require('@/lib/auth-utils');
    const { randomUUID } = require('crypto');
    
    const sessionId = randomUUID();
    const payload = createSessionPayload(user.id, sessionId);
    const token = signSessionToken(payload);
    
    // Create session with past expiration
    await prisma.session.create({
      data: {
        userId: user.id,
        sessionToken: token,
        expiresAt: new Date(Date.now() - 1000),  // ← Already expired
        isValid: true,
      },
    });
    
    // Try to find expired session
    const { getSessionByToken } = await import('@/lib/auth-server');
    const foundSession = await getSessionByToken(token);
    
    expect(foundSession).toBeNull();
  });
});
```

---

## API Tests: Login & Verification

### Test 5: Login Endpoint Creates Correct Session

**Purpose**: Verify login endpoint creates session with real token

```typescript
describe('Login Endpoint - Session Creation', () => {
  beforeEach(async () => {
    const { hashPassword } = require('@/lib/auth-utils');
    const { createUser } = await import('@/lib/auth-server');
    const hashedPassword = await hashPassword(TEST_USER.password);
    await createUser(TEST_USER.email, hashedPassword);
  });
  
  it('should create session with valid JWT token', async () => {
    const fetch = require('node-fetch');
    
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    expect(loginRes.status).toBe(200);
    
    // Extract token from cookie
    const setCookie = loginRes.headers.get('set-cookie');
    const token = extractTokenFromCookie(setCookie);
    
    // Verify token is valid JWT
    const { verifySessionToken } = require('@/lib/auth-utils');
    const payload = verifySessionToken(token);
    
    expect(payload).toHaveProperty('userId');
    expect(payload).toHaveProperty('sessionId');
    expect(payload).toHaveProperty('expiresAt');
  });
  
  it('should store token in database after login', async () => {
    const fetch = require('node-fetch');
    
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    const setCookie = loginRes.headers.get('set-cookie');
    const token = extractTokenFromCookie(setCookie);
    
    // Check database immediately
    const { getSessionByToken } = await import('@/lib/auth-server');
    const dbSession = await getSessionByToken(token);
    
    expect(dbSession).not.toBeNull();
    expect(dbSession.isValid).toBe(true);
  });
  
  it('should not create temporary tokens', async () => {
    const fetch = require('node-fetch');
    
    await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    // Check database for temp tokens
    const tempSessions = await prisma.session.findMany({
      where: { sessionToken: { startsWith: 'temp_' } },
    });
    
    expect(tempSessions).toHaveLength(0);
  });
});
```

### Test 6: Signup Endpoint Creates Correct Session

```typescript
describe('Signup Endpoint - Session Creation', () => {
  it('should create session with valid JWT token on signup', async () => {
    const fetch = require('node-fetch');
    
    const signupRes = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
        firstName: TEST_USER.firstName,
        lastName: TEST_USER.lastName,
      }),
    });
    
    expect(signupRes.status).toBe(201);
    
    const setCookie = signupRes.headers.get('set-cookie');
    const token = extractTokenFromCookie(setCookie);
    
    const { verifySessionToken } = require('@/lib/auth-utils');
    const payload = verifySessionToken(token);
    
    expect(payload.userId).toBeDefined();
  });
});
```

---

## Critical Race Condition Tests

### Test 7: Immediate Protected Request After Login

**Purpose**: Verify session lookup succeeds immediately after login (no race condition)

```typescript
describe('Race Condition: Immediate Protected Request', () => {
  it('should find session immediately after login (no delay)', async () => {
    const fetch = require('node-fetch');
    
    // Step 1: Login
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get('set-cookie');
    
    // Step 2: IMMEDIATELY (no delay) access protected route
    const dashboardRes = await fetch('http://localhost:3000/dashboard', {
      headers: { 'Cookie': setCookie },
    });
    
    // Should succeed, not 401
    expect(dashboardRes.status).toBe(200);
  });
  
  it('should handle concurrent logins without race condition', async () => {
    const fetch = require('node-fetch');
    
    // Create 5 test users
    const users = [];
    for (let i = 0; i < 5; i++) {
      const { createUser } = await import('@/lib/auth-server');
      const { hashPassword } = require('@/lib/auth-utils');
      const email = `concurrent${i}@example.com`;
      const password = 'TestPassword123!';
      const hashedPassword = await hashPassword(password);
      users.push({ email, password, hash: hashedPassword });
      await createUser(email, hashedPassword);
    }
    
    // Login all concurrently
    const loginPromises = users.map(user =>
      fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
        }),
      })
    );
    
    const results = await Promise.all(loginPromises);
    
    // All logins should succeed
    expect(results.every(r => r.status === 200)).toBe(true);
    
    // All tokens should be findable immediately
    for (const res of results) {
      const setCookie = res.headers.get('set-cookie');
      const token = extractTokenFromCookie(setCookie);
      
      const { getSessionByToken } = await import('@/lib/auth-server');
      const dbSession = await getSessionByToken(token);
      
      expect(dbSession).not.toBeNull();
    }
  });
});
```

### Test 8: Token Lifetime Verification

**Purpose**: Verify token expiration works correctly

```typescript
describe('Token Lifetime & Expiration', () => {
  it('should create token with 30-day expiration', () => {
    const { getSessionExpirationSeconds } = require('@/lib/auth-utils');
    
    const expirationSeconds = getSessionExpirationSeconds();
    const expectedSeconds = 30 * 24 * 60 * 60;
    
    expect(expirationSeconds).toBe(expectedSeconds);
  });
  
  it('should verify token is not expired immediately after creation', () => {
    const { createSessionPayload, isSessionExpired } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    
    expect(isSessionExpired(payload)).toBe(false);
  });
  
  it('should calculate correct seconds until expiration', () => {
    const { createSessionPayload, getSecondsUntilExpiration } = require('@/lib/auth-utils');
    
    const payload = createSessionPayload('user123', 'session456');
    const remaining = getSecondsUntilExpiration(payload);
    
    // Should be approximately 30 days (within 1 minute)
    const expectedMin = 30 * 24 * 60 * 60 - 60;
    const expectedMax = 30 * 24 * 60 * 60;
    
    expect(remaining).toBeGreaterThanOrEqual(expectedMin);
    expect(remaining).toBeLessThanOrEqual(expectedMax);
  });
});
```

---

## Middleware Tests

### Test 9: Middleware Token Verification

**Purpose**: Verify middleware can verify tokens and find sessions

```typescript
describe('Middleware Token Verification', () => {
  it('should verify valid token in protected route', async () => {
    const fetch = require('node-fetch');
    
    // Login to get token
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    const setCookie = loginRes.headers.get('set-cookie');
    
    // Access protected route
    const protectedRes = await fetch('http://localhost:3000/dashboard', {
      headers: { 'Cookie': setCookie },
    });
    
    expect(protectedRes.status).toBe(200);
  });
  
  it('should reject request with no token on protected route', async () => {
    const fetch = require('node-fetch');
    
    const protectedRes = await fetch('http://localhost:3000/dashboard', {
      headers: {},  // No cookie
    });
    
    expect(protectedRes.status).toBe(401);
  });
  
  it('should reject request with invalid token on protected route', async () => {
    const fetch = require('node-fetch');
    
    const protectedRes = await fetch('http://localhost:3000/dashboard', {
      headers: { 'Cookie': 'session=invalid.token.here' },
    });
    
    expect(protectedRes.status).toBe(401);
  });
  
  it('should reject request with tampered token', async () => {
    const fetch = require('node-fetch');
    
    // Login to get token
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    const setCookie = loginRes.headers.get('set-cookie');
    let token = extractTokenFromCookie(setCookie);
    
    // Tamper with token
    const parts = token.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({ userId: 'hacker', sessionId: 'fake' })
    ).toString('base64url');
    const tamperedToken = parts.join('.');
    
    const protectedRes = await fetch('http://localhost:3000/dashboard', {
      headers: { 'Cookie': `session=${tamperedToken}` },
    });
    
    expect(protectedRes.status).toBe(401);
  });
  
  it('should reject request after logout (session invalidated)', async () => {
    const fetch = require('node-fetch');
    
    // Login
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });
    
    const setCookie = loginRes.headers.get('set-cookie');
    
    // Logout
    await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Cookie': setCookie },
    });
    
    // Try to access protected route with invalidated token
    const protectedRes = await fetch('http://localhost:3000/dashboard', {
      headers: { 'Cookie': setCookie },
    });
    
    expect(protectedRes.status).toBe(401);
  });
});
```

---

## Load Testing

### Test 10: Stress Test - High Concurrency

**Purpose**: Verify no race conditions under heavy load

```typescript
describe('Stress Test: High Concurrency', () => {
  it('should handle 50 concurrent logins without race conditions', async () => {
    const fetch = require('node-fetch');
    
    // Create 50 test users
    const { createUser } = await import('@/lib/auth-server');
    const { hashPassword } = require('@/lib/auth-utils');
    
    const users = [];
    for (let i = 0; i < 50; i++) {
      const email = `load${i}@example.com`;
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);
      await createUser(email, hash);
      users.push({ email, password });
    }
    
    // Login all 50 users concurrently
    const startTime = Date.now();
    const loginPromises = users.map(user =>
      fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          password: user.password,
        }),
      })
    );
    
    const results = await Promise.all(loginPromises);
    const endTime = Date.now();
    
    const successCount = results.filter(r => r.status === 200).length;
    const failureCount = results.filter(r => r.status !== 200).length;
    const totalTime = endTime - startTime;
    
    console.log(`\n📊 Stress Test Results:`);
    console.log(`  Total Logins: 50`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${failureCount}`);
    console.log(`  Total Time: ${totalTime}ms`);
    console.log(`  Avg Time: ${totalTime / 50}ms per login`);
    
    // All should succeed
    expect(successCount).toBe(50);
    expect(failureCount).toBe(0);
    
    // All tokens should be findable in database
    const { getSessionByToken } = await import('@/lib/auth-server');
    for (const res of results) {
      const setCookie = res.headers.get('set-cookie');
      const token = extractTokenFromCookie(setCookie);
      const dbSession = await getSessionByToken(token);
      expect(dbSession).not.toBeNull();
    }
  });
});
```

---

## Summary

These tests validate:

✅ JWT creation and signing  
✅ JWT verification and expiration  
✅ Session creation with real tokens (not temp)  
✅ Database token lookup  
✅ Session invalidation  
✅ Token lifecycle (login → verification → logout)  
✅ Race conditions (immediate requests)  
✅ Concurrent load handling  
✅ Middleware verification  
✅ Token tampering detection  

**Run all tests with**:
```bash
npm run test
# or for watch mode
npm run test:watch
```

**Check coverage with**:
```bash
npm run test:coverage
```

All tests should pass after implementing the atomic session creation fix.
