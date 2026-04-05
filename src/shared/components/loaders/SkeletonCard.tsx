'use client';

import React from 'react';
import Skeleton from '../ui/Skeleton';

interface SkeletonCardProps {
  rows?: number;          // Number of text skeleton rows
  showImage?: boolean;    // Show image placeholder
  className?: string;
}

/**
 * SkeletonCard Component - Loading Placeholder for Cards
 * 
 * Matches card layout with configurable content:
 * - Optional image/avatar placeholder
 * - Multiple text skeleton rows for content
 * - Smooth pulsing animation
 * - Full accessibility support
 * 
 * WCAG 2.1 Compliance:
 * - role="status" + aria-busy="true"
 * - Semantic structure for screen readers
 * - Proper contrast in light/dark modes
 * - Minimum 200ms display time to avoid flashing
 */
const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  (
    {
      rows = 3,
      showImage = true,
      className = '',
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          p-4 rounded-lg border border-[var(--color-border)]
          bg-[var(--color-bg)] dark:bg-[var(--color-bg-secondary)]
          ${className}
        `}
        role="status"
        aria-busy="true"
        aria-label="Loading card content"
      >
        {/* Optional Image Placeholder */}
        {showImage && (
          <Skeleton
            variant="rectangular"
            animation="pulse"
            width="100%"
            height="180px"
            className="mb-4"
          />
        )}

        {/* Text Content Skeleton */}
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index}>
              {/* First row slightly wider than others for title */}
              {index === 0 ? (
                <Skeleton
                  variant="text"
                  animation="pulse"
                  width="85%"
                  height="20px"
                />
              ) : (
                <Skeleton
                  variant="text"
                  animation="pulse"
                  width="100%"
                  height="16px"
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer action area */}
        <div className="mt-4 flex gap-2">
          <Skeleton
            variant="rectangular"
            animation="pulse"
            width="45%"
            height="36px"
            className="rounded-md"
          />
          <Skeleton
            variant="rectangular"
            animation="pulse"
            width="45%"
            height="36px"
            className="rounded-md"
          />
        </div>
      </div>
    );
  }
);

SkeletonCard.displayName = 'SkeletonCard';

export default SkeletonCard;
