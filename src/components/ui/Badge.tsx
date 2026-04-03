'use client';

import React from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

/**
 * Badge Component - Design System Implementation
 * Lightweight status indicator component
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className = '',
      variant = 'neutral',
      size = 'md',
      icon,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'inline-flex items-center gap-1 rounded-full font-medium',
      'transition-colors duration-200',
      className,
    ].join(' ');

    const variantClasses = {
      primary: 'bg-[var(--color-primary)] text-white',
      success: 'bg-[var(--color-success)] text-white',
      warning: 'bg-[var(--color-warning)] text-white',
      error: 'bg-[var(--color-error)] text-white',
      info: 'bg-[var(--color-info)] text-white',
      neutral: 'bg-[var(--color-gray-100)] text-[var(--color-text)]',
    };

    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    return (
      <span
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
        {...props}
      >
        {icon && <span>{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
