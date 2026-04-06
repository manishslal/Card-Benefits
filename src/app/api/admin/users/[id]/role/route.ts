/**
 * PATCH /api/admin/users/[userId]/role - Assign or Update User Role
 *
 * Assigns or updates a user's role (USER or ADMIN).
 * Prevents self-demotion (cannot remove own admin role).
 *
 * Request Body:
 * {
 *   "role": 'USER' | 'ADMIN' (required)
 * }
 *
 * Response 200: Role updated successfully
 * Response 400: Validation error
 * Response 403: Forbidden (self-demotion or other auth issue)
 * Response 404: User not found
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, extractRequestContext, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { AssignRoleSchema, parseRequestBody } from '@/features/admin/validation/schemas';
import { logResourceUpdate } from '@/features/admin/lib/audit';

// ============================================================
// Types
// ============================================================

interface UserRoleResponse {
  success: true;
  data: {
    id: string;
    email: string;
    role: string;
  };
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
}

// ============================================================
// PATCH Handler
// ============================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role and get admin context
    let adminContext;
    try {
      adminContext = await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Parse and validate request body
    const parseResult = parseRequestBody(AssignRoleSchema, await request.json());

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
            field,
            message: String(message),
          })),
        } as any,
        { status: 400 }
      );
    }

    const { role } = parseResult.data!;

    // 4. Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 5. Prevent self-demotion: check if admin is trying to remove their own admin role
    if (adminContext.userId === params.id && role === 'USER' && targetUser.role === 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot remove your own admin role',
          code: 'SELF_DEMOTION_FORBIDDEN',
        } as ErrorResponse,
        { status: 403 }
      );
    }

    // 6. Update user role if it actually changes
    if (targetUser.role === role) {
      // No change needed
      return NextResponse.json(
        {
          success: true,
          data: {
            id: targetUser.id,
            email: targetUser.email,
            role: targetUser.role,
          },
          message: `User role is already set to ${role}`,
        } as UserRoleResponse,
        { status: 200 }
      );
    }

    // 7. Update the role
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { role },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    // 8. Log role change
    await logResourceUpdate(
      adminContext,
      'USER_ROLE',
      updatedUser.id,
      updatedUser.email,
      { role: targetUser.role },
      { role: updatedUser.role },
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedUser,
        message: `User role updated to ${role}`,
      } as UserRoleResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/users/[id]/role Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user role',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
