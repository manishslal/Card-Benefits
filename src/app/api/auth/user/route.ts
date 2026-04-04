/**
 * GET /api/auth/user
 *
 * Fetches the current authenticated user's profile information.
 * 
 * Response includes:
 * - userId: User's unique identifier
 * - email: User's email address
 * - firstName: User's first name
 * - lastName: User's last name
 *
 * Authentication:
 * - Requires valid session cookie
 * - Will return 401 if not authenticated
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface UserResponse {
  success: true;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
}

/**
 * GET /api/auth/user handler
 * 
 * @param request - NextRequest with authenticated user context
 * @returns NextResponse with user profile or error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user ID from middleware-set request header
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Fetch user from database
    // Only include non-sensitive fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      // User was authenticated but no longer exists in database
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        user,
      } as UserResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Get User Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user profile',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
