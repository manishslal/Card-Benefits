/**
 * Main authentication module barrel export.
 *
 * This file re-exports all authentication utilities, types, and context
 * for convenient importing from a single location.
 *
 * Usage:
 * ```typescript
 * import { 
 *   signToken, 
 *   verifyToken, 
 *   hashPassword, 
 *   verifyPassword,
 *   getAuthUserId,
 *   useAuth,
 *   getAuthUserIdOrThrow,
 *   verifyPlayerOwnership
 * } from '@/features/auth/lib/auth';
 * ```
 */

// JWT operations
export {
  signToken,
  verifyToken,
  signSessionToken,
  verifySessionToken,
  getSessionExpirationSeconds,
  SESSION_EXPIRATION_SECONDS,
} from './jwt';

// Session management
export {
  isSessionExpired,
  getSecondsUntilExpiration,
  createSessionPayload,
  createAndUpdateSession,
  createSession,
  validateSession,
  getSessionByToken,
  invalidateSession,
  updateSessionToken,
} from './session';

// Password utilities
export {
  validatePasswordStrength,
  validateEmail,
  hashPassword,
  verifyPassword,
  ARGON2_OPTIONS,
} from './password';

// Server-side utilities
export {
  getAuthUserIdOrThrow,
  verifyPlayerOwnership,
  verifyCardOwnership,
  verifyBenefitOwnership,
  authorizeCardOperation,
  userExists,
  getUserByEmail,
  getUserById,
  invalidateUserSessions,
  getUserSessions,
  createUser,
} from './server';

// Authentication context
export {
  runWithAuthContext,
  getAuthContext,
  getAuthUserId,
  getAuthError,
  isAuthenticated,
  useAuthUserId,
} from '../context/auth-context';

// Types
export type {
  SessionPayload,
  HashResult,
  SignTokenResult,
  VerifyTokenResult,
  AuthContext,
  OwnershipCheckResult,
} from '../types';

export { AUTH_ERROR_CODES } from '../types';
