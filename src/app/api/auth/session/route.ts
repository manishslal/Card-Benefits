/**
 * GET /api/auth/session
 *
 * Retrieves current session information.
 *
 * Used by:
 * - React components to check if user is logged in
 * - Client-side session initialization
 * - Refresh session expiration info
 *
 * Security flow:
 * 1. Extract session cookie
 * 2. Verify JWT signature
 * 3. Check Session.isValid in database
 * 4. Return user info if valid, 401 if invalid/expired
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifySessionToken,
  isSessionExpired,
  getSecondsUntilExpiration,
  validateSession,
  getUserById,
} from '@/features/auth/lib/auth';

// ============================================================
// Type Definitions
// ============================================================

interface SessionResponse {
  authenticated: true;
  userId: string;
  email: string;
  expiresAt: string;
  expiresInSeconds: number;
}

interface SessionError {
  authenticated: false;
  error: string;
}

// ============================================================
// Main Handler
// ============================================================

/**
 * GET /api/auth/session handler
 *
 * @returns Session info if authenticated, 401 if not
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Get session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    // No session cookie
    if (!sessionCookie?.value) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Not authenticated',
        } as SessionError,
        { status: 401 }
      );
    }

    // Verify JWT signature
    let payload;
    try {
      payload = verifySessionToken(sessionCookie.value);
    } catch (error) {
      // Token is invalid or tampered
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Invalid session',
        } as SessionError,
        { status: 401 }
      );
    }

    // Check if token is expired
    if (isSessionExpired(payload)) {
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Session expired',
        } as SessionError,
        { status: 401 }
      );
    }

    // CRITICAL: Check Session.isValid in database
    // This allows us to revoke sessions by setting isValid=false
    const dbSession = await validateSession(sessionCookie.value);
    if (!dbSession) {
      // Session was revoked or doesn't exist
      return NextResponse.json(
        {
          authenticated: false,
          error: 'Session invalid',
        } as SessionError,
        { status: 401 }
      );
    }

    // Get user info
    const user = await getUserById(payload.userId);
    if (!user) {
      // User was deleted after session creation
      return NextResponse.json(
        {
          authenticated: false,
          error: 'User not found',
        } as SessionError,
        { status: 401 }
      );
    }

    // All checks passed - return session info
    const expiresAtDate = new Date(payload.expiresAt * 1000);
    const secondsUntilExpiration = getSecondsUntilExpiration(payload);

    return NextResponse.json(
      {
        authenticated: true,
        userId: payload.userId,
        email: user.email,
        expiresAt: expiresAtDate.toISOString(),
        expiresInSeconds: secondsUntilExpiration,
      } as SessionResponse,
      { status: 200 }
    );
  } catch (error) {
    // Log error for debugging
    if (error instanceof Error) {
      console.error('[Session Error]', error.message);
    }

    // Generic error response
    return NextResponse.json(
      {
        authenticated: false,
        error: 'Unable to retrieve session',
      } as SessionError,
      { status: 500 }
    );
  }
}
