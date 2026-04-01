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
} from '@/lib/auth-utils';
import {
  invalidateSession,
} from '@/lib/auth-server';

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
          error: 'Not authenticated',
        } as LogoutError,
        { status: 401 }
      );
    }

    // Verify token to ensure it's valid
    // (If token is malformed, invalidating it is still safe)
    try {
      verifySessionToken(sessionCookie.value);
    } catch {
      // Token is invalid/expired, but we'll still clear the cookie
      // This is normal for expired sessions trying to logout
    }

    // Invalidate session in database
    // This is critical - marks Session.isValid = false
    await invalidateSession(sessionCookie.value);

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
    // Log error for debugging
    if (error instanceof Error) {
      console.error('[Logout Error]', error.message);
    }

    // Even on error, clear the cookie
    const response = NextResponse.json(
      {
        success: false,
        error: 'Unable to log out. Please try again.',
      } as LogoutError,
      { status: 500 }
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
