/**
 * ADMIN AUTHORIZATION TESTS
 *
 * Unit tests for admin-auth.ts module.
 *
 * TEST CATEGORIES:
 * 1. Role Checking Functions
 *    - isAdminUser() with admin/non-admin/inactive users
 *    - requireAdminOrThrow() success and error cases
 *
 * 2. Admin Context Retrieval
 *    - getAdminContextInfo() returns correct context
 *    - getAdminContextInfo() returns null for non-admins
 *    - checkAdminStatus() with/without context
 *
 * 3. Response Builders
 *    - Correct status codes and structures
 *    - Error codes match specification
 *
 * 4. Helper Functions
 *    - getRequestContext() extraction
 *    - validateAdminUser() validation
 *    - ensureAuthenticated() guard
 *
 * MOCKING STRATEGY:
 * - Mock prisma.user.findUnique for database queries
 * - Mock different user states: admin, regular, inactive
 * - Test error cases: missing user, database errors
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isAdminUser,
  requireAdminOrThrow,
  getAdminContextInfo,
  checkAdminStatus,
  unauthorizedResponse,
  forbiddenResponse,
  getRequestContext,
  validateAdminUser,
  ensureAuthenticated,
  buildErrorResponse,
  buildSuccessResponse,
} from '@/lib/admin-auth';
import { prisma } from '@/shared/lib/prisma';
import { UserRole } from '@prisma/client';

// ============================================================================
// SETUP & MOCKING
// ============================================================================

vi.mock('@/shared/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock user data for testing
const ADMIN_USER_ID = 'admin_123';
const REGULAR_USER_ID = 'user_456';
const INACTIVE_ADMIN_ID = 'admin_inactive_789';
const NONEXISTENT_USER_ID = 'user_notfound';

const mockAdminUser = {
  id: ADMIN_USER_ID,
  email: 'admin@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: UserRole.ADMIN,
  isActive: true,
};

const mockRegularUser = {
  id: REGULAR_USER_ID,
  email: 'user@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  role: UserRole.USER,
  isActive: true,
};

const mockInactiveAdmin = {
  id: INACTIVE_ADMIN_ID,
  email: 'inactive@example.com',
  firstName: 'Bob',
  lastName: 'Johnson',
  role: UserRole.ADMIN,
  isActive: false,
};

// ============================================================================
// TEST SUITE: Role Checking Functions
// ============================================================================

describe('Admin Auth - Role Checking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isAdminUser()', () => {
    it('should return true for admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.ADMIN,
        isActive: true,
      } as any);

      const result = await isAdminUser(ADMIN_USER_ID);

      expect(result).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: ADMIN_USER_ID },
        select: { role: true, isActive: true },
      });
    });

    it('should return false for regular user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.USER,
        isActive: true,
      } as any);

      const result = await isAdminUser(REGULAR_USER_ID);

      expect(result).toBe(false);
    });

    it('should return false for inactive admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.ADMIN,
        isActive: false,
      } as any);

      const result = await isAdminUser(INACTIVE_ADMIN_ID);

      expect(result).toBe(false);
    });

    it('should return false for nonexistent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await isAdminUser(NONEXISTENT_USER_ID);

      expect(result).toBe(false);
    });

    it('should return false on database error', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await isAdminUser(ADMIN_USER_ID);

      expect(result).toBe(false);
    });
  });

  describe('requireAdminOrThrow()', () => {
    it('should return true for admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.ADMIN,
        isActive: true,
      } as any);

      const result = await requireAdminOrThrow(ADMIN_USER_ID);

      expect(result).toBe(true);
    });

    it('should throw for non-admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.USER,
        isActive: true,
      } as any);

      await expect(requireAdminOrThrow(REGULAR_USER_ID)).rejects.toThrow(
        'Admin access required'
      );
    });

    it('should throw with correct error code', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.USER,
        isActive: true,
      } as any);

      try {
        await requireAdminOrThrow(REGULAR_USER_ID);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.code).toBe('FORBIDDEN_ADMIN_REQUIRED');
        expect(error.statusCode).toBe(403);
      }
    });

    it('should throw for inactive admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.ADMIN,
        isActive: false,
      } as any);

      await expect(requireAdminOrThrow(INACTIVE_ADMIN_ID)).rejects.toThrow();
    });
  });
});

// ============================================================================
// TEST SUITE: Admin Context Retrieval
// ============================================================================

describe('Admin Auth - Context Retrieval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAdminContextInfo()', () => {
    it('should return admin context for admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);

      const result = await getAdminContextInfo(ADMIN_USER_ID);

      expect(result).toEqual({
        userId: ADMIN_USER_ID,
        userEmail: 'admin@example.com',
        userName: 'John Doe',
        role: UserRole.ADMIN,
        isActive: true,
      });
    });

    it('should format name correctly with first and last name', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);

      const result = await getAdminContextInfo(ADMIN_USER_ID);

      expect(result?.userName).toBe('John Doe');
    });

    it('should use email as fallback for name', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockAdminUser,
        firstName: null,
        lastName: null,
      } as any);

      const result = await getAdminContextInfo(ADMIN_USER_ID);

      expect(result?.userName).toBe('admin@example.com');
    });

    it('should return null for non-admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser as any);

      const result = await getAdminContextInfo(REGULAR_USER_ID);

      expect(result).toBeNull();
    });

    it('should return null for inactive admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockInactiveAdmin as any);

      const result = await getAdminContextInfo(INACTIVE_ADMIN_ID);

      expect(result).toBeNull();
    });

    it('should return null for nonexistent user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await getAdminContextInfo(NONEXISTENT_USER_ID);

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error('Database error')
      );

      const result = await getAdminContextInfo(ADMIN_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe('checkAdminStatus()', () => {
    it('should return isAdmin=true without context', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        role: UserRole.ADMIN,
        isActive: true,
      } as any);

      const result = await checkAdminStatus(ADMIN_USER_ID, false);

      expect(result.isAdmin).toBe(true);
      expect(result.context).toBeUndefined();
    });

    it('should return isAdmin=true with context', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);

      const result = await checkAdminStatus(ADMIN_USER_ID, true);

      expect(result.isAdmin).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context?.userEmail).toBe('admin@example.com');
    });

    it('should return isAdmin=false for non-admin', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser as any);

      const result = await checkAdminStatus(REGULAR_USER_ID, false);

      expect(result.isAdmin).toBe(false);
      expect(result.error).toBe('Not an admin');
    });

    it('should return isAdmin=false for undefined userId', async () => {
      const result = await checkAdminStatus(undefined as any, false);

      expect(result.isAdmin).toBe(false);
      expect(result.error).toBe('Not authenticated');
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('should include error message on failure', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const result = await checkAdminStatus(NONEXISTENT_USER_ID, false);

      expect(result.isAdmin).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// ============================================================================
// TEST SUITE: Response Builders
// ============================================================================

describe('Admin Auth - Response Builders', () => {
  describe('unauthorizedResponse()', () => {
    it('should return 401 response', () => {
      const response = unauthorizedResponse();

      expect(response.statusCode).toBe(401);
      expect(response.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('should use default message', () => {
      const response = unauthorizedResponse();

      expect(response.error).toBe('Not authenticated');
    });

    it('should use custom message', () => {
      const response = unauthorizedResponse('Custom auth error');

      expect(response.error).toBe('Custom auth error');
    });
  });

  describe('forbiddenResponse()', () => {
    it('should return 403 response', () => {
      const response = forbiddenResponse();

      expect(response.statusCode).toBe(403);
      expect(response.code).toBe('FORBIDDEN_ADMIN_REQUIRED');
    });

    it('should use default message', () => {
      const response = forbiddenResponse();

      expect(response.error).toBe('Admin access required');
    });

    it('should use custom message', () => {
      const response = forbiddenResponse('Custom forbidden error');

      expect(response.error).toBe('Custom forbidden error');
    });
  });

  describe('buildErrorResponse()', () => {
    it('should build error response with all fields', () => {
      const response = buildErrorResponse('Validation failed', 'VALIDATION_ERROR', 400);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Validation failed');
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.statusCode).toBe(400);
    });

    it('should use default status code', () => {
      const response = buildErrorResponse('Error', 'ERROR_CODE');

      expect(response.statusCode).toBe(400);
    });
  });

  describe('buildSuccessResponse()', () => {
    it('should build success response with data', () => {
      const data = { id: '123', name: 'Test' };
      const response = buildSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should include optional message', () => {
      const response = buildSuccessResponse({ id: '123' }, 'Success message');

      expect(response.message).toBe('Success message');
    });

    it('should omit message if not provided', () => {
      const response = buildSuccessResponse({ id: '123' });

      expect(response.message).toBeUndefined();
    });
  });
});

// ============================================================================
// TEST SUITE: Helper Functions
// ============================================================================

describe('Admin Auth - Helper Functions', () => {
  describe('getRequestContext()', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'x-forwarded-for') return '192.168.1.1';
            return null;
          },
        } as any,
      };

      const context = getRequestContext(request as any);

      expect(context.ipAddress).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'x-real-ip') return '10.0.0.1';
            return null;
          },
        } as any,
      };

      const context = getRequestContext(request as any);

      expect(context.ipAddress).toBe('10.0.0.1');
    });

    it('should extract user agent header', () => {
      const request = {
        headers: {
          get: (name: string) => {
            if (name === 'user-agent') return 'Mozilla/5.0...';
            return null;
          },
        } as any,
      };

      const context = getRequestContext(request as any);

      expect(context.userAgent).toBe('Mozilla/5.0...');
    });

    it('should use unknown for missing IP', () => {
      const request = {
        headers: {
          get: () => null,
        } as any,
      };

      const context = getRequestContext(request as any);

      expect(context.ipAddress).toBe('unknown');
    });

    it('should handle undefined request', () => {
      const context = getRequestContext(undefined);

      expect(context.ipAddress).toBe('unknown');
      expect(context.userAgent).toBeUndefined();
    });
  });

  describe('validateAdminUser()', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should validate admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);

      const result = await validateAdminUser(ADMIN_USER_ID);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
    });

    it('should invalidate non-admin user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser as any);

      const result = await validateAdminUser(REGULAR_USER_ID);

      expect(result.valid).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('should handle database errors', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error('Database error')
      );

      const result = await validateAdminUser(ADMIN_USER_ID);

      expect(result.valid).toBe(false);
    });
  });

  describe('ensureAuthenticated()', () => {
    it('should return true for userId', () => {
      const result = ensureAuthenticated(ADMIN_USER_ID);

      expect(result).toBe(true);
    });

    it('should return false for undefined userId', () => {
      const result = ensureAuthenticated(undefined);

      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = ensureAuthenticated('');

      expect(result).toBe(false);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Admin Auth - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full admin authorization flow', async () => {
    // Setup: User is admin
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockAdminUser as any);

    // Step 1: Check if user is authenticated
    const isAuth = ensureAuthenticated(ADMIN_USER_ID);
    expect(isAuth).toBe(true);

    // Step 2: Check if user is admin
    const isAdmin = await isAdminUser(ADMIN_USER_ID);
    expect(isAdmin).toBe(true);

    // Step 3: Get admin context
    const context = await getAdminContextInfo(ADMIN_USER_ID);
    expect(context).toBeDefined();
    expect(context?.role).toBe(UserRole.ADMIN);

    // Step 4: Build success response
    const response = buildSuccessResponse(context);
    expect(response.success).toBe(true);
  });

  it('should fail authorization for non-admin', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockRegularUser as any);

    // Check fails at isAdmin step
    const isAdmin = await isAdminUser(REGULAR_USER_ID);
    expect(isAdmin).toBe(false);

    // Build error response
    const response = forbiddenResponse();
    expect(response.statusCode).toBe(403);
  });
});
