/**
 * CRITICAL: Declare Node.js runtime at the top of the file
 * 
 * This must be before any imports because Next.js evaluates this
 * to determine which runtime to use for loading dependencies.
 * 
 * Edge Runtime does NOT support:
 * - Node.js crypto module (needed for jsonwebtoken)
 * - Prisma ORM (needed for database queries)
 * - Any Node.js-specific modules
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { runWithAuthContext, verifySessionToken, isSessionExpired, validateSession, userExists } from '@/features/auth/lib/auth';

/**
 * MIDDLEWARE ARCHITECTURE: Direct JWT Verification in Node.js Runtime
 *
 * This middleware implements a two-layer authentication system:
 * 1. JWT signature verification (prevents tampering)
 * 2. Database session validation (enables revocation on logout)
 *
 * REQUEST FLOW:
 * - Extract JWT from secure, HttpOnly cookie
 * - Verify JWT signature directly (HS256, using Node.js crypto)
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
 * ✓ Direct verification (no network calls, no external fetch)
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
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/cards/available',  // Card catalog for Add Card modal (public)
  '/api/health',           // Health check
];

/** Routes that REQUIRE authentication */
const PROTECTED_ROUTES = new Set([
  '/dashboard',
  '/account',
  '/settings',
  '/cards',
  '/benefits',
  '/wallet',
  '/admin',  // Admin dashboard (Phase 1)
]);

/** API route prefixes that REQUIRE authentication */
const PROTECTED_API_PREFIXES = [
  '/api/benefits',   // POST /api/benefits/add, PATCH/DELETE /api/benefits/[id]
  '/api/cards',      // POST /api/cards/add, PATCH/DELETE /api/cards/[id], GET /api/cards/my-cards
  '/api/user',       // POST /api/user/profile, GET /api/user/profile
  '/api/admin',      // Admin endpoints (Phase 1)
  '/api/dashboard',  // Dashboard API endpoints (Phase 3+)
  '/api/mobile',     // Mobile sync endpoints (F-1)
  '/api/onboarding', // Onboarding endpoints (F-1)
  '/api/lounges',    // Lounge eligibility endpoints
];

/** Check if route is public API (matches prefix) */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

/** Check if route requires authentication */
function isProtectedRoute(pathname: string): boolean {
  // Exact match for protected page routes
  if (PROTECTED_ROUTES.has(pathname)) return true;

  // Protected API route prefixes (NEW)
  for (const prefix of PROTECTED_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }

  // Legacy pattern: /api/protected/*
  if (pathname.startsWith('/api/protected/')) return true;

  // Protected dynamic page routes (e.g., /settings/profile, /cards/[id])
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
    const cookieValue = request.cookies.get('session')?.value;
    console.log('[Auth Middleware] Extracting session cookie:', {
      found: !!cookieValue,
      length: cookieValue?.length || 0,
      preview: cookieValue ? cookieValue.substring(0, 30) : 'none',
    });
    return cookieValue || null;
  } catch (error) {
    // Malformed cookies should not crash middleware
    console.error('[Auth Middleware] Error parsing cookies:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ============================================================================
// JWT VERIFICATION (Direct in Node.js)
// ============================================================================

/**
 * Verify JWT token by directly calling JWT verification functions
 *
 * CRITICAL DESIGN: Token verification happens directly in middleware using
 * Node.js crypto capabilities. This avoids the network fetch that was
 * previously failing in Railway.
 *
 * SECURITY CHECKS PERFORMED:
 * - Validates HMAC-SHA256 signature (prevents tampering)
 * - Checks expiration timestamp
 * - Validates session exists in database (enables revocation)
 * - Uses timing-safe comparison internally
 *
 * @param token - Session JWT token from secure cookie
 * @returns Object with valid flag and userId, or invalid=false on failure
 */
async function verifySessionTokenDirect(
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  console.log('[Auth] Starting session token verification');
  try {
    // Step 1: Verify JWT signature
    console.log('[Auth] Step 1: Verifying JWT signature...');
    let payload;
    try {
      payload = verifySessionToken(token);
      console.log('[Auth] ✓ Step 1 passed: JWT signature valid');
    } catch (error) {
      // Token is invalid, expired, or tampered
      console.error('[Auth] ✗ Step 1 failed: JWT signature invalid', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { valid: false };
    }

    // Step 2: Check if token is expired
    console.log('[Auth] Step 2: Checking token expiration...');
    if (isSessionExpired(payload)) {
      console.error('[Auth] ✗ Step 2 failed: Token is expired');
      return { valid: false };
    }
    console.log('[Auth] ✓ Step 2 passed: Token not expired');

    // Step 3: Check if session is valid in database
    console.log('[Auth] Step 3: Looking up session in database...');
    const dbSession = await validateSession(token);
    if (!dbSession) {
      // Session was revoked or doesn't exist
      console.error('[Auth] ✗ Step 3 failed: Session not found in database');
      console.log('[Auth] Token preview:', token.substring(0, 50) + '...');
      return { valid: false };
    }
    console.log('[Auth] ✓ Step 3 passed: Session found in database');

    // Step 4: Verify user still exists
    console.log('[Auth] Step 4: Checking user existence...');
    const userValid = await userExists(payload.userId);
    if (!userValid) {
      // User was deleted after session creation
      console.error('[Auth] ✗ Step 4 failed: User not found');
      return { valid: false };
    }
    console.log('[Auth] ✓ Step 4 passed: User exists');

    // All checks passed - return success with userId
    console.log('[Auth] ✓ All verification steps passed, authentication successful');
    return {
      valid: true,
      userId: payload.userId,
    };
  } catch (error) {
    // Any other errors (database, etc.) should be treated as auth failure
    console.error('[Auth Middleware] CRITICAL ERROR during session verification:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { valid: false };
  }
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Create unauthorized (401) response - REDIRECTS to login page
 * 
 * SECURITY & UX FIX: Instead of returning raw JSON error (which shows confusing
 * black page to users), redirect to login page with friendly message.
 * 
 * Why redirect instead of JSON response:
 * - User sees familiar login page, not raw JSON error
 * - "Your session has expired" message is more helpful than "AUTH_UNAUTHORIZED"
 * - Query param (?expired=true) allows login page to show banner
 * - Browser handles redirect transparently
 * - Session cookie is cleared automatically
 * 
 * @param baseUrl - The base URL from the request (used to construct redirect URL)
 */
function createUnauthorizedResponse(baseUrl: string): NextResponse {
  // Redirect to login page with ?expired=true query param
  // Login page will detect this and show friendly "session expired" message
  const redirectUrl = new URL('/login?expired=true', baseUrl);
  
  const response = NextResponse.redirect(redirectUrl);

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
 * 3. If protected: extract JWT and verify directly
 *    - Call verifySessionToken() to validate signature (Node.js runtime)
 *    - Check database for session validity (enables revocation)
 *    - Verify user still exists
 *    - If invalid/missing: return 401
 *    - If expired: return 401
 *    - If user deleted: return 401
 *    - If session revoked: return 401
 * 4. Set auth context for downstream code
 * 5. Allow request to proceed
 *
 * NOTE: JWT verification happens directly in middleware (Node.js runtime),
 * not via API endpoint. This is the correct approach because:
 * - Middleware runs in Node.js, not Edge runtime
 * - Direct verification avoids network overhead
 * - Railway supports Node.js crypto in middleware
 */
export async function middleware(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  console.log(`[Middleware] Processing route: ${pathname}`);

  // =========================================================================
  // STEP 1: Route Classification
  // =========================================================================

  const isPublic = PUBLIC_ROUTES.has(pathname) || isPublicApiRoute(pathname);
  const isProtected = isProtectedRoute(pathname);

  console.log(`[Middleware] Route classification: public=${isPublic}, protected=${isProtected}`);

  // =========================================================================
  // STEP 1.5: Handle Authenticated User on Root Path
  // =========================================================================
  // If user is authenticated and accessing "/", redirect to "/dashboard"

  if (pathname === '/') {
    const sessionToken = extractSessionToken(request);
    
    if (sessionToken) {
      console.log('[Middleware] Authenticated user accessing root, verifying session...');
      const { valid, userId } = await verifySessionTokenDirect(sessionToken);
      
      if (valid && userId) {
        console.log(`[Middleware] ✓ Authenticated user redirecting to /dashboard`);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  // =========================================================================
  // STEP 2: Public Routes - No Auth Required
  // =========================================================================

  if (isPublic) {
    // Public routes don't need authentication
    // SECURITY (F-1): Strip any client-supplied x-user-id on public routes too
    const publicHeaders = new Headers(request.headers);
    publicHeaders.delete('x-user-id');
    return await runWithAuthContext(
      { userId: undefined },
      async () => NextResponse.next({ request: { headers: publicHeaders } })
    );
  }

  // =========================================================================
  // STEP 3: Protected Routes - Auth Required
  // =========================================================================

  if (isProtected) {
    console.log('[Middleware] Protected route detected, checking authentication...');
    
    // Extract JWT from secure cookie
    const sessionToken = extractSessionToken(request);

    if (!sessionToken) {
      // No token = no authentication
      console.error('[Middleware] No session token found in cookies');
      return createUnauthorizedResponse(request.url);
    }

    console.log('[Middleware] Session token found, verifying...');

    // Verify JWT signature and session validity directly
    // The middleware can perform JWT verification directly since it runs in
    // Node.js runtime. We verify:
    // - JWT signature (crypto-heavy, runs in Node.js)
    // - Session database validation
    // - User existence check
    // - Expiration validation
    const { valid, userId } = await verifySessionTokenDirect(sessionToken);

    if (!valid || !userId) {
      // Session invalid, revoked, expired, or user deleted
      console.error('[Middleware] Token verification failed');
      return createUnauthorizedResponse(request.url);
    }

    console.log(`[Middleware] ✓ Authentication successful for user ${userId}`);

    // =====================================================================
    // Auth successful! Set context and proceed
    // =====================================================================
    
    // IMPORTANT: To pass userId from middleware to route handlers in Next.js,
    // we must set it on the REQUEST headers (not response headers).
    // NextResponse.next({ request: { headers } }) forwards modified request headers
    // to the downstream route handler.
    //
    // SECURITY (F-1): Strip any client-supplied x-user-id header before setting
    // the verified value. This prevents header forgery where a malicious client
    // sends a crafted x-user-id to impersonate another user.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete('x-user-id');
    if (userId) {
      requestHeaders.set('x-user-id', userId);
    }

    const response = await runWithAuthContext(
      { userId },
      async () => NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      })
    );

    return response;
  }

  // =========================================================================
  // STEP 4: Unclassified Routes - Default Allow
  // =========================================================================

  // For any other routes, proceed without authentication
  // This handles: /api/* (unprotected), /_next/*, /public/*, etc.
  // SECURITY (F-1): Strip any client-supplied x-user-id on unclassified routes
  const defaultHeaders = new Headers(request.headers);
  defaultHeaders.delete('x-user-id');
  return await runWithAuthContext(
    { userId: undefined },
    async () => NextResponse.next({ request: { headers: defaultHeaders } })
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
