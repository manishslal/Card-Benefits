/**
 * POST /api/auth/reset-password
 * 
 * Completes password reset with a valid token and new password.
 * 
 * Request body: { token: string, password: string }
 * 
 * Validates:
 * - Token exists and is not expired
 * - Token has not been used already
 * - Password meets security requirements (8+ chars, upper, lower, number)
 * 
 * On success:
 * - Hashes new password with bcrypt
 * - Updates user password
 * - Clears reset token and expiry
 * - Returns redirect URL
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/shared/lib/prisma'
import { validatePassword } from '@/shared/lib/validators/passwordValidator'

interface ResetPasswordRequest {
  token: string
  password: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ResetPasswordRequest

    // Validate inputs
    if (!body.token || typeof body.token !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Reset token is required',
          field: 'token',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      )
    }

    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'New password is required',
          field: 'password',
          code: 'INVALID_INPUT'
        },
        { status: 400 }
      )
    }

    // Validate password requirements
    const passwordValidation = validatePassword(body.password)
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password must be at least 8 characters and contain uppercase, lowercase, and numbers',
          field: 'password',
          code: 'INVALID_PASSWORD'
        },
        { status: 400 }
      )
    }

    // Look up user by reset token
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: body.token },
      select: {
        id: true,
        email: true,
        passwordResetExpiry: true
      }
    })

    // Token not found
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid or already-used password reset link.',
          code: 'INVALID_TOKEN'
        },
        { status: 400 }
      )
    }

    // Token expired
    if (!user.passwordResetExpiry || new Date() > user.passwordResetExpiry) {
      return NextResponse.json(
        {
          success: false,
          message: 'Password reset link has expired. Please request a new one.',
          code: 'TOKEN_EXPIRED'
        },
        { status: 400 }
      )
    }

    // Hash new password using argon2
    let hashedPassword: string
    try {
      const { hash } = await import('argon2')
      hashedPassword = await hash(body.password)
    } catch (hashError) {
      console.error('Password hashing error:', hashError)
      return NextResponse.json(
        {
          success: false,
          message: 'Failed to reset password. Please try again later.',
          code: 'INTERNAL_ERROR'
        },
        { status: 500 }
      )
    }

    // Update user password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null
      }
    })

    // Return success with redirect URL
    return NextResponse.json(
      {
        success: true,
        message: 'Password has been reset successfully. Please log in with your new password.',
        redirect: '/auth/login?message=password_reset_success'
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to reset password. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
