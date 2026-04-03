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
    
    // Create session first (to get sessionId for payload)
    // NOTE: Session is created with empty token temporarily
    const sessionRecord = await createSession(user.id, '', expiresAt);

    // Create session payload and sign JWT
    // Now we have sessionId, so payload can include it
    const payload = createSessionPayload(user.id, sessionRecord.id);
    const token = signSessionToken(payload);

    // Update session record with JWT token in a single operation
    // CRITICAL: This update should be immediate and atomic at the database level
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
 * 
 * CRITICAL: This is called immediately after session creation.
 * The race window is minimal (microseconds), and the token is
 * validated by the middleware on every request. If this update
 * fails, the login will fail on next API call.
 */
async function updateSessionToken(sessionId: string, token: string): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { sessionToken: token },
    });
  } catch (error) {
    console.error('[Login] Failed to update session token:', {
      sessionId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
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
