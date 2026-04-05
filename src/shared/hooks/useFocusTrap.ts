/**
 * useFocusTrap hook
 * 
 * Implements focus trap for modals (WCAG 2.1 AA).
 * - Tab cycles through focusable elements within modal
 * - Shift+Tab reverses the cycle
 * - Focus first element on modal open
 * - Focus returns to trigger element on close
 */

'use client'

import { useEffect, useRef } from 'react'

/**
 * Implements focus trap for modal accessibility.
 * 
 * @param isOpen - Whether modal is currently open
 * @returns Ref to attach to modal container
 */
export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen || !containerRef.current) return

    // Save previously focused element to restore later
    previousActiveElementRef.current = document.activeElement as HTMLElement

    // Get all focusable elements within the modal
    const focusableSelector = [
      'button',
      '[href]',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])'
    ].join(', ')

    const focusableElements = containerRef.current.querySelectorAll(focusableSelector)
    const firstElement = focusableElements[0] as HTMLElement | undefined
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement | undefined

    // Focus first element when modal opens
    if (firstElement) {
      firstElement.focus()
    }

    // Handle Tab key to trap focus
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (!firstElement || !lastElement) return

      if (e.shiftKey) {
        // Shift+Tab on first element -> focus last element
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab on last element -> focus first element
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      
      // Restore focus to previously active element when modal closes
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus()
      }
    }
  }, [isOpen])

  return containerRef
}
