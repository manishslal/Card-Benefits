/**
 * useSessionRefresh hook
 * 
 * Manages session lifecycle for password recovery feature:
 * - Polls session-status every 10 seconds
 * - Shows SessionExpirationModal when < 5 minutes remain
 * - Handles token refresh
 * - Detects logout in other tabs via localStorage
 */

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SessionStatus {
  success: boolean
  isAuthenticated: boolean
  status?: 'active' | 'expiring' | 'inactive'
  expiresAt?: string
  warningAt?: string
  timeRemaining?: number
  userId?: string
}

interface UseSessionRefreshReturn {
  sessionStatus: SessionStatus | null
  isExpiring: boolean
  timeRemaining: number | null
  showExpirationModal: boolean
  refreshSession: () => Promise<void>
  startRefreshTimer: () => void
  stopRefreshTimer: () => void
  acknowledgeWarning: () => void
}

const POLL_INTERVAL = 10 * 1000 // 10 seconds

export function useSessionRefresh(): UseSessionRefreshReturn {
  const router = useRouter()
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [showExpirationModal, setShowExpirationModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isRefreshingRef = useRef(false)

  /**
   * Check session status from API.
   */
  const checkSessionStatus = useCallback(async (): Promise<SessionStatus | null> => {
    try {
      // Get token from localStorage (set during login)
      const token = typeof window !== 'undefined' 
        ? localStorage.getItem('sessionToken')
        : null

      if (!token) {
        return {
          success: true,
          isAuthenticated: false,
          status: 'inactive'
        }
      }

      const response = await fetch('/api/auth/session-status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Session expired
          localStorage.removeItem('sessionToken')
          return {
            success: false,
            isAuthenticated: false,
            status: 'inactive'
          }
        }
        throw new Error(`Session status error: ${response.status}`)
      }

      const data = (await response.json()) as SessionStatus
      return data
    } catch (error) {
      console.error('Session check error:', error)
      return null
    }
  }, [])

  /**
   * Refresh session token.
   */
  const refreshSession = useCallback(async () => {
    if (isRefreshingRef.current) return
    
    isRefreshingRef.current = true
    try {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('sessionToken')
        : null

      if (!token) {
        router.push('/auth/login?message=session_expired')
        return
      }

      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('sessionToken')
          router.push('/auth/login?message=session_expired')
          return
        }
        throw new Error(`Refresh token error: ${response.status}`)
      }

      const data = await response.json()
      if (data.token) {
        localStorage.setItem('sessionToken', data.token)
        
        // Hide modal and continue
        setShowExpirationModal(false)
        
        // Check status again to update times
        const status = await checkSessionStatus()
        if (status) {
          setSessionStatus(status)
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      router.push('/auth/login?message=refresh_failed')
    } finally {
      isRefreshingRef.current = false
    }
  }, [router, checkSessionStatus])

  /**
   * Start polling session status.
   */
  const startRefreshTimer = useCallback(() => {
    if (pollIntervalRef.current) return

    // Check immediately
    checkSessionStatus().then(status => {
      if (status) {
        setSessionStatus(status)
        
        // Show modal if expiring
        if (status.status === 'expiring') {
          setShowExpirationModal(true)
        }
      }
    })

    // Then poll every 10 seconds
    pollIntervalRef.current = setInterval(async () => {
      const status = await checkSessionStatus()
      if (status) {
        setSessionStatus(status)
        
        // Show modal if expiring and not already shown
        if (status.status === 'expiring' && !showExpirationModal) {
          setShowExpirationModal(true)
        }

        // Auto-redirect if session expired
        if (!status.isAuthenticated) {
          stopRefreshTimer()
          router.push('/auth/login?message=session_expired')
        }
      }
    }, POLL_INTERVAL)
  }, [checkSessionStatus, showExpirationModal, router])

  /**
   * Stop polling session status.
   */
  const stopRefreshTimer = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  /**
   * User acknowledges warning (dismisses modal without extending).
   */
  const acknowledgeWarning = useCallback(() => {
    setShowExpirationModal(false)
  }, [])

  /**
   * Update countdown when modal is shown.
   */
  useEffect(() => {
    if (!showExpirationModal || !sessionStatus?.timeRemaining) {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      return
    }

    setTimeRemaining(sessionStatus.timeRemaining)

    countdownIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null) return null
        if (prev <= 0) {
          // Session expired
          setShowExpirationModal(false)
          stopRefreshTimer()
          router.push('/auth/login?message=session_expired')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [showExpirationModal, sessionStatus?.timeRemaining, stopRefreshTimer, router])

  /**
   * Listen for logout in other tabs.
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Check if logout was triggered in another tab
      if (e.key === 'auth_logout' && e.newValue === 'true') {
        stopRefreshTimer()
        setShowExpirationModal(false)
        router.push('/auth/login?message=logged_out_elsewhere')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [stopRefreshTimer, router])

  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      stopRefreshTimer()
    }
  }, [stopRefreshTimer])

  return {
    sessionStatus,
    isExpiring: sessionStatus?.status === 'expiring' || false,
    timeRemaining,
    showExpirationModal,
    refreshSession,
    startRefreshTimer,
    stopRefreshTimer,
    acknowledgeWarning
  }
}
