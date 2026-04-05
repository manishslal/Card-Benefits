/**
 * POST /api/auth/logout
 *
 * Invalidates the current session and clears the session cookie.
 *
 * Security flow:
 * 1. Extract session cookie
 * 2. Verify and extract userId from token
 * 3. Mark session as invalid in database (soft revocation)
 * 4. Clear session cookie (Max-Age=0)
 * 5. Return success response
 *
 * CRITICAL: Session is invalidated in database, not just cookie-based.
 * Middleware checks Session.isValid on every request.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifySessionToken,
  invalidateSession,
} from '@/features/auth/lib/auth';
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
} from '@/shared/lib';

// ============================================================
// Type Definitions
// ============================================================

interface LogoutSuccess {
  success: true;
  message: string;
}

interface LogoutError {
  success: false;
  error: string;
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/auth/logout handler
 *
 * @returns NextResponse with cleared session cookie
 */
export async function POST(): Promise<NextResponse> {
  try {
    // Get session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES[ERROR_CODES.AUTH_MISSING].message,
        } as LogoutError,
        { status: ERROR_MESSAGES[ERROR_CODES.AUTH_MISSING].statusCode }
      );
    }

    // Verify token to ensure it's valid
    // (If token is malformed, invalidating it is still safe)
    try {
      verifySessionToken(sessionCookie.value);
    } catch (err) {
      // Token is invalid/expired, but we'll still clear the cookie
      // This is normal for expired sessions trying to logout
      if (err instanceof AppError) {
        console.debug('[Logout] Token verification failed (expected for expired sessions):', err.code);
      }
    }

    // Invalidate session in database
    // This is CRITICAL - marks Session.isValid = false
    // Must happen before any early returns
    try {
      await invalidateSession(sessionCookie.value);
    } catch (error) {
      // Even if invalidation fails, we must not return success
      // This ensures stolen tokens cannot be reused
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Logout] Failed to invalidate session:', errorMessage);
      
      // Return error response - never return success if invalidation fails
      const response = NextResponse.json(
        {
          success: false,
          error: 'Failed to complete logout. Please try again.',
        } as LogoutError,
        { status: 500 }
      );
      
      // Still clear client-side cookie even though server-side invalidation failed
      clearSessionCookie(response);
      return response;
    }

    // If we reach here, session was successfully invalidated
    // Create response with cleared session cookie
    const response = NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      } as LogoutSuccess,
      { status: 200 }
    );

    // Clear session cookie (Max-Age=0)
    clearSessionCookie(response);

    return response;
  } catch (error) {
    // Log error for debugging (should rarely happen now since we handle invalidation errors above)
    if (error instanceof Error) {
      console.error('[Logout] Unexpected error:', error.message);
    }

    // Generic error response
    const response = NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].message,
      } as LogoutError,
      { status: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].statusCode }
    );

    clearSessionCookie(response);
    return response;
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Clears the session cookie by setting Max-Age=0
 */
function clearSessionCookie(response: NextResponse): void {
  const cookieOptions = [
    'session=',
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];

  // Add Secure flag in production
  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  response.headers.set('Set-Cookie', cookieOptions.join('; '));
}
