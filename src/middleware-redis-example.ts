/**
 * Middleware Integration Example: Redis-Based Rate Limiting
 *
 * This file demonstrates how to integrate distributed rate limiting
 * into the application middleware when scaling to multiple instances.
 *
 * IMPORTANT: This is an EXAMPLE/TEMPLATE. Do not deploy without testing.
 *
 * Current state: Not integrated into production middleware
 * Reason: Application is single-instance; in-memory rate limiter is sufficient
 * When to integrate: When deploying 2+ server instances with shared state requirements
 *
 * Usage:
 * 1. Review this file to understand integration points
 * 2. When ready to scale: Merge this logic into src/middleware.ts
 * 3. Enable feature flag: ENABLE_REDIS_RATE_LIMITING=true
 * 4. Deploy and monitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { checkRateLimit } from '@/lib/redis-rate-limiter';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'your-secret-key'
);

/**
 * Configuration for different rate limit endpoints
 */
const RATE_LIMIT_CONFIG = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutMs: 15 * 60 * 1000, // 15 minutes
  },
  cron: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 60 * 60 * 1000, // 1 hour
  },
  api: {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
    lockoutMs: 60 * 1000, // 1 minute
  },
} as const;

/**
 * Helper: Extract identifier from request (IP, email, user ID)
 *
 * Strategy:
 * 1. For login endpoint: Use email from request body
 * 2. For cron endpoint: Use client IP address
 * 3. For API endpoints: Use authenticated user ID if available, else IP
 */
async function getIdentifier(request: NextRequest, endpoint: string): Promise<string> {
  switch (endpoint) {
    case 'login': {
      // Extract email from request body for login endpoint
      try {
        const body = await request.json();
        if (body.email) {
          return body.email.toLowerCase().trim();
        }
      } catch (error) {
        console.error('[middleware] Failed to parse login request body:', error);
      }
      // Fallback to IP if email not found
      return getClientIP(request);
    }

    case 'cron': {
      // Use IP address for cron endpoint (public endpoint)
      return getClientIP(request);
    }

    case 'api': {
      // Try to get authenticated user ID, fallback to IP
      try {
        const token = request.headers.get('Authorization')?.split(' ')[1];
        if (token) {
          const verified = await jwtVerify(token, JWT_SECRET);
          const userId = (verified.payload as any).userId;
          if (userId) {
            return `user:${userId}`;
          }
        }
      } catch (error) {
        // Token validation failed, fall back to IP
      }
      return getClientIP(request);
    }

    default:
      return getClientIP(request);
  }
}

/**
 * Helper: Extract client IP from request
 * Considers X-Forwarded-For and X-Real-IP headers (from reverse proxies/load balancers)
 */
function getClientIP(request: NextRequest): string {
  // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2...)
  // Take the first one (original client IP)
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // X-Real-IP is set by some reverse proxies
  const xRealIp = request.headers.get('X-Real-IP');
  if (xRealIp) {
    return xRealIp;
  }

  // Socket IP (less reliable behind proxies)
  // @ts-ignore - NextRequest socket type
  const socket = request.socket;
  if (socket?.remoteAddress) {
    return socket.remoteAddress;
  }

  // Fallback
  return 'unknown';
}

/**
 * Rate limiting middleware for login endpoint
 *
 * Checks: 5 failed attempts per email in 15-minute window
 * Use case: Prevent brute-force attacks on user credentials
 */
export async function rateLimitLogin(request: NextRequest) {
  // Only rate limit POST requests (actual login attempts)
  if (request.method !== 'POST') {
    return NextResponse.next();
  }

  const email = await getIdentifier(request, 'login');
  const config = RATE_LIMIT_CONFIG.login;

  const result = await checkRateLimit('login', email, {
    maxAttempts: config.maxAttempts,
    windowMs: config.windowMs,
  });

  if (result.isLocked) {
    console.warn('[middleware] Login rate limit exceeded:', {
      email,
      lockoutExpiresAt: new Date(result.lockoutExpiresAt || 0).toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Too many login attempts. Please try again later.',
        // Don't expose timing information to prevent information disclosure
      },
      { status: 429, headers: { 'Retry-After': '900' } } // 15 minutes
    );
  }

  return NextResponse.next();
}

/**
 * Rate limiting middleware for cron endpoint
 *
 * Checks: 10 calls per IP in 1-hour window
 * Use case: Prevent abuse of scheduled job endpoints
 */
export async function rateLimitCron(request: NextRequest) {
  // Only rate limit POST requests (actual cron triggers)
  if (request.method !== 'POST') {
    return NextResponse.next();
  }

  const ip = getClientIP(request);
  const config = RATE_LIMIT_CONFIG.cron;

  const result = await checkRateLimit('cron', ip, {
    maxAttempts: config.maxAttempts,
    windowMs: config.windowMs,
  });

  if (result.isLocked) {
    console.warn('[middleware] Cron rate limit exceeded:', {
      ip,
      lockoutExpiresAt: new Date(result.lockoutExpiresAt || 0).toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Too many requests. Please try again later.',
      },
      { status: 429, headers: { 'Retry-After': '3600' } } // 1 hour
    );
  }

  return NextResponse.next();
}

/**
 * Rate limiting middleware for general API endpoints
 *
 * Checks: 100 requests per user/IP per minute
 * Use case: Prevent API abuse and DDoS attacks
 */
export async function rateLimitAPI(request: NextRequest) {
  const identifier = await getIdentifier(request, 'api');
  const config = RATE_LIMIT_CONFIG.api;

  const result = await checkRateLimit('api', identifier, {
    maxAttempts: config.maxAttempts,
    windowMs: config.windowMs,
  });

  if (result.isLocked) {
    console.warn('[middleware] API rate limit exceeded:', {
      identifier,
      lockoutExpiresAt: new Date(result.lockoutExpiresAt || 0).toISOString(),
    });

    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Too many requests.',
      },
      { status: 429, headers: { 'Retry-After': '60' } } // 1 minute
    );
  }

  return NextResponse.next();
}

/**
 * INTEGRATION GUIDE: When to use this in src/middleware.ts
 *
 * CURRENT STATE (Single Instance):
 * ├── No changes needed
 * ├── Use existing in-memory rate limiter in route handlers
 * └── Performance: 0ms latency (no network calls)
 *
 * FUTURE STATE (Multi-Instance):
 * ├── Step 1: Add Redis service to deployment platform
 * ├── Step 2: Set REDIS_URL environment variable
 * ├── Step 3: Install ioredis: npm install ioredis
 * ├── Step 4: Initialize Redis in application startup:
 * │   app.ts or server.ts:
 * │   import { initializeRedisRateLimiter } from '@/lib/redis-rate-limiter';
 * │   initializeRedisRateLimiter();
 * │
 * ├── Step 5: Add middleware (Option A: Global Middleware)
 * │   In src/middleware.ts:
 * │   import { rateLimitLogin, rateLimitCron, rateLimitAPI } from '@/middleware-redis-example';
 * │
 * │   export async function middleware(request: NextRequest) {
 * │     const pathname = request.nextUrl.pathname;
 * │
 * │     // Apply rate limiting to specific endpoints
 * │     if (pathname === '/api/auth/login') {
 * │       return await rateLimitLogin(request);
 * │     }
 * │
 * │     if (pathname === '/api/cron/reset-benefits') {
 * │       return await rateLimitCron(request);
 * │     }
 * │
 * │     if (pathname.startsWith('/api/')) {
 * │       return await rateLimitAPI(request);
 * │     }
 * │
 * │     return NextResponse.next();
 * │   }
 * │
 * │   export const config = {
 * │     matcher: [
 * │       '/api/:path*',
 * │     ],
 * │   };
 * │
 * │   Step 6: OR (Option B: Route Handler Approach)
 * │   Update individual route handlers:
 * │   // src/app/api/auth/login/route.ts
 * │   import { checkRateLimit } from '@/lib/redis-rate-limiter';
 * │
 * │   export async function POST(request: Request) {
 * │     const body = await request.json();
 * │     const result = await checkRateLimit('login', body.email, {
 * │       maxAttempts: 5,
 * │       windowMs: 15 * 60 * 1000,
 * │     });
 * │
 * │     if (result.isLocked) {
 * │       return NextResponse.json(
 * │         { error: 'Too many attempts' },
 * │         { status: 429 }
 * │       );
 * │     }
 * │     // ... rest of login logic
 * │   }
 * │
 * └── Step 7: Set feature flag: ENABLE_REDIS_RATE_LIMITING=true
 * └── Step 8: Test with 2+ instances, verify shared state
 *
 * PERFORMANCE EXPECTATIONS:
 * ├── Single instance (in-memory): <1ms per check
 * ├── Multi-instance (Redis): 1-5ms per check (network round-trip)
 * └── Fallback to in-memory on Redis failure: <1ms per check
 *
 * MONITORING:
 * ├── Track: Redis connection status
 * ├── Alert: If Redis unavailable > 1 minute
 * ├── Alert: If > 10% of requests are rate limited
 * └── Monitor: Redis memory usage
 */

/**
 * Example: How to handle rate limit in specific route
 *
 * BEFORE (Current - in-memory):
 * ────────────────────────────────
 * import { loginRateLimiter } from '@/lib/rate-limiter';
 *
 * export async function POST(request: Request) {
 *   const body = await request.json();
 *   const isLocked = loginRateLimiter.isLocked(body.email);
 *   if (isLocked) {
 *     return NextResponse.json(
 *       { error: 'Too many attempts' },
 *       { status: 429 }
 *     );
 *   }
 *   loginRateLimiter.recordAttempt(body.email);
 *   // ... login logic
 * }
 *
 * AFTER (Distributed - Redis):
 * ────────────────────────────
 * import { checkRateLimit } from '@/lib/redis-rate-limiter';
 *
 * export async function POST(request: Request) {
 *   const body = await request.json();
 *   const result = await checkRateLimit('login', body.email, {
 *     maxAttempts: 5,
 *     windowMs: 15 * 60 * 1000,
 *   });
 *   if (result.isLocked) {
 *     return NextResponse.json(
 *       { error: 'Too many attempts' },
 *       { status: 429 }
 *     );
 *   }
 *   // ... login logic (increment happens automatically in checkRateLimit)
 * }
 */

/**
 * Testing Rate Limiting
 *
 * Unit Test Example:
 * ──────────────────
 * import { checkRateLimit } from '@/lib/redis-rate-limiter';
 *
 * describe('Redis Rate Limiting', () => {
 *   it('should lock user after max attempts', async () => {
 *     const email = 'test@example.com';
 *     const config = { maxAttempts: 3, windowMs: 60000 };
 *
 *     // Make 3 attempts
 *     for (let i = 0; i < 3; i++) {
 *       await checkRateLimit('login', email, config);
 *     }
 *
 *     // 4th attempt should be locked
 *     const result = await checkRateLimit('login', email, config);
 *     expect(result.isLocked).toBe(true);
 *   });
 *
 *   it('should fallback to in-memory if Redis unavailable', async () => {
 *     // Mock Redis failure
 *     // Verify rate limiting still works
 *   });
 * });
 *
 * Load Test Example:
 * ──────────────────
 * k6 run load-test.js --vus 100 --duration 30s
 *
 * Verify:
 * - Rate limits are consistent across instances
 * - Redis round-trip time is acceptable (<10ms)
 * - No requests slip through when locked
 */
