/**
 * ADMIN CONTEXT ENDPOINT
 *
 * GET /api/admin/context
 *
 * Returns detailed information about the current admin user's context.
 * Used by admin UI to populate user information and verify admin permissions.
 *
 * SECURITY:
 * - Requires valid authentication (middleware checks)
 * - Requires admin role (checked by this route)
 * - Returns full admin context (email, name, role)
 * - Database check (not JWT-based) ensures revocation is immediate
 *
 * RESPONSE:
 * - 200 + { success: true, data: AdminContext } if user is admin
 * - 403 + { error: 'Admin access required' } if user is not admin
 * - 401 if user is not authenticated
 *
 * AdminContext includes:
 * - userId: User's unique ID
 * - userEmail: User's email address
 * - userName: User's display name
 * - role: User's role (ADMIN)
 * - isActive: Whether user account is active
 */

import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import {
  checkAdminStatus,
  unauthorizedResponse,
  forbiddenResponse,
  buildSuccessResponse,
} from '@/lib/admin-auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const userId = getAuthUserId();

    // Check if user is authenticated
    if (!userId) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    // Check if user is admin and get full context
    const result = await checkAdminStatus(userId, true);

    if (!result.isAdmin || !result.context) {
      return NextResponse.json(forbiddenResponse(), { status: 403 });
    }

    // Return admin context
    return NextResponse.json(
      buildSuccessResponse(result.context),
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin Context] Error:', {
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
