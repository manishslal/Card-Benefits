/**
 * Authentication types and interfaces.
 *
 * Centralizes all auth-related TypeScript definitions used across
 * JWT operations, session management, password utilities, and context.
 */

// ============================================================
// Session & JWT Types
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
// Context Types
// ============================================================

/**
 * Authentication context stored in AsyncLocalStorage
 */
export interface AuthContext {
  userId?: string;  // User ID from session token, undefined if not authenticated
  error?: string;   // Error message if authentication failed
}

// ============================================================
// Ownership & Authorization Types
// ============================================================

/**
 * Result of an ownership verification check
 */
export interface OwnershipCheckResult {
  isOwner: boolean;
  error?: string;
}

// ============================================================
// Error Codes
// ============================================================

/**
 * Standardized error codes for server actions.
 * These codes are returned alongside error messages to allow clients
 * to handle specific error cases programmatically without relying
 * on error message text (which may vary by language/locale).
 */
export const AUTH_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',           // Auth or authz failure
  NOT_FOUND: 'NOT_FOUND',                 // Resource not found
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',     // Benefit already claimed (race condition)
  ADD_CARD_FAILED: 'ADD_CARD_FAILED',     // Failed to add card to wallet
  UPDATE_FAILED: 'UPDATE_FAILED',         // Generic update failure
  INVALID_INPUT: 'INVALID_INPUT',         // Input validation failure
} as const;
