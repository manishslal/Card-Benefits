'use client';

import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  animation?: 'pulse' | 'shimmer' | 'none';
  width?: string | number;
  height?: string | number;
}

/**
 * Skeleton Component - Loading Placeholder
 * 
 * WCAG 2.1 Accessibility Features:
 * - role="status" + aria-busy="true" for assistive tech
 * - Distinct visual appearance to indicate loading state
 * - Proper contrast in dark mode
 * 
 * Variants:
 * - text: Single line text skeleton (default height: 20px)
 * - circular: Circle skeleton (avatars, icons)
 * - rectangular: Rectangle skeleton (images, cards)
 * - card: Full card skeleton (complex components)
 * 
 * Animations:
 * - pulse: Fading in/out effect (Tailwind animate-pulse)
 * - shimmer: Gradient sweep effect (premium feel)
 * - none: Static skeleton (useful for testing)
 * 
 * Mobile Responsiveness:
 * - Works seamlessly on all screen sizes
 * - Maintains aspect ratios across devices
 */
const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className = '',
      variant = 'rectangular',
      animation = 'pulse',
      width = '100%',
      height = '20px',
      ...props
    },
    ref
  ) => {
    const baseClasses = [
      'bg-[var(--color-border)]',
      'dark:bg-[var(--color-bg-secondary)]',
      className,
    ].join(' ');

    const animationClasses = {
      pulse: 'animate-pulse',
      shimmer: 'shimmer',
      none: '',
    };

    const variantClasses = {
      text: 'rounded-md',
      circular: 'rounded-full',
      rectangular: 'rounded-lg',
      card: 'rounded-xl',
    };

    const styles = {
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    };

    return (
      <div
        ref={ref}
        className={`${baseClasses} ${animationClasses[animation]} ${variantClasses[variant]}`}
        style={styles}
        role="status"
        aria-busy="true"
        aria-label="Loading content"
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;
