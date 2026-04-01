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
  validateEmail,
  validatePasswordStrength,
  createSessionPayload,
  signSessionToken,
  getSessionExpirationSeconds,
} from '@/lib/auth-utils';
import {
  createUser,
  createSession,
} from '@/lib/auth-server';

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

    // Validate request
    const validation = validateSignupRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          fieldErrors: validation.errors,
        } as SignupError,
        { status: 400 }
      );
    }

    // After validation, email and password are guaranteed to exist
    const email = body.email as string;
    const password = body.password as string;
    const { firstName, lastName } = body;

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid email format',
          fieldErrors: { email: ['Please enter a valid email address'] },
        } as SignupError,
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Password does not meet requirements',
          fieldErrors: { password: passwordValidation.errors },
        } as SignupError,
        { status: 400 }
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
            fieldErrors: { email: ['An account with this email already exists'] },
          } as SignupError,
          { status: 409 }
        );
      }

      // Log other errors for debugging
      console.error('[Signup Error]', error.message);
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: 'Unable to create account. Please try again.',
      } as SignupError,
      { status: 500 }
    );
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Validates signup request structure
 */
function validateSignupRequest(body: SignupRequest): {
  valid: boolean;
  errors?: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  // Email validation
  if (!body.email || typeof body.email !== 'string') {
    errors.email = ['Email is required'];
  } else if (body.email.length > 254) {
    errors.email = ['Email is too long'];
  }

  // Password validation
  if (!body.password || typeof body.password !== 'string') {
    errors.password = ['Password is required'];
  }

  // Optional fields validation
  if (body.firstName && typeof body.firstName !== 'string') {
    errors.firstName = ['First name must be text'];
  } else if (body.firstName && (body.firstName.length < 1 || body.firstName.length > 50)) {
    errors.firstName = ['First name must be 1-50 characters'];
  }

  if (body.lastName && typeof body.lastName !== 'string') {
    errors.lastName = ['Last name must be text'];
  } else if (body.lastName && (body.lastName.length < 1 || body.lastName.length > 50)) {
    errors.lastName = ['Last name must be 1-50 characters'];
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
 * Sets the session cookie on the response
 */
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  const cookieName = 'session';
  const isProduction = process.env.NODE_ENV === 'production';

  // Cookie options
  const cookieOptions = [
    `${cookieName}=${token}`,
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];

  // Add Secure flag in production
  if (isProduction) {
    cookieOptions.push('Secure');
  }

  response.headers.set('Set-Cookie', cookieOptions.join('; '));
}
