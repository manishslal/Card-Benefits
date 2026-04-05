'use client';

import React from 'react';
import Skeleton from '../ui/Skeleton';

interface SkeletonTextProps {
  lines?: number;         // Number of text lines
  width?: string;        // Width override (default 100%)
  className?: string;
}

/**
 * SkeletonText Component - Text Loading Placeholder
 * 
 * Displays multiple skeleton lines for text content.
 * Last line is shorter to simulate natural text paragraph.
 * 
 * WCAG 2.1 Compliance:
 * - role="status" + aria-busy="true"
 * - Semantic structure
 * - Proper contrast in both light and dark modes
 */
const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  (
    {
      lines = 3,
      width = '100%',
      className = '',
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`space-y-2 ${className}`}
        role="status"
        aria-busy="true"
        aria-label="Loading text content"
      >
        {Array.from({ length: lines }).map((_, index) => {
          // Last line is shorter to simulate paragraph ending
          const isLastLine = index === lines - 1;
          const lineWidth = isLastLine ? '75%' : width;

          return (
            <Skeleton
              key={index}
              variant="text"
              animation="pulse"
              width={lineWidth}
              height="16px"
            />
          );
        })}
      </div>
    );
  }
);

SkeletonText.displayName = 'SkeletonText';

export default SkeletonText;
