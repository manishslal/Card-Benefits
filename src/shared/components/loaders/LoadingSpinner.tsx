'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';           // 24px, 40px, 64px
  variant?: 'default' | 'overlay';     // overlay = centered with semi-transparent bg
  ariaLabel?: string;                  // Accessibility
  className?: string;
}

/**
 * LoadingSpinner Component - Animated Loading Indicator
 * 
 * Smooth CSS-based spinner animation without image assets.
 * 
 * Variants:
 * - 'default': Inline spinner (button, inline loading)
 * - 'overlay': Full-page overlay spinner (page transitions, data loading)
 * 
 * WCAG 2.1 Compliance:
 * - role="status" for semantic meaning
 * - aria-label for screen reader description
 * - Smooth animation (no seizure-inducing flashing)
 * - Accessible color contrast
 */
const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  (
    {
      size = 'md',
      variant = 'default',
      ariaLabel = 'Loading',
      className = '',
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'w-6 h-6 border-2',
      md: 'w-10 h-10 border-[3px]',
      lg: 'w-16 h-16 border-4',
    };

    const spinnerClasses = `
      inline-block rounded-full border-current border-t-transparent
      animate-spin ${sizeClasses[size]} ${className}
    `;

    if (variant === 'overlay') {
      return (
        <div
          ref={ref}
          className="fixed inset-0 flex items-center justify-center bg-black/50 dark:bg-black/70 z-50"
          role="status"
          aria-label={ariaLabel}
          aria-busy="true"
        >
          <div
            className={`${spinnerClasses} text-[var(--color-primary)]`}
          />
        </div>
      );
    }

    // Default inline spinner
    return (
      <div
        ref={ref}
        className={spinnerClasses}
        style={{
          color: 'currentColor',
          borderTopColor: 'currentColor',
          borderRightColor: 'currentColor',
          borderBottomColor: 'currentColor',
          borderLeftColor: 'transparent',
        }}
        role="status"
        aria-label={ariaLabel}
        aria-busy="true"
      />
    );
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
