/**
 * POST /api/auth/signup
 *
 * Creates a new user account with email and password.
 *
 * Flow:
 * 1. Validate email format and uniqueness
 * 2. Validate password strength
 * 3. Hash password with Argon2id
 * 4. Create User record with default Player
 * 5. Create Session record
 * 6. Sign JWT token
 * 7. Set session cookie
 * 8. Return success response
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  hashPassword,
  validatePasswordStrength,
  createSessionPayload,
  signSessionToken,
  getSessionExpirationSeconds,
} from '@/lib/auth-utils';
import {
  createUser,
  createSession,
} from '@/lib/auth-server';
import {
  validateEmail,
  validateString,
} from '@/lib/validation';
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
} from '@/lib/errors';

// ============================================================
// Type Definitions
// ============================================================

interface SignupRequest {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}

interface SignupResponse {
  success: true;
  userId: string;
  message: string;
}

interface SignupError {
  success: false;
  error: string;
  fieldErrors?: Record<string, string[]>;
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/auth/signup handler
 *
 * @param request - NextRequest with JSON body containing email, password
 * @returns NextResponse with session cookie and user ID, or error response
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({})) as SignupRequest;

    // Validate request structure
    const validation = validateSignupRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          fieldErrors: validation.errors,
        } as SignupError,
        { status: ERROR_MESSAGES[ERROR_CODES.VALIDATION_FIELD].statusCode }
      );
    }

    // After validation, email and password are guaranteed to exist
    const email = body.email as string;
    const password = body.password as string;
    const { firstName, lastName } = body;

    // Validate password strength using centralized validation
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES[ERROR_CODES.VALIDATION_PASSWORD].message,
          fieldErrors: { password: passwordValidation.errors },
        } as SignupError,
        { status: ERROR_MESSAGES[ERROR_CODES.VALIDATION_PASSWORD].statusCode }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user in database
    const user = await createUser(email, passwordHash, firstName, lastName);

    // Create session
    const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);
    const sessionRecord = await createSession(user.id, '', expiresAt);

    // Create session payload and sign JWT
    const payload = createSessionPayload(user.id, sessionRecord.id);
    const token = signSessionToken(payload);

    // Update session record with JWT token
    await updateSessionToken(sessionRecord.id, token);

    // Create response with session cookie
    const response = NextResponse.json(
      {
        success: true,
        userId: user.id,
        message: 'Account created successfully',
      } as SignupResponse,
      { status: 201 }
    );

    // Set session cookie (HTTP-only, secure, strict SameSite)
    setSessionCookie(response, token, getSessionExpirationSeconds());

    return response;
  } catch (error) {
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Email already registered') {
        return NextResponse.json(
          {
            success: false,
            error: 'Email already registered',
            code: ERROR_CODES.CONFLICT_DUPLICATE,
            fieldErrors: { email: ['An account with this email already exists'] },
          } as SignupError & { code: string },
          { status: ERROR_MESSAGES[ERROR_CODES.CONFLICT_DUPLICATE].statusCode }
        );
      }

      // Log other errors for debugging
      console.error('[Signup Error]', error.message);
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].message,
        code: ERROR_CODES.INTERNAL_ERROR,
      } as SignupError & { code: string },
      { status: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].statusCode }
    );
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Validates signup request structure using centralized validation
 */
function validateSignupRequest(body: SignupRequest): {
  valid: boolean;
  errors?: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  // Email validation
  try {
    if (!body.email || typeof body.email !== 'string') {
      throw new AppError(ERROR_CODES.VALIDATION_EMAIL, {
        field: 'email',
        reason: 'Email is required',
      });
    }
    validateEmail(body.email);
  } catch (err) {
    if (err instanceof AppError) {
      const msg = ERROR_MESSAGES[err.code].message;
      errors.email = [msg];
    }
  }

  // Password validation
  if (!body.password || typeof body.password !== 'string') {
    errors.password = ['Password is required'];
  }

  // Optional fields validation
  if (body.firstName) {
    try {
      validateString(body.firstName, 'firstName', {
        minLength: 1,
        maxLength: 50,
      });
    } catch (err) {
      if (err instanceof AppError) {
        const msg = ERROR_MESSAGES[err.code].message;
        errors.firstName = [msg];
      }
    }
  }

  if (body.lastName) {
    try {
      validateString(body.lastName, 'lastName', {
        minLength: 1,
        maxLength: 50,
      });
    } catch (err) {
      if (err instanceof AppError) {
        const msg = ERROR_MESSAGES[err.code].message;
        errors.lastName = [msg];
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Updates session record with the JWT token
 * (called after token is signed)
 */
async function updateSessionToken(sessionId: string, token: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { sessionToken: token },
    });
  } catch (error) {
    // Log but don't throw - session already created
    console.error('[Session Update Error]', error);
  }
}

/**
 * Sets the session cookie on the response using Next.js cookies API
 *
 * Uses response.cookies.set() instead of response.headers.set() to ensure
 * proper cookie handling by Next.js middleware and reliable transmission to browser.
 *
 * Security features:
 * - httpOnly: true prevents XSS attacks (JavaScript cannot access)
 * - secure: true in production (HTTPS only)
 * - sameSite: 'strict' prevents CSRF attacks
 */
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // Set session cookie using Next.js cookies API
  response.cookies.set({
    name: 'session',
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: maxAgeSeconds,
    path: '/',
  });
}
