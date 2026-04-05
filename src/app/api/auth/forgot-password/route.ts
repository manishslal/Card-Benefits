/**
 * POST /api/auth/forgot-password
 * 
 * Initiates password recovery by sending a reset email.
 * 
 * Request body: { email: string }
 * 
 * Returns 200 for both valid and non-existent emails (security).
 * Generates a secure 32-character token valid for 6 hours.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/shared/lib/prisma'
import { emailProvider } from '@/shared/lib/email/factory'
import { validateEmail } from '@/lib/validators/email'
import * as fs from 'fs'
import * as path from 'path'
import crypto from 'crypto'

// Email templates
const PASSWORD_RESET_HTML = fs.readFileSync(
  path.join(process.cwd(), 'src/shared/lib/email/templates/passwordReset.html'),
  'utf-8'
)
const PASSWORD_RESET_TEXT = fs.readFileSync(
  path.join(process.cwd(), 'src/shared/lib/email/templates/passwordReset.txt'),
  'utf-8'
)

interface ForgotPasswordRequest {
  email: string
}

interface ForgotPasswordResponse {
  success: boolean
  message: string
}

/**
 * Generates a secure random token for password reset.
 * 32-character hex string (~128 bits of entropy).
 */
function generateResetToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Calculates password reset expiry: 6 hours from now.
 */
function getResetTokenExpiry(): Date {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000)
  return expiresAt
}

/**
 * Formats a date for display in email.
 */
function formatDateForEmail(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  }).format(date)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ForgotPasswordRequest

    // Validate email presence
    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'Email address is required',
          field: 'email'
        },
        { status: 400 }
      )
    }

    // Validate email format
    if (!validateEmail(body.email)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Please enter a valid email address',
          field: 'email',
          code: 'INVALID_EMAIL'
        },
        { status: 400 }
      )
    }

    // Look up user (security: don't reveal if email exists)
    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      select: { id: true, email: true, firstName: true }
    })

    // Always return success, even if user doesn't exist (security best practice)
    // This prevents attackers from enumerating valid emails
    const successResponse: ForgotPasswordResponse = {
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    }

    // If user doesn't exist, return early
    if (!user) {
      return NextResponse.json(successResponse, { status: 200 })
    }

    // Generate reset token and expiry
    const resetToken = generateResetToken()
    const resetTokenExpiry = getResetTokenExpiry()

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiry: resetTokenExpiry
      }
    })

    // Construct reset link (client determines base URL)
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`

    // Render email template with user data
    const htmlContent = PASSWORD_RESET_HTML
      .replace(/{{resetLink}}/g, resetLink)
      .replace(/{{expiresAt}}/g, formatDateForEmail(resetTokenExpiry))
      .replace(/{{username}}/g, user.firstName || 'there')

    const textContent = PASSWORD_RESET_TEXT
      .replace(/{{resetLink}}/g, resetLink)
      .replace(/{{expiresAt}}/g, formatDateForEmail(resetTokenExpiry))
      .replace(/{{username}}/g, user.firstName || 'there')

    // Send email
    try {
      await emailProvider.sendPasswordReset({
        to: user.email,
        subject: 'Reset Your Password',
        htmlContent,
        textContent,
        variables: {
          resetLink,
          expiresAt: formatDateForEmail(resetTokenExpiry),
          username: user.firstName || 'there'
        }
      })
    } catch (emailError) {
      // Log error but don't reveal to user
      console.error('Email service error:', emailError)
      
      // Return generic success anyway (token is saved, user can retry with email)
      return NextResponse.json(successResponse, { status: 200 })
    }

    return NextResponse.json(successResponse, { status: 200 })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send reset email. Please try again later.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
