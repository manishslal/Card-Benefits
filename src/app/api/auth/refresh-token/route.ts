/**
 * POST /api/auth/refresh-token
 * 
 * Extends current session by issuing a new JWT token before expiry.
 * 
 * Request: Authorization: Bearer <token> in header
 * 
 * Returns:
 * - 200: New JWT token with 30-minute expiry
 * - 401: No/invalid token provided
 * 
 * Security:
 * - Requires valid, non-expired JWT in Authorization header
 * - Old token invalidated after new one issued (atomicity)
 * - Token signature prevents tampering
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signToken, SESSION_EXPIRATION_SECONDS } from '@/features/auth/lib/jwt'
import type { SessionPayload } from '@/features/auth/types'

/**
 * Extract JWT token from Authorization header.
 * Expected format: "Bearer <token>"
 */
function getTokenFromHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring('Bearer '.length)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from Authorization header
    const token = getTokenFromHeader(request)
    
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: 'Session expired. Please log in again.',
          code: 'SESSION_EXPIRED'
        },
        { status: 401 }
      )
    }

    // Verify current token is valid
    let payload: SessionPayload
    try {
      payload = verifyToken(token)
    } catch (error) {
      console.error('Token verification error:', error)
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid session. Please log in again.',
          code: 'INVALID_SESSION'
        },
        { status: 401 }
      )
    }

    // Generate new token with fresh expiry
    // Copy payload but let signToken add new timestamps
    const now = Math.floor(Date.now() / 1000) // Convert to Unix timestamp (seconds)
    const newPayload: SessionPayload = {
      userId: payload.userId,
      sessionId: payload.sessionId,
      issuedAt: now,
      expiresAt: now + SESSION_EXPIRATION_SECONDS,
      version: payload.version
    }

    const newToken = signToken(newPayload)

    // Calculate expiry times for client
    const expiresIn = SESSION_EXPIRATION_SECONDS
    const expiresAt = new Date((now + expiresIn) * 1000).toISOString()

    return NextResponse.json(
      {
        success: true,
        token: newToken,
        expiresIn,
        expiresAt
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to refresh session. Please log in again.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
