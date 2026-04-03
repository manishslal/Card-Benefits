/**
 * POST /api/auth/login
 *
 * Authenticates user with email and password.
 *
 * Security features:
 * - Timing-safe password comparison (prevents timing attacks)
 * - Generic error messages (prevents user enumeration)
 * - Rate limiting: 5 failed attempts in 15 minutes
 * - Account lockout: 15 minutes after 5 failed attempts
 *
 * Flow:
 * 1. Check rate limit / account lock
 * 2. Look up user by email
 * 3. Use timing-safe comparison for password
 * 4. On failure: increment attempt counter, check for lockout
 * 5. On success: create session, set cookie, return user ID
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPassword,
  createSessionPayload,
  signSessionToken,
  getSessionExpirationSeconds,
} from '@/lib/auth-utils';
import {
  getUserByEmail,
  createSession,
} from '@/lib/auth-server';
import { RateLimiter } from '@/lib/rate-limiter';
import {
  validateEmail,
} from '@/lib/validation';
import {
  AppError,
  ERROR_CODES,
  ERROR_MESSAGES,
} from '@/lib/errors';

// ============================================================
// Rate Limiting
// ============================================================

/**
 * In-memory rate limiter for login attempts
 *
 * Configuration:
 * - 5 failed attempts per email
 * - 15-minute window
 * - 15-minute lockout after threshold
 */
const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  lockoutMs: 15 * 60 * 1000, // 15 minutes
});

// ============================================================
// Type Definitions
// ============================================================

interface LoginRequest {
  email?: string;
  password?: string;
}

interface LoginSuccess {
  success: true;
  userId: string;
  message: string;
}

interface LoginError {
  success: false;
  error: string;
  lockedUntil?: string;
}

// ============================================================
// Main Handler
// ============================================================

/**
 * POST /api/auth/login handler
 *
 * @param request - NextRequest with JSON body containing email, password
 * @returns NextResponse with session cookie and user ID, or error response
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({})) as LoginRequest;

    // Validate request structure
    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email and password are required',
        } as LoginError,
        { status: ERROR_MESSAGES[ERROR_CODES.VALIDATION_FIELD].statusCode }
      );
    }

    const email = body.email.toLowerCase().trim();
    const password = body.password;

    // Validate email format using centralized validation
    try {
      validateEmail(email);
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          {
            success: false,
            error: ERROR_MESSAGES[err.code].message,
          } as LoginError,
          { status: ERROR_MESSAGES[err.code].statusCode }
        );
      }
    }

    // Check rate limit and lockout status
    const rateLimitCheck = loginRateLimiter.check(email);
    if (rateLimitCheck.isLocked) {
      return NextResponse.json(
        {
          success: false,
          error: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED].message,
          lockedUntil: rateLimitCheck.lockedUntil?.toISOString(),
        } as LoginError,
        { status: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED].statusCode }
      );
    }

    // Look up user by email
    const user = await getUserByEmail(email);

    // Generic error message (prevents user enumeration)
    const invalidMessage = ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID].message;

    // User not found
    if (!user) {
      loginRateLimiter.recordFailure(email);
      return NextResponse.json(
        {
          success: false,
          error: invalidMessage,
        } as LoginError,
        { status: ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID].statusCode }
      );
    }

    // Verify password (timing-safe comparison)
    const isPasswordValid = await verifyPassword(user.passwordHash, password);

    if (!isPasswordValid) {
      loginRateLimiter.recordFailure(email);
      return NextResponse.json(
        {
          success: false,
          error: invalidMessage,
        } as LoginError,
        { status: ERROR_MESSAGES[ERROR_CODES.AUTH_INVALID].statusCode }
      );
    }

    // Password is correct - create session
    loginRateLimiter.recordSuccess(email);

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
        message: 'Logged in successfully',
      } as LoginSuccess,
      { status: 200 }
    );

    // Set session cookie
    setSessionCookie(response, token, getSessionExpirationSeconds());

    return response;
  } catch (error) {
    // Log error for debugging
    if (error instanceof Error) {
      console.error('[Login Error]', error.message);
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].message,
      } as LoginError,
      { status: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR].statusCode }
    );
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Updates session record with the JWT token
 */
async function updateSessionToken(sessionId: string, token: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { sessionToken: token },
    });
  } catch (error) {
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
