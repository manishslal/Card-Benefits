'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;        // Auto-dismiss milliseconds (default 4000)
  onDismiss?: () => void;
  id?: string;
}

/**
 * Toast Component - Notification Feedback
 * 
 * Provides user feedback for actions without blocking interaction.
 * Auto-dismisses after configured duration.
 * 
 * WCAG 2.1 Compliance:
 * - role="status" for success/info (polite)
 * - role="alert" for error/warning (assertive)
 * - aria-live for dynamic announcement
 * - aria-atomic for complete message announcement
 * - Dismissible via button
 */
const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  (
    {
      message,
      type = 'info',
      duration = 4000,
      onDismiss,
      id,
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(true);

    // Auto-dismiss after duration
    useEffect(() => {
      if (duration <= 0) return;

      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);

      return () => clearTimeout(timer);
    }, [duration, onDismiss]);

    if (!isVisible) return null;

    // Define styles for each toast type
    const typeStyles = {
      success: {
        bg: 'bg-green-50 dark:bg-green-950',
        text: 'text-green-900 dark:text-green-100',
        border: 'border-green-200 dark:border-green-800',
        icon: 'text-green-600 dark:text-green-400',
        Icon: CheckCircle,
      },
      error: {
        bg: 'bg-red-50 dark:bg-red-950',
        text: 'text-red-900 dark:text-red-100',
        border: 'border-red-200 dark:border-red-800',
        icon: 'text-red-600 dark:text-red-400',
        Icon: AlertCircle,
      },
      warning: {
        bg: 'bg-amber-50 dark:bg-amber-950',
        text: 'text-amber-900 dark:text-amber-100',
        border: 'border-amber-200 dark:border-amber-800',
        icon: 'text-amber-600 dark:text-amber-400',
        Icon: AlertTriangle,
      },
      info: {
        bg: 'bg-cyan-50 dark:bg-cyan-950',
        text: 'text-cyan-900 dark:text-cyan-100',
        border: 'border-cyan-200 dark:border-cyan-800',
        icon: 'text-cyan-600 dark:text-cyan-400',
        Icon: Info,
      },
    };

    const styles = typeStyles[type];
    const { Icon } = styles;
    const isSuccess = type === 'success' || type === 'info';

    return (
      <div
        ref={ref}
        id={id}
        className={`
          flex items-center justify-between gap-3 p-4 rounded-lg border
          ${styles.bg} ${styles.text} ${styles.border}
          animate-in fade-in slide-in-from-bottom-4 duration-300
          shadow-lg max-w-md
        `}
        role={isSuccess ? 'status' : 'alert'}
        aria-live={isSuccess ? 'polite' : 'assertive'}
        aria-atomic="true"
      >
        <div className="flex items-center gap-3 flex-1">
          <Icon
            size={20}
            className={`flex-shrink-0 ${styles.icon}`}
            aria-hidden="true"
          />
          <span className="text-sm font-medium">{message}</span>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            onDismiss?.();
          }}
          className={`
            flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10
            transition-colors duration-200
            focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2
            focus-visible:outline-current
          `}
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      </div>
    );
  }
);

Toast.displayName = 'Toast';

export default Toast;
