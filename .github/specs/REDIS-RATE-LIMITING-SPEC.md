# Redis-Based Distributed Rate Limiting Specification

## Overview

This specification defines the implementation of distributed rate limiting using Redis for the Card Benefits Tracker. This is a **future-scaling feature** designed to support multi-instance deployments where users cannot bypass rate limits by hitting different server instances.

**Status:** Template & documentation provided | **Not required for MVP**

---

## Problem Statement

### Current Single-Instance Limitation

The application currently uses **in-memory rate limiting**, which:
- ✅ Works perfectly for single-instance deployments
- ❌ Does NOT work across multiple instances
- ❌ Users can bypass rate limits by hitting different replicas
- ❌ Resets on container restart/redeployment

### Example Attack Scenario

```
User wants to brute-force login credentials:

Instance 1: Rate limiter tracks 5 failed attempts → LOCKED
Instance 2: Rate limiter has no history → ALLOWS requests
Instance 3: Same as Instance 2 → ALLOWS requests

Result: Attacker makes 15 attempts across 3 instances instead of 5
```

### When to Implement

- **Currently:** Not required (single instance on Railway)
- **Scaling trigger:** When deploying to 2+ server instances
- **Performance impact:** Minimal (Redis round-trip adds ~1-5ms per request)

---

## Solution Architecture

### Redis Schema Design

**Key Naming Convention:**
```
rl:{endpoint}:{identifier}:{counter}
```

**Schema Breakdown:**

| Component | Purpose | Example |
|-----------|---------|---------|
| `rl:` | Rate limit prefix | Namespace isolation |
| `{endpoint}` | API endpoint identifier | `login`, `cron`, `api` |
| `{identifier}` | User/client identifier | email or IP address |
| `{counter}` | Counter type | `attempts`, `lockout` |

### Specific Key Formats

#### Login Rate Limiting

```
Key: rl:login:user@example.com:attempts
Type: String (numeric counter)
Value: 3
TTL: 900 seconds (15 minutes)
Purpose: Track failed login attempts

Key: rl:login:user@example.com:lockout_until
Type: String (Unix timestamp)
Value: 1704067200000
TTL: 900 seconds (15 minutes)
Purpose: Timestamp when lockout expires
```

#### Cron Job Rate Limiting

```
Key: rl:cron:192.168.1.100:attempts
Type: String (numeric counter)
Value: 7
TTL: 3600 seconds (1 hour)
Purpose: Track cron endpoint calls per IP

Key: rl:cron:192.168.1.100:lockout_until
Type: String (Unix timestamp)
Value: 1704070800000
TTL: 3600 seconds (1 hour)
Purpose: Timestamp when lockout expires
```

#### General API Rate Limiting (Future)

```
Key: rl:api:user_id_123:attempts
Type: String (numeric counter)
Value: 42
TTL: 60 seconds (1 minute)
Purpose: Track API requests per user
```

### Redis Data Expiration

All rate limit keys automatically expire using Redis TTL:
- **Login endpoint:** 15 minutes (900s)
- **Cron endpoint:** 1 hour (3600s)
- **General API:** 1 minute (60s) to 1 hour, configurable per endpoint

**No manual cleanup required** - Redis handles automatic expiration.

---

## Implementation Approach

### Option A: Direct ioredis Integration (Recommended)

#### Step 1: Install Dependency

```bash
npm install ioredis
npm install --save-dev @types/ioredis  # TypeScript types
```

#### Step 2: Create Redis Client Singleton

Create `src/lib/redis.ts`:

```typescript
import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,
    });

    redis.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });
  }

  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
```

#### Step 3: Create Distributed Rate Limiter

Create `src/lib/redis-rate-limiter.ts` - see template below.

#### Step 4: Update Route Handlers

```typescript
// Old: import { loginRateLimiter } from '@/lib/rate-limiter';
// New:
import { checkRateLimit } from '@/lib/redis-rate-limiter';

export async function POST(request: Request) {
  const email = await request.json().then(b => b.email);
  
  // Distributed check
  const limited = await checkRateLimit('login', email, {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  });
  
  if (limited.isLocked) {
    return new Response(
      JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
      { status: 429 }
    );
  }
  
  // ... rest of login logic
}
```

### Option B: Using Redis with Upstash (Serverless Alternative)

For serverless deployments without persistent Redis:

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
```

**Trade-offs:**
- ✅ No infrastructure to manage
- ✅ Built-in redundancy
- ❌ REST API calls (slightly slower than TCP)
- ❌ Additional cost (~$10/month for low traffic)

---

## Migration Path: Single Instance → Multi-Instance

### Phase 1: Current State (MVP)
- **Deployment:** Single instance on Railway
- **Rate limiting:** In-memory
- **Action:** Continue using existing `rate-limiter.ts`
- **Timeline:** Now - Current

### Phase 2: Preparation (Week 1-2 of scaling)
- **Action:** 
  1. Add `redis-rate-limiter.ts` to codebase
  2. Install `ioredis` dependency
  3. Create Redis client singleton
  4. Write unit tests for distributed limiter
  5. Deploy to production (disabled via feature flag)

```typescript
// Feature flag approach
const useRedis = process.env.ENABLE_REDIS_RATE_LIMITING === 'true';
const limiter = useRedis ? redisRateLimiter : inMemoryRateLimiter;
```

### Phase 3: Enable Redis (Week 3)
- **Action:**
  1. Add Redis service to Railway (Managed PostgreSQL add-on)
  2. Set `REDIS_URL` environment variable
  3. Enable feature flag: `ENABLE_REDIS_RATE_LIMITING=true`
  4. Monitor error logs for any issues
  5. Verify rate limit blocks are working

### Phase 4: Deploy Multi-Instance (Week 4)
- **Action:**
  1. Increase Railway instance count to 2
  2. Monitor that rate limits are now shared
  3. Verify load balancing is working
  4. Update capacity based on traffic patterns

### Phase 5: Cleanup (Week 5+)
- **Action:**
  1. Remove in-memory rate limiter if Redis is stable
  2. Archive `rate-limiter.ts` to git history
  3. Update documentation with multi-instance setup

### Rollback Strategy

If Redis becomes unavailable:

```typescript
// Graceful fallback in redis-rate-limiter.ts
try {
  const result = await checkRateLimit(...);
  return result;
} catch (error) {
  console.error('Redis unavailable, falling back to in-memory limiter');
  return inMemoryRateLimiter.check(...);
}
```

**Action Items:**
- ✅ Test Redis failure scenarios
- ✅ Implement fallback to in-memory
- ✅ Alert on Redis connection failures
- ✅ Document failover procedures

---

## Deployment Configuration

### Railway Managed Redis Setup

#### Step 1: Add Redis Service

1. Go to Railway Dashboard
2. Click "Create" → "Service" → "Marketplace"
3. Search for "Redis"
4. Select "Redis (Managed)"
5. Click "Deploy"

#### Step 2: Configure Environment Variables

Railway automatically creates:
- `REDIS_URL` - Full Redis connection string

Verify in Railway Variables:
```
REDIS_URL=redis://username:password@host:port/0
```

#### Step 3: Update Application

```typescript
// src/lib/redis.ts
const redis = new Redis(process.env.REDIS_URL!);
```

#### Step 4: Test Connection

```bash
# Local test with Redis CLI
redis-cli ping
# Expected output: PONG

# Application test
curl http://localhost:3000/api/health
# Should show redis: "connected"
```

### Environment Variables

Add to `.env.example`:

```bash
# Redis Configuration (Optional - only needed for multi-instance deployment)
# To enable distributed rate limiting across multiple server instances:
# 1. Add a Managed Redis service on Railway
# 2. Railway will automatically set REDIS_URL
# 3. Set ENABLE_REDIS_RATE_LIMITING=true to activate

REDIS_URL=redis://localhost:6379
ENABLE_REDIS_RATE_LIMITING=false
```

---

## Pricing Impact

### Railway Managed Redis

| Plan | Storage | Cost | Use Case |
|------|---------|------|----------|
| Free Tier | 100MB | $0/month | Development |
| 256MB | 256MB | $5/month | Small apps (< 10K MAU) |
| 512MB | 512MB | $10/month | Medium apps (10K-100K MAU) |
| 1GB | 1GB | $15/month | Large apps (100K-1M MAU) |
| 2GB | 2GB | $25/month | Very large apps (>1M MAU) |

### Estimated Cost for Card Benefits Tracker

**Assumptions:**
- 5,000 monthly active users
- ~5% of users attempt login per day
- ~500 login attempts per day
- ~2KB per rate limit key

**Estimated Storage:** < 10MB
**Recommended Tier:** 256MB plan (~$5/month)

**Total Monthly Cost Increase:** ~$5-10/month

### Cost-Benefit Analysis

| Factor | Impact |
|--------|--------|
| **Benefit: Security** | Prevents brute-force attacks across instances |
| **Benefit: User Experience** | No accidental lockouts from load balancing |
| **Benefit: Operational** | Simplifies multi-instance deployment |
| **Cost: Storage** | $5-10/month for managed Redis |
| **Cost: Network** | Minimal (local data center) |
| **ROI** | Prevents 1 security incident = many months of service |

### Cost Optimization Tips

1. **Use connection pooling** - Reuse Redis connections
2. **Batch operations** - Use Redis pipelines for multiple operations
3. **Selective rate limiting** - Apply to login/cron only, not all endpoints
4. **Monitor size** - Set up alerts if Redis memory exceeds threshold

---

## Implementation Checklist

### Before Enabling Redis

- [ ] Add `ioredis` to `package.json` dependencies
- [ ] Create `src/lib/redis.ts` (client singleton)
- [ ] Create `src/lib/redis-rate-limiter.ts` (distributed limiter)
- [ ] Write unit tests for distributed limiter
- [ ] Test Redis failure/unavailability scenarios
- [ ] Update middleware example: `src/middleware-redis-example.ts`
- [ ] Update `.env.example` with REDIS_URL and feature flag
- [ ] Update `README.md` with scaling instructions

### Deployment Prerequisites

- [ ] Railway account with billing enabled
- [ ] Managed Redis service provisioned
- [ ] REDIS_URL environment variable configured
- [ ] Application can connect to Redis (test with simple PING)
- [ ] Fallback to in-memory limiter is working

### After Enabling Redis

- [ ] Monitor Redis connection in logs
- [ ] Verify rate limit keys are being created
- [ ] Test rate limiting across multiple instances (load test)
- [ ] Monitor Redis memory usage
- [ ] Set up alerting for Redis disconnections
- [ ] Document any performance impact (should be minimal)

### Production Readiness

- [ ] Rate limiter is feature-flagged
- [ ] Graceful fallback to in-memory works
- [ ] Error handling is comprehensive
- [ ] Logging shows key operations
- [ ] Load testing completed (2+ instance scenario)
- [ ] Rollback plan is documented
- [ ] Monitoring dashboard is configured

---

## Monitoring & Observability

### Key Metrics to Track

```typescript
// In redis-rate-limiter.ts
prometheus.counter('rate_limit_checks_total', {
  endpoint: 'login',
  result: 'allowed|locked',
});

prometheus.histogram('rate_limit_check_duration_ms', {
  endpoint: 'login',
});

prometheus.gauge('redis_connection_status', {
  status: 'connected|disconnected',
});
```

### Alerting Rules

1. **Redis Disconnection:** Alert if Redis unavailable > 1 minute
2. **High Lockout Rate:** Alert if > 10% of login attempts locked
3. **Slow Redis Response:** Alert if Redis response time > 100ms
4. **Memory Usage:** Alert if Redis memory > 80% of allocated

### Logging

```typescript
console.log('rate_limit_check', {
  endpoint,
  identifier,
  attempts: currentAttempts,
  isLocked,
  remainingTime,
  timestamp: new Date().toISOString(),
});
```

---

## Security Considerations

### Rate Limiting Bypass Prevention

✅ **Distributed state prevents:**
- IP spoofing across instances
- Session replay across instances
- Rapid-fire attacks across load balancers

### Redis Security

✅ **Best practices:**
- Use `REDIS_URL` with authentication password
- Enable Redis ACL (access control lists)
- Use TLS/SSL for Redis connections
- Network isolation (private Redis endpoint)

```typescript
// Example: Redis with TLS
const redis = new Redis(process.env.REDIS_URL, {
  tls: {
    rejectUnauthorized: true,
  },
});
```

### Information Disclosure Prevention

✅ **Generic error messages:**
```typescript
// Don't expose rate limit details
return {
  error: 'Too many attempts. Please try again later.',
  // DON'T include: attemptsRemaining, lockoutTimeRemaining
};
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/redis-rate-limiter.test.ts
describe('Redis Rate Limiter', () => {
  test('blocks user after max attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit('login', 'user@example.com');
    }
    
    const result = await checkRateLimit('login', 'user@example.com');
    expect(result.isLocked).toBe(true);
  });

  test('fallbacks to in-memory if Redis unavailable', async () => {
    // Disconnect Redis
    // Make rate limit check
    // Verify it still works with in-memory limiter
  });

  test('respects lockout window', async () => {
    // Hit rate limit
    // Wait 1 second (lockout: 15 min)
    // Verify still locked
  });
});
```

### Integration Tests

```typescript
// tests/multi-instance-rate-limit.test.ts
describe('Multi-Instance Rate Limiting', () => {
  test('shared state across instances', async () => {
    // Start 2 server instances
    // Make 3 requests to instance 1
    // Make 2 requests to instance 2
    // Both should see 5 total attempts (shared state)
  });
});
```

### Load Testing

```bash
# Simulate 100 users with 10 requests each
k6 run load-test.js --vus 100 --duration 30s
```

---

## Troubleshooting Guide

### Issue: "Redis connection refused"

**Causes:**
- Redis service not running
- REDIS_URL not set
- Firewall blocking connection

**Solution:**
```bash
# Test connection
redis-cli -u $REDIS_URL ping
# Should output: PONG

# Check environment
echo $REDIS_URL
# Should show full connection string
```

### Issue: "Rate limiting not working"

**Causes:**
- Feature flag disabled
- Redis keys not being created
- Fallback limiter has issues

**Solution:**
```typescript
// Add debug logging
console.log('Rate limit check:', {
  endpoint,
  identifier,
  result,
});

// Verify keys in Redis
redis-cli -u $REDIS_URL KEYS "rl:*"
```

### Issue: "Redis memory usage growing"

**Causes:**
- TTL not set on keys
- Keys not expiring

**Solution:**
```bash
# Check TTL on sample key
redis-cli -u $REDIS_URL TTL "rl:login:user@example.com:attempts"
# Should show positive number of seconds

# Monitor memory
redis-cli -u $REDIS_URL INFO memory
```

---

## References

- [ioredis Documentation](https://luin.github.io/ioredis/)
- [Redis Rate Limiting Patterns](https://redis.io/topics/rate-limiting)
- [Railway Redis Add-on](https://docs.railway.app/plugins/redis)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html)

---

## Timeline Summary

| Timeline | Trigger | Action | Cost |
|----------|---------|--------|------|
| **Phase 1 (Current)** | MVP Launch | Use in-memory limiter | $0 |
| **Phase 2 (Week 1-2)** | Planning to scale | Add Redis code & tests | $0 |
| **Phase 3 (Week 3)** | Prepare for multi-instance | Enable Redis feature flag | +$5-10 |
| **Phase 4 (Week 4)** | Scale to 2+ instances | Deploy 2nd server instance | +$5 per instance |
| **Phase 5 (Week 5+)** | Stable multi-instance | Remove in-memory limiter | No additional cost |

---

## Next Steps

1. ✅ **Review this specification** with your team
2. ✅ **Read the implementation templates:**
   - `src/lib/redis-rate-limiter.ts` - Distributed rate limiter
   - `src/middleware-redis-example.ts` - Middleware integration
3. ✅ **When ready to enable:**
   - Follow the "Deployment Configuration" section
   - Update route handlers to use distributed limiter
   - Deploy feature flag to production
4. ✅ **Monitor and iterate:**
   - Track performance metrics
   - Adjust rate limit windows based on traffic
   - Optimize Redis usage

---

**Document Version:** 1.0
**Last Updated:** 2024
**Status:** Ready for Implementation
**Audience:** DevOps Engineers, Backend Developers
