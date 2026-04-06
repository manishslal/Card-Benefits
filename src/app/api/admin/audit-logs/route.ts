/**
 * GET /api/admin/audit-logs
 * 
 * @summary List audit logs with filtering and pagination
 * @rateLimit 150 requests per minute (per admin user)
 * @auth Required - Admin role
 * @pagination Supports pagination with max 100 items per page (default 50 for audit logs)
 *
 * Query Parameters:
 * - page?: number (default: 1) - Page number
 * - limit?: number (default: 50, max: 100) - Items per page
 * - actionType?: 'CREATE' | 'UPDATE' | 'DELETE' (optional) - Filter by action type
 * - resourceType?: 'CARD' | 'BENEFIT' | 'USER_ROLE' (optional) - Filter by resource type
 * - adminUserId?: string (optional) - Filter by admin who made the change
 * - resourceId?: string (optional) - Filter by specific resource ID
 * - startDate?: ISO 8601 datetime (optional) - Filter from date (inclusive)
 * - endDate?: ISO 8601 datetime (optional) - Filter to date (inclusive)
 * - search?: string (optional, max 255 chars) - Search in resource name and details
 *
 * Response 200: List of audit logs with full change tracking (old/new values) and pagination metadata
 * Response 400: Invalid query parameters (bad ISO date format, invalid action type, etc)
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { ListAuditLogsQuerySchema, parseQueryParams } from '@/features/admin/validation/schemas';
import type { PaginationMeta } from '@/features/admin/validation/schemas';

// ============================================================
// Types
// ============================================================

interface AuditLogItem {
  id: string;
  adminUserId: string;
  adminUser?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  actionType: string;
  resourceType: string;
  resourceId: string;
  resourceName: string | null;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

interface ListAuditLogsResponse {
  success: true;
  data: AuditLogItem[];
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
    const parseResult = parseQueryParams(ListAuditLogsQuerySchema, queryObj);

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

    if (query.actionType) {
      where.actionType = query.actionType;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.adminUserId) {
      where.adminUserId = query.adminUserId;
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    // Date range filtering
    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.timestamp.lte = new Date(query.endDate);
      }
    }

    // Search in resource name
    if (query.search) {
      where.resourceName = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    // 4. Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // 5. Execute queries in parallel
    const [totalCount, logs] = await Promise.all([
      prisma.adminAuditLog.count({ where }),
      prisma.adminAuditLog.findMany({
        where,
        select: {
          id: true,
          adminUserId: true,
          adminUser: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          actionType: true,
          resourceType: true,
          resourceId: true,
          resourceName: true,
          oldValues: true,
          newValues: true,
          ipAddress: true,
          userAgent: true,
          timestamp: true,
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    // 6. Transform response - parse JSON strings back to objects
    const totalPages = Math.ceil(totalCount / query.limit);
    const data: AuditLogItem[] = logs.map((log) => ({
      id: log.id,
      adminUserId: log.adminUserId,
      adminUser: log.adminUser,
      actionType: log.actionType,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      resourceName: log.resourceName,
      oldValues: log.oldValues ? JSON.parse(log.oldValues) : null,
      newValues: log.newValues ? JSON.parse(log.newValues) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp.toISOString(),
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
      } as ListAuditLogsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/audit-logs Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch audit logs',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
