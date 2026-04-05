/**
 * PasswordResetForm Component
 * 
 * Multi-step password reset form (request → check-email → reset → success).
 * 
 * Features:
 * - Email validation and verification
 * - Password strength indicator
 * - Auto-paste token from URL query param
 * - Error messages with recovery instructions
 * - Loading states
 * - ARIA labels for accessibility
 * - Keyboard navigation (Tab, Enter, Escape)
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { usePasswordReset } from '@/features/auth/hooks/usePasswordReset'
import { validatePassword } from '@/shared/lib/validators/passwordValidator'
import Link from 'next/link'

interface PasswordResetFormProps {
  onSuccess?: (email: string) => void
  onError?: (error: string) => void
}

// Unused helper (can be used for future password strength visualization)
// function _getPasswordStrengthColor(password: string): 'red' | 'yellow' | 'blue' | 'green' {
//   const validation = validatePassword(password)
//   
//   switch (validation.strength) {
//     case 'very-strong':
//       return 'green'
//     case 'strong':
//       return 'blue'
//     case 'fair':
//       return 'yellow'
//     case 'weak':
//     default:
//       return 'red'
//   }
// }

export const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  onSuccess,
  onError
}) => {
  const searchParams = useSearchParams()
  const {
    step,
    email,
    isLoading,
    error,
    requestReset,
    resetPassword,
    setStep,
    clearError,
    reset
  } = usePasswordReset()

  const [emailInput, setEmailInput] = useState('')
  const [tokenInput, setTokenInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordValidation, setPasswordValidation] = useState<ReturnType<typeof validatePassword> | null>(null)

  // Auto-paste token from URL
  useEffect(() => {
    const token = searchParams?.get('token')
    if (token) {
      setTokenInput(token)
      setStep('reset')
    }
  }, [searchParams, setStep])

  // Update password validation on change
  useEffect(() => {
    if (passwordInput) {
      setPasswordValidation(validatePassword(passwordInput))
    } else {
      setPasswordValidation(null)
    }
  }, [passwordInput])

  // Handle success callback
  useEffect(() => {
    if (step === 'success' && onSuccess) {
      onSuccess(email)
    }
  }, [step, email, onSuccess])

  // Handle error callback
  useEffect(() => {
    if (error && onError) {
      onError(error)
    }
  }, [error, onError])

  // ===== STEP 1: REQUEST =====
  if (step === 'request') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          requestReset(emailInput)
        }}
        className="space-y-4"
      >
        <h2 className="text-xl font-semibold text-gray-900">Reset Your Password</h2>

        <div>
          <label
            htmlFor="reset-email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email Address
          </label>
          <input
            id="reset-email"
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value)
              clearError()
            }}
            aria-label="Enter your email address"
            aria-describedby={error ? 'reset-email-error' : undefined}
            placeholder="you@example.com"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            required
          />
          {error && (
            <div
              id="reset-email-error"
              role="alert"
              aria-live="polite"
              className="mt-1 text-sm text-red-600"
            >
              {error}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !emailInput}
          aria-label={isLoading ? 'Sending reset link...' : 'Send password reset email'}
          className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <p className="text-center text-sm text-gray-600">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    )
  }

  // ===== STEP 2: CHECK EMAIL =====
  if (step === 'check-email') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Check Your Email</h2>
        <p className="text-gray-600">
          We've sent a password reset link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500">
          The link will expire in 6 hours. Click the link in your email to reset your password.
        </p>

        <button
          onClick={() => setStep('reset')}
          className="text-blue-600 hover:underline font-medium"
        >
          Already have the reset code?
        </button>

        <button
          onClick={() => reset()}
          className="w-full text-gray-600 hover:text-gray-900 py-2"
        >
          Send another email
        </button>
      </div>
    )
  }

  // ===== STEP 3: RESET =====
  if (step === 'reset') {
    const isFormValid = tokenInput && passwordInput === passwordConfirm && passwordValidation?.isValid

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (isFormValid) {
            resetPassword(tokenInput, passwordInput)
          }
        }}
        className="space-y-4"
      >
        <h2 className="text-xl font-semibold text-gray-900">Create New Password</h2>

        {/* Token Input */}
        <div>
          <label
            htmlFor="reset-token"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Reset Code
          </label>
          <input
            id="reset-token"
            type="text"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value)
              clearError()
            }}
            aria-label="Password reset code or token"
            aria-describedby={error ? 'reset-token-error' : undefined}
            placeholder="Paste your reset code here"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            required
          />
          {error && (
            <div
              id="reset-token-error"
              role="alert"
              aria-live="polite"
              className="mt-1 text-sm text-red-600"
            >
              {error}
            </div>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            New Password
          </label>
          <input
            id="new-password"
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value)
              clearError()
            }}
            aria-label="Enter your new password"
            aria-describedby="password-requirements"
            placeholder="Enter a strong password"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            required
          />

          {/* Strength Indicator */}
          {passwordInput && passwordValidation && (
            <div id="password-requirements" className="mt-2 space-y-1">
              {passwordValidation.errors.length === 0 ? (
                <p className="text-sm text-green-600 font-medium">✓ Strong password</p>
              ) : (
                <ul className="text-sm text-gray-600 space-y-1">
                  {passwordValidation.errors.map((error, idx) => (
                    <li key={idx} className="text-red-600">
                      • {error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={passwordConfirm}
            onChange={(e) => {
              setPasswordConfirm(e.target.value)
              clearError()
            }}
            aria-label="Confirm your new password"
            placeholder="Re-enter your password"
            disabled={isLoading}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            required
          />
          {passwordInput && passwordConfirm && passwordInput !== passwordConfirm && (
            <p className="mt-1 text-sm text-red-600">Passwords don't match</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !isFormValid}
          aria-label={isLoading ? 'Resetting password...' : 'Reset password'}
          className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    )
  }

  // ===== STEP 4: SUCCESS =====
  if (step === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="text-5xl">✓</div>
        <h2 className="text-xl font-semibold text-gray-900">Password Reset Successfully</h2>
        <p className="text-gray-600">
          Your password has been changed. You can now log in with your new password.
        </p>

        <Link
          href="/auth/login"
          className="inline-block bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    )
  }

  return null
}

export default PasswordResetForm
