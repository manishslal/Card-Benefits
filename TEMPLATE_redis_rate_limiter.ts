/**
 * Redis-Backed Rate Limiter for Railway Distributed Systems
 * 
 * This replaces the in-memory rate limiter with a Redis-backed implementation
 * that works across multiple application instances.
 * 
 * Benefits:
 * - Works across multiple replicas (in-memory doesn't)
 * - Survives application restarts
 * - Can be shared with other services
 * - More reliable for production
 * 
 * Setup:
 * 1. Add Redis plugin in Railway (or use external Redis)
 * 2. Set REDIS_URL environment variable
 * 3. Install ioredis: npm install ioredis
 * 4. Use this module instead of in-memory limiter
 */

import Redis from 'ioredis';

/**
 * Redis client - singleton pattern to prevent connection leaks
 */
let redisClient: Redis | null = null;

/**
 * Initialize Redis connection if URL provided
 */
function initializeRedis(): Redis | null {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[RATE_LIMITER] REDIS_URL not set, using in-memory fallback');
    return null;
  }

  try {
    redisClient = new Redis(redisUrl, {
      // Connection settings
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      enableOfflineQueue: false,

      // Reconnection strategy
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },

      // Timeouts
      connectTimeout: 10_000,
      commandTimeout: 5_000,

      // Error handling
      onError: (error) => {
        console.error('[RATE_LIMITER] Redis error:', error.message);
      },
    });

    redisClient.on('connect', () => {
      console.log('[RATE_LIMITER] Connected to Redis');
    });

    redisClient.on('disconnect', () => {
      console.log('[RATE_LIMITER] Disconnected from Redis');
    });

    return redisClient;
  } catch (error) {
    console.error('[RATE_LIMITER] Failed to initialize Redis:', error);
    return null;
  }
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt?: Date;
  retryAfter?: number;
}

/**
 * Check if request is allowed under rate limit
 * 
 * @param key Unique identifier (e.g., IP address, user ID)
 * @param maxAttempts Maximum requests allowed in window
 * @param windowMs Window size in milliseconds
 * @returns Rate limit check result
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = initializeRedis();

  // If Redis is unavailable, fall back to allowing request
  // (fail open: rather allow request than break functionality)
  if (!redis) {
    return {
      allowed: true,
      remaining: maxAttempts,
    };
  }

  try {
    const windowSeconds = Math.ceil(windowMs / 1000);
    const attempts = await redis.incr(key);

    // Set expiration on first request
    if (attempts === 1) {
      await redis.expire(key, windowSeconds);
    }

    const remaining = Math.max(0, maxAttempts - attempts);
    const resetAt = new Date(Date.now() + windowMs);

    const allowed = attempts <= maxAttempts;

    if (!allowed) {
      // Return retry-after header value (seconds)
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: ttl > 0 ? ttl : 60,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error('[RATE_LIMITER] Error checking rate limit:', error);
    // Fail open: allow request if Redis fails
    return {
      allowed: true,
      remaining: maxAttempts,
    };
  }
}

/**
 * Reset rate limit counter for a key
 * Useful for immediate ban or clearing limits
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = initializeRedis();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.error('[RATE_LIMITER] Error resetting rate limit:', error);
  }
}

/**
 * Get current attempts count
 */
export async function getRateLimitCount(key: string): Promise<number> {
  const redis = initializeRedis();
  if (!redis) return 0;

  try {
    const count = await redis.get(key);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('[RATE_LIMITER] Error getting rate limit count:', error);
    return 0;
  }
}

/**
 * Cleanup: disconnect Redis on shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.quit();
    redisClient = null;
    console.log('[RATE_LIMITER] Redis disconnected');
  } catch (error) {
    console.error('[RATE_LIMITER] Error disconnecting Redis:', error);
  }
}

/**
 * Usage Example in /api/cron/reset-benefits/route.ts:
 * 
 * ```typescript
 * import { checkRateLimit } from '@/lib/redis-rate-limiter';
 * import { NextRequest, NextResponse } from 'next/server';
 * 
 * export async function GET(request: NextRequest) {
 *   const ip = request.headers.get('x-forwarded-for') || 'unknown';
 *   
 *   // Check rate limit: 10 requests per hour
 *   const rateLimitCheck = await checkRateLimit(
 *     `cron:reset-benefits:${ip}`,
 *     10,
 *     3600_000 // 1 hour
 *   );
 * 
 *   if (!rateLimitCheck.allowed) {
 *     return NextResponse.json(
 *       { error: 'Rate limit exceeded' },
 *       {
 *         status: 429,
 *         headers: {
 *           'Retry-After': String(rateLimitCheck.retryAfter),
 *         },
 *       }
 *     );
 *   }
 *   
 *   // ... rest of cron logic
 * }
 * ```
 * 
 * Usage Example for Login Endpoint (/api/auth/login):
 * 
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const ip = request.headers.get('x-forwarded-for') || 'unknown';
 *   
 *   // Check rate limit: 5 attempts per 15 minutes
 *   const rateLimitCheck = await checkRateLimit(
 *     `login:${ip}`,
 *     5,
 *     15 * 60_000 // 15 minutes
 *   );
 *   
 *   if (!rateLimitCheck.allowed) {
 *     logger.warn('Login rate limit exceeded', {
 *       ip,
 *       resetAt: rateLimitCheck.resetAt,
 *     });
 *     return NextResponse.json(
 *       { error: 'Too many login attempts. Try again later.' },
 *       { status: 429 }
 *     );
 *   }
 *   
 *   // ... authentication logic
 * }
 * ```
 */

/**
 * Environment Setup for Railway:
 * 
 * 1. In Railway Dashboard, add Redis plugin
 * 2. Redis plugin automatically sets REDIS_URL environment variable
 * 3. Or use external Redis:
 *    - Set REDIS_URL=redis://user:pass@host:port
 *    - Examples:
 *      - Upstash: redis://default:...@...redis.upstash.io:...
 *      - AWS ElastiCache: redis://...elasticache.amazonaws.com:...
 *      - Heroku Redis: redis://...redis.herokuapp.com:...
 * 
 * 4. Install dependencies:
 *    npm install ioredis
 *    npm install --save-dev @types/ioredis (if using TypeScript)
 * 
 * 5. Test connection:
 *    npm run dev
 *    # Check logs for "[RATE_LIMITER] Connected to Redis"
 */
