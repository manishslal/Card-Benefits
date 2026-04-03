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
 * Accessibility Features:
 * - role="status" + aria-busy="true" for assistive tech
 * - Distinct visual appearance to indicate loading state
 * 
 * Variants:
 * - text: Single line text skeleton
 * - circular: Circle skeleton (avatars, icons)
 * - rectangular: Rectangle skeleton (images, cards)
 * - card: Full card skeleton (complex components)
 * 
 * Animations:
 * - pulse: Fading in/out effect
 * - shimmer: Gradient sweep effect (premium feel)
 * - none: Static skeleton
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
      'dark:bg-[var(--color-border)]',
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
        aria-label="Loading"
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export default Skeleton;

/**
 * Shimmer animation keyframes
 * Add this to your globals.css or animations.css:
 * 
 * @keyframes shimmer {
 *   0% {
 *     background-position: -1000px 0;
 *   }
 *   100% {
 *     background-position: 1000px 0;
 *   }
 * }
 * 
 * .shimmer {
 *   background: linear-gradient(
 *     90deg,
 *     transparent 0%,
 *     rgba(255, 255, 255, 0.2) 20%,
 *     rgba(255, 255, 255, 0.5) 60%,
 *     transparent 100%
 *   );
 *   background-size: 1000px 100%;
 *   animation: shimmer 2s infinite;
 * }
 * 
 * .dark .shimmer {
 *   background: linear-gradient(
 *     90deg,
 *     transparent 0%,
 *     rgba(255, 255, 255, 0.1) 20%,
 *     rgba(255, 255, 255, 0.3) 60%,
 *     transparent 100%
 *   );
 *   background-size: 1000px 100%;
 *   animation: shimmer 2s infinite;
 * }
 */
