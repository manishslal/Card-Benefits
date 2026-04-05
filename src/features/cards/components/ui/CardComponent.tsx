'use client';

import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'bordered' | 'flat';
  interactive?: boolean;
}

/**
 * Card Component - Design System Implementation
 * Supports elevated, bordered, and flat variants
 */
const CardComponent = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className = '',
      variant = 'elevated',
      interactive = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'rounded-lg p-6 transition-all duration-200',
      'bg-[var(--color-bg)] border border-transparent',
      interactive ? 'cursor-pointer' : '',
      className,
    ].join(' ');

    const variantClasses = {
      elevated: `shadow-md ${interactive ? 'hover:shadow-lg hover:-translate-y-0.5' : ''}`,
      bordered: `border-[var(--color-border)] ${interactive ? 'hover:border-[var(--color-primary)] hover:shadow-md' : ''}`,
      flat: `bg-[var(--color-bg-secondary)] ${interactive ? 'hover:bg-[var(--color-gray-100)]' : ''}`,
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardComponent.displayName = 'Card';

export default CardComponent;
