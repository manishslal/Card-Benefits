/**
 * Authentication context using AsyncLocalStorage.
 *
 * This module provides a thread-local storage mechanism for storing the
 * authenticated userId during request processing. This allows server actions
 * and components to access the userId without passing it as a parameter.
 *
 * CRITICAL SECURITY: AsyncLocalStorage ensures userId is isolated per request
 * and cannot leak between concurrent requests.
 *
 * Usage:
 * - Middleware sets userId in the store
 * - Server actions read userId via getAuthUserId()
 * - React components get userId via useAuth() hook
 */

import { AsyncLocalStorage } from 'async_hooks';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Authentication context stored in AsyncLocalStorage
 */
export interface AuthContext {
  userId?: string;  // User ID from session token, undefined if not authenticated
  error?: string;   // Error message if authentication failed
}

// ============================================================
// AsyncLocalStorage Instance
// ============================================================

/**
 * Thread-local storage for authentication context.
 *
 * This is the core of request isolation in Next.js App Router:
 * - Each request gets its own storage instance
 * - Concurrent requests cannot see each other's data
 * - Server actions run within the same async context as middleware
 * - Values are automatically cleaned up when request completes
 *
 * CRITICAL: Do not create multiple instances or share between requests
 */
const authAsyncLocalStorage = new AsyncLocalStorage<AuthContext>();

// ============================================================
// Storage Setters (Called by Middleware)
// ============================================================

/**
 * Runs a callback within an authentication context.
 *
 * This is called by middleware to establish the userId for the current request.
 * All server actions and components called within this callback can access the userId.
 *
 * Usage (in middleware):
 * ```typescript
 * await authAsyncLocalStorage.run({ userId: 'user_123' }, async () => {
 *   // All async operations here have access to userId
 *   await serverAction();
 * });
 * ```
 *
 * @param context - AuthContext with userId or error
 * @param callback - Async function to run within context
 * @returns Promise resolving to callback result
 *
 * @internal Called only from middleware
 */
export async function runWithAuthContext<T>(
  context: AuthContext,
  callback: () => Promise<T>
): Promise<T> {
  return authAsyncLocalStorage.run(context, callback);
}

// ============================================================
// Storage Getters (Called by Server Actions/Components)
// ============================================================

/**
 * Gets the current authentication context.
 *
 * Returns the context set by middleware via runWithAuthContext().
 * Returns empty object if no context is set (unauthenticated request).
 *
 * Usage (in server action):
 * ```typescript
 * const context = getAuthContext();
 * const userId = context.userId;  // undefined if not authenticated
 * ```
 *
 * @returns Current AuthContext or empty object
 *
 * @internal Use getAuthUserId() instead for userId
 */
export function getAuthContext(): AuthContext {
  return authAsyncLocalStorage.getStore() ?? {};
}

/**
 * Gets the authenticated user ID from the current request context.
 *
 * Returns the userId set by middleware during request processing.
 * Returns undefined if:
 * - No session cookie present (unauthenticated)
 * - Session token is invalid or expired
 * - Middleware failed to verify token
 *
 * This is the primary function for checking authentication in server actions.
 *
 * Usage (in server action):
 * ```typescript
 * 'use server';
 *
 * export async function getPlayerCards(playerId: string) {
 *   const userId = getAuthUserId();
 *   if (!userId) {
 *     throw new Error('Not authenticated');
 *   }
 *   // userId is guaranteed to be non-null here
 *   const player = await db.player.findUnique({ where: { id: playerId } });
 *   if (player.userId !== userId) {
 *     throw new Error('Access denied');
 *   }
 *   return player.userCards;
 * }
 * ```
 *
 * @returns User ID string if authenticated, undefined otherwise
 */
export function getAuthUserId(): string | undefined {
  return getAuthContext().userId;
}

/**
 * Gets the authentication error from the current request context.
 *
 * Populated if middleware failed to authenticate the request.
 *
 * @returns Error message if authentication failed, undefined otherwise
 *
 * @internal Mostly for debugging and logging
 */
export function getAuthError(): string | undefined {
  return getAuthContext().error;
}

/**
 * Checks if the current request is authenticated.
 *
 * Convenience function for checking if userId is set.
 *
 * Usage:
 * ```typescript
 * if (!isAuthenticated()) {
 *   throw new Error('Not authenticated');
 * }
 * ```
 *
 * @returns true if userId is present
 */
export function isAuthenticated(): boolean {
  return Boolean(getAuthUserId());
}

/**
 * Gets the authenticated user ID from the current request context.
 * Alias for getAuthUserId() for use in React hooks.
 *
 * @returns User ID string if authenticated, undefined otherwise
 */
export function useAuthUserId(): string | undefined {
  return getAuthUserId();
}
