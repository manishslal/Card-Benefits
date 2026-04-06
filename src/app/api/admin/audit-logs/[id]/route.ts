/**
 * GET /api/admin/audit-logs/[id] - Get Audit Log Detail
 *
 * Retrieves detailed information about a specific audit log entry.
 *
 * Response 200: Audit log detail
 * Errors: 404 (not found), 403 (forbidden), 500 (server)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse } from '@/features/admin/middleware/auth';

// ============================================================
// Types
// ============================================================

interface AuditLogDetail {
  id: string;
  adminUserId: string;
  adminUser: {
    id: string;
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

interface AuditLogDetailResponse {
  success: true;
  data: AuditLogDetail;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ============================================================
// GET Handler
// ============================================================

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole(_request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Fetch audit log entry
    const log = await prisma.adminAuditLog.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        adminUserId: true,
        adminUser: {
          select: {
            id: true,
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
    });

    if (!log) {
      return NextResponse.json(
        {
          success: false,
          error: 'Audit log entry not found',
          code: 'AUDIT_LOG_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 3. Parse JSON strings back to objects with error handling
    let oldValues: any = null;
    let newValues: any = null;

    try {
      if (log.oldValues) {
        oldValues = JSON.parse(log.oldValues);
      }
      if (log.newValues) {
        newValues = JSON.parse(log.newValues);
      }
    } catch (parseError) {
      console.error('[JSON Parse Error in Audit Log]', parseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Audit log contains invalid JSON data',
          code: 'INVALID_AUDIT_DATA',
        } as ErrorResponse,
        { status: 500 }
      );
    }

    const data: AuditLogDetail = {
      id: log.id,
      adminUserId: log.adminUserId,
      adminUser: log.adminUser,
      actionType: log.actionType,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      resourceName: log.resourceName,
      oldValues,
      newValues,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp.toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        data,
      } as AuditLogDetailResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/audit-logs/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch audit log',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
