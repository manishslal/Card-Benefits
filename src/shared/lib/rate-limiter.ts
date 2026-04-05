/**
 * In-memory rate limiter for authentication endpoints.
 *
 * Tracks failed login attempts by email and implements lockout logic.
 * Configurable for different attempts/windows.
 *
 * IMPORTANT: This is in-memory and will reset on process restart.
 * For production multi-instance deployments, use Redis instead.
 */

// ============================================================
// Type Definitions
// ============================================================

/**
 * Configuration for rate limiter
 */
export interface RateLimiterConfig {
  maxAttempts: number;      // Max failures before lockout
  windowMs: number;         // Time window in milliseconds
  lockoutMs: number;        // Lockout duration in milliseconds
}

/**
 * Tracking info for an IP/email
 */
interface AttemptRecord {
  failureCount: number;
  firstFailureTime: number;
  lockedUntil?: number;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitCheckResult {
  isAllowed: boolean;
  isLocked: boolean;
  lockedUntil?: Date;
  attemptsRemaining: number;
}

// ============================================================
// RateLimiter Class
// ============================================================

/**
 * In-memory rate limiter for login attempts
 *
 * Usage:
 * ```typescript
 * const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 900000 });
 * const check = limiter.check('user@example.com');
 * if (check.isLocked) {
 *   return 423 response with lockedUntil
 * }
 * // proceed with login
 * if (!loginSuccess) {
 *   limiter.recordFailure('user@example.com');
 * } else {
 *   limiter.recordSuccess('user@example.com');
 * }
 * ```
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private attempts: Map<string, AttemptRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.config = config;
    // Clean up old records periodically (every hour)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Checks if an identifier is rate limited.
   *
   * @param identifier - Email address or IP to check
   * @returns RateLimitCheckResult with isLocked and attemptsRemaining
   */
  check(identifier: string): RateLimitCheckResult {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    // No record - not rate limited
    if (!record) {
      return {
        isAllowed: true,
        isLocked: false,
        attemptsRemaining: this.config.maxAttempts,
      };
    }

    // Check if currently locked
    if (record.lockedUntil && now < record.lockedUntil) {
      return {
        isAllowed: false,
        isLocked: true,
        lockedUntil: new Date(record.lockedUntil),
        attemptsRemaining: 0,
      };
    }

    // Check if window has expired (reset counter)
    if (now - record.firstFailureTime > this.config.windowMs) {
      this.attempts.delete(identifier);
      return {
        isAllowed: true,
        isLocked: false,
        attemptsRemaining: this.config.maxAttempts,
      };
    }

    // Within window - check attempt count
    const attemptsRemaining = Math.max(
      0,
      this.config.maxAttempts - record.failureCount
    );

    return {
      isAllowed: record.failureCount < this.config.maxAttempts,
      isLocked: false,
      attemptsRemaining,
    };
  }

  /**
   * Records a failed attempt.
   *
   * Increments failure counter and applies lockout if threshold exceeded.
   *
   * @param identifier - Email address or IP
   */
  recordFailure(identifier: string): void {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      // First failure
      this.attempts.set(identifier, {
        failureCount: 1,
        firstFailureTime: now,
      });
      return;
    }

    // Check if window has expired
    if (now - record.firstFailureTime > this.config.windowMs) {
      // Reset counter
      this.attempts.set(identifier, {
        failureCount: 1,
        firstFailureTime: now,
      });
      return;
    }

    // Increment counter within window
    record.failureCount++;

    // Apply lockout if threshold exceeded
    if (record.failureCount >= this.config.maxAttempts) {
      record.lockedUntil = now + this.config.lockoutMs;
    }
  }

  /**
   * Records a successful attempt.
   *
   * Clears the failure record for the identifier.
   *
   * @param identifier - Email address or IP
   */
  recordSuccess(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Clears all rate limit records for testing.
   *
   * @internal Only for testing - do not use in production
   */
  reset(): void {
    this.attempts.clear();
  }

  /**
   * Gets the current state of an identifier (for debugging).
   *
   * @internal For testing/monitoring
   */
  getState(identifier: string): AttemptRecord | undefined {
    return this.attempts.get(identifier);
  }

  /**
   * Cleans up expired records to prevent memory leak
   *
   * @internal Called periodically via cleanup interval
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [identifier, record] of this.attempts.entries()) {
      // Delete if window has expired and not locked
      if (
        now - record.firstFailureTime > this.config.windowMs &&
        (!record.lockedUntil || now > record.lockedUntil)
      ) {
        toDelete.push(identifier);
      }
    }

    for (const identifier of toDelete) {
      this.attempts.delete(identifier);
    }
  }

  /**
   * Cleanup on process exit
   *
   * @internal
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
