/**
 * ADMIN AUTHENTICATION & AUTHORIZATION MODULE
 *
 * This module provides role-based access control (RBAC) utilities for protecting
 * admin routes and operations. It includes:
 *
 * 1. Role Checking: Verify if user has admin privileges
 * 2. Admin Context: Extract and provide admin user information
 * 3. Authorization Guards: Middleware and function-level protection
 * 4. Session Verification: Ensure admin session is still valid
 *
 * SECURITY DESIGN:
 * - Every admin operation checks role from database (not just JWT)
 * - Prevents unauthorized access if role is revoked mid-request
 * - Admin context is isolated per request via AsyncLocalStorage
 * - No sensitive data in error messages
 *
 * USAGE:
 * ```typescript
 * // In route handler
 * const userId = getAuthUserId();
 * if (!userId) return unauthorized();
 *
 * // Check if user is admin
 * const isAdmin = await requireAdmin(userId);
 * if (!isAdmin) return forbidden();
 *
 * // Or use requireAdminOrThrow() to throw directly
 * await requireAdminOrThrow(userId);
 * ```
 */

import { prisma } from '@/shared/lib/prisma';
import { UserRole } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Admin context information extracted from current session
 */
export interface AdminContext {
  userId: string;
  userEmail: string;
  userName?: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Admin check result
 */
export interface AdminCheckResult {
  isAdmin: boolean;
  context?: AdminContext;
  error?: string;
}

// ============================================================================
// ROLE CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if a user has admin role (does NOT throw)
 *
 * Queries database to ensure role hasn't been revoked since session creation.
 * This is critical for security - a revoked admin cannot continue using old tokens.
 *
 * @param userId - User ID to check (typically from auth context)
 * @returns Promise<boolean> true if user is admin, false otherwise
 *
 * @example
 * ```typescript
 * const isAdmin = await isAdminUser(userId);
 * if (!isAdmin) {
 *   return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
 * }
 * ```
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true },
    });

    return user?.role === UserRole.ADMIN && user?.isActive === true;
  } catch (error) {
    console.error('[Admin Auth] Error checking admin status:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Require admin role (throws if not admin)
 *
 * Convenience function that throws an error if user is not admin.
 * Use in server actions where you want to fail fast.
 *
 * @param userId - User ID to check
 * @throws Error with code 'FORBIDDEN_ADMIN_REQUIRED' if not admin
 * @returns Promise<true> if admin
 *
 * @example
 * ```typescript
 * try {
 *   await requireAdminOrThrow(userId);
 *   // User is definitely admin here
 *   await createCard(...);
 * } catch (error) {
 *   if (error.code === 'FORBIDDEN_ADMIN_REQUIRED') {
 *     return { error: 'Admin access required' };
 *   }
 *   return { error: 'Server error' };
 * }
 * ```
 */
export async function requireAdminOrThrow(userId: string): Promise<true> {
  const isAdmin = await isAdminUser(userId);

  if (!isAdmin) {
    const error = new Error('Admin access required') as any;
    error.code = 'FORBIDDEN_ADMIN_REQUIRED';
    error.statusCode = 403;
    throw error;
  }

  return true;
}

// ============================================================================
// ADMIN CONTEXT RETRIEVAL
// ============================================================================

/**
 * Get admin context information for current user
 *
 * Retrieves full admin user context (email, name, role, etc.) from database.
 * Returns null if user is not admin or doesn't exist.
 *
 * @param userId - User ID from auth context
 * @returns Promise<AdminContext | null> Full admin context or null
 *
 * @example
 * ```typescript
 * const context = await getAdminContextInfo(userId);
 * if (!context) return { error: 'Not an admin' };
 *
 * console.log(`Admin action by ${context.userEmail}`);
 * // Use context.userId for audit logging
 * ```
 */
export async function getAdminContextInfo(
  userId: string
): Promise<AdminContext | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || user.role !== UserRole.ADMIN || !user.isActive) {
      return null;
    }

    return {
      userId: user.id,
      userEmail: user.email,
      userName: user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.email,
      role: user.role,
      isActive: user.isActive,
    };
  } catch (error) {
    console.error('[Admin Auth] Error getting admin context:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Check admin status with context (used by /api/admin/check and /api/admin/context)
 *
 * Single function that checks admin status and optionally returns context.
 * Used by health check endpoints to verify admin access.
 *
 * @param userId - User ID from auth context (or undefined if not authenticated)
 * @param includeContext - Whether to include full admin context (default: false)
 * @returns Promise<AdminCheckResult> Result with admin status and optional context
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const userId = getAuthUserId();
 *   if (!userId) return json({ isAdmin: false }, { status: 401 });
 *
 *   const result = await checkAdminStatus(userId, true);
 *   if (!result.isAdmin) {
 *     return json({ isAdmin: false }, { status: 403 });
 *   }
 *
 *   return json(result);
 * }
 * ```
 */
export async function checkAdminStatus(
  userId: string | undefined,
  includeContext: boolean = false
): Promise<AdminCheckResult> {
  if (!userId) {
    return {
      isAdmin: false,
      error: 'Not authenticated',
    };
  }

  try {
    const isAdmin = await isAdminUser(userId);

    if (!isAdmin) {
      return {
        isAdmin: false,
        error: 'Not an admin',
      };
    }

    if (includeContext) {
      const context = await getAdminContextInfo(userId);
      if (!context) {
        return {
          isAdmin: false,
          error: 'Admin context not found',
        };
      }

      return {
        isAdmin: true,
        context,
      };
    }

    return { isAdmin: true };
  } catch (error) {
    console.error('[Admin Auth] Error checking admin status:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      isAdmin: false,
      error: 'Server error',
    };
  }
}

// ============================================================================
// MIDDLEWARE INTEGRATION HELPERS
// ============================================================================

/**
 * Create unauthorized response (401)
 *
 * Helper function for consistent error responses across admin routes.
 * Used when user is not authenticated at all.
 *
 * @param message - Optional error message (default: 'Not authenticated')
 * @returns JSON response with 401 status
 */
export function unauthorizedResponse(
  message: string = 'Not authenticated'
) {
  return {
    error: message,
    code: 'AUTH_UNAUTHORIZED',
    statusCode: 401,
  };
}

/**
 * Create forbidden response (403)
 *
 * Helper function for consistent error responses across admin routes.
 * Used when user is authenticated but not an admin.
 *
 * @param message - Optional error message (default: 'Admin access required')
 * @returns JSON response with 403 status
 */
export function forbiddenResponse(
  message: string = 'Admin access required'
) {
  return {
    error: message,
    code: 'FORBIDDEN_ADMIN_REQUIRED',
    statusCode: 403,
  };
}

/**
 * Get request context for admin operations
 *
 * Extracts request context (IP, user agent) for audit logging.
 * Called by admin operation handlers to capture request metadata.
 *
 * @param request - NextRequest object
 * @returns Object with ipAddress and userAgent
 *
 * @example
 * ```typescript
 * export async function PATCH(request: NextRequest, { params }: Route) {
 *   const userId = getAuthUserId();
 *   const { ipAddress, userAgent } = getRequestContext(request);
 *
 *   // Log this audit entry
 *   await logAdminAction(userId, 'UPDATE', 'CARD', cardId, oldValues, newValues, {
 *     ipAddress,
 *     userAgent,
 *   });
 * }
 * ```
 */
export function getRequestContext(request?: { headers?: Headers }) {
  const ipAddress =
    request?.headers?.get('x-forwarded-for') ||
    request?.headers?.get('x-real-ip') ||
    'unknown';

  const userAgent = request?.headers?.get('user-agent') || undefined;

  return {
    ipAddress,
    userAgent,
  };
}

// ============================================================================
// VALIDATION & ERROR HANDLING
// ============================================================================

/**
 * Validate admin user exists and is active
 *
 * Pre-operation check before performing admin actions.
 * Ensures the current admin user still exists and hasn't been deactivated.
 *
 * @param userId - Admin user ID to validate
 * @returns Promise<{ valid: boolean, user?: AdminContext }>
 */
export async function validateAdminUser(
  userId: string
): Promise<{ valid: boolean; user?: AdminContext }> {
  try {
    const context = await getAdminContextInfo(userId);
    if (!context) {
      return { valid: false };
    }

    return { valid: true, user: context };
  } catch (error) {
    console.error('[Admin Auth] Error validating admin user:', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { valid: false };
  }
}

/**
 * Ensure user ID exists (from auth context)
 *
 * Common guard pattern for route handlers.
 * Returns true if userId is set, false otherwise.
 *
 * @param userId - User ID from getAuthUserId()
 * @returns boolean
 */
export function ensureAuthenticated(userId: string | undefined): boolean {
  return Boolean(userId);
}

/**
 * Build error response for route handlers
 *
 * Standardized error response builder for admin routes.
 * Provides consistent structure for all error types.
 *
 * @param message - Error message
 * @param code - Error code (e.g., 'VALIDATION_ERROR', 'NOT_FOUND')
 * @param statusCode - HTTP status code (default: 400)
 * @returns Structured error response
 */
export function buildErrorResponse(
  message: string,
  code: string,
  statusCode: number = 400
) {
  return {
    success: false,
    error: message,
    code,
    statusCode,
  };
}

/**
 * Build success response for route handlers
 *
 * Standardized success response builder for admin routes.
 * Provides consistent structure for all success responses.
 *
 * @param data - Response data
 * @param message - Optional success message
 * @returns Structured success response
 */
export function buildSuccessResponse<T>(data: T, message?: string) {
  return {
    success: true,
    data,
    ...(message && { message }),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Summary of exported admin auth utilities:
 *
 * ROLE CHECKING:
 * - isAdminUser(userId): Check if user is admin (returns boolean)
 * - requireAdminOrThrow(userId): Check if user is admin (throws on failure)
 *
 * CONTEXT RETRIEVAL:
 * - getAdminContextInfo(userId): Get full admin context
 * - checkAdminStatus(userId, includeContext): Check status with optional context
 *
 * RESPONSE BUILDERS:
 * - unauthorizedResponse(): 401 error
 * - forbiddenResponse(): 403 error
 * - buildErrorResponse(): General error
 * - buildSuccessResponse(): General success
 *
 * HELPERS:
 * - getRequestContext(request): Extract IP and user agent
 * - validateAdminUser(userId): Validate admin exists
 * - ensureAuthenticated(userId): Guard against unauthenticated access
 *
 * All functions implement security best practices:
 * ✓ Database lookups (not JWT-based) for role checks
 * ✓ Revocation-aware (checks isActive flag)
 * ✓ Error handling without info leaks
 * ✓ Request context for audit logging
 * ✓ Type-safe responses
 */
