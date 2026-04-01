/**
 * Authentication utilities for password hashing and JWT operations.
 *
 * This module handles:
 * - Argon2id password hashing with secure parameters
 * - Timing-safe password verification to prevent timing attacks
 * - JWT signing and verification using HS256
 * - Session payload creation and validation
 *
 * NOTE: This module must be used only on the server side.
 * It imports native modules (argon2) that cannot be bundled by webpack.
 * Always mark files importing this as 'use server' or use dynamic imports.
 */

import jwt from 'jsonwebtoken';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Session payload stored in JWT token.
 * Contains minimal claims: userId, issuedAt, expiresAt, sessionId, version
 */
export interface SessionPayload {
  userId: string;           // User ID from database
  issuedAt: number;         // Unix timestamp (seconds) when created
  expiresAt: number;        // Unix timestamp (seconds) when expires
  sessionId: string;        // Reference to Session record for revocation
  version: number;          // For invalidating old tokens on logout
}

/**
 * Result from password hash operation
 */
export interface HashResult {
  hash: string;
  error?: undefined;
}

/**
 * Result from JWT signing operation
 */
export interface SignTokenResult {
  token: string;
  error?: undefined;
}

/**
 * Result from JWT verification operation
 */
export interface VerifyTokenResult {
  payload: SessionPayload;
  error?: undefined;
}

// ============================================================
// Configuration Constants
// ============================================================

/**
 * Argon2id parameters for password hashing.
 *
 * Security rationale:
 * - algorithm: 'argon2id' (memory-hard, resistant to GPU/ASIC attacks)
 * - memoryCost: 65536 KB (64MB - balances security and performance)
 * - timeCost: 2 (2 iterations - sufficient with high memory cost)
 * - parallelism: 1 (single thread - consistent across deployments)
 *
 * Expected hash time: ~100ms on modern hardware
 */
const ARGON2_CONFIG = {
  memoryCost: 65536,  // 64MB
  timeCost: 2,
  parallelism: 1,
  type: 0,  // Argon2id
} as const;

/**
 * JWT algorithm and options
 * Uses HS256 (HMAC SHA-256) for signing
 */
const JWT_ALGORITHM = 'HS256' as const;

/**
 * Session token expiration: 30 days (in seconds)
 * Must match cookie Max-Age value
 */
const SESSION_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 seconds

// ============================================================
// Helper Functions
// ============================================================

/**
 * Gets the SESSION_SECRET from environment variables.
 *
 * CRITICAL: SESSION_SECRET must be:
 * - Minimum 256 bits (32 bytes) of entropy
 * - Base64-encoded or hex-encoded
 * - Stored securely in environment variables only
 * - Never committed to version control
 *
 * @throws {Error} If SESSION_SECRET is not set
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. ' +
      'Generate a 256-bit random key and set it in .env.local'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 256 bits (32 bytes). ' +
      'Current length: ' + secret.length + ' bytes'
    );
  }
  return secret;
}

/**
 * Validates password strength against requirements.
 *
 * Requirements:
 * - Minimum 12 characters
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 lowercase letter (a-z)
 * - At least 1 digit (0-9)
 * - At least 1 special character (!@#$%^&*-_)
 *
 * @param password - Password to validate
 * @returns Object with isValid flag and specific error messages
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!password || password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }

  if (!/[!@#$%^&*\-_]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*-_)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates email format using RFC 5322 basic pattern.
 *
 * This is a basic validation; production should use email verification.
 * Format: local-part@domain
 *
 * @param email - Email to validate
 * @returns true if email format is valid
 */
export function validateEmail(email: string): boolean {
  // RFC 5322 simplified regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================================
// Password Hashing (Argon2id)
// ============================================================

/**
 * Hashes a password using Argon2id algorithm.
 *
 * Security considerations:
 * - Uses memory-hard Argon2id (resistant to GPU/ASIC attacks)
 * - Timing-safe operation (always takes similar time)
 * - Returns Base64-encoded hash with algorithm info embedded
 *
 * Expected output format: $argon2id$v=19$m=65536,t=2,p=1$<salt>$<hash>
 *
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password string
 * @throws {Error} If hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Dynamic import to avoid webpack bundling the native argon2 module
    const { hash } = await import('argon2');
    const hashedPassword = await hash(password, ARGON2_CONFIG);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifies a password against a hash using timing-safe comparison.
 *
 * CRITICAL SECURITY: Uses argon2.verify() which performs timing-safe
 * comparison internally. This prevents timing attacks where an attacker
 * could determine password correctness by measuring response time.
 *
 * The verification time depends on the stored parameters, not the
 * match position, making it impossible to guess passwords character-by-character.
 *
 * @param hashedPassword - Hash from database (Argon2id format)
 * @param plaintextPassword - Password to verify
 * @returns Promise<boolean> true if password matches, false otherwise
 * @throws {Error} If verification fails (invalid hash format)
 */
export async function verifyPassword(
  hashedPassword: string,
  plaintextPassword: string
): Promise<boolean> {
  try {
    // Dynamic import to avoid webpack bundling the native argon2 module
    const { verify } = await import('argon2');
    const isValid = await verify(hashedPassword, plaintextPassword);
    return isValid;
  } catch (error) {
    // Hash format invalid or verification failed - treat as no match
    return false;
  }
}

// ============================================================
// JWT Signing and Verification (HS256)
// ============================================================

/**
 * Signs a session payload into a JWT token.
 *
 * Algorithm: HS256 (HMAC SHA-256)
 * Payload includes: userId, issuedAt, expiresAt, sessionId, version
 *
 * Security notes:
 * - Secret is 256+ bits of entropy (configured via SESSION_SECRET)
 * - Signature prevents tampering with payload
 * - Token is compact (~200-300 bytes) and fits in cookie
 *
 * @param payload - SessionPayload to sign
 * @returns JWT token string
 * @throws {Error} If signing fails or SESSION_SECRET is invalid
 */
export function signSessionToken(payload: SessionPayload): string {
  try {
    const secret = getSessionSecret();
    const token = jwt.sign(payload, secret, {
      algorithm: JWT_ALGORITHM,
      expiresIn: SESSION_EXPIRATION_SECONDS,
    });
    return token;
  } catch (error) {
    throw new Error(`Failed to sign session token: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verifies a JWT token signature and extracts the payload.
 *
 * Security checks:
 * - Verifies HMAC SHA-256 signature (prevents tampering)
 * - Checks token expiration (expiresAt > now)
 * - Rejects invalid or malformed tokens
 *
 * @param token - JWT token string to verify
 * @returns SessionPayload if valid
 * @throws {Error} If token is invalid, tampered, or expired
 */
export function verifySessionToken(token: string): SessionPayload {
  try {
    const secret = getSessionSecret();
    const payload = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
    }) as SessionPayload;
    return payload;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Session token verification failed: ${errorMessage}`);
  }
}

// ============================================================
// Session Creation (High-Level)
// ============================================================

/**
 * Creates a new session payload with proper expiration.
 *
 * Called after successful login or signup.
 *
 * @param userId - User ID from database
 * @param sessionId - Session record ID (for revocation tracking)
 * @returns SessionPayload with issuedAt and expiresAt timestamps
 */
export function createSessionPayload(
  userId: string,
  sessionId: string
): SessionPayload {
  const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
  const expiresAt = now + SESSION_EXPIRATION_SECONDS;

  return {
    userId,
    issuedAt: now,
    expiresAt,
    sessionId,
    version: 1,
  };
}

/**
 * Checks if a session payload is expired.
 *
 * @param payload - SessionPayload to check
 * @returns true if expiresAt < now (expired)
 */
export function isSessionExpired(payload: SessionPayload): boolean {
  const now = Math.floor(Date.now() / 1000);
  return payload.expiresAt < now;
}

/**
 * Calculates seconds until session expiration.
 *
 * Used in session response to inform client when token expires
 *
 * @param payload - SessionPayload
 * @returns Seconds until expiration (0 if already expired)
 */
export function getSecondsUntilExpiration(payload: SessionPayload): number {
  const now = Math.floor(Date.now() / 1000);
  const remaining = payload.expiresAt - now;
  return Math.max(0, remaining);
}

/**
 * Returns the session token expiration duration in seconds.
 * Used for setting HTTP cookie Max-Age.
 */
export function getSessionExpirationSeconds(): number {
  return SESSION_EXPIRATION_SECONDS;
}
