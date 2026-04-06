/**
 * Redis-based Distributed Rate Limiter
 *
 * Provides rate limiting across multiple server instances using Redis.
 * Falls back to in-memory rate limiting if Redis is unavailable.
 * ioredis is an optional dependency - only required when ENABLE_REDIS_RATE_LIMITING=true
 *
 * Usage:
 *   const result = await checkRateLimit('login', 'user@example.com', {
 *     maxAttempts: 5,
 *     windowMs: 15 * 60 * 1000, // 15 minutes
 *   });
 *
 *   if (result.isLocked) {
 *     return new Response('Too many attempts', { status: 429 });
 *   }
 */

// Conditionally import Redis only if needed
// ioredis is optional - this module loads even if ioredis is not installed
let Redis: any = null;
let redisImportError: Error | null = null;

try {
  // Use require instead of import to make it optional at runtime
  // This prevents TypeScript from failing at build time if ioredis is not installed
  Redis = require('ioredis');
} catch (error) {
  redisImportError = error instanceof Error ? error : new Error('Failed to load ioredis');
  console.debug('[RedisRateLimiter] ioredis not available (optional dependency)');
}

// Type definitions
interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number; // Window duration in milliseconds
  lockoutMs?: number; // Lockout duration (defaults to windowMs)
}

interface RateLimitResult {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutExpiresAt: number | null;
  checkedAt: number;
}

interface RateLimitCheckResult extends RateLimitResult {
  incremented: boolean;
}

/**
 * In-memory fallback rate limiter for when Redis is unavailable
 * Used to gracefully handle Redis connection failures
 */
class InMemoryRateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  private lockouts: Map<string, number> = new Map();

  check(key: string, options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const lockoutExpiresAt = this.lockouts.get(key);

    // Check if user is locked out
    if (lockoutExpiresAt && lockoutExpiresAt > now) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockoutExpiresAt,
        checkedAt: now,
      };
    }

    // Clear expired lockout
    if (lockoutExpiresAt && lockoutExpiresAt <= now) {
      this.lockouts.delete(key);
    }

    // Get or initialize attempt counter
    let record = this.attempts.get(key);
    if (!record || record.resetTime < now) {
      record = { count: 0, resetTime: now + options.windowMs };
      this.attempts.set(key, record);
    }

    const remainingAttempts = Math.max(0, options.maxAttempts - record.count);

    return {
      isLocked: false,
      remainingAttempts,
      lockoutExpiresAt: null,
      checkedAt: now,
    };
  }

  increment(key: string, options: RateLimitOptions): RateLimitCheckResult {
    const checkResult = this.check(key, options);

    if (checkResult.isLocked) {
      return { ...checkResult, incremented: false };
    }

    const now = Date.now();
    const record = this.attempts.get(key);

    if (record) {
      record.count++;

      // Apply lockout if max attempts reached
      if (record.count >= options.maxAttempts) {
        const lockoutDuration = options.lockoutMs || options.windowMs;
        this.lockouts.set(key, now + lockoutDuration);

        return {
          isLocked: true,
          remainingAttempts: 0,
          lockoutExpiresAt: now + lockoutDuration,
          checkedAt: now,
          incremented: true,
        };
      }
    }

    return {
      isLocked: false,
      remainingAttempts: checkResult.remainingAttempts - 1,
      lockoutExpiresAt: null,
      checkedAt: now,
      incremented: true,
    };
  }

  // Cleanup expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.attempts.entries()) {
      if (record.resetTime < now) {
        this.attempts.delete(key);
      }
    }
  }
}

/**
 * Redis-based rate limiter for distributed rate limiting
 * Key format: rl:{endpoint}:{identifier}:attempts
 * Lockout key: rl:{endpoint}:{identifier}:lockout_until
 */
class RedisRateLimiter {
  private redis: any;
  private fallback: InMemoryRateLimiter;
  private isAvailable: boolean = true;

  constructor(redis: any) {
    this.redis = redis;
    this.fallback = new InMemoryRateLimiter();

    // Monitor Redis connection
    this.redis.on('error', (err: Error) => {
      console.error('[RedisRateLimiter] Connection error:', err.message);
      this.isAvailable = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('[RedisRateLimiter] Reconnecting...');
    });

    this.redis.on('connect', () => {
      console.log('[RedisRateLimiter] Connected');
      this.isAvailable = true;
    });
  }

  /**
   * Check current rate limit status without incrementing
   */
  async check(
    endpoint: string,
    identifier: string,
    options: RateLimitOptions
  ): Promise<RateLimitResult> {
    try {
      if (!this.isAvailable) {
        return this.fallback.check(this.getKey(endpoint, identifier), options);
      }

      const now = Date.now();
      const key = this.getKey(endpoint, identifier);
      const lockoutKey = `${key}:lockout_until`;

      // Check lockout status
      const lockoutTimestamp = await this.redis.get(lockoutKey);
      if (lockoutTimestamp) {
        const lockoutExpiresAt = parseInt(lockoutTimestamp, 10);
        if (lockoutExpiresAt > now) {
          return {
            isLocked: true,
            remainingAttempts: 0,
            lockoutExpiresAt,
            checkedAt: now,
          };
        }
      }

      // Get current attempt count
      const attemptsStr = await this.redis.get(key);
      const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
      const remainingAttempts = Math.max(0, options.maxAttempts - attempts);

      return {
        isLocked: false,
        remainingAttempts,
        lockoutExpiresAt: null,
        checkedAt: now,
      };
    } catch (error) {
      console.error('[RedisRateLimiter.check] Error:', error);
      // Fall back to in-memory limiter
      return this.fallback.check(this.getKey(endpoint, identifier), options);
    }
  }

  /**
   * Increment attempt counter and check if user is rate limited
   * Returns true if user is locked out, false if within limits
   */
  async increment(
    endpoint: string,
    identifier: string,
    options: RateLimitOptions
  ): Promise<RateLimitCheckResult> {
    try {
      if (!this.isAvailable) {
        return this.fallback.increment(this.getKey(endpoint, identifier), options);
      }

      const now = Date.now();
      const key = this.getKey(endpoint, identifier);
      const lockoutKey = `${key}:lockout_until`;
      const windowSec = Math.ceil(options.windowMs / 1000);
      const lockoutDurationSec = Math.ceil((options.lockoutMs || options.windowMs) / 1000);

      // Check if already locked out
      const lockoutTimestamp = await this.redis.get(lockoutKey);
      if (lockoutTimestamp) {
        const lockoutExpiresAt = parseInt(lockoutTimestamp, 10);
        if (lockoutExpiresAt > now) {
          return {
            isLocked: true,
            remainingAttempts: 0,
            lockoutExpiresAt,
            checkedAt: now,
            incremented: false,
          };
        }
      }

      // Increment attempt counter using Lua script for atomicity
      // This ensures the check and increment are atomic across instances
      const script = `
        local key = KEYS[1]
        local lockoutKey = KEYS[2]
        local now = tonumber(ARGV[1])
        local maxAttempts = tonumber(ARGV[2])
        local windowSec = tonumber(ARGV[3])
        local lockoutDurationSec = tonumber(ARGV[4])

        local attempts = redis.call('INCR', key)
        redis.call('EXPIRE', key, windowSec)

        if attempts >= maxAttempts then
          local lockoutExpiresAt = now + (lockoutDurationSec * 1000)
          redis.call('SET', lockoutKey, lockoutExpiresAt)
          redis.call('EXPIRE', lockoutKey, lockoutDurationSec)
          return {1, 0, lockoutExpiresAt}
        else
          return {0, maxAttempts - attempts, 0}
        end
      `;

      const result = await this.redis.eval(script, 2, key, lockoutKey, now.toString(), options.maxAttempts.toString(), windowSec.toString(), lockoutDurationSec.toString()) as [number, number, number];

      const [isLockedFlag, remainingAttempts, lockoutExpiresAt] = result;

      return {
        isLocked: isLockedFlag === 1,
        remainingAttempts,
        lockoutExpiresAt: lockoutExpiresAt || null,
        checkedAt: now,
        incremented: true,
      };
    } catch (error) {
      console.error('[RedisRateLimiter.increment] Error:', error);
      // Fall back to in-memory limiter
      return this.fallback.increment(this.getKey(endpoint, identifier), options);
    }
  }

  /**
   * Reset rate limit for a specific identifier
   * Useful for admin operations or after password reset
   */
  async reset(endpoint: string, identifier: string): Promise<void> {
    try {
      if (!this.isAvailable) {
        // Fallback: can't reset in-memory without reference
        return;
      }

      const key = this.getKey(endpoint, identifier);
      const lockoutKey = `${key}:lockout_until`;

      await Promise.all([
        this.redis.del(key),
        this.redis.del(lockoutKey),
      ]);

      console.log('[RedisRateLimiter] Reset rate limit:', { endpoint, identifier });
    } catch (error) {
      console.error('[RedisRateLimiter.reset] Error:', error);
      // Non-critical operation, don't throw
    }
  }

  /**
   * Get statistics for a specific identifier
   * Useful for monitoring and debugging
   */
  async getStats(endpoint: string, identifier: string): Promise<Record<string, unknown>> {
    try {
      if (!this.isAvailable) {
        return { available: false, message: 'Redis unavailable' };
      }

      const key = this.getKey(endpoint, identifier);
      const lockoutKey = `${key}:lockout_until`;

      const [attempts, lockoutTimestamp, ttl, lockoutTtl] = await Promise.all([
        this.redis.get(key),
        this.redis.get(lockoutKey),
        this.redis.ttl(key),
        this.redis.ttl(lockoutKey),
      ]);

      return {
        endpoint,
        identifier,
        attempts: attempts ? parseInt(attempts, 10) : 0,
        lockedOut: !!lockoutTimestamp,
        lockoutExpiresAt: lockoutTimestamp ? parseInt(lockoutTimestamp, 10) : null,
        ttl: ttl === -1 ? 'no expiration' : ttl,
        lockoutTtl: lockoutTtl === -1 ? 'no expiration' : lockoutTtl,
      };
    } catch (error) {
      console.error('[RedisRateLimiter.getStats] Error:', error);
      return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private getKey(endpoint: string, identifier: string): string {
    // Sanitize identifier to prevent key injection
    const sanitized = identifier.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `rl:${endpoint}:${sanitized}:attempts`;
  }

  /**
   * Cleanup - gracefully close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('[RedisRateLimiter.close] Error closing Redis:', error);
    }
  }
}

/**
 * Global instance management
 */
let globalRedis: any = null;
let globalRateLimiter: RedisRateLimiter | null = null;

/**
 * Initialize the global Redis rate limiter
 * Call this once at application startup
 */
export function initializeRedisRateLimiter(): RedisRateLimiter {
  if (globalRateLimiter) {
    return globalRateLimiter;
  }

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      'REDIS_URL environment variable not set. ' +
      'Set it to enable distributed rate limiting, or use in-memory limiter.'
    );
  }

  // Check if ioredis is available
  if (!Redis || redisImportError) {
    console.warn(
      '[RedisRateLimiter] ioredis not installed. To use Redis rate limiting, run: npm install ioredis'
    );
    throw new Error(
      'ioredis module not available. Install it with: npm install ioredis\n' +
      'Or disable Redis rate limiting by setting ENABLE_REDIS_RATE_LIMITING=false'
    );
  }

  globalRedis = new Redis(redisUrl, {
    // Connection pooling
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    enableOfflineQueue: false,

    // Retry strategy: exponential backoff with max 2 seconds
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      if (times > 10) {
        console.error('[RedisRateLimiter] Max retries exceeded, giving up');
        return null; // Stop retrying
      }
      return delay;
    },

    // Connection timeouts
    connectTimeout: 10000,
    lazyConnect: false,

    // Password and TLS (if REDIS_URL contains them, they'll be parsed automatically)
    // For TLS connections:
    // tls: {
    //   rejectUnauthorized: true,
    // },
  });

  globalRateLimiter = new RedisRateLimiter(globalRedis);

  return globalRateLimiter;
}

/**
 * Get the global Redis rate limiter instance
 * Initialize first with initializeRedisRateLimiter()
 */
export function getRedisRateLimiter(): RedisRateLimiter {
  if (!globalRateLimiter) {
    throw new Error(
      'RedisRateLimiter not initialized. Call initializeRedisRateLimiter() first.'
    );
  }
  return globalRateLimiter;
}

/**
 * High-level API for rate limiting checks
 * Recommended usage in route handlers
 */
export async function checkRateLimit(
  endpoint: string,
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitCheckResult> {
  try {
    // Check if Redis rate limiter is enabled
    const enabled = process.env.ENABLE_REDIS_RATE_LIMITING === 'true';
    if (!enabled) {
      // Feature flag disabled, skip
      return {
        isLocked: false,
        remainingAttempts: options.maxAttempts,
        lockoutExpiresAt: null,
        checkedAt: Date.now(),
        incremented: false,
      };
    }

    const limiter = getRedisRateLimiter();
    return await limiter.increment(endpoint, identifier, options);
  } catch (error) {
    console.error('[checkRateLimit] Error:', error);
    // Default to allowing the request (fail-open strategy)
    // Better to allow legitimate requests than block them during an outage
    return {
      isLocked: false,
      remainingAttempts: options.maxAttempts,
      lockoutExpiresAt: null,
      checkedAt: Date.now(),
      incremented: false,
    };
  }
}

/**
 * Graceful shutdown hook for application cleanup
 * Call this during server shutdown
 */
export async function shutdownRedisRateLimiter(): Promise<void> {
  if (globalRateLimiter) {
    await globalRateLimiter.close();
    globalRateLimiter = null;
    globalRedis = null;
  }
}

// Export types for use in other modules
export type { RateLimitOptions, RateLimitResult, RateLimitCheckResult };
export { RedisRateLimiter, InMemoryRateLimiter };
