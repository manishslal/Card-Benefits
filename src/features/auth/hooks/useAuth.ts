/**
 * React hook for authentication context access.
 *
 * This hook provides a convenient way to access the authenticated user's ID
 * and check authentication status in React components running on the server side.
 *
 * Usage:
 * ```typescript
 * 'use server';
 *
 * import { useAuth } from '@/features/auth/hooks/useAuth';
 *
 * export async function MyComponent() {
 *   const { userId, isAuthenticated } = useAuth();
 *   
 *   if (!isAuthenticated) {
 *     return <div>Please log in</div>;
 *   }
 *   
 *   return <div>Welcome, {userId}!</div>;
 * }
 * ```
 */

import { useAuthUserId } from '../context/auth-context';

/**
 * Hook to access authentication context.
 *
 * @returns Object with userId (or undefined) and isAuthenticated boolean
 */
export function useAuth() {
  const userId = useAuthUserId();
  const isAuthenticated = !!userId;

  return {
    userId,
    isAuthenticated,
  };
}
