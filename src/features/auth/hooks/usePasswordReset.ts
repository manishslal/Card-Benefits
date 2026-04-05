/**
 * usePasswordReset hook
 * 
 * Manages multi-step password reset form state and API interactions.
 * 
 * Steps:
 * 1. request: User enters email
 * 2. check-email: Confirmation message, user checks email
 * 3. reset: User enters token + new password
 * 4. success: Confirmation message, redirect to login
 */

'use client'

import { useState, useCallback } from 'react'
import { isPasswordValid } from '@/shared/lib/validators/passwordValidator'

type Step = 'request' | 'check-email' | 'reset' | 'success'

interface UsePasswordResetReturn {
  // State
  step: Step
  email: string
  isLoading: boolean
  error: string | null
  
  // Actions
  requestReset: (email: string) => Promise<void>
  resetPassword: (token: string, password: string) => Promise<void>
  setStep: (step: Step) => void
  clearError: () => void
  reset: () => void
}

export function usePasswordReset(): UsePasswordResetReturn {
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Request password reset (step 1).
   * Sends email to /api/auth/forgot-password endpoint.
   */
  const requestReset = useCallback(async (userEmail: string) => {
    // Validate email locally first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(userEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.message || 'Failed to send reset email'
        setError(errorMessage)
        return
      }

      // Success - move to check-email step
      setEmail(userEmail)
      setStep('check-email')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Reset password (step 3).
   * Sends token + password to /api/auth/reset-password endpoint.
   */
  const resetPassword = useCallback(async (token: string, password: string) => {
    // Validate password locally first
    if (!isPasswordValid(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and numbers')
      return
    }

    // Validate token
    if (!token || token.length === 0) {
      setError('Reset token is required')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.message || 'Failed to reset password'
        setError(errorMessage)
        return
      }

      // Success - move to success step
      setStep('success')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error occurred'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Clear error message.
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  /**
   * Reset entire form to initial state.
   */
  const reset = useCallback(() => {
    setStep('request')
    setEmail('')
    setError(null)
    setIsLoading(false)
  }, [])

  return {
    step,
    email,
    isLoading,
    error,
    requestReset,
    resetPassword,
    setStep,
    clearError,
    reset
  }
}
