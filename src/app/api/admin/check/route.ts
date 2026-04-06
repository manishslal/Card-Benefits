/**
 * ADMIN CHECK ENDPOINT
 *
 * GET /api/admin/check
 *
 * Health check endpoint that verifies if the current user has admin privileges.
 * Used by admin UI to verify access without returning sensitive context data.
 *
 * SECURITY:
 * - Requires valid authentication (middleware checks)
 * - Returns only boolean admin status
 * - No user details leaked in response
 * - Database check (not JWT-based) ensures revocation is immediate
 *
 * RESPONSE:
 * - 200 + { isAdmin: true } if user is admin
 * - 403 + { isAdmin: false } if user is not admin
 * - 401 if user is not authenticated
 */

import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import {
  checkAdminStatus,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const userId = getAuthUserId();

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    // Check if user is admin
    const result = await checkAdminStatus(userId, false);

    if (!result.isAdmin) {
      return NextResponse.json(forbiddenResponse(), { status: 403 });
    }

    // Return admin status
    return NextResponse.json(
      {
        success: true,
        isAdmin: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin Check] Error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Server error',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
