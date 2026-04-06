/**
 * Notification and Badge Components
 */

'use client';

import React from 'react';

/**
 * Toast - Transient notification
 */
interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose: (id: string) => void;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function Toast({ id, type, title, message, onClose, action }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => onClose(id), 3000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">
      <div className="toast-icon" style={{ color: `var(--color-${type})` }}>
        {icons[type]}
      </div>
      <div className="toast-content">
        <div className="toast-title">{title}</div>
        {message && <div className="toast-message">{message}</div>}
      </div>
      {action && (
        <button
          style={{
            padding: 'var(--space-xs)',
            color: `var(--color-${type})`,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      <button
        style={{
          padding: 'var(--space-xs)',
          color: 'var(--color-text-secondary)',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: '1.25rem',
        }}
        onClick={() => onClose(id)}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
}

/**
 * ToastContainer - Container for stacked toasts
 */
interface ToastContainerProps {
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
    action?: { label: string; onClick: () => void };
  }>;
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="toast-container" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onRemove} />
      ))}
    </div>
  );
}

/**
 * Badge - Status badge
 */
interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className || ''}`}>
      {children}
    </span>
  );
}

/**
 * StatusIndicator - Visual status indicator
 */
interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'pending' | 'error';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusIndicator({ status, label, size = 'md' }: StatusIndicatorProps) {
  const statusColors = {
    active: 'var(--color-success)',
    inactive: 'var(--color-gray-400)',
    pending: 'var(--color-warning)',
    error: 'var(--color-error)',
  };

  const sizes = {
    sm: '8px',
    md: '12px',
    lg: '16px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
      <div
        style={{
          width: sizes[size],
          height: sizes[size],
          borderRadius: '50%',
          backgroundColor: statusColors[status],
          animation: status === 'active' ? 'pulse 2s infinite' : 'none',
        }}
        aria-label={`Status: ${status}`}
      />
      {label && <span style={{ fontSize: 'var(--text-body-sm)' }}>{label}</span>}
    </div>
  );
}

/**
 * Alert - Dismissible alert message
 */
interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onDismiss?: () => void;
  actions?: React.ReactNode;
}

export function Alert({ type, title, message, onDismiss, actions }: AlertProps) {
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      style={{
        padding: 'var(--space-lg)',
        marginBottom: 'var(--space-lg)',
        borderLeft: `4px solid var(--color-${type})`,
        backgroundColor: `var(--color-${type}-light)`,
        borderRadius: 'var(--radius-lg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 'var(--space-md)',
      }}
      role="alert"
    >
      <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1 }}>
        <div style={{ color: `var(--color-${type})`, fontSize: '1.25rem' }}>
          {icons[type]}
        </div>
        <div>
          <h4 style={{ margin: '0 0 var(--space-sm) 0', color: 'var(--color-text)' }}>
            {title}
          </h4>
          {message && (
            <p style={{ margin: 0, fontSize: 'var(--text-body-sm)', color: 'var(--color-text-secondary)' }}>
              {message}
            </p>
          )}
          {actions && <div style={{ marginTop: 'var(--space-md)' }}>{actions}</div>}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          style={{
            padding: 'var(--space-xs)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: '1.25rem',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Progress - Progress bar
 */
interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

export function Progress({
  value,
  max = 100,
  label,
  variant = 'default',
}: ProgressProps) {
  const percentage = (value / max) * 100;

  const colors = {
    default: 'var(--color-primary)',
    success: 'var(--color-success)',
    error: 'var(--color-error)',
    warning: 'var(--color-warning)',
  };

  return (
    <div>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 'var(--space-sm)',
            fontSize: 'var(--text-body-sm)',
          }}
        >
          <span>{label}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            backgroundColor: colors[variant],
            transition: 'width var(--duration-base) var(--ease-out)',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Tooltip - Hover tooltip
 */
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [show, setShow] = React.useState(false);

  const positions = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)' },
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </div>

      {show && (
        <div
          style={{
            position: 'absolute',
            ...positions[position],
            backgroundColor: 'var(--color-gray-800)',
            color: 'white',
            padding: 'var(--space-sm) var(--space-md)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-caption)',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
            marginBottom: position === 'top' ? '8px' : undefined,
            marginTop: position === 'bottom' ? '8px' : undefined,
            marginRight: position === 'left' ? '8px' : undefined,
            marginLeft: position === 'right' ? '8px' : undefined,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
