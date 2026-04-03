/**
 * POST /api/auth/verify
 *
 * Verifies session token validity for middleware.
 *
 * This endpoint is called by middleware to validate session tokens.
 * It runs in Node.js runtime (not edge runtime), so it can use crypto libraries.
 *
 * CRITICAL: This endpoint is called from middleware and must:
 * 1. Not require authentication (middleware calls it)
 * 2. Verify JWT signature using Node.js crypto
 * 3. Check database for session validity
 * 4. Return user ID if valid, 401 if invalid
 *
 * Flow:
 * 1. Extract token from body
 * 2. Verify JWT signature (HS256)
 * 3. Check Session.isValid in database
 * 4. Verify user still exists
 * 5. Return userId on success, 401 on failure
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  isSessionExpired,
} from '@/lib/auth-utils';
import {
  getSessionByToken,
  userExists,
} from '@/lib/auth-server';

// ============================================================
// Type Definitions
// ============================================================

interface VerifyRequest {
  token?: string;
}

interface VerifySuccess {
  valid: true;
  userId: string;
}

interface VerifyError {
  valid: false;
  error: string;
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/auth/verify handler
 *
 * Called by middleware to verify session tokens.
 * Runs in Node.js runtime so can use crypto libraries.
 *
 * @param request - NextRequest with JSON body containing token
 * @returns VerifySuccess if token is valid, VerifyError if not
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({})) as VerifyRequest;

    if (!body.token) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Token is required',
        } as VerifyError,
        { status: 401 }
      );
    }

    // Step 1: Verify JWT signature
    let payload;
    try {
      payload = verifySessionToken(body.token);
    } catch (error) {
      // Token is invalid, expired, or tampered
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid or expired session',
        } as VerifyError,
        { status: 401 }
      );
    }

    // Step 2: Check if token is expired
    if (isSessionExpired(payload)) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Session expired',
        } as VerifyError,
        { status: 401 }
      );
    }

    // Step 3: Check if session is valid in database
    const dbSession = await getSessionByToken(body.token);
    if (!dbSession) {
      // Session was revoked or doesn't exist
      return NextResponse.json(
        {
          valid: false,
          error: 'Session not found',
        } as VerifyError,
        { status: 401 }
      );
    }

    // Step 4: Verify user still exists
    const userValid = await userExists(payload.userId);
    if (!userValid) {
      // User was deleted after session creation
      return NextResponse.json(
        {
          valid: false,
          error: 'User not found',
        } as VerifyError,
        { status: 401 }
      );
    }

    // All checks passed - return success with userId
    return NextResponse.json(
      {
        valid: true,
        userId: payload.userId,
      } as VerifySuccess,
      { status: 200 }
    );
  } catch (error) {
    // Log error for debugging
    if (error instanceof Error) {
      console.error('[Auth Verify Error]', error.message);
    }

    // Generic error response
    return NextResponse.json(
      {
        valid: false,
        error: 'Unable to verify session',
      } as VerifyError,
      { status: 500 }
    );
  }
}
