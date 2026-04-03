/**
 * Server-side authentication utilities.
 *
 * This module provides functions for:
 * - Getting authenticated user ID from request context
 * - Verifying ownership of resources (players, cards, benefits)
 * - Ownership boundary enforcement
 *
 * All functions assume they are called from within a server action
 * or API route where the userId is available via AsyncLocalStorage.
 */

import { getAuthUserId } from './auth-context';
import { prisma } from './prisma';
import { AppError, ERROR_CODES } from './errors';

// ============================================================
// Error Code Constants
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

// ============================================================
// Type Definitions
// ============================================================

/**
 * Result of an ownership verification check
 */
export interface OwnershipCheckResult {
  isOwner: boolean;
  error?: string;
}

// ============================================================
// Authentication Enforcement
// ============================================================

/**
 * Gets the authenticated user ID and throws if not authenticated.
 *
 * Use this at the start of protected server actions to enforce authentication.
 *
 * Usage:
 * ```typescript
 * 'use server';
 *
 * export async function getPlayerCards(playerId: string) {
 *   const userId = getAuthUserIdOrThrow();  // Throws if not authenticated
 *   // userId is guaranteed to be non-null here
 *   const player = await verifyPlayerOwnership(playerId, userId);
 *   ...
 * }
 * ```
 *
 * @returns Authenticated user ID (non-null)
 * @throws {AppError} With code AUTH_MISSING if no user ID in context
 */
export function getAuthUserIdOrThrow(): string {
  const userId = getAuthUserId();
  if (!userId) {
    throw new AppError(ERROR_CODES.AUTH_MISSING);
  }
  return userId;
}

// ============================================================
// Ownership Verification (Database Queries)
// ============================================================

/**
 * Verifies that the given user owns the specified player.
 *
 * Checks: Player.userId === userId
 *
 * Usage:
 * ```typescript
 * const userId = getAuthUserIdOrThrow();
 * const player = await verifyPlayerOwnership(playerId, userId);
 * if (!player.isOwner) {
 *   throw new Error('You do not own this player');
 * }
 * ```
 *
 * @param playerId - ID of player to check
 * @param userId - ID of user claiming ownership
 * @returns OwnershipCheckResult with isOwner flag
 */
export async function verifyPlayerOwnership(
  playerId: string,
  userId: string
): Promise<OwnershipCheckResult> {
  try {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { userId: true },
    });

    if (!player) {
      return {
        isOwner: false,
        error: 'Player not found',
      };
    }

    if (player.userId !== userId) {
      return {
        isOwner: false,
        error: 'You do not have permission to modify this player',
      };
    }

    return { isOwner: true };
  } catch (error) {
    return {
      isOwner: false,
      error: 'Failed to verify ownership',
    };
  }
}

/**
 * Verifies that the given user owns the card (via player ownership).
 *
 * Checks: UserCard.player.userId === userId
 *
 * @param cardId - ID of card to check
 * @param userId - ID of user claiming ownership
 * @returns OwnershipCheckResult with isOwner flag
 */
export async function verifyCardOwnership(
  cardId: string,
  userId: string
): Promise<OwnershipCheckResult> {
  try {
    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      select: { player: { select: { userId: true } } },
    });

    if (!card) {
      return {
        isOwner: false,
        error: 'Card not found',
      };
    }

    if (card.player.userId !== userId) {
      return {
        isOwner: false,
        error: 'You do not have permission to modify this card',
      };
    }

    return { isOwner: true };
  } catch (error) {
    return {
      isOwner: false,
      error: 'Failed to verify ownership',
    };
  }
}

/**
 * Verifies that the given user owns the benefit (via player ownership).
 *
 * Checks: UserBenefit.player.userId === userId
 *
 * @param benefitId - ID of benefit to check
 * @param userId - ID of user claiming ownership
 * @returns OwnershipCheckResult with isOwner flag
 */
export async function verifyBenefitOwnership(
  benefitId: string,
  userId: string
): Promise<OwnershipCheckResult> {
  try {
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      select: { player: { select: { userId: true } } },
    });

    if (!benefit) {
      return {
        isOwner: false,
        error: 'Benefit not found',
      };
    }

    if (benefit.player.userId !== userId) {
      return {
        isOwner: false,
        error: 'You do not have permission to modify this benefit',
      };
    }

    return { isOwner: true };
  } catch (error) {
    return {
      isOwner: false,
      error: 'Failed to verify ownership',
    };
  }
}

/**
 * Checks if a user exists in the database.
 *
 * Used to verify that the session user still exists after loading a session.
 *
 * @param userId - User ID to check
 * @returns true if user exists, false otherwise
 */
export async function userExists(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return Boolean(user);
  } catch {
    return false;
  }
}

/**
 * Fetches user by email.
 *
 * Used during login to find the user for password verification.
 *
 * @param email - User email to look up
 * @returns User with password hash, or null if not found
 */
export async function getUserByEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}

/**
 * Fetches user by ID.
 *
 * Used to get user information after authentication.
 *
 * @param userId - User ID to fetch
 * @returns User with email and profile, or null if not found
 */
export async function getUserById(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}

/**
 * Marks all sessions for a user as invalid.
 *
 * Called during logout to revoke all active sessions.
 * CRITICAL SECURITY: This is checked by middleware on every request.
 *
 * @param userId - User ID to invalidate sessions for
 * @returns Number of sessions invalidated
 */
export async function invalidateUserSessions(userId: string): Promise<number> {
  try {
    const result = await prisma.session.updateMany({
      where: { userId },
      data: { isValid: false },
    });
    return result.count;
  } catch {
    return 0;
  }
}

/**
 * Gets all valid sessions for a user.
 *
 * Used to check if user has any active sessions.
 *
 * @param userId - User ID
 * @returns Array of session records
 */
export async function getUserSessions(userId: string) {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        isValid: true,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        userAgent: true,
        ipAddress: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return sessions;
  } catch {
    return [];
  }
}

/**
 * Creates a new user during signup.
 *
 * Also creates a default 'Primary' player.
 *
 * @param email - User email (will be normalized to lowercase)
 * @param passwordHash - Argon2id hash of password
 * @param firstName - Optional first name
 * @param lastName - Optional last name
 * @returns Created user with ID
 * @throws {Error} If email already exists (P2002)
 */
export async function createUser(
  email: string,
  passwordHash: string,
  firstName?: string,
  lastName?: string
) {
  try {
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        players: {
          create: {
            playerName: 'Primary',
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    return user;
  } catch (error: any) {
    // Prisma unique constraint error
    if (error.code === 'P2002') {
      throw new Error('Email already registered');
    }
    throw error;
  }
}

/**
 * Creates a new session in the database.
 *
 * Called after successful login or signup.
 *
 * @param userId - User ID
 * @param sessionToken - JWT token (or opaque token)
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
export async function getSessionByToken(sessionToken: string) {
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
// Card Operation Authorization
// ============================================================

/**
 * Authorize a card operation for the current user
 *
 * Checks:
 * 1. User is authenticated
 * 2. User owns the player who owns the card
 * 3. For EDIT/DELETE: User has appropriate role (OWNER or EDITOR if own card)
 *
 * @param userId - ID of the user performing the operation
 * @param card - The card object (must include player relation)
 * @param operation - Type of operation: READ, EDIT, DELETE, ARCHIVE
 * @returns true if authorized, false otherwise
 */
export async function authorizeCardOperation(
  userId: string,
  card: any, // UserCard with player relation
  operation: 'READ' | 'EDIT' | 'DELETE' | 'ARCHIVE' | 'BULK_EDIT'
): Promise<boolean> {
  try {
    // Get user's player ownership
    const playerOwnership = await verifyPlayerOwnership(card.playerId, userId);
    
    // All authenticated users can read cards they own
    if (operation === 'READ') {
      return playerOwnership.isOwner;
    }

    // For edit/delete operations, require ownership of the player
    // (In a multi-user household, only the owner/admin can edit)
    return playerOwnership.isOwner;
  } catch (error) {
    console.error('[authorizeCardOperation] Error:', error);
    return false;
  }
}
