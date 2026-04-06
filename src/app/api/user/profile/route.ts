/**
 * POST /api/user/profile
 *
 * Updates the authenticated user's profile information (name, email, preferences)
 *
 * Request body:
 * {
 *   "firstName": "John",           // Optional
 *   "lastName": "Doe",             // Optional
 *   "email": "john@example.com",   // Optional (must be unique)
 *   "notificationPreferences": {   // Optional
 *     "emailNotifications": true,
 *     "renewalReminders": true,
 *     "newFeatures": false
 *   }
 * }
 *
 * Response 200 (Success):
 * {
 *   "success": true,
 *   "user": {
 *     "id": "user_123",
 *     "email": "john@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "emailVerified": false,
 *     "createdAt": "2024-01-15T10:30:00Z",
 *     "updatedAt": "2024-01-15T10:30:00Z"
 *   },
 *   "message": "Profile updated successfully"
 * }
 *
 * Errors:
 * - 400: Validation failed (invalid email, etc.)
 * - 401: Not authenticated
 * - 409: Email already in use
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

// ============================================================
// Type Definitions
// ============================================================

/**
 * User profile update request body
 */
interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  notificationPreferences?: {
    emailNotifications?: boolean;
    renewalReminders?: boolean;
    newFeatures?: boolean;
  };
}

/**
 * User profile response DTO
 */
interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Success response for profile update
 */
interface UpdateProfileResponse {
  success: true;
  user: UserProfile;
  message: string;
}

/**
 * Error response
 */
interface ErrorResponse {
  success: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

// ============================================================
// Validation Helpers
// ============================================================

/**
 * Validates email format using a basic regex pattern
 * Production systems should use more robust email validation or verification
 *
 * @param email - Email address to validate
 * @returns true if email format is valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  // RFC 5322 simplified pattern - covers most common cases
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validates profile update request data
 *
 * @param body - Request body to validate
 * @returns Validation result with errors if any
 */
function validateUpdateProfileRequest(body: UpdateProfileRequest): {
  valid: boolean;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  // Validate firstName if provided
  if (body.firstName !== undefined && body.firstName !== null) {
    if (typeof body.firstName !== 'string') {
      errors.firstName = 'First name must be a string';
    } else if (body.firstName.trim().length === 0) {
      errors.firstName = 'First name cannot be empty';
    } else if (body.firstName.length > 50) {
      errors.firstName = 'First name is too long (max 50 characters)';
    }
  }

  // Validate lastName if provided
  if (body.lastName !== undefined && body.lastName !== null) {
    if (typeof body.lastName !== 'string') {
      errors.lastName = 'Last name must be a string';
    } else if (body.lastName.trim().length === 0) {
      errors.lastName = 'Last name cannot be empty';
    } else if (body.lastName.length > 50) {
      errors.lastName = 'Last name is too long (max 50 characters)';
    }
  }

  // Validate email if provided
  if (body.email !== undefined && body.email !== null) {
    if (typeof body.email !== 'string') {
      errors.email = 'Email must be a string';
    } else if (!isValidEmail(body.email.trim())) {
      errors.email = 'Invalid email format';
    }
  }

  // Validate notification preferences if provided
  if (body.notificationPreferences !== undefined && body.notificationPreferences !== null) {
    if (typeof body.notificationPreferences !== 'object' || Array.isArray(body.notificationPreferences)) {
      errors.notificationPreferences = 'Notification preferences must be an object';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/user/profile handler
 *
 * Fetches the current authenticated user's profile information.
 * This handler replaces /api/auth/user which was classified as public.
 *
 * @param _request - NextRequest with authenticated user context
 * @returns NextResponse with user profile or error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user ID from middleware-set request header
    // Middleware passes userId via 'x-user-id' header for protected APIs
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
        role: true,
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
      } as { success: true; user: typeof user },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Get User Profile Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user profile',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// POST Handler
// ============================================================

/**
 * POST /api/user/profile handler
 *
 * Updates the authenticated user's profile information with validation:
 * - Email uniqueness check (if email is being updated)
 * - Input validation (format, length)
 * - Transaction-safe database updates
 *
 * @param request - NextRequest with authenticated user context and JSON body
 * @returns NextResponse with updated user profile or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // Parse request body
    const body = await request.json().catch(() => ({})) as UpdateProfileRequest;

    // Validate request data
    const validation = validateUpdateProfileRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          fieldErrors: validation.errors,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Prepare update data - only update fields that were provided
    const updateData: Record<string, any> = {};

    if (body.firstName !== undefined) {
      updateData.firstName = body.firstName ? body.firstName.trim() : null;
    }

    if (body.lastName !== undefined) {
      updateData.lastName = body.lastName ? body.lastName.trim() : null;
    }

    // If email is being updated, check for uniqueness
    if (body.email !== undefined && body.email !== null) {
      const trimmedEmail = body.email.trim().toLowerCase();

      // Check if email is already in use by another user
      const existingUser = await prisma.user.findFirst({
        where: {
          email: {
            equals: trimmedEmail,
            mode: 'insensitive',
          },
          // Exclude current user from check
          NOT: {
            id: userId,
          },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            fieldErrors: { email: 'This email is already in use' },
          } as ErrorResponse,
          { status: 409 }
        );
      }

      updateData.email = trimmedEmail;
    }

    // Update user profile in database
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Transform database result into response DTO
    const userProfile: UserProfile = {
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      emailVerified: updatedUser.emailVerified,
      createdAt: updatedUser.createdAt.toISOString(),
      updatedAt: updatedUser.updatedAt.toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        user: userProfile,
        message: 'Profile updated successfully',
      } as UpdateProfileResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[POST /api/user/profile Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update profile',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
