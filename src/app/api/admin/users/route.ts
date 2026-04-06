/**
 * GET /api/admin/users - List Users
 * 
 * Lists all users in the system with role and status information.
 *
 * Query Parameters:
 * - page?: number (default: 1)
 * - limit?: number (default: 20, max: 100)
 * - role?: 'USER' | 'ADMIN' (filter by role)
 * - search?: string (search by email or name)
 * - isActive?: boolean (filter by active status)
 *
 * Response 200: List of users with pagination
 * Errors: 400 (validation), 403 (forbidden), 500 (server)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { ListUsersQuerySchema, parseQueryParams } from '@/features/admin/validation/schemas';
import type { PaginationMeta } from '@/features/admin/validation/schemas';

// ============================================================
// Types
// ============================================================

interface UserItem {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListUsersResponse {
  success: true;
  data: UserItem[];
  pagination: PaginationMeta;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
}

// ============================================================
// GET Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Parse and validate query parameters
    const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = parseQueryParams(ListUsersQuerySchema, queryObj);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'INVALID_PAGINATION',
          details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
            field,
            message: String(message),
          })),
        } as any,
        { status: 400 }
      );
    }

    const query = parseResult.data!;

    // 3. Build filter conditions
    const where: any = {};

    // Filter by role
    if (query.role) {
      where.role = query.role;
    }

    // Filter by active status
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Search in email and name
    if (query.search) {
      where.OR = [
        {
          email: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          firstName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // 4. Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // 5. Execute queries in parallel
    const [totalCount, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    // 6. Transform response
    const totalPages = Math.ceil(totalCount / query.limit);
    const data: UserItem[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data,
        pagination: {
          total: totalCount,
          page: query.page,
          limit: query.limit,
          totalPages,
          hasMore: query.page < totalPages,
        },
      } as ListUsersResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/users Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
