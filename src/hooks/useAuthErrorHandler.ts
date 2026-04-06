'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook: useAuthErrorHandler
 * 
 * Provides client-side catch for 401 (Unauthorized) errors that may slip
 * past middleware (e.g., API calls that fail due to session expiration).
 * 
 * This is a FALLBACK layer - most session expirations are caught by middleware
 * and redirected to /login?expired=true. This hook handles edge cases where:
 * - An API endpoint returns 401 (session expired mid-request)
 * - Middleware redirect somehow fails
 * - Token expires between page load and API call
 * 
 * USAGE in a client component:
 * ```typescript
 * 'use client';
 * import { useAuthErrorHandler } from '@/hooks/useAuthErrorHandler';
 * 
 * export default function AdminPage() {
 *   useAuthErrorHandler();  // Catches any 401 errors from fetch calls
 *   // ... rest of component
 * }
 * ```
 * 
 * SECURITY: 
 * - Clears session cookie to prevent stale token usage
 * - Redirects to login page (not error page)
 * - Shows minimal info to user (no error details)
 */
export function useAuthErrorHandler() {
  const router = useRouter();

  useEffect(() => {
    // Store original fetch to restore later if needed
    const originalFetch = window.fetch;

    // Intercept all fetch calls to catch 401 errors
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      // Check if response is 401 Unauthorized
      if (response.status === 401) {
        console.warn('[Auth Error Handler] Caught 401 Unauthorized - clearing session and redirecting', {
          url: args[0],
          method: (args[1] as any)?.method || 'GET',
        });

        // Clear session cookie to prevent stale token usage
        document.cookie = 'session=; Max-Age=0; path=/; SameSite=Strict';

        // Redirect to login with expired flag
        // Use setTimeout to ensure cookie deletion happens first
        setTimeout(() => {
          router.push('/login?expired=true');
        }, 100);
      }

      return response;
    };

    // Cleanup: restore original fetch on unmount
    return () => {
      window.fetch = originalFetch;
    };
  }, [router]);
}
