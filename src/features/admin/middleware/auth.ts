/**
 * Admin authorization middleware and helpers.
 *
 * This module provides:
 * - Admin role enforcement
 * - Request context extraction (user info, IP, user agent)
 * - Authorization checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { getAuthUserId } from '@/features/auth/lib/auth';

// ============================================================
// Types
// ============================================================

export interface AdminRequestContext {
  userId: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
  ipAddress: string | null;
  userAgent: string | null;
}

// ============================================================
// Admin Authorization
// ============================================================

/**
 * Verifies that the user has admin role.
 * 
 * This function should be called in protected admin endpoints to enforce RBAC.
 * It throws if the user is not authenticated or doesn't have admin role.
 * 
 * @returns Admin user context
 * @throws Error if not authenticated or not admin
 */
export async function verifyAdminRole(): Promise<AdminRequestContext> {
  // Get authenticated user ID from context
  const userId = getAuthUserId();
  if (!userId) {
    throw new Error('NOT_AUTHENTICATED');
  }

  // Fetch user and check role
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (user.role !== 'ADMIN') {
    throw new Error('ADMIN_ROLE_REQUIRED');
  }

  return {
    userId,
    user,
    ipAddress: null,
    userAgent: null,
  };
}

/**
 * Extracts request context including IP and user agent
 * Truncates user-agent to 500 chars to prevent unbounded storage
 */
export function extractRequestContext(request: NextRequest): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  // Try to get IP from various headers (for proxies)
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;

  // Get user agent and truncate to prevent DoS
  let userAgent = request.headers.get('user-agent') || null;
  if (userAgent && userAgent.length > 500) {
    userAgent = userAgent.substring(0, 500);
  }

  return { ipAddress, userAgent };
}

/**
 * Creates error response for authorization failures
 */
export function createAuthErrorResponse(code: string) {
  const errorMap: Record<string, { status: number; message: string; code: string }> = {
    NOT_AUTHENTICATED: {
      status: 401,
      message: 'Not authenticated',
      code: 'AUTH_UNAUTHORIZED',
    },
    ADMIN_ROLE_REQUIRED: {
      status: 403,
      message: 'Admin access required',
      code: 'FORBIDDEN_ADMIN_REQUIRED',
    },
    USER_NOT_FOUND: {
      status: 401,
      message: 'User not found',
      code: 'AUTH_UNAUTHORIZED',
    },
  };

  const error = errorMap[code] || {
    status: 500,
    message: 'Authorization failed',
    code: 'AUTH_ERROR',
  };

  return NextResponse.json(
    {
      success: false,
      error: error.message,
      code: error.code,
    },
    { status: error.status }
  );
}

// ============================================================
// Request Helpers
// ============================================================

/**
 * Extracts and parses query parameters from request
 */
export function getQueryParams(
  request: NextRequest,
  paramNames: string[]
): Record<string, string | null> {
  const params: Record<string, string | null> = {};
  for (const name of paramNames) {
    params[name] = request.nextUrl.searchParams.get(name);
  }
  return params;
}

/**
 * Gets admin context and request info safely.
 * Returns null if auth fails instead of throwing.
 */
export async function tryGetAdminContext(
  request: NextRequest
): Promise<AdminRequestContext & { ipAddress: string | null; userAgent: string | null } | null> {
  try {
    const adminContext = await verifyAdminRole();
    const requestContext = extractRequestContext(request);
    return {
      ...adminContext,
      ...requestContext,
    };
  } catch {
    return null;
  }
}
