import { NextRequest, NextResponse } from 'next/server';
import {
  verifySessionToken,
  getSessionByToken,
  userExists,
} from '@/lib/auth-server';
import { runWithAuthContext } from '@/lib/auth-context';

/**
 * MIDDLEWARE ARCHITECTURE: Two-Layer Authentication
 *
 * This middleware implements a two-layer authentication system:
 * 1. JWT signature verification (prevents tampering)
 * 2. Database session validation (enables revocation on logout)
 *
 * REQUEST FLOW:
 * - Extract JWT from secure, HttpOnly cookie
 * - Verify JWT signature (HS256)
 * - Check database for session validity (catches revoked tokens)
 * - Verify user still exists
 * - Set authentication context via AsyncLocalStorage
 * - Protect routes based on auth status
 *
 * SECURITY DESIGN:
 * ✓ Token stored in HttpOnly cookie (prevents XSS theft)
 * ✓ SameSite=Strict prevents CSRF attacks
 * ✓ Database check prevents using tokens after logout/revocation
 * ✓ Timing-safe verification in verifySessionToken()
 * ✓ No sensitive data in error messages (prevents info leaks)
 * ✓ Session revocation takes effect immediately
 */

// ============================================================================
// ROUTE CLASSIFICATION
// ============================================================================

/** Routes that do NOT require authentication */
const PUBLIC_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/',
]);

/** API routes that do NOT require authentication */
const PUBLIC_API_ROUTES = ['/api/auth'];

/** Routes that REQUIRE authentication */
const PROTECTED_ROUTES = new Set([
  '/dashboard',
  '/account',
  '/settings',
  '/cards',
  '/benefits',
  '/wallet',
]);

/** Check if route is public API (matches prefix) */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

/** Check if route requires authentication */
function isProtectedRoute(pathname: string): boolean {
  // Exact match for protected routes
  if (PROTECTED_ROUTES.has(pathname)) return true;

  // Protected API routes (all /api/protected/*)
  if (pathname.startsWith('/api/protected/')) return true;

  // Protected dynamic routes (e.g., /settings/profile, /cards/[id])
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route + '/')) return true;
  }

  return false;
}

// ============================================================================
// JWT TOKEN EXTRACTION
// ============================================================================

/**
 * Extract JWT from secure, HttpOnly cookie
 *
 * SECURITY: Using HttpOnly cookie prevents XSS attacks
 * - JavaScript cannot access token
 * - Browser sends cookie automatically in requests
 * - SameSite=Strict prevents CSRF
 */
function extractSessionToken(request: NextRequest): string | null {
  try {
    const token = request.cookies.get('sessionToken')?.value;
    return token || null;
  } catch (error) {
    // Malformed cookies should not crash middleware
    console.error('[Auth Middleware] Error parsing cookies:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ============================================================================
// JWT VERIFICATION
// ============================================================================

/**
 * Verify JWT token structure and signature
 *
 * SECURITY CHECKS:
 * - Validates HMAC-SHA256 signature (prevents tampering)
 * - Checks expiration timestamp
 * - Uses timing-safe comparison internally
 * - No sensitive data in error messages
 *
 * @throws Error if token is invalid, expired, or malformed
 */
function verifyToken(token: string) {
  try {
    return verifySessionToken(token);
  } catch (error) {
    // Don't log token details (it's sensitive)
    console.error('[Auth Middleware] Token verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ============================================================================
// DATABASE SESSION VALIDATION
// ============================================================================

/**
 * Validate session exists and is not revoked
 *
 * CRITICAL: This check enables logout/revocation to work immediately
 * - If user logs out, the Session.isValid flag is set to false
 * - Next request will fail this check
 * - Token remains cryptographically valid but is rejected
 *
 * ALSO CHECKS:
 * - Session not expired (expiresAt > now)
 * - User account still exists
 */
async function validateSessionInDatabase(token: string, userId: string) {
  try {
    // Retrieve session from database
    const session = await getSessionByToken(token);

    if (!session) {
      // Session not found or revoked
      // This handles: logout, explicit revocation, or database cleanup
      return { valid: false, userId: undefined };
    }

    if (session.userId !== userId) {
      // Token/session userId mismatch (shouldn't happen, but check anyway)
      console.error('[Auth Middleware] Session/token userId mismatch');
      return { valid: false, userId: undefined };
    }

    // Verify user account still exists
    const userValid = await userExists(userId);
    if (!userValid) {
      // User deleted account
      return { valid: false, userId: undefined };
    }

    return { valid: true, userId: session.userId };
  } catch (error) {
    // Database errors should not deny access (fail open, not closed)
    // But log the error for debugging
    console.error('[Auth Middleware] Database validation error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // On database error, we cannot verify session, so deny access
    return { valid: false, userId: undefined };
  }
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Create unauthorized (401) response
 * Generic error message prevents information leaks
 */
function createUnauthorizedResponse(
  message: string = 'Unauthorized'
): NextResponse {
  const response = NextResponse.json(
    { error: message, code: 'AUTH_UNAUTHORIZED' },
    { status: 401 }
  );

  // Clear session token cookie on auth failure
  response.cookies.delete('sessionToken');
  return response;
}

// ============================================================================
// MAIN MIDDLEWARE LOGIC
// ============================================================================

/**
 * MIDDLEWARE EXECUTION:
 *
 * 1. Determine if route is public or protected
 * 2. If public: proceed with empty auth context
 * 3. If protected: extract and verify JWT
 *    - If invalid/missing: return 401
 *    - If expired: return 401
 *    - If user deleted: return 401
 *    - If session revoked: return 401
 * 4. Set auth context for downstream code
 * 5. Allow request to proceed
 */
export async function middleware(request: NextRequest) {
  const pathname = new URL(request.url).pathname;

  // =========================================================================
  // STEP 1: Route Classification
  // =========================================================================

  const isPublic = PUBLIC_ROUTES.has(pathname) || isPublicApiRoute(pathname);
  const isProtected = isProtectedRoute(pathname);

  // =========================================================================
  // STEP 2: Public Routes - No Auth Required
  // =========================================================================

  if (isPublic) {
    // Public routes don't need authentication
    return await runWithAuthContext(
      { userId: undefined },
      async () => NextResponse.next()
    );
  }

  // =========================================================================
  // STEP 3: Protected Routes - Auth Required
  // =========================================================================

  if (isProtected) {
    // Extract JWT from secure cookie
    const sessionToken = extractSessionToken(request);

    if (!sessionToken) {
      // No token = no authentication
      return createUnauthorizedResponse('Authentication required');
    }

    // Verify JWT signature and extract payload
    const payload = verifyToken(sessionToken);

    if (!payload) {
      // JWT is invalid, expired, or malformed
      return createUnauthorizedResponse('Invalid or expired session');
    }

    // Validate session exists in database and is not revoked
    const { valid, userId } = await validateSessionInDatabase(
      sessionToken,
      payload.userId
    );

    if (!valid || !userId) {
      // Session revoked, expired, or user deleted
      return createUnauthorizedResponse('Session invalid or revoked');
    }

    // =====================================================================
    // Auth successful! Set context and proceed
    // =====================================================================
    return await runWithAuthContext(
      { userId },
      async () => NextResponse.next()
    );
  }

  // =========================================================================
  // STEP 4: Unclassified Routes - Default Allow
  // =========================================================================

  // For any other routes, proceed without authentication
  // This handles: /api/* (unprotected), /_next/*, /public/*, etc.
  return await runWithAuthContext(
    { userId: undefined },
    async () => NextResponse.next()
  );
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

export const config = {
  /**
   * Matcher: Apply middleware to all routes except:
   * - Static assets (_next/static, _next/image)
   * - Public files (favicon.ico, public/*)
   *
   * This ensures auth context is available for all dynamic routes
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
