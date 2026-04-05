/**
 * Session management and validation utilities.
 *
 * This module handles:
 * - Creating and updating session records in the database
 * - Validating session tokens and checking expiration
 * - Managing session lifecycle (creation, validation, invalidation)
 *
 * All functions interact with the Prisma ORM for database operations.
 */

import { SessionPayload } from '../types';
import { prisma } from '@/shared/lib';

// ============================================================
// Session Expiration
// ============================================================

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

// ============================================================
// Session Creation
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
  // 30 days expiration
  const expiresAt = now + (30 * 24 * 60 * 60);

  return {
    userId,
    issuedAt: now,
    expiresAt,
    sessionId,
    version: 1,
  };
}

/**
 * ATOMIC: Creates a session and updates it with JWT token in a single transaction.
 *
 * CRITICAL FOR RACE CONDITION FIX:
 * This function prevents the race condition where:
 * 1. Session is created with tempToken
 * 2. JWT is signed
 * 3. Response sent to client (CLIENT RACE WINDOW)
 * 4. updateSessionToken() slowly replaces tempToken with JWT
 * 5. Client makes request with JWT but DB still has tempToken → 401!
 *
 * Solution: Use Prisma transaction to make steps 1 & 4 atomic.
 *
 * @param userId - User ID
 * @param token - JWT token to store
 * @param expiresAt - Session expiration timestamp
 * @param userAgent - Optional User-Agent header
 * @param ipAddress - Optional IP address
 * @returns Created session record with JWT token
 */
export async function createAndUpdateSession(
  userId: string,
  token: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string
) {
  try {
    // Use Prisma transaction to ensure atomicity
    // Session is created with JWT token in a single database transaction
    // Middleware will find the session because JWT is persisted before response sent
    const session = await prisma.$transaction(async (tx) => {
      return tx.session.create({
        data: {
          userId,
          sessionToken: token,  // Store JWT token directly (no temp token)
          expiresAt,
          userAgent: userAgent || null,
          ipAddress: ipAddress || null,
          isValid: true,
        },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
        },
      });
    });

    console.log('[Auth] ✓ Session created with JWT token (atomic transaction)');
    return session;
  } catch (error) {
    console.error('[Auth] ✗ Failed to create session atomically:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new Error('Failed to create session');
  }
}

/**
 * Creates a new session in the database with a temporary placeholder token.
 *
 * Called after successful login or signup.
 * NOTE: Use createAndUpdateSession() instead for atomic creation + update.
 *
 * @param userId - User ID
 * @param sessionToken - Temporary placeholder token (will be replaced)
 * @param expiresAt - Session expiration timestamp
 * @param userAgent - Optional User-Agent header (for device tracking)
 * @param ipAddress - Optional IP address (for security)
 * @returns Created session record
 */
export async function createSession(
  userId: string,
  sessionToken: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string
) {
  try {
    const session = await prisma.session.create({
      data: {
        userId,
        sessionToken,
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        isValid: true,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });
    return session;
  } catch (error) {
    throw new Error('Failed to create session');
  }
}

// ============================================================
// Session Validation
// ============================================================

/**
 * Gets a session by token.
 *
 * Called during session validation to check if session still exists and is valid.
 *
 * CRITICAL: Checks both isValid flag and expiresAt timestamp.
 * If either check fails, session is considered invalid.
 *
 * @param sessionToken - JWT token
 * @returns Session record if found and valid, null otherwise
 */
export async function validateSession(sessionToken: string) {
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      select: {
        id: true,
        userId: true,
        isValid: true,
        expiresAt: true,
      },
    });

    if (!session) {
      return null;
    }

    // Check if session is still valid
    if (!session.isValid || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Gets a session by token (legacy name).
 *
 * @deprecated Use validateSession() instead
 */
export const getSessionByToken = validateSession;

/**
 * Invalidates a single session by token.
 *
 * Called during logout to revoke a specific session.
 *
 * @param sessionToken - JWT token to invalidate
 * @returns true if session was invalidated, false if not found
 */
export async function invalidateSession(sessionToken: string): Promise<boolean> {
  try {
    const result = await prisma.session.updateMany({
      where: { sessionToken },
      data: { isValid: false },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}

// ============================================================
// Session Token Update
// ============================================================

/**
 * Updates a session record with the JWT token.
 *
 * Called immediately after session creation during signup/login.
 * 
 * This function is extracted to a shared module to ensure
 * consistent behavior across all authentication flows and
 * to use static imports instead of dynamic imports (which
 * can cause issues with Prisma in Next.js).
 *
 * @param sessionId - ID of the session to update
 * @param token - JWT token to store
 * @returns void
 * @throws Error if session not found or database update fails
 */
export async function updateSessionToken(
  sessionId: string,
  token: string
): Promise<void> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { sessionToken: token },
    });
  } catch (error) {
    console.error('[Auth] Failed to update session token:', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
