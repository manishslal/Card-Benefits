/**
 * useAuth React Hook
 *
 * Client-side hook for accessing current authentication state.
 *
 * Features:
 * - Fetches session info from /api/auth/session
 * - Caches session state in component state
 * - Auto-refreshes session on mount
 * - Provides helper methods: logout, isAuthenticated, etc.
 *
 * Usage:
 * ```typescript
 * 'use client';
 *
 * import { useAuth } from '@/shared/hooks/useAuth';
 *
 * export function MyComponent() {
 *   const { user, isAuthenticated, logout, isLoading } = useAuth();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!isAuthenticated) return <div>Please log in</div>;
 *
 *   return (
 *     <div>
 *       Welcome, {user?.email}!
 *       <button onClick={() => logout()}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Session information returned from /api/auth/session
 */
export interface SessionInfo {
  userId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

/**
 * useAuth hook state
 */
export interface UseAuthState {
  user: SessionInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * useAuth hook return value
 */
export interface UseAuthReturn extends UseAuthState {
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================
// Hook Implementation
// ============================================================

/**
 * React hook for authentication state management
 *
 * Fetches and maintains current session state from the server.
 *
 * IMPORTANT: Must be used in a client component ('use client').
 * Do not use in server components or server actions.
 *
 * @returns UseAuthReturn with user, isAuthenticated, etc.
 */
export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches current session from server
   */
  const fetchSession = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Unauthenticated or session expired
        setUser(null);
        return;
      }

      const data = await response.json();
      if (data.authenticated) {
        setUser({
          userId: data.userId,
          email: data.email,
          expiresAt: data.expiresAt,
          expiresInSeconds: data.expiresInSeconds,
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch session';
      setError(errorMessage);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logs out the current user
   */
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setUser(null);
        setError(null);
        // Redirect to login page
        window.location.href = '/login';
      } else {
        setError('Failed to logout');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to logout';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Manually refresh session state
   */
  const refresh = useCallback(async () => {
    await fetchSession();
  }, [fetchSession]);

  // Fetch session on mount
  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    error,
    logout,
    refresh,
  };
}

/**
 * Hook to get just the userId from auth state
 *
 * Convenience hook for checking if user is authenticated.
 *
 * @returns User ID if authenticated, null otherwise
 */
export function useUserId(): string | null {
  const { user } = useAuth();
  return user?.userId || null;
}

/**
 * Hook to check if user is authenticated
 *
 * Convenience hook for checking authentication status.
 *
 * @returns true if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}
