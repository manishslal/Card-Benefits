'use client'

import Link from 'next/link'
import React, { useState } from 'react'
import Button from '@/shared/components/ui/button'
import Input from '@/shared/components/ui/Input'
import { SafeDarkModeToggle } from '@/shared/components/ui'
import { FormError } from '@/shared/components/forms'
import { CreditCard } from 'lucide-react'

/**
 * Forgot Password Page
 * 
 * Allows users to initiate password recovery by entering their email address.
 */

export const dynamic = 'force-dynamic'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!email) {
      setError('Please enter your email address')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Failed to send reset email')
        return
      }

      setSuccess('If an account exists with this email, you will receive a password reset link shortly.')
      setEmail('')
    } catch (error) {
      setError('An error occurred. Please try again.')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="border-b py-4"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <CreditCard size={20} />
            </div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              CardTrack
            </h1>
          </Link>
          <SafeDarkModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div
            className="p-8 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
            }}
          >
            {/* Title */}
            <h2
              className="text-2xl font-bold text-center mb-2 text-[var(--color-text)]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Reset Your Password
            </h2>
            <p
              className="text-center text-sm mb-8 text-[var(--color-text-secondary)]"
            >
              Enter your email address and we'll send you a link to reset your password.
            </p>

            {/* Messages */}
            {error && <FormError message={error} type="error" />}
            {success && <FormError message={success} type="success" />}

            {/* Form */}
            {!success ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  id="forgot-email"
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            ) : null}

            {/* Back to Login Link */}
            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
