'use client';

import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  appearance?: 'solid' | 'soft' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  showStatusIcon?: boolean; // Show color-independent status icon
}

/**
 * Badge Component - Design System Implementation
 * Lightweight status indicator component with optional color-independent icons
 * 
 * Accessibility Features:
 * - Optional status icons (CheckCircle, AlertCircle, Clock) for color-independent indication
 * - Proper contrast in all color modes
 * - Clear visual hierarchy
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className = '',
      variant = 'neutral',
      appearance = 'solid',
      size = 'md',
      icon,
      showStatusIcon = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      'transition-colors duration-200',
      className,
    ].join(' ');

    const getVariantClasses = (v: string, a: string) => {
      const styles: Record<string, Record<string, string>> = {
        solid: {
          primary: 'bg-[var(--color-primary)] text-white',
          success: 'bg-[var(--color-success)] text-white',
          warning: 'bg-[var(--color-warning)] text-white',
          error: 'bg-[var(--color-error)] text-white',
          info: 'bg-[var(--color-info)] text-white',
          neutral: 'bg-[var(--color-gray-100)] text-[var(--color-text)]',
        },
        soft: {
          primary: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
          success: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
          warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning)]',
          error: 'bg-[var(--color-error-light)] text-[var(--color-error)]',
          info: 'bg-[var(--color-info-light)] text-[var(--color-info)]',
          neutral: 'bg-[var(--color-gray-100)] text-[var(--color-text-secondary)]',
        },
        outline: {
          primary: 'border border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent',
          success: 'border border-[var(--color-success)] text-[var(--color-success)] bg-transparent',
          warning: 'border border-[var(--color-warning)] text-[var(--color-warning)] bg-transparent',
          error: 'border border-[var(--color-error)] text-[var(--color-error)] bg-transparent',
          info: 'border border-[var(--color-info)] text-[var(--color-info)] bg-transparent',
          neutral: 'border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-transparent',
        },
      };
      return styles[a]?.[v] || styles.solid.neutral;
    };

    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    // Get status icon based on variant
    const getStatusIcon = () => {
      if (!showStatusIcon) return null;
      
      switch (variant) {
        case 'success':
          return <CheckCircle size={14} className="flex-shrink-0" aria-hidden="true" />;
        case 'error':
          return <AlertCircle size={14} className="flex-shrink-0" aria-hidden="true" />;
        case 'warning':
          return <Clock size={14} className="flex-shrink-0" aria-hidden="true" />;
        default:
          return null;
      }
    };

    return (
      <span
        ref={ref}
        className={`${baseClasses} ${getVariantClasses(variant, appearance)} ${sizeClasses[size]}`}
        {...props}
      >
        {showStatusIcon && getStatusIcon()}
        {icon && !showStatusIcon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
