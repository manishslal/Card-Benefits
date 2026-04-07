/**
 * PATCH /api/admin/users/[userId] - Update User Profile
 *
 * Updates user profile information including name, email, status, and role.
 * Enforces email uniqueness and validates all input fields.
 *
 * Request Body:
 * {
 *   "firstName": string | null (optional, max 50 chars)
 *   "lastName": string | null (optional, max 50 chars)
 *   "email": string (required, must be unique, valid email format)
 *   "isActive": boolean (required)
 *   "role": 'USER' | 'ADMIN' | 'SUPER_ADMIN' (required)
 * }
 *
 * Response 200: User updated successfully
 * Response 400: Validation error
 * Response 401: Not authenticated
 * Response 403: Not admin role
 * Response 404: User not found
 * Response 409: Email already exists
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, extractRequestContext, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { logResourceUpdate } from '@/features/admin/lib/audit';

// ============================================================
// Validation Schema
// ============================================================

const UpdateUserSchema = z.object({
  firstName: z
    .string()
    .max(50, 'First name must be 50 characters or less')
    .nullable()
    .optional(),
  lastName: z
    .string()
    .max(50, 'Last name must be 50 characters or less')
    .nullable()
    .optional(),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less'),
  isActive: z.boolean(),
  role: z
    .enum(['USER', 'ADMIN', 'SUPER_ADMIN'])
    .refine((val) => ['USER', 'ADMIN', 'SUPER_ADMIN'].includes(val), {
      message: 'Role must be USER, ADMIN, or SUPER_ADMIN',
    }),
});

type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// ============================================================
// Types
// ============================================================

interface UpdateUserResponse {
  success: true;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
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
// Helper: Parse and validate request body
// ============================================================

function parseUpdateUserRequest(data: unknown): { success: boolean; data?: UpdateUserInput; errors?: Record<string, string> } {
  try {
    const parsed = UpdateUserSchema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((issue) => {
        const field = issue.path.join('.');
        errors[field] = issue.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { general: 'Invalid request body' } };
  }
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
      adminContext = await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Parse and validate request body
    const bodyData = await request.json();
    const parseResult = parseUpdateUserRequest(bodyData);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
            field,
            message,
          })),
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const { firstName, lastName, email, isActive, role } = parseResult.data!;

    // 4. Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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

    // 5. Check email uniqueness: if email is changing, ensure new email doesn't exist
    if (email.toLowerCase() !== targetUser.email.toLowerCase()) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: 'Email already exists',
            code: 'EMAIL_DUPLICATE',
          } as ErrorResponse,
          { status: 409 }
        );
      }
    }

    // 6. Update user
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email.toLowerCase(),
        isActive,
        role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 7. Log user update
    await logResourceUpdate(
      adminContext,
      'USER_ROLE',
      updatedUser.id,
      updatedUser.email,
      {
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        email: targetUser.email,
        isActive: targetUser.isActive,
        role: targetUser.role,
      },
      {
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        isActive: updatedUser.isActive,
        role: updatedUser.role,
      },
      ipAddress,
      userAgent
    );

    return NextResponse.json(
      {
        success: true,
        user: {
          ...updatedUser,
          createdAt: updatedUser.createdAt.toISOString(),
          updatedAt: updatedUser.updatedAt.toISOString(),
        },
        message: 'User updated successfully',
      } as UpdateUserResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/users/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
