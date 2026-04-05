/**
 * GET /api/auth/session-status
 * 
 * Checks current session status and returns expiry times for UI countdown.
 * 
 * Request: Authorization: Bearer <token> in header
 * 
 * Returns:
 * - 200: Session status with timestamps
 * - 200: Not authenticated (no session)
 * - 401: Expired session
 * 
 * Response includes:
 * - isAuthenticated: boolean
 * - status: 'active' | 'expiring' | 'inactive'
 * - expiresAt: ISO timestamp
 * - warningAt: ISO timestamp (5 min before expiry)
 * - timeRemaining: seconds until expiry
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/features/auth/lib/jwt'
import type { SessionPayload } from '@/features/auth/types'

const SESSION_WARNING_WINDOW = 5 * 60; // Show warning 5 minutes before expiry

interface SessionStatus {
  success: boolean
  isAuthenticated: boolean
  status?: 'active' | 'expiring' | 'inactive'
  expiresAt?: string
  warningAt?: string
  timeRemaining?: number
  userId?: string
  code?: string
  message?: string
}

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from Authorization header
    const token = getTokenFromHeader(request)
    
    // No token provided - unauthenticated session
    if (!token) {
      return NextResponse.json(
        {
          success: true,
          isAuthenticated: false,
          status: 'inactive'
        },
        { status: 200 }
      )
    }

    // Verify token validity
    let payload: SessionPayload
    try {
      payload = verifyToken(token)
    } catch (error) {
      // Token is expired or invalid
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // If token is expired, return 401 with expiry message
      if (errorMessage.includes('expired')) {
        return NextResponse.json(
          {
            success: false,
            isAuthenticated: false,
            message: 'Session has expired',
            code: 'SESSION_EXPIRED'
          },
          { status: 401 }
        )
      }

      // Other verification errors (invalid signature, etc)
      return NextResponse.json(
        {
          success: false,
          isAuthenticated: false,
          message: 'Invalid session',
          code: 'INVALID_SESSION'
        },
        { status: 401 }
      )
    }

    // Token is valid - calculate expiry status
    const expiresAt = new Date(payload.expiresAt * 1000) // Convert from Unix timestamp (seconds) to Date
    
    const now = new Date()
    const timeRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / 1000)

    // Calculate warning time (5 minutes before expiry)
    const warningAt = new Date(expiresAt.getTime() - SESSION_WARNING_WINDOW * 1000)

    // Determine status
    const status = timeRemaining <= SESSION_WARNING_WINDOW ? 'expiring' : 'active'

    const response: SessionStatus = {
      success: true,
      isAuthenticated: true,
      status,
      expiresAt: expiresAt.toISOString(),
      warningAt: warningAt.toISOString(),
      timeRemaining,
      userId: payload.userId
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('Session status error:', error)
    return NextResponse.json(
      {
        success: false,
        isAuthenticated: false,
        message: 'Failed to check session status',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
