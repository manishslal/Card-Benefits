'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionExpirationModal } from './SessionExpirationModal'

/**
 * SessionExpirationManager Component
 * 
 * Manages session monitoring and expiration warnings.
 * - Polls session status every 30 seconds
 * - Shows modal when 5 minutes remain
 * - Handles token refresh on user action
 * - Logs out on session expiry
 */
export function SessionExpirationManager() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('sessionToken')
    if (!token) return

    // Poll session status every 30 seconds
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/auth/session-status')
        if (!response.ok) {
          if (response.status === 401) {
            // Session expired - log out
            handleLogout()
          }
          return
        }

        const data = await response.json()
        const expiresAt = new Date(data.expiresAt).getTime()
        const now = Date.now()
        const secondsRemaining = Math.floor((expiresAt - now) / 1000)

        // Show modal if 5 minutes or less remain
        if (secondsRemaining <= 5 * 60 && secondsRemaining > 0) {
          setIsModalOpen(true)
          setTimeRemaining(secondsRemaining)
        } else if (secondsRemaining <= 0) {
          // Session has expired
          handleLogout()
        } else {
          setIsModalOpen(false)
          setTimeRemaining(null)
        }
      } catch (error) {
        console.error('Failed to check session status:', error)
      }
    }, 30 * 1000) // Poll every 30 seconds

    // Also check on mount
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/session-status')
        if (response.ok) {
          const data = await response.json()
          const expiresAt = new Date(data.expiresAt).getTime()
          const now = Date.now()
          const secondsRemaining = Math.floor((expiresAt - now) / 1000)

          if (secondsRemaining <= 5 * 60 && secondsRemaining > 0) {
            setIsModalOpen(true)
            setTimeRemaining(secondsRemaining)
          }
        }
      } catch (error) {
        console.error('Failed to check session on mount:', error)
      }
    }

    checkSession()

    return () => clearInterval(pollInterval)
  }, [])

  const handleStayLoggedIn = async () => {
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
      })

      if (response.ok) {
        setIsModalOpen(false)
        setTimeRemaining(null)
        // Session refreshed successfully
      } else {
        console.error('Failed to refresh session')
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('sessionToken')
    localStorage.removeItem('userId')
    setIsModalOpen(false)
    router.push('/login')
  }

  return (
    <SessionExpirationModal
      isOpen={isModalOpen}
      timeRemaining={timeRemaining}
      onStayLoggedIn={handleStayLoggedIn}
      onLogout={handleLogout}
    />
  )
}
