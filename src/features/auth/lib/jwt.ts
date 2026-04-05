/**
 * JWT signing and verification utilities (HS256).
 *
 * This module handles:
 * - Signing session payloads into JWT tokens
 * - Verifying JWT token signatures and extracting payloads
 * - Managing JWT secrets and configuration
 *
 * Algorithm: HS256 (HMAC SHA-256)
 */

import jwt from 'jsonwebtoken';
import { SessionPayload } from '../types';

// ============================================================
// Configuration Constants
// ============================================================

/**
 * JWT algorithm and options
 * Uses HS256 (HMAC SHA-256) for signing
 */
const JWT_ALGORITHM = 'HS256' as const;

/**
 * Session token expiration: 30 days (in seconds)
 * Must match cookie Max-Age value
 */
export const SESSION_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 seconds

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
 * Returns the session token expiration duration in seconds.
 * Used for setting HTTP cookie Max-Age.
 */
export function getSessionExpirationSeconds(): number {
  return SESSION_EXPIRATION_SECONDS;
}

// ============================================================
// JWT Signing and Verification
// ============================================================

/**
 * Signs a session payload into a JWT token.
 *
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
export function signToken(payload: SessionPayload): string {
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
export function verifyToken(token: string): SessionPayload {
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

// Legacy exports for backward compatibility during migration
/**
 * @deprecated Use signToken() instead
 */
export const signSessionToken = signToken;

/**
 * @deprecated Use verifyToken() instead
 */
export const verifySessionToken = verifyToken;
