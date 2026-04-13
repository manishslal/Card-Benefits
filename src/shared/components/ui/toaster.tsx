'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { addToastListener, removeToastFromStore, type Toast } from './use-toast';

/**
 * Toaster – renders toast notifications at the bottom-right corner.
 *
 * Subscribes to the global toast store from use-toast.tsx and renders
 * each toast with variant-appropriate styling using design-token CSS
 * variables for consistent dark-mode support.
 *
 * Features:
 * - Auto-dismiss (respects per-toast duration)
 * - Manual close button on each toast
 * - Slide-in / slide-out animations (Sprint D-3)
 * - Design-token driven colors for light/dark mode
 *
 * Accessibility:
 * - role="status" + aria-live="polite" so screen readers announce
 *   new toasts without interrupting the user.
 * - Close button has aria-label.
 */
export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const exitTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    const unsubscribe = addToastListener((updated) => {
      setToasts([...updated]);
    });
    return () => {
      unsubscribe();
      // Clean up any pending exit timers
      exitTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    // Start exit animation
    setExitingIds((prev) => new Set(prev).add(id));

    // Remove from store after animation completes (300ms)
    const timer = setTimeout(() => {
      setExitingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      removeToastFromStore(id);
      exitTimers.current.delete(id);
    }, 300);
    exitTimers.current.set(id, timer);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-0 right-0 z-50 flex flex-col gap-2 p-4 max-w-md w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-lg p-4 shadow-lg border ${
            exitingIds.has(toast.id) ? 'animate-toast-out' : 'animate-toast-in'
          }`}
          style={{
            backgroundColor: variantBg(toast.variant),
            borderColor: variantBorder(toast.variant),
            color: variantText(toast.variant),
          }}
        >
          {/* Icon */}
          <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
            {variantIcon(toast.variant)}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description && (
              <p className="text-sm mt-0.5 opacity-90">{toast.description}</p>
            )}
            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick();
                  handleDismiss(toast.id);
                }}
                className="text-sm font-semibold underline mt-1 hover:opacity-80 transition-opacity"
                aria-label={toast.action.label}
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => handleDismiss(toast.id)}
            className="flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- Variant helpers ---------- */

function variantBg(variant: Toast['variant']): string {
  switch (variant) {
    case 'success': return 'var(--color-success-bg, #ecfdf5)';
    case 'error':   return 'var(--color-error-bg, #fef2f2)';
    case 'info':    return 'var(--color-info-bg, #f0fdfa)';
    default:        return 'var(--color-bg-secondary, #f9fafb)';
  }
}

function variantBorder(variant: Toast['variant']): string {
  switch (variant) {
    case 'success': return 'var(--color-success, #22c55e)';
    case 'error':   return 'var(--color-error, #ef4444)';
    case 'info':    return 'var(--color-info, #0d9488)';
    default:        return 'var(--color-border, #e5e7eb)';
  }
}

function variantText(variant: Toast['variant']): string {
  switch (variant) {
    case 'success': return 'var(--color-success-text, #166534)';
    case 'error':   return 'var(--color-error-text, #991b1b)';
    case 'info':    return 'var(--color-info-text, #115e59)';
    default:        return 'var(--color-text, #111827)';
  }
}

function variantIcon(variant: Toast['variant']): string {
  switch (variant) {
    case 'success': return '✓';
    case 'error':   return '✕';
    case 'info':    return 'ℹ';
    default:        return '•';
  }
}