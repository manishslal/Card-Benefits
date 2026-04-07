'use client';

import React from 'react';

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  change?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'gradient';
}

/**
 * StatCard Component - Design System Implementation
 * Displays statistics with optional change indicator
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      className = '',
      label,
      value,
      icon,
      change,
      variant = 'default',
      ...props
    },
    ref
  ) => {
    // Enhancement 2: Use responsive padding - p-4 on mobile, p-6 on tablet+
    const baseClasses = [
      'rounded-lg p-4 sm:p-6 flex flex-col gap-3',
      'bg-[var(--color-bg)] border border-[var(--color-border)]',
      'shadow-sm transition-all duration-200 hover:shadow-md',
      className,
    ].join(' ');

    const gradientClass = variant === 'gradient' 
      ? 'bg-gradient-to-br from-[rgba(51,86,208,0.05)] to-[rgba(217,119,6,0.05)]'
      : '';

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${gradientClass}`}
        {...props}
      >
        {/* Enhancement 2: Remove redundant icon label, keep only text label */}
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {label}
          </span>
        </div>

        <div className="flex items-end justify-between">
          <span
            className="text-3xl font-bold text-[var(--color-text)]"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {value}
          </span>
          {change && (
            <span
              className={`text-xs font-medium ${
                change.isPositive
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-error)]'
              }`}
            >
              {change.isPositive ? '↑' : '↓'} {Math.abs(change.value)}%
            </span>
          )}
        </div>
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export default StatCard;
