import { NextRequest, NextResponse } from 'next/server';
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
    const token = request.cookies.get('session')?.value;
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
// JWT VERIFICATION (Via API)
// ============================================================================

/**
 * Verify JWT token by calling /api/auth/verify endpoint
 *
 * CRITICAL DESIGN: Token verification happens in Node.js runtime,
 * not in Edge runtime. This is required because:
 * - JWT verification uses crypto module (unavailable in Edge runtime)
 * - /api/auth/verify runs in Node.js and handles all crypto operations
 * - Middleware remains Edge Runtime safe
 *
 * SECURITY CHECKS (handled by API endpoint):
 * - Validates HMAC-SHA256 signature (prevents tampering)
 * - Checks expiration timestamp
 * - Validates session exists in database (enables revocation)
 * - Uses timing-safe comparison internally
 *
 * @param token - Session JWT token from secure cookie
 * @returns Object with valid flag and userId, or invalid=false on failure
 */
async function verifyTokenViaApi(
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  try {
    // Determine API base URL (works in both dev and production)
    const apiUrl =
      process.env.NEXTAUTH_URL ||
      process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

    const verifyEndpoint = `${apiUrl}/api/auth/verify`;

    const response = await fetch(verifyEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: data.valid === true,
        userId: data.userId,
      };
    }

    // Non-200 response means token is invalid
    return { valid: false };
  } catch (error) {
    // Network failures, JSON parse errors, etc. should be treated as auth failure
    console.error('[Auth Middleware] API verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { valid: false };
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
  response.cookies.delete('session');
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
 * 3. If protected: extract JWT and verify via API
 *    - Call /api/auth/verify with token (runs in Node.js runtime)
 *    - If invalid/missing: return 401
 *    - If expired: return 401
 *    - If user deleted: return 401
 *    - If session revoked: return 401
 * 4. Set auth context for downstream code
 * 5. Allow request to proceed
 *
 * NOTE: JWT verification happens in /api/auth/verify (Node.js runtime),
 * not in middleware (Edge runtime). This avoids the "crypto module not
 * available in Edge runtime" error.
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

    // Verify JWT signature and session validity via API endpoint
    // The API endpoint handles:
    // - JWT signature verification (crypto-heavy, runs in Node.js)
    // - Session database validation
    // - User existence check
    // - Expiration validation
    const { valid, userId } = await verifyTokenViaApi(sessionToken);

    if (!valid || !userId) {
      // Session invalid, revoked, expired, or user deleted
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
