/**
 * SessionExpirationModal Component
 * 
 * Warns users of imminent session expiry with countdown and extend option.
 * 
 * Features:
 * - Countdown timer (MM:SS format)
 * - "Stay Logged In" button to extend session
 * - "Log Out Now" button to logout immediately
 * - Focus trap (Tab cycles within modal)
 * - Escape key logs out
 * - ARIA labels for accessibility
 */

'use client'

import React, { useEffect, useState } from 'react'
import { useFocusTrap } from '@/shared/hooks/useFocusTrap'

interface SessionExpirationModalProps {
  isOpen: boolean
  timeRemaining: number | null
  onStayLoggedIn: () => Promise<void>
  onLogout: () => void
}

/**
 * Format seconds into MM:SS display format.
 */
function formatCountdown(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '0:00'
  
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export const SessionExpirationModal: React.FC<SessionExpirationModalProps> = ({
  isOpen,
  timeRemaining,
  onStayLoggedIn,
  onLogout
}) => {
  const focusTrapRef = useFocusTrap(isOpen)
  const [isLoading, setIsLoading] = useState(false)
  const [countdownText, setCountdownText] = useState('')

  // Update countdown text
  useEffect(() => {
    setCountdownText(formatCountdown(timeRemaining))
  }, [timeRemaining])

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onLogout()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onLogout])

  // Handle Stay Logged In
  const handleStayLoggedIn = async () => {
    setIsLoading(true)
    try {
      await onStayLoggedIn()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={focusTrapRef}
        role="alertdialog"
        aria-labelledby="session-warning-title"
        aria-describedby="session-warning-description"
        aria-live="assertive"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-lg shadow-lg p-6"
      >
        <h2
          id="session-warning-title"
          className="text-xl font-semibold text-gray-900 mb-2"
        >
          Your session is about to expire
        </h2>

        <p
          id="session-warning-description"
          className="text-gray-600 mb-4"
        >
          Your session will expire in{' '}
          <span
            aria-live="polite"
            aria-atomic="true"
            className="font-mono font-semibold text-blue-600"
          >
            {countdownText}
          </span>
        </p>

        <p className="text-sm text-gray-500 mb-6">
          Click "Stay Logged In" to extend your session, or you'll be logged out for security.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleStayLoggedIn}
            disabled={isLoading}
            aria-label="Extend session by 30 minutes"
            className="flex-1 bg-blue-600 text-white font-medium py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Extending...' : 'Stay Logged In'}
          </button>

          <button
            onClick={onLogout}
            disabled={isLoading}
            aria-label="Log out immediately"
            className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 px-4 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Log Out Now
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Press ESC to log out
        </p>
      </div>
    </>
  )
}

export default SessionExpirationModal
